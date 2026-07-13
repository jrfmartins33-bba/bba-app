import { fetchMeasurementImports } from "./measurement-imports-client";
import type { MeasurementImportListItem } from "../../lib/bdos/measurement-imports-listing-service";

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
  await runTest("chama fetch para /api/measurement/imports", async () => {
    let calledUrl: unknown = null;
    const spyFetch = (async (url: unknown) => {
      calledUrl = url;
      return { status: 200, ok: true, json: async () => ({ imports: [] }) };
    }) as unknown as typeof fetch;

    await fetchMeasurementImports(spyFetch);
    assertEqual(calledUrl, "/api/measurement/imports");
  });

  await runTest("200 com lista -- preserva a ordem exata devolvida pela API (não reordena)", async () => {
    const items: MeasurementImportListItem[] = [
      { measurementBulletinImportId: "b", humanLabel: "B.xlsx", status: "completed", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", analysisAvailable: true },
      { measurementBulletinImportId: "a", humanLabel: "A.xlsx", status: "failed", createdAt: "2026-07-02T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z", analysisAvailable: false }
    ];
    const outcome = await fetchMeasurementImports(fakeFetch({ status: 200, ok: true, json: async () => ({ imports: items }) }));

    assertEqual(outcome.kind, "ok");
    assertEqual(JSON.stringify((outcome as { kind: "ok"; imports: unknown }).imports), JSON.stringify(items));
  });

  await runTest("200 com lista vazia -- ainda é sucesso, nunca erro", async () => {
    const outcome = await fetchMeasurementImports(fakeFetch({ status: 200, ok: true, json: async () => ({ imports: [] }) }));
    assertEqual(outcome.kind, "ok");
    assertEqual(JSON.stringify((outcome as { kind: "ok"; imports: unknown }).imports), JSON.stringify([]));
  });

  await runTest("401 -- devolve unauthenticated, nunca tenta interpretar body como lista", async () => {
    const outcome = await fetchMeasurementImports(fakeFetch({ status: 401, ok: false }));
    assertEqual(outcome.kind, "unauthenticated");
  });

  await runTest("500 -- devolve error", async () => {
    const outcome = await fetchMeasurementImports(fakeFetch({ status: 500, ok: false }));
    assertEqual(outcome.kind, "error");
  });

  await runTest("falha de rede (fetch rejeita) -- devolve error, nunca propaga a exceção", async () => {
    const outcome = await fetchMeasurementImports(throwingFetch());
    assertEqual(outcome.kind, "error");
  });

  await runTest("retry -- chamar novamente após erro com um fetch que agora funciona produz sucesso", async () => {
    const first = await fetchMeasurementImports(fakeFetch({ status: 500, ok: false }));
    assertEqual(first.kind, "error");

    const second = await fetchMeasurementImports(fakeFetch({ status: 200, ok: true, json: async () => ({ imports: [] }) }));
    assertEqual(second.kind, "ok");
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
