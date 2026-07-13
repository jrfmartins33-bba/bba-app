import { translateSeverity } from "./measurement-critical-item-view-model";

// Agrupamento/formatação de referências foi extraído para
// measurement-evidence-reference-view-model.test.ts no Sprint
// 20.1E.6 -- ver aquele arquivo para os testes de
// groupSourceReferencesForDisplay/joinColumnsLabel.

async function main(): Promise<void> {
  await runTest("translateSeverity -- os dois valores reais do contrato", () => {
    assertEqual(translateSeverity("blocking").label, "Bloqueante");
    assertEqual(translateSeverity("warning").label, "Ponto de atenção");
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
