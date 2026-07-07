/**
 * Architectural boundary guard for EPIC 11 (see
 * docs/engineering-bdos/epic-11-decision-integration-blueprint.md).
 *
 * This is not a domain — it is a deterministic, filesystem-only check that
 * fails loudly when a source file crosses a forbidden boundary between the
 * Engineering Operational Layer (EPIC 10) and the decision-side domains
 * (Decision Engine, Business Facts, Executive Intelligence, revenue/cash
 * intelligence, geospatial intelligence) or the future Template Engine.
 * `FORBIDDEN_SEGMENTS_FOR_OPERATIONAL` names each Capability individually
 * (not a `capabilities/*` wildcard) — adding a new Capability means adding
 * its segment here too, as done for `capabilities/geospatial-intelligence`
 * (Release 2.2 / Sprint 10). Rule E (Release 2.4 / Sprint 12) extends the
 * same "operational domains stay behind one narrow adapter seam" idea from
 * Rule C to a second reader, `domain/spatial-object` — the pattern is meant
 * to be repeated this way for every future reader, not special-cased. It
 * reads only local files
 * under this package, performs a textual import scan (no TypeScript
 * compiler API, no network, no external runtime), and reports every
 * violation found.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "..");

const OPERATIONAL_DOMAINS = [
  "contract-management",
  "project-management",
  "work-package-management",
  "service-item-management",
  "engineer-workspace",
  "evidence-center",
  "measurement-workspace",
  "approval-workflow",
  "bulletin-generator",
  "export-engine",
  "schedule-management",
] as const;

// Rule A — exact repo-relative directories an operational domain may never
// resolve a relative import into.
const FORBIDDEN_SEGMENTS_FOR_OPERATIONAL: ReadonlyArray<string> = [
  "engines/decision",
  "capabilities/cash-intelligence",
  "capabilities/geospatial-intelligence",
  "domain/decision",
  "domain/decision-case",
  "domain/decision-portfolio",
  "domain/business-fact",
  "domain/business-facts-generator",
  "domain/executive-insight",
  "domain/executive-brief",
  "domain/executive-cash-intelligence",
  "domain/revenue-intelligence",
  "domain/cash-flow-signal",
  "domain/cash-forecast",
];

// Rule A — secondary heuristic net for bare (non-relative) specifiers, in
// case a forbidden layer is ever reachable through a package alias instead
// of a relative path.
const FORBIDDEN_KEYWORDS_FOR_OPERATIONAL: ReadonlyArray<string> = [
  "decision-engine",
  "decision-case",
  "decision-portfolio",
  "business-fact",
  "business-facts-generator",
  "executive-intelligence",
  "executive-insight",
  "executive-brief",
  "cash-intelligence",
  "geospatial-intelligence",
  "revenue-intelligence",
  "cash-flow",
  "cash-forecast",
  "template-engine",
  "template_engine",
];

// Rule C — the one seam the blueprint reserves for the future: a dedicated
// adapter namespace allowed to read operational snapshots. It does not
// exist yet; the exemption is coded so this guard does not need to change
// the day it is created.
const AUTHORIZED_BUSINESS_FACTS_SEAM =
  "domain/business-facts-generator/adapters/engineering-application";

// Rule E — the equivalent seam for the Geospatial Engine (Release 2.4 /
// Sprint 12): `domain/spatial-object`'s own core files must never import an
// operational domain directly. This one adapter subfolder is the sole
// authorized exception, mirroring Rule C exactly for a different reader.
const AUTHORIZED_SPATIAL_OBJECT_SEAM =
  "domain/spatial-object/adapters/work-package-management";

// Rule D — Export Engine must stay conceptual: no filesystem, no binary
// encoding, no real document generation library, no Template Engine.
const EXACT_FORBIDDEN_SPECIFIERS_FOR_EXPORT_ENGINE: ReadonlyArray<string> = [
  "fs",
  "node:fs",
  "path",
  "node:path",
  "buffer",
  "node:buffer",
];
const SUBSTRING_FORBIDDEN_SPECIFIERS_FOR_EXPORT_ENGINE: ReadonlyArray<string> = [
  "xlsx",
  "exceljs",
  "pdfkit",
  "pdf-lib",
  "pdf-parse",
  "base64",
  "template-engine",
  "template_engine",
  "templateengine",
];

interface ImportRef {
  readonly specifier: string;
  readonly line: number;
}

interface Violation {
  readonly rule: "A" | "B" | "C" | "D" | "E";
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
  readonly reason: string;
}

runTest("guard scans a non-trivial number of source files", () => {
  const total =
    OPERATIONAL_DOMAINS.reduce(
      (sum, domain) => sum + listTsFiles(join(SRC_ROOT, "domain", domain)).length,
      0,
    ) +
    listTsFiles(join(SRC_ROOT, "engines", "decision")).length +
    listTsFiles(join(SRC_ROOT, "domain", "business-facts-generator")).length +
    listTsFiles(join(SRC_ROOT, "domain", "spatial-object")).length;

  assertEqual(total > 20, true, `expected to scan more than 20 files, scanned ${total}`);
});

runTest(
  "Rule A: operational domains do not import decision, business facts, executive intelligence, cash/revenue intelligence or template engine",
  () => {
    const violations = findOperationalDomainViolations();
    assertNoViolations(violations, "Rule A violation(s) found");
  },
);

runTest("Rule B: Decision Engine does not import operational domains directly", () => {
  const violations = findDecisionEngineViolations();
  assertNoViolations(violations, "Rule B violation(s) found");
});

runTest(
  "Rule C: Business Facts Generator does not import operational domains directly outside the authorized adapter seam",
  () => {
    const violations = findBusinessFactsGeneratorViolations();
    assertNoViolations(violations, "Rule C violation(s) found");
  },
);

runTest(
  "Rule D: Export Engine does not import filesystem, path, buffer/base64, real document libraries or Template Engine",
  () => {
    const violations = findExportEngineViolations();
    assertNoViolations(violations, "Rule D violation(s) found");
  },
);

runTest(
  "Rule E: Spatial Object does not import operational domains directly outside the authorized adapter seam",
  () => {
    const violations = findSpatialObjectViolations();
    assertNoViolations(violations, "Rule E violation(s) found");
  },
);

function findOperationalDomainViolations(): ReadonlyArray<Violation> {
  const violations: Violation[] = [];

  OPERATIONAL_DOMAINS.forEach((domain) => {
    const files = listTsFiles(join(SRC_ROOT, "domain", domain));

    files.forEach((file) => {
      readImportsFromFile(file).forEach((ref) => {
        if (ref.specifier.startsWith(".")) {
          const relPath = resolveRelativeSpecifier(file, ref.specifier);
          const hitSegment = FORBIDDEN_SEGMENTS_FOR_OPERATIONAL.find((segment) =>
            isUnderSegment(relPath, segment),
          );

          if (hitSegment !== undefined) {
            violations.push({
              rule: "A",
              file: toRepoRelative(file),
              line: ref.line,
              specifier: ref.specifier,
              reason: `operational domain "${domain}" resolves into forbidden layer "${hitSegment}"`,
            });
          }
        } else {
          const lower = ref.specifier.toLowerCase();
          const hitKeyword = FORBIDDEN_KEYWORDS_FOR_OPERATIONAL.find((keyword) =>
            lower.includes(keyword),
          );

          if (hitKeyword !== undefined) {
            violations.push({
              rule: "A",
              file: toRepoRelative(file),
              line: ref.line,
              specifier: ref.specifier,
              reason: `operational domain "${domain}" imports a specifier matching forbidden keyword "${hitKeyword}"`,
            });
          }
        }
      });
    });
  });

  return violations;
}

function findDecisionEngineViolations(): ReadonlyArray<Violation> {
  const violations: Violation[] = [];
  const files = listTsFiles(join(SRC_ROOT, "engines", "decision"));

  files.forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (!ref.specifier.startsWith(".")) {
        return;
      }

      const relPath = resolveRelativeSpecifier(file, ref.specifier);
      const hitDomain = OPERATIONAL_DOMAINS.find((domain) =>
        isUnderSegment(relPath, `domain/${domain}`),
      );

      if (hitDomain !== undefined) {
        violations.push({
          rule: "B",
          file: toRepoRelative(file),
          line: ref.line,
          specifier: ref.specifier,
          reason: `Decision Engine imports operational domain "${hitDomain}" directly`,
        });
      }
    });
  });

  return violations;
}

function findBusinessFactsGeneratorViolations(): ReadonlyArray<Violation> {
  const violations: Violation[] = [];
  const files = listTsFiles(join(SRC_ROOT, "domain", "business-facts-generator"));

  files.forEach((file) => {
    const fileDirRel = toRepoRelative(dirname(file));

    if (isUnderSegment(fileDirRel, AUTHORIZED_BUSINESS_FACTS_SEAM)) {
      return;
    }

    readImportsFromFile(file).forEach((ref) => {
      if (!ref.specifier.startsWith(".")) {
        return;
      }

      const relPath = resolveRelativeSpecifier(file, ref.specifier);
      const hitDomain = OPERATIONAL_DOMAINS.find((domain) =>
        isUnderSegment(relPath, `domain/${domain}`),
      );

      if (hitDomain !== undefined) {
        violations.push({
          rule: "C",
          file: toRepoRelative(file),
          line: ref.line,
          specifier: ref.specifier,
          reason: `Business Facts Generator imports operational domain "${hitDomain}" directly outside "${AUTHORIZED_BUSINESS_FACTS_SEAM}"`,
        });
      }
    });
  });

  return violations;
}

function findSpatialObjectViolations(): ReadonlyArray<Violation> {
  const violations: Violation[] = [];
  const files = listTsFiles(join(SRC_ROOT, "domain", "spatial-object"));

  files.forEach((file) => {
    const fileDirRel = toRepoRelative(dirname(file));

    if (isUnderSegment(fileDirRel, AUTHORIZED_SPATIAL_OBJECT_SEAM)) {
      return;
    }

    readImportsFromFile(file).forEach((ref) => {
      if (!ref.specifier.startsWith(".")) {
        return;
      }

      const relPath = resolveRelativeSpecifier(file, ref.specifier);
      const hitDomain = OPERATIONAL_DOMAINS.find((domain) =>
        isUnderSegment(relPath, `domain/${domain}`),
      );

      if (hitDomain !== undefined) {
        violations.push({
          rule: "E",
          file: toRepoRelative(file),
          line: ref.line,
          specifier: ref.specifier,
          reason: `Spatial Object imports operational domain "${hitDomain}" directly outside "${AUTHORIZED_SPATIAL_OBJECT_SEAM}"`,
        });
      }
    });
  });

  return violations;
}

function findExportEngineViolations(): ReadonlyArray<Violation> {
  const violations: Violation[] = [];
  const files = listTsFiles(join(SRC_ROOT, "domain", "export-engine"));

  files.forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      const lower = ref.specifier.toLowerCase();
      const isExactHit = EXACT_FORBIDDEN_SPECIFIERS_FOR_EXPORT_ENGINE.includes(lower);
      const substringHit = SUBSTRING_FORBIDDEN_SPECIFIERS_FOR_EXPORT_ENGINE.find((keyword) =>
        lower.includes(keyword),
      );

      if (isExactHit || substringHit !== undefined) {
        violations.push({
          rule: "D",
          file: toRepoRelative(file),
          line: ref.line,
          specifier: ref.specifier,
          reason: isExactHit
            ? `Export Engine imports forbidden runtime module "${ref.specifier}"`
            : `Export Engine imports a specifier matching forbidden keyword "${substringHit}"`,
        });
      }
    });
  });

  return violations;
}

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

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts") && !entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  });

  return files;
}

function readImportsFromFile(filePath: string): ReadonlyArray<ImportRef> {
  const content = readFileSync(filePath, "utf8");
  const pattern =
    /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm;
  const refs: ImportRef[] = [];
  let match: RegExpExecArray | null = pattern.exec(content);

  while (match !== null) {
    const specifier = match[1] ?? match[2] ?? match[3];

    if (specifier !== undefined) {
      const line = content.slice(0, match.index).split("\n").length;
      refs.push({ specifier, line });
    }

    match = pattern.exec(content);
  }

  return refs;
}

function resolveRelativeSpecifier(fromFile: string, specifier: string): string {
  const resolved = resolve(dirname(fromFile), specifier);
  return toRepoRelative(resolved);
}

function toRepoRelative(absolutePath: string): string {
  return relative(SRC_ROOT, absolutePath).split("\\").join("/");
}

function isUnderSegment(relPath: string, segment: string): boolean {
  return relPath === segment || relPath.startsWith(`${segment}/`);
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }

  const details = violations
    .map(
      (violation) =>
        `  [Rule ${violation.rule}] ${violation.file}:${violation.line} imports "${violation.specifier}" — ${violation.reason}`,
    )
    .join("\n");

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
