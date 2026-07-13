import { extractValidDecisionBrief, fetchMeasurementDecisionBrief } from "./measurement-decision-brief-client";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";

const VALID_BRIEF: DecisionBrief = {
  metadata: {
    schemaVersion: "1.0",
    builderVersion: "measurement-decision-brief-v1",
    sourceImportId: "import-1",
    generatedAt: "2026-07-12T10:00:00.000Z"
  },
  situation: { title: "Situação", body: "..." },
  executiveConclusion: { readiness: "ready", headline: "Pronto", body: "..." },
  keyDecisions: [],
  criticalItems: [],
  keyMetrics: [],
  details: { title: "Detalhes", body: "..." },
  nextActions: [],
  evidenceReferences: [],
  confidence: { status: "unavailable", reason: "calculation_model_not_defined" }
};

function fakeFetch(response: { status: number; ok: boolean; json?: () => Promise<unknown> }): typeof fetch {
  return (async () => ({
    status: response.status,
    ok: response.ok,
    json: response.json ?? (async () => ({}))
  })) as unknown as typeof fetch;
}

function throwingFetch(): typeof fetch {
  return (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
}

async function main(): Promise<void> {
  await runTest("chama a URL correta com o id corretamente interpolado", async () => {
    let calledUrl: unknown = null;
    const spyFetch = (async (url: unknown) => {
      calledUrl = url;
      return { status: 200, ok: true, json: async () => ({ data: VALID_BRIEF }) };
    }) as unknown as typeof fetch;

    await fetchMeasurementDecisionBrief("import-abc-123", spyFetch);
    assertEqual(calledUrl, "/api/measurement/imports/import-abc-123/decision-brief");
  });

  await runTest("200 com payload válido -- devolve o DecisionBrief tal como veio, sem normalizar", async () => {
    const outcome = await fetchMeasurementDecisionBrief("import-1", fakeFetch({ status: 200, ok: true, json: async () => ({ data: VALID_BRIEF }) }));
    assertEqual(outcome.kind, "ok");
    assertEqual(JSON.stringify((outcome as { kind: "ok"; brief: unknown }).brief), JSON.stringify(VALID_BRIEF));
  });

  await runTest("401 -- unauthenticated", async () => {
    const outcome = await fetchMeasurementDecisionBrief("import-1", fakeFetch({ status: 401, ok: false }));
    assertEqual(outcome.kind, "unauthenticated");
  });

  await runTest("404 -- not_found", async () => {
    const outcome = await fetchMeasurementDecisionBrief("import-1", fakeFetch({ status: 404, ok: false }));
    assertEqual(outcome.kind, "not_found");
  });

  await runTest("409 -- analysis_not_available", async () => {
    const outcome = await fetchMeasurementDecisionBrief("import-1", fakeFetch({ status: 409, ok: false }));
    assertEqual(outcome.kind, "analysis_not_available");
  });

  await runTest("500 -- technical_error", async () => {
    const outcome = await fetchMeasurementDecisionBrief("import-1", fakeFetch({ status: 500, ok: false }));
    assertEqual(outcome.kind, "technical_error");
  });

  await runTest("falha de rede -- technical_error, nunca propaga a exceção", async () => {
    const outcome = await fetchMeasurementDecisionBrief("import-1", throwingFetch());
    assertEqual(outcome.kind, "technical_error");
  });

  await runTest("200 com payload estruturalmente inválido -- technical_error, nunca Brief vazio/normalizado", async () => {
    const outcome = await fetchMeasurementDecisionBrief("import-1", fakeFetch({ status: 200, ok: true, json: async () => ({ data: { situation: {} } }) }));
    assertEqual(outcome.kind, "technical_error");
  });

  await runTest("200 com JSON inválido (json() rejeita) -- technical_error", async () => {
    const outcome = await fetchMeasurementDecisionBrief(
      "import-1",
      fakeFetch({
        status: 200,
        ok: true,
        json: async () => {
          throw new Error("invalid json");
        }
      })
    );
    assertEqual(outcome.kind, "technical_error");
  });

  await runTest("retry -- chamar novamente após erro com um fetch que agora funciona produz sucesso", async () => {
    const first = await fetchMeasurementDecisionBrief("import-1", fakeFetch({ status: 500, ok: false }));
    assertEqual(first.kind, "technical_error");

    const second = await fetchMeasurementDecisionBrief("import-1", fakeFetch({ status: 200, ok: true, json: async () => ({ data: VALID_BRIEF }) }));
    assertEqual(second.kind, "ok");
  });

  await runTest("extractValidDecisionBrief -- aceita um Brief real e completo", () => {
    assertTrue(extractValidDecisionBrief({ data: VALID_BRIEF }) !== null);
  });

  await runTest("extractValidDecisionBrief -- rejeita payload que não é objeto", () => {
    assertEqual(extractValidDecisionBrief("not an object"), null);
    assertEqual(extractValidDecisionBrief(null), null);
  });

  await runTest("extractValidDecisionBrief -- rejeita quando data não é objeto", () => {
    assertEqual(extractValidDecisionBrief({ data: "nope" }), null);
    assertEqual(extractValidDecisionBrief({}), null);
  });

  await runTest("extractValidDecisionBrief -- rejeita quando metadata está ausente", () => {
    const { metadata, ...withoutMetadata } = VALID_BRIEF;
    assertEqual(extractValidDecisionBrief({ data: withoutMetadata }), null);
  });

  await runTest("extractValidDecisionBrief -- rejeita quando executiveConclusion está ausente", () => {
    const { executiveConclusion, ...withoutConclusion } = VALID_BRIEF;
    assertEqual(extractValidDecisionBrief({ data: withoutConclusion }), null);
  });

  await runTest("extractValidDecisionBrief -- rejeita readiness fora dos quatro valores reais", () => {
    const invalid = { ...VALID_BRIEF, executiveConclusion: { ...VALID_BRIEF.executiveConclusion, readiness: "approved" } };
    assertEqual(extractValidDecisionBrief({ data: invalid }), null);
  });

  await runTest("extractValidDecisionBrief -- aceita generatedAt ISO 8601 válido", () => {
    assertTrue(extractValidDecisionBrief({ data: VALID_BRIEF }) !== null);
  });

  await runTest("extractValidDecisionBrief -- rejeita generatedAt ausente", () => {
    const invalid = { ...VALID_BRIEF, metadata: { ...VALID_BRIEF.metadata, generatedAt: undefined } };
    assertEqual(extractValidDecisionBrief({ data: invalid }), null);
  });

  await runTest("extractValidDecisionBrief -- rejeita generatedAt vazio", () => {
    const invalid = { ...VALID_BRIEF, metadata: { ...VALID_BRIEF.metadata, generatedAt: "   " } };
    assertEqual(extractValidDecisionBrief({ data: invalid }), null);
  });

  await runTest("extractValidDecisionBrief -- rejeita generatedAt não formatável como data", () => {
    const invalid = { ...VALID_BRIEF, metadata: { ...VALID_BRIEF.metadata, generatedAt: "não é uma data" } };
    assertEqual(extractValidDecisionBrief({ data: invalid }), null);
  });

  await runTest("nenhum generatedAt inválido chega ao estado loaded -- fetch devolve technical_error", async () => {
    const invalidBrief = { ...VALID_BRIEF, metadata: { ...VALID_BRIEF.metadata, generatedAt: "" } };
    const outcome = await fetchMeasurementDecisionBrief("import-1", fakeFetch({ status: 200, ok: true, json: async () => ({ data: invalidBrief }) }));
    assertEqual(outcome.kind, "technical_error");
  });
}

async function runTest(name: string, testCase: () => void | Promise<void>): Promise<void> {
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
