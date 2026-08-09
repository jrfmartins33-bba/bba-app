/**
 * The Budget Reconstruction Lab's status vocabulary (resolved/ambiguous/
 * insufficient_evidence, grammarId, divergent-source-cells-v1, ...) is
 * internal engine diagnostic -- Admin-only. The client-facing budget
 * experience (/orcamentos) must never import it. Same textual-scan
 * pattern as studio-boundaries.test.ts in this folder, but narrowly
 * targeted at this one fence rather than a generic scanner over the
 * whole repo.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ORCAMENTOS_ROOT = resolve(__dirname, "..", "app", "(dashboard)", "orcamentos");
const BUDGET_COMPONENTS_ROOT = resolve(__dirname, "..", "components", "budget");
const FORBIDDEN_SPECIFIER = "budget-reconstruction-lab";

// Vocabulário de diagnóstico interno do motor (§5 do brief de UX do Lab)
// -- pode aparecer em /admin/budget-reconstruction-lab, nunca na
// experiência Cliente.
const FORBIDDEN_DIAGNOSTIC_VOCABULARY = [
  "insufficient_evidence",
  "grammarId",
  "divergent-source-cells-v1",
  "Precisa de revisão",
  "Evidência insuficiente",
];

function listSourceFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      return;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(fullPath);
    }
  });
  return files;
}

runTest("/orcamentos não importa componentes de diagnóstico do Lab", () => {
  const files = listSourceFiles(ORCAMENTOS_ROOT);
  assertTrue(files.length > 0, "esperava ao menos 1 arquivo em app/(dashboard)/orcamentos");
  const violations = files.filter((file) => readFileSync(file, "utf8").includes(FORBIDDEN_SPECIFIER));
  assertEqual(violations.length, 0, `arquivos de /orcamentos importando o Lab: ${violations.join(", ")}`);
});

runTest("components/budget (experiência Cliente) não importa componentes de diagnóstico do Lab", () => {
  const files = listSourceFiles(BUDGET_COMPONENTS_ROOT);
  assertTrue(files.length > 0, "esperava ao menos 1 arquivo em components/budget");
  const violations = files.filter((file) => readFileSync(file, "utf8").includes(FORBIDDEN_SPECIFIER));
  assertEqual(violations.length, 0, `arquivos de components/budget importando o Lab: ${violations.join(", ")}`);
});

runTest("vocabulário técnico de diagnóstico (status internos, grammarId) não aparece em /orcamentos nem components/budget", () => {
  const files = [...listSourceFiles(ORCAMENTOS_ROOT), ...listSourceFiles(BUDGET_COMPONENTS_ROOT)];
  assertTrue(files.length > 0, "esperava ao menos 1 arquivo combinado entre /orcamentos e components/budget");
  const violations: string[] = [];
  files.forEach((file) => {
    const source = readFileSync(file, "utf8");
    FORBIDDEN_DIAGNOSTIC_VOCABULARY.forEach((term) => {
      if (source.includes(term)) {
        violations.push(`${file} contém "${term}"`);
      }
    });
  });
  assertEqual(violations.length, 0, `vocabulário de diagnóstico técnico vazou para a experiência Cliente: ${violations.join("; ")}`);
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
