import { buildXlsxFixture, type FixtureSheetSpec } from "../../../schedule-management/adapters/excel-import/xlsx-test-fixtures";
import { importBulletinExcel } from "./bulletin-import";

// Reproduz em miniatura a estrutura real do BM_08 (confirmado contra
// o arquivo real durante o Epic 19, e revisado após a investigação de
// fórmulas pós-19.4A/4C): cabeçalho em duas linhas, bloco financeiro
// oficial "CONTROLE FINANCEIRO – MEDIÇÃO" (QUANTITATIVO/VALOR (R$)),
// e a grade histórica MED-01/MED-02/MED-03, deliberadamente com
// valores DIFERENTES dos do bloco oficial -- exatamente como no
// arquivo real, onde a grade é preenchida à mão e diverge da fonte
// ligada por fórmula. Isso prova que o parser lê o bloco oficial, não
// a grade, mesmo quando ambos existem na mesma linha.
const PERIOD_LABEL_ROW = [
  "ITEM",
  "DISCRIMINAÇÃO",
  "UND.",
  "VALORES DE CONTRATO",
  null,
  null,
  "CONTROLE FINANCEIRO – MEDIÇÃO",
  null,
  "MED-01",
  null,
  "MED-02",
  null,
  "MED-03",
  null
];
const SUB_HEADER_ROW = [
  null,
  null,
  null,
  "QUANT.",
  "PREÇO UNITÁRIO (R$)",
  "PREÇO TOTAL (R$)",
  "QUANTITATIVO",
  "VALOR (R$)",
  "FISICO",
  "FINANCEIRO",
  "FISICO",
  "FINANCEIRO",
  "FISICO",
  "FINANCEIRO"
];

function bulletinSheetRows(): ReadonlyArray<ReadonlyArray<string | number | null>> {
  return [
    ["", "", "", "BOLETIM DE MEDIÇÃO 02"],
    ["", "", "", "BOLETIM Nº 02 (01/02/2026 A 28/02/2026)"],
    PERIOD_LABEL_ROW,
    SUB_HEADER_ROW,
    // código, nome, und, QUANT, PREÇO UNIT, PREÇO TOTAL, [oficial] QUANTITATIVO, VALOR (R$), [grade] MED-01 F/F, MED-02 F/F, MED-03 F/F
    ["01.00.00", "SERVIÇOS PRELIMINARES", null, null, null, null, null, null, null, null, null, null, null, null],
    ["01.01.00", "CANTEIRO DE OBRAS", null, null, null, null, null, null, null, null, null, null, null, null],
    ["01.01.01", "CAPINA MANUAL", "M2", 10, 5, 50, 99, 999, 1, 10, 2, 20, 3, 30],
    ["01.01.02", "CERCAMENTO", "UNID", 4, 100, 400, 50, 500, null, null, 1, 90, null, null],
    [null, "ARREDONDAMENTO CONTRATUAL", null, null, null, null, null, null, null, null, null, null, null, null],
    // 999 + 500 = 1499 -- precisa bater com a soma real do bloco
    // oficial acima, senão o próprio fixture dispararia
    // official_period_total_mismatch.
    ["TOTAL GERAL (R$)", null, null, null, null, null, null, 1499, null, null, null, null, null, null]
  ];
}

function buildBulletinFixture(sheets: ReadonlyArray<FixtureSheetSpec>): Uint8Array {
  return buildXlsxFixture(sheets);
}

runTest("extrai as linhas a partir do bloco financeiro OFICIAL (QUANTITATIVO/VALOR), nunca da grade histórica MED-NN, mesmo quando ambos existem", () => {
  const bytes = buildBulletinFixture([{ name: "BOLETIM DE MEDIÇÃO 02", rows: bulletinSheetRows() }]);

  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  assertEqual(result.bulletin.declaredBulletinNumber, 2, "número do boletim deveria vir do nome da aba");
  assertEqual(result.bulletin.declaredPeriod?.startDate, "2026-02-01");
  assertEqual(result.bulletin.declaredPeriod?.endDate, "2026-02-28");

  assertEqual(result.bulletin.workPackages.length, 4, "2 agregadores + 2 itens folha");
  assertEqual(result.bulletin.serviceItems.length, 2, "só os 2 itens com unidade viram ManagedServiceItem");

  assertEqual(result.bulletin.lines.length, 2);
  const line1 = result.bulletin.lines.find((l) => l.serviceItemCode === "01.01.01");
  // Bloco oficial (G/H) = 99/999. Grade MED-02 (K/L, mesma linha) =
  // 2/20 -- valores DIFERENTES de propósito. Se o teste falhar com
  // declaredQuantity=2, o parser voltou a ler a grade, não a fonte
  // oficial.
  assertEqual(line1?.declaredQuantity, 99, "deveria vir do QUANTITATIVO oficial (99), não do FISICO da grade MED-02 (2)");
  assertEqual(line1?.declaredTotalValue, 999, "deveria vir do VALOR (R$) oficial (999), não do FINANCEIRO da grade MED-02 (20)");
  assertEqual(line1?.periodLabel, "MED-02", "rótulo ainda vem da grade quando ela existe e bate com o número declarado -- é só cross-reference, não fonte de valor");
  assertEqual(line1?.sourceLocation.physicalColumn, "G");
  assertEqual(line1?.sourceLocation.financialColumn, "H");

  const line2 = result.bulletin.lines.find((l) => l.serviceItemCode === "01.01.02");
  assertEqual(line2?.declaredQuantity, 50, "deveria vir do QUANTITATIVO oficial (50), não do FISICO da grade MED-02 (1)");
  assertEqual(line2?.declaredTotalValue, 500, "deveria vir do VALOR (R$) oficial (500), não do FINANCEIRO da grade MED-02 (90)");
});

runTest("registra a divergência da grade histórica como issue explícita, sem tentar reconciliar os dois valores", () => {
  const bytes = buildBulletinFixture([{ name: "BOLETIM DE MEDIÇÃO 02", rows: bulletinSheetRows() }]);

  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  const gridIssue = result.bulletin.issues.find((issue) => issue.code === "historical_grid_not_authoritative");
  assertEqual(gridIssue !== undefined, true, "esperava uma issue avisando que a grade histórica não reconcilia com a fonte oficial");
  assertEqual(gridIssue?.severity, "warning");
  // Oficial: 999 + 500 = 1499. Grade MED-02: 20 + 90 = 110.
  assertEqual(gridIssue?.message.includes("1499.00"), true, "mensagem deveria conter o total oficial do período");
  assertEqual(gridIssue?.message.includes("110.00"), true, "mensagem deveria conter o total bruto da grade histórica");
});

runTest("nunca descarta silenciosamente uma linha com dado parcial (rodapé sem código ou sem nome)", () => {
  const bytes = buildBulletinFixture([{ name: "BOLETIM DE MEDIÇÃO 02", rows: bulletinSheetRows() }]);

  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  const missingCodeIssue = result.bulletin.issues.find((issue) => issue.code === "missing_work_package_code");
  assertEqual(missingCodeIssue !== undefined, true, "linha 'ARREDONDAMENTO CONTRATUAL' (sem código) deveria virar issue, não ser descartada silenciosamente");

  const unrecognizedIssue = result.bulletin.issues.find((issue) => issue.code === "unrecognized_line");
  assertEqual(unrecognizedIssue !== undefined, true, "linha 'TOTAL GERAL' (sem nome) deveria virar issue");

  // Nenhuma das duas linhas de rodapé deveria ter virado um WorkPackage.
  assertEqual(result.bulletin.workPackages.some((wp) => wp.name === "ARREDONDAMENTO CONTRATUAL"), false);
  assertEqual(result.bulletin.workPackages.some((wp) => wp.code === "TOTAL GERAL (R$)"), false);
});

runTest("reporta abas descartadas com o motivo correto (oculta, memória de cálculo, resumo, candidata duplicada)", () => {
  const memoriaRows: ReadonlyArray<ReadonlyArray<string | number | null>> = [["MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 02"], ["OBRA: TESTE"]];
  const resumoRows: ReadonlyArray<ReadonlyArray<string | number | null>> = [
    ["", "", "RESUMO BOLETIM DE MEDIÇÃO Nº 02"],
    ["ITEM", "ESPECIFICAÇÃO", "VALOR"]
  ];
  // Segunda aba com o mesmo layout de boletim, porém sem o bloco
  // oficial nem UND. -- confiança menor, deve perder para a aba
  // principal e ser reportada como duplicate_candidate.
  const weakerBulletinRows: ReadonlyArray<ReadonlyArray<string | number | null>> = [
    ["ITEM", "DISCRIMINAÇÃO", null, null, null, null, "MED-01", null, "MED-02", null, "MED-03", null],
    [null, null, null, null, null, null, "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO"],
    ["02.01.01", "OUTRO ITEM", null, null, null, null, 1, 10, 1, 10, 1, 10]
  ];

  const bytes = buildBulletinFixture([
    { name: "Oculta", hidden: true, rows: [["x"]] },
    { name: "01.01.01", rows: memoriaRows },
    { name: "RESUMO", rows: resumoRows },
    { name: "BOLETIM DE MEDIÇÃO 02", rows: bulletinSheetRows() },
    { name: "BOLETIM FRACO", rows: weakerBulletinRows }
  ]);

  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  assertEqual(result.bulletin.source.inspectedSheetCount, 5);
  assertEqual(result.bulletin.source.selectedSheets, ["BOLETIM DE MEDIÇÃO 02"]);

  const reasons = new Set(result.bulletin.skippedSheets.map((s) => s.reason));
  assertEqual(reasons.has("hidden_sheet_not_selected"), true);
  assertEqual(reasons.has("calculation_memory_deferred"), true);
  assertEqual(reasons.has("summary_sheet_not_measurement_lines"), true);
  assertEqual(reasons.has("duplicate_candidate"), true);
  assertEqual(result.bulletin.skippedSheets.length, 4);
});

runTest("grade histórica sem coluna correspondente ao número declarado vira warning de auditoria, não mais bloqueia a extração pela fonte oficial", () => {
  // Aba diz "MEDIÇÃO 09", mas só existem colunas MED-01/02/03 na
  // grade histórica -- o bloco oficial (QUANTITATIVO/VALOR) continua
  // presente e é usado independente disso.
  const rows = bulletinSheetRows().map((row) => (row[3] === "BOLETIM DE MEDIÇÃO 02" ? ["", "", "", "BOLETIM DE MEDIÇÃO 09"] : row));
  const bytes = buildBulletinFixture([{ name: "BOLETIM DE MEDIÇÃO 09", rows }]);

  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  const ambiguousIssue = result.bulletin.issues.find((issue) => issue.code === "ambiguous_period_label");
  assertEqual(ambiguousIssue !== undefined, true, "esperava sinalizar que a grade histórica não tem MED-09");
  assertEqual(ambiguousIssue?.severity, "warning", "grade histórica é só auditoria agora -- não deveria mais bloquear");

  assertEqual(result.success, true, "a fonte oficial (QUANTITATIVO/VALOR) não depende da grade, então a extração deveria ter sucesso");
  assertEqual(result.bulletin.lines.length, 2, "as duas linhas com valor no bloco oficial deveriam ser extraídas normalmente");
  assertEqual(result.bulletin.lines.every((l) => l.periodLabel === "MED-09"), true, "sem cross-reference na grade, o rótulo é sintetizado a partir do número declarado");

  // Sem coluna MED-09 na grade, não há base de comparação -- não deve
  // aparecer um alerta de divergência (nada com o que comparar).
  assertEqual(result.bulletin.issues.some((issue) => issue.code === "historical_grid_not_authoritative"), false);
});

runTest("bloco financeiro oficial ausente é blocking e impede a extração de linhas, mesmo com a grade histórica presente", () => {
  const legacyRows: ReadonlyArray<ReadonlyArray<string | number | null>> = [
    ["", "", "", "BOLETIM DE MEDIÇÃO 02"],
    ["ITEM", "DISCRIMINAÇÃO", "UND.", "MED-01", null, "MED-02", null, "MED-03", null],
    [null, null, null, "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO"],
    ["01.01.01", "CAPINA MANUAL", "M2", 1, 10, 2, 20, 3, 30]
  ];
  const bytes = buildBulletinFixture([{ name: "BOLETIM DE MEDIÇÃO 02", rows: legacyRows }]);

  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  const blockIssue = result.bulletin.issues.find((issue) => issue.code === "official_measurement_block_not_found");
  assertEqual(blockIssue !== undefined, true, 'esperava blocking issue "official_measurement_block_not_found"');
  assertEqual(blockIssue?.severity, "blocking");
  assertEqual(result.success, false);
  assertEqual(result.bulletin.lines.length, 0, "sem a fonte oficial, nenhuma linha deveria ser extraída da grade histórica como substituta");
  // Código/nome/unidade continuam extraídos -- só a linha de medição depende do bloco oficial.
  assertEqual(result.bulletin.serviceItems.length, 1);
});

runTest("coluna residual sem cabeçalho (achado real: coluna N) gera um único warning agregado por aba, nunca participa de identidade ou linha", () => {
  const rowsWithOrphanColumn: (string | number | null)[][] = bulletinSheetRows().map((row) => row.slice());
  // Insere uma 15ª coluna (índice 8) sem cabeçalho em nenhuma das
  // duas linhas de cabeçalho, com texto solto nas linhas de item --
  // réplica sintética da coluna N real, deslocando a grade MED-NN uma
  // posição para a direita.
  const orphanLabelRow = [...PERIOD_LABEL_ROW.slice(0, 8), null, ...PERIOD_LABEL_ROW.slice(8)];
  const orphanSubHeaderRow = [...SUB_HEADER_ROW.slice(0, 8), null, ...SUB_HEADER_ROW.slice(8)];
  rowsWithOrphanColumn[2] = orphanLabelRow;
  rowsWithOrphanColumn[3] = orphanSubHeaderRow;
  for (let i = 4; i < rowsWithOrphanColumn.length; i++) {
    const row = rowsWithOrphanColumn[i] as (string | number | null)[];
    const withGap = [...row.slice(0, 8), `RESIDUAL ${i}`, ...row.slice(8)];
    rowsWithOrphanColumn[i] = withGap;
  }
  // O threshold de detecção exige um volume mínimo de valores (evita
  // falso positivo em ruído esparso) -- acrescenta linhas puramente
  // agregadoras (sem unidade, não geram serviceItem/line) só para
  // ultrapassar esse mínimo, como no arquivo real (256 valores).
  for (let i = 0; i < 6; i++) {
    const filler = new Array(15).fill(null);
    filler[0] = `09.0${i}.00`;
    filler[1] = `AGREGADOR PREENCHIMENTO ${i}`;
    filler[8] = `RESIDUAL PREENCHIMENTO ${i}`;
    rowsWithOrphanColumn.push(filler);
  }

  const bytes = buildBulletinFixture([{ name: "BOLETIM DE MEDIÇÃO 02", rows: rowsWithOrphanColumn }]);
  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  const orphanIssue = result.bulletin.issues.find((issue) => issue.code === "orphan_legacy_column_detected");
  assertEqual(orphanIssue !== undefined, true, "esperava um warning para a coluna residual");
  assertEqual(orphanIssue?.severity, "warning");
  assertEqual(result.bulletin.issues.filter((issue) => issue.code === "orphan_legacy_column_detected").length, 1, "um único warning agregado por aba, não um por célula/linha");

  // A coluna residual nunca deveria aparecer como description/código de nenhum item.
  assertEqual(
    result.bulletin.serviceItems.some((si) => si.description.startsWith("RESIDUAL")),
    false
  );
  // O bloco oficial continua funcionando normalmente apesar da coluna extra.
  assertEqual(result.bulletin.lines.length, 2);
});

runTest("linha só é ignorada quando quantidade E valor estão ambos vazios/zero -- quantidade=0 com valor≠0 continua virando linha", () => {
  const rows = bulletinSheetRows().map((row) => row.slice()) as (string | number | null)[][];
  // 01.01.01 original tem oficial (G,H) = 99,999. Troca para
  // quantidade=0 com valor=250 (ex.: glosa/ajuste financeiro sem
  // quantidade física) -- não pode desaparecer.
  const leafRowIndex = rows.findIndex((row) => row[0] === "01.01.01");
  (rows[leafRowIndex] as (string | number | null)[])[6] = 0;
  (rows[leafRowIndex] as (string | number | null)[])[7] = 250;
  // Recalcula o total declarado para bater: 250 (linha ajustada) + 500 (01.01.02, inalterada) = 750.
  const totalRowIndex = rows.findIndex((row) => row[0] === "TOTAL GERAL (R$)");
  (rows[totalRowIndex] as (string | number | null)[])[7] = 750;

  const bytes = buildBulletinFixture([{ name: "BOLETIM DE MEDIÇÃO 02", rows }]);
  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  const line = result.bulletin.lines.find((l) => l.serviceItemCode === "01.01.01");
  assertEqual(line !== undefined, true, "quantidade=0 com valor≠0 não deveria ser descartada");
  assertEqual(line?.declaredQuantity, 0);
  assertEqual(line?.declaredTotalValue, 250);
  assertEqual(result.success, true);
});

runTest("official_period_total_mismatch é blocking quando a soma das linhas não reconcilia com o total declarado pelo próprio boletim", () => {
  const rows = bulletinSheetRows().map((row) => row.slice()) as (string | number | null)[][];
  const totalRowIndex = rows.findIndex((row) => row[0] === "TOTAL GERAL (R$)");
  // Soma real do bloco oficial é 1499 (999 + 500) -- declara um total
  // divergente de propósito para provar que a invariante dispara.
  (rows[totalRowIndex] as (string | number | null)[])[7] = 999999;

  const bytes = buildBulletinFixture([{ name: "BOLETIM DE MEDIÇÃO 02", rows }]);
  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  const mismatchIssue = result.bulletin.issues.find((issue) => issue.code === "official_period_total_mismatch");
  assertEqual(mismatchIssue !== undefined, true, "esperava blocking issue de reconciliação");
  assertEqual(mismatchIssue?.severity, "blocking");
  assertEqual(mismatchIssue?.message.includes("1499.00"), true, "mensagem deveria conter a soma calculada");
  assertEqual(mismatchIssue?.message.includes("999999.00"), true, "mensagem deveria conter o total declarado pelo arquivo");
  assertEqual(result.success, false, "uma divergência de reconciliação nunca pode ser tratada como importação confiável");
  // As linhas continuam extraídas (para diagnóstico), só success é que vira false.
  assertEqual(result.bulletin.lines.length, 2);
});

runTest("official_period_total_mismatch também dispara (blocking) quando nenhuma linha de total é encontrada para confirmar a reconciliação", () => {
  const rows = bulletinSheetRows().map((row) => row.slice()) as (string | number | null)[][];
  const totalRowIndex = rows.findIndex((row) => row[0] === "TOTAL GERAL (R$)");
  rows.splice(totalRowIndex, 1); // remove a única linha de total do fixture.

  const bytes = buildBulletinFixture([{ name: "BOLETIM DE MEDIÇÃO 02", rows }]);
  const result = importBulletinExcel({ bytes, fileName: "boletim-teste.xlsx" });

  const mismatchIssue = result.bulletin.issues.find((issue) => issue.code === "official_period_total_mismatch");
  assertEqual(mismatchIssue !== undefined, true, "sem linha de total, a reconciliação não pode ser confirmada -- precisa virar issue, não passar em silêncio");
  assertEqual(mismatchIssue?.severity, "blocking");
  assertEqual(result.success, false);
});

runTest("retorna resultado vazio, sem lançar exceção, quando nenhuma aba reconhece o layout", () => {
  const bytes = buildBulletinFixture([{ name: "Planilha qualquer", rows: [["a", "b"], ["c", "d"]] }]);

  const result = importBulletinExcel({ bytes, fileName: "nao-e-boletim.xlsx" });

  assertEqual(result.success, false);
  assertEqual(result.bulletin.lines.length, 0);
  assertEqual(result.bulletin.issues.length > 0, true, "deveria explicar por que falhou, não falhar em silêncio");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message ?? "assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
