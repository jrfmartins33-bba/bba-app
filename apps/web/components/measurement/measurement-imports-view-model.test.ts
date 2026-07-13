import { canOpenReport, formatImportDate, resolveHumanLabel, translateImportStatus } from "./measurement-imports-view-model";

async function main(): Promise<void> {
  await runTest("traduz os cinco status reais para rótulo + badge em português", () => {
    assertEqual(JSON.stringify(translateImportStatus("pending_upload")), JSON.stringify({ label: "Aguardando envio", badge: "pending" }));
    assertEqual(JSON.stringify(translateImportStatus("uploaded")), JSON.stringify({ label: "Enviado", badge: "pending" }));
    assertEqual(JSON.stringify(translateImportStatus("processing")), JSON.stringify({ label: "Processando", badge: "in_progress" }));
    assertEqual(JSON.stringify(translateImportStatus("completed")), JSON.stringify({ label: "Concluído", badge: "completed" }));
    assertEqual(JSON.stringify(translateImportStatus("failed")), JSON.stringify({ label: "Falha na importação", badge: "cancelled" }));
  });

  await runTest("tradução de status nunca usa Aprovado/Reprovado/Certificado", () => {
    const allLabels = (["pending_upload", "uploaded", "processing", "completed", "failed"] as const)
      .map((status) => translateImportStatus(status).label)
      .join(" ");
    assertTrue(!/aprovad|reprovad|certificad/i.test(allLabels), "rótulo de status de importação não pode usar vocabulário de Decision Brief");
  });

  await runTest("resolveHumanLabel devolve o humanLabel real, verbatim", () => {
    assertEqual(resolveHumanLabel({ humanLabel: "BM_08.xlsx" }), "BM_08.xlsx");
  });

  await runTest("resolveHumanLabel usa fallback neutro quando humanLabel é null -- nunca deriva do id", () => {
    assertEqual(resolveHumanLabel({ humanLabel: null }), "Boletim de Medição");
  });

  await runTest("canOpenReport depende só de analysisAvailable -- completed sem análise não abre", () => {
    assertEqual(canOpenReport({ analysisAvailable: false }), false);
  });

  await runTest("canOpenReport depende só de analysisAvailable -- failed com análise abre", () => {
    assertEqual(canOpenReport({ analysisAvailable: true }), true);
  });

  await runTest("formatImportDate formata a data em pt-BR", () => {
    const formatted = formatImportDate("2026-07-10T10:00:00.000Z");
    assertEqual(formatted, new Date("2026-07-10T10:00:00.000Z").toLocaleDateString("pt-BR"));
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
