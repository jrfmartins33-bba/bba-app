/**
 * Guard arquitetural específico da Sprint 21.4A.2.f.1 (reconstrução
 * estrutural auditável dos grupos candidatos). Complementa, sem
 * enfraquecer, o guard genérico pré-existente
 * (`budget-document-location-boundaries.test.ts`, que já escaneia todo
 * `domain/budget-document-location/` — inclusive esta subpasta — proibindo
 * `pdfjs`, `supabase`, `apps/web` e imports para outros domínios). Este
 * guard cobre apenas o que é exclusivo desta Sprint:
 *
 * 1. o barrel público (`structure-reconstruction/index.ts`) é seletivo —
 *    nunca exporta comparadores, mediana, funções de compatibilidade,
 *    construtores de chaves, o fingerprint interno, helpers de
 *    agrupamento, a ponte de teste ou o perfil concreto (§61);
 * 2. nenhum arquivo de produção (excluindo `testing/` e `*.test.ts`)
 *    referencia vocabulário econômico, score, confiança, probabilidade ou
 *    ranking probabilístico, nem DNOCS/DNIT/Lagoa do Arroz (§60);
 * 3. nenhum arquivo de produção usa largura média de caractere ou
 *    conceito equivalente (§19, §60);
 * 4. a única leitura de `item.text` fora de `testing/`/`*.test.ts` é o
 *    guard de whitespace (`.trim().length === 0`) — nunca interpretação
 *    de conteúdo (§56);
 * 5. a ponte de teste geométrica local nunca é exportada pelo barrel do
 *    domínio nem pelo barrel de `structure-reconstruction/`.
 *
 * Auditoria pós-PR #69 (§1, §3, §6, §7, §8): mensagens técnicas
 * centralizadas em português (`structure-reconstruction-technical-problem.ts`)
 * e a canonicalização da fronteira de saída
 * (`structure-reconstruction-output-geometry-canonicalization.ts`) também
 * permanecem internas, nunca exportadas pelo barrel público. A exceção
 * nomeada e restrita ao literal "pdfjs" em
 * `structure-reconstruction-source-contracts.ts` (necessária para o portão
 * de compatibilidade comparar `adapterVersion`/`underlyingLibraryVersion`
 * por igualdade exata) vive em
 * `budget-document-location-boundaries.test.ts`, não neste arquivo.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "..");
const STRUCTURE_RECONSTRUCTION_DIR = join(SRC_ROOT, "domain", "budget-document-location", "structure-reconstruction");
const BARREL_FILE = join(STRUCTURE_RECONSTRUCTION_DIR, "index.ts");
const DOMAIN_BARREL_FILE = join(SRC_ROOT, "domain", "budget-document-location", "index.ts");

const INTERNAL_MODULE_NAMES = [
  "structure-reconstruction-context-fingerprint",
  "structure-reconstruction-keys",
  "structure-reconstruction-profile",
  "structure-reconstruction-input-validation",
  "structure-reconstruction-source-contracts",
  "source-item-reconstruction-outcomes",
  "physical-line-reconstruction",
  "horizontal-segment-reconstruction",
  "physical-text-block-reconstruction",
  "structure-reconstruction-test-bridge",
  "structure-reconstruction-technical-problem",
  "structure-reconstruction-output-geometry-canonicalization",
] as const;

const FORBIDDEN_VOCABULARY = [
  // Generic Portuguese words like "quantidade" (amount/count) are
  // deliberately excluded: they appear innocuously in prose (e.g. "média
  // de dois valores centrais para quantidade par" — an even quantity of
  // numbers). Only economic-domain-specific field-name-style tokens and
  // unambiguous scoring/place-name vocabulary are checked here.
  "unitPrice",
  "totalValue",
  "bdiPercentage",
  "budgetLine",
  "economicColumn",
  "score",
  "confiden",
  "confianç",
  "probabilit",
  "ranking",
  "DNOCS",
  "DNIT",
  "Lagoa do Arroz",
  "averageCharacterWidth",
  "characterWidth",
  "estimatedSpaceWidth",
  "averageGlyphWidth",
] as const;

interface Violation {
  readonly file: string;
  readonly reason: string;
}

function listProductionFiles(): ReadonlyArray<string> {
  const files: string[] = [];

  function walk(dir: string): void {
    readdirSync(dir).forEach((entry) => {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        if (entry === "testing") {
          return;
        }
        walk(fullPath);
        return;
      }
      if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    });
  }

  walk(STRUCTURE_RECONSTRUCTION_DIR);
  return files;
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }
  const details = violations.map((v) => `  ${v.file}: ${v.reason}`).join("\n");
  throw new Error(`${message} (${violations.length}):\n${details}`);
}

runTest("structure-reconstruction production source exists and guard scans it", () => {
  const files = listProductionFiles();
  assertEqual(files.length > 8, true, `expected more than 8 production source files, scanned ${files.length}`);
});

runTest("the structure-reconstruction barrel never exports an internal comparator, key builder, fingerprint, median, profile, grouping helper or test bridge", () => {
  const content = readFileSync(BARREL_FILE, "utf8");
  const violations: Violation[] = [];
  INTERNAL_MODULE_NAMES.forEach((moduleName) => {
    if (content.includes(moduleName)) {
      violations.push({ file: "structure-reconstruction/index.ts", reason: `must not reference internal module "${moduleName}"` });
    }
  });
  assertNoViolations(violations, "structure-reconstruction barrel exports an internal implementation detail");
});

runTest("the domain's public barrel never re-exports the structure-reconstruction test bridge", () => {
  const content = readFileSync(DOMAIN_BARREL_FILE, "utf8");
  assertEqual(content.includes("structure-reconstruction-test-bridge"), false, "domain barrel must not export the geometric test bridge");
});

runTest("no production file references economic-domain, score/confidence/ranking, or place-name vocabulary forbidden in this Sprint", () => {
  const violations: Violation[] = [];
  listProductionFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    FORBIDDEN_VOCABULARY.forEach((term) => {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        violations.push({ file, reason: `references forbidden term "${term}"` });
      }
    });
  });
  assertNoViolations(violations, "structure-reconstruction production file contains forbidden vocabulary");
});

runTest("the only reading of item.text outside testing/ is the whitespace-only guard, never content interpretation", () => {
  const violations: Violation[] = [];
  const propertyAccessPattern = /\.text\b/;
  const permittedPattern = /\.text\.trim\(\)\.length === 0/;

  listProductionFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    content.split("\n").forEach((line, lineIndex) => {
      const trimmed = line.trim();
      const isCommentLine = trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/**");
      if (!isCommentLine && propertyAccessPattern.test(line) && !permittedPattern.test(line)) {
        violations.push({ file: `${file}:${lineIndex + 1}`, reason: `reads .text outside the permitted whitespace-only guard: "${trimmed}"` });
      }
    });
  });
  assertNoViolations(violations, "structure-reconstruction production file interprets text content");
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
