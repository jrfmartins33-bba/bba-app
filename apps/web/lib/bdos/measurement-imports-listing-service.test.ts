import { listMeasurementImports, type MeasurementImportListItem, type MeasurementImportsListReader } from "./measurement-imports-listing-service";

// Epic 20, Sprint 20.1E.1A -- testa listMeasurementImports contra um
// fake reader (sem Supabase), mesmo padrão já corrigido no 20.1C/D.

const COMPANY_ID = "company-1";

const SAMPLE_ITEM: MeasurementImportListItem = {
  measurementBulletinImportId: "import-1",
  humanLabel: "BM_08_LAGOA DO ARROZ_R_00.xlsx",
  status: "completed",
  createdAt: "2026-07-10T10:00:00.000Z",
  updatedAt: "2026-07-10T10:05:00.000Z",
  analysisAvailable: true
};

interface FakeReader extends MeasurementImportsListReader {
  readonly calls: Array<{ companyId: string }>;
}

function createFakeReader(itemsByCompany: Record<string, ReadonlyArray<MeasurementImportListItem>>): FakeReader {
  const calls: Array<{ companyId: string }> = [];
  return {
    calls,
    async listByCompany(input) {
      calls.push(input);
      return itemsByCompany[input.companyId] ?? [];
    }
  };
}

async function main(): Promise<void> {
  await runTest("devolve os itens do reader para a company informada, sem transformação", async () => {
    const reader = createFakeReader({ [COMPANY_ID]: [SAMPLE_ITEM] });

    const items = await listMeasurementImports({ companyId: COMPANY_ID }, { importsListReader: reader });

    assertEqual(JSON.stringify(items), JSON.stringify([SAMPLE_ITEM]), "nenhuma interpretação -- passthrough exato do reader");
    assertEqual(reader.calls.length, 1, "reader chamado uma única vez");
    assertEqual(JSON.stringify(reader.calls[0]), JSON.stringify({ companyId: COMPANY_ID }), "reader chamado com companyId correto");
  });

  await runTest("company sem registros devolve lista vazia, nunca erro", async () => {
    const reader = createFakeReader({});

    const items = await listMeasurementImports({ companyId: COMPANY_ID }, { importsListReader: reader });

    assertEqual(items.length, 0);
  });

  await runTest("nenhuma interpretação de analysis_result -- analysisAvailable vem pronto do reader", async () => {
    const reader = createFakeReader({
      [COMPANY_ID]: [
        { ...SAMPLE_ITEM, measurementBulletinImportId: "import-failed", status: "failed", analysisAvailable: true },
        { ...SAMPLE_ITEM, measurementBulletinImportId: "import-pending", status: "uploaded", analysisAvailable: false }
      ]
    });

    const items = await listMeasurementImports({ companyId: COMPANY_ID }, { importsListReader: reader });

    assertEqual(items.length, 2);
    assertEqual(items[0]!.status, "failed");
    assertEqual(items[0]!.analysisAvailable, true, "failed com analysis_result presente ainda é analysisAvailable=true -- não recalculado aqui");
    assertEqual(items[1]!.analysisAvailable, false);
  });

  await runTest("ausência de label humano permanece null, nunca inventado", async () => {
    const reader = createFakeReader({ [COMPANY_ID]: [{ ...SAMPLE_ITEM, humanLabel: null }] });

    const items = await listMeasurementImports({ companyId: COMPANY_ID }, { importsListReader: reader });

    assertEqual(items[0]!.humanLabel, null);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
