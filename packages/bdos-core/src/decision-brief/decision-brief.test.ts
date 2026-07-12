import {
  DECISION_BRIEF_READINESS_VALUES,
  DECISION_BRIEF_SCHEMA_VERSION,
  type DecisionBrief,
  type DecisionBriefReadiness,
  type DecisionBriefSourceReference,
} from "./index";

// Epic 20 (Decision Experience), Sprint 20.1A -- primeiro contrato
// puramente genérico do bdos-core, sem builder próprio ainda (chega
// na 20.1B). Não há precedente no repo de um `.types.ts` com `.test.ts`
// próprio (tipos normalmente só são exercitados pelo teste do
// builder/validator que os consome) -- este arquivo existe porque o
// desenho aprovado (EPIC_20_SPRINT_1_MEASUREMENT_DECISION_BRIEF_DESIGN.md,
// Parte IX) pediu testes determinísticos do contrato antes de
// qualquer builder existir. Cobre construção válida, versionamento
// independente, o localizador spreadsheet_cell e os exports do
// barrel -- nunca lógica de negócio, porque este módulo não tem
// nenhuma.
//
// Limite conhecido: `pnpm test` roda via `tsx` (sem type-checking).
// Garantias puramente estruturais -- como "DecisionBriefSourceReference
// não aceita fieldEvidenceId" -- só são reais via `pnpm typecheck`
// (excess property check do TypeScript), não por nenhuma assertion
// em runtime neste arquivo. Marcado explicitamente onde isso se
// aplica, para não fingir uma garantia que o teste não sustenta.

const sampleSourceReferenceWithColumn: DecisionBriefSourceReference = {
  sourceType: "spreadsheet_cell",
  sourceId: "import-1",
  locator: { sheetName: "BOLETIM DE MEDIÇÃO 08", row: 347, column: "H" }
};

const sampleSourceReferenceWithoutColumn: DecisionBriefSourceReference = {
  sourceType: "spreadsheet_cell",
  sourceId: "import-1",
  locator: { sheetName: "BOLETIM DE MEDIÇÃO 08", row: 12 }
};

function buildSampleDecisionBrief(overrides?: { readonly schemaVersion?: string; readonly builderVersion?: string; readonly sourceImportId?: string }): DecisionBrief {
  return {
    metadata: {
      schemaVersion: overrides?.schemaVersion ?? DECISION_BRIEF_SCHEMA_VERSION,
      builderVersion: overrides?.builderVersion ?? "sample-builder-v0",
      sourceImportId: overrides?.sourceImportId ?? "import-1",
      generatedAt: "2026-07-13T00:00:00.000Z"
    },
    situation: { title: "Situação", body: "Boletim 08, período 01/06 a 30/06/2026." },
    executiveConclusion: {
      readiness: "ready_with_reservations",
      headline: "Consistente, com pontos de atenção.",
      body: "O valor recalculado bate com o oficial; há itens estruturais a revisar."
    },
    keyDecisions: [{ label: "Enviar para revisão final", recommended: true, rationale: "Nenhum impedimento bloqueante encontrado." }],
    criticalItems: [
      {
        id: "issue-1",
        severity: "warning",
        title: "Linha com dado parcial",
        body: "Código ou nome ausente na aba de origem.",
        consequenceIfAddressed: "Reduz risco de retrabalho na conferência.",
        consequenceIfIgnored: null,
        evidenceReferences: [sampleSourceReferenceWithColumn]
      }
    ],
    keyMetrics: [{ label: "Valor recalculado", value: "R$ 252.654,78" }],
    details: { title: "Detalhamento", body: "15 linhas medidas, 336 WorkPackages, 300 ManagedServiceItems." },
    nextActions: [
      {
        title: "Revisar coluna residual na aba de origem",
        rationale: "Coluna sem cabeçalho reconhecido, não utilizada na extração.",
        evidenceReferences: [sampleSourceReferenceWithoutColumn]
      }
    ],
    evidenceReferences: [sampleSourceReferenceWithColumn, sampleSourceReferenceWithoutColumn],
    confidence: {
      score: 82,
      level: "attention",
      label: "Confiança alta, com ressalvas",
      factors: [{ label: "Impedimentos bloqueantes", penalty: 0, available: true, unavailableReason: null }]
    }
  };
}

runTest("um DecisionBrief válido pode ser construído satisfazendo o contrato completo", () => {
  const brief = buildSampleDecisionBrief();

  assertEqual(brief.executiveConclusion.readiness, "ready_with_reservations", "readiness preservada");
  assertEqual(brief.criticalItems.length, 1, "1 item crítico");
  assertEqual(brief.nextActions.length, 1, "1 next action");
});

runTest("schemaVersion e builderVersion são independentes -- mudar um nunca implica o outro", () => {
  const briefA = buildSampleDecisionBrief({ schemaVersion: "1.0", builderVersion: "measurement-decision-brief-v1" });
  const briefB = buildSampleDecisionBrief({ schemaVersion: "1.0", builderVersion: "measurement-decision-brief-v2" });

  assertEqual(briefA.metadata.schemaVersion, briefB.metadata.schemaVersion, "schema igual entre v1 e v2 do builder");
  assertTrue(briefA.metadata.builderVersion !== briefB.metadata.builderVersion, "builderVersion diverge sem tocar o schema");
});

runTest("DECISION_BRIEF_SCHEMA_VERSION é a versão estrutural do contrato, string, não number", () => {
  assertEqual(DECISION_BRIEF_SCHEMA_VERSION, "1.0", "versão estrutural atual");
  assertEqual(typeof DECISION_BRIEF_SCHEMA_VERSION, "string", "schemaVersion é string, não number -- achado 3 da auditoria dirigida");
});

runTest("metadata.sourceImportId identifica o snapshot técnico de origem", () => {
  const brief = buildSampleDecisionBrief({ sourceImportId: "measurement-bulletin-import-abc" });

  assertEqual(brief.metadata.sourceImportId, "measurement-bulletin-import-abc", "sourceImportId preservado");
});

runTest("DECISION_BRIEF_READINESS_VALUES enumera exatamente os 4 valores aprovados, nenhum com semântica de aprovação", () => {
  assertEqual(DECISION_BRIEF_READINESS_VALUES.length, 4, "4 valores de readiness");
  (["ready", "ready_with_reservations", "not_ready", "inconclusive"] as ReadonlyArray<DecisionBriefReadiness>).forEach((value) => {
    assertTrue(DECISION_BRIEF_READINESS_VALUES.includes(value), `readiness inclui "${value}"`);
  });
  assertTrue(!DECISION_BRIEF_READINESS_VALUES.some((value) => value.includes("approve") || value.includes("approved") || value.includes("certified")), "nenhum valor carrega semântica de aprovação/certificação");
});

runTest("DecisionBriefSourceReference (spreadsheet_cell) é um localizador -- sourceId + locator, coluna opcional", () => {
  assertEqual(sampleSourceReferenceWithColumn.sourceType, "spreadsheet_cell", "único sourceType desta Sprint");
  assertEqual(sampleSourceReferenceWithColumn.sourceId, "import-1", "sourceId identifica o artefato imutável");
  assertEqual(sampleSourceReferenceWithColumn.locator.sheetName, "BOLETIM DE MEDIÇÃO 08", "locator.sheetName preservado");
  assertEqual(sampleSourceReferenceWithColumn.locator.row, 347, "locator.row preservado");
  assertEqual(sampleSourceReferenceWithColumn.locator.column, "H", "locator.column preservado quando informado");
  assertEqual(sampleSourceReferenceWithoutColumn.locator.column, undefined, "locator.column é opcional -- ausente é válido");
});

runTest("DecisionBriefSourceReference não depende de fieldEvidenceId (garantia de typecheck, ver nota de topo)", () => {
  const keys = Object.keys(sampleSourceReferenceWithColumn.locator);
  assertTrue(!keys.includes("fieldEvidenceId"), "locator não carrega fieldEvidenceId em runtime");
  // A ausência estrutural de fieldEvidenceId no TIPO (nunca poder ser
  // atribuído) é garantida por `pnpm typecheck` (excess property
  // check), não por esta assertion -- ver comentário de topo do
  // arquivo.
});

runTest("barrel index.ts expõe os símbolos públicos esperados", () => {
  assertEqual(typeof DECISION_BRIEF_SCHEMA_VERSION, "string", "DECISION_BRIEF_SCHEMA_VERSION exportado pelo barrel");
  assertTrue(Array.isArray(DECISION_BRIEF_READINESS_VALUES), "DECISION_BRIEF_READINESS_VALUES exportado pelo barrel");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}
