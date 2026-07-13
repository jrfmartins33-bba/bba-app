import { formatGeneratedAt } from "./measurement-decision-brief-header";

async function main(): Promise<void> {
  await runTest("formatGeneratedAt formata um ISO 8601 válido em pt-BR", () => {
    const formatted = formatGeneratedAt("2026-07-12T10:00:00.000Z");
    assertEqual(formatted, new Date("2026-07-12T10:00:00.000Z").toLocaleString("pt-BR"));
  });

  await runTest("formatGeneratedAt nunca produz a string 'Invalid Date' -- devolve null para valor não formatável", () => {
    const formatted = formatGeneratedAt("não é uma data");
    assertTrue(formatted !== "Invalid Date", "cabeçalho não pode renderizar 'Invalid Date'");
    assertEqual(formatted, null);
  });

  await runTest("formatGeneratedAt devolve null para string vazia", () => {
    assertEqual(formatGeneratedAt(""), null);
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
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
