import { H3C_REAL_MANIFEST } from "./discovery-h3c-real-manifest";
import { H3C_REAL_MANIFEST_PAGE_RANGE } from "./discovery-h3c-real-manifest.types";
import type { H3cRealManifestEntry } from "./discovery-h3c-real-manifest.types";

/**
 * Testes de integridade do manifesto real pré-registrado (Sprint
 * 21.4B.3A.1, §9.3 do enunciado). Executados ANTES de qualquer aprovação
 * humana e ANTES de qualquer implementação de H3c. Nenhum destes testes
 * avalia H3c — apenas a estrutura, cobertura e ausência de contaminação
 * do próprio manifesto.
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

runTest("o manifesto cobre exatamente as páginas reais 46-54, nenhuma outra", () => {
  const pages = new Set(H3C_REAL_MANIFEST.map((e) => e.realPageNumber));
  const expected = new Set<number>();
  for (let p = H3C_REAL_MANIFEST_PAGE_RANGE.start; p <= H3C_REAL_MANIFEST_PAGE_RANGE.end; p += 1) expected.add(p);
  assertEqual(pages.size, expected.size, "quantidade de páginas distintas incorreta");
  expected.forEach((p) => assert(pages.has(p), `página real ${p} ausente do manifesto`));
  pages.forEach((p) => assert(expected.has(p), `página real ${p} não pertence ao intervalo 46-54`));
});

runTest("ausência de duplicidade de (realPageNumber, lineKey)", () => {
  const identities = H3C_REAL_MANIFEST.map((e) => `${e.realPageNumber}:${e.lineKey}`);
  assertEqual(new Set(identities).size, identities.length, "há identidades (página, lineKey) duplicadas");
});

runTest("ausência de duplicidade de id", () => {
  const ids = H3C_REAL_MANIFEST.map((e) => e.id);
  assertEqual(new Set(ids).size, ids.length, "há ids duplicados");
});

runTest("todos os registros possuem justificativa (rationalePt) não vazia", () => {
  H3C_REAL_MANIFEST.forEach((e) => {
    assert(e.rationalePt.trim().length > 0, `${e.id}: rationalePt vazia`);
  });
});

runTest("todos os registros possuem ao menos uma etiqueta de cobertura", () => {
  H3C_REAL_MANIFEST.forEach((e) => {
    assert(e.coverageTags.length > 0, `${e.id}: nenhuma etiqueta de cobertura`);
  });
});

runTest("nenhum registro possui campo de resultado de candidata (H0-H4/H3b/H3c) — apenas os campos do schema, incluindo annotationRuleId", () => {
  const allowedKeys = new Set(["id", "realPageNumber", "lineKey", "verticalOrder", "textLocatorForHumanAudit", "label", "annotationRuleId", "rationalePt", "coverageTags", "annotationStatus"]);
  H3C_REAL_MANIFEST.forEach((e) => {
    Object.keys(e as unknown as Record<string, unknown>).forEach((key) => {
      assert(allowedKeys.has(key), `${e.id}: campo inesperado "${key}" — possível vazamento de resultado de candidata`);
    });
  });
});

runTest("todos os registros possuem annotationRuleId não vazio (proveniência auditável da regra que propôs o rótulo)", () => {
  H3C_REAL_MANIFEST.forEach((e) => {
    assert(e.annotationRuleId.trim().length > 0, `${e.id}: annotationRuleId vazio`);
  });
});

runTest("manifesto é ESTÁTICO: os mesmos dados literais produzem os mesmos totais em execuções repetidas (nenhuma regra reexecutada em tempo de avaliação)", () => {
  const first = H3C_REAL_MANIFEST.map((e) => `${e.id}:${e.label}`).join("|");
  const second = H3C_REAL_MANIFEST.map((e) => `${e.id}:${e.label}`).join("|");
  assertEqual(first, second, "rótulos mudaram entre duas leituras do mesmo array — manifesto não é estático");
});

runTest("nenhum registro contém constante da implementação de H3c (ex.: H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO, valores de tolerância) no texto ou justificativa", () => {
  const forbiddenSubstrings = ["H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO", "must_include\":", "candidateH3c", "H3cEnvelope"];
  H3C_REAL_MANIFEST.forEach((e) => {
    forbiddenSubstrings.forEach((s) => {
      assert(!e.rationalePt.includes(s), `${e.id}: justificativa contém referência à implementação de H3c ("${s}")`);
      assert(!e.textLocatorForHumanAudit.includes(s), `${e.id}: texto de origem contém referência à implementação de H3c ("${s}")`);
    });
  });
});

runTest("existência de ao menos uma continuação larga legítima (legitimate_wide_continuation)", () => {
  const count = H3C_REAL_MANIFEST.filter((e) => e.coverageTags.includes("legitimate_wide_continuation")).length;
  assert(count > 0, "nenhuma entrada com etiqueta legitimate_wide_continuation");
});

runTest("existência de ao menos um elemento externo adversarial (external_adversarial_element)", () => {
  const count = H3C_REAL_MANIFEST.filter((e) => e.coverageTags.includes("external_adversarial_element")).length;
  assert(count > 0, "nenhuma entrada com etiqueta external_adversarial_element");
});

runTest("existência de ao menos um caso de evidência física insuficiente (insufficient_physical_evidence)", () => {
  const count = H3C_REAL_MANIFEST.filter((e) => e.coverageTags.includes("insufficient_physical_evidence")).length;
  assert(count > 0, "nenhuma entrada com etiqueta insufficient_physical_evidence");
});

runTest("existência de linhas tabulares convencionais e de cabeçalho/rodapé externo", () => {
  assert(H3C_REAL_MANIFEST.some((e) => e.coverageTags.includes("conventional_tabular_line")), "nenhuma entrada conventional_tabular_line");
  assert(H3C_REAL_MANIFEST.some((e) => e.coverageTags.includes("external_header_footer_or_note")), "nenhuma entrada external_header_footer_or_note");
});

runTest("texto de origem usado somente como localização de auditoria — nunca vazio para nenhuma entrada", () => {
  H3C_REAL_MANIFEST.forEach((e) => {
    assert(e.textLocatorForHumanAudit.length > 0, `${e.id}: textLocatorForHumanAudit vazio`);
  });
});

runTest("ordenação canônica por página, verticalOrder e lineKey — o array já está nessa ordem", () => {
  for (let i = 1; i < H3C_REAL_MANIFEST.length; i += 1) {
    const prev = H3C_REAL_MANIFEST[i - 1];
    const curr = H3C_REAL_MANIFEST[i];
    const prevKey: [number, number, string] = [prev.realPageNumber, prev.verticalOrder, prev.lineKey];
    const currKey: [number, number, string] = [curr.realPageNumber, curr.verticalOrder, curr.lineKey];
    const cmp = prevKey[0] - currKey[0] || prevKey[1] - currKey[1] || prevKey[2].localeCompare(currKey[2]);
    assert(cmp < 0, `manifesto fora de ordem canônica entre ${prev.id} e ${curr.id}`);
  }
});

runTest("todos os registros têm annotationStatus=human_approved (aprovação humana expressa de Ricardo, com as duas correções aplicadas)", () => {
  H3C_REAL_MANIFEST.forEach((e) => {
    assertEqual(e.annotationStatus, "human_approved", `${e.id}: annotationStatus deveria ser human_approved após a aprovação`);
  });
});

runTest("as duas correções da aprovação humana foram aplicadas exatamente: p54-v027 = must_include, p52-v079 = uncertain", () => {
  const totalGeral = H3C_REAL_MANIFEST.find((e) => e.id === "p54-v027");
  assert(totalGeral !== undefined, "p54-v027 não encontrado");
  assertEqual(totalGeral!.label, "must_include", "p54-v027 deveria ser must_include após a correção de Ricardo");
  assertEqual(totalGeral!.annotationRuleId, "total_geral");

  const hybrid = H3C_REAL_MANIFEST.find((e) => e.id === "p52-v079");
  assert(hybrid !== undefined, "p52-v079 não encontrado");
  assertEqual(hybrid!.label, "uncertain", "p52-v079 deveria permanecer uncertain");
  assertEqual(hybrid!.annotationRuleId, "hybrid_merge_artifact");
  assert(hybrid!.coverageTags.includes("insufficient_physical_evidence"), "p52-v079 deveria ter a etiqueta insufficient_physical_evidence");
});

runTest("total de linhas por página calculado deterministicamente (nunca transcrito à mão)", () => {
  const byPage = new Map<number, number>();
  H3C_REAL_MANIFEST.forEach((e) => byPage.set(e.realPageNumber, (byPage.get(e.realPageNumber) ?? 0) + 1));
  const expected: Record<number, number> = { 46: 73, 47: 80, 48: 77, 49: 79, 50: 80, 51: 83, 52: 84, 53: 81, 54: 33 };
  Object.entries(expected).forEach(([page, count]) => {
    assertEqual(byPage.get(Number(page)), count, `página ${page}: total de linhas mudou`);
  });
  assertEqual(H3C_REAL_MANIFEST.length, 670, "total geral de linhas do manifesto mudou");
});

runTest("totais por rótulo calculados deterministicamente (congelados após aprovação humana): 563 must_include, 106 must_exclude, 1 uncertain", () => {
  const totals: Record<H3cRealManifestEntry["label"], number> = { must_include: 0, must_exclude: 0, uncertain: 0 };
  H3C_REAL_MANIFEST.forEach((e) => { totals[e.label] += 1; });
  assertEqual(totals.must_include, 563);
  assertEqual(totals.must_exclude, 106);
  assertEqual(totals.uncertain, 1);
  assertEqual(totals.must_include + totals.must_exclude + totals.uncertain, H3C_REAL_MANIFEST.length);
});

runTest("totais por annotationRuleId reconciliam automaticamente com os totais por rótulo (tabela de regras do pré-registro, §13)", () => {
  const byRule = new Map<string, { label: H3cRealManifestEntry["label"]; count: number }>();
  H3C_REAL_MANIFEST.forEach((e) => {
    const existing = byRule.get(e.annotationRuleId);
    if (existing) {
      assertEqual(existing.label, e.label, `regra "${e.annotationRuleId}" produz rótulos inconsistentes entre entradas — cada regra deve mapear para um único rótulo`);
      existing.count += 1;
    } else {
      byRule.set(e.annotationRuleId, { label: e.label, count: 1 });
    }
  });

  const expectedByRule: Record<string, { label: H3cRealManifestEntry["label"]; count: number }> = {
    title_block: { label: "must_exclude", count: 45 },
    column_caption_header: { label: "must_include", count: 18 },
    group_header: { label: "must_include", count: 27 },
    item_row: { label: "must_include", count: 300 },
    continuation: { label: "must_include", count: 217 },
    citation_note_external: { label: "must_exclude", count: 8 },
    footer: { label: "must_exclude", count: 53 },
    hybrid_merge_artifact: { label: "uncertain", count: 1 },
    total_geral: { label: "must_include", count: 1 },
  };

  assertEqual(byRule.size, Object.keys(expectedByRule).length, "quantidade de regras distintas mudou");
  Object.entries(expectedByRule).forEach(([ruleId, expected]) => {
    const actual = byRule.get(ruleId);
    assert(actual !== undefined, `regra "${ruleId}" ausente do manifesto`);
    assertEqual(actual!.label, expected.label, `regra "${ruleId}": rótulo mudou`);
    assertEqual(actual!.count, expected.count, `regra "${ruleId}": contagem mudou`);
  });

  const totalFromRules = [...byRule.values()].reduce((sum, r) => sum + r.count, 0);
  assertEqual(totalFromRules, H3C_REAL_MANIFEST.length, "soma das regras não reconcilia com o total do manifesto");

  const mustIncludeFromRules = [...byRule.values()].filter((r) => r.label === "must_include").reduce((s, r) => s + r.count, 0);
  const mustExcludeFromRules = [...byRule.values()].filter((r) => r.label === "must_exclude").reduce((s, r) => s + r.count, 0);
  const uncertainFromRules = [...byRule.values()].filter((r) => r.label === "uncertain").reduce((s, r) => s + r.count, 0);
  assertEqual(mustIncludeFromRules, 563, "reconciliação por regra: must_include não bate com 563");
  assertEqual(mustExcludeFromRules, 106, "reconciliação por regra: must_exclude não bate com 106");
  assertEqual(uncertainFromRules, 1, "reconciliação por regra: uncertain não bate com 1");
});
