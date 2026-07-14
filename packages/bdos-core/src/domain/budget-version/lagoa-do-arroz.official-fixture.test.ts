import { calculateBudgetVersionTotal } from "./budget-version";
import { centsFromDecimalString } from "./budget-version-money";
import { BudgetLineKind, BudgetVersionStatus } from "./budget-version.types";
import {
  LAGOA_DO_ARROZ_DECLARED_TOTAL_DECIMAL,
  LAGOA_DO_ARROZ_EXCLUDED_LINES,
  LAGOA_DO_ARROZ_OFFICIAL_LINES,
  LAGOA_DO_ARROZ_SOURCE_PROVENANCE,
} from "./lagoa-do-arroz.official-fixture";
import { buildLagoaDoArrozOfficialScenario } from "./lagoa-do-arroz.official-fixture-loader";

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

runTest("fixture real: identidade opaca é preservada mesmo com a fixture reorganizada (índice do array irrelevante)", () => {
  const shuffled = [...LAGOA_DO_ARROZ_OFFICIAL_LINES].reverse();
  assertEqual(
    shuffled.map((l) => l.sourceRowNumber).join(",") === LAGOA_DO_ARROZ_OFFICIAL_LINES.map((l) => l.sourceRowNumber).join(","),
    false,
    "precondition: the shuffled copy must actually be in a different array order",
  );

  const fromOriginalOrder = buildLagoaDoArrozOfficialScenario();
  const fromShuffledOrder = buildLagoaDoArrozOfficialScenario({ lines: shuffled });

  const idsBySourceRow = new Map(LAGOA_DO_ARROZ_OFFICIAL_LINES.map((l) => [l.sourceRowNumber, l.fixtureLineId]));

  fromOriginalOrder.consolidatedBudgetVersion.lines.forEach((line) => {
    const sourceRowNumber = line.metadata.sourceRowNumber as number;
    assertEqual(line.id, idsBySourceRow.get(sourceRowNumber), `line for row ${sourceRowNumber} must carry the fixture's own fixtureLineId, not one derived from array position`);
  });

  const originalIds = new Set(fromOriginalOrder.consolidatedBudgetVersion.lines.map((l) => l.id));
  const shuffledIds = new Set(fromShuffledOrder.consolidatedBudgetVersion.lines.map((l) => l.id));
  assertEqual(originalIds.size, shuffledIds.size, "both loads must produce the same number of distinct identities");
  originalIds.forEach((id) => {
    assertEqual(shuffledIds.has(id), true, `identity ${id} from the original-order load must also be present in the shuffled-order load — identity does not depend on array index`);
  });
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

runTest("fixture real: identidade interna nunca é derivada de código externo, descrição ou posição da fonte", () => {
  const scenario = buildLagoaDoArrozOfficialScenario();
  scenario.consolidatedBudgetVersion.lines.forEach((line) => {
    // A identidade é um UUID opaco (fixtureLineId) — a própria forma já
    // comprova que não é, nem poderia ser, igual ao código externo, à
    // descrição, ou a uma string simples derivada da posição/linha da
    // fonte (uma substring numérica isolada, como "6" para a linha 6,
    // ocorreria por coincidência em qualquer UUID — não é um teste válido
    // de derivação; a forma UUID em si é a prova).
    assertEqual(UUID_PATTERN.test(line.id), true, `line id "${line.id}" must be an opaque UUID, unrelated to external code, description, or source position`);

    if (line.externalCode !== null) {
      assertEqual(line.id === line.externalCode, false, `line id must never equal its own external code (line ${line.id})`);
    }

    const sourceRowNumber = line.metadata.sourceRowNumber;
    assertEqual(typeof sourceRowNumber, "number", `line ${line.id} must preserve sourceRowNumber as provenance metadata`);
    assertEqual(line.id === String(sourceRowNumber), false, `line id must not equal its sourceRowNumber (line ${line.id}, row ${sourceRowNumber})`);
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

runTest("fixture real: lacuna documental de descrição — estado explícito no domínio, nenhum rótulo produzido pela fixture", () => {
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

  // O domínio (BudgetLine.description) preserva a mesma união discriminada,
  // sem produzir rótulo algum — o carregador mapeia diretamente
  // "ConfirmedFromSource"/"AbsentFromSource" da fixture para
  // "Confirmed"/"AbsentFromSource" do domínio.
  const scenario = buildLagoaDoArrozOfficialScenario();
  const absentInDomain = scenario.consolidatedBudgetVersion.lines.filter((line) => line.description.status === "AbsentFromSource");
  assertEqual(absentInDomain.length, 8, "the domain model must preserve exactly 8 lines with an AbsentFromSource description");
  absentInDomain.forEach((line) => {
    assertEqual("text" in line.description, false, `line ${line.id}: an AbsentFromSource BudgetLineDescription must carry no text field`);
  });

  const confirmedInDomain = scenario.consolidatedBudgetVersion.lines.filter((line) => line.description.status === "Confirmed");
  assertEqual(confirmedInDomain.length, 336 - 8, "the domain model must preserve exactly 328 lines with a Confirmed description");
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
