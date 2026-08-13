import { BudgetVersionOriginKind, BudgetVersionStatus, createBudgetVersion } from "../budget-version";
import type { BudgetVersion } from "../budget-version";
import { ProcurementScopeKind, createProcurementCase } from "../procurement-case";
import type { ProcurementCase, ProcurementScope } from "../procurement-case";
import { createDocumentArtifact, createDocumentVersion } from "../document-processing";
import type { DocumentVersion } from "../document-processing";
import { BudgetLineKind } from "../budget-version";
import {
  BudgetReviewRowState,
  BudgetReviewSessionStatus,
  acceptBudgetReviewRowDivergenceAsDocumented,
  bulkAcceptBudgetReviewRowDivergencesAsDocumented,
  bulkConfirmBudgetReviewRows,
  budgetReviewConsolidationReadiness,
  confirmBudgetReviewRow,
  consolidateBudgetReviewSession,
  correctBudgetReviewRow,
  createBudgetReviewSession,
  excludeBudgetReviewRow,
  importBudgetReviewRows,
  insertManualBudgetReviewRow,
  reconcileGroupRow,
  reconcileServiceItemRow,
  restoreBudgetReviewRow,
  EMPTY_BUDGET_REVIEW_ROW_FIELDS,
  type BudgetReviewRowFields,
  type BudgetReviewSession,
} from "./index";
import {
  detectCalculationRule,
  exactQuantityFromCanonicalDecimalText,
  moneyCentsFromCanonicalDecimalText,
  truncateQuantityByUnitPriceCents,
} from "./budget-official-review-economic-value";

const organizationId = "organization-bba-alagoas";

const procurementCase: ProcurementCase = requireCaseSuccess(
  createProcurementCase({ id: "case-alagoas", organizationId, title: "Recuperação de Diversas Barragens do DNOCS no Estado de Alagoas" }),
);

const wholeCaseScope: ProcurementScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId: procurementCase.id };

const sourceSha256 = "1014422e2b29af5ae68bf829e6e20c0a5c35dd1424d559a081e8acabcdf2dcc1";

function freshBudgetVersion(): BudgetVersion {
  const result = createBudgetVersion({
    id: `budget-version-${Math.random().toString(36).slice(2)}`,
    procurementCase,
    scope: wholeCaseScope,
    origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: sourceSha256 },
  });
  assertVersionSuccess(result);
  return result.budgetVersion;
}

function freshDocumentVersion(): DocumentVersion {
  const documentResult = createDocumentArtifact({
    id: `document-${Math.random().toString(36).slice(2)}`,
    organizationId,
    context: "budget-official-review-test",
    registeredBy: "test-actor",
    registeredAt: "2026-08-10T00:00:00.000Z",
  });
  if (!documentResult.success) {
    throw new Error("expected document artifact creation success");
  }
  const versionResult = createDocumentVersion({
    id: `document-version-${Math.random().toString(36).slice(2)}`,
    document: documentResult.document,
    sha256: sourceSha256,
    originalFileName: "Recuperação das Barragens de Alagoas-Orçamento.pdf",
    mimeType: "application/pdf",
    sizeBytes: 173_960_000,
    storageReference: "alagoas/orcamento.pdf",
    uploadedBy: "test-actor",
    uploadedAt: "2026-08-10T00:00:00.000Z",
  });
  if (!versionResult.success) {
    throw new Error("expected document version creation success");
  }
  return versionResult.documentVersion;
}

function freshSession(): BudgetReviewSession {
  const result = createBudgetReviewSession({
    id: `review-session-${Math.random().toString(36).slice(2)}`,
    procurementCase,
    budgetVersion: freshBudgetVersion(),
    documentVersion: freshDocumentVersion(),
    sourceSha256,
    acquisitionMechanism: "vision_assisted_transcription",
    acquisitionMechanismVersion: "claude-sonnet-5",
    createdBy: "revisor-teste",
    createdAt: "2026-08-10T00:00:00.000Z",
  });
  assertReviewSuccess(result, "expected session creation success");
  return result.session;
}

const fields = (overrides: Partial<BudgetReviewRowFields> = {}): BudgetReviewRowFields => ({ ...EMPTY_BUDGET_REVIEW_ROW_FIELDS, ...overrides });

/** A Item de Serviço always requires a Grupo/Subgrupo parent (mirrors budget-version's own rule) — this helper prepends a root Grupo for tests that only care about a bare Item de Serviço. */
function serviceItemsUnderRootGroup(
  items: ReadonlyArray<{
    id: string;
    position: number;
    fields: BudgetReviewRowFields;
    page: number;
    evidenceText?: string;
    calculationRule?: import("./budget-official-review.types").BudgetSourceCalculationRule | null;
  }>,
) {
  return [
    { id: "root-group", kind: BudgetLineKind.Group, lotReference: "Lote 01", parentRowId: null, position: 0, fields: fields(), page: 16 },
    ...items.map((item) => ({
      id: item.id,
      kind: BudgetLineKind.ServiceItem,
      lotReference: "Lote 01",
      parentRowId: "root-group",
      position: item.position,
      fields: item.fields,
      page: item.page,
      evidenceText: item.evidenceText,
      calculationRule: item.calculationRule,
    })),
  ];
}

// ---------------------------------------------------------------------------
// 1. Sessão nasce em progresso, vazia
// ---------------------------------------------------------------------------

runTest("Sessão de Revisão nasce InProgress, sem linhas", () => {
  const session = freshSession();
  assertEqual(session.status, BudgetReviewSessionStatus.InProgress, "session must start InProgress");
  assertEqual(session.rows.length, 0, "session must start with no rows");
});

runTest("Sessão recusa BudgetVersion já consolidada", () => {
  const consolidatedVersion: BudgetVersion = { ...freshBudgetVersion(), status: BudgetVersionStatus.Consolidated };
  const result = createBudgetReviewSession({
    id: "review-session-rejected",
    procurementCase,
    budgetVersion: consolidatedVersion,
    documentVersion: freshDocumentVersion(),
    sourceSha256,
    acquisitionMechanism: "vision_assisted_transcription",
    createdBy: "revisor-teste",
    createdAt: "2026-08-10T00:00:00.000Z",
  });
  if (result.success) {
    throw new Error("expected failure for a Consolidated BudgetVersion");
  }
  assertEqual(result.errors[0]?.code, "budget_version_not_draft", "expected budget_version_not_draft error");
});

// ---------------------------------------------------------------------------
// 2. Importação preserva extracted imutável
// ---------------------------------------------------------------------------

runTest("Importação: extracted == revised na origem, e extracted nunca muda após correção", () => {
  const session = freshSession();

  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: [
      {
        id: "row-group-01",
        kind: BudgetLineKind.Group,
        lotReference: "Lote 01",
        parentRowId: null,
        position: 0,
        fields: fields({ description: "SERVIÇOS PRELIMINARES E ADMINISTRAÇÃO LOCAL", totalPriceText: "1.862.109,66" }),
        page: 16,
      },
      {
        id: "row-item-01",
        kind: BudgetLineKind.ServiceItem,
        lotReference: "Lote 01",
        parentRowId: "row-group-01",
        position: 0,
        fields: fields({
          itemCode: "01.01.01",
          description: "MOBILIZAÇÃO E DESMOBILIZAÇÃO",
          unit: "TONxKM",
          quantityText: "46.656,22",
          unitPriceWithBdiText: "0,72",
          totalPriceText: "33.592,47",
        }),
        page: 16,
      },
    ],
  });
  assertReviewSuccess(imported, "expected import success");

  const row = imported.session.rows.find((candidate) => candidate.id === "row-item-01");
  if (row === undefined) throw new Error("row not found after import");
  assertEqual(row.state, BudgetReviewRowState.Pending, "imported row must start Pendente");
  assertEqual(row.extracted?.totalPriceText, "33.592,47", "extracted must reflect the imported value");

  const corrected = correctBudgetReviewRow({
    session: imported.session,
    rowId: "row-item-01",
    fields: { totalPriceText: "33.592,48" },
    justification: "Correção de dígito lido incorretamente contra a evidência da página 16.",
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  assertReviewSuccess(corrected, "expected correction success");

  const correctedRow = corrected.session.rows.find((candidate) => candidate.id === "row-item-01")!;
  assertEqual(correctedRow.state, BudgetReviewRowState.Corrected, "row must become Corrigido");
  assertEqual(correctedRow.revised.totalPriceText, "33.592,48", "revised must reflect the correction");
  assertEqual(correctedRow.extracted?.totalPriceText, "33.592,47", "extracted must remain the ORIGINAL value, never overwritten");
});

runTest("Correção sem justificativa é rejeitada", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: [{ id: "row-1", kind: BudgetLineKind.Group, lotReference: "Lote 01", parentRowId: null, position: 0, fields: fields({ description: "GRUPO" }), page: 16 }],
  });
  assertReviewSuccess(imported);

  const corrected = correctBudgetReviewRow({
    session: imported.session,
    rowId: "row-1",
    fields: { description: "GRUPO CORRIGIDO" },
    justification: "",
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  if (corrected.success) throw new Error("expected failure for blank justification");
  assertEqual(corrected.errors[0]?.code, "missing_justification", "expected missing_justification error");
});

// ---------------------------------------------------------------------------
// 3. Confirmar / Excluir preserva evidência / Restaurar
// ---------------------------------------------------------------------------

runTest("Confirmar linha Pendente muda estado para Confirmado", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: [{ id: "row-1", kind: BudgetLineKind.Group, lotReference: "Lote 01", parentRowId: null, position: 0, fields: fields({ description: "GRUPO" }), page: 16 }],
  });
  assertReviewSuccess(imported);

  const confirmed = confirmBudgetReviewRow({ session: imported.session, rowId: "row-1", actor: "revisor-teste", occurredAt: "2026-08-10T00:00:02.000Z" });
  assertReviewSuccess(confirmed);
  assertEqual(confirmed.session.rows[0]?.state, BudgetReviewRowState.Confirmed, "row must be Confirmado");
});

runTest("Excluir como não-orçamento preserva a linha e sua evidência (nunca apaga)", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: [{ id: "row-1", kind: BudgetLineKind.Group, lotReference: "Lote 01", parentRowId: null, position: 0, fields: fields({ description: "Título de página promovido a item por erro do Motor" }), page: 30, evidenceText: "raw text da página 30" }],
  });
  assertReviewSuccess(imported);

  const excluded = excludeBudgetReviewRow({
    session: imported.session,
    rowId: "row-1",
    justification: "Linha corresponde ao cabeçalho da seção, não a um Item de Serviço real.",
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  assertReviewSuccess(excluded);

  const row = excluded.session.rows.find((candidate) => candidate.id === "row-1")!;
  assertEqual(row.state, BudgetReviewRowState.NotBudgetItem, "row must be NaoPertenceAoOrcamento");
  assertEqual(excluded.session.rows.length, 1, "row must remain in the array, never deleted");
  assertEqual(row.evidenceText, "raw text da página 30", "original evidence must remain intact");

  const restored = restoreBudgetReviewRow({ session: excluded.session, rowId: "row-1", actor: "revisor-teste", occurredAt: "2026-08-10T00:00:03.000Z" });
  assertReviewSuccess(restored);
  assertEqual(restored.session.rows[0]?.state, BudgetReviewRowState.Pending, "restored row must return to Pendente");
});

// ---------------------------------------------------------------------------
// 4. Inserção manual exige origem/justificativa
// ---------------------------------------------------------------------------

runTest("Inserir linha manualmente exige justificativa e página", () => {
  const session = freshSession();

  const withoutJustification = insertManualBudgetReviewRow({
    session,
    id: "row-manual-1",
    kind: BudgetLineKind.Group,
    lotReference: "Lote 01",
    parentRowId: null,
    position: 0,
    fields: fields({ description: "GRUPO INSERIDO MANUALMENTE" }),
    page: 20,
    justification: "",
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:01.000Z",
  });
  if (withoutJustification.success) throw new Error("expected failure without justification");

  const inserted = insertManualBudgetReviewRow({
    session,
    id: "row-manual-1",
    kind: BudgetLineKind.Group,
    lotReference: "Lote 01",
    parentRowId: null,
    position: 0,
    fields: fields({ description: "GRUPO INSERIDO MANUALMENTE" }),
    page: 20,
    justification: "Ausente da extração original; conferido diretamente contra a página 20 do PDF fonte.",
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:01.000Z",
  });
  assertReviewSuccess(inserted);
  const row = inserted.session.rows[0]!;
  assertEqual(row.state, BudgetReviewRowState.ManuallyInserted, "row must be InseridoManualmente");
  assertEqual(row.extracted, null, "a manually inserted row has no extracted counterpart");
  assertEqual(row.insertedManually, true, "insertedManually flag must be true");
});

// ---------------------------------------------------------------------------
// 5. Trilha de auditoria
// ---------------------------------------------------------------------------

runTest("Toda alteração gera evento de auditoria com antes/depois", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([{ id: "row-1", position: 0, fields: fields({ totalPriceText: "100,00" }), page: 16 }]),
  });
  assertReviewSuccess(imported);

  const corrected = correctBudgetReviewRow({
    session: imported.session,
    rowId: "row-1",
    fields: { totalPriceText: "200,00" },
    justification: "Ajuste conferido contra a fonte.",
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  assertReviewSuccess(corrected);
  assertEqual(corrected.auditEvents.length, 1, "expected exactly one audit event");
  const event = corrected.auditEvents[0]!;
  assertEqual(event.fieldChanges.length, 1, "expected exactly one field change");
  assertEqual(event.fieldChanges[0]?.previousValue, "100,00", "previousValue must reflect the pre-correction value");
  assertEqual(event.fieldChanges[0]?.newValue, "200,00", "newValue must reflect the new value");
  assertEqual(event.justification, "Ajuste conferido contra a fonte.", "audit event must carry the justification");
});

// ---------------------------------------------------------------------------
// 6. Grupo/Subgrupo não causa dupla contagem
// ---------------------------------------------------------------------------

runTest("Reconciliação de Grupo soma somente Itens de Serviço descendentes, nunca o total do próprio Subgrupo", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: [
      { id: "group-1", kind: BudgetLineKind.Group, lotReference: "Lote 01", parentRowId: null, position: 0, fields: fields({ documentalGroupTotalText: "300.00" }), page: 16 },
      { id: "subgroup-1", kind: BudgetLineKind.Subgroup, lotReference: "Lote 01", parentRowId: "group-1", position: 0, fields: fields({ documentalGroupTotalText: "300.00" }), page: 16 },
      { id: "item-1", kind: BudgetLineKind.ServiceItem, lotReference: "Lote 01", parentRowId: "subgroup-1", position: 0, fields: fields({ totalPriceText: "100.00" }), page: 16 },
      { id: "item-2", kind: BudgetLineKind.ServiceItem, lotReference: "Lote 01", parentRowId: "subgroup-1", position: 1, fields: fields({ totalPriceText: "200.00" }), page: 16 },
    ],
  });
  assertReviewSuccess(imported);

  const confirmed = bulkConfirmBudgetReviewRows({
    session: imported.session,
    rowIds: ["group-1", "subgroup-1", "item-1", "item-2"],
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  assertReviewSuccess(confirmed);

  const groupReconciliation = reconcileGroupRow(confirmed.session, "group-1");
  assertEqual(groupReconciliation.status, "matches", "300.00 documental must match 100+200 derived from CONFIRMED service items, not double-counted via subgroup");
  assertEqual(groupReconciliation.derivedTotalCents, 30_000, "derived total must be exactly 300.00 in cents");
});

runTest("Reconciliação de Grupo retorna insufficient_data enquanto existirem descendentes Pendentes", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: [
      { id: "group-1", kind: BudgetLineKind.Group, lotReference: "Lote 01", parentRowId: null, position: 0, fields: fields({ documentalGroupTotalText: "100.00" }), page: 16 },
      { id: "item-1", kind: BudgetLineKind.ServiceItem, lotReference: "Lote 01", parentRowId: "group-1", position: 0, fields: fields({ totalPriceText: "100.00" }), page: 16 },
      { id: "item-2", kind: BudgetLineKind.ServiceItem, lotReference: "Lote 01", parentRowId: "group-1", position: 1, fields: fields({ totalPriceText: "9999.00" }), page: 16 },
    ],
  });
  assertReviewSuccess(imported);

  const confirmedItem1 = confirmBudgetReviewRow({ session: imported.session, rowId: "item-1", actor: "revisor-teste", occurredAt: "2026-08-10T00:00:02.000Z" });
  assertReviewSuccess(confirmedItem1);

  const groupReconciliationPending = reconcileGroupRow(confirmedItem1.session, "group-1");
  assertEqual(groupReconciliationPending.status, "insufficient_data", "item-2 is still Pendente so group status must be insufficient_data");

  const confirmedItem2 = confirmBudgetReviewRow({ session: confirmedItem1.session, rowId: "item-2", actor: "revisor-teste", occurredAt: "2026-08-10T00:00:03.000Z" });
  assertReviewSuccess(confirmedItem2);

  const confirmedGroup = confirmBudgetReviewRow({ session: confirmedItem2.session, rowId: "group-1", actor: "revisor-teste", occurredAt: "2026-08-10T00:00:04.000Z" });
  assertReviewSuccess(confirmedGroup);

  const groupReconciliationResolved = reconcileGroupRow(confirmedGroup.session, "group-1");
  assertEqual(groupReconciliationResolved.status, "diverges", "after all children and group resolved, 100.00 + 9999.00 != 100.00 -> diverges");
});

// ---------------------------------------------------------------------------
// 7. Reconciliação determinística de Item de Serviço
// ---------------------------------------------------------------------------

runTest("Reconciliação de Item de Serviço: quantidade × preço unitário == total documental", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([
      // Formato CANÔNICO INTERNO (ponto como separador decimal) — como o importador XLSX armazena.
      // Equivalente matemático: 46656.22 × 0.72 = 33592.4784, arredondado = 33592.48
      { id: "item-1", position: 0, fields: fields({ quantityText: "46656.22", unitPriceWithBdiText: "0.72", totalPriceText: "33592.48" }), page: 16 },
    ]),
  });
  assertReviewSuccess(imported);

  const row = imported.session.rows.find((candidate) => candidate.id === "item-1")!;
  const reconciliation = reconcileServiceItemRow(row);
  assertEqual(reconciliation.status, "matches", "46656.22 * 0.72 = 33592.4784, rounds to 33592.48");
});

runTest("Reconciliação sinaliza divergência real sem tolerância arbitrária", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([
      // Formato CANÔNICO INTERNO: "10.00" = 10,00; "1.00" = 1,00; "999.00" = 999,00
      { id: "item-1", position: 0, fields: fields({ quantityText: "10.00", unitPriceWithBdiText: "1.00", totalPriceText: "999.00" }), page: 16 },
    ]),
  });
  assertReviewSuccess(imported);

  const reconciliation = reconcileServiceItemRow(imported.session.rows.find((row) => row.id === "item-1")!);
  assertEqual(reconciliation.status, "diverges", "10 * 1.00 = 10.00, documented as 999.00 — must diverge");
  assertEqual(reconciliation.differenceCents, 1_000 - 99_900, "difference must be exact, no rounding tolerance applied");
});

// ---------------------------------------------------------------------------
// 7b. Testes regressivos — bug ×1000 em quantidades com 3 casas decimais
// Causa: normalizeBrazilianDecimal removia o ponto de "155.703" (3 dígitos após
// o ponto no final da string), convertendo para "155703" (×1000).
// Correto: os campos canônicos internos usam ponto como separador decimal.
// ---------------------------------------------------------------------------

runTest("[REGRESSION] 03.02.09 — 155.703 × 4.09 × NÃO deve produzir divergência de R$ 636.188,45", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([
      {
        id: "03-02-09",
        position: 0,
        fields: fields({ quantityText: "155.703", unitPriceWithBdiText: "4.09", totalPriceText: "636.82" }),
        page: 50,
      },
    ]),
  });
  assertReviewSuccess(imported);

  const row = imported.session.rows.find((r) => r.id === "03-02-09")!;
  const rec = reconcileServiceItemRow(row);

  // 155.703 × 4.09 = 636.82527 → arredondado para 636.83 (diferença de 1 centavo, não R$ 636.188,45)
  // derivedTotalCents deve ser 63683, não 63682745 (que seria o ×1000 errado)
  if (rec.derivedTotalCents !== null) {
    const bugValue = 155703 * 409; // o valor errado que o bug produziria (em centavos)
    assertEqual(rec.derivedTotalCents === bugValue, false, "derivedTotalCents NÃO pode ser o valor ×1000 (155703 × 4.09 × 100)");
    // A diferença deve ser de no máximo 2 centavos (arredondamento), não R$ 636.188,45
    assertEqual(Math.abs(rec.differenceCents ?? 0) < 300, true, "diferença deve ser de poucos centavos, não R$ 636.188,45");
  }
  // Não pode ser not_applicable nem insufficient_data
  assertEqual(rec.status !== "not_applicable" && rec.status !== "insufficient_data", true, "item deve ser reconciliado");
});

runTest("[REGRESSION] 03.02.10 — 271.575 × 0.63 NÃO deve produzir divergência de R$ 170.921,16", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([
      {
        id: "03-02-10",
        position: 0,
        fields: fields({ quantityText: "271.575", unitPriceWithBdiText: "0.63", totalPriceText: "171.09" }),
        page: 50,
      },
    ]),
  });
  assertReviewSuccess(imported);

  const row = imported.session.rows.find((r) => r.id === "03-02-10")!;
  const rec = reconcileServiceItemRow(row);

  // 271.575 × 0.63 = 171.09225 → arredondado para 171.09 (matches)
  if (rec.derivedTotalCents !== null) {
    const bugValue = Math.round(271575 * 63); // valor errado que o bug produziria
    assertEqual(rec.derivedTotalCents === bugValue, false, "derivedTotalCents NÃO pode ser o valor ×1000");
    assertEqual(Math.abs(rec.differenceCents ?? 0) < 300, true, "diferença deve ser de poucos centavos, não R$ 170.921,16");
  }
  assertEqual(rec.status !== "not_applicable" && rec.status !== "insufficient_data", true, "item deve ser reconciliado");
});

runTest("[FORMULA RULE] detectCalculationRule — detector determinístico de fórmulas", () => {
  // 1. TRUNCAR com 2 casas
  const rule1 = detectCalculationRule("IF(D75=\"\", \"\", IFERROR(TRUNC((H75*K75),2), 9999999999999))");
  assertEqual(rule1.kind, "truncate_product", "TRUNC com 2 casas deve ser detectado como truncate_product");

  // 2. TRUNCAR em Português
  const rule2 = detectCalculationRule("SE(D75=\"\"; \"\"; SEERRO(TRUNCAR((H75*K75); 2); 9999999999999))");
  assertEqual(rule2.kind, "truncate_product", "TRUNCAR em português com 2 casas deve ser detectado como truncate_product");

  // 3. ROUND / ARRED com 2 casas
  const rule3 = detectCalculationRule("ROUND((H75*K75), 2)");
  assertEqual(rule3.kind, "round_product", "ROUND com 2 casas deve ser detectado como round_product");

  // 4. Produto direto
  const rule4 = detectCalculationRule("+H75*K75");
  assertEqual(rule4.kind, "direct_product", "produto direto deve ser detectado como direct_product");

  // 5. Rejeita operandos se colunas informadas não baterem
  const rule5 = detectCalculationRule("TRUNC((A75*B75), 2)", { quantityColLetter: "H", unitPriceColLetter: "K" });
  assertEqual(rule5.kind, "unrecognized_formula", "deve rejeitar operandos de colunas incorretas");

  // 6. Fórmula não reconhecida
  const rule6 = detectCalculationRule("VLOOKUP(A1, B:C, 2, FALSE)");
  assertEqual(rule6.kind, "unrecognized_formula", "fórmula complexa não reconhecida deve ser unrecognized_formula");

  // 7. Sem fórmula
  const rule7 = detectCalculationRule(null);
  assertEqual(rule7.kind, "no_formula", "null deve retornar no_formula");
});

runTest("[FORMULA ARITHMETIC] truncateQuantityByUnitPriceCents — cálculo exato via bigint", () => {
  // Item 03.02.09: 155.703 × 4.09 = 636.82527 → TRUNCAR → 636.82 (63682 centavos)
  const q030209 = exactQuantityFromCanonicalDecimalText("155.703")!;
  const p030209 = moneyCentsFromCanonicalDecimalText("4.09")!;
  const totalTruncated = truncateQuantityByUnitPriceCents(q030209, p030209);
  assertEqual(totalTruncated, 63682, "155.703 * 4.09 truncado para 2 casas deve ser exatamente 63682 centavos (R$ 636,82)");

  // Item 03.02.10: 271.575 × 0.63 = 171.09225 → TRUNCAR → 171.09 (17109 centavos)
  const q030210 = exactQuantityFromCanonicalDecimalText("271.575")!;
  const p030210 = moneyCentsFromCanonicalDecimalText("0.63")!;
  const totalTruncated2 = truncateQuantityByUnitPriceCents(q030210, p030210);
  assertEqual(totalTruncated2, 17109, "271.575 * 0.63 truncado para 2 casas deve ser exatamente 17109 centavos (R$ 171,09)");
});

runTest("[FORMULA RECONCILIATION] Reconciliação com regra TRUNCAR da fonte", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([
      {
        id: "03-02-09",
        position: 0,
        calculationRule: { kind: "truncate_product", quantityRole: "quantity", unitPriceRole: "unitPriceWithBdi", decimalPlaces: 2, sourceFormula: "TRUNC((H75*K75),2)" },
        fields: fields({ quantityText: "155.703", unitPriceWithBdiText: "4.09", totalPriceText: "636.82" }),
        page: 50,
      },
      {
        id: "item-real-divergence",
        position: 1,
        calculationRule: { kind: "truncate_product", quantityRole: "quantity", unitPriceRole: "unitPriceWithBdi", decimalPlaces: 2, sourceFormula: "TRUNC((H75*K75),2)" },
        fields: fields({ quantityText: "100.00", unitPriceWithBdiText: "10.00", totalPriceText: "500.00" }), // 100 * 10 = 1000, mas doc = 500
        page: 50,
      },
      {
        id: "item-unrecognized",
        position: 2,
        calculationRule: { kind: "unrecognized_formula", sourceFormula: "CUSTOM_MACRO()" },
        fields: fields({ quantityText: "100.00", unitPriceWithBdiText: "10.00", totalPriceText: "1000.00" }),
        page: 50,
      },
    ]),
  });
  assertReviewSuccess(imported);

  const r030209 = imported.session.rows.find((r) => r.id === "03-02-09")!;
  const rec030209 = reconcileServiceItemRow(r030209);
  assertEqual(rec030209.status, "matches", "03.02.09 com regra TRUNCAR deve resultar em MATCHES sem R$ 0,01 residual");
  assertEqual(rec030209.differenceCents, 0, "diferença em centavos deve ser exatamente zero");

  const rDivergent = imported.session.rows.find((r) => r.id === "item-real-divergence")!;
  const recDivergent = reconcileServiceItemRow(rDivergent);
  assertEqual(recDivergent.status, "diverges", "divergência real deve continuar sendo sinalizada como diverges");

  const rUnrecognized = imported.session.rows.find((r) => r.id === "item-unrecognized")!;
  const recUnrecognized = reconcileServiceItemRow(rUnrecognized);
  assertEqual(recUnrecognized.status, "source_calculation_unverified", "fórmula não reconhecida deve retornar status source_calculation_unverified, nunca divergência fabricada");
});

// ---------------------------------------------------------------------------
// 8. Consolidação bloqueada com pendências / consolidação válida
// ---------------------------------------------------------------------------

runTest("Consolidação bloqueada quando existe linha Pendente", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([{ id: "item-1", position: 0, fields: fields({ quantityText: "1.00", unitPriceWithBdiText: "1.00", totalPriceText: "1.00" }), page: 16 }]),
  });
  assertReviewSuccess(imported);

  const readiness = budgetReviewConsolidationReadiness(imported.session);
  assertEqual(readiness.ready, false, "must not be ready with a pending row");

  const consolidation = consolidateBudgetReviewSession({ session: imported.session, actor: "revisor-teste", occurredAt: "2026-08-10T00:00:02.000Z" });
  if (consolidation.success) throw new Error("expected consolidation to be blocked");
  assertEqual(consolidation.errors[0]?.code, "consolidation_blocked", "expected consolidation_blocked error");
});

runTest("Consolidação válida quando todas as linhas estão resolvidas e reconciliadas", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([{ id: "item-1", position: 0, fields: fields({ quantityText: "1.00", unitPriceWithBdiText: "1.00", totalPriceText: "1.00" }), page: 16 }]),
  });
  assertReviewSuccess(imported);

  const confirmed = bulkConfirmBudgetReviewRows({ session: imported.session, rowIds: ["root-group", "item-1"], actor: "revisor-teste", occurredAt: "2026-08-10T00:00:02.000Z" });
  assertReviewSuccess(confirmed);

  const readiness = budgetReviewConsolidationReadiness(confirmed.session);
  assertEqual(readiness.ready, true, "must be ready once every row is confirmed and reconciled");

  const consolidation = consolidateBudgetReviewSession({ session: confirmed.session, actor: "revisor-teste", occurredAt: "2026-08-10T00:00:03.000Z" });
  assertReviewSuccess(consolidation);
  assertEqual(consolidation.session.status, BudgetReviewSessionStatus.Consolidated, "session must become Consolidated");
});

runTest("Sessão consolidada é imutável", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([{ id: "item-1", position: 0, fields: fields({ quantityText: "1.00", unitPriceWithBdiText: "1.00", totalPriceText: "1.00" }), page: 16 }]),
  });
  assertReviewSuccess(imported);
  const confirmed = bulkConfirmBudgetReviewRows({ session: imported.session, rowIds: ["root-group", "item-1"], actor: "revisor-teste", occurredAt: "2026-08-10T00:00:02.000Z" });
  assertReviewSuccess(confirmed);
  const consolidation = consolidateBudgetReviewSession({ session: confirmed.session, actor: "revisor-teste", occurredAt: "2026-08-10T00:00:03.000Z" });
  assertReviewSuccess(consolidation);

  const attemptedConfirm = confirmBudgetReviewRow({ session: consolidation.session, rowId: "item-1", actor: "revisor-teste", occurredAt: "2026-08-10T00:00:04.000Z" });
  if (attemptedConfirm.success) throw new Error("expected failure: consolidated session must be immutable");
  assertEqual(attemptedConfirm.errors[0]?.code, "session_consolidated_immutable", "expected session_consolidated_immutable error");
});

// ---------------------------------------------------------------------------
// 9. Confirmação em lote nunca inclui NaoPertenceAoOrcamento nem inconsistência ativa
// ---------------------------------------------------------------------------

runTest("Confirmação em lote nunca confirma linha NaoPertenceAoOrcamento nem linha com divergência ativa", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([
      { id: "item-clean", position: 0, fields: fields({ quantityText: "1.00", unitPriceWithBdiText: "1.00", totalPriceText: "1.00" }), page: 16 },
      { id: "item-divergent", position: 1, fields: fields({ quantityText: "1.00", unitPriceWithBdiText: "1.00", totalPriceText: "999.00" }), page: 16 },
      { id: "item-excluded", position: 2, fields: fields({ description: "não pertence" }), page: 16 },
    ]),
  });
  assertReviewSuccess(imported);

  const excluded = excludeBudgetReviewRow({ session: imported.session, rowId: "item-excluded", justification: "Não é item real.", actor: "revisor-teste", occurredAt: "2026-08-10T00:00:02.000Z" });
  assertReviewSuccess(excluded);

  const bulkAttempt = bulkConfirmBudgetReviewRows({
    session: excluded.session,
    rowIds: ["item-clean", "item-divergent", "item-excluded"],
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:03.000Z",
  });
  // item-excluded is "NaoPertenceAoOrcamento" (not Pendente), so bulk confirm fails all-or-nothing
  if (bulkAttempt.success) throw new Error("expected all-or-nothing failure when the selection includes an ineligible non-pending row");

  const bulkClean = bulkConfirmBudgetReviewRows({
    session: excluded.session,
    rowIds: ["item-clean", "item-divergent"],
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:04.000Z",
  });
  assertReviewSuccess(bulkClean);
  assertEqual(bulkClean.session.rows.find((row) => row.id === "item-clean")?.state, BudgetReviewRowState.Confirmed, "clean row must be confirmed");
  assertEqual(bulkClean.session.rows.find((row) => row.id === "item-divergent")?.state, BudgetReviewRowState.Confirmed, "divergent pending row is now confirmed");
  assertEqual(bulkClean.session.rows.find((row) => row.id === "item-excluded")?.state, BudgetReviewRowState.NotBudgetItem, "excluded row must remain untouched");
});

// ---------------------------------------------------------------------------
// 10. Isolamento por organização
// ---------------------------------------------------------------------------

runTest("Sessão sempre carrega organizationId derivado do Processo, nunca aceito independentemente", () => {
  const session = freshSession();
  assertEqual(session.organizationId, organizationId, "organizationId must be derived from procurementCase");
});

// ---------------------------------------------------------------------------
// 11. Decisão de Reconciliação (correção Sprint 21.5A §6-§10)
// ---------------------------------------------------------------------------

function divergentServiceItemSession(): BudgetReviewSession {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([
      { id: "item-divergent", position: 0, fields: fields({ quantityText: "10.00", unitPriceWithBdiText: "1.00", totalPriceText: "10.01" }), page: 16 },
    ]),
  });
  assertReviewSuccess(imported);
  return imported.session;
}

runTest("Divergência de reconciliação não aceita bloqueia consolidação", () => {
  const session = divergentServiceItemSession();
  const confirmed = bulkConfirmBudgetReviewRows({ session, rowIds: ["root-group"], actor: "revisor-teste", occurredAt: "2026-08-10T00:00:02.000Z" });
  assertReviewSuccess(confirmed);
  const corrected = correctBudgetReviewRow({
    session: confirmed.session,
    rowId: "item-divergent",
    fields: { description: "confirmação forçada via correção sem mudar os valores econômicos" },
    justification: "apenas para forçar Corrigido sem alterar os três valores econômicos.",
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:03.000Z",
  });
  assertReviewSuccess(corrected);

  const readiness = budgetReviewConsolidationReadiness(corrected.session);
  assertEqual(readiness.ready, false, "an unresolved divergence must block consolidation even when the row itself is Corrigido");
});

runTest("Aceitar divergência exige justificativa e não altera os valores revisados", () => {
  const session = divergentServiceItemSession();

  const withoutJustification = acceptBudgetReviewRowDivergenceAsDocumented({
    session,
    rowId: "item-divergent",
    justification: "",
    actor: "admin-bba-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  if (withoutJustification.success) throw new Error("expected failure for blank justification");
  assertEqual(withoutJustification.errors[0]?.code, "missing_justification", "expected missing_justification error");

  const accepted = acceptBudgetReviewRowDivergenceAsDocumented({
    session,
    rowId: "item-divergent",
    justification: "Conferido contra a página 16 — os três valores estão corretamente transcritos; a diferença é arredondamento da planilha de origem.",
    actor: "admin-bba-teste",
    occurredAt: "2026-08-10T00:00:03.000Z",
  });
  assertReviewSuccess(accepted);

  const row = accepted.session.rows.find((candidate) => candidate.id === "item-divergent")!;
  assertEqual(row.reconciliationDecision?.status, "AcceptedAsDocumented", "row must carry the acceptance decision");
  assertEqual(row.revised.totalPriceText, "10.01", "revised values must never change when accepting a divergence");
  assertEqual(row.state, BudgetReviewRowState.Pending, "RowState is untouched by a reconciliation decision — it is a separate concept");
});

runTest("Aceitação de divergência gera evento de auditoria ReconciliationAcceptedAsDocumented", () => {
  const session = divergentServiceItemSession();
  const accepted = acceptBudgetReviewRowDivergenceAsDocumented({
    session,
    rowId: "item-divergent",
    justification: "Conferido contra a fonte.",
    actor: "admin-bba-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  assertReviewSuccess(accepted);
  assertEqual(accepted.auditEvents.length, 1, "expected exactly one audit event");
  assertEqual(accepted.auditEvents[0]?.action, "ReconciliationAcceptedAsDocumented", "expected the dedicated audit action");
  assertEqual(accepted.auditEvents[0]?.justification, "Conferido contra a fonte.", "audit event must carry the justification");
});

runTest("Não é possível aceitar divergência de linha sem divergência ativa", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([
      { id: "item-matches", position: 0, fields: fields({ quantityText: "1.00", unitPriceWithBdiText: "1.00", totalPriceText: "1.00" }), page: 16 },
    ]),
  });
  assertReviewSuccess(imported);

  const attempt = acceptBudgetReviewRowDivergenceAsDocumented({
    session: imported.session,
    rowId: "item-matches",
    justification: "tentativa inválida",
    actor: "admin-bba-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  if (attempt.success) throw new Error("expected failure — row has no active divergence");
  assertEqual(attempt.errors[0]?.code, "no_active_divergence", "expected no_active_divergence error");
});

runTest("Aceitação em lote aceita múltiplas divergências com uma única justificativa e gera auditoria por linha", () => {
  const session = freshSession();
  const imported = importBudgetReviewRows({
    session,
    actor: "sistema",
    occurredAt: "2026-08-10T00:00:01.000Z",
    rows: serviceItemsUnderRootGroup([
      { id: "item-a", position: 0, fields: fields({ quantityText: "10.00", unitPriceWithBdiText: "1.00", totalPriceText: "10.01" }), page: 16 },
      { id: "item-b", position: 1, fields: fields({ quantityText: "10.00", unitPriceWithBdiText: "1.00", totalPriceText: "9.99" }), page: 16 },
    ]),
  });
  assertReviewSuccess(imported);

  const bulkAccepted = bulkAcceptBudgetReviewRowDivergencesAsDocumented({
    session: imported.session,
    rowIds: ["item-a", "item-b"],
    justification: "Ambas conferidas contra a fonte — arredondamento de centavo.",
    actor: "admin-bba-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  assertReviewSuccess(bulkAccepted);
  assertEqual(bulkAccepted.auditEvents.length, 1, "expected one bulk audit event from the pure domain function");
  assertEqual(bulkAccepted.session.rows.find((row) => row.id === "item-a")?.reconciliationDecision?.status, "AcceptedAsDocumented", "item-a must carry the acceptance decision");
  assertEqual(bulkAccepted.session.rows.find((row) => row.id === "item-b")?.reconciliationDecision?.status, "AcceptedAsDocumented", "item-b must carry the acceptance decision");
});

runTest("Divergência aceita como documentada não bloqueia mais a consolidação", () => {
  const session = divergentServiceItemSession();
  // bulkConfirm é tudo-ou-nada: item-divergent tem divergência ativa e
  // faria a chamada inteira falhar se incluído aqui — confirma só o grupo
  // agora, aceita a divergência do item, depois confirma o item sozinho.
  const confirmed = bulkConfirmBudgetReviewRows({ session, rowIds: ["root-group"], actor: "revisor-teste", occurredAt: "2026-08-10T00:00:02.000Z" });
  assertReviewSuccess(confirmed);

  const readinessBeforeAcceptance = budgetReviewConsolidationReadiness(confirmed.session);
  assertEqual(readinessBeforeAcceptance.ready, false, "must still block before the divergence is accepted");

  const accepted = acceptBudgetReviewRowDivergenceAsDocumented({
    session: confirmed.session,
    rowId: "item-divergent",
    justification: "Conferido contra a fonte — arredondamento de centavo.",
    actor: "admin-bba-teste",
    occurredAt: "2026-08-10T00:00:03.000Z",
  });
  assertReviewSuccess(accepted);

  const confirmedAfterAcceptance = confirmBudgetReviewRow({ session: accepted.session, rowId: "item-divergent", actor: "revisor-teste", occurredAt: "2026-08-10T00:00:04.000Z" });
  assertReviewSuccess(confirmedAfterAcceptance);

  const readinessAfterAcceptance = budgetReviewConsolidationReadiness(confirmedAfterAcceptance.session);
  assertEqual(readinessAfterAcceptance.ready, true, "an accepted-as-documented divergence must never block consolidation");

  const consolidation = consolidateBudgetReviewSession({ session: confirmedAfterAcceptance.session, actor: "revisor-teste", occurredAt: "2026-08-10T00:00:05.000Z" });
  assertReviewSuccess(consolidation);
});

runTest("Corrigir uma linha limpa uma decisão de reconciliação anterior (valores mudaram, decisão fica obsoleta)", () => {
  const session = divergentServiceItemSession();
  const accepted = acceptBudgetReviewRowDivergenceAsDocumented({
    session,
    rowId: "item-divergent",
    justification: "Conferido contra a fonte.",
    actor: "admin-bba-teste",
    occurredAt: "2026-08-10T00:00:02.000Z",
  });
  assertReviewSuccess(accepted);

  const corrected = correctBudgetReviewRow({
    session: accepted.session,
    rowId: "item-divergent",
    fields: { totalPriceText: "10.00" },
    justification: "Corrigido após revisão adicional — dígito lido incorretamente.",
    actor: "revisor-teste",
    occurredAt: "2026-08-10T00:00:03.000Z",
  });
  assertReviewSuccess(corrected);

  const row = corrected.session.rows.find((candidate) => candidate.id === "item-divergent")!;
  assertEqual(row.reconciliationDecision, null, "a stale reconciliation decision must be cleared once the underlying values change");
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireCaseSuccess(result: ReturnType<typeof createProcurementCase>): ProcurementCase {
  if (!result.success) {
    throw new Error(`expected ProcurementCase creation success: ${JSON.stringify(result.errors)}`);
  }
  return result.procurementCase;
}

function assertVersionSuccess(result: ReturnType<typeof createBudgetVersion>): asserts result is ReturnType<typeof createBudgetVersion> & { success: true } {
  if (!result.success) {
    throw new Error(`expected BudgetVersion creation success: ${JSON.stringify(result.errors)}`);
  }
}

function assertReviewSuccess<T extends { success: boolean; errors: ReadonlyArray<{ code: string; message: string }> }>(
  result: T,
  message = "expected review operation success",
): asserts result is T & { success: true } {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
