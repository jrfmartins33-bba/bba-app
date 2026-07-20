import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const PACKAGE_ROOT = resolve(PACKAGE_SRC_ROOT, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");

const MODULE_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "page-local-neutral-structured-evidence-formation");
const PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "physical-cell-text-evidence-formation");
const PHYSICAL_CELL_HYPOTHESIS_FORMATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "physical-cell-hypothesis-formation");
const SIGNAL_OBSERVATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "signal-observation");

const OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED = [
  "domain/document-processing",
  "services/document-processing",
  "domain/document-reconstruction",
  "domain/budget-version",
  "services/procurement-engineering",
  "infrastructure/budget-document-location",
] as const;

const FORBIDDEN_KEYWORDS = [
  "openai", "anthropic", "pdf-lib", "pdfkit", "pdf-parse", "pdfjs", "pypdf", "pdfplumber", "tesseract", "ocr", "supabase", "@supabase",
] as const;

const FORBIDDEN_SPECIFIER_KEYWORDS = ["apps/web", "@bba/web", "services/"] as const;

/**
 * O contrato de leitura física carrega o texto bruto e a geometria de item.
 * A g.2 consome exclusivamente a SAÍDA já auditada da g.1 (texto resolvido) e
 * nunca relê o PDF nem o contrato de leitura física — igualdade estrita com a
 * declaração de escopo (§10, emenda 4). Também nunca importa a reconstrução
 * de colunas físicas crua (columnOrder já vem achatado da f.2c).
 */
const FORBIDDEN_LOCAL_MODULE_SUFFIXES = ["physical-document-read.types", "physical-document-read.types.ts"] as const;
const FORBIDDEN_LOCAL_MODULE_SEGMENTS = ["physical-column-hypothesis-reconstruction"] as const;

/**
 * Palavras-chave que provariam interpretação econômica caso aparecessem como
 * identificador ou string operacional em qualquer arquivo de produção da g.2.
 * Comparadas em minúsculas contra o conteúdo do arquivo — nunca contra nomes
 * de arquivo.
 */
const FORBIDDEN_ECONOMIC_KEYWORDS = [
  "servicecode", "descriptionrole", "unitprice", "totalprice", "budgetline", "budgetversion", "moneycents",
  "economicbdi", "subtotal", "headerrole", "footerrole", "noterole", "crosspagecontinuity",
  "numericparsing", "decimalparsing", "percentageparsing", "importproposal", "economicrole",
] as const;

/**
 * Literais negativos legítimos do catálogo de limitações — nunca dependência
 * nem vocabulário operacional. Removidos antes da varredura econômica.
 */
const ECONOMIC_KEYWORD_SCAN_NEGATIVE_DECLARATIONS = [
  "no_budget_line_created", "no_budget_version_created", "no_import_proposal_created", "no_cross_page_continuity_evaluated",
  "no_numeric_parsing_performed", "no_economic_characterization_performed",
] as const;

interface ImportRef { readonly specifier: string; readonly line: number; }
interface Violation { readonly file: string; readonly line: number; readonly specifier: string; readonly reason: string; }

runTest("page-local-neutral-structured-evidence-formation source exists and guard scans it", () => {
  const files = listSourceFiles(MODULE_DIR);
  assertEqual(files.length > 10, true, `expected more than 10 source files, scanned ${files.length}`);
});

runTest("page-local-neutral-structured-evidence-formation does not import document-processing, document-reconstruction, budget-version, procurement-engineering or infrastructure", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.startsWith(".")) {
        const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
        const hit = OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED.find((segment) => isUnderSegment(resolved, `packages/bdos-core/src/${segment}`));
        if (hit !== undefined) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `resolves into ${hit}` });
        return;
      }
      const normalizedSpecifier = ref.specifier.split("\\").join("/");
      OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED.forEach((segment) => {
        if (normalizedSpecifier.includes(`@bba/bdos-core/${segment}`)) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports @bba/bdos-core/${segment}` });
      });
    });
  });
  assertNoViolations(violations, "page-local-neutral-structured-evidence-formation forbidden domain dependency");
});

runTest("page-local-neutral-structured-evidence-formation does not import the web application, a Supabase-based seam, or any Serviço de Aplicação", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      const normalizedSpecifier = ref.specifier.split("\\").join("/");
      FORBIDDEN_SPECIFIER_KEYWORDS.forEach((keyword) => {
        if (normalizedSpecifier.includes(keyword)) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports forbidden specifier keyword "${keyword}"` });
      });
    });
  });
  assertNoViolations(violations, "page-local-neutral-structured-evidence-formation web/Supabase/Application-Service import");
});

runTest("page-local-neutral-structured-evidence-formation never re-reads the physical read contract or the raw physical-column-hypothesis-reconstruction", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (!ref.specifier.startsWith(".")) return;
      const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
      if (FORBIDDEN_LOCAL_MODULE_SUFFIXES.some((suffix) => resolved.endsWith(suffix))) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "g.2 must never re-read the physical document read contract — it consumes g.1's already-resolved text" });
      if (FORBIDDEN_LOCAL_MODULE_SEGMENTS.some((segment) => resolved.split("/").includes(segment))) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "g.2 must never import the raw physical-column-hypothesis-reconstruction contract — columnOrder is already flattened by f.2c" });
    });
  });
  assertNoViolations(violations, "page-local-neutral-structured-evidence-formation forbidden upstream contract import");
});

runTest("page-local-neutral-structured-evidence-formation introduces no PDF parser, OCR, AI or Supabase keyword", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase().replaceAll("no_ai_or_ocr_applied", "");
    FORBIDDEN_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) violations.push({ file: toRepoRelative(file), line: 1, specifier: keyword, reason: "forbidden parser/OCR/AI/Supabase keyword" });
    });
  });
  assertNoViolations(violations, "page-local-neutral-structured-evidence-formation parser/OCR/AI/Supabase dependency");
});

runTest("page-local-neutral-structured-evidence-formation introduces no economic-domain keyword, role, parsing or continuity concept", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    let content = readFileSync(file, "utf8").toLowerCase();
    ECONOMIC_KEYWORD_SCAN_NEGATIVE_DECLARATIONS.forEach((negative) => { content = content.replaceAll(negative, ""); });
    FORBIDDEN_ECONOMIC_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) violations.push({ file: toRepoRelative(file), line: 1, specifier: keyword, reason: "forbidden economic-domain keyword" });
    });
  });
  assertNoViolations(violations, "page-local-neutral-structured-evidence-formation economic-domain keyword");
});

runTest("g.1 (physical-cell-text-evidence-formation) and f.2c (physical-cell-hypothesis-formation) never import the new g.2 module — the guard is never bidirectional", () => {
  const violations: Violation[] = [];
  [PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_DIR, PHYSICAL_CELL_HYPOTHESIS_FORMATION_DIR].forEach((dir) => {
    listSourceFiles(dir).forEach((file) => {
      readImportsFromFile(file).forEach((ref) => {
        if (ref.specifier.includes("page-local-neutral-structured-evidence-formation")) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "an upstream capability must never depend on the downstream g.2 module" });
      });
    });
  });
  assertNoViolations(violations, "upstream capability depending on page-local-neutral-structured-evidence-formation");
});

runTest("f.2c still never reads PhysicalDocumentTextItem.text — only g.1 resolves text (invariant preserved by this Sprint)", () => {
  const violations: Violation[] = [];
  listSourceFiles(PHYSICAL_CELL_HYPOTHESIS_FORMATION_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.startsWith(".")) {
        const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
        if (resolved.endsWith("physical-document-read.types") || resolved.endsWith("physical-document-read.types.ts")) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "f.2c must never import the physical read contract that carries item text" });
        }
      }
    });
  });
  assertNoViolations(violations, "f.2c importing physical-document-read.types");
});

runTest("signal-observation is not modified by this Sprint (no import of the new g.2 module)", () => {
  const violations: Violation[] = [];
  listSourceFiles(SIGNAL_OBSERVATION_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.includes("page-local-neutral-structured-evidence-formation")) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "signal-observation must not depend on the new g.2 module" });
    });
  });
  assertNoViolations(violations, "signal-observation depending on page-local-neutral-structured-evidence-formation");
});

runTest("the g.2 public barrel does not reference infrastructure, pdfjs, the testing bridge, or leak internal helpers", () => {
  const indexPath = join(MODULE_DIR, "index.ts");
  const content = readFileSync(indexPath, "utf8");
  const lower = content.toLowerCase();
  assertEqual(lower.includes("infrastructure"), false, "index.ts must not reference the infrastructure/ adapter layer");
  assertEqual(lower.includes("pdfjs"), false, "index.ts must not reference pdfjs-dist");
  assertEqual(lower.includes("testing"), false, "index.ts must not re-export the testing/ synthetic bridge as public API");
  const forbiddenExports = [
    "formNeutralDocumentRegion", "formNeutralDocumentLine", "formNeutralDocumentPosition", "formNeutralDocumentCell",
    "formFailedNeutralDocumentCellShell", "formFailedNeutralDocumentPositionShell", "formFailedNeutralDocumentLineShell",
    "deriveRegionStatus", "derivePageStatus", "deriveGroupStatus", "deriveGlobalStatus", "deriveLineStatus", "classifyCellStatus", "mapIntersectionToPositionStatus",
    "validateRegionConservation", "validateRegionMetricConservation", "validatePageMetricConservation", "validateGroupMetricConservation", "validateGlobalMetricConservation",
    "computeRegionMetrics", "computePageMetrics", "computeGroupMetrics", "computeGlobalMetrics", "computeLineMetrics",
    "computeIdentityFingerprint", "computeResultFingerprint", "composePageProvenanceKey",
    "validatePageLocalNeutralStructuredEvidenceFormationInput", "isTabularRegionDetectionFingerprintValid", "isPhysicalCellTextEvidenceFormationFingerprintValid",
    "formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies", "getDefaultPageLocalNeutralStructuredEvidenceFormationDependencies", "PROFILE",
    "RegionFormationDependencies", "LineFormationDependencies", "PositionFormationOutcome",
  ];
  const leaked = forbiddenExports.filter((name) => content.includes(name));
  assertEqual(leaked.length, 0, `internal helpers leaked through the public barrel: ${leaked.join(", ")}`);
});

function listSourceFiles(dir: string): ReadonlyArray<string> {
  return listTsFiles(dir).filter((file) => !file.endsWith(".test.ts") && !file.split("\\").join("/").includes("/testing/"));
}

function listTsFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;
  try { entries = readdirSync(dir); } catch { return []; }
  const files: string[] = [];
  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) { files.push(...listTsFiles(fullPath)); return; }
    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) files.push(fullPath);
  });
  return files;
}

function readImportsFromFile(filePath: string): ReadonlyArray<ImportRef> {
  const content = readFileSync(filePath, "utf8");
  const pattern = /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm;
  const refs: ImportRef[] = [];
  let match: RegExpExecArray | null = pattern.exec(content);
  while (match !== null) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier !== undefined) refs.push({ specifier, line: content.slice(0, match.index).split("\n").length });
    match = pattern.exec(content);
  }
  return refs;
}

function toRepoRelative(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split("\\").join("/");
}

function isUnderSegment(relPath: string, segment: string): boolean {
  return relPath === segment || relPath.startsWith(`${segment}/`);
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) return;
  const details = violations.map((violation) => `  ${violation.file}:${violation.line} imports "${violation.specifier}" - ${violation.reason}`).join("\n");
  throw new Error(`${message} (${violations.length}):\n${details}`);
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
