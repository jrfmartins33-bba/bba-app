import {
  getMeasurementCertificationPreview,
  type MeasurementCertificationPreviewReader
} from "./measurement-bulletin-certification-preview-service";

// "Revisar medição" -- teste direcionado: a prévia mostra
// acumulado-antes/valor-desta-medição/acumulado-depois/saldo-contratual
// -- tudo calculado aqui (servidor), aritmética decimal exata (nunca
// ponto flutuante), nunca no frontend.

const COMPANY_ID = "company-1";

function buildReader(overrides: Partial<MeasurementCertificationPreviewReader> = {}): MeasurementCertificationPreviewReader {
  return {
    async findWorkspaceByImportId() {
      return { id: "workspace-1", companyId: COMPANY_ID, engineeringProjectId: "project-1" };
    },
    async findBulletinByWorkspaceId() {
      return {
        id: "bulletin-1",
        bulletinNumber: 8,
        status: "Finalized",
        header: { startDate: "2026-06-01", endDate: "2026-06-30", technicalResponsibleName: "Eng. Ana Paula" },
        totals: { canonicalTotalValue: "252654.78" },
        lineCount: 15,
        sourceCount: 15
      };
    },
    async findContractBaselineForProject() {
      return { id: "baseline-1", contractedValueCents: 500000000 };
    },
    async listCertifiedBulletinTotalsForContractBaseline() {
      return [];
    },
    ...overrides
  };
}

async function main(): Promise<void> {
  await runTest("primeira medição do contrato (nenhum boletim certificado antes): acumulado antes = 0, depois = valor desta medição, saldo = contrato - valor desta medição", async () => {
    const reader = buildReader();
    const result = await getMeasurementCertificationPreview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, materialDivergenceCount: 0 },
      { reader }
    );
    assertTrue(result.success);
    if (!result.success) return;

    assertEqual(result.preview.measurementValueDecimal, "252654.78");
    assertEqual(result.preview.accumulatedBeforeDecimal, "0.00", "sem certificações anteriores, acumulado antes é zero");
    assertEqual(result.preview.accumulatedAfterDecimal, "252654.78");
    // contrato = 5.000.000,00 (500000000 cents); saldo = 5000000.00 - 252654.78
    assertEqual(result.preview.contractBalanceAfterDecimal, "4747345.22");
  });

  await runTest("com boletins já certificados no mesmo contrato: acumulado antes soma os outros, exclui o próprio boletim em revisão", async () => {
    const reader = buildReader({
      async listCertifiedBulletinTotalsForContractBaseline(query) {
        assertEqual(query.excludingMeasurementBulletinId, "bulletin-1", "o próprio boletim em revisão nunca deve entrar na soma dos 'anteriores'");
        return [{ totalValueDecimal: "100000.00" }, { totalValueDecimal: "50000.50" }];
      }
    });

    const result = await getMeasurementCertificationPreview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, materialDivergenceCount: 0 },
      { reader }
    );
    assertTrue(result.success);
    if (!result.success) return;

    assertEqual(result.preview.accumulatedBeforeDecimal, "150000.50");
    assertEqual(result.preview.accumulatedAfterDecimal, "402655.28");
  });

  await runTest("contract_baseline_not_found quando o projeto não tem nenhum contrato -- nunca escolhido arbitrariamente", async () => {
    const reader = buildReader({ async findContractBaselineForProject() { return null; } });
    const result = await getMeasurementCertificationPreview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, materialDivergenceCount: 0 },
      { reader }
    );
    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "contract_baseline_not_found");
  });

  await runTest("materialDivergenceCount é repassado verbatim -- nunca recalculado por este serviço", async () => {
    const reader = buildReader();
    const result = await getMeasurementCertificationPreview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, materialDivergenceCount: 3 },
      { reader }
    );
    assertTrue(result.success);
    if (!result.success) return;
    assertEqual(result.preview.materialDivergenceCount, 3);
  });

  await runTest("bulletin_not_formalized quando o boletim ainda não existe", async () => {
    const reader = buildReader({ async findBulletinByWorkspaceId() { return null; } });
    const result = await getMeasurementCertificationPreview(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, materialDivergenceCount: 0 },
      { reader }
    );
    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "bulletin_not_formalized");
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
