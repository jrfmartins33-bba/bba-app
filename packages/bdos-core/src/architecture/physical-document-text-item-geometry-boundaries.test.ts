/**
 * Guard arquitetural específico da Sprint 21.4A.2.f.0 (geometria
 * normalizada por item textual). Complementa, sem enfraquecer, os guards
 * pré-existentes (`budget-document-location-boundaries.test.ts`,
 * `budget-document-location-pdf-adapter-boundaries.test.ts`,
 * `physical-document-read-no-decision-boundaries.test.ts`):
 *
 * 1. o módulo puro de derivação geométrica (`text-item-geometry.ts`) —
 *    embora resida na mesma pasta do único adaptador autorizado a
 *    importar `pdfjs-dist` — não importa a biblioteca;
 * 2. a política de canonicalização geométrica (o "quantizador") não é
 *    exportada pelo barrel público do domínio (seção 41: "Não exporte:
 *    ... quantizador");
 * 3. o helper de relação com os limites da página (um primitivo
 *    geométrico de baixo nível, análogo a "helper de composição") também
 *    não é exportado pelo barrel público;
 * 4. nenhuma regra do observador (`signal-observation-rules.ts`,
 *    `signal-observation.ts`) ou do localizador (`page-location/*.ts`,
 *    excluindo `testing/` e `*.test.ts`) referencia os novos campos
 *    geométricos por item (`placement`, `textItemPlacementMetrics`,
 *    `geometryContextFingerprint`) — nenhuma regra decisória lê a nova
 *    geometria por item (seção 38).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "..");

const DOMAIN_DIR = join(SRC_ROOT, "domain", "budget-document-location");
const DOMAIN_INDEX_FILE = join(DOMAIN_DIR, "index.ts");
const SIGNAL_OBSERVATION_DIR = join(DOMAIN_DIR, "signal-observation");
const PAGE_LOCATION_DIR = join(DOMAIN_DIR, "page-location");
const TEXT_ITEM_GEOMETRY_FILE = join(SRC_ROOT, "infrastructure", "budget-document-location", "pdfjs", "text-item-geometry.ts");
const CANONICALIZATION_FILE_NAME = "physical-document-text-item-geometry-canonicalization";
const PAGE_BOUNDS_RELATION_FILE_NAME = "physical-document-text-item-page-bounds-relation";

const GEOMETRY_IDENTIFIERS_FORBIDDEN_IN_RULES = [
  "placement",
  "textItemPlacementMetrics",
  "geometryContextFingerprint",
  "LayoutGeometry",
  "pageBoundsRelation",
  "deriveTextItemPlacement",
] as const;

interface Violation {
  readonly file: string;
  readonly reason: string;
}

runTest("text-item-geometry.ts (pure geometric derivation) exists and imports nothing from pdfjs-dist", () => {
  const content = readFileSync(TEXT_ITEM_GEOMETRY_FILE, "utf8");
  const importSpecifierPattern = /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  const specifiers: string[] = [];
  let match: RegExpExecArray | null = importSpecifierPattern.exec(content);
  while (match !== null) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
    match = importSpecifierPattern.exec(content);
  }
  assertEqual(specifiers.length > 0, true, "expected text-item-geometry.ts to have at least one import to check");
  const pdfjsImport = specifiers.find((specifier) => specifier.toLowerCase().includes("pdfjs"));
  assertEqual(pdfjsImport, undefined, `text-item-geometry.ts must not import from a pdfjs-dist specifier, found: ${String(pdfjsImport)}`);
});

runTest("the domain's public barrel does not export the geometry canonicalization policy (the quantizer)", () => {
  const content = readFileSync(DOMAIN_INDEX_FILE, "utf8");
  assertEqual(
    content.includes(CANONICALIZATION_FILE_NAME),
    false,
    `index.ts must not re-export ${CANONICALIZATION_FILE_NAME} — the quantizer is an internal contract-boundary detail (Sprint 21.4A.2.f.0, seção 41)`,
  );
});

runTest("the domain's public barrel does not export the low-level page-bounds-relation primitive", () => {
  const content = readFileSync(DOMAIN_INDEX_FILE, "utf8");
  assertEqual(
    content.includes(PAGE_BOUNDS_RELATION_FILE_NAME),
    false,
    `index.ts must not re-export ${PAGE_BOUNDS_RELATION_FILE_NAME} — only the resulting pageBoundsRelation value is public, not the deriving function`,
  );
});

runTest("no signal-observation rule file references the new per-item geometry fields", () => {
  const violations: Violation[] = [];
  listTsFiles(SIGNAL_OBSERVATION_DIR)
    .filter((file) => !file.includes("/testing/") && !file.endsWith(".test.ts"))
    .forEach((file) => {
      const content = readFileSync(file, "utf8");
      GEOMETRY_IDENTIFIERS_FORBIDDEN_IN_RULES.forEach((identifier) => {
        if (content.includes(identifier)) {
          violations.push({ file, reason: `references geometry identifier "${identifier}"` });
        }
      });
    });
  assertNoViolations(violations, "signal-observation rule file reads per-item geometry");
});

runTest("no page-location rule file references the new per-item geometry fields", () => {
  const violations: Violation[] = [];
  listTsFiles(PAGE_LOCATION_DIR)
    .filter((file) => !file.includes("/testing/") && !file.endsWith(".test.ts"))
    .forEach((file) => {
      const content = readFileSync(file, "utf8");
      GEOMETRY_IDENTIFIERS_FORBIDDEN_IN_RULES.forEach((identifier) => {
        if (content.includes(identifier)) {
          violations.push({ file, reason: `references geometry identifier "${identifier}"` });
        }
      });
    });
  assertNoViolations(violations, "page-location rule file reads per-item geometry");
});

function listTsFiles(dir: string): ReadonlyArray<string> {
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
      files.push(...listTsFiles(fullPath));
      return;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(fullPath.split("\\").join("/"));
    }
  });

  return files;
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }
  const details = violations.map((violation) => `  ${violation.file}: ${violation.reason}`).join("\n");
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
