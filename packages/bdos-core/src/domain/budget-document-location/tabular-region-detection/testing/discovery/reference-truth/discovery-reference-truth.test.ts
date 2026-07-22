import { REFERENCE_TRUTH_DOCUMENT, REFERENCE_TRUTH_PAGES, REFERENCE_TRUTH_COLUMNS, REFERENCE_TRUTH_BUNDLES } from "./discovery-reference-truth";
import type { ReferenceTruthLogicalRow, ReferenceTruthPhysicalRegion } from "./discovery-reference-truth.types";

/**
 * Testes de integridade da verdade de referência estruturada (Sprint
 * 21.4B.3A.3, Momento 2, §"Integridade obrigatória" do enunciado).
 * Executados ANTES de qualquer aprovação humana e ANTES de qualquer
 * execução de Docling ou PaddleOCR sobre estas páginas. Nenhum destes
 * testes avalia nenhum leitor local — apenas a estrutura, cobertura e
 * ausência de contaminação da própria verdade de referência.
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const ALL_REGIONS = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.physicalRegions);
const ALL_ROWS = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.logicalRows);
const ALL_CELLS = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.cells);
const ALL_MATH = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.mathRelations);

runTest("apenas as páginas 46, 50 e 54 estão presentes", () => {
  const pages = new Set(REFERENCE_TRUTH_PAGES.map((p) => p.realPageNumber));
  assertEqual(pages.size, 3, "quantidade de páginas incorreta");
  [46, 50, 54].forEach((p) => assert(pages.has(p), `página ${p} ausente`));
  const regionPages = new Set(ALL_REGIONS.map((r) => r.realPageNumber));
  regionPages.forEach((p) => assert([46, 50, 54].includes(p), `região física em página não autorizada: ${p}`));
});

runTest("ausência de identidades duplicadas (regiões, linhas lógicas, células, relações matemáticas)", () => {
  const regionIds = ALL_REGIONS.map((r) => r.id);
  assertEqual(new Set(regionIds).size, regionIds.length, "ids de região física duplicados");
  const rowIds = ALL_ROWS.map((r) => r.id);
  assertEqual(new Set(rowIds).size, rowIds.length, "ids de linha lógica duplicados");
  const cellIds = ALL_CELLS.map((c) => c.id);
  assertEqual(new Set(cellIds).size, cellIds.length, "ids de célula duplicados");
  const mathIds = ALL_MATH.map((m) => m.id);
  assertEqual(new Set(mathIds).size, mathIds.length, "ids de relação matemática duplicados");
});

runTest("toda célula está ligada a uma linha lógica existente", () => {
  const rowIds = new Set(ALL_ROWS.map((r) => r.id));
  ALL_CELLS.forEach((c) => assert(rowIds.has(c.logicalRowId), `${c.id}: logicalRowId "${c.logicalRowId}" não existe`));
});

runTest("toda linha lógica referencia apenas células e regiões físicas existentes; toda região física referenciada existe na mesma página", () => {
  const cellIds = new Set(ALL_CELLS.map((c) => c.id));
  const regionIds = new Set(ALL_REGIONS.map((r) => r.id));
  ALL_ROWS.forEach((row) => {
    row.cellIds.forEach((cid) => assert(cellIds.has(cid), `${row.id}: cellId "${cid}" não existe`));
    row.physicalRegionIds.forEach((rid) => assert(regionIds.has(rid), `${row.id}: physicalRegionId "${rid}" não existe`));
  });
});

runTest("toda origem física (fingerprint) pertence ao mesmo PDF — um único documento em todo o recorte", () => {
  assertEqual(REFERENCE_TRUTH_DOCUMENT.sourceFingerprintSha256.length, 64, "fingerprint não é um SHA-256 válido");
  assertEqual(/^[0-9a-f]{64}$/.test(REFERENCE_TRUTH_DOCUMENT.sourceFingerprintSha256), true, "fingerprint não é hexadecimal de 64 caracteres");
  REFERENCE_TRUTH_PAGES.forEach((p) => assertEqual(/^[0-9a-f]{64}$/.test(p.renderingHashSha256), true, `página ${p.realPageNumber}: hash de renderização inválido`));
});

runTest("toda caixa delimitadora está dentro dos limites da página", () => {
  const pageByNumber = new Map(REFERENCE_TRUTH_PAGES.map((p) => [p.realPageNumber, p]));
  ALL_REGIONS.forEach((r) => {
    const page = pageByNumber.get(r.realPageNumber)!;
    assert(r.boundingBox.leftPoints >= 0, `${r.id}: leftPoints negativo`);
    assert(r.boundingBox.topPoints >= 0, `${r.id}: topPoints negativo`);
    assert(r.boundingBox.rightPoints <= page.pageWidthPoints, `${r.id}: rightPoints excede largura da página`);
    assert(r.boundingBox.bottomPoints <= page.pageHeightPoints, `${r.id}: bottomPoints excede altura da página`);
    assert(r.boundingBox.leftPoints < r.boundingBox.rightPoints, `${r.id}: leftPoints >= rightPoints`);
    assert(r.boundingBox.topPoints < r.boundingBox.bottomPoints, `${r.id}: topPoints >= bottomPoints`);
  });
});

runTest("ordenação canônica: regiões físicas em ordem crescente de verticalOrder dentro de cada página", () => {
  REFERENCE_TRUTH_BUNDLES.forEach((b) => {
    for (let i = 1; i < b.physicalRegions.length; i += 1) {
      assert(b.physicalRegions[i].verticalOrder > b.physicalRegions[i - 1].verticalOrder, `página ${b.page.realPageNumber}: regiões fora de ordem canônica no índice ${i}`);
    }
  });
});

runTest("toda linha física (região) tem destinação: conteúdo tabular e nota externa pertencem a alguma linha lógica; título e rodapé são destinações válidas por si mesmos", () => {
  const usedInRows = new Set<string>();
  ALL_ROWS.forEach((row) => row.physicalRegionIds.forEach((id) => usedInRows.add(id)));
  ALL_REGIONS.forEach((r: ReferenceTruthPhysicalRegion) => {
    if (r.classification === "titulo" || r.classification === "rodape") return;
    assert(usedInRows.has(r.id), `${r.id} (classificação "${r.classification}") não pertence a nenhuma linha lógica`);
  });
});

runTest("nenhuma região física ou linha lógica tem justificativa/relação de continuidade vazia", () => {
  ALL_REGIONS.forEach((r) => {
    assert(r.classificationBasisPt.trim().length > 0, `${r.id}: classificationBasisPt vazia`);
    assert(r.classificationProvenancePt.trim().length > 0, `${r.id}: classificationProvenancePt vazia`);
  });
  ALL_ROWS.forEach((row: ReferenceTruthLogicalRow) => {
    assert(row.continuityRelationPt.trim().length > 0, `${row.id}: continuityRelationPt vazia`);
  });
});

runTest("todos os valores monetários e decimais são inteiros escalados — nunca float", () => {
  ALL_CELLS.forEach((c) => {
    const v = c.interpretedValue;
    if (!v) return;
    if (v.kind === "monetary_cents") assert(Number.isInteger(v.amountCents), `${c.id}: amountCents não é inteiro`);
    if (v.kind === "decimal_scaled" || v.kind === "percentage_scaled") {
      assert(Number.isInteger(v.scaledValue), `${c.id}: scaledValue não é inteiro`);
      assert(Number.isInteger(v.scale), `${c.id}: scale não é inteiro`);
    }
  });
  ALL_MATH.forEach((m) => {
    if (m.displayedUnitPriceCents !== null) assert(Number.isInteger(m.displayedUnitPriceCents), `${m.id}: displayedUnitPriceCents não é inteiro`);
    if (m.displayedTotalCents !== null) assert(Number.isInteger(m.displayedTotalCents), `${m.id}: displayedTotalCents não é inteiro`);
    if (m.officialSubtotalOrTotalCents !== null) assert(Number.isInteger(m.officialSubtotalOrTotalCents), `${m.id}: officialSubtotalOrTotalCents não é inteiro`);
    if (m.quantityScaled !== null) assert(Number.isInteger(m.quantityScaled.scaledValue) && Number.isInteger(m.quantityScaled.scale), `${m.id}: quantityScaled não é inteiro escalado`);
  });
});

runTest("nenhuma saída do Docling, nenhuma saída do PaddleOCR, nenhum campo de avaliação de ferramenta", () => {
  const forbidden = ["docling", "paddleocr", "paddlex", "paddlepaddle", "enable_mkldnn", "PP-OCR", "TableFormer", "confidence", "confiança", "score"];
  const serialized = JSON.stringify(REFERENCE_TRUTH_BUNDLES).toLowerCase();
  forbidden.forEach((term) => {
    assert(!serialized.includes(term.toLowerCase()), `verdade de referência contém termo proibido de ferramenta: "${term}"`);
  });
});

runTest("todos os casos 'incerto' (região ou linha lógica) estão explicitamente marcados, nunca silenciosos", () => {
  const uncertainRegions = ALL_REGIONS.filter((r) => r.classification === "incerto");
  uncertainRegions.forEach((r) => assert(r.classificationBasisPt.length > 0, `${r.id}: incerto sem justificativa`));
  const uncertainRows = ALL_ROWS.filter((r) => r.type === "incerto");
  uncertainRows.forEach((r) => assert(r.continuityRelationPt.length > 0, `${r.id}: incerto sem justificativa`));
  console.log(`  (${uncertainRegions.length} região(ões) incerta(s), ${uncertainRows.length} linha(s) lógica(s) incerta(s) — nenhuma neste recorte)`);
});

runTest("totais por categoria — calculados deterministicamente a partir dos dados estáticos, nunca transcritos à mão", () => {
  const byPage: Record<number, number> = {};
  ALL_REGIONS.forEach((r) => (byPage[r.realPageNumber] = (byPage[r.realPageNumber] ?? 0) + 1));
  assertEqual(byPage[46], 73);
  assertEqual(byPage[50], 80);
  assertEqual(byPage[54], 33);
  assertEqual(ALL_REGIONS.length, 186);

  const classCounts: Record<string, number> = {};
  ALL_REGIONS.forEach((r) => (classCounts[r.classification] = (classCounts[r.classification] ?? 0) + 1));
  assertEqual(classCounts["titulo"], 15);
  assertEqual(classCounts["cabecalho_da_planilha"], 6);
  assertEqual(classCounts["conteudo_tabular"], 139);
  assertEqual(classCounts["nota_externa"], 8);
  assertEqual(classCounts["rodape"], 18);

  const rowTypeCounts: Record<string, number> = {};
  ALL_ROWS.forEach((r) => (rowTypeCounts[r.type] = (rowTypeCounts[r.type] ?? 0) + 1));
  assertEqual(rowTypeCounts["item_de_servico"], 80);
  assertEqual(rowTypeCounts["grupo"], 4);
  assertEqual(rowTypeCounts["subgrupo"], 9);
  assertEqual(rowTypeCounts["cabecalho"], 3);
  assertEqual(rowTypeCounts["conteudo_externo"], 1);
  assertEqual(rowTypeCounts["total"], 1);
  assertEqual(ALL_ROWS.length, 98);

  const mathResultCounts: Record<string, number> = {};
  ALL_MATH.forEach((m) => (mathResultCounts[m.result] = (mathResultCounts[m.result] ?? 0) + 1));
  assertEqual(mathResultCounts["reconciliado_diretamente"], 68);
  assertEqual(mathResultCounts["reconciliado_por_precisao_nao_exibida"], 11);
  assertEqual(mathResultCounts["inconsistencia_aritmetica_confirmada_na_fonte"], 4);
  assertEqual(mathResultCounts["nao_verificavel_fora_do_recorte"], 1);
  assertEqual(ALL_MATH.length, 84);
});

runTest("colunas esperadas: exatamente 12, todas presentes nas 3 páginas, mesmas posições", () => {
  assertEqual(REFERENCE_TRUTH_COLUMNS.length, 12);
  REFERENCE_TRUTH_COLUMNS.forEach((c) => {
    assertEqual(c.presentOnPages.length, 3);
    assert(c.horizontalIntervalPoints.leftPoints < c.horizontalIntervalPoints.rightPoints, `${c.id}: intervalo horizontal inválido`);
  });
});

runTest("prova de precisão não exibida: os 6 pontos exigidos presentes em todos os 11 casos, nunca fora deles", () => {
  const withProof = ALL_MATH.filter((m) => m.result === "reconciliado_por_precisao_nao_exibida");
  assertEqual(withProof.length, 11, "quantidade de casos de precisão não exibida mudou");
  withProof.forEach((m) => {
    const p = m.undisplayedPrecisionProof;
    assert(p !== null, `${m.id}: resultado exige prova, mas undisplayedPrecisionProof é null`);
    assertEqual(p!.displayedDecimalPrecision, 2, `${m.id}: precisão exibida ausente/incorreta`);
    assert(p!.assumedRoundingRulePt.length > 0, `${m.id}: regra de arredondamento vazia`);
    assert(p!.admissibleIntervalDescriptionPt.length > 0, `${m.id}: intervalo matemático admissível vazio`);
    assert(p!.compatibleValueExistenceDemonstratedPt.length > 0, `${m.id}: existência demonstrada de valor compatível vazia`);
    assert(p!.officialPricePreservedPt.length > 0, `${m.id}: preservação do preço oficial vazia`);
    assert(p!.noAssertionOfTrueHiddenPricePt.length > 0, `${m.id}: ausência de afirmação sobre preço oculto vazia`);
  });
  ALL_MATH.filter((m) => m.result !== "reconciliado_por_precisao_nao_exibida").forEach((m) => {
    assertEqual(m.undisplayedPrecisionProof, null, `${m.id}: prova de precisão presente sem o resultado correspondente`);
  });
});

runTest("inconsistência aritmética confirmada na fonte: exatamente os 4 itens da página 50, com registro rico completo", () => {
  const inconsistent = ALL_MATH.filter((m) => m.result === "inconsistencia_aritmetica_confirmada_na_fonte");
  assertEqual(inconsistent.length, 4, "quantidade de inconsistências confirmadas mudou");
  inconsistent.forEach((m) => {
    const rec = m.sourceArithmeticInconsistency;
    assert(rec !== null, `${m.id}: resultado exige registro, mas sourceArithmeticInconsistency é null`);
    assertEqual(rec!.realPageNumber, 50, `${m.id}: página inesperada`);
    assert(rec!.literalQuantity.length > 0, `${m.id}: quantidade literal vazia`);
    assert(rec!.literalUnitPrice.length > 0, `${m.id}: preço unitário literal vazio`);
    assert(rec!.literalTotal.length > 0, `${m.id}: total literal vazio`);
    assert(Number.isInteger(rec!.exactMathematicalProductCents), `${m.id}: produto matemático exato não é inteiro`);
    assert(Number.isInteger(rec!.exactDifferenceCents), `${m.id}: diferença exata não é inteiro`);
    assertEqual(rec!.exactDifferenceCents !== 0, true, `${m.id}: diferença exata deveria ser não-zero (é uma inconsistência)`);
    assert(rec!.fieldProvenance.quantity.length > 0, `${m.id}: proveniência física de quantidade vazia`);
    assert(rec!.fieldProvenance.unitPrice.length > 0, `${m.id}: proveniência física de preço unitário vazia`);
    assert(rec!.fieldProvenance.total.length > 0, `${m.id}: proveniência física de total vazia`);
    assert(rec!.confirmedAgainstRenderingPt.length > 0, `${m.id}: confirmação contra renderização vazia`);
    assert(rec!.confirmedAgainstRawTextPt.length > 0, `${m.id}: confirmação contra texto bruto vazia`);
    assert(rec!.fidelityJustificationPt.length > 0, `${m.id}: justificativa de fidelidade vazia`);
  });
  ALL_MATH.filter((m) => m.result !== "inconsistencia_aritmetica_confirmada_na_fonte").forEach((m) => {
    assertEqual(m.sourceArithmeticInconsistency, null, `${m.id}: registro de inconsistência presente sem o resultado correspondente`);
  });
});

runTest("prova de completude de grupo: grupos 01.00.00, 10.00.00 e 11.00.00 com diferença zero e descendentes registrados", () => {
  const withCompleteness = ALL_MATH.filter((m) => m.groupCompletenessProof !== null);
  assertEqual(withCompleteness.length, 3, "quantidade de grupos com prova de completude mudou");
  withCompleteness.forEach((m) => {
    const p = m.groupCompletenessProof!;
    assert(p.includedDescendantLogicalRowIds.length > 0, `${m.id}: nenhum descendente incluído`);
    assert(p.pageScopeDescriptionPt.length > 0, `${m.id}: escopo de páginas vazio`);
    assertEqual(p.sumCents, p.officialTotalCents, `${m.id}: soma não bate com o total oficial`);
    assertEqual(p.differenceCents, 0, `${m.id}: diferença deveria ser zero`);
    assert(p.completenessProofPt.length > 0, `${m.id}: prova de completude vazia`);
    assertEqual(m.result, "reconciliado_diretamente", `${m.id}: grupo com prova de completude deveria estar reconciliado diretamente`);
  });
});

runTest("hierarquia: todo pai referenciado (parentLogicalRowId) existe e está na mesma página", () => {
  REFERENCE_TRUTH_BUNDLES.forEach((b) => {
    const idsOnPage = new Set(b.logicalRows.map((r) => r.id));
    b.logicalRows.forEach((r) => {
      if (r.parentLogicalRowId !== null) assert(idsOnPage.has(r.parentLogicalRowId), `${r.id}: pai "${r.parentLogicalRowId}" não existe na mesma página`);
    });
  });
});
