/**
 * Guard arquitetural exclusivo da Sprint 21.4B.3A.3, Momento 3B.2
 * (enunciado: "Criar guard arquitetural que impeça os adaptadores de
 * importar: `discovery-reference-truth`; arquivos
 * `discovery-reference-truth-page-*`; métricas ou resultados finais já
 * calculados."). Os adaptadores em `raw-adapters/` são exclusivamente
 * mecânicos — mapeiam o schema bruto real do Docling/PaddleOCR para o
 * formato canônico já congelado (Momento 3A), nunca conhecendo a
 * verdade de referência, os 80 itens, códigos ou textos esperados.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "..");
const RAW_ADAPTERS_DIR = join(
  SRC_ROOT,
  "domain",
  "budget-document-location",
  "tabular-region-detection",
  "testing",
  "discovery",
  "local-reader-evaluation",
  "raw-adapters",
);

const FORBIDDEN_IMPORT_SPECIFIER_SUBSTRINGS = ["discovery-reference-truth", "discovery-local-reader-metrics", "discovery-local-reader-viability"] as const;

const FORBIDDEN_IDENTIFIERS = [
  "REFERENCE_TRUTH_BUNDLES",
  "REFERENCE_TRUTH_DOCUMENT",
  "REFERENCE_TRUTH_PAGES",
  "REFERENCE_TRUTH_COLUMNS",
  "REFERENCE_TRUTH_PAGE_46",
  "REFERENCE_TRUTH_PAGE_50",
  "REFERENCE_TRUTH_PAGE_54",
] as const;

interface Violation {
  readonly file: string;
  readonly reason: string;
}

function listRawAdapterFiles(): ReadonlyArray<string> {
  const files: string[] = [];
  function walk(dir: string): void {
    readdirSync(dir).forEach((entry) => {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (entry.endsWith(".ts")) files.push(fullPath);
    });
  }
  walk(RAW_ADAPTERS_DIR);
  return files;
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) return;
  const details = violations.map((v) => `  ${v.file}: ${v.reason}`).join("\n");
  throw new Error(`${message} (${violations.length}):\n${details}`);
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

runTest("diretório raw-adapters/ existe e o guard o varre", () => {
  const files = listRawAdapterFiles();
  assertEqual(files.length > 0, true, "esperado ao menos um arquivo sob testing/discovery/local-reader-evaluation/raw-adapters/");
});

runTest("nenhum arquivo de implementação sob raw-adapters/ (exceto *.test.ts) importa discovery-reference-truth, arquivos discovery-reference-truth-page-*, ou os módulos de métricas/viabilidade já calculados", () => {
  const violations: Violation[] = [];
  const importPattern = /\bfrom\s+["']([^"']+)["']/g;

  listRawAdapterFiles()
    .filter((file) => !file.endsWith(".test.ts"))
    .forEach((file) => {
      const content = readFileSync(file, "utf8");
      let match: RegExpExecArray | null = importPattern.exec(content);
      while (match !== null) {
        const specifier = match[1];
        FORBIDDEN_IMPORT_SPECIFIER_SUBSTRINGS.forEach((forbidden) => {
          if (specifier.includes(forbidden)) {
            violations.push({ file, reason: `importa especificador proibido "${specifier}" (corresponde a "${forbidden}")` });
          }
        });
        match = importPattern.exec(content);
      }
    });

  assertNoViolations(violations, "um adaptador bruto importa a verdade de referência ou um módulo de resultado já calculado");
});

runTest("nenhum adaptador de implementação (exceto *.test.ts) referencia por nome os identificadores exportados da verdade de referência", () => {
  const violations: Violation[] = [];

  listRawAdapterFiles()
    .filter((file) => !file.endsWith(".test.ts"))
    .forEach((file) => {
      const content = readFileSync(file, "utf8");
      content.split("\n").forEach((line, lineIndex) => {
        const trimmed = line.trim();
        const isCommentLine = trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/**");
        if (isCommentLine) return;
        FORBIDDEN_IDENTIFIERS.forEach((identifier) => {
          if (line.includes(identifier)) {
            violations.push({ file: `${file}:${lineIndex + 1}`, reason: `referencia identificador proibido "${identifier}": "${trimmed}"` });
          }
        });
      });
    });

  assertNoViolations(violations, "um adaptador de implementação referencia vocabulário da verdade de referência");
});
