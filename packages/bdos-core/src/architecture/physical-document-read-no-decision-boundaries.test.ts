import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pdfjsPhysicalDocumentReader } from "../infrastructure/budget-document-location/pdfjs/pdfjs-physical-document-reader";
import { buildSyntheticPdfBytes } from "../infrastructure/budget-document-location/pdfjs/testing/synthetic-pdf-bytes";

/**
 * Proteção explícita (Sprint 21.4A.2.c, seção 30): o contrato de leitura
 * física nunca deve conter campo ou decisão equivalente a candidatura,
 * ambiguidade, descarte, orçamento encontrado, continuidade, fechamento,
 * confiança, score, limiar ou classificação. Duas verificações
 * independentes: (1) os nomes de campo declarados no contrato de tipos
 * puro; (2) as chaves de um resultado real produzido pelo adaptador.
 */

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const CONTRACT_TYPES_FILE = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "physical-document-read.types.ts");

const FORBIDDEN_FIELD_SUBSTRINGS = [
  "candidate",
  "candidata",
  "candidato",
  "contextual",
  "ambiguous",
  "ambigua",
  "ambígua",
  "discarded",
  "descartada",
  "descartado",
  "budgetfound",
  "orcamentoencontrado",
  "orçamentoencontrado",
  "budgetpage",
  "paginaorcamento",
  "páginaorçamento",
  "continuity",
  "continuidade",
  "closure",
  "fechamento",
  "confidence",
  "confianca",
  "confiança",
  "score",
  "threshold",
  "limiar",
  "isrelevant",
  "relevante",
  "isbudget",
  "classification",
  "classificacao",
  "classificação",
] as const;

async function main(): Promise<void> {
  await runTest("the pure contract's declared field names contain no decision/classification vocabulary", async () => {
    const fieldNames = extractDeclaredFieldNames(readFileSync(CONTRACT_TYPES_FILE, "utf8"));
    assertEqual(fieldNames.length > 10, true, `expected more than 10 declared fields, found ${fieldNames.length}`);

    const violations = fieldNames.filter((name) => matchesForbiddenSubstring(name));
    assertNoViolations(violations, "contract field name matches forbidden decision vocabulary");
  });

  await runTest("a real read result produced by the pdfjs adapter contains no decision/classification key at any depth", async () => {
    const bytes = buildSyntheticPdfBytes([{ text: "Item 1 - Serviços preliminares" }, { text: null }]);
    const result = await pdfjsPhysicalDocumentReader.read(bytes);

    const allKeys = collectAllKeysDeep(result);
    assertEqual(allKeys.length > 10, true, `expected more than 10 keys across the result, found ${allKeys.length}`);

    const violations = allKeys.filter((name) => matchesForbiddenSubstring(name));
    assertNoViolations(violations, "real read result key matches forbidden decision vocabulary");
  });
}

function matchesForbiddenSubstring(name: string): boolean {
  const lowered = name.toLowerCase();
  return FORBIDDEN_FIELD_SUBSTRINGS.some((forbidden) => lowered.includes(forbidden));
}

function extractDeclaredFieldNames(source: string): ReadonlyArray<string> {
  const pattern = /\breadonly\s+([a-zA-Z_$][\w$]*)\s*[:?]/g;
  const names: string[] = [];
  let match: RegExpExecArray | null = pattern.exec(source);
  while (match !== null) {
    names.push(match[1]);
    match = pattern.exec(source);
  }
  return names;
}

function collectAllKeysDeep(value: unknown, seen: Set<unknown> = new Set()): ReadonlyArray<string> {
  if (value === null || typeof value !== "object") {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  const keys: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item) => keys.push(...collectAllKeysDeep(item, seen)));
    return keys;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    keys.push(key);
    keys.push(...collectAllKeysDeep(nested, seen));
  });

  return keys;
}

function assertNoViolations(violations: ReadonlyArray<string>, message: string): void {
  if (violations.length === 0) {
    return;
  }
  throw new Error(`${message} (${violations.length}): ${violations.join(", ")}`);
}

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
