import { calculateBudgetVersionTotal } from "./budget-version";
import { centsFromDecimalString } from "./budget-version-money";
import { BudgetLineKind, BudgetVersionStatus } from "./budget-version.types";
import {
  LAGOA_DO_ARROZ_DECLARED_TOTAL_DECIMAL,
  LAGOA_DO_ARROZ_EXCLUDED_LINES,
  LAGOA_DO_ARROZ_OFFICIAL_LINES,
  LAGOA_DO_ARROZ_SOURCE_PROVENANCE,
} from "./lagoa-do-arroz.official-fixture";
import { ABSENT_DESCRIPTION_PRESENTATION_LABEL, buildLagoaDoArrozOfficialScenario } from "./lagoa-do-arroz.official-fixture-loader";

// Testes de aceitação da fixture REAL (planilha oficial DNOCS 90006/2025,
// aba "ORÇAMENTO") — ver proveniência completa no topo de
// lagoa-do-arroz.official-fixture.ts.

runTest("fixture real: 11 Grupos, 25 Subgrupos, 299 Itens com código, 1 sem código, 300 no total", () => {
  const grupos = LAGOA_DO_ARROZ_OFFICIAL_LINES.filter((l) => l.classification === "Grupo");
  const subgrupos = LAGOA_DO_ARROZ_OFFICIAL_LINES.filter((l) => l.classification === "Subgrupo");
  const itensComCodigo = LAGOA_DO_ARROZ_OFFICIAL_LINES.filter((l) => l.classification === "ServiceItem" && l.hierarchicalCode !== null);
  const itensSemCodigo = LAGOA_DO_ARROZ_OFFICIAL_LINES.filter((l) => l.classification === "ServiceItem" && l.hierarchicalCode === null);

  assertEqual(grupos.length, 11, "grupos count mismatch");
  assertEqual(subgrupos.length, 25, "subgrupos count mismatch");
  assertEqual(itensComCodigo.length, 299, "itens com código count mismatch");
  assertEqual(itensSemCodigo.length, 1, "itens sem código count mismatch");
  assertEqual(itensComCodigo.length + itensSemCodigo.length, 300, "total itens de serviço mismatch");
});

runTest("fixture real: COT-015 presente, sem código hierárquico, com método de resolução do pai registrado", () => {
  const cot015 = LAGOA_DO_ARROZ_OFFICIAL_LINES.find((l) => l.externalSourceCode === "COT-015");
  assertEqual(cot015 !== undefined, true, "COT-015 must be present in the extracted fixture");
  assertEqual(cot015?.hierarchicalCode, null, "COT-015 must have no hierarchical code of its own");
  assertEqual(cot015?.classification, "ServiceItem", "COT-015 must be classified as a Item de Serviço");
  assertEqual(cot015?.sourceRowNumber, 151, "COT-015 must be sourced from row 151");
  assertEqual(cot015?.parentHierarchicalCode, "04.03.00", "COT-015's parent must resolve to Subgrupo 04.03.00");
  assertEqual(
    cot015?.parentResolutionMethod,
    "DocumentPositionSection",
    "COT-015's parent relation is not explicitly coded on COT-015 itself — it is inferred from the section in effect at its document position",
  );
  assertEqual(cot015?.totalComBdiReais, "227913", "COT-015 declared value mismatch");

  const scenario = buildLagoaDoArrozOfficialScenario();
  const cot015Line = scenario.consolidatedBudgetVersion.lines.find((line) => line.externalCode === "COT-015");
  assertEqual(cot015Line !== undefined, true, "COT-015 must be loaded into the domain model");
  assertEqual(cot015Line?.totalCents, centsFromDecimalString("227913"), "COT-015 totalCents mismatch");
  assertEqual(cot015Line?.metadata.parentResolutionMethod, "DocumentPositionSection", "loaded line must preserve the parent resolution method in metadata");
});

runTest("fixture real: total declarado de R$ 9.809.087,18 preservado como texto decimal exato", () => {
  assertEqual(LAGOA_DO_ARROZ_DECLARED_TOTAL_DECIMAL, "9809087.18", "declared total constant mismatch");
});

runTest("fixture real: total calculado confrontado com o total declarado — zero divergência, zero dupla contagem, sem arredondamento", () => {
  const scenario = buildLagoaDoArrozOfficialScenario();
  const calculatedCents = calculateBudgetVersionTotal(scenario.consolidatedBudgetVersion);
  const declaredCents = centsFromDecimalString(LAGOA_DO_ARROZ_DECLARED_TOTAL_DECIMAL);

  assertEqual(calculatedCents, declaredCents, `calculated total (${calculatedCents} cents) must match declared total (${declaredCents} cents) — any divergence must be reported, not silently corrected`);
});

runTest("fixture real: hierarquia válida — nenhuma linha órfã, nenhum ciclo, classificações compatíveis", () => {
  const scenario = buildLagoaDoArrozOfficialScenario();
  const lines = scenario.consolidatedBudgetVersion.lines;

  assertEqual(lines.length, 336, "expected 11 + 25 + 300 = 336 lines loaded");

  const byId = new Map(lines.map((line) => [line.id, line]));
  lines.forEach((line) => {
    if (line.parentLineId !== null) {
      const parent = byId.get(line.parentLineId);
      assertEqual(parent !== undefined, true, `line ${line.id} references a parent that does not exist`);

      if (line.kind === BudgetLineKind.Subgroup) {
        assertEqual(parent?.kind, BudgetLineKind.Group, `Subgrupo ${line.id} must have a Grupo as parent`);
      }
      if (line.kind === BudgetLineKind.ServiceItem) {
        const parentKindIsValid = parent?.kind === BudgetLineKind.Group || parent?.kind === BudgetLineKind.Subgroup;
        assertEqual(parentKindIsValid, true, `Item de Serviço ${line.id} must have a Grupo or Subgrupo as parent`);
      }
    } else {
      assertEqual(line.kind, BudgetLineKind.Group, `only Grupo may have no parent (line ${line.id})`);
    }
  });
});

runTest("fixture real: reconciliação 347 = 336 incluídas + 11 excluídas, sem duplicatas, sem linha sem destino", () => {
  assertEqual(LAGOA_DO_ARROZ_SOURCE_PROVENANCE.totalExaminedRows, 347, "total examined rows mismatch");
  assertEqual(LAGOA_DO_ARROZ_OFFICIAL_LINES.length, 336, "included lines mismatch");
  assertEqual(LAGOA_DO_ARROZ_EXCLUDED_LINES.length, 11, "excluded lines mismatch");
  assertEqual(
    LAGOA_DO_ARROZ_OFFICIAL_LINES.length + LAGOA_DO_ARROZ_EXCLUDED_LINES.length,
    347,
    "336 + 11 must equal the 347 rows actually examined",
  );

  const includedRowNumbers = LAGOA_DO_ARROZ_OFFICIAL_LINES.map((l) => l.sourceRowNumber);
  const excludedRowNumbers = LAGOA_DO_ARROZ_EXCLUDED_LINES.map((l) => l.sourceRowNumber);
  const allRowNumbers = [...includedRowNumbers, ...excludedRowNumbers];

  assertEqual(new Set(allRowNumbers).size, allRowNumbers.length, "no row number may appear twice across included + excluded");

  const expectedRowNumbers = new Set<number>();
  for (let row = 6; row <= 352; row++) expectedRowNumbers.add(row);
  const coveredRowNumbers = new Set(allRowNumbers);
  assertEqual(coveredRowNumbers.size, expectedRowNumbers.size, "every examined row (6-352) must have a known destination");
  expectedRowNumbers.forEach((row) => {
    assertEqual(coveredRowNumbers.has(row), true, `row ${row} has no known destination (neither included nor excluded)`);
  });

  assertEqual(LAGOA_DO_ARROZ_SOURCE_PROVENANCE.totalRowNumber, 353, "row 353 (TOTAL GERAL) must be tracked separately, outside the 6-352 examined range");

  LAGOA_DO_ARROZ_EXCLUDED_LINES.forEach((excluded) => {
    assertEqual(
      excluded.reason === "BlankSeparatorRow" || excluded.reason === "DocumentaryFootnote" || excluded.reason === "ZeroValueArtifactRow",
      true,
      `excluded row ${excluded.sourceRowNumber} must carry one of the three known exclusion reasons`,
    );
    assertEqual(
      excluded.classificacaoDocumentalObservada.length > 0,
      true,
      `excluded row ${excluded.sourceRowNumber} must carry an observed documentary classification`,
    );
  });
});

runTest("fixture real: ordenação é governada pela posição declarada, não pela ordem de inserção", () => {
  const documentary = buildLagoaDoArrozOfficialScenario({ siblingInsertionOrder: "Documentary" });
  const reversedSiblings = buildLagoaDoArrozOfficialScenario({ siblingInsertionOrder: "ReversedWithinSiblings" });

  // Confirma que a segunda estratégia realmente inseriu em ordem diferente
  // internamente (não é um no-op disfarçado) — verificado indiretamente:
  // como as duas cargas usam identificadores estáveis por linha de origem
  // (não pela ordem de inserção), a igualdade abaixo só se sustenta porque
  // `orderedChildren`/a leitura por posição recupera a mesma estrutura
  // final independentemente de como cada carga inseriu as linhas.
  const byId = (lines: typeof documentary.consolidatedBudgetVersion.lines) => new Map(lines.map((l) => [l.id, l]));
  const documentaryById = byId(documentary.consolidatedBudgetVersion.lines);
  const reversedById = byId(reversedSiblings.consolidatedBudgetVersion.lines);

  assertEqual(documentaryById.size, reversedById.size, "both loads must produce the same number of lines");

  documentaryById.forEach((line, id) => {
    const counterpart = reversedById.get(id);
    assertEqual(counterpart !== undefined, true, `line ${id} present in documentary load must also exist in the reversed-siblings load`);
    assertEqual(counterpart?.parentLineId, line.parentLineId, `line ${id}: parentLineId must match regardless of insertion order`);
    assertEqual(counterpart?.position, line.position, `line ${id}: position must match regardless of insertion order — position is declared, not inferred from insertion sequence`);
    assertEqual(counterpart?.kind, line.kind, `line ${id}: kind must match`);
    assertEqual(counterpart?.scope.procurementCaseId, line.scope.procurementCaseId, `line ${id}: scope must match`);
    assertEqual(counterpart?.totalCents, line.totalCents, `line ${id}: totalCents must match`);
  });

  assertEqual(
    documentary.consolidatedBudgetVersion.status,
    reversedSiblings.consolidatedBudgetVersion.status,
    "both loads must reach Consolidated status",
  );
  assertEqual(
    calculateBudgetVersionTotal(documentary.consolidatedBudgetVersion),
    calculateBudgetVersionTotal(reversedSiblings.consolidatedBudgetVersion),
    "both loads must produce the same total, regardless of sibling insertion order",
  );

  // A leitura ordenada (orderedChildren, indiretamente via a posição
  // registrada em cada linha) deve produzir a mesma sequência final de
  // irmãos em ambas as cargas, mesmo tendo sido inseridas em sequências
  // opostas.
  const rootGroupsDocumentary = documentary.consolidatedBudgetVersion.lines
    .filter((l) => l.parentLineId === null)
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((l) => l.id);
  const rootGroupsReversed = reversedSiblings.consolidatedBudgetVersion.lines
    .filter((l) => l.parentLineId === null)
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((l) => l.id);
  assertEqual(rootGroupsDocumentary.join(","), rootGroupsReversed.join(","), "final position-ordered sequence of root Grupos must be identical between the two insertion strategies");
});

runTest("fixture real: identidade interna nunca é derivada de código externo, descrição ou posição da fonte", () => {
  const scenario = buildLagoaDoArrozOfficialScenario();
  scenario.consolidatedBudgetVersion.lines.forEach((line) => {
    if (line.externalCode !== null) {
      assertEqual(line.id === line.externalCode, false, `line id must never equal its own external code (line ${line.id})`);
      assertEqual(line.id.includes(line.externalCode), false, `line id must never contain its own external code (line ${line.id})`);
    }

    const sourceRowNumber = line.metadata.sourceRowNumber;
    assertEqual(typeof sourceRowNumber, "number", `line ${line.id} must preserve sourceRowNumber as provenance metadata`);
    assertEqual(line.id.includes(String(sourceRowNumber)), false, `line id must not be derived from its sourceRowNumber (line ${line.id}, row ${sourceRowNumber})`);
  });
});

runTest("fixture real: nenhuma linha perdida durante a conversão", () => {
  const scenario = buildLagoaDoArrozOfficialScenario();
  assertEqual(scenario.consolidatedBudgetVersion.lines.length, LAGOA_DO_ARROZ_OFFICIAL_LINES.length, "every extracted source line must produce exactly one BudgetLine");
});

runTest("fixture real: carrega, consolida e torna-se imutável sem violar os invariantes da Sprint 21.3B", () => {
  const scenario = buildLagoaDoArrozOfficialScenario();
  assertEqual(scenario.consolidatedBudgetVersion.status, BudgetVersionStatus.Consolidated, "expected consolidated status");
  assertEqual(scenario.consolidatedBudgetVersion.procurementCaseId, scenario.procurementCase.id, "version must belong to the loaded Processo");
  assertEqual(scenario.scope.procurementCaseId, scenario.procurementCase.id, "scope must reference the same Processo — whole case, since the source declares no lots");
});

runTest("fixture real: lacuna documental de descrição — estado explícito preservado, nenhum texto inventado na fixture", () => {
  const linesWithAbsentDescription = LAGOA_DO_ARROZ_OFFICIAL_LINES.filter((l) => l.descricao.status === "AbsentFromSource");
  assertEqual(linesWithAbsentDescription.length, 8, "expected exactly 8 source rows with status AbsentFromSource (all Cotação-type items)");
  assertEqual(
    linesWithAbsentDescription.every((l) => l.fonte === "Cotação"),
    true,
    "every line with an absent description must be a Cotação-type item — a real, documented limitation of the source",
  );
  linesWithAbsentDescription.forEach((l) => {
    assertEqual("text" in l.descricao, false, `AbsentFromSource line (row ${l.sourceRowNumber}) must carry no text field at all`);
  });

  const linesWithConfirmedDescription = LAGOA_DO_ARROZ_OFFICIAL_LINES.filter((l) => l.descricao.status === "ConfirmedFromSource");
  assertEqual(linesWithConfirmedDescription.length, 336 - 8, "confirmed-description lines mismatch");

  // O rótulo de apresentação só existe no carregador, nunca na fixture —
  // e mesmo carregado no domínio, não pode ser confundido com descrição
  // confirmada: a proveniência (descricaoConfirmadaNaFonte) preserva o
  // estado real distintamente do texto exibido.
  const scenario = buildLagoaDoArrozOfficialScenario();
  const flaggedLines = scenario.consolidatedBudgetVersion.lines.filter((line) => line.metadata.descricaoConfirmadaNaFonte === false);
  assertEqual(flaggedLines.length, 8, "the loader must flag every line with a source-absent description as descricaoConfirmadaNaFonte: false");
  assertEqual(
    flaggedLines.every((line) => line.description === ABSENT_DESCRIPTION_PRESENTATION_LABEL),
    true,
    "lines with an absent source description must carry the derived presentation label — never fabricated content, and always distinguishable via descricaoConfirmadaNaFonte",
  );

  const confirmedLines = scenario.consolidatedBudgetVersion.lines.filter((line) => line.metadata.descricaoConfirmadaNaFonte === true);
  assertEqual(
    confirmedLines.every((line) => line.description !== ABSENT_DESCRIPTION_PRESENTATION_LABEL),
    true,
    "a confirmed description must never equal the absence-presentation label",
  );
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
