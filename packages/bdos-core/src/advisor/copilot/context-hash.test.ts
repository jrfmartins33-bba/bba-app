import { canonicalJsonStringify, computeContextHash } from "./context-hash";

runTest("canonicalJsonStringify produz o mesmo texto para chaves em ordem diferente", () => {
  const a = { alpha: 1, beta: { y: 2, x: 1 }, gamma: [3, 2, 1] };
  const b = { gamma: [3, 2, 1], beta: { x: 1, y: 2 }, alpha: 1 };

  assertEqual(canonicalJsonStringify(a), canonicalJsonStringify(b), "mesma forma lógica deve produzir o mesmo texto canônico");
});

runTest("computeContextHash produz o mesmo hash para objetos logicamente iguais com ordem de chaves diferente", () => {
  const a = { snapshot: { healthScore: 72, engineeringProjectId: "proj-1" }, decisions: [] };
  const b = { decisions: [], snapshot: { engineeringProjectId: "proj-1", healthScore: 72 } };

  assertEqual(computeContextHash(a), computeContextHash(b), "hash deve ser estável independente da ordem de inserção das chaves");
});

runTest("computeContextHash produz hashes diferentes para conteúdo logicamente diferente", () => {
  const a = { snapshot: { healthScore: 72 } };
  const b = { snapshot: { healthScore: 73 } };

  assertTrue(computeContextHash(a) !== computeContextHash(b), "conteúdo diferente não pode colidir no mesmo hash");
});

runTest("computeContextHash é determinístico: mesma entrada produz o mesmo hash em chamadas repetidas", () => {
  const value = { a: [1, 2, { nested: true }], b: "texto" };

  assertEqual(computeContextHash(value), computeContextHash(value), "duas chamadas com o mesmo objeto devem produzir o mesmo hash");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}
