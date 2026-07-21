import {
  REAL_SAMPLE_MANIFEST,
  REAL_SAMPLE_MANIFEST_STATUS,
  classifyRealSampleOutcome,
  computeRealSampleOutcomeTotals,
  countDefinitiveHumanLabels,
} from "./discovery-real-sample-manifest";

/**
 * Validação e totais determinísticos do manifesto de amostras reais
 * (Sprint 21.4B.3A, correção do commit `50bf42a`). Os totais NUNCA são
 * escritos à mão em Markdown — são sempre calculados aqui a partir dos
 * dados brutos do manifesto, exatamente para impedir a recorrência do
 * erro original (inconsistência da amostra R12/item 12, causada por
 * transcrição manual).
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

runTest("o manifesto se declara explicitamente como exploração pós-execução, nunca validação real pré-registrada", () => {
  assertEqual(REAL_SAMPLE_MANIFEST_STATUS, "post_execution_exploration");
});

runTest("o manifesto tem 14 amostras, cada uma com identidade única (página, lineKey)", () => {
  assertEqual(REAL_SAMPLE_MANIFEST.length, 14);
  const identities = REAL_SAMPLE_MANIFEST.map((s) => `${s.realPageNumber}:${s.lineKey}`);
  assertEqual(new Set(identities).size, identities.length, "há identidades (página, lineKey) duplicadas no manifesto");
  const ids = REAL_SAMPLE_MANIFEST.map((s) => s.sampleId);
  assertEqual(new Set(ids).size, ids.length, "há sampleId duplicados no manifesto");
});

runTest("cada amostra tem justificativa humana não vazia e lineKey plausível (hash hexadecimal)", () => {
  REAL_SAMPLE_MANIFEST.forEach((s) => {
    assert(s.humanJustificationPt.trim().length > 0, `${s.sampleId}: justificativa vazia`);
    assert(/^[0-9a-f]+$/.test(s.lineKey), `${s.sampleId}: lineKey não parece um hash hexadecimal`);
  });
});

runTest("quantidade de rótulos humanos definitivos (must_include/must_exclude, excluindo uncertain) é exatamente 13", () => {
  assertEqual(countDefinitiveHumanLabels(), 13);
});

runTest("classificação determinística: acerto quando decisão da candidata é igual ao rótulo humano definitivo", () => {
  assertEqual(classifyRealSampleOutcome("must_include", "must_include"), "acerto");
  assertEqual(classifyRealSampleOutcome("must_exclude", "must_exclude"), "acerto");
});

runTest("classificação determinística: falso_negativo/falso_positivo/evidencia_insuficiente/incerto nos quatro casos restantes", () => {
  assertEqual(classifyRealSampleOutcome("must_include", "must_exclude"), "falso_negativo");
  assertEqual(classifyRealSampleOutcome("must_exclude", "must_include"), "falso_positivo");
  assertEqual(classifyRealSampleOutcome("must_include", "insufficient_evidence"), "evidencia_insuficiente");
  assertEqual(classifyRealSampleOutcome("uncertain", "must_include"), "incerto");
  assertEqual(classifyRealSampleOutcome("uncertain", "insufficient_evidence"), "incerto");
});

runTest("totais de H3 (calculados, não transcritos à mão): 4 acerto, 8 falso_negativo, 0 falso_positivo, 1 evidencia_insuficiente, 1 incerto, total 14", () => {
  const totals = computeRealSampleOutcomeTotals("h3Decision");
  assertEqual(totals.acerto, 4, "H3: total de acertos mudou");
  assertEqual(totals.falso_negativo, 8, "H3: total de falsos negativos mudou");
  assertEqual(totals.falso_positivo, 0, "H3: não deveria haver falso positivo nesta amostra");
  assertEqual(totals.evidencia_insuficiente, 1, "H3: total de evidência insuficiente mudou");
  assertEqual(totals.incerto, 1, "H3: total de casos incertos mudou");
  assertEqual(totals.total, 14);
  assertEqual(
    totals.acerto + totals.falso_negativo + totals.falso_positivo + totals.evidencia_insuficiente + totals.nao_avaliado + totals.incerto,
    totals.total,
    "as categorias devem somar exatamente o total (nenhuma amostra pode ficar sem classificação)",
  );
});

runTest("totais de H3b (calculados, não transcritos à mão): 6 acerto, 6 falso_negativo, 0 falso_positivo, 1 evidencia_insuficiente, 1 incerto, total 14", () => {
  const totals = computeRealSampleOutcomeTotals("h3bDecision");
  assertEqual(totals.acerto, 6, "H3b: total de acertos mudou");
  assertEqual(totals.falso_negativo, 6, "H3b: total de falsos negativos mudou");
  assertEqual(totals.falso_positivo, 0, "H3b: não deveria haver falso positivo nesta amostra");
  assertEqual(totals.evidencia_insuficiente, 1, "H3b: total de evidência insuficiente mudou");
  assertEqual(totals.incerto, 1, "H3b: total de casos incertos mudou");
  assertEqual(totals.total, 14);
});

runTest("amostra R12 (achado da correção): H3 acerta (must_include) e H3b erra (falso_negativo) — nunca as duas coisas contraditórias do relatório original", () => {
  const r12 = REAL_SAMPLE_MANIFEST.find((s) => s.sampleId === "R12")!;
  assertEqual(r12.h3Decision, "must_include");
  assertEqual(classifyRealSampleOutcome(r12.humanLabel, r12.h3Decision), "acerto");
  assertEqual(r12.h3bDecision, "must_exclude");
  assertEqual(classifyRealSampleOutcome(r12.humanLabel, r12.h3bDecision), "falso_negativo");
});

runTest("nenhuma candidata produziu falso positivo real nesta amostra (H3 e H3b nunca incluíram incorretamente um elemento genuinamente externo)", () => {
  assertEqual(computeRealSampleOutcomeTotals("h3Decision").falso_positivo, 0);
  assertEqual(computeRealSampleOutcomeTotals("h3bDecision").falso_positivo, 0);
});
