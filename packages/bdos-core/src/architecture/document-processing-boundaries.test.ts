import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const PACKAGE_ROOT = resolve(PACKAGE_SRC_ROOT, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");

const DOCUMENT_PROCESSING_DIRS = [
  join(PACKAGE_SRC_ROOT, "domain", "document-processing"),
  join(PACKAGE_SRC_ROOT, "services", "document-processing"),
  join(REPO_ROOT, "apps", "web", "lib", "bdos"),
] as const;

const DOCUMENT_PROCESSING_FILE_MARKERS = [
  "document-processing-mappers.ts",
  "document-processing-server-repository.ts",
] as const;

const ECONOMIC_DIRS = [
  join(PACKAGE_SRC_ROOT, "domain", "budget-version"),
  join(PACKAGE_SRC_ROOT, "services", "procurement-engineering"),
] as const;

const RECONSTRUCTION_DIR = join(PACKAGE_SRC_ROOT, "domain", "document-reconstruction");

const FORBIDDEN_DOCUMENT_PROCESSING_IMPORT_SEGMENTS = [
  "domain/budget-version",
  "services/procurement-engineering",
  "domain/document-reconstruction",
] as const;

const FORBIDDEN_DOCUMENT_PROCESSING_KEYWORDS = [
  "openai",
  "anthropic",
  "pdf-lib",
  "pdfkit",
  "pdf-parse",
  "pdfjs",
  "pypdf",
  "pdfplumber",
  "tesseract",
  "ocr",
] as const;

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

runTest("document-processing source exists and guard scans it", () => {
  const files = listDocumentProcessingSourceFiles();
  assertEqual(files.length > 5, true, `expected more than 5 document-processing source files, scanned ${files.length}`);
});

runTest("document-processing does not import budget-version, procurement-engineering or document-reconstruction", () => {
  const violations: Violation[] = [];

  listDocumentProcessingSourceFiles().forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      const normalizedSpecifier = ref.specifier.split("\\").join("/");

      if (ref.specifier.startsWith(".")) {
        const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
        const hit = FORBIDDEN_DOCUMENT_PROCESSING_IMPORT_SEGMENTS.find((segment) => isUnderSegment(resolved, `packages/bdos-core/src/${segment}`));

        if (hit !== undefined) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `resolves into ${hit}` });
        }
        return;
      }

      if (
        normalizedSpecifier.includes("@bba/bdos-core/services/procurement-engineering") ||
        normalizedSpecifier.includes("@bba/bdos-core/domain/budget-version")
      ) {
        violations.push({
          file: toRepoRelative(file),
          line: ref.line,
          specifier: ref.specifier,
          reason: "imports an economic or procurement service subpath",
        });
      }
    });
  });

  assertNoViolations(violations, "document-processing forbidden dependency");
});

runTest("document-processing introduces no PDF parser, OCR or AI dependency", () => {
  const violations: Violation[] = [];

  listDocumentProcessingSourceFiles().forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase();

    FORBIDDEN_DOCUMENT_PROCESSING_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) {
        violations.push({
          file: toRepoRelative(file),
          line: 1,
          specifier: keyword,
          reason: "forbidden parser/OCR/AI keyword in document-processing source",
        });
      }
    });
  });

  assertNoViolations(violations, "document-processing parser/OCR/AI dependency");
});

runTest("budget-version and procurement-engineering do not depend on document-processing", () => {
  const violations = findImportsOfDocumentProcessing(ECONOMIC_DIRS);
  assertNoViolations(violations, "economic domain importing document-processing");
});

runTest("document-reconstruction does not become the owner of document-processing", () => {
  const violations = findImportsOfDocumentProcessing([RECONSTRUCTION_DIR]);
  assertNoViolations(violations, "document-reconstruction importing document-processing");
});

function findImportsOfDocumentProcessing(dirs: ReadonlyArray<string>): ReadonlyArray<Violation> {
  const violations: Violation[] = [];

  dirs.flatMap(listTsFiles).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.includes("document-processing")) {
        violations.push({
          file: toRepoRelative(file),
          line: ref.line,
          specifier: ref.specifier,
          reason: "imports document-processing",
        });
      }
    });
  });

  return violations;
}

function listDocumentProcessingSourceFiles(): ReadonlyArray<string> {
  const coreFiles = DOCUMENT_PROCESSING_DIRS.slice(0, 2).flatMap(listTsFiles);
  const webFiles = listTsFiles(DOCUMENT_PROCESSING_DIRS[2]).filter((file) =>
    DOCUMENT_PROCESSING_FILE_MARKERS.some((marker) => file.endsWith(marker)),
  );
  return [...coreFiles, ...webFiles].filter((file) => !file.endsWith(".test.ts"));
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

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
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

function toRepoRelative(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split("\\").join("/");
}

function isUnderSegment(relPath: string, segment: string): boolean {
  return relPath === segment || relPath.startsWith(`${segment}/`);
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }

  const details = violations
    .map((violation) => `  ${violation.file}:${violation.line} imports "${violation.specifier}" - ${violation.reason}`)
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
