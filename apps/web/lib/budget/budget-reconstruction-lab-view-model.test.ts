import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ArithmeticEvaluation,
  BudgetTableReconstructionResult,
  ParsedNumericEvidence,
  ReconstructedBudgetRecord,
  ReconstructionIssue,
  ResolvedColumn,
} from "@bba/bdos-core/domain/budget-table-reconstruction.types";
import {
  buildBudgetReconstructionLabViewModel,
  explainRecordStatus,
  RECORD_STATUS_EXPLANATIONS,
  validateBudgetReconstructionLabInput,
} from "./budget-reconstruction-lab-view-model";

const currentDir = dirname(fileURLToPath(import.meta.url));
const VIEW_MODEL_SOURCE = readFileSync(join(currentDir, "budget-reconstruction-lab-view-model.ts"), "utf8");

// Epic 21 — Laboratório de Reconstrução Orçamentária. Testa somente a
// projeção pura (BudgetTableReconstructionResult sintético -> view model);
// nenhum dado real de DNOCS/Concretisa/Pouso Alegre é usado. O motor em si
// (packages/bdos-core/src/domain/budget-table-reconstruction/, PR #83)
// permanece congelado e não é exercitado aqui.

function numericField(rawText: string, overrides: Partial<ParsedNumericEvidence> = {}): ParsedNumericEvidence {
  return {
    rawText,
    normalizedText: rawText,
    displayedScale: 2,
    grammarId: "decimal-comma-v1",
    exactValue: { numerator: "1", denominator: "1" },
    alternativeValues: [],
    status: "resolved",
    sourceCellIds: ["cell:1"],
    sourceFragmentIds: ["fragment:1"],
    ...overrides,
  };
}

function record(overrides: Partial<ReconstructedBudgetRecord>): ReconstructedBudgetRecord {
  return {
    recordId: "record:1",
    pageNumber: 1,
    documentOrder: 0,
    kind: "service_item",
    status: "resolved",
    rowIds: ["row:1"],
    parentRecordId: null,
    itemCode: "A1",
    description: "Serviço sintético",
    unit: "m",
    quantity: numericField("2,00"),
    unitCost: null,
    bdiRate: null,
    unitPrice: numericField("10,00"),
    totalPrice: numericField("20,00"),
    ...overrides,
  };
}

function column(overrides: Partial<ResolvedColumn>): ResolvedColumn {
  return {
    columnId: "column:1",
    pageNumber: 1,
    horizontalOrder: 1,
    leftPoints: 0,
    rightPoints: 100,
    candidateRoles: ["description"],
    role: "description",
    status: "resolved",
    headerLineIds: [],
    evidenceLocatorIds: [],
    sourcePhysicalColumnHypothesisIds: [],
    contributingRegionIds: [],
    contributingLineIds: [],
    contributingSegmentIds: [],
    groupingRuleId: "overlap-semantic-noncooccupancy-components-v1",
    representativePhysicalColumnHypothesisId: null,
    nonGroupingReasonCodes: [],
    bandProvenance: "upstream",
    headerAtomIds: [],
    splitReasonCode: null,
    ...overrides,
  };
}

function arithmeticEvaluation(overrides: Partial<ArithmeticEvaluation>): ArithmeticEvaluation {
  return {
    evaluationId: "arithmetic:1",
    relation: "quantity_times_unit_price",
    recordId: "record:1",
    outcome: "direct_correspondence",
    operandCellIds: [],
    operandFragmentIds: [],
    exactComputedValue: null,
    displayedValue: null,
    summandRecordIds: [],
    ...overrides,
  };
}

function buildFixtureResult(overrides: Partial<BudgetTableReconstructionResult> = {}): BudgetTableReconstructionResult {
  return {
    schemaVersion: 2,
    engineName: "budget-table-reconstruction-engine",
    engineVersion: "budget-table-reconstruction-engine-v3",
    profileId: "generic-budget-table-reconstruction-profile",
    profileVersion: 3,
    pageSelection: [1],
    sourceIdentity: {
      sourceByteHash: "a".repeat(64),
      physicalReaderName: "synthetic",
      physicalReaderVersion: "1",
      physicalAdapterVersion: "1",
      underlyingLibraryVersion: null,
      physicalGeometryContextFingerprint: "b".repeat(64),
      pageLocatorName: "synthetic",
      pageLocatorVersion: "1",
      structureReconstructorName: "synthetic",
      structureReconstructorVersion: "1",
      structureFingerprint: "c".repeat(64),
      columnFingerprint: null,
      physicalCellFingerprint: null,
      physicalCellTextFingerprint: null,
    },
    status: "completed_with_ambiguities",
    locators: [],
    textItems: [],
    fragments: [],
    lines: [],
    segments: [],
    columns: [column({})],
    cells: [],
    logicalRows: [],
    pages: [{ pageNumber: 1, sourceStatus: "reconstructed", lineIds: [], segmentIds: [], textItemEvidenceIds: [], columnIds: [], cellIds: [], logicalRowIds: [] }],
    records: [record({})],
    arithmeticEvaluations: [],
    evidenceDispositions: [],
    structuralIssues: [],
    completeness: {
      applicableFieldCount: 0,
      presentFieldCount: 0,
      missingFieldCount: 0,
      divergentFieldCount: 0,
      ambiguousFieldCount: 0,
      exactFraction: null,
      status: "complete",
    },
    canonicalFingerprint: "d".repeat(64),
    ...overrides,
  };
}

async function main(): Promise<void> {
  await runTest("1. resultado válido gera resumo correto", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({ records: [record({ status: "resolved" })] }),
    );
    assertEqual(viewModel.summary.totalRecordCount, 1);
    assertEqual(viewModel.summary.serviceItemCount, 1);
    assertEqual(viewModel.summary.resolvedServiceItemCount, 1);
  });

  await runTest("2. registros são contados por kind/status", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [
          record({ recordId: "record:1", status: "resolved" }),
          record({ recordId: "record:2", status: "ambiguous" }),
          record({ recordId: "record:3", status: "insufficient_evidence" }),
          record({ recordId: "record:4", kind: "group", status: "resolved", itemCode: "01" }),
        ],
      }),
    );
    assertEqual(viewModel.summary.serviceItemCount, 3);
    assertEqual(viewModel.summary.resolvedServiceItemCount, 1);
    assertEqual(viewModel.summary.needsReviewServiceItemCount, 1);
    assertEqual(viewModel.summary.insufficientEvidenceServiceItemCount, 1);
  });

  await runTest("3. unclassified não entra na visualização principal por padrão (contado, mas sinalizável)", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [
          record({ recordId: "record:1", kind: "service_item" }),
          record({ recordId: "record:2", kind: "unclassified", status: "insufficient_evidence" }),
        ],
      }),
    );
    assertEqual(viewModel.summary.unclassifiedCount, 1);
    const unclassifiedRecord = viewModel.records.find((r) => r.kind === "unclassified");
    assertTrue(unclassifiedRecord !== undefined, "o registro unclassified continua presente na projeção completa");
    assertEqual(unclassifiedRecord?.kindLabel, "Não classificado");
  });

  await runTest("4-7. rótulos de status e kind traduzidos para português", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [
          record({ recordId: "record:1", status: "resolved" }),
          record({ recordId: "record:2", status: "ambiguous", kind: "group", itemCode: "01" }),
          record({ recordId: "record:3", status: "insufficient_evidence", kind: "subtotal", itemCode: null }),
        ],
      }),
    );
    const byId = new Map(viewModel.records.map((r) => [r.recordId, r]));
    assertEqual(byId.get("record:1")?.statusLabel, "Resolvido");
    assertEqual(byId.get("record:2")?.statusLabel, "Precisa de revisão");
    assertEqual(byId.get("record:2")?.kindLabel, "Grupo");
    assertEqual(byId.get("record:3")?.statusLabel, "Evidência insuficiente");
    assertEqual(byId.get("record:3")?.kindLabel, "Subtotal");
  });

  await runTest("8. página funciona (colunas agrupadas por pageNumber)", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        columns: [column({ pageNumber: 1, role: "description" }), column({ pageNumber: 2, role: "quantity", columnId: "column:2" })],
      }),
    );
    assertEqual(viewModel.columnsByPage.length, 2);
    assertEqual(viewModel.columnsByPage[0]?.pageNumber, 1);
    assertEqual(viewModel.columnsByPage[1]?.pageNumber, 2);
  });

  await runTest("9. rawText numérico é preservado literalmente", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [record({ quantity: numericField("1.234,56") })],
      }),
    );
    assertEqual(viewModel.records[0]?.quantity?.rawText, "1.234,56");
  });

  await runTest("10. nenhum cálculo econômico é feito (rawText nunca é reinterpretado como número)", () => {
    assertTrue(
      !/parseFloat|\.toFixed\(|Number\(\s*\w+\.numerator\s*\)|exactValue\.numerator\s*\/\s*exactValue\.denominator/.test(
        VIEW_MODEL_SOURCE,
      ),
      "o view model não deve reinterpretar ExactRational/rawText numericamente",
    );
  });

  await runTest("11. numeric status failed permanece failed na projeção", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [
          record({
            totalPrice: numericField("R$ 156,00 | 624,00", {
              status: "failed",
              grammarId: "divergent-source-cells-v1",
              exactValue: null,
            }),
          }),
        ],
      }),
    );
    assertEqual(viewModel.records[0]?.totalPrice?.status, "failed");
  });

  await runTest("12. divergent-source-cells-v1 recebe marcação de conflito (hasConflict)", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [
          record({
            totalPrice: numericField("R$ 156,00 | 624,00", {
              status: "failed",
              grammarId: "divergent-source-cells-v1",
              exactValue: null,
            }),
          }),
        ],
      }),
    );
    assertEqual(viewModel.records[0]?.totalPrice?.hasConflict, true);
    assertEqual(viewModel.records[0]?.hasNumericConflict, true);
  });

  await runTest("13. structuralIssues são preservados (não filtrados nem reinterpretados)", () => {
    const issue: ReconstructionIssue = { code: "synthetic-issue", severity: "ambiguity", pageNumber: 1, evidenceIds: ["x"] };
    const viewModel = buildBudgetReconstructionLabViewModel(buildFixtureResult({ structuralIssues: [issue] }));
    assertEqual(viewModel.structuralIssues.length, 1);
    assertEqual(viewModel.structuralIssues[0]?.code, "synthetic-issue");
    assertEqual(viewModel.summary.structuralIssueCount, 1);
  });

  await runTest("14. arithmetic outcomes são somente agrupados/contados", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        arithmeticEvaluations: [
          arithmeticEvaluation({ evaluationId: "a1", outcome: "direct_correspondence" }),
          arithmeticEvaluation({ evaluationId: "a2", outcome: "direct_correspondence" }),
          arithmeticEvaluation({ evaluationId: "a3", outcome: "invented_evidence" }),
        ],
      }),
    );
    const direct = viewModel.arithmeticOutcomeCounts.find((entry) => entry.outcome === "direct_correspondence");
    const invented = viewModel.arithmeticOutcomeCounts.find((entry) => entry.outcome === "invented_evidence");
    assertEqual(direct?.count, 2);
    assertEqual(invented?.count, 1);
    assertEqual(viewModel.summary.investedEvidenceCount, 1);
  });

  await runTest("15. invalid JSON/shape é rejeitado de forma controlada", () => {
    const outcomeA = validateBudgetReconstructionLabInput({ not: "a reconstruction result" });
    assertEqual(outcomeA.valid, false);
    const outcomeB = validateBudgetReconstructionLabInput(null);
    assertEqual(outcomeB.valid, false);
    const outcomeC = validateBudgetReconstructionLabInput("just a string");
    assertEqual(outcomeC.valid, false);
  });

  await runTest("15b. wrapper do executor ({ schemaVersion, executionManifest, reconstruction }) é aceito", () => {
    const fixture = buildFixtureResult({});
    const outcome = validateBudgetReconstructionLabInput({
      schemaVersion: 1,
      executionManifest: { requestedPageNumbers: [1] },
      reconstruction: fixture,
    });
    assertTrue(outcome.valid, "o wrapper do executor deve ser aceito");
    if (outcome.valid) {
      assertEqual(outcome.result.canonicalFingerprint, fixture.canonicalFingerprint);
    }
  });

  await runTest(
    "15c. um arquivo real sem canonicalFingerprint (omitCanonicalFingerprint: true no executor) ainda é aceito",
    () => {
      const fixture = buildFixtureResult({});
      const { canonicalFingerprint: _omitted, ...withoutFingerprint } = fixture;
      void _omitted;
      const outcome = validateBudgetReconstructionLabInput(withoutFingerprint);
      assertTrue(
        outcome.valid,
        "arquivos reais do executor (omitCanonicalFingerprint: true) não têm este campo e devem continuar válidos",
      );
      if (outcome.valid) {
        const viewModel = buildBudgetReconstructionLabViewModel(outcome.result);
        assertEqual(viewModel.summary.canonicalFingerprint, "Não incluído neste arquivo");
      }
    },
  );

  await runTest("16. canonicalFingerprint é apresentado, não recalculado", () => {
    const fixture = buildFixtureResult({ canonicalFingerprint: "e".repeat(64) });
    const viewModel = buildBudgetReconstructionLabViewModel(fixture);
    assertEqual(viewModel.summary.canonicalFingerprint, "e".repeat(64));
  });

  await runTest("group/subgroup/subtotal/total não contam como Item de Serviço", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [
          record({ recordId: "r1", kind: "group", itemCode: "01" }),
          record({ recordId: "r2", kind: "subgroup", itemCode: "01.01" }),
          record({ recordId: "r3", kind: "subtotal", itemCode: null }),
          record({ recordId: "r4", kind: "total", itemCode: null }),
        ],
      }),
    );
    assertEqual(viewModel.summary.serviceItemCount, 0);
    assertEqual(viewModel.summary.totalRecordCount, 4);
  });

  await runTest("1. legenda/admin helper para Resolvido", () => {
    assertEqual(RECORD_STATUS_EXPLANATIONS.resolved, "Campos aplicáveis identificados com segurança.");
  });

  await runTest("2. legenda/admin helper para Precisa de revisão", () => {
    assertEqual(RECORD_STATUS_EXPLANATIONS.ambiguous, "Há conflito ou ambiguidade em um ou mais campos.");
  });

  await runTest("3. legenda/admin helper para Evidência insuficiente", () => {
    assertEqual(
      RECORD_STATUS_EXPLANATIONS.insufficient_evidence,
      "Faltam dados ou evidência suficiente para concluir este registro.",
    );
  });

  await runTest("registro resolvido: \"por que este status?\" não polui a interface", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({ records: [record({ recordId: "r1", status: "resolved" })] }),
    );
    const reasons = explainRecordStatus(viewModel.records[0]!);
    assertEqual(reasons.length, 1);
    assertEqual(reasons[0], "Campos aplicáveis identificados com segurança.");
  });

  await runTest("\"por que este status?\" aponta o campo numérico com conflito, usando status já existente", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [
          record({
            recordId: "r1",
            status: "ambiguous",
            totalPrice: numericField("R$ 156,00 | 624,00", { grammarId: "divergent-source-cells-v1" }),
          }),
        ],
      }),
    );
    const reasons = explainRecordStatus(viewModel.records[0]!);
    assertTrue(
      reasons.some((reason) => reason.startsWith("Total →") && reason.includes("conflitantes")),
      `esperava um motivo mencionando "Total" e conflito, recebi: ${JSON.stringify(reasons)}`,
    );
  });

  await runTest("\"por que este status?\" cai no genérico quando nenhum campo numérico explica o motivo", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [
          record({
            recordId: "r1",
            status: "insufficient_evidence",
            quantity: null,
            unitCost: null,
            bdiRate: null,
            unitPrice: null,
            totalPrice: null,
          }),
        ],
      }),
    );
    const reasons = explainRecordStatus(viewModel.records[0]!);
    assertEqual(reasons.length, 1);
    assertEqual(reasons[0], "Este registro não possui evidência suficiente para ser considerado resolvido.");
  });

  await runTest("\"por que este status?\" nunca inventa um motivo para Unidade (sem status estruturado no domínio)", () => {
    const viewModel = buildBudgetReconstructionLabViewModel(
      buildFixtureResult({
        records: [
          record({
            recordId: "r1",
            status: "ambiguous",
            unit: "um texto de unidade incomumente longo e estranho",
            quantity: null,
            unitCost: null,
            bdiRate: null,
            unitPrice: null,
            totalPrice: null,
          }),
        ],
      }),
    );
    const reasons = explainRecordStatus(viewModel.records[0]!);
    assertTrue(
      !reasons.some((reason) => reason.toLowerCase().startsWith("unidade")),
      "Unidade não deve aparecer nos motivos -- o domínio não anexa ParsedNumericEvidence/status a este campo",
    );
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
