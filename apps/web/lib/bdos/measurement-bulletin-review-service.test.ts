import type { DecisionBriefCriticalItem } from "@bba/bdos-core/decision-brief";
import {
  getMeasurementBulletinReview,
  type MeasurementBulletinReviewReader
} from "./measurement-bulletin-review-service";

// "Revisar medição" -- teste direcionado (não suíte geral): itens
// reais mostrados sem truncar/fundir, origem consultável por item,
// total vindo do backend (sem recálculo), e materialidade herdada do
// DecisionBrief (nunca reclassificada aqui).

const COMPANY_ID = "company-1";

const BULLETIN_LINES = [
  {
    id: "line-1",
    serviceItemCode: "01.02.03",
    description: "Escavação mecanizada",
    unit: "m3",
    quantity: 120.5,
    unitValue: 45.3,
    totalValue: 5458.65,
    canonicalQuantity: "120.5000",
    canonicalUnitValue: "45.30",
    canonicalTotalValue: "5458.65"
  },
  {
    id: "line-2",
    serviceItemCode: "02.01.01",
    description: "Concreto armado fck=25MPa",
    unit: "m3",
    quantity: 30,
    unitValue: 890,
    totalValue: 26700,
    canonicalQuantity: "30.0000",
    canonicalUnitValue: "890.00",
    canonicalTotalValue: "26700.00"
  }
];

function buildReader(overrides: Partial<MeasurementBulletinReviewReader> = {}): MeasurementBulletinReviewReader {
  return {
    async findWorkspaceByImportId() {
      return { id: "workspace-1" };
    },
    async findBulletinByWorkspaceId() {
      return {
        id: "bulletin-1",
        bulletinNumber: 8,
        status: "Finalized",
        header: { startDate: "2026-06-01", endDate: "2026-06-30", technicalResponsibleName: "Eng. Ana Paula" },
        totals: { canonicalTotalValue: "32158.65" },
        lines: BULLETIN_LINES
      };
    },
    async listWorkspaceLines() {
      return [
        { id: "wline-1", sourceSheetName: "BOLETIM DE MEDIÇÃO 08", sourceRowNumber: 12, sourcePhysicalColumn: "D", sourceFinancialColumn: "F" },
        { id: "wline-2", sourceSheetName: null, sourceRowNumber: null, sourcePhysicalColumn: null, sourceFinancialColumn: null }
      ];
    },
    async listLineSources() {
      return [
        { bulletinLineId: "line-1", measurementWorkspaceLineId: "wline-1" },
        { bulletinLineId: "line-2", measurementWorkspaceLineId: "wline-2" }
      ];
    },
    async findCycleByWorkspaceId() {
      return null;
    },
    ...overrides
  };
}

function criticalItem(materiality: "material" | "technical_observation", id: string): DecisionBriefCriticalItem {
  return {
    id,
    severity: "warning",
    materiality,
    title: `Ocorrência ${id}`,
    body: "Detalhe técnico.",
    consequenceIfAddressed: null,
    consequenceIfIgnored: materiality === "technical_observation" ? "Tratado automaticamente pelo BDOS." : "Impacta o valor.",
    evidenceReferences: []
  };
}

async function main(): Promise<void> {
  await runTest("itens reais são devolvidos com código/descrição/unidade/quantidade/preço/valor, sem truncar nenhum", async () => {
    const reader = buildReader();
    const result = await getMeasurementBulletinReview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, criticalItems: [] },
      { reader }
    );
    assertTrue(result.success);
    if (!result.success) return;

    assertEqual(result.review.items.length, 2, "os dois itens do boletim devem aparecer, nenhum omitido");
    assertEqual(result.review.itemCount, 2);
    assertEqual(result.review.items[0]?.code, "01.02.03");
    assertEqual(result.review.items[0]?.description, "Escavação mecanizada");
    assertEqual(result.review.items[0]?.unit, "m3");
    assertEqual(result.review.items[0]?.quantityDecimal, "120.5000");
    assertEqual(result.review.items[0]?.unitValueDecimal, "45.30");
    assertEqual(result.review.items[0]?.valueDecimal, "5458.65");
  });

  await runTest("total vem literalmente de totals.canonicalTotalValue -- nunca somado a partir das linhas no serviço", async () => {
    const reader = buildReader();
    const result = await getMeasurementBulletinReview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, criticalItems: [] },
      { reader }
    );
    assertTrue(result.success);
    if (!result.success) return;
    assertEqual(result.review.totalValueDecimal, "32158.65", "total é o valor persistido, não 5458.65+26700.00 recalculado aqui");
  });

  await runTest("origem (Ver origem): item com fonte relacional carrega evidenceReferences reais; item sem sourceSheetName não carrega nenhuma", async () => {
    const reader = buildReader();
    const result = await getMeasurementBulletinReview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, criticalItems: [] },
      { reader }
    );
    assertTrue(result.success);
    if (!result.success) return;

    const firstItem = result.review.items.find((item) => item.id === "line-1");
    assertTrue((firstItem?.evidenceReferences.length ?? 0) > 0, "linha com sourceSheetName/sourceRowNumber deve gerar referência de origem");
    assertEqual(firstItem?.evidenceReferences[0]?.locator.sheetName, "BOLETIM DE MEDIÇÃO 08");
    assertEqual(firstItem?.evidenceReferences[0]?.locator.row, 12);
    assertEqual(firstItem?.evidenceReferences[0]?.sourceId, "import-1", "sourceId é o measurementBulletinImportId, nunca um id técnico da linha");

    const secondItem = result.review.items.find((item) => item.id === "line-2");
    assertEqual(secondItem?.evidenceReferences.length, 0, "sem sourceSheetName/sourceRowNumber, nenhuma origem inventada");
  });

  await runTest("materialidade é herdada de criticalItems (DecisionBrief) -- nunca reclassificada por este serviço", async () => {
    const reader = buildReader();
    const criticalItems = [criticalItem("material", "a"), criticalItem("technical_observation", "b"), criticalItem("technical_observation", "c")];

    const result = await getMeasurementBulletinReview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, criticalItems },
      { reader }
    );
    assertTrue(result.success);
    if (!result.success) return;

    assertEqual(result.review.materialDivergenceCount, 1);
    assertEqual(result.review.technicalObservationCount, 2);
    assertEqual(result.review.technicalObservations.length, 2, "os itens de observação técnica em si (não só a contagem) são devolvidos, para a tela poder detalhar sob demanda");
    assertTrue(result.review.technicalObservations.every((item) => item.materiality === "technical_observation"));
  });

  await runTest("workspace_not_found quando o reader não encontra o workspace pelo importId", async () => {
    const reader = buildReader({ async findWorkspaceByImportId() { return null; } });
    const result = await getMeasurementBulletinReview(
      { measurementBulletinImportId: "id-inexistente", companyId: COMPANY_ID, criticalItems: [] },
      { reader }
    );
    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "workspace_not_found");
  });

  await runTest("bulletin_not_formalized quando o workspace existe mas ainda não tem boletim formal", async () => {
    const reader = buildReader({ async findBulletinByWorkspaceId() { return null; } });
    const result = await getMeasurementBulletinReview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, criticalItems: [] },
      { reader }
    );
    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "bulletin_not_formalized");
  });

  await runTest("certified reflete o ciclo (certified/closed), nunca inferido do status do boletim", async () => {
    const readerCertified = buildReader({ async findCycleByWorkspaceId() { return { status: "certified" }; } });
    const resultCertified = await getMeasurementBulletinReview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, criticalItems: [] },
      { reader: readerCertified }
    );
    assertTrue(resultCertified.success);
    if (resultCertified.success) assertEqual(resultCertified.review.certified, true);

    const readerNotCertified = buildReader({ async findCycleByWorkspaceId() { return { status: "bulletin_generated" }; } });
    const resultNotCertified = await getMeasurementBulletinReview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, criticalItems: [] },
      { reader: readerNotCertified }
    );
    assertTrue(resultNotCertified.success);
    if (resultNotCertified.success) assertEqual(resultNotCertified.review.certified, false);
  });
}

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message ?? "esperava true, recebeu false");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
