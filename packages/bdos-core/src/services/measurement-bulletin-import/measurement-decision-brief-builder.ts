import type {
  DecisionBrief,
  DecisionBriefCriticalItem,
  DecisionBriefKeyDecision,
  DecisionBriefKeyMetric,
  DecisionBriefNextAction,
  DecisionBriefReadiness,
  DecisionBriefSection,
  DecisionBriefSourceReference
} from "../../decision-brief";
import { DECISION_BRIEF_SCHEMA_VERSION } from "../../decision-brief";
import type {
  MeasurementImportIssue,
  MeasurementImportIssueCode,
  ParsedMeasurementLineSourceLocation
} from "../../domain/measurement-workspace/adapters/excel-import/bulletin-import.types";
import type { MeasurementAnalysisResult } from "./measurement-bulletin-import.types";

/**
 * Epic 20 (Decision Experience), Sprint 20.1B — Measurement Decision
 * Brief Builder. Transforma deterministicamente o
 * `MeasurementAnalysisResult` (Epic 19, já persistido em
 * `measurement_bulletin_imports.analysis_result`) no contrato
 * genérico `DecisionBrief` (Epic 20, Sprint 20.1A). Função pura: não
 * recalcula o boletim, não consulta banco, não lê arquivo, não chama
 * LLM. `same input + same context = same output`.
 *
 * Ver packages/bdos-core/docs/EPIC_20_SPRINT_1_MEASUREMENT_DECISION_BRIEF_DESIGN.md
 * para o desenho aprovado. A matriz de auditoria que fundamenta cada
 * regra determinística abaixo foi apresentada e registrada na revisão
 * que precedeu esta implementação -- cada função aqui corresponde a
 * uma linha dessa matriz, nunca a uma interpretação nova.
 *
 * `confidence`: o modelo determinístico do Reliability Index ainda
 * não foi definido (nenhum peso, fórmula de agregação ou limite de
 * score foi aprovado -- inventar esses números seria Categoria C,
 * regra de negócio não existente). Este builder devolve
 * `confidence: { status: "unavailable", reason: "calculation_model_not_defined" }`
 * -- indisponível nunca significa score zero ou confiança baixa, é
 * uma afirmação diferente ("não sei calcular isso ainda"). Nenhuma UI
 * deve inferir score ou level a partir desse variant.
 */

/** Versão da regra/builder de Medições -- própria, nunca reaproveita COPILOT_RULE_BASED_MODEL (Categoria B, precedente arquitetural, não constante compartilhada). A ausência do modelo de confiabilidade fica explícita em `confidence`, não escondida nesta versão -- uma futura implementação numérica do Reliability Index tem seu próprio `modelVersion` (ver reliability-index.types.ts) e poderá exigir incremento desta constante, conforme a alteração realizada. */
export const MEASUREMENT_DECISION_BRIEF_BUILDER_VERSION = "measurement-decision-brief-v1" as const;

export interface BuildMeasurementDecisionBriefInput {
  readonly analysisResult: MeasurementAnalysisResult;
  /** measurementBulletinImportId -- o snapshot técnico de origem (DecisionBrief.metadata.sourceImportId). */
  readonly sourceImportId: string;
  /** ISO 8601, injetado pelo chamador -- este builder nunca chama new Date()/Date.now(). */
  readonly generatedAt: string;
}

export function buildMeasurementDecisionBrief(input: BuildMeasurementDecisionBriefInput): DecisionBrief {
  const { analysisResult, sourceImportId, generatedAt } = input;
  const readiness = deriveReadiness(analysisResult);
  const criticalItems = buildCriticalItems(analysisResult, sourceImportId);
  const nextActions = buildNextActions(criticalItems);

  return {
    metadata: {
      schemaVersion: DECISION_BRIEF_SCHEMA_VERSION,
      builderVersion: MEASUREMENT_DECISION_BRIEF_BUILDER_VERSION,
      sourceImportId,
      generatedAt
    },
    situation: buildSituation(analysisResult),
    executiveConclusion: buildExecutiveConclusion(analysisResult, readiness),
    keyDecisions: buildKeyDecisions(readiness, analysisResult),
    criticalItems,
    keyMetrics: buildKeyMetrics(analysisResult),
    details: buildDetails(analysisResult),
    nextActions,
    evidenceReferences: dedupeSourceReferences(criticalItems.flatMap((item) => item.evidenceReferences)),
    // Categoria C -- nenhum modelo de cálculo aprovado. Nunca um
    // score/level substituto: ver nota de topo do arquivo.
    confidence: { status: "unavailable", reason: "calculation_model_not_defined" }
  };
}

// ---------------------------------------------------------------
// Readiness -- Categoria A, 100% derivada dos caminhos reais de
// measurement-bulletin-import-service.ts (matriz de auditoria,
// linhas 1-4): "failed" só ocorre com structuralIssues vazio (falha
// técnica, download/parse) ou com >=1 issue blocking (gate A/B) --
// nunca as duas coisas fora desses casos, e blocking nunca coexiste
// com "reconciled"/"needs_review" porque os gates retornam "failed"
// antes desse branch ser alcançado.
// ---------------------------------------------------------------

export function deriveReadiness(analysisResult: MeasurementAnalysisResult): DecisionBriefReadiness {
  if (analysisResult.status === "reconciled") {
    return "ready";
  }
  if (analysisResult.status === "needs_review") {
    return "ready_with_reservations";
  }
  // status === "failed"
  const hasBlockingIssue = analysisResult.structuralIssues.some((issue) => issue.severity === "blocking");
  return hasBlockingIssue ? "not_ready" : "inconclusive";
}

// ---------------------------------------------------------------
// Situation -- Categoria A. Só fatos já presentes no resultado
// técnico (campos base, presentes nos dois ramos da união
// discriminada); nenhum contexto contratual/histórico inventado.
// ---------------------------------------------------------------

function buildSituation(analysisResult: MeasurementAnalysisResult): DecisionBriefSection {
  const bulletinLabel =
    analysisResult.declaredBulletinNumber !== null ? `Boletim ${analysisResult.declaredBulletinNumber}` : "Boletim sem número declarado no arquivo";

  const periodLabel = formatPeriod(analysisResult.declaredPeriod);

  const scopeSentence =
    analysisResult.status === "failed"
      ? "A análise não pôde ser concluída com base técnica suficiente."
      : `Análise concluída sobre ${analysisResult.lines.imported} ${analysisResult.lines.imported === 1 ? "linha medida" : "linhas medidas"}, ${analysisResult.workPackages.created + analysisResult.workPackages.matched} itens de EAP e ${analysisResult.serviceItems.created + analysisResult.serviceItems.matched} itens de serviço.`;

  const issuesSentence = buildIssuesSummarySentence(analysisResult.structuralIssues);

  return {
    title: "Situação",
    body: [`${bulletinLabel}${periodLabel}.`, scopeSentence, issuesSentence].filter((line) => line.length > 0).join(" ")
  };
}

function formatPeriod(declaredPeriod: MeasurementAnalysisResult["declaredPeriod"]): string {
  if (declaredPeriod === null || declaredPeriod.startDate === null || declaredPeriod.endDate === null) {
    return "";
  }
  return `, período ${declaredPeriod.startDate} a ${declaredPeriod.endDate}`;
}

function buildIssuesSummarySentence(structuralIssues: ReadonlyArray<MeasurementImportIssue>): string {
  const blockingCount = structuralIssues.filter((issue) => issue.severity === "blocking").length;
  const warningCount = structuralIssues.filter((issue) => issue.severity === "warning").length;

  if (blockingCount === 0 && warningCount === 0) {
    return "Nenhum impedimento ou ponto de atenção identificado.";
  }
  const parts: string[] = [];
  if (blockingCount > 0) {
    parts.push(`${blockingCount} ${blockingCount === 1 ? "impedimento bloqueante" : "impedimentos bloqueantes"}`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} ${warningCount === 1 ? "ponto de atenção" : "pontos de atenção"}`);
  }
  return `Identificado(s): ${parts.join(" e ")}.`;
}

// ---------------------------------------------------------------
// Executive conclusion -- Categoria B. Fraseia a readiness (já
// Categoria A) sem alegar aprovação/certificação -- nunca "aprovada",
// "certificada", "homologada".
// ---------------------------------------------------------------

function buildExecutiveConclusion(
  analysisResult: MeasurementAnalysisResult,
  readiness: DecisionBriefReadiness
): DecisionBrief["executiveConclusion"] {
  const blockingCount = analysisResult.structuralIssues.filter((issue) => issue.severity === "blocking").length;
  const warningCount = analysisResult.structuralIssues.filter((issue) => issue.severity === "warning").length;

  switch (readiness) {
    case "ready":
      return {
        readiness,
        headline: "Apta para seguir no fluxo de aprovação.",
        body: "A análise não identificou impedimentos nem pontos de atenção."
      };
    case "ready_with_reservations":
      return {
        readiness,
        headline: "Apta para seguir, com ressalvas.",
        body: `A análise não identificou impedimentos bloqueantes, mas há ${warningCount} ${warningCount === 1 ? "ponto de atenção" : "pontos de atenção"} a revisar antes do envio.`
      };
    case "not_ready":
      return {
        readiness,
        headline: "Não apta para seguir no estado atual.",
        body: `A análise identificou ${blockingCount} ${blockingCount === 1 ? "impedimento bloqueante" : "impedimentos bloqueantes"} que precisa(m) de correção antes de prosseguir.`
      };
    case "inconclusive":
      return {
        readiness,
        headline: "Análise inconclusiva.",
        body: "Não foi possível concluir a análise técnica com base no arquivo fornecido."
      };
  }
}

// ---------------------------------------------------------------
// Key decisions -- Categoria B. Projeção executiva direta da
// readiness -- nunca cria aggregate, nunca persiste, nunca aciona
// workflow.
// ---------------------------------------------------------------

function buildKeyDecisions(readiness: DecisionBriefReadiness, analysisResult: MeasurementAnalysisResult): ReadonlyArray<DecisionBriefKeyDecision> {
  switch (readiness) {
    case "ready":
      return [
        {
          label: "Submeter a medição ao fluxo humano de aprovação",
          recommended: true,
          rationale: "Nenhum impedimento ou ressalva material identificado."
        }
      ];
    case "ready_with_reservations":
      return [
        {
          label: "Submeter a medição ao fluxo humano de aprovação, com ressalvas documentadas",
          recommended: true,
          rationale: "Nenhum impedimento bloqueante identificado; os pontos de atenção não impedem o prosseguimento."
        },
        {
          label: "Reter até revisão completa dos pontos de atenção",
          recommended: false,
          rationale: "Alternativa disponível caso os pontos de atenção sejam considerados relevantes o suficiente para revisão prévia."
        }
      ];
    case "not_ready":
      return [
        {
          label: "Reter o avanço até correção das divergências bloqueantes",
          recommended: true,
          rationale: `${analysisResult.structuralIssues.filter((issue) => issue.severity === "blocking").length} impedimento(s) bloqueante(s) identificado(s).`
        },
        {
          label: "Prosseguir sem correção",
          recommended: false,
          rationale: "Não recomendado enquanto o(s) impedimento(s) permanecer(em) sem tratamento."
        }
      ];
    case "inconclusive":
      return [
        {
          label: "Repetir o processamento após verificar a origem do arquivo",
          recommended: true,
          rationale: "Não foi possível concluir a análise técnica com base no arquivo fornecido."
        }
      ];
  }
}

// ---------------------------------------------------------------
// Critical items -- Categoria A (severidade/mensagem, passthrough
// direto de structuralIssues) + Categoria B (título legível,
// consequências já aprovadas em EPIC_20_DECISION_EXPERIENCE_VISION.md
// §H para 4 códigos, texto neutro fornecido literalmente para os
// demais).
// ---------------------------------------------------------------

function buildCriticalItems(analysisResult: MeasurementAnalysisResult, sourceImportId: string): ReadonlyArray<DecisionBriefCriticalItem> {
  return analysisResult.structuralIssues.map((issue, index) => {
    const consequences = ISSUE_CONSEQUENCES_BY_CODE[issue.code] ?? GENERIC_ISSUE_CONSEQUENCES;
    return {
      id: `${issue.code}-${index}`,
      severity: issue.severity,
      title: ISSUE_TITLE_BY_CODE[issue.code] ?? issue.code,
      body: issue.message,
      consequenceIfAddressed: consequences.ifAddressed,
      consequenceIfIgnored: consequences.ifIgnored,
      evidenceReferences: buildSourceReferencesForIssue(issue, sourceImportId)
    };
  });
}

/** Categoria B -- rótulos legíveis para códigos já existentes, mesmo padrão de WARNING_CODE_LABELS (apps/web/components/bba-project/bba-project-insights.ts). Nenhum significado de negócio novo, só um nome melhor para um código que o Engine já decidiu. */
const ISSUE_TITLE_BY_CODE: Record<MeasurementImportIssueCode, string> = {
  unrecognized_line: "Linha não reconhecida",
  missing_work_package_code: "Código de item ausente",
  missing_service_item_code: "Código de serviço ausente",
  missing_quantity_and_value: "Quantidade e valor ausentes",
  ambiguous_period_label: "Período do boletim ambíguo",
  duplicate_service_item_in_sheet: "Item de serviço duplicado na planilha",
  official_measurement_block_not_found: "Bloco financeiro oficial não localizado",
  historical_grid_not_authoritative: "Grade histórica não é a fonte oficial",
  orphan_legacy_column_detected: "Coluna residual sem uso",
  official_period_total_mismatch: "Divergência no total oficial do período",
  service_item_description_mismatch: "Descrição do item diverge do catálogo",
  service_item_unit_mismatch: "Unidade do item diverge do catálogo",
  period_number_conflict: "Conflito de numeração de período"
};

interface IssueConsequences {
  readonly ifAddressed: string | null;
  readonly ifIgnored: string | null;
}

/** Categoria B -- já redigido e aprovado em EPIC_20_DECISION_EXPERIENCE_VISION.md §H. Não é texto novo desta Sprint, só a codificação do que já foi decidido. */
const ISSUE_CONSEQUENCES_BY_CODE: Partial<Record<MeasurementImportIssueCode, IssueConsequences>> = {
  official_period_total_mismatch: {
    ifAddressed: "Corrigir a divergência antes do envio garante que o valor certificado bate com o que a fiscalização vai recalcular.",
    ifIgnored: "O boletim pode ser questionado e retido até nova análise."
  },
  service_item_unit_mismatch: {
    ifAddressed: "Validar a unidade evita que um item seja pago com preço unitário incompatível.",
    ifIgnored: "O item pode ser pago errado, a favor ou contra a empresa, sem que ninguém tenha percebido."
  },
  historical_grid_not_authoritative: {
    ifAddressed: "Nenhuma ação obrigatória -- a fonte oficial já prevaleceu no cálculo.",
    ifIgnored: "Nenhum risco financeiro, mas a grade histórica da planilha continuará divergente para quem a consultar manualmente depois."
  },
  duplicate_service_item_in_sheet: {
    ifAddressed: "Corrigir a duplicidade na origem evita ambiguidade em medições futuras do mesmo item.",
    ifIgnored: "O item pode ser medido duas vezes por engano em um boletim futuro, se a duplicidade não for percebida."
  }
};

/** Categoria B -- texto neutro fornecido literalmente na revisão de arquitetura que precedeu esta implementação; nunca alega penalidade contratual, multa, fraude, glosa obrigatória ou inadimplemento sem que o Engine já tenha classificado isso. */
const GENERIC_ISSUE_CONSEQUENCES: IssueConsequences = {
  ifAddressed: "A análise poderá prosseguir sem esta inconsistência.",
  ifIgnored: "A inconsistência permanecerá sem resolução no fluxo de revisão."
};

// ---------------------------------------------------------------
// Key metrics -- Categoria A. Só valores/contagens já calculados
// pelo Engine -- nenhuma fórmula nova, nenhum percentual de
// confiabilidade calculado aqui (isso é o Reliability Index,
// deliberadamente fora de escopo). Ausência nunca vira zero: para
// status "failed", os campos financeiros/contagem simplesmente não
// existem no tipo (união discriminada) -- esta função nem tenta
// acessá-los nesse ramo.
// ---------------------------------------------------------------

function buildKeyMetrics(analysisResult: MeasurementAnalysisResult): ReadonlyArray<DecisionBriefKeyMetric> {
  const blockingCount = analysisResult.structuralIssues.filter((issue) => issue.severity === "blocking").length;
  const warningCount = analysisResult.structuralIssues.filter((issue) => issue.severity === "warning").length;

  const base: DecisionBriefKeyMetric[] = [
    { label: "Impedimentos bloqueantes", value: String(blockingCount) },
    { label: "Pontos de atenção", value: String(warningCount) }
  ];

  if (analysisResult.status === "failed") {
    return base;
  }

  return [
    ...base,
    { label: "Valor oficial do período", value: formatCurrencyBRL(analysisResult.officialPeriodTotal) },
    { label: "Valor recalculado", value: formatCurrencyBRL(analysisResult.recalculatedTotal) },
    { label: "Diferença", value: formatCurrencyBRL(analysisResult.totalDifference) },
    { label: "Linhas medidas", value: String(analysisResult.lines.imported) },
    { label: "Itens de EAP", value: String(analysisResult.workPackages.created + analysisResult.workPackages.matched) },
    { label: "Itens de serviço", value: String(analysisResult.serviceItems.created + analysisResult.serviceItems.matched) }
  ];
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ---------------------------------------------------------------
// Details -- Categoria A/B. Organiza fatos já conhecidos para
// drill-down; nunca duplica analysis_result inteiro.
// ---------------------------------------------------------------

function buildDetails(analysisResult: MeasurementAnalysisResult): DecisionBriefSection {
  const skippedSheetsCount = analysisResult.skippedSheets.length;
  const skippedSheetsSentence =
    skippedSheetsCount > 0
      ? `${skippedSheetsCount} ${skippedSheetsCount === 1 ? "aba do arquivo foi" : "abas do arquivo foram"} desconsiderada(s) na extração (memória de cálculo, resumo ou layout não suportado).`
      : "Nenhuma aba foi desconsiderada na extração.";

  if (analysisResult.status === "failed") {
    return { title: "Detalhamento", body: skippedSheetsSentence };
  }

  return {
    title: "Detalhamento",
    body: [
      `${analysisResult.lines.imported} linha(s) nova(s) importada(s), ${analysisResult.lines.alreadyPresent} já presente(s) sem alteração, ${analysisResult.lines.updated} atualizada(s).`,
      `${analysisResult.workPackages.created} item(ns) de EAP criado(s) e ${analysisResult.workPackages.matched} já existente(s); ${analysisResult.serviceItems.created} item(ns) de serviço criado(s) e ${analysisResult.serviceItems.matched} já existente(s).`,
      skippedSheetsSentence
    ].join(" ")
  };
}

// ---------------------------------------------------------------
// Next actions -- Categoria B. 1:1 com criticalItems, fraseado como
// ação -- nunca cria Decision/Recommendation/ActionPlan/Action/
// ExecutionWorkflow/ExecutionTask, nunca carrega id de nenhum desses
// aggregates.
// ---------------------------------------------------------------

function buildNextActions(criticalItems: ReadonlyArray<DecisionBriefCriticalItem>): ReadonlyArray<DecisionBriefNextAction> {
  return criticalItems.map((item) => ({
    title: `Revisar: ${item.title.toLowerCase()}`,
    rationale: item.body,
    evidenceReferences: item.evidenceReferences
  }));
}

// ---------------------------------------------------------------
// Evidence references -- Categoria A. Só spreadsheet_cell, só
// campos realmente persistidos (sourceLocation.sheetName/rowNumber/
// physicalColumn/financialColumn). Nunca fabrica coluna ausente;
// emite uma referência por coluna real presente (nunca descarta uma
// das duas quando ambas existem).
// ---------------------------------------------------------------

function buildSourceReferencesForIssue(issue: MeasurementImportIssue, sourceImportId: string): ReadonlyArray<DecisionBriefSourceReference> {
  if (issue.sourceLocation === undefined) {
    return [];
  }
  return buildSourceReferencesForLocation(issue.sourceLocation, sourceImportId);
}

function buildSourceReferencesForLocation(
  sourceLocation: ParsedMeasurementLineSourceLocation,
  sourceImportId: string
): ReadonlyArray<DecisionBriefSourceReference> {
  const columns = Array.from(new Set([sourceLocation.physicalColumn, sourceLocation.financialColumn].filter((column): column is string => column !== undefined)));

  if (columns.length === 0) {
    return [
      {
        sourceType: "spreadsheet_cell",
        sourceId: sourceImportId,
        locator: { sheetName: sourceLocation.sheetName, row: sourceLocation.rowNumber }
      }
    ];
  }

  return columns.map((column) => ({
    sourceType: "spreadsheet_cell",
    sourceId: sourceImportId,
    locator: { sheetName: sourceLocation.sheetName, row: sourceLocation.rowNumber, column }
  }));
}

function dedupeSourceReferences(references: ReadonlyArray<DecisionBriefSourceReference>): ReadonlyArray<DecisionBriefSourceReference> {
  const seen = new Set<string>();
  const result: DecisionBriefSourceReference[] = [];
  for (const reference of references) {
    const key = `${reference.sourceId}|${reference.locator.sheetName}|${reference.locator.row}|${reference.locator.column ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(reference);
    }
  }
  return result;
}
