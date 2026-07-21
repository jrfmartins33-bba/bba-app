/**
 * Guard arquitetural exclusivo da Sprint 21.4B.3A.2 (§6.3 do enunciado):
 * nenhum arquivo sob `testing/discovery/h3d/` pode importar
 * `tabular-region-formation.ts`, referenciar `formTabularRegionCandidateWindows`
 * pelo nome, receber janelas ou regiões pré-formadas (`TabularRegionFormationWindow`,
 * `RegionFormationLine`, `RegionFormationAlignment`), ou reconstruir
 * indiretamente o mesmo conceito via `discovery-candidate-hypotheses.ts`
 * (que importa `tabular-region-formation.ts` para H0-H4). Este é o ponto
 * mais importante da Sprint: H3d deve provar que âncoras físicas podem
 * ser reconstruídas sem depender da própria regra de formação de regiões
 * que pretende superar.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "..");
const H3D_DIR = join(SRC_ROOT, "domain", "budget-document-location", "tabular-region-detection", "testing", "discovery", "h3d");

const FORBIDDEN_IMPORT_SPECIFIER_SUBSTRINGS = ["tabular-region-formation", "discovery-candidate-hypotheses", "/h3c/", "\\h3c\\"] as const;

const FORBIDDEN_IDENTIFIERS = [
  "formTabularRegionCandidateWindows",
  "TabularRegionFormationWindow",
  "RegionFormationLine",
  "RegionFormationAlignment",
  "anchorPoolFor",
  "helperAlignments",
] as const;

interface Violation {
  readonly file: string;
  readonly reason: string;
}

function listH3dFiles(): ReadonlyArray<string> {
  const files: string[] = [];
  function walk(dir: string): void {
    readdirSync(dir).forEach((entry) => {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (entry.endsWith(".ts")) {
        files.push(fullPath);
      }
    });
  }
  walk(H3D_DIR);
  return files;
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }
  const details = violations.map((v) => `  ${v.file}: ${v.reason}`).join("\n");
  throw new Error(`${message} (${violations.length}):\n${details}`);
}

runTest("h3d discovery directory exists and guard scans it", () => {
  const files = listH3dFiles();
  assertEqual(files.length > 0, true, "expected at least one file under testing/discovery/h3d/");
});

runTest("no file under testing/discovery/h3d/ imports tabular-region-formation.ts, discovery-candidate-hypotheses.ts, or the h3c module directly", () => {
  const violations: Violation[] = [];
  const importPattern = /\bfrom\s+["']([^"']+)["']/g;

  listH3dFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null = importPattern.exec(content);
    while (match !== null) {
      const specifier = match[1];
      FORBIDDEN_IMPORT_SPECIFIER_SUBSTRINGS.forEach((forbidden) => {
        if (specifier.includes(forbidden)) {
          violations.push({ file, reason: `imports forbidden specifier "${specifier}" (matches "${forbidden}")` });
        }
      });
      match = importPattern.exec(content);
    }
  });

  assertNoViolations(violations, "a file under testing/discovery/h3d/ imports the region-formation module or a module that depends on it");
});

runTest("no H3d implementation file (never manifest data/types, never *.test.ts) references formTabularRegionCandidateWindows, its window/region-formation types, or the anchor-pool helper by name", () => {
  // Scoped to implementation code only: manifest data/types files legitimately
  // document, in prose, that these identifiers were never used to produce the
  // manifest (e.g. H3D_INDEPENDENT_MANIFEST_EXTRACTION_RULE_PT), and the
  // manifest's own integrity test legitimately asserts those identifiers never
  // leak into rationale text — neither is a code dependency on region formation.
  const violations: Violation[] = [];

  listH3dFiles()
    .filter((file) => !file.endsWith(".test.ts") && !file.toLowerCase().includes("manifest"))
    .forEach((file) => {
      const content = readFileSync(file, "utf8");
      content.split("\n").forEach((line, lineIndex) => {
        const trimmed = line.trim();
        const isCommentLine = trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/**");
        if (isCommentLine) return;
        FORBIDDEN_IDENTIFIERS.forEach((identifier) => {
          if (line.includes(identifier)) {
            violations.push({ file: `${file}:${lineIndex + 1}`, reason: `references forbidden identifier "${identifier}": "${trimmed}"` });
          }
        });
      });
    });

  assertNoViolations(violations, "an H3d implementation file references region-formation-window vocabulary");
});

runTest("the H3d hypothesis module's H3dPageEvidence never exposes helperAlignments or blocks fields (present on H1-H4/H3c's CandidatePageEvidence)", () => {
  const hypothesisFile = join(H3D_DIR, "discovery-candidate-h3d-hypothesis.ts");
  const content = readFileSync(hypothesisFile, "utf8");
  const interfaceMatch = content.match(/export interface H3dPageEvidence \{([\s\S]*?)\n\}/);
  assertEqual(interfaceMatch !== null, true, "expected to find the H3dPageEvidence interface");
  const interfaceBody = interfaceMatch![1];
  assertEqual(interfaceBody.includes("helperAlignments"), false, "H3dPageEvidence must never expose helperAlignments");
  assertEqual(interfaceBody.includes("blocks"), false, "H3dPageEvidence must never expose blocks (Categoria B, fora do escopo desta Sprint)");
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
