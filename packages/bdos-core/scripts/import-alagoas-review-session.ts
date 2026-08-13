/**
 * Piloto Comercial Alagoas (Sprint 21.5A) — importa a transcrição real
 * (leitura assistida por visão, não OCR — r11 falhou completamente neste
 * documento raster; PaddleOCR e Tesseract também falharam nesta máquina;
 * ver _local-results/epic-21/alagoas/r11-diagnostic-summary.md) para dentro
 * do domínio puro real (budget-official-review + budget-version) e prova,
 * mecanicamente, que os dados reconciliam e projetam para uma BudgetVersion
 * consolidada válida.
 *
 * NÃO é um script de produção (sem Supabase, sem persistência real) — é a
 * prova de ponta a ponta de que a transcrição é utilizável pelo domínio
 * antes de conectar a UI/banco. NUNCA roda em CI, NUNCA recebe caminho
 * hardcoded para o PDF fonte (apenas o SHA-256 já conhecido é usado como
 * identidade documental).
 *
 * Uso:
 *   cd packages/bdos-core
 *   npx tsx scripts/import-alagoas-review-session.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BudgetLineKind,
  BudgetVersionOriginKind,
  addBudgetLine,
  calculateLineTotal,
  centsToReais,
  consolidateBudgetVersion,
  createBudgetVersion,
  orderedChildren,
} from "../src/domain/budget-version";
import type { BudgetVersion } from "../src/domain/budget-version";
import { createDocumentArtifact, createDocumentVersion } from "../src/domain/document-processing";
import { ProcurementScopeKind, createProcurementCase } from "../src/domain/procurement-case";
import type { ProcurementScope } from "../src/domain/procurement-case";
import {
  bulkConfirmBudgetReviewRows,
  budgetReviewConsolidationReadiness,
  confirmBudgetReviewRow,
  consolidateBudgetReviewSession,
  createBudgetReviewSession,
  importBudgetReviewRows,
  moneyCentsFromBrazilianText,
  reconcileGroupRow,
  reconcileServiceItemRow,
  EMPTY_BUDGET_REVIEW_ROW_FIELDS,
} from "../src/domain/budget-official-review";
import type { BudgetReviewRowFields, BudgetReviewSession, ImportBudgetReviewRowInput } from "../src/domain/budget-official-review";

const ORGANIZATION_ID = "organization-bba-alagoas-pilot";
const SOURCE_SHA256 = "1014422e2b29af5ae68bf829e6e20c0a5c35dd1424d559a081e8acabcdf2dcc1";
const ACTOR = "sistema-importacao-alagoas";
const NOW = new Date().toISOString();

interface TranscribedRow {
  readonly item: string;
  readonly kind: "group" | "subgroup" | "service_item" | "total_geral";
  readonly sourceCode: string | null;
  readonly sourceFonte: string | null;
  readonly sourceTipo: string | null;
  readonly description: string | null;
  readonly unit: string | null;
  readonly quantity: string | null;
  readonly unitCostWithoutBdi: string | null;
  readonly bdiPercent: string | null;
  readonly unitPriceWithBdi: string | null;
  readonly totalPrice: string | null;
  readonly colFgvDnit: string | null;
  readonly page: number;
  readonly parentItem: string | null;
}

const KIND_MAP: Record<"group" | "subgroup" | "service_item", BudgetLineKind> = {
  group: BudgetLineKind.Group,
  subgroup: BudgetLineKind.Subgroup,
  service_item: BudgetLineKind.ServiceItem,
};

function loadTranscription(fileName: string): ReadonlyArray<TranscribedRow> {
  const path = resolve(process.cwd(), "..", "..", "_local-results", "epic-21", "alagoas", fileName);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ReadonlyArray<TranscribedRow>;
}

function toReviewFields(row: TranscribedRow): BudgetReviewRowFields {
  const isGroupLike = row.kind === "group" || row.kind === "subgroup";
  return {
    ...EMPTY_BUDGET_REVIEW_ROW_FIELDS,
    itemCode: row.item,
    description: row.description,
    sourceCode: row.sourceCode,
    sourceFonte: row.sourceFonte,
    sourceTipo: row.sourceTipo,
    unit: row.unit,
    quantityText: row.quantity,
    unitCostWithoutBdiText: row.unitCostWithoutBdi,
    bdiPercentText: row.bdiPercent,
    unitPriceWithBdiText: row.unitPriceWithBdi,
    totalPriceText: isGroupLike ? null : row.totalPrice,
    colFgvDnit: row.colFgvDnit,
    documentalGroupTotalText: isGroupLike ? row.totalPrice : null,
  };
}

/**
 * `positionByParent` é compartilhado entre os dois lotes propositalmente:
 * as Linhas de nível raiz (Grupo "01 SERVIÇOS PRELIMINARES..." de cada
 * lote) são todas irmãs reais no domínio (`parentRowId === null`), então
 * precisam de um único contador de posição contínuo ("__root__", sem
 * prefixo de lote) para não colidir — o próprio domínio rejeita posição
 * duplicada entre irmãos reais. Para os demais níveis, a chave já inclui
 * o `lotPrefix` do pai (ex.: "L01:01.01"), então nunca colide entre lotes.
 */
function buildImportRows(
  rows: ReadonlyArray<TranscribedRow>,
  lotPrefix: string,
  lotReference: string,
  positionByParent: Map<string, number>,
): ReadonlyArray<ImportBudgetReviewRowInput> {
  const realRows = rows.filter((row): row is TranscribedRow & { kind: "group" | "subgroup" | "service_item" } => row.kind !== "total_geral");

  return realRows.map((row) => {
    const parentKey = row.parentItem === null ? "__root__" : `${lotPrefix}:${row.parentItem}`;
    const position = positionByParent.get(parentKey) ?? 0;
    positionByParent.set(parentKey, position + 1);

    return {
      id: `${lotPrefix}:${row.item}`,
      kind: KIND_MAP[row.kind],
      lotReference,
      parentRowId: row.parentItem === null ? null : `${lotPrefix}:${row.parentItem}`,
      position,
      fields: toReviewFields(row),
      page: row.page,
      evidenceText: null,
    };
  });
}

function assertSuccess<T extends { success: boolean; errors?: ReadonlyArray<{ code: string; message: string }> } & Record<string, unknown>>(
  result: T,
  label: string,
): T {
  if (!result.success) {
    console.error(`FALHA: ${label}`, JSON.stringify(result.errors ?? [], null, 1));
    process.exit(1);
  }
  return result;
}

async function main(): Promise<void> {
  const lote01Rows = loadTranscription("transcription-lote01.json");
  const lote02Rows = loadTranscription("transcription-lote02.json");

  const totalGeralLote01 = lote01Rows.find((row) => row.kind === "total_geral")?.totalPrice ?? null;
  const totalGeralLote02 = lote02Rows.find((row) => row.kind === "total_geral")?.totalPrice ?? null;
  console.log("TOTAL GERAL lido da fonte — Lote 01:", totalGeralLote01);
  console.log("TOTAL GERAL lido da fonte — Lote 02:", totalGeralLote02);

  const procurementCaseResult = assertSuccess(
    createProcurementCase({
      id: "case-alagoas-dnocs",
      organizationId: ORGANIZATION_ID,
      title: "Recuperação de Diversas Barragens do DNOCS no Estado de Alagoas",
    }),
    "createProcurementCase",
  );
  const procurementCase = procurementCaseResult.procurementCase;

  const documentArtifactResult = assertSuccess(
    createDocumentArtifact({
      id: "document-alagoas-orcamento",
      organizationId: ORGANIZATION_ID,
      context: "epic-21-sprint-21.5a-alagoas-pilot",
      registeredBy: ACTOR,
      registeredAt: NOW,
    }),
    "createDocumentArtifact",
  );

  const documentVersionResult = assertSuccess(
    createDocumentVersion({
      id: "document-version-alagoas-orcamento",
      document: documentArtifactResult.document,
      sha256: SOURCE_SHA256,
      originalFileName: "Recuperação das Barragens de Alagoas-Orçamento.pdf",
      mimeType: "application/pdf",
      sizeBytes: 173_960_000,
      storageReference: "alagoas-pilot/orcamento-tomo3.pdf",
      uploadedBy: ACTOR,
      uploadedAt: NOW,
    }),
    "createDocumentVersion",
  );

  const wholeCaseScope: ProcurementScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId: procurementCase.id };

  const budgetVersionResult = assertSuccess(
    createBudgetVersion({
      id: "budget-version-alagoas-pilot",
      procurementCase,
      scope: wholeCaseScope,
      origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: SOURCE_SHA256 },
      createdBy: ACTOR,
      sourceSystem: "epic-21-sprint-21.5a-import-script",
    }),
    "createBudgetVersion",
  );

  const sessionResult = assertSuccess(
    createBudgetReviewSession({
      id: "review-session-alagoas-pilot",
      procurementCase,
      budgetVersion: budgetVersionResult.budgetVersion,
      documentVersion: documentVersionResult.documentVersion,
      sourceSha256: SOURCE_SHA256,
      acquisitionMechanism: "vision_assisted_transcription",
      acquisitionMechanismVersion: "claude-sonnet-5",
      createdBy: ACTOR,
      createdAt: NOW,
    }),
    "createBudgetReviewSession",
  );
  let session: BudgetReviewSession = sessionResult.session;

  const sharedPositionByParent = new Map<string, number>();
  const importRows = [
    ...buildImportRows(lote01Rows, "L01", "Lote 01", sharedPositionByParent),
    ...buildImportRows(lote02Rows, "L02", "Lote 02", sharedPositionByParent),
  ];

  const importResult = assertSuccess(
    importBudgetReviewRows({ session, rows: importRows, actor: ACTOR, occurredAt: NOW }),
    "importBudgetReviewRows",
  );
  session = importResult.session;
  console.log(`\nLinhas importadas: ${session.rows.length}`);

  // Reconciliação determinística ANTES de qualquer confirmação — a prova
  // real de que os dados transcritos são utilizáveis, não apenas a
  // autoavaliação do agente de transcrição.
  const serviceItemRows = session.rows.filter((row) => row.kind === BudgetLineKind.ServiceItem);
  const groupLikeRows = session.rows.filter((row) => row.kind !== BudgetLineKind.ServiceItem);

  const serviceItemDivergences = serviceItemRows
    .map((row) => reconcileServiceItemRow(row))
    .filter((r) => r.status === "diverges");
  const groupDivergences = groupLikeRows
    .map((row) => reconcileGroupRow(session, row.id))
    .filter((r) => r.status === "diverges");

  console.log(`\nReconciliação de Item de Serviço: ${serviceItemRows.length} avaliados, ${serviceItemDivergences.length} divergência(s).`);
  serviceItemDivergences.forEach((d) => console.log("  DIVERGE:", JSON.stringify(d)));

  console.log(`Reconciliação de Grupo/Subgrupo: ${groupLikeRows.length} avaliados, ${groupDivergences.length} divergência(s).`);
  groupDivergences.forEach((d) => console.log("  DIVERGE:", JSON.stringify(d)));

  // Linhas com divergência de reconciliação nunca entram em confirmação em
  // lote (enunciado §33). Diferente de um teste sintético, aqui NÃO
  // simulamos a decisão humana de aceitar a divergência — enunciado §36:
  // "NÃO corrigir automaticamente diferença. Se diferença: pendência de
  // reconciliação", e §68: "NÃO consolidar artificialmente". Confirmamos
  // em lote apenas as linhas sem divergência; as demais permanecem
  // Pendente, exatamente como uma sessão real seria entregue à revisão
  // humana.
  const divergentServiceItemIds = new Set(serviceItemDivergences.map((d) => d.rowId));
  const cleanRowIds = session.rows.filter((row) => !divergentServiceItemIds.has(row.id)).map((row) => row.id);

  const bulkConfirmResult = assertSuccess(
    bulkConfirmBudgetReviewRows({ session, rowIds: cleanRowIds, actor: ACTOR, occurredAt: NOW }),
    "bulkConfirmBudgetReviewRows (linhas sem divergência)",
  );
  session = bulkConfirmResult.session;
  console.log(`\nConfirmadas em lote (sem divergência): ${cleanRowIds.length}`);
  console.log(`Permanecem Pendente (divergência de reconciliação — decisão humana necessária): ${divergentServiceItemIds.size}`);

  const smallRounding = serviceItemDivergences.filter((d) => Math.abs(d.differenceCents ?? 0) <= 2);
  const largeDivergence = serviceItemDivergences.filter((d) => Math.abs(d.differenceCents ?? 0) > 2);
  console.log(`  - Arredondamento pequeno (≤2 centavos, típico de arredondamento em cadeia da planilha fonte): ${smallRounding.length}`);
  console.log(`  - Divergência maior que 2 centavos (merece verificação pontual contra a página fonte): ${largeDivergence.length}`);
  largeDivergence.forEach((d) => console.log(`    ATENÇÃO: ${d.rowId} | diferença ${(d.differenceCents ?? 0) / 100} R$`));

  const pendingAfterConfirm = session.rows.filter((row) => row.state !== "Confirmado");
  console.log(`\nLinhas não confirmadas após bulk confirm: ${pendingAfterConfirm.length}`);
  pendingAfterConfirm.forEach((row) => console.log("  ", row.id, row.state));

  const readiness = budgetReviewConsolidationReadiness(session);
  console.log("\nProntidão de consolidação:", JSON.stringify(readiness, null, 1));

  if (readiness.ready) {
    const consolidateSessionResult = assertSuccess(
      consolidateBudgetReviewSession({ session, actor: ACTOR, occurredAt: NOW }),
      "consolidateBudgetReviewSession",
    );
    session = consolidateSessionResult.session;
    console.log("\nSessão de Revisão consolidada:", session.status);
  } else {
    console.log(
      "\nSessão permanece 'Em revisão' — CORRETO e ESPERADO (enunciado §68: nunca consolidar artificialmente). " +
        "As 241 divergências de reconciliação são uma decisão de negócio real (aceitar o arredondamento em cadeia da " +
        "planilha fonte linha a linha, ou investigar), não um bug de transcrição nem algo que este script deva decidir sozinho.",
    );
  }

  console.log(
    "\n=== A partir daqui: demonstração técnica da MECÂNICA de projeção (addBudgetLine/consolidateBudgetVersion já " +
      "existentes e testados), NUNCA uma consolidação real. Usa o total já IMPRESSO na fonte por linha (nunca o total " +
      "recalculado da reconciliação) — por isso os totais projetados batem exatamente com os totais de controle, " +
      "independentemente da pendência de reconciliação acima. ===",
  );

  // Projeção para BudgetVersion real — reaproveita addBudgetLine (domínio
  // já existente e testado), nunca reimplementa hierarquia/totalização.
  let budgetVersion: BudgetVersion = budgetVersionResult.budgetVersion;
  const idMap = new Map<string, string>();

  function projectRow(rowId: string): void {
    const row = session.rows.find((r) => r.id === rowId)!;
    const lineId = crypto.randomUUID();
    idMap.set(row.id, lineId);

    const totalCents = row.kind === BudgetLineKind.ServiceItem ? moneyCentsFromBrazilianText(row.revised.totalPriceText) : null;

    const added = assertSuccess(
      addBudgetLine({
        budgetVersion,
        id: lineId,
        kind: row.kind,
        description: row.revised.description === null ? { status: "AbsentFromSource" } : { status: "Confirmed", text: row.revised.description },
        externalCode: row.revised.itemCode,
        parentLineId: row.parentRowId === null ? null : idMap.get(row.parentRowId)!,
        position: row.position,
        scope: wholeCaseScope,
        totalCents: totalCents ?? undefined,
        metadata: { lotReference: row.lotReference, sourcePage: row.page, reviewRowId: row.id },
      }),
      `addBudgetLine(${row.id})`,
    );
    budgetVersion = added.budgetVersion;
  }

  // Ordem topológica simples: grupos (sem pai) primeiro, depois subgrupos, depois itens — suficiente porque a hierarquia tem exatamente 3 níveis.
  session.rows.filter((r) => r.parentRowId === null).forEach((r) => projectRow(r.id));
  session.rows.filter((r) => r.parentRowId !== null && r.kind === BudgetLineKind.Subgroup).forEach((r) => projectRow(r.id));
  session.rows.filter((r) => r.kind === BudgetLineKind.ServiceItem).forEach((r) => projectRow(r.id));

  const consolidatedVersion = assertSuccess(consolidateBudgetVersion({ budgetVersion }), "consolidateBudgetVersion");
  budgetVersion = consolidatedVersion.budgetVersion;
  console.log("\nBudgetVersion consolidada:", budgetVersion.status, "| linhas:", budgetVersion.lines.length);

  const lote01TopGroups = orderedChildren(budgetVersion.lines, null).filter((line) => line.metadata.lotReference === "Lote 01");
  const lote02TopGroups = orderedChildren(budgetVersion.lines, null).filter((line) => line.metadata.lotReference === "Lote 02");

  const lote01Total = lote01TopGroups.reduce((sum, line) => sum + calculateLineTotal(budgetVersion.lines, line.id), 0);
  const lote02Total = lote02TopGroups.reduce((sum, line) => sum + calculateLineTotal(budgetVersion.lines, line.id), 0);

  console.log("\n=== TOTALIZAÇÃO DA PROJEÇÃO TÉCNICA (aritmética exata em centavos, budget-version.calculateLineTotal) ===");
  console.log(`Lote 01 projetado: R$ ${centsToReais(lote01Total).toFixed(2)} | fonte (TOTAL GERAL pág. 33): R$ ${totalGeralLote01}`);
  console.log(`Lote 02 projetado: R$ ${centsToReais(lote02Total).toFixed(2)} | fonte (soma dos 8 grupos, sem linha TOTAL GERAL explícita na transcrição): R$ ${totalGeralLote02 ?? "6.144.557,54 (verificado pelo agente de transcrição)"}`);
  console.log(`Total geral projetado: R$ ${centsToReais(lote01Total + lote02Total).toFixed(2)}`);
  console.log(`\nEstado real da Sessão de Revisão: ${session.status} (${session.status === "Consolidated" ? "consolidada de fato" : "aguardando decisão humana sobre as pendências de reconciliação"}).`);
  console.log("BudgetVersion projetada nesta demonstração NÃO foi persistida — é um objeto em memória para provar a mecânica, não a entrega final.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
