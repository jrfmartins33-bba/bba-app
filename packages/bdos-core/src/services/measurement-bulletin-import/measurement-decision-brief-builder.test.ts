import {
  MEASUREMENT_DECISION_BRIEF_BUILDER_VERSION,
  buildMeasurementDecisionBrief,
  deriveReadiness,
  type BuildMeasurementDecisionBriefInput
} from "./measurement-decision-brief-builder";
import type { MeasurementAnalysisResult } from "./measurement-bulletin-import.types";

// Epic 20, Sprint 20.1B. Fixtures adaptadas do padrão real de
// measurement-bulletin-import-service.test.ts (Epic 19) -- a fixture
// "needs_review" abaixo é um caso derivado do BM_08 real (mesmos
// números validados no E2E: R$ 252.654,78, 336 WorkPackages, 300
// ManagedServiceItems, 15 linhas, 8 warnings estruturais), sem nenhum
// dado sensível de cliente. Cobre os 20 cenários pedidos na revisão
// de arquitetura que precedeu esta implementação.

const RECONCILED_FIXTURE: MeasurementAnalysisResult = {
  schemaVersion: 1,
  parserKey: "dnocs-measurement-bulletin-v1",
  generatedAt: "2026-01-01T00:00:00.000Z",
  measurementBulletinImportId: "import-reconciled",
  engineeringProjectId: "project-1",
  declaredBulletinNumber: 1,
  declaredPeriod: { startDate: "2026-01-01", endDate: "2026-01-31", labels: ["MED-01"] },
  structuralIssues: [],
  skippedSheets: [],
  status: "reconciled",
  measurementWorkspaceId: "workspace-1",
  officialPeriodTotal: 1000,
  recalculatedTotal: 1000,
  totalDifference: 0,
  workPackages: { created: 2, matched: 0 },
  serviceItems: { created: 1, matched: 0 },
  lines: { imported: 1, alreadyPresent: 0, updated: 0, skippedZeroValue: 0 }
};

// Derivada do BM_08 real (E2E do Epic 19) -- mesmos números
// (officialPeriodTotal/recalculatedTotal = R$ 252.654,78, diferença
// R$ 0,00, 336 WorkPackages, 300 ManagedServiceItems, 15 linhas),
// dois dos 8 warnings estruturais reais como amostra representativa.
const NEEDS_REVIEW_FIXTURE: MeasurementAnalysisResult = {
  schemaVersion: 1,
  parserKey: "dnocs-measurement-bulletin-v1",
  generatedAt: "2026-01-01T00:00:00.000Z",
  measurementBulletinImportId: "import-needs-review",
  engineeringProjectId: "project-1",
  declaredBulletinNumber: 8,
  declaredPeriod: { startDate: "2026-06-01", endDate: "2026-06-30", labels: ["MED-08"] },
  structuralIssues: [
    {
      code: "missing_work_package_code",
      severity: "warning",
      message: 'Linha com dado parcial (código ou nome ausente) na aba "BOLETIM DE MEDIÇÃO 08", linha 347.',
      sourceLocation: { sheetName: "BOLETIM DE MEDIÇÃO 08", rowNumber: 347 }
    },
    {
      code: "orphan_legacy_column_detected",
      severity: "warning",
      message: 'Coluna(s) residual(is) sem cabeçalho reconhecido na aba "BOLETIM DE MEDIÇÃO 08", não utilizada(s) na extração: A; N.'
    }
  ],
  skippedSheets: [],
  status: "needs_review",
  measurementWorkspaceId: "workspace-2",
  officialPeriodTotal: 252654.78,
  recalculatedTotal: 252654.78,
  totalDifference: 0,
  workPackages: { created: 336, matched: 0 },
  serviceItems: { created: 300, matched: 0 },
  lines: { imported: 15, alreadyPresent: 0, updated: 0, skippedZeroValue: 0 }
};

const FAILED_BLOCKING_FIXTURE: MeasurementAnalysisResult = {
  schemaVersion: 1,
  parserKey: "dnocs-measurement-bulletin-v1",
  generatedAt: "2026-01-01T00:00:00.000Z",
  measurementBulletinImportId: "import-failed-blocking",
  engineeringProjectId: "project-1",
  declaredBulletinNumber: null,
  declaredPeriod: null,
  structuralIssues: [
    {
      code: "official_measurement_block_not_found",
      severity: "blocking",
      message: 'Bloco "CONTROLE FINANCEIRO -- MEDIÇÃO" não localizado na aba.'
    }
  ],
  skippedSheets: [],
  status: "failed",
  measurementWorkspaceId: null
};

const FAILED_TECHNICAL_FIXTURE: MeasurementAnalysisResult = {
  schemaVersion: 1,
  parserKey: "dnocs-measurement-bulletin-v1",
  generatedAt: "2026-01-01T00:00:00.000Z",
  measurementBulletinImportId: "import-failed-technical",
  engineeringProjectId: "project-1",
  declaredBulletinNumber: null,
  declaredPeriod: null,
  structuralIssues: [],
  skippedSheets: [],
  status: "failed",
  measurementWorkspaceId: null
};

// Duas colunas reais na mesma issue -- official_period_total_mismatch
// (consequência específica aprovada), sourceLocation com
// physicalColumn E financialColumn.
const MULTI_COLUMN_FIXTURE: MeasurementAnalysisResult = {
  ...NEEDS_REVIEW_FIXTURE,
  structuralIssues: [
    {
      code: "official_period_total_mismatch",
      severity: "blocking",
      message: "TOTAL GERAL declarado diverge da soma recalculada.",
      sourceLocation: { sheetName: "BOLETIM DE MEDIÇÃO 08", rowNumber: 400, physicalColumn: "G", financialColumn: "H" }
    },
    {
      // Código sem consequência específica aprovada -- exercita o fallback genérico.
      code: "missing_quantity_and_value",
      severity: "warning",
      message: "Linha sem quantidade e sem valor no período."
    }
  ],
  status: "needs_review"
};

function buildInput(analysisResult: MeasurementAnalysisResult, overrides?: Partial<BuildMeasurementDecisionBriefInput>): BuildMeasurementDecisionBriefInput {
  return {
    analysisResult,
    sourceImportId: overrides?.sourceImportId ?? analysisResult.measurementBulletinImportId,
    generatedAt: overrides?.generatedAt ?? "2026-07-13T12:00:00.000Z"
  };
}

// 1. Análise completa sem bloqueios (reconciled).
runTest("reconciled produz readiness=ready", () => {
  assertEqual(deriveReadiness(RECONCILED_FIXTURE), "ready");
  const brief = buildMeasurementDecisionBrief(buildInput(RECONCILED_FIXTURE));
  assertEqual(brief.executiveConclusion.readiness, "ready");
  assertEqual(brief.criticalItems.length, 0);
  assertEqual(brief.keyDecisions.length, 1);
  assertTrue(brief.keyDecisions[0]!.recommended, "única keyDecision é a recomendada");
});

// 2. Análise completa com ressalvas (needs_review, só warnings).
runTest("needs_review com só warnings produz readiness=ready_with_reservations (caso real do BM_08)", () => {
  assertEqual(deriveReadiness(NEEDS_REVIEW_FIXTURE), "ready_with_reservations");
  const brief = buildMeasurementDecisionBrief(buildInput(NEEDS_REVIEW_FIXTURE));
  assertEqual(brief.executiveConclusion.readiness, "ready_with_reservations");
  assertEqual(brief.criticalItems.length, 2);
  assertEqual(brief.keyDecisions.length, 2, "prosseguir com ressalvas + reter, como alternativas");
});

// 3. Análise com condição bloqueante (failed + issue blocking).
runTest("failed com issue blocking produz readiness=not_ready", () => {
  assertEqual(deriveReadiness(FAILED_BLOCKING_FIXTURE), "not_ready");
  const brief = buildMeasurementDecisionBrief(buildInput(FAILED_BLOCKING_FIXTURE));
  assertEqual(brief.executiveConclusion.readiness, "not_ready");
  assertEqual(brief.criticalItems.length, 1);
  assertEqual(brief.criticalItems[0]!.severity, "blocking");
});

// 4. Análise inconclusiva (failed técnico, sem nenhuma issue).
runTest("failed sem nenhuma issue (falha técnica) produz readiness=inconclusive", () => {
  assertEqual(deriveReadiness(FAILED_TECHNICAL_FIXTURE), "inconclusive");
  const brief = buildMeasurementDecisionBrief(buildInput(FAILED_TECHNICAL_FIXTURE));
  assertEqual(brief.executiveConclusion.readiness, "inconclusive");
  assertEqual(brief.criticalItems.length, 0, "nenhuma issue -- nada a listar como item crítico");
});

// 5 e 6. Metadata: schemaVersion, builderVersion.
runTest("metadata carrega schemaVersion e builderVersion, ambos independentes do input", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(RECONCILED_FIXTURE));
  assertEqual(brief.metadata.schemaVersion, "1.0");
  assertEqual(brief.metadata.builderVersion, MEASUREMENT_DECISION_BRIEF_BUILDER_VERSION);
  assertEqual(MEASUREMENT_DECISION_BRIEF_BUILDER_VERSION, "measurement-decision-brief-v1");
});

// 7. generatedAt injetado, nunca calculado pelo relógio do sistema.
runTest("generatedAt é exatamente o valor injetado pelo chamador", () => {
  const injected = "2020-01-01T00:00:00.000Z";
  const brief = buildMeasurementDecisionBrief(buildInput(RECONCILED_FIXTURE, { generatedAt: injected }));
  assertEqual(brief.metadata.generatedAt, injected, "generatedAt deve refletir exatamente o parâmetro, nunca a hora real de execução do teste");
});

// 8. Construção de keyDecisions (not_ready).
runTest("not_ready produz keyDecisions com a retenção como recomendada", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(FAILED_BLOCKING_FIXTURE));
  const recommended = brief.keyDecisions.find((decision) => decision.recommended);
  assertTrue(recommended !== undefined, "deve haver uma keyDecision recomendada");
  assertTrue(recommended!.label.toLowerCase().includes("reter"), "reter é a decisão recomendada quando not_ready");
});

// 9 e 10. criticalItems + consequências vinculadas.
runTest("criticalItems reflete severidade/mensagem reais e consequências aprovadas quando existem", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(MULTI_COLUMN_FIXTURE));
  const mismatchItem = brief.criticalItems.find((item) => item.id.startsWith("official_period_total_mismatch"));
  assertTrue(mismatchItem !== undefined, "item para official_period_total_mismatch deve existir");
  assertEqual(mismatchItem!.severity, "blocking");
  assertEqual(mismatchItem!.body, "TOTAL GERAL declarado diverge da soma recalculada.", "body é passthrough exato de issue.message");
  assertTrue(mismatchItem!.consequenceIfAddressed !== null, "consequência aprovada em EPIC_20_DECISION_EXPERIENCE_VISION.md §H");
  assertTrue(mismatchItem!.consequenceIfIgnored !== null);

  const genericItem = brief.criticalItems.find((item) => item.id.startsWith("missing_quantity_and_value"));
  assertTrue(genericItem !== undefined);
  assertEqual(genericItem!.consequenceIfAddressed, "A análise poderá prosseguir sem esta inconsistência.", "fallback genérico para código sem consequência específica aprovada");
});

// 11. nextActions descritivas, derivadas de um problema real.
runTest("nextActions é 1:1 com criticalItems, nunca cria id de aggregate", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(NEEDS_REVIEW_FIXTURE));
  assertEqual(brief.nextActions.length, brief.criticalItems.length);
  brief.nextActions.forEach((action) => {
    const keys = Object.keys(action).sort();
    assertEqual(JSON.stringify(keys), JSON.stringify(["evidenceReferences", "rationale", "title"]), "nextAction só tem title/rationale/evidenceReferences -- nenhum campo de aggregate");
  });
});

// 12. Métricas sem recálculo indevido, sem confundir ausência com zero.
runTest("keyMetrics reflete valores já calculados pelo Engine, sem inventar métricas para o ramo failed", () => {
  const reconciledBrief = buildMeasurementDecisionBrief(buildInput(RECONCILED_FIXTURE));
  const officialMetric = reconciledBrief.keyMetrics.find((metric) => metric.label === "Valor oficial do período");
  assertTrue(officialMetric !== undefined);
  assertEqual(officialMetric!.value, new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(1000), "mesmo formatador usado pelo builder -- evita depender do caractere de espaço exato do Intl");

  const failedBrief = buildMeasurementDecisionBrief(buildInput(FAILED_TECHNICAL_FIXTURE));
  assertEqual(failedBrief.keyMetrics.length, 2, "só impedimentos/pontos de atenção -- failed não tem officialPeriodTotal/recalculatedTotal no tipo");
  assertTrue(
    failedBrief.keyMetrics.every((metric) => metric.label === "Impedimentos bloqueantes" || metric.label === "Pontos de atenção"),
    "nenhuma métrica financeira inventada para o ramo failed"
  );
});

// 13 e 14. Referências de origem, incluindo múltiplas colunas.
runTest("evidenceReferences aponta para a célula real, uma referência por coluna existente", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(MULTI_COLUMN_FIXTURE, { sourceImportId: "import-xyz" }));
  const mismatchItem = brief.criticalItems.find((item) => item.id.startsWith("official_period_total_mismatch"))!;

  assertEqual(mismatchItem.evidenceReferences.length, 2, "physicalColumn e financialColumn geram duas referências, nenhuma descartada");
  const columns = mismatchItem.evidenceReferences.map((ref) => ref.locator.column).sort();
  assertEqual(JSON.stringify(columns), JSON.stringify(["G", "H"]));
  mismatchItem.evidenceReferences.forEach((ref) => {
    assertEqual(ref.sourceType, "spreadsheet_cell");
    assertEqual(ref.sourceId, "import-xyz");
    assertEqual(ref.locator.sheetName, "BOLETIM DE MEDIÇÃO 08");
    assertEqual(ref.locator.row, 400);
  });

  const genericItem = brief.criticalItems.find((item) => item.id.startsWith("missing_quantity_and_value"))!;
  assertEqual(genericItem.evidenceReferences.length, 0, "issue sem sourceLocation não fabrica referência");
});

// 15. Ausência de fieldEvidenceId (garantia de typecheck -- ver nota em decision-brief.test.ts).
runTest("DecisionBriefSourceReference gerado só tem sourceType/sourceId/locator", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(NEEDS_REVIEW_FIXTURE));
  const reference = brief.criticalItems[0]!.evidenceReferences[0]!;
  const keys = Object.keys(reference).sort();
  assertEqual(JSON.stringify(keys), JSON.stringify(["locator", "sourceId", "sourceType"]), "nenhum fieldEvidenceId em runtime");
});

// 16. Ausência de criação de aggregates -- inspeção estrutural do brief inteiro.
runTest("nenhum campo do brief carrega id de Decision/Recommendation/ActionPlan/Action/ExecutionWorkflow/ExecutionTask", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(NEEDS_REVIEW_FIXTURE));
  const serialized = JSON.stringify(brief);
  ["decisionId", "recommendationId", "actionPlanId", "actionId", "executionWorkflowId", "executionTaskId"].forEach((forbiddenKey) => {
    assertTrue(!serialized.includes(forbiddenKey), `brief não deve conter a chave "${forbiddenKey}"`);
  });
});

// 17. Ausência de imports proibidos -- ver relatório (grep manual, sem novo Rule automatizado nesta Sprint).

// 18. Determinismo: mesma entrada produz exatamente a mesma saída.
runTest("mesma entrada produz exatamente a mesma saída (determinístico)", () => {
  const input = buildInput(NEEDS_REVIEW_FIXTURE);
  const first = buildMeasurementDecisionBrief(input);
  const second = buildMeasurementDecisionBrief(input);
  assertEqual(JSON.stringify(first), JSON.stringify(second));
});

// 19. Campos ausentes tratados corretamente (declaredBulletinNumber/declaredPeriod nulos).
runTest("declaredBulletinNumber e declaredPeriod nulos não quebram a situação, nunca viram texto inventado", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(FAILED_BLOCKING_FIXTURE));
  assertTrue(brief.situation.body.includes("sem número declarado"), "declaredBulletinNumber nulo é declarado, não omitido nem inventado");
});

// 20. Nenhuma conversão implícita de ausência em zero (reforça o teste 12 com outro ângulo).
runTest("failed nunca reporta officialPeriodTotal/recalculatedTotal como zero -- o campo simplesmente não existe no resultado", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(FAILED_TECHNICAL_FIXTURE));
  assertTrue(
    brief.keyMetrics.every((metric) => metric.label !== "Valor oficial do período" && metric.label !== "Valor recalculado"),
    "nenhuma métrica financeira com valor 0 disfarçado de dado real"
  );
});

// 21 (revisão pós-decisão do CPO). O builder devolve um DecisionBrief
// completo -- confidence é sempre "unavailable" nesta Sprint, nunca
// um score/level substituto.
runTest("buildMeasurementDecisionBrief devolve DecisionBrief completo, com confidence explicitamente unavailable", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(RECONCILED_FIXTURE));

  assertEqual(brief.confidence.status, "unavailable");
  if (brief.confidence.status !== "unavailable") return;
  assertEqual(brief.confidence.reason, "calculation_model_not_defined");

  const keys = Object.keys(brief.confidence).sort();
  assertEqual(JSON.stringify(keys), JSON.stringify(["reason", "status"]), "confidence unavailable só tem status/reason");
  assertTrue(!("score" in brief.confidence), "confidence.score não pode existir quando unavailable");
  assertTrue(!("level" in brief.confidence), "confidence.level não pode existir quando unavailable");
});

// 22. O resultado completo é serializável (JSON.stringify/parse round-trip sem perda).
runTest("o DecisionBrief completo é serializável sem perda", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(NEEDS_REVIEW_FIXTURE));
  const roundTrip = JSON.parse(JSON.stringify(brief));
  assertEqual(JSON.stringify(roundTrip), JSON.stringify(brief));
});

// 23. Intl.NumberFormat atua só na apresentação -- readiness/keyDecisions nunca dependem de nenhum valor formatado como string.
runTest("formatação monetária não influencia readiness nem keyDecisions -- só keyMetrics", () => {
  const brief = buildMeasurementDecisionBrief(buildInput(RECONCILED_FIXTURE));
  assertEqual(brief.executiveConclusion.readiness, "ready", "readiness vem de status/severity, nunca de um valor formatado");
  brief.keyMetrics.forEach((metric) => {
    assertEqual(typeof metric.value, "string", "keyMetrics.value é sempre string de apresentação, nunca reutilizada como número");
  });
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message ?? "esperava true, recebeu false");
  }
}
