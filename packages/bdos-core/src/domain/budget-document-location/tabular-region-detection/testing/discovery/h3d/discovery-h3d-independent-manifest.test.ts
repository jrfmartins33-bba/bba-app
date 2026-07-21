import { H3D_INDEPENDENT_MANIFEST } from "./discovery-h3d-independent-manifest";
import { H3D_INDEPENDENT_MANIFEST_PAGE_RANGE } from "./discovery-h3d-independent-manifest.types";
import type { H3dIndependentManifestEntry } from "./discovery-h3d-independent-manifest.types";

/**
 * Testes de integridade do manifesto real independente pré-registrado
 * (Sprint 21.4B.3A.2, §11.5 do enunciado). Executados ANTES de qualquer
 * aprovação humana e ANTES de qualquer implementação de H3d. Nenhum
 * destes testes avalia H3d — apenas a estrutura, cobertura e ausência de
 * contaminação do próprio manifesto. Mesma disciplina do teste de
 * integridade do manifesto real de H3c (Sprint 21.4B.3A.1).
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

runTest("o manifesto cobre exatamente as páginas reais 2-21, nenhuma outra", () => {
  const pages = new Set(H3D_INDEPENDENT_MANIFEST.map((e) => e.realPageNumber));
  const expected = new Set<number>();
  for (let p = H3D_INDEPENDENT_MANIFEST_PAGE_RANGE.start; p <= H3D_INDEPENDENT_MANIFEST_PAGE_RANGE.end; p += 1) expected.add(p);
  assertEqual(pages.size, expected.size, "quantidade de páginas distintas incorreta");
  expected.forEach((p) => assert(pages.has(p), `página real ${p} ausente do manifesto`));
  pages.forEach((p) => assert(expected.has(p), `página real ${p} não pertence ao intervalo 2-21`));
});

runTest("ausência de duplicidade de (realPageNumber, lineKey)", () => {
  const identities = H3D_INDEPENDENT_MANIFEST.map((e) => `${e.realPageNumber}:${e.lineKey}`);
  assertEqual(new Set(identities).size, identities.length, "há identidades (página, lineKey) duplicadas");
});

runTest("ausência de duplicidade de id", () => {
  const ids = H3D_INDEPENDENT_MANIFEST.map((e) => e.id);
  assertEqual(new Set(ids).size, ids.length, "há ids duplicados");
});

runTest("todos os registros possuem justificativa (rationalePt) não vazia", () => {
  H3D_INDEPENDENT_MANIFEST.forEach((e) => {
    assert(e.rationalePt.trim().length > 0, `${e.id}: rationalePt vazia`);
  });
});

runTest("todos os registros possuem ao menos uma etiqueta de cobertura", () => {
  H3D_INDEPENDENT_MANIFEST.forEach((e) => {
    assert(e.coverageTags.length > 0, `${e.id}: nenhuma etiqueta de cobertura`);
  });
});

runTest("nenhum registro possui campo de resultado de candidata (H0-H4/H3b/H3c/H3c-r1/H3d) — apenas os campos do schema, incluindo annotationRuleId", () => {
  const allowedKeys = new Set(["id", "realPageNumber", "lineKey", "verticalOrder", "textLocatorForHumanAudit", "label", "annotationRuleId", "rationalePt", "coverageTags", "annotationStatus"]);
  H3D_INDEPENDENT_MANIFEST.forEach((e) => {
    Object.keys(e as unknown as Record<string, unknown>).forEach((key) => {
      assert(allowedKeys.has(key), `${e.id}: campo inesperado "${key}" — possível vazamento de resultado de candidata`);
    });
  });
});

runTest("todos os registros possuem annotationRuleId não vazio (proveniência auditável da regra que propôs o rótulo)", () => {
  H3D_INDEPENDENT_MANIFEST.forEach((e) => {
    assert(e.annotationRuleId.trim().length > 0, `${e.id}: annotationRuleId vazio`);
  });
});

runTest("manifesto é ESTÁTICO: os mesmos dados literais produzem os mesmos totais em execuções repetidas (nenhuma regra reexecutada em tempo de avaliação)", () => {
  const first = H3D_INDEPENDENT_MANIFEST.map((e) => `${e.id}:${e.label}`).join("|");
  const second = H3D_INDEPENDENT_MANIFEST.map((e) => `${e.id}:${e.label}`).join("|");
  assertEqual(first, second, "rótulos mudaram entre duas leituras do mesmo array — manifesto não é estático");
});

runTest("nenhum registro contém constante da implementação de H3d (ex.: nomes de exports do módulo H3d, valores de tolerância) no texto ou justificativa", () => {
  const forbiddenSubstrings = ["formTabularRegionCandidateWindows", "must_include\":", "candidateH3d", "H3dGridComponent", "H3dPhysicalEnvelope"];
  H3D_INDEPENDENT_MANIFEST.forEach((e) => {
    forbiddenSubstrings.forEach((s) => {
      assert(!e.rationalePt.includes(s), `${e.id}: justificativa contém referência à implementação de H3d ("${s}")`);
      assert(!e.textLocatorForHumanAudit.includes(s), `${e.id}: texto de origem contém referência à implementação de H3d ("${s}")`);
    });
  });
});

runTest("existência de ao menos uma continuação larga legítima (legitimate_wide_continuation)", () => {
  const count = H3D_INDEPENDENT_MANIFEST.filter((e) => e.coverageTags.includes("legitimate_wide_continuation")).length;
  assert(count > 0, "nenhuma entrada com etiqueta legitimate_wide_continuation");
});

runTest("existência de ao menos um elemento externo adversarial (external_adversarial_element)", () => {
  const count = H3D_INDEPENDENT_MANIFEST.filter((e) => e.coverageTags.includes("external_adversarial_element")).length;
  assert(count > 0, "nenhuma entrada com etiqueta external_adversarial_element");
});

runTest("existência de linhas tabulares convencionais, de cabeçalho/rodapé externo, e de total de grade", () => {
  assert(H3D_INDEPENDENT_MANIFEST.some((e) => e.coverageTags.includes("conventional_tabular_line")), "nenhuma entrada conventional_tabular_line");
  assert(H3D_INDEPENDENT_MANIFEST.some((e) => e.coverageTags.includes("external_header_footer_or_note")), "nenhuma entrada external_header_footer_or_note");
  assert(H3D_INDEPENDENT_MANIFEST.some((e) => e.coverageTags.includes("grid_total")), "nenhuma entrada grid_total");
});

runTest("texto de origem usado somente como localização de auditoria — nunca vazio para nenhuma entrada", () => {
  H3D_INDEPENDENT_MANIFEST.forEach((e) => {
    assert(e.textLocatorForHumanAudit.length > 0, `${e.id}: textLocatorForHumanAudit vazio`);
  });
});

runTest("ordenação canônica por página, verticalOrder e lineKey — o array já está nessa ordem", () => {
  for (let i = 1; i < H3D_INDEPENDENT_MANIFEST.length; i += 1) {
    const prev = H3D_INDEPENDENT_MANIFEST[i - 1];
    const curr = H3D_INDEPENDENT_MANIFEST[i];
    const prevKey: [number, number, string] = [prev.realPageNumber, prev.verticalOrder, prev.lineKey];
    const currKey: [number, number, string] = [curr.realPageNumber, curr.verticalOrder, curr.lineKey];
    const cmp = prevKey[0] - currKey[0] || prevKey[1] - currKey[1] || prevKey[2].localeCompare(currKey[2]);
    assert(cmp < 0, `manifesto fora de ordem canônica entre ${prev.id} e ${curr.id}`);
  }
});

runTest("nenhuma entrada avaliada por candidata: não há rótulo 'uncertain' proposto sem justificativa explícita de ambiguidade física", () => {
  const uncertainEntries = H3D_INDEPENDENT_MANIFEST.filter((e) => e.label === "uncertain");
  uncertainEntries.forEach((e) => {
    assert(e.coverageTags.includes("insufficient_physical_evidence"), `${e.id}: rótulo uncertain sem etiqueta insufficient_physical_evidence`);
  });
});

runTest("todos os registros têm annotationStatus consistente entre si (todos proposed_for_human_review antes da aprovação, ou todos human_approved depois)", () => {
  const statuses = new Set(H3D_INDEPENDENT_MANIFEST.map((e) => e.annotationStatus));
  assertEqual(statuses.size, 1, "status de anotação inconsistente entre entradas do manifesto");
});

runTest("todos os registros têm annotationStatus=human_approved (aprovação humana expressa de Ricardo, manifesto aceito sem correções)", () => {
  H3D_INDEPENDENT_MANIFEST.forEach((e) => {
    assertEqual(e.annotationStatus, "human_approved", `${e.id}: annotationStatus deveria ser human_approved após a aprovação`);
  });
});

runTest("total de linhas por página calculado deterministicamente (nunca transcrito à mão)", () => {
  const byPage = new Map<number, number>();
  H3D_INDEPENDENT_MANIFEST.forEach((e) => byPage.set(e.realPageNumber, (byPage.get(e.realPageNumber) ?? 0) + 1));
  const expected: Record<number, number> = {
    2: 66,
    3: 70,
    4: 69,
    5: 70,
    6: 71,
    7: 71,
    8: 70,
    9: 67,
    10: 67,
    11: 66,
    12: 74,
    13: 69,
    14: 73,
    15: 71,
    16: 70,
    17: 75,
    18: 71,
    19: 65,
    20: 69,
    21: 45,
  };
  Object.entries(expected).forEach(([page, count]) => {
    assertEqual(byPage.get(Number(page)), count, `página ${page}: total de linhas mudou`);
  });
  assertEqual(H3D_INDEPENDENT_MANIFEST.length, 1369, "total geral de linhas do manifesto mudou");
});

runTest("totais por rótulo calculados deterministicamente: 1109 must_include, 260 must_exclude, 0 uncertain", () => {
  const totals: Record<H3dIndependentManifestEntry["label"], number> = { must_include: 0, must_exclude: 0, uncertain: 0 };
  H3D_INDEPENDENT_MANIFEST.forEach((e) => {
    totals[e.label] += 1;
  });
  assertEqual(totals.must_include, 1109);
  assertEqual(totals.must_exclude, 260);
  assertEqual(totals.uncertain, 0);
  assertEqual(totals.must_include + totals.must_exclude + totals.uncertain, H3D_INDEPENDENT_MANIFEST.length);
});

runTest("totais por annotationRuleId reconciliam automaticamente com os totais por rótulo (tabela de regras do relatório de pré-registro)", () => {
  const byRule = new Map<string, { label: H3dIndependentManifestEntry["label"]; count: number }>();
  H3D_INDEPENDENT_MANIFEST.forEach((e) => {
    const existing = byRule.get(e.annotationRuleId);
    if (existing) {
      assertEqual(existing.label, e.label, `regra "${e.annotationRuleId}" produz rótulos inconsistentes entre entradas — cada regra deve mapear para um único rótulo`);
      existing.count += 1;
    } else {
      byRule.set(e.annotationRuleId, { label: e.label, count: 1 });
    }
  });

  const expectedByRule: Record<string, { label: H3dIndependentManifestEntry["label"]; count: number }> = {
    page_header_metadata_block: { label: "must_exclude", count: 240 },
    column_caption_header: { label: "must_include", count: 60 },
    page_footer_pagination: { label: "must_exclude", count: 20 },
    group_or_item_row: { label: "must_include", count: 347 },
    item_description_continuation: { label: "must_include", count: 699 },
    grid_total_line: { label: "must_include", count: 3 },
  };

  assertEqual(byRule.size, Object.keys(expectedByRule).length, "quantidade de regras distintas mudou");
  Object.entries(expectedByRule).forEach(([ruleId, expected]) => {
    const actual = byRule.get(ruleId);
    assert(actual !== undefined, `regra "${ruleId}" ausente do manifesto`);
    assertEqual(actual!.label, expected.label, `regra "${ruleId}": rótulo mudou`);
    assertEqual(actual!.count, expected.count, `regra "${ruleId}": contagem mudou`);
  });

  const totalFromRules = [...byRule.values()].reduce((sum, r) => sum + r.count, 0);
  assertEqual(totalFromRules, H3D_INDEPENDENT_MANIFEST.length, "soma das regras não reconcilia com o total do manifesto");

  const mustIncludeFromRules = [...byRule.values()].filter((r) => r.label === "must_include").reduce((s, r) => s + r.count, 0);
  const mustExcludeFromRules = [...byRule.values()].filter((r) => r.label === "must_exclude").reduce((s, r) => s + r.count, 0);
  assertEqual(mustIncludeFromRules, 1109, "reconciliação por regra: must_include não bate com 1109");
  assertEqual(mustExcludeFromRules, 260, "reconciliação por regra: must_exclude não bate com 260");
});
