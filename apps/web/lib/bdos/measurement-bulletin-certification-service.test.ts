import {
  certifyMeasurementBulletin,
  type MeasurementCertificationReader,
  type MeasurementCertificationWriter,
  type MeasurementCertifyCycle
} from "./measurement-bulletin-certification-service";

// "Revisar medição" -- teste direcionado (mock/fixture descartável,
// NUNCA o service-role real nem produção, per a regra de segurança da
// especificação): certificação abre confirmação/é uma ação explícita
// (aqui: nunca dispara sozinha -- só quando certifyMeasurementBulletin
// é chamada, e nunca do meio do teste), e a orquestração segue
// exatamente a sequência que advance_measurement_cycle aceita no
// banco -- nenhum pulo, nenhuma transição inventada.

const COMPANY_ID = "company-1";
const OCCURRED_AT = "2026-08-26T12:00:00.000Z";

interface FakeState {
  cycle: MeasurementCertifyCycle | null;
  sourceCount: number;
  bulletinStatus: "Draft" | "Validated" | "Finalized" | "Cancelled";
  writerCalls: string[];
}

function buildFakes(state: FakeState): { reader: MeasurementCertificationReader; writer: MeasurementCertificationWriter } {
  const reader: MeasurementCertificationReader = {
    async findWorkspaceByImportId() {
      return { id: "workspace-1", companyId: COMPANY_ID, engineeringProjectId: "project-1" };
    },
    async findBulletinByWorkspaceId() {
      return { id: "bulletin-1", status: state.bulletinStatus };
    },
    async findContractBaselineForProject() {
      return { id: "baseline-1" };
    },
    async findCycleByWorkspaceId() {
      return state.cycle;
    },
    async countLineSources() {
      return state.sourceCount;
    }
  };

  const writer: MeasurementCertificationWriter = {
    async createMeasurementCycle() {
      state.writerCalls.push("create");
      state.cycle = { id: "cycle-1", status: "draft", measurementBulletinId: null };
      return state.cycle;
    },
    async advanceMeasurementCycle(params) {
      state.writerCalls.push(`advance:${params.toStatus}`);
      state.cycle = { id: params.measurementCycleId, status: params.toStatus, measurementBulletinId: params.measurementBulletinId ?? state.cycle?.measurementBulletinId ?? null };
      return state.cycle;
    }
  };

  return { reader, writer };
}

async function main(): Promise<void> {
  await runTest("sem ciclo existente: cria o ciclo e avança draft->measured->bulletin_generated->certified, na ordem, sem pular etapa", async () => {
    const state: FakeState = { cycle: null, sourceCount: 15, bulletinStatus: "Finalized", writerCalls: [] };
    const { reader, writer } = buildFakes(state);

    const result = await certifyMeasurementBulletin(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, actorId: "actor-1", occurredAt: OCCURRED_AT },
      { reader, writer }
    );

    assertTrue(result.success);
    if (!result.success) return;
    assertEqual(result.certifiedCycle.status, "certified");
    assertEqual(
      JSON.stringify(state.writerCalls),
      JSON.stringify(["create", "advance:measured", "advance:bulletin_generated", "advance:certified"]),
      "sequência exata exigida pelo banco -- nenhum pulo"
    );
  });

  await runTest("ciclo já em bulletin_generated: só falta o último passo, nunca recria nem repete etapas já feitas", async () => {
    const state: FakeState = {
      cycle: { id: "cycle-1", status: "bulletin_generated", measurementBulletinId: "bulletin-1" },
      sourceCount: 15,
      bulletinStatus: "Finalized",
      writerCalls: []
    };
    const { reader, writer } = buildFakes(state);

    const result = await certifyMeasurementBulletin(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, actorId: "actor-1", occurredAt: OCCURRED_AT },
      { reader, writer }
    );

    assertTrue(result.success);
    if (!result.success) return;
    assertEqual(JSON.stringify(state.writerCalls), JSON.stringify(["advance:certified"]));
  });

  await runTest("ciclo já certified: already_certified, nenhuma chamada de escrita é feita", async () => {
    const state: FakeState = {
      cycle: { id: "cycle-1", status: "certified", measurementBulletinId: "bulletin-1" },
      sourceCount: 15,
      bulletinStatus: "Finalized",
      writerCalls: []
    };
    const { reader, writer } = buildFakes(state);

    const result = await certifyMeasurementBulletin(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, actorId: "actor-1", occurredAt: OCCURRED_AT },
      { reader, writer }
    );

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "already_certified");
    assertEqual(state.writerCalls.length, 0, "não deve escrever nada quando já está certificado");
  });

  await runTest("boletim ainda não Finalized: bulletin_not_finalized, nenhuma chamada de escrita é feita", async () => {
    const state: FakeState = { cycle: null, sourceCount: 0, bulletinStatus: "Validated", writerCalls: [] };
    const { reader, writer } = buildFakes(state);

    const result = await certifyMeasurementBulletin(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, actorId: "actor-1", occurredAt: OCCURRED_AT },
      { reader, writer }
    );

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "bulletin_not_finalized");
    assertEqual(state.writerCalls.length, 0);
  });

  await runTest("boletim Finalized sem nenhuma fonte registrada: bloqueado (registro só é possível antes da finalização) -- nunca tenta registrar de qualquer jeito", async () => {
    const state: FakeState = { cycle: null, sourceCount: 0, bulletinStatus: "Finalized", writerCalls: [] };
    const { reader, writer } = buildFakes(state);

    const result = await certifyMeasurementBulletin(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, actorId: "actor-1", occurredAt: OCCURRED_AT },
      { reader, writer }
    );

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "line_sources_missing_and_bulletin_already_finalized");
    assertEqual(JSON.stringify(state.writerCalls), JSON.stringify(["create", "advance:measured"]), "avança até onde é seguro, nunca tenta o passo bloqueado");
  });

  await runTest("contract_baseline_not_found: nenhuma chamada de escrita é feita", async () => {
    const state: FakeState = { cycle: null, sourceCount: 15, bulletinStatus: "Finalized", writerCalls: [] };
    const { reader, writer } = buildFakes(state);
    reader.findContractBaselineForProject = async () => null;

    const result = await certifyMeasurementBulletin(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, actorId: "actor-1", occurredAt: OCCURRED_AT },
      { reader, writer }
    );

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "contract_baseline_not_found");
    assertEqual(state.writerCalls.length, 0);
  });

  await runTest("workspace_not_found: nenhuma chamada de escrita é feita", async () => {
    const state: FakeState = { cycle: null, sourceCount: 15, bulletinStatus: "Finalized", writerCalls: [] };
    const { reader, writer } = buildFakes(state);
    reader.findWorkspaceByImportId = async () => null;

    const result = await certifyMeasurementBulletin(
      { measurementBulletinImportId: "import-1", companyId: COMPANY_ID, actorId: "actor-1", occurredAt: OCCURRED_AT },
      { reader, writer }
    );

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "workspace_not_found");
    assertEqual(state.writerCalls.length, 0);
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
