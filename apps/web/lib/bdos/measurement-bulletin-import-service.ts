import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canAdvanceStatus,
  importBulletinExcel,
  MeasurementWorkspaceStatus,
  MEASUREMENT_ANALYSIS_PARSER_KEY,
  MEASUREMENT_ANALYSIS_RESULT_SCHEMA_VERSION,
  type FailedMeasurementAnalysisResult,
  type MeasurementAnalysisResult,
  type MeasurementImportIssue,
  type ParsedMeasurementBulletin,
  type ParsedSkippedSheet,
  type ProcessMeasurementBulletinImportInput,
  type ProcessMeasurementBulletinImportResult,
  type ReconciledOrNeedsReviewMeasurementAnalysisResult
} from "@bba/bdos-core/services/measurement-bulletin-import";
import {
  claimMeasurementBulletinImportForProcessing,
  finalizeMeasurementBulletinImportWithResult,
  findMatchingManagedServiceItemOrCreate,
  findOrCreateWorkPackage,
  getMeasurementBulletinImportById,
  getMeasurementWorkspaceByImportId,
  getMeasurementWorkspaceLineByWorkspaceAndServiceItem,
  insertMeasurementWorkspace,
  insertMeasurementWorkspaceLine,
  listMeasurementWorkspaceLines,
  listMeasurementWorkspacesByProjectAndPeriod,
  updateMeasurementWorkspaceLine,
  updateMeasurementWorkspaceStatus,
  type ManagedServiceItemRecord,
  type MeasurementWorkspaceLineRecord,
  type MeasurementWorkspaceRecord,
  type WorkPackageType
} from "./measurement-repository";

// Application Service do Studio de Medições (Epic 19, Sprint 4D.2) --
// primeiro serviço deste repositório que recebe um SupabaseClient e
// orquestra parser + repository na mesma função (nenhum precedente
// existente em packages/bdos-core/src/services/* para espelhar; os
// serviços de lá são todos puros/síncronos, sem I/O). Vive em
// apps/web pelo mesmo motivo de measurement-repository.ts (depende do
// SupabaseClient autenticado server-side) -- nunca em bdos-core.
//
// Fronteira obrigatória (congelada na Sprint 4.0, reafirmada aqui):
// só chama o parser (`importBulletinExcel`) e as funções nomeadas de
// `measurement-repository.ts` -- nunca `supabase.from(...)` inline
// para tabelas que o repository já cobre. A única exceção é
// `supabase.storage`, porque não há primitiva de repository para
// download de Storage (mesmo padrão do Epic 18).
//
// Implementa exatamente os 14 passos de
// EPIC_19_SPRINT_4D_APPLICATION_SERVICE_DESIGN.md, Parte V, com as
// cinco correções da revisão de arquitetura já incorporadas (Parte
// XIII), mais os quatro ajustes da revisão pós-E2E contra o BM_08 real
// (registrados nos pontos de código correspondentes): TRUNC(qty*preço,2)
// na reconciliação monetária, period_number_conflict, validação
// explícita de Draft->InProgress via canAdvanceStatus, e a
// confirmação (não mudança) de que cada nó da EAP -- agregador ou
// folha -- vira seu próprio WorkPackage, mesmo padrão já usado por
// ms-project-xml-import.ts.
//
// Uma decisão nova, não coberta pelo desenho, registrada aqui por ter
// sido tomada nesta implementação: `download_failed`/`parse_failed`
// persistem um FailedMeasurementAnalysisResult (correção 5) e devolvem
// esse snapshot no próprio ProcessMeasurementBulletinImportFailure
// (campo `analysisResult`, aditivo ao contrato congelado) -- sem isso,
// o chamador não teria como ver o resultado que acabou de ser
// persistido sem uma segunda consulta.

const STORAGE_BUCKET = "bdos-imports";

// Mesma tolerância de RECONCILIATION_EPSILON em bulletin-import.ts
// (não exportada de lá -- redeclarada aqui com o mesmo valor e o
// mesmo raciocínio: nunca igualdade binária de ponto flutuante para
// valores monetários).
const TOTAL_DIFFERENCE_TOLERANCE = 0.01;

export async function processMeasurementBulletinImport(
  supabase: SupabaseClient,
  input: ProcessMeasurementBulletinImportInput
): Promise<ProcessMeasurementBulletinImportResult> {
  const { companyId, measurementBulletinImportId } = input;

  // Passo 1
  const importRecord = await getMeasurementBulletinImportById(supabase, { id: measurementBulletinImportId, companyId });
  if (!importRecord) {
    return { success: false, error: "import_not_found" };
  }

  // Passo 2 -- early exits antes de qualquer download/parse.
  if (importRecord.status === "completed") {
    const persisted = toMeasurementAnalysisResult(importRecord.analysisResult);
    return {
      success: true,
      outcome: {
        kind: "already_completed",
        measurementWorkspaceId: persisted?.measurementWorkspaceId ?? null,
        issues: persisted?.structuralIssues ?? [],
        analysisResult: persisted
      }
    };
  }

  if (importRecord.status === "processing") {
    return {
      success: true,
      outcome: { kind: "already_processing", measurementWorkspaceId: null, issues: [], analysisResult: null }
    };
  }

  // status é 'uploaded' ou 'failed' daqui em diante.

  // Passo 3 -- decide MODO FRESCO ou MODO RETOMADA; early exits para
  // ReadyForReview/Closed/Cancelled (correção 1: ReadyForReview nunca
  // é retomado automaticamente).
  let existingWorkspace = await getMeasurementWorkspaceByImportId(supabase, {
    measurementBulletinImportId,
    companyId
  });

  if (existingWorkspace) {
    const earlyExit = earlyExitForWorkspaceStatus(existingWorkspace);
    if (earlyExit) {
      return { success: true, outcome: earlyExit };
    }
  }

  let isResumedMode = existingWorkspace !== null;

  // Passo 4 -- claim atômico (correção 4).
  const claimed = await claimMeasurementBulletinImportForProcessing(supabase, { id: measurementBulletinImportId, companyId });
  if (!claimed) {
    return {
      success: true,
      outcome: { kind: "already_processing", measurementWorkspaceId: existingWorkspace?.id ?? null, issues: [], analysisResult: null }
    };
  }

  // Passo 5 -- download por referência (nunca path do cliente).
  const { data: downloadData, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(claimed.storagePath);

  if (downloadError || !downloadData) {
    const failureResult = buildFailedAnalysisResult({
      measurementBulletinImportId,
      engineeringProjectId: claimed.engineeringProjectId,
      measurementWorkspaceId: existingWorkspace?.id ?? null,
      declaredBulletinNumber: null,
      declaredPeriod: null,
      structuralIssues: [],
      skippedSheets: []
    });
    await finalizeWithResultOrThrow(supabase, { id: measurementBulletinImportId, companyId, status: "failed", analysisResult: failureResult });
    return { success: false, error: "download_failed", analysisResult: failureResult };
  }

  const bytes = new Uint8Array(await downloadData.arrayBuffer());

  // Passo 6 -- o parser não deveria lançar por contrato; o wrapper
  // trata qualquer throw inesperado como parse_failed, defensivamente.
  let parsed: ParsedMeasurementBulletin;
  try {
    parsed = importBulletinExcel({ bytes, fileName: claimed.fileName }).bulletin;
  } catch (error) {
    const failureResult = buildFailedAnalysisResult({
      measurementBulletinImportId,
      engineeringProjectId: claimed.engineeringProjectId,
      measurementWorkspaceId: existingWorkspace?.id ?? null,
      declaredBulletinNumber: null,
      declaredPeriod: null,
      structuralIssues: [],
      skippedSheets: []
    });
    await finalizeWithResultOrThrow(supabase, { id: measurementBulletinImportId, companyId, status: "failed", analysisResult: failureResult });
    return { success: false, error: "parse_failed", analysisResult: failureResult };
  }

  const issues: MeasurementImportIssue[] = [...parsed.issues];

  // Passo 7 -- GATE A: issues do próprio parser, antes de qualquer
  // materialização. Vale tanto em modo fresco quanto em retomada --
  // uma retomada nunca "empurra" linhas de uma fonte que o próprio
  // parser já reprovou.
  if (issues.some((issue) => issue.severity === "blocking")) {
    return finalizeAsFailed(supabase, {
      companyId,
      measurementBulletinImportId,
      engineeringProjectId: claimed.engineeringProjectId,
      measurementWorkspaceId: existingWorkspace?.id ?? null,
      declaredBulletinNumber: parsed.declaredBulletinNumber,
      declaredPeriod: parsed.declaredPeriod,
      structuralIssues: issues,
      skippedSheets: parsed.skippedSheets
    });
  }

  // Passos 8-9 -- materializar catálogo (WorkPackage/ManagedServiceItem).
  // Escopados ao projeto, não ao workspace -- nunca "trabalho
  // perdido" se um gate posterior recusar (Parte V).
  const workPackageIdByCode = new Map<string, string>();
  let workPackagesCreated = 0;
  let workPackagesMatched = 0;

  for (const parsedWorkPackage of [...parsed.workPackages].sort((a, b) => a.code.localeCompare(b.code))) {
    const candidateId = randomUUID();
    const parentWorkPackageId = parsedWorkPackage.parentCode ? (workPackageIdByCode.get(parsedWorkPackage.parentCode) ?? null) : null;

    const record = await findOrCreateWorkPackage(supabase, {
      id: candidateId,
      companyId,
      engineeringProjectId: claimed.engineeringProjectId,
      code: parsedWorkPackage.code,
      normalizedCode: normalizeCatalogCode(parsedWorkPackage.code),
      name: parsedWorkPackage.name,
      type: resolveWorkPackageType(parsedWorkPackage.isAggregator),
      parentWorkPackageId
    });

    // findOrCreateWorkPackage não devolve outcome (diferente de
    // findMatchingManagedServiceItemOrCreate) -- inferimos created vs.
    // matched comparando o id devolvido contra o id que nós mesmos
    // geramos: só é igual quando o INSERT desta chamada venceu.
    if (record.id === candidateId) {
      workPackagesCreated += 1;
    } else {
      workPackagesMatched += 1;
    }

    workPackageIdByCode.set(parsedWorkPackage.code, record.id);
  }

  const serviceItemByCode = new Map<string, ManagedServiceItemRecord>();
  let serviceItemsCreated = 0;
  let serviceItemsMatched = 0;

  for (const parsedItem of parsed.serviceItems) {
    const ownerWorkPackageId = workPackageIdByCode.get(parsedItem.workPackageCode);
    if (!ownerWorkPackageId) {
      // Nunca deveria acontecer -- todo ParsedManagedServiceItem nasce
      // da mesma linha que gera seu próprio ParsedWorkPackage
      // (workPackageCode === code), já materializado no laço acima.
      // Defensivo, não um caminho de negócio esperado.
      throw new Error(`WorkPackage não encontrado para o item de serviço "${parsedItem.code}" (workPackageCode="${parsedItem.workPackageCode}").`);
    }

    const { item, outcome } = await findMatchingManagedServiceItemOrCreate(supabase, {
      id: randomUUID(),
      companyId,
      engineeringProjectId: claimed.engineeringProjectId,
      workPackageId: ownerWorkPackageId,
      code: parsedItem.code,
      description: parsedItem.description,
      unit: parsedItem.unit ?? "",
      contractQuantity: parsedItem.declaredContractQuantity ?? 0,
      unitPrice: parsedItem.declaredUnitPrice ?? 0
    });

    if (outcome === "created") {
      serviceItemsCreated += 1;
    } else {
      serviceItemsMatched += 1;

      // R3 -- descrição divergente é warning; unidade divergente é
      // blocking (usar o preço unitário existente contra uma unidade
      // diferente pode gerar cálculo financeiramente inválido).
      if (normalizeForComparison(item.description) !== normalizeForComparison(parsedItem.description)) {
        issues.push({
          code: "service_item_description_mismatch",
          severity: "warning",
          message: `Item "${parsedItem.code}": descrição do catálogo ("${item.description}") diverge da declarada no arquivo ("${parsedItem.description}").`
        });
      }

      if (normalizeForComparison(item.unit) !== normalizeForComparison(parsedItem.unit ?? "")) {
        issues.push({
          code: "service_item_unit_mismatch",
          severity: "blocking",
          message: `Item "${parsedItem.code}": unidade do catálogo ("${item.unit}") diverge da declarada no arquivo ("${parsedItem.unit ?? ""}"). A linha não pode ser materializada automaticamente contra este item.`
        });
      }
    }

    serviceItemByCode.set(parsedItem.code, item);
  }

  // Passo 7 (continuação) -- GATE B: reavalia com as issues de
  // catálogo (service_item_unit_mismatch) somadas às do parser. As
  // alterações de catálogo já feitas ficam (não são desfeitas --
  // dado de projeto legitimamente reaproveitável, Parte V).
  if (issues.some((issue) => issue.severity === "blocking")) {
    return finalizeAsFailed(supabase, {
      companyId,
      measurementBulletinImportId,
      engineeringProjectId: claimed.engineeringProjectId,
      measurementWorkspaceId: existingWorkspace?.id ?? null,
      declaredBulletinNumber: parsed.declaredBulletinNumber,
      declaredPeriod: parsed.declaredPeriod,
      structuralIssues: issues,
      skippedSheets: parsed.skippedSheets
    });
  }

  // Passo 10 -- criar ou retomar workspace.
  let workspace: MeasurementWorkspaceRecord;
  if (existingWorkspace) {
    workspace = existingWorkspace;
  } else {
    // Gate A já garante declaredBulletinNumber não-nulo (senão
    // "ambiguous_period_label" já teria bloqueado) -- seguro usar `!`.
    // declaredPeriod/startDate/endDate podem faltar mesmo com o gate
    // passando (extractDeclaredPeriod só popula labels quando não
    // encontra o padrão de datas) -- lacuna não coberta pelo desenho;
    // tratada aqui como o mesmo tipo de issue de período ambíguo,
    // agora reavaliada porque só é conhecida depois do parse.
    if (parsed.declaredPeriod === null || parsed.declaredPeriod.startDate === null || parsed.declaredPeriod.endDate === null) {
      issues.push({
        code: "ambiguous_period_label",
        severity: "blocking",
        message: "O arquivo declara o número do boletim, mas não foi possível determinar as datas de início/fim do período -- measurement_workspaces.start_date/end_date exigem valor."
      });
      return finalizeAsFailed(supabase, {
        companyId,
        measurementBulletinImportId,
        engineeringProjectId: claimed.engineeringProjectId,
        measurementWorkspaceId: null,
        declaredBulletinNumber: parsed.declaredBulletinNumber,
        declaredPeriod: parsed.declaredPeriod,
        structuralIssues: issues,
        skippedSheets: parsed.skippedSheets
      });
    }

    // period_number_conflict (Parte IX do desenho) -- só faz sentido em
    // MODO FRESCO: como este import ainda não tem workspace, qualquer
    // workspace devolvido aqui pertence, por construção, a um import
    // DIFERENTE no mesmo projeto reivindicando o mesmo período. Nunca
    // bloqueia (remedição de período é legítima) -- só sinaliza.
    const conflictingWorkspaces = await listMeasurementWorkspacesByProjectAndPeriod(supabase, {
      companyId,
      engineeringProjectId: claimed.engineeringProjectId,
      periodNumber: parsed.declaredBulletinNumber as number
    });
    if (conflictingWorkspaces.length > 0) {
      issues.push({
        code: "period_number_conflict",
        severity: "warning",
        message: `Já existe ${conflictingWorkspaces.length === 1 ? "outro workspace" : `${conflictingWorkspaces.length} outros workspaces`} para o período ${parsed.declaredBulletinNumber} neste projeto (import(s) diferente(s) deste). Pode ser remedição legítima -- não bloqueado, apenas sinalizado.`
      });
    }

    try {
      workspace = await insertMeasurementWorkspace(supabase, {
        id: randomUUID(),
        companyId,
        engineeringProjectId: claimed.engineeringProjectId,
        measurementBulletinImportId,
        periodNumber: parsed.declaredBulletinNumber as number,
        startDate: parsed.declaredPeriod.startDate,
        endDate: parsed.declaredPeriod.endDate,
        createdBy: companyId,
        declaredBulletinNumber: parsed.declaredBulletinNumber,
        declaredPeriodStart: parsed.declaredPeriod.startDate,
        declaredPeriodEnd: parsed.declaredPeriod.endDate
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Outra execução venceu a corrida entre o passo 3 e este -- relê
      // e cai em MODO RETOMADA a partir daqui.
      const wonByOther = await getMeasurementWorkspaceByImportId(supabase, { measurementBulletinImportId, companyId });
      if (!wonByOther) {
        throw error ?? new Error("Colisão ao criar MeasurementWorkspace, mas nenhum workspace foi encontrado na releitura.");
      }
      workspace = wonByOther;
      existingWorkspace = wonByOther;
      isResumedMode = true;
    }
  }

  // Passo 11 -- materializar linhas, com comparação explícita em
  // colisão (correção 2), nunca skip cego.
  let linesImported = 0;
  let linesAlreadyPresent = 0;
  let linesUpdated = 0;

  for (const parsedLine of parsed.lines) {
    const serviceItem = serviceItemByCode.get(parsedLine.serviceItemCode);
    if (!serviceItem) {
      // Mesma garantia estrutural do laço de catálogo acima -- toda
      // ParsedMeasurementLine referencia um serviceItemCode que já
      // passou pelo laço de service items.
      throw new Error(`ManagedServiceItem não encontrado para a linha "${parsedLine.serviceItemCode}".`);
    }

    const quantity = parsedLine.declaredQuantity ?? 0;
    const unitValue = serviceItem.unitPrice;
    // SEMPRE quantity * unitValue -- nunca copiado de declaredTotalValue
    // (Invariante #4). unitValue vem do catálogo (preço de contrato já
    // resolvido), nunca de declaredUnitValue (o parser hoje sempre
    // grava null nesse campo -- gap conhecido, Parte X do desenho).
    //
    // truncateDnocsLineTotalToCents, não multiplicação crua: rastreado
    // contra a fórmula real do BM_08 (aba "BOLETIM FÍSICO FINANCEIRO",
    // células M37 etc.): `=TRUNC(F37*I37,2)` -- o arquivo TRUNCA o
    // produto quantidade×preço-unitário a 2 casas, nunca arredonda.
    // Confirmado em 4 das 15 linhas reais do BM_08 (ex.: 01.04.01:
    // 3,32 × 8170,05 = 27124,566 sem truncar; TRUNC(...,2) = 27124,56,
    // batendo exatamente com o valor declarado). Sem isso, a diferença
    // acumulada nessas 4 linhas era R$ 0,02 -- acima da tolerância de
    // 1 centavo, mesmo com o cálculo aritmeticamente "correto".
    //
    // Escopo deliberado: TRUNC é uma regra comprovada do TEMPLATE
    // DNOCS (parserKey "dnocs-measurement-bulletin-v1"), não uma
    // política monetária universal do Measurement Studio -- outro
    // órgão/contrato pode arredondar, usar mais casas, ou compor o
    // valor de outra forma. Por isso o helper é privado a ESTE
    // arquivo (o Application Service do pipeline DNOCS), nunca movido
    // para measurement-workspace.ts, measurement-calculation/* ou
    // bulletin-generator (código de domínio compartilhado por
    // qualquer origem de medição, presente ou futura). Quando um
    // segundo parser real chegar (R6 -- não construído agora sem
    // evidência), essa regra deve virar parte do que o PARSER declara
    // sobre si mesmo (ex.: um campo de política monetária no
    // resultado do parser), não uma constante global.
    const totalValue = truncateDnocsLineTotalToCents(quantity * unitValue);

    const sourcePhysicalColumn = parsedLine.sourceLocation.physicalColumn ?? null;
    const sourceFinancialColumn = parsedLine.sourceLocation.financialColumn ?? null;

    const existingLine = await getMeasurementWorkspaceLineByWorkspaceAndServiceItem(supabase, {
      measurementWorkspaceId: workspace.id,
      managedServiceItemId: serviceItem.id
    });

    if (!existingLine) {
      await insertMeasurementWorkspaceLine(supabase, {
        id: randomUUID(),
        measurementWorkspaceId: workspace.id,
        managedServiceItemId: serviceItem.id,
        quantity,
        unitValue,
        totalValue,
        declaredQuantity: parsedLine.declaredQuantity,
        declaredUnitValue: parsedLine.declaredUnitValue,
        declaredTotalValue: parsedLine.declaredTotalValue,
        sourceSheetName: parsedLine.sourceLocation.sheetName,
        sourceRowNumber: parsedLine.sourceLocation.rowNumber,
        sourcePhysicalColumn,
        sourceFinancialColumn
      });
      linesImported += 1;
      continue;
    }

    const isIdentical =
      existingLine.quantity === quantity &&
      existingLine.unitValue === unitValue &&
      existingLine.totalValue === totalValue &&
      existingLine.declaredQuantity === parsedLine.declaredQuantity &&
      existingLine.declaredUnitValue === parsedLine.declaredUnitValue &&
      existingLine.declaredTotalValue === parsedLine.declaredTotalValue &&
      existingLine.sourceSheetName === parsedLine.sourceLocation.sheetName &&
      existingLine.sourceRowNumber === parsedLine.sourceLocation.rowNumber &&
      existingLine.sourcePhysicalColumn === sourcePhysicalColumn &&
      existingLine.sourceFinancialColumn === sourceFinancialColumn;

    if (isIdentical) {
      linesAlreadyPresent += 1;
      continue;
    }

    // Só chega aqui em Draft/InProgress -- ReadyForReview e
    // posteriores já saíram por early exit no passo 3.
    const updated = await updateMeasurementWorkspaceLine(supabase, {
      id: existingLine.id,
      measurementWorkspaceId: workspace.id,
      quantity,
      unitValue,
      totalValue,
      declaredQuantity: parsedLine.declaredQuantity,
      declaredUnitValue: parsedLine.declaredUnitValue,
      declaredTotalValue: parsedLine.declaredTotalValue,
      sourceSheetName: parsedLine.sourceLocation.sheetName,
      sourceRowNumber: parsedLine.sourceLocation.rowNumber,
      sourcePhysicalColumn,
      sourceFinancialColumn
    });

    if (!updated) {
      throw new Error(`updateMeasurementWorkspaceLine devolveu null para a linha ${existingLine.id} -- anomalia de consistência (id ou workspace não confere mais).`);
    }

    linesUpdated += 1;
  }

  // Passo 12 -- avança Draft -> InProgress. advanceMeasurementWorkspaceStatus
  // (o construtor completo do aggregate) não é usado aqui -- exige um
  // aggregate rico (lines/summary/trace/reference/period) incompatível
  // com o modelo normalizado que este Repository persiste. Mas a
  // VALIDAÇÃO da transição não é pulada: canAdvanceStatus é a mesma
  // função pura exportada de measurement-workspace.ts (a tabela real
  // de transições, não uma cópia solta), chamada explicitamente antes
  // de qualquer escrita. "Application Service decide, domínio valida,
  // Repository persiste" -- updateMeasurementWorkspaceStatus nunca
  // decide sozinho se a transição faz sentido.
  //
  // Na prática, para workspace.status !== "Draft" chegar aqui como
  // InProgress (idempotente, no-op) ou -- estruturalmente impossível,
  // dado que ReadyForReview/Closed/Cancelled já saíram por early exit
  // no passo 3 -- qualquer outro valor seria recusado por
  // canAdvanceStatus, nunca silenciosamente ignorado.
  if (workspace.status !== MeasurementWorkspaceStatus.InProgress) {
    if (!canAdvanceStatus(workspace.status as MeasurementWorkspaceStatus, MeasurementWorkspaceStatus.InProgress)) {
      throw new Error(
        `Transição de status inválida: workspace ${workspace.id} está em '${workspace.status}', que não pode avançar para 'InProgress' -- anomalia de consistência, nunca esperada dado que ReadyForReview/Closed/Cancelled já saíram por early exit.`
      );
    }
    await updateMeasurementWorkspaceStatus(supabase, { id: workspace.id, companyId, status: "InProgress" });
  }

  // Passo 10 (releitura obrigatória, correção 2/5) -- nunca o DTO do
  // parser em memória.
  const persistedLines = await listMeasurementWorkspaceLines(supabase, { measurementWorkspaceId: workspace.id });
  const recalculatedTotal = persistedLines.reduce((sum, line) => sum + line.totalValue, 0);
  const officialPeriodTotal = parsed.officialPeriodTotal;
  const totalDifference = recalculatedTotal - officialPeriodTotal;

  const hasWarning = issues.some((issue) => issue.severity === "warning");
  const isReconciled = Math.abs(totalDifference) <= TOTAL_DIFFERENCE_TOLERANCE && !hasWarning;

  const analysisResult: ReconciledOrNeedsReviewMeasurementAnalysisResult = {
    schemaVersion: MEASUREMENT_ANALYSIS_RESULT_SCHEMA_VERSION,
    parserKey: MEASUREMENT_ANALYSIS_PARSER_KEY,
    generatedAt: new Date().toISOString(),
    measurementBulletinImportId,
    engineeringProjectId: claimed.engineeringProjectId,
    declaredBulletinNumber: parsed.declaredBulletinNumber,
    declaredPeriod: parsed.declaredPeriod,
    structuralIssues: issues,
    skippedSheets: parsed.skippedSheets,
    status: isReconciled ? "reconciled" : "needs_review",
    measurementWorkspaceId: workspace.id,
    officialPeriodTotal,
    recalculatedTotal,
    totalDifference,
    workPackages: { created: workPackagesCreated, matched: workPackagesMatched },
    serviceItems: { created: serviceItemsCreated, matched: serviceItemsMatched },
    // O parser já filtra itens sem quantidade/valor no período antes
    // de gerar `lines` (ver bulletin-import.ts, extractRows) -- nunca
    // chegam aqui para serem "pulados" por este serviço, por isso
    // sempre 0. Campo mantido no contrato (Parte X do desenho) para
    // um parser futuro que decida expor itens de valor zero como
    // ParsedMeasurementLine em vez de omiti-los.
    lines: { imported: linesImported, alreadyPresent: linesAlreadyPresent, updated: linesUpdated, skippedZeroValue: 0 }
  };

  // Passo 13/14 -- persistência atômica (correção 5).
  await finalizeWithResultOrThrow(supabase, {
    id: measurementBulletinImportId,
    companyId,
    status: "completed",
    analysisResult
  });

  return {
    success: true,
    outcome: {
      kind: isResumedMode ? "resumed" : "completed",
      measurementWorkspaceId: workspace.id,
      issues,
      analysisResult
    }
  };
}

// ---------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------

function earlyExitForWorkspaceStatus(
  workspace: MeasurementWorkspaceRecord
): { kind: "workspace_ready_for_review" | "workspace_closed" | "workspace_cancelled"; measurementWorkspaceId: string; issues: []; analysisResult: null } | null {
  if (workspace.status === "ReadyForReview") {
    return { kind: "workspace_ready_for_review", measurementWorkspaceId: workspace.id, issues: [], analysisResult: null };
  }
  if (workspace.status === "Closed") {
    return { kind: "workspace_closed", measurementWorkspaceId: workspace.id, issues: [], analysisResult: null };
  }
  if (workspace.status === "Cancelled") {
    return { kind: "workspace_cancelled", measurementWorkspaceId: workspace.id, issues: [], analysisResult: null };
  }
  return null;
}

async function finalizeAsFailed(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    measurementBulletinImportId: string;
    engineeringProjectId: string;
    measurementWorkspaceId: string | null;
    declaredBulletinNumber: number | null;
    declaredPeriod: ParsedMeasurementBulletin["declaredPeriod"];
    structuralIssues: ReadonlyArray<MeasurementImportIssue>;
    skippedSheets: ReadonlyArray<ParsedSkippedSheet>;
  }
): Promise<ProcessMeasurementBulletinImportResult> {
  const analysisResult = buildFailedAnalysisResult(params);
  await finalizeWithResultOrThrow(supabase, {
    id: params.measurementBulletinImportId,
    companyId: params.companyId,
    status: "failed",
    analysisResult
  });

  return {
    success: true,
    outcome: {
      kind: "failed",
      measurementWorkspaceId: params.measurementWorkspaceId,
      issues: params.structuralIssues,
      analysisResult
    }
  };
}

function buildFailedAnalysisResult(params: {
  measurementBulletinImportId: string;
  engineeringProjectId: string;
  measurementWorkspaceId: string | null;
  declaredBulletinNumber: number | null;
  declaredPeriod: ParsedMeasurementBulletin["declaredPeriod"];
  structuralIssues: ReadonlyArray<MeasurementImportIssue>;
  skippedSheets: ReadonlyArray<ParsedSkippedSheet>;
}): FailedMeasurementAnalysisResult {
  return {
    schemaVersion: MEASUREMENT_ANALYSIS_RESULT_SCHEMA_VERSION,
    parserKey: MEASUREMENT_ANALYSIS_PARSER_KEY,
    generatedAt: new Date().toISOString(),
    measurementBulletinImportId: params.measurementBulletinImportId,
    engineeringProjectId: params.engineeringProjectId,
    declaredBulletinNumber: params.declaredBulletinNumber,
    declaredPeriod: params.declaredPeriod,
    structuralIssues: params.structuralIssues,
    skippedSheets: params.skippedSheets,
    status: "failed",
    measurementWorkspaceId: params.measurementWorkspaceId
  };
}

// finalizeMeasurementBulletinImportWithResult devolve null quando a
// linha não estava em 'processing' no momento da chamada -- nunca
// esperado neste fluxo (finalize sempre segue um claim bem-sucedido
// na mesma execução). Lançar, nunca informar sucesso silencioso
// (instrução explícita da revisão: "não informar sucesso").
async function finalizeWithResultOrThrow(
  supabase: SupabaseClient,
  params: { id: string; companyId: string; status: "completed" | "failed"; analysisResult: MeasurementAnalysisResult }
): Promise<void> {
  const finalized = await finalizeMeasurementBulletinImportWithResult(supabase, params);
  if (!finalized) {
    throw new Error(
      `finalizeMeasurementBulletinImportWithResult devolveu null para o import ${params.id} -- anomalia de concorrência/estado (import não estava em 'processing').`
    );
  }
}

function toMeasurementAnalysisResult(value: unknown): MeasurementAnalysisResult | null {
  return (value ?? null) as MeasurementAnalysisResult | null;
}

// TRUNC(value, 2), replicando =TRUNC(F*I,2) do BM_08 real (ver comentário
// no cálculo de totalValue). Nome deliberadamente escopado ("Dnocs",
// não algo genérico como "truncateToCents") -- não é uma política
// monetária universal do Measurement Studio, é a regra comprovada
// para ESTE template/pipeline; nunca exportada, nunca movida para
// código de domínio compartilhado. `+ 1e-9` compensa erro de
// representação binária de ponto flutuante (ex.: 3.32 * 8170.05 pode
// cair a 27124.565999999998 em vez de ...566 exato) sem arredondar
// nenhum centavo genuíno para cima -- o epsilon é muitas ordens de
// grandeza menor que 1 centavo.
function truncateDnocsLineTotalToCents(value: number): number {
  return Math.trunc(value * 100 + 1e-9) / 100;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "23505";
}

// Normalização trivial de código de catálogo (WorkPackage) -- não há
// helper existente em work-package-management.ts para reaproveitar
// (confirmado: normalizedCode é hoje sempre um parâmetro pré-computado
// pelo chamador de findOrCreateWorkPackage, nunca derivado por um
// helper de domínio). trim + uppercase + colapso de espaços, mesmo
// espírito de normalizeBulletinToken (bulletin-sheet-detector.ts),
// mas específico para código, não texto livre.
function normalizeCatalogCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, " ");
}

// Normalização trivial para comparação de descrição/unidade (R3) --
// mesma disciplina: trim + uppercase + colapso de espaços, mais
// remoção de diacríticos (texto em português). Não há heurística mais
// sofisticada nesta sprint, deliberadamente (R3: "não inventar regra
// nova sem evidência de múltiplos formatos reais").
function normalizeForComparison(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

// Correção pós-E2E: a revisão contra o BM_08 real questionou 336
// WorkPackages para 300 ManagedServiceItems (36 agregadores + 300
// folhas), supondo que só agregadores deveriam virar WorkPackage.
// Investigação confirmou que NÃO é um bug -- é o mesmo padrão já
// usado, testado e em produção pelo importador de MS Project XML do
// Project Studio (`ms-project-xml-import.ts`: "type: task.isSummary ?
// ScopeGroup : ExecutionFront", parentWorkPackageId sempre presente,
// TODA atividade -- folha ou resumo -- vira seu próprio WorkPackage,
// nunca é mesclada no pai). O consumidor que precisa só dos nós
// físicos/medíveis já sabe filtrar por type (ver
// work-package-spatial-object-adapter.ts: "Only WorkPackageType.ExecutionFront
// work packages become Spatial Objects"). Number 336=300+36 já estava
// documentado como o resultado esperado em
// EPIC_19_SPRINT_4_REPOSITORY_API_DESIGN.md antes desta sprint.
// Mantido -- agregadora vira scope_group, folha vira execution_front,
// mesma regra exata do importador de MS Project XML, agora citada
// como precedente real, não uma hipótese sem fundamento.
function resolveWorkPackageType(isAggregator: boolean): WorkPackageType {
  return isAggregator ? "scope_group" : "execution_front";
}
