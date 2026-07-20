import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const PACKAGE_ROOT = resolve(PACKAGE_SRC_ROOT, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");

const MODULE_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "page-boundary-neutral-continuity-evaluation");
const PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "page-local-neutral-structured-evidence-formation");

/**
 * A g.3 consome EXCLUSIVAMENTE o resultado publicado pela g.2 — nunca relê
 * f.0/f.1/f.2a/f.2c/g.1 diretamente, nunca a web app, nunca persistência.
 * Deep imports para dentro de `page-local-neutral-structured-evidence-formation/*`
 * (barrel ou arquivo interno) são permitidos — é exatamente assim que a
 * validação de contrato/fingerprint da g.3 reaproveita as funções reais da
 * g.2 (mesma disciplina que a própria g.2 usa para validar f.2a/g.1).
 */
const OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED = [
  "domain/budget-document-location/structure-reconstruction",
  "domain/budget-document-location/tabular-region-detection",
  "domain/budget-document-location/physical-cell-hypothesis-formation",
  "domain/budget-document-location/physical-cell-text-evidence-formation",
  "domain/budget-document-location/physical-column-hypothesis-reconstruction",
  "domain/budget-document-location/page-location",
  "domain/budget-document-location/signal-observation",
  "domain/document-processing",
  "domain/document-reconstruction",
  "domain/budget-version",
  "services/procurement-engineering",
  "infrastructure/budget-document-location",
] as const;

const FORBIDDEN_KEYWORDS = [
  "openai", "anthropic", "pdf-lib", "pdfkit", "pdf-parse", "pdfjs", "pypdf", "pdfplumber", "tesseract", "ocr", "supabase", "@supabase",
] as const;

const FORBIDDEN_SPECIFIER_KEYWORDS = ["apps/web", "@bba/web", "services/"] as const;

/** O contrato de leitura física carrega o texto bruto e a geometria de item — a g.3 nunca o relê (só a g.2 já resolvida). */
const FORBIDDEN_LOCAL_MODULE_SUFFIXES = ["physical-document-read.types", "physical-document-read.types.ts"] as const;

/**
 * Palavras-chave que provariam interpretação econômica caso aparecessem como
 * identificador ou string operacional em qualquer arquivo de produção da
 * g.3. Comparadas em minúsculas contra o conteúdo do arquivo.
 */
const FORBIDDEN_ECONOMIC_KEYWORDS = [
  "servicecode", "descriptionrole", "unitprice", "totalprice", "budgetline", "budgetversion", "moneycents",
  "economicbdi", "subtotal", "headerrole", "footerrole", "noterole",
  "numericparsing", "decimalparsing", "percentageparsing", "importproposal", "economicrole",
] as const;

/** Vocabulário de fusão/concatenação entre páginas — a g.3 avalia, nunca funde. Varredura por palavra inteira para não gerar falso positivo. */
const FORBIDDEN_MERGE_KEYWORD_PATTERNS: ReadonlyArray<RegExp> = [/\bmerge\b/i, /\bmergepage/i, /\bmergeline/i, /\bmergeregion/i, /\bconcatenat/i, /\bchoosecorrectpage\b/i];

/**
 * Literais negativos legítimos do catálogo de limitações — nunca dependência
 * nem vocabulário operacional. Removidos antes das varreduras.
 */
const KEYWORD_SCAN_NEGATIVE_DECLARATIONS = [
  "no_budget_line_created", "no_budget_version_created", "no_import_proposal_created",
  "no_numeric_parsing_performed", "no_economic_characterization_performed",
  "no_page_or_line_merge_performed", "no_region_merge_performed", "no_multi_page_line_created",
] as const;

interface ImportRef { readonly specifier: string; readonly line: number; }
interface Violation { readonly file: string; readonly line: number; readonly specifier: string; readonly reason: string; }

runTest("page-boundary-neutral-continuity-evaluation source exists and guard scans it", () => {
  const files = listSourceFiles(MODULE_DIR);
  assertEqual(files.length > 8, true, `expected more than 8 source files, scanned ${files.length}`);
});

runTest("page-boundary-neutral-continuity-evaluation does not import f.0/f.1/f.2a/f.2c/g.1 directly, the web app, persistence, or any Serviço de Aplicação", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.startsWith(".")) {
        const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
        const hit = OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED.find((segment) => isUnderSegment(resolved, `packages/bdos-core/src/${segment}`));
        if (hit !== undefined) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `resolves into ${hit} — the g.3 must consume exclusively the g.2 result` });
        return;
      }
      const normalizedSpecifier = ref.specifier.split("\\").join("/");
      OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED.forEach((segment) => {
        if (normalizedSpecifier.includes(`@bba/bdos-core/${segment}`)) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports @bba/bdos-core/${segment}` });
      });
      FORBIDDEN_SPECIFIER_KEYWORDS.forEach((keyword) => {
        if (normalizedSpecifier.includes(keyword)) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports forbidden specifier keyword "${keyword}"` });
      });
    });
  });
  assertNoViolations(violations, "page-boundary-neutral-continuity-evaluation forbidden upstream/application/web dependency");
});

runTest("page-boundary-neutral-continuity-evaluation never re-reads the physical read contract", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (!ref.specifier.startsWith(".")) return;
      const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
      if (FORBIDDEN_LOCAL_MODULE_SUFFIXES.some((suffix) => resolved.endsWith(suffix))) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "g.3 must never re-read the physical document read contract" });
    });
  });
  assertNoViolations(violations, "page-boundary-neutral-continuity-evaluation forbidden physical-read import");
});

runTest("page-boundary-neutral-continuity-evaluation introduces no PDF parser, OCR, AI or Supabase keyword", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase().replaceAll("no_ai_or_ocr_applied", "");
    FORBIDDEN_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) violations.push({ file: toRepoRelative(file), line: 1, specifier: keyword, reason: "forbidden parser/OCR/AI/Supabase keyword" });
    });
  });
  assertNoViolations(violations, "page-boundary-neutral-continuity-evaluation parser/OCR/AI/Supabase dependency");
});

runTest("page-boundary-neutral-continuity-evaluation introduces no economic-domain keyword, role, or parsing concept", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    let content = readFileSync(file, "utf8").toLowerCase();
    KEYWORD_SCAN_NEGATIVE_DECLARATIONS.forEach((negative) => { content = content.replaceAll(negative, ""); });
    FORBIDDEN_ECONOMIC_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) violations.push({ file: toRepoRelative(file), line: 1, specifier: keyword, reason: "forbidden economic-domain keyword" });
    });
  });
  assertNoViolations(violations, "page-boundary-neutral-continuity-evaluation economic-domain keyword");
});

runTest("page-boundary-neutral-continuity-evaluation introduces no page/line/region merge or concatenation vocabulary", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    let content = readFileSync(file, "utf8").toLowerCase();
    KEYWORD_SCAN_NEGATIVE_DECLARATIONS.forEach((negative) => { content = content.replaceAll(negative, ""); });
    FORBIDDEN_MERGE_KEYWORD_PATTERNS.forEach((pattern) => {
      if (pattern.test(content)) violations.push({ file: toRepoRelative(file), line: 1, specifier: pattern.source, reason: "forbidden page/line/region merge or concatenation vocabulary — the g.3 evaluates, it never fuses" });
    });
  });
  assertNoViolations(violations, "page-boundary-neutral-continuity-evaluation merge/concatenation vocabulary");
});

runTest("page-local-neutral-structured-evidence-formation (g.2) never imports the new g.3 module — the guard is never bidirectional", () => {
  const violations: Violation[] = [];
  listSourceFiles(PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.includes("page-boundary-neutral-continuity-evaluation")) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "an upstream capability must never depend on the downstream g.3 module" });
    });
  });
  assertNoViolations(violations, "g.2 depending on page-boundary-neutral-continuity-evaluation");
});

runTest("the g.3 public barrel does not reference infrastructure, pdfjs, the testing bridge, or leak internal helpers", () => {
  const indexPath = join(MODULE_DIR, "index.ts");
  const content = readFileSync(indexPath, "utf8");
  const lower = content.toLowerCase();
  assertEqual(lower.includes("infrastructure"), false, "index.ts must not reference the infrastructure/ adapter layer");
  assertEqual(lower.includes("pdfjs"), false, "index.ts must not reference pdfjs-dist");
  assertEqual(lower.includes("testing"), false, "index.ts must not re-export the testing/ synthetic bridge as public API");
  const forbiddenExports = [
    "evaluateBudgetDocumentPageBoundaryNeutralContinuityWithDependencies", "getDefaultPageBoundaryNeutralContinuityEvaluationDependencies",
    "PageBoundaryNeutralContinuityEvaluationDependencies", "evaluateBoundaryPair",
    "selectClosingRegion", "selectOpeningRegion", "selectClosingLine", "selectOpeningLine",
    "evaluatePageProcessability", "evaluateBoundaryRegionExistence", "evaluateBoundaryLineExistence", "evaluateColumnSignatureCompatibility", "evaluateHorizontalGeometryCompatibility",
    "classifyMeritSignals", "deriveGlobalStatus",
    "validateEvaluationConservation", "validateMetricConservation", "computeGlobalMetrics",
    "computeIdentityFingerprint", "computeResultFingerprint",
    "validatePageBoundaryNeutralContinuityEvaluationInput", "validateGroupPopulation", "computeExpectedBoundaryPopulation",
    "isSupportedPageLocalNeutralStructuredEvidenceFormationContract", "isPageLocalNeutralStructuredEvidenceFormationFingerprintValid",
    "recomputePageLocalNeutralStructuredEvidenceFormationIdentityFingerprint", "PROFILE",
    "ELIGIBLE_BOUNDARY_REGION_STATES", "ELIGIBLE_BOUNDARY_LINE_STATUSES",
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
