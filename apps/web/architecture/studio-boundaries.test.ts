/**
 * Structural boundary guard for the Platform's Studio component folders
 * (see docs/PLATFORM_ARCHITECTURE.md). Mirrors the textual-import-scan
 * pattern used by packages/bdos-core/src/architecture/engineering-boundaries.test.ts:
 * no TypeScript Compiler API, no test framework, no network — a
 * deterministic filesystem check that fails loudly the day a Studio's
 * component tree starts importing another Studio's internals directly.
 *
 * STUDIO_COMPONENT_FOLDERS names each Studio folder individually (not a
 * wildcard over everything under components/) so that adding a new Studio
 * folder to the guard is a conscious opt-in, exactly like
 * OPERATIONAL_DOMAINS on the bdos-core side.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const COMPONENTS_ROOT = resolve(__dirname, "..", "components");

const STUDIO_COMPONENT_FOLDERS = ["bba-project", "geospatial"] as const;

interface ImportRef {
  readonly specifier: string;
  readonly line: number;
}

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
  readonly reason: string;
}

runTest("guard scans a non-trivial number of source files", () => {
  const total = STUDIO_COMPONENT_FOLDERS.reduce(
    (sum, folder) => sum + listComponentFiles(join(COMPONENTS_ROOT, folder)).length,
    0,
  );

  assertEqual(total > 0, true, `expected to scan at least 1 file, scanned ${total}`);
});

runTest("Studio component folders do not import from another Studio's component folder", () => {
  const violations = findCrossStudioViolations();
  assertNoViolations(violations, "cross-Studio import violation(s) found");
});

function findCrossStudioViolations(): ReadonlyArray<Violation> {
  const violations: Violation[] = [];

  STUDIO_COMPONENT_FOLDERS.forEach((ownFolder) => {
    const files = listComponentFiles(join(COMPONENTS_ROOT, ownFolder));

    files.forEach((file) => {
      readImportsFromFile(file).forEach((ref) => {
        if (!ref.specifier.startsWith(".")) {
          return;
        }

        const relPath = resolveRelativeSpecifier(file, ref.specifier);
        const hitFolder = STUDIO_COMPONENT_FOLDERS.find(
          (otherFolder) => otherFolder !== ownFolder && isUnderSegment(relPath, otherFolder),
        );

        if (hitFolder !== undefined) {
          violations.push({
            file: toRepoRelative(file),
            line: ref.line,
            specifier: ref.specifier,
            reason: `Studio folder "${ownFolder}" imports directly from Studio folder "${hitFolder}"`,
          });
        }
      });
    });
  });

  return violations;
}

function listComponentFiles(dir: string): ReadonlyArray<string> {
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
      files.push(...listComponentFiles(fullPath));
      return;
    }

    if ((entry.endsWith(".ts") || entry.endsWith(".tsx")) && !entry.endsWith(".test.ts")) {
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
  return relative(COMPONENTS_ROOT, absolutePath).split("\\").join("/");
}

function isUnderSegment(relPath: string, segment: string): boolean {
  return relPath === segment || relPath.startsWith(`${segment}/`);
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }

  const details = violations
    .map((violation) => `  ${violation.file}:${violation.line} imports "${violation.specifier}" — ${violation.reason}`)
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
