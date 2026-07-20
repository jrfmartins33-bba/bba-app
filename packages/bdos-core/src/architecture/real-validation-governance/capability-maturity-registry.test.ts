import { CAPABILITY_MATURITY_REGISTRY } from "./capability-maturity-registry";
import {
  isTerminalMaturityLevel,
  PERMITTED_LEVEL_RESULT_COMBINATIONS,
  REAL_VALIDATION_MATURITY_LEVELS,
  ROLE_NOT_FORMALIZED,
  VALIDATION_RESULTS,
} from "./real-validation-maturity.types";
import type { CapabilityMaturityIssue, CapabilityMaturityRecord } from "./real-validation-maturity.types";

/**
 * Guarda automatizado da Sprint 21.4G — valida exclusivamente a
 * ESTRUTURA do registro (o registro estruturado é a fonte atual de
 * maturidade), nunca um scanner textual da prosa de documentação por
 * palavras como "concluído" ou "validado".
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(actual: boolean, message: string): void {
  if (!actual) {
    throw new Error(message);
  }
}

/** Padrões estruturais suspeitos de caminho local — nunca uma checagem por conteúdo real, apenas pela FORMA do texto registrado. */
const SUSPICIOUS_LOCAL_PATH_PATTERNS: ReadonlyArray<RegExp> = [
  /_local-documents/i,
  /^[a-zA-Z]:[\\/]/, // unidade Windows, ex.: "C:\" ou "C:/"
  /\.pdf$/i,
  /\.xlsx?$/i,
  /[\\/]{2,}/, // caminho com múltiplas barras consecutivas
];

function containsSuspiciousLocalPath(value: string): boolean {
  return SUSPICIOUS_LOCAL_PATH_PATTERNS.some((pattern) => pattern.test(value));
}

const NO_KNOWN_FAILURE_MARKER = "nenhuma";

function collectIssues(registry: ReadonlyArray<CapabilityMaturityRecord>): ReadonlyArray<CapabilityMaturityIssue> {
  const issues: CapabilityMaturityIssue[] = [];
  const seenIds = new Set<string>();

  for (const record of registry) {
    // 1. identificadores únicos
    if (seenIds.has(record.id)) {
      issues.push({ code: "duplicate_id", recordId: record.id, message: `identificador duplicado: ${record.id}` });
    }
    seenIds.add(record.id);

    // 2. níveis de evidência reconhecidos
    if (!(REAL_VALIDATION_MATURITY_LEVELS as ReadonlyArray<string>).includes(record.currentLevel)) {
      issues.push({ code: "unrecognized_level", recordId: record.id, message: `nível não reconhecido: ${record.currentLevel}` });
    }

    // 3. resultados reconhecidos
    if (!(VALIDATION_RESULTS as ReadonlyArray<string>).includes(record.currentResult)) {
      issues.push({ code: "unrecognized_result", recordId: record.id, message: `resultado não reconhecido: ${record.currentResult}` });
    }

    // combinação (nível, resultado) permitida
    const permitted = PERMITTED_LEVEL_RESULT_COMBINATIONS[record.currentLevel];
    if (permitted && !permitted.includes(record.currentResult)) {
      issues.push({
        code: "disallowed_level_result_combination",
        recordId: record.id,
        message: `combinação não permitida: nível=${record.currentLevel}, resultado=${record.currentResult}`,
      });
    }

    // 5. toda reprovação possui falhas conhecidas
    if (record.currentResult === "reprovada" && record.knownFailuresPt.length === 0) {
      issues.push({ code: "reprovada_without_known_failures", recordId: record.id, message: "resultado reprovada sem falhas conhecidas registradas" });
    }

    // 6. toda inconclusão possui causa (e nenhuma causa fora de inconclusiva)
    if (record.currentResult === "inconclusiva" && (record.inconclusiveCausePt === null || record.inconclusiveCausePt.trim().length === 0)) {
      issues.push({ code: "missing_inconclusive_cause", recordId: record.id, message: "resultado inconclusiva sem inconclusiveCausePt" });
    }
    if (record.currentResult !== "inconclusiva" && record.inconclusiveCausePt !== null) {
      issues.push({ code: "unexpected_inconclusive_cause", recordId: record.id, message: "inconclusiveCausePt preenchido fora de resultado inconclusiva" });
    }

    // 7/8. validação real/adversarial aprovada exige evidência real/adversarial
    const requiresRealEvidence = record.currentLevel !== "experimental" && record.currentLevel !== "validada_sinteticamente";
    if (requiresRealEvidence && record.realEvidence === null) {
      issues.push({ code: "missing_real_evidence", recordId: record.id, message: "nível exige realEvidence, mas está null" });
    }
    if (record.currentLevel === "validada_adversarialmente" && record.adversarialEvidence === null) {
      issues.push({ code: "missing_adversarial_evidence", recordId: record.id, message: "'validada_adversarialmente' exige adversarialEvidence" });
    }

    if (record.knownLimitationsPt.length === 0) {
      issues.push({ code: "missing_limitations_declaration", recordId: record.id, message: "knownLimitationsPt vazio — declare ao menos a ausência explícita" });
    }

    if (!isTerminalMaturityLevel(record.currentLevel) && (record.promotionConditionPt === null || record.promotionConditionPt.trim().length === 0)) {
      issues.push({ code: "missing_promotion_condition", recordId: record.id, message: "nível não terminal exige promotionConditionPt" });
    }

    // 9. portões possuem consumidor e finalidade; evidência faltante quando não aberto
    for (const gate of record.downstreamGates) {
      if (gate.consumerId.trim().length === 0 || gate.purposePt.trim().length === 0) {
        issues.push({ code: "gate_missing_consumer_or_purpose", recordId: record.id, message: `portão sem consumidor/finalidade: ${JSON.stringify(gate)}` });
      }
      if (gate.status !== "aberto" && (gate.missingEvidencePt === null || gate.missingEvidencePt.trim().length === 0)) {
        issues.push({ code: "gate_missing_evidence_when_not_open", recordId: record.id, message: `portão não aberto sem evidência faltante declarada: ${JSON.stringify(gate)}` });
      }
    }

    // 10. capacidade com reprovação upstream (esta própria) não libera consumo produtivo/econômico
    if (record.currentResult === "reprovada") {
      for (const gate of record.downstreamGates) {
        const purposeLower = gate.purposePt.toLowerCase();
        const isProductiveOrEconomicPurpose = purposeLower.includes("econôm") || purposeLower.includes("produtiv") || purposeLower.includes("validad");
        if (isProductiveOrEconomicPurpose && gate.status === "aberto") {
          issues.push({
            code: "gate_open_for_blocked_upstream_purpose",
            recordId: record.id,
            message: `capacidade reprovada não pode ter portão aberto para finalidade produtiva/econômica: ${JSON.stringify(gate)}`,
          });
        }
      }
    }

    // 11. histórico existe
    if (record.evaluationHistory.length === 0) {
      issues.push({ code: "missing_evaluation_history", recordId: record.id, message: "evaluationHistory vazio" });
    }

    // 12. avaliações possuem identificação de papéis
    for (const entry of record.evaluationHistory) {
      if (entry.implementer.trim().length === 0 || entry.adversarialReviewer.trim().length === 0 || entry.approver.trim().length === 0) {
        issues.push({ code: "history_entry_missing_roles", recordId: record.id, message: `entrada de histórico sem papéis identificados: ${entry.evaluationId}` });
      }
    }

    if (record.realEvidence !== null) {
      // 14. fingerprints não vazios
      if (record.realEvidence.sourceFingerprintSha256.trim().length === 0) {
        issues.push({ code: "missing_fingerprint", recordId: record.id, message: "realEvidence sem fingerprint" });
      }
      if (record.realEvidence.expectedResult.trim().length === 0 || record.realEvidence.observedResult.trim().length === 0) {
        issues.push({ code: "missing_expected_or_observed_result", recordId: record.id, message: "realEvidence sem resultado esperado e/ou observado" });
      }
      // 13. nenhuma evidência real contém caminho local
      const fieldsToScan = [record.realEvidence.pageOrTraceRange, record.realEvidence.reportReference, record.realEvidence.expectedResult, record.realEvidence.observedResult];
      for (const field of fieldsToScan) {
        if (containsSuspiciousLocalPath(field)) {
          issues.push({ code: "suspicious_local_path_in_evidence", recordId: record.id, message: `campo de evidência real contém padrão de caminho local suspeito: "${field}"` });
        }
      }
    }

    if (record.currentLevel === "validada_em_caso_real" || record.currentLevel === "validada_adversarialmente") {
      if (record.realEvidence === null || record.realEvidence.expectedResult.trim().length === 0 || record.realEvidence.observedResult.trim().length === 0) {
        issues.push({ code: "missing_expected_or_observed_result", recordId: record.id, message: `${record.currentLevel} exige resultado esperado e observado completos` });
      }
    }

    // 20. nenhum teste de caracterização apresentado como aceitação: se aprovada, knownFailuresPt não pode conter uma falha real (só a declaração-padrão de ausência)
    if (record.currentResult === "aprovada" && record.knownFailuresPt.some((failure) => !failure.toLowerCase().includes(NO_KNOWN_FAILURE_MARKER))) {
      issues.push({ code: "aprovada_with_known_failure", recordId: record.id, message: "resultado aprovada mas knownFailuresPt contém uma falha real, não apenas a declaração de ausência" });
    }
  }

  return issues;
}

function issuesOfCode(code: CapabilityMaturityIssue["code"]): ReadonlyArray<CapabilityMaturityIssue> {
  return collectIssues(CAPABILITY_MATURITY_REGISTRY).filter((issue) => issue.code === code);
}

runTest("o registro não está vazio e cobre f.0 a g.3 mais a caracterização econômica", () => {
  assertTrue(CAPABILITY_MATURITY_REGISTRY.length >= 9, `esperado >= 9 capacidades, obteve ${CAPABILITY_MATURITY_REGISTRY.length}`);
});

runTest("nenhum identificador duplicado", () => assertEqual(issuesOfCode("duplicate_id").length, 0));
runTest("nenhum nível não reconhecido", () => assertEqual(issuesOfCode("unrecognized_level").length, 0));
runTest("nenhum resultado não reconhecido", () => assertEqual(issuesOfCode("unrecognized_result").length, 0));
runTest("nenhuma combinação (nível, resultado) fora das permitidas", () => assertEqual(issuesOfCode("disallowed_level_result_combination").length, 0, JSON.stringify(issuesOfCode("disallowed_level_result_combination"))));
runTest("'reprovada' nunca aparece como nível de evidência (apenas como resultado)", () => {
  assertTrue(!(REAL_VALIDATION_MATURITY_LEVELS as ReadonlyArray<string>).some((level) => level.includes("reprovada")), "nenhum nível deve conter 'reprovada' — é um resultado, não um nível");
});
runTest("toda reprovação possui falhas conhecidas", () => assertEqual(issuesOfCode("reprovada_without_known_failures").length, 0));
runTest("toda inconclusão possui causa registrada", () => assertEqual(issuesOfCode("missing_inconclusive_cause").length, 0));
runTest("nenhuma causa de inconclusão fora de resultado inconclusiva", () => assertEqual(issuesOfCode("unexpected_inconclusive_cause").length, 0));
runTest("validação real exige evidência real quando o nível o requer", () => assertEqual(issuesOfCode("missing_real_evidence").length, 0));
runTest("'validada_adversarialmente' sempre exige evidência adversarial", () => assertEqual(issuesOfCode("missing_adversarial_evidence").length, 0));
runTest("toda capacidade declara limitações, mesmo que para afirmar ausência explícita", () => assertEqual(issuesOfCode("missing_limitations_declaration").length, 0));
runTest("todo nível não terminal exige condição de promoção", () => assertEqual(issuesOfCode("missing_promotion_condition").length, 0));
runTest("todo portão possui consumidor e finalidade", () => assertEqual(issuesOfCode("gate_missing_consumer_or_purpose").length, 0));
runTest("todo portão não aberto declara evidência faltante", () => assertEqual(issuesOfCode("gate_missing_evidence_when_not_open").length, 0));
runTest("capacidade com reprovação upstream não libera consumo produtivo/econômico", () => assertEqual(issuesOfCode("gate_open_for_blocked_upstream_purpose").length, 0, JSON.stringify(issuesOfCode("gate_open_for_blocked_upstream_purpose"))));
runTest("histórico de avaliação existe para toda capacidade já avaliada", () => assertEqual(issuesOfCode("missing_evaluation_history").length, 0));
runTest("toda entrada de histórico identifica os três papéis", () => assertEqual(issuesOfCode("history_entry_missing_roles").length, 0));
runTest("nenhuma evidência real contém fingerprint vazio", () => assertEqual(issuesOfCode("missing_fingerprint").length, 0));
runTest("nenhuma evidência real omite resultado esperado ou observado", () => assertEqual(issuesOfCode("missing_expected_or_observed_result").length, 0));
runTest("nenhum campo de evidência real contém padrão de caminho local suspeito", () => assertEqual(issuesOfCode("suspicious_local_path_in_evidence").length, 0));
runTest("nenhum resultado 'aprovada' esconde uma falha conhecida real (caracterização não é aceitação)", () => assertEqual(issuesOfCode("aprovada_with_known_failure").length, 0));

runTest("f.2a está corretamente classificada: nível caracterizada_em_caso_real, resultado reprovada, com falhas explícitas", () => {
  const f2a = CAPABILITY_MATURITY_REGISTRY.find((record) => record.id === "f2a-tabular-region-detection");
  assertTrue(f2a !== undefined, "registro de f.2a deve existir");
  assertEqual(f2a!.currentLevel, "caracterizada_em_caso_real");
  assertEqual(f2a!.currentResult, "reprovada");
  assertTrue(f2a!.knownFailuresPt.length > 0, "f.2a deve ter ao menos uma falha conhecida registrada");
  assertTrue(
    f2a!.downstreamGates.some((gate) => gate.consumerId === "econ-budget-document-economic-characterization" && gate.status === "bloqueado"),
    "f.2a deve bloquear o portão de consumo econômico",
  );
});

runTest("a caracterização econômica (21.4B) está: nível caracterizada_em_caso_real, resultado reprovada, portão de rascunho bloqueado", () => {
  const econ = CAPABILITY_MATURITY_REGISTRY.find((record) => record.id === "econ-budget-document-economic-characterization");
  assertTrue(econ !== undefined, "registro da caracterização econômica deve existir");
  assertEqual(econ!.currentLevel, "caracterizada_em_caso_real");
  assertEqual(econ!.currentResult, "reprovada");
  assertTrue(econ!.downstreamGates.every((gate) => gate.status !== "aberto"), "nenhum portão da caracterização econômica pode estar aberto");
});

runTest("f.2b a g.3 estão todas inconclusivas por entrada degradada upstream", () => {
  const ids = [
    "f2b-physical-column-hypothesis-reconstruction",
    "f2c-physical-cell-hypothesis-formation",
    "g1-physical-cell-text-evidence-formation",
    "g2-page-local-neutral-structured-evidence-formation",
    "g3-page-boundary-neutral-continuity-evaluation",
  ];
  for (const id of ids) {
    const record = CAPABILITY_MATURITY_REGISTRY.find((r) => r.id === id);
    assertTrue(record !== undefined, `registro ${id} deve existir`);
    assertEqual(record!.currentLevel, "caracterizada_em_caso_real", `${id} deve estar em caracterizada_em_caso_real`);
    assertEqual(record!.currentResult, "inconclusiva", `${id} deve estar inconclusiva`);
    assertTrue(record!.inconclusiveCausePt !== null && record!.inconclusiveCausePt.length > 0, `${id} deve declarar a causa da inconclusão`);
  }
});

runTest("nenhum defeito real conhecido é omitido para as capacidades já investigadas na cadeia real", () => {
  const investigated = ["f0-normalized-text-item-geometry", "f1-structure-reconstruction", "f2a-tabular-region-detection"];
  for (const id of investigated) {
    const record = CAPABILITY_MATURITY_REGISTRY.find((r) => r.id === id);
    assertTrue(record !== undefined, `registro ${id} deve existir`);
    assertTrue(record!.knownFailuresPt.length > 0, `${id} deve declarar explicitamente falhas conhecidas ou sua ausência`);
  }
});

runTest("nenhum papel de aprovador humano é apresentado como já formalizado nesta rodada", () => {
  for (const record of CAPABILITY_MATURITY_REGISTRY) {
    for (const entry of record.evaluationHistory) {
      assertEqual(entry.approver, ROLE_NOT_FORMALIZED, `${record.id}/${entry.evaluationId}: aprovação humana final ainda não pode estar formalizada`);
    }
  }
});
