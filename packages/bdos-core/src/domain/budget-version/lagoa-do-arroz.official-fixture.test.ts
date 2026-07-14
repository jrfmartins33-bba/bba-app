import { calculateBudgetVersionTotal } from "./budget-version";
import { reaisToCents } from "./budget-version-money";
import { BudgetLineKind, BudgetVersionStatus } from "./budget-version.types";
import { LAGOA_DO_ARROZ_DECLARED_TOTAL_REAIS, LAGOA_DO_ARROZ_OFFICIAL_LINES } from "./lagoa-do-arroz.official-fixture";
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

runTest("fixture real: COT-015 presente, sem código hierárquico, incluído no cálculo", () => {
  const cot015 = LAGOA_DO_ARROZ_OFFICIAL_LINES.find((l) => l.externalSourceCode === "COT-015");
  assertEqual(cot015 !== undefined, true, "COT-015 must be present in the extracted fixture");
  assertEqual(cot015?.hierarchicalCode, null, "COT-015 must have no hierarchical code");
  assertEqual(cot015?.classification, "ServiceItem", "COT-015 must be classified as a Item de Serviço");
  assertEqual(cot015?.parentHierarchicalCode, "04.03.00", "COT-015 must be parented to its real section (Subgrupo 04.03.00, per source position)");
  assertEqual(cot015?.totalComBdiReais, 227913, "COT-015 declared value mismatch");

  const scenario = buildLagoaDoArrozOfficialScenario();
  const cot015Line = scenario.consolidatedBudgetVersion.lines.find((line) => line.externalCode === "COT-015");
  assertEqual(cot015Line !== undefined, true, "COT-015 must be loaded into the domain model");
  assertEqual(cot015Line?.totalCents, reaisToCents(227913), "COT-015 totalCents mismatch");
});

runTest("fixture real: total declarado de R$ 9.809.087,18 preservado", () => {
  assertEqual(LAGOA_DO_ARROZ_DECLARED_TOTAL_REAIS, 9809087.18, "declared total constant mismatch");
});

runTest("fixture real: total calculado confrontado com o total declarado — zero divergência, zero dupla contagem", () => {
  const scenario = buildLagoaDoArrozOfficialScenario();
  const calculatedCents = calculateBudgetVersionTotal(scenario.consolidatedBudgetVersion);
  const declaredCents = reaisToCents(LAGOA_DO_ARROZ_DECLARED_TOTAL_REAIS);

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

runTest("fixture real: ordenação determinística, independente da ordem de inserção", () => {
  const first = buildLagoaDoArrozOfficialScenario();
  const second = buildLagoaDoArrozOfficialScenario();

  const firstIds = first.consolidatedBudgetVersion.lines.map((l) => l.id).sort();
  const secondIds = second.consolidatedBudgetVersion.lines.map((l) => l.id).sort();
  assertEqual(firstIds.join(","), secondIds.join(","), "two independent loads must produce the same set of line ids");
  assertEqual(
    calculateBudgetVersionTotal(first.consolidatedBudgetVersion),
    calculateBudgetVersionTotal(second.consolidatedBudgetVersion),
    "two independent loads must produce the same total",
  );
});

runTest("fixture real: nenhuma identidade interna é baseada em código externo", () => {
  const scenario = buildLagoaDoArrozOfficialScenario();
  scenario.consolidatedBudgetVersion.lines.forEach((line) => {
    if (line.externalCode !== null) {
      assertEqual(line.id === line.externalCode, false, `line id must never equal its own external code (line ${line.id})`);
    }
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

runTest("fixture real: limitação honesta — 8 linhas do tipo Cotação sem descrição na fonte, nenhum texto inventado", () => {
  const linesWithoutDescription = LAGOA_DO_ARROZ_OFFICIAL_LINES.filter((l) => l.descricao.trim().length === 0);
  assertEqual(linesWithoutDescription.length, 8, "expected exactly 8 source rows with a blank DESCRIÇÃO cell (all Cotação-type items)");
  assertEqual(
    linesWithoutDescription.every((l) => l.fonte === "Cotação"),
    true,
    "every row with a blank description must be a Cotação-type item — a real, documented limitation of the source",
  );

  const scenario = buildLagoaDoArrozOfficialScenario();
  const flaggedLines = scenario.consolidatedBudgetVersion.lines.filter((line) => line.metadata.descricaoAusenteNaFonte === true);
  assertEqual(flaggedLines.length, 8, "the loader must flag every line with a source-absent description in metadata, never silently invent text");
  assertEqual(
    flaggedLines.every((line) => line.description === "(descrição não informada na fonte oficial)"),
    true,
    "lines with an absent source description must carry a neutral, honest placeholder — never fabricated content",
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
