import { groupSourceReferencesForDisplay, joinColumnsLabel } from "./measurement-evidence-reference-view-model";
import type { DecisionBriefSourceReference } from "@bba/bdos-core/decision-brief";

// Migrado do 20.1E.4 (measurement-critical-item-view-model.test.ts) --
// mesmo comportamento, agora reutilizado pela origem documental
// contextual dentro de item crítico e ação recomendada (20.1E.6).

function ref(sheetName: string, row: number, column?: string): DecisionBriefSourceReference {
  return { sourceType: "spreadsheet_cell", sourceId: "import-1", locator: column !== undefined ? { sheetName, row, column } : { sheetName, row } };
}

async function main(): Promise<void> {
  await runTest("groupSourceReferencesForDisplay -- referência única sem coluna", () => {
    const groups = groupSourceReferencesForDisplay([ref("BOLETIM DE MEDIÇÃO 08", 347)]);
    assertEqual(groups.length, 1);
    assertEqual(groups[0]!.sheetName, "BOLETIM DE MEDIÇÃO 08");
    assertEqual(groups[0]!.row, 347);
    assertEqual(JSON.stringify(groups[0]!.columns), JSON.stringify([]));
  });

  await runTest("groupSourceReferencesForDisplay -- duas colunas adjacentes da mesma célula viram um grupo, nenhuma referência descartada", () => {
    const groups = groupSourceReferencesForDisplay([ref("BOLETIM DE MEDIÇÃO 08", 400, "G"), ref("BOLETIM DE MEDIÇÃO 08", 400, "H")]);
    assertEqual(groups.length, 1);
    assertEqual(JSON.stringify(groups[0]!.columns), JSON.stringify(["G", "H"]), "ordem das colunas preservada, nenhuma reordenação");
  });

  await runTest("groupSourceReferencesForDisplay -- linhas diferentes nunca são agrupadas, mesmo na mesma planilha", () => {
    const groups = groupSourceReferencesForDisplay([ref("BOLETIM DE MEDIÇÃO 08", 100, "A"), ref("BOLETIM DE MEDIÇÃO 08", 200, "B")]);
    assertEqual(groups.length, 2, "cada linha é uma referência distinta, nunca agrupada por planilha");
  });

  await runTest("groupSourceReferencesForDisplay -- preserva a ordem original das referências", () => {
    const groups = groupSourceReferencesForDisplay([ref("Aba 1", 1, "A"), ref("Aba 2", 2, "B"), ref("Aba 1", 1, "C")]);
    assertEqual(groups.length, 3, "referências não adjacentes não são mescladas mesmo se coincidirem em planilha+linha depois");
    assertEqual(groups[0]!.sheetName, "Aba 1");
    assertEqual(groups[1]!.sheetName, "Aba 2");
    assertEqual(groups[2]!.sheetName, "Aba 1");
  });

  await runTest("groupSourceReferencesForDisplay -- array vazio devolve lista vazia", () => {
    assertEqual(groupSourceReferencesForDisplay([]).length, 0);
  });

  await runTest("joinColumnsLabel -- uma, duas e três colunas", () => {
    assertEqual(joinColumnsLabel(["G"]), "G");
    assertEqual(joinColumnsLabel(["G", "H"]), "G e H");
    assertEqual(joinColumnsLabel(["G", "H", "I"]), "G, H e I");
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
