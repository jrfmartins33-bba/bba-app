import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const PACKAGE_ROOT = resolve(PACKAGE_SRC_ROOT, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");

const MODULE_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-economic-characterization");
const PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "page-local-neutral-structured-evidence-formation");
const PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "page-boundary-neutral-continuity-evaluation");

/**
 * A caracterização econômica (Sprint 21.4B) consome exclusivamente os
 * resultados já publicados pela g.2 e pela g.3 — nunca relê f.0/f.1/f.2a/
 * f.2c/g.1 diretamente, nunca infraestrutura, nunca persistência. Pode
 * importar `domain/budget-version` e `domain/procurement-case` (mesmo
 * nível operacional, ADR-001/ADR-003) para produzir uma proposta
 * compatível — nunca o inverso (g.2/g.3 nunca importam esta capacidade).
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
  "services/procurement-engineering",
  "infrastructure/budget-document-location",
] as const;

const FORBIDDEN_KEYWORDS = [
  "openai", "anthropic", "pdf-lib", "pdfkit", "pdf-parse", "pdfjs", "pypdf", "pdfplumber", "tesseract", "ocr", "llm", "supabase", "@supabase",
] as const;

const FORBIDDEN_SPECIFIER_KEYWORDS = ["apps/web", "@bba/web"] as const;

const FORBIDDEN_LOCAL_MODULE_SUFFIXES = ["physical-document-read.types", "physical-document-read.types.ts"] as const;

/**
 * Ao contrário de g.2/g.3, esta capacidade LÊ intencionalmente valores
 * econômicos — por isso o vocabulário econômico não é banido aqui. O que
 * permanece banido: hardcode do caso real, consolidação automática, e
 * qualquer semântica de IA/LLM.
 */
const FORBIDDEN_REAL_CASE_HARDCODE_KEYWORDS = [
  "lagoadoarroz", "dnocs", "pregao90006", "90006/2025",
] as const;

const FORBIDDEN_AUTOMATIC_CONSOLIDATION_KEYWORDS = ["autoconsolidate", "silentconsolidat", "autocreatebudgetversion"] as const;

interface ImportRef { readonly specifier: string; readonly line: number; }
interface Violation { readonly file: string; readonly line: number; readonly specifier: string; readonly reason: string; }

runTest("budget-document-economic-characterization source exists and guard scans it", () => {
  const files = listSourceFiles(MODULE_DIR);
  assertEqual(files.length > 8, true, `expected more than 8 source files, scanned ${files.length}`);
});

runTest("budget-document-economic-characterization does not import f.0/f.1/f.2a/f.2c/g.1 directly, infrastructure, persistence services, or the web app", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.startsWith(".")) {
        const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
        const hit = OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED.find((segment) => isUnderSegment(resolved, `packages/bdos-core/src/${segment}`));
        if (hit !== undefined) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `resolves into ${hit} — the economic characterization must consume exclusively g.2 and g.3 results` });
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
  assertNoViolations(violations, "budget-document-economic-characterization forbidden upstream/infrastructure/web dependency");
});

runTest("budget-document-economic-characterization never re-reads the physical read contract", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (!ref.specifier.startsWith(".")) return;
      const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
      if (FORBIDDEN_LOCAL_MODULE_SUFFIXES.some((suffix) => resolved.endsWith(suffix))) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "must never re-read the physical document read contract — consumes g.2's already-resolved text" });
    });
  });
  assertNoViolations(violations, "budget-document-economic-characterization forbidden physical-read import");
});

runTest("budget-document-economic-characterization introduces no PDF parser, OCR, AI/LLM or Supabase keyword", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase().replaceAll("no_ai_or_ocr_applied", "").replaceAll("no_llm_applied", "");
    FORBIDDEN_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) violations.push({ file: toRepoRelative(file), line: 1, specifier: keyword, reason: "forbidden parser/OCR/AI-LLM/Supabase keyword" });
    });
  });
  assertNoViolations(violations, "budget-document-economic-characterization parser/OCR/AI-LLM/Supabase dependency");
});

runTest("budget-document-economic-characterization contains no hardcoded reference to the real Lagoa do Arroz / DNOCS case", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase();
    FORBIDDEN_REAL_CASE_HARDCODE_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) violations.push({ file: toRepoRelative(file), line: 1, specifier: keyword, reason: "forbidden hardcoded reference to a specific real case — official values may only ever appear in acceptance reporting, never inside production classification logic" });
    });
  });
  assertNoViolations(violations, "budget-document-economic-characterization real-case hardcode");
});

runTest("budget-document-economic-characterization never performs automatic consolidation", () => {
  const violations: Violation[] = [];
  listSourceFiles(MODULE_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase();
    FORBIDDEN_AUTOMATIC_CONSOLIDATION_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) violations.push({ file: toRepoRelative(file), line: 1, specifier: keyword, reason: "forbidden automatic consolidation vocabulary — a proposal is never consolidated without explicit human action, out of scope entirely for this capacity" });
    });
    if (/\bconsolidateBudgetVersion\s*\(/.test(readFileSync(file, "utf8"))) {
      violations.push({ file: toRepoRelative(file), line: 1, specifier: "consolidateBudgetVersion(", reason: "the economic characterization must never call consolidateBudgetVersion directly — only a human-triggered application service may" });
    }
  });
  assertNoViolations(violations, "budget-document-economic-characterization automatic consolidation");
});

runTest("g.2 and g.3 never import the new economic characterization module — the guard is never bidirectional", () => {
  const violations: Violation[] = [];
  [PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_DIR, PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_DIR].forEach((dir) => {
    listSourceFiles(dir).forEach((file) => {
      readImportsFromFile(file).forEach((ref) => {
        if (ref.specifier.includes("budget-document-economic-characterization")) violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "an upstream capability must never depend on the downstream economic characterization" });
      });
    });
  });
  assertNoViolations(violations, "g.2/g.3 depending on budget-document-economic-characterization");
});

runTest("the economic characterization public barrel does not reference infrastructure, pdfjs, the testing bridge, or leak internal helpers", () => {
  const indexPath = join(MODULE_DIR, "index.ts");
  const content = readFileSync(indexPath, "utf8");
  const lower = content.toLowerCase();
  assertEqual(lower.includes("infrastructure"), false, "index.ts must not reference the infrastructure/ adapter layer");
  assertEqual(lower.includes("pdfjs"), false, "index.ts must not reference pdfjs-dist");
  assertEqual(lower.includes("testing"), false, "index.ts must not re-export the testing/ synthetic bridge as public API");
  const forbiddenExports = [
    "recognizeColumnRoles", "isHeaderCandidateLine", "cellVerbatimText",
    "classifyRow", "extractCellValuesByRole", "parseHierarchicalCode",
    "resolveGroupParent", "resolveSubgroupParent", "resolveServiceItemParentByCode", "resolveServiceItemParentByPosition",
    "computeProposedLineId", "parseBrazilianMoney", "parseBrazilianQuantity",
    "reconcileLine", "buildIndependentReferenceDiff", "buildSelfConsistencyDiagnostic",
    "computeMetrics", "sumServiceItemTotals", "computeIdentityFingerprint", "computeResultFingerprint",
    "validateEconomicCharacterizationInput", "PROFILE", "problem",
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
