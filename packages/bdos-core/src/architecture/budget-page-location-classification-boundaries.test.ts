import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const REPO_ROOT = resolve(PACKAGE_SRC_ROOT, "..", "..", "..");
const PAGE_LOCATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "page-location");

const FORBIDDEN_DEPENDENCY_KEYWORDS = [
  "pdfjs",
  "pdf-lib",
  "pdfkit",
  "pdf-parse",
  "pypdf",
  "pdfplumber",
  "tesseract",
  "ocr",
  "openai",
  "anthropic",
  "embedding",
  "supabase",
  "@supabase",
  "apps/web",
  "apps/mobile",
  "infrastructure",
  "document-reconstruction",
  "document-processing",
  "budget-version",
  "procurement-engineering",
  "dnocs",
  "dnit",
  "lagoa do arroz",
  "lagoa-do-arroz",
] as const;

function listTsFiles(dir: string): ReadonlyArray<string> {
  const files: string[] = [];
  readdirSync(dir).forEach((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      if (entry !== "testing") {
        files.push(...listTsFiles(fullPath));
      }
      return;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  });
  return files;
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

function assertNoMatches(matches: ReadonlyArray<string>, message: string): void {
  if (matches.length > 0) {
    throw new Error(`${message}:\n${matches.join("\n")}`);
  }
}

runTest("page-location production source exists and is scanned", () => {
  assertEqual(listTsFiles(PAGE_LOCATION_DIR).length >= 8, true, "expected all approved production modules");
});

runTest("page-location has no parser, AI, storage, application, or reconstruction dependency", () => {
  const matches: string[] = [];
  listTsFiles(PAGE_LOCATION_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase();
    FORBIDDEN_DEPENDENCY_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) {
        matches.push(`${relative(REPO_ROOT, file)} contains ${keyword}`);
      }
    });
  });
  assertNoMatches(matches, "forbidden page-location dependency");
});

runTest("page-location never imports physical reader contracts or observer executable rules", () => {
  const matches: string[] = [];
  listTsFiles(PAGE_LOCATION_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8");
    const importPattern = /\bfrom\s+["']([^"']+)["']/g;
    let match: RegExpExecArray | null = importPattern.exec(content);
    while (match !== null) {
      const specifier = match[1];
      if (
        specifier.includes("physical-document-read") ||
        specifier.includes("signal-observation-rules") ||
        specifier.endsWith("signal-observation/signal-observation")
      ) {
        matches.push(`${relative(REPO_ROOT, file)} imports ${specifier}`);
      }
      match = importPattern.exec(content);
    }
  });
  assertNoMatches(matches, "forbidden lower-level executable dependency");
});

runTest("the locator public entry accepts only the observation result", () => {
  const content = readFileSync(join(PAGE_LOCATION_DIR, "locate-budget-document-pages.ts"), "utf8");
  assertEqual(content.includes("source: DocumentSignalObservationResult"), true, "missing approved input contract");
  assertEqual(content.includes("Uint8Array"), false, "locator must not accept document bytes");
  assertEqual(content.includes("PhysicalDocumentReadResult"), false, "locator must not accept physical read results");
});

runTest("page-location source declares no score, confidence, probability, ranking, or discard field", () => {
  const matches: string[] = [];
  const fieldPattern = /\breadonly\s+([a-zA-Z_$][\w$]*)\s*[:?]/g;
  listTsFiles(PAGE_LOCATION_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null = fieldPattern.exec(content);
    while (match !== null) {
      if (/score|confidence|probability|rank|discard/i.test(match[1])) {
        matches.push(`${relative(REPO_ROOT, file)} declares ${match[1]}`);
      }
      match = fieldPattern.exec(content);
    }
  });
  assertNoMatches(matches, "forbidden decision field");
});

runTest("page-location source has no clock, random, UUID, or environment dependency", () => {
  const matches: string[] = [];
  listTsFiles(PAGE_LOCATION_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8");
    ["Date.now", "new Date", "Math.random", "randomUUID", "process.env"].forEach((needle) => {
      if (content.includes(needle)) {
        matches.push(`${relative(REPO_ROOT, file)} contains ${needle}`);
      }
    });
  });
  assertNoMatches(matches, "nondeterministic page-location dependency");
});

runTest("test fixtures and internal phase modules are not exported from the page-location barrel", () => {
  const content = readFileSync(join(PAGE_LOCATION_DIR, "index.ts"), "utf8");
  ["testing", "input-validation", "classification", "propagation", "candidate-groups", "decision-rule-registry"].forEach((needle) => {
    assertEqual(content.includes(needle), false, `public barrel leaks ${needle}`);
  });
});

runTest("production page-location source does not import its testing helpers", () => {
  const matches = listTsFiles(PAGE_LOCATION_DIR)
    .filter((file) => readFileSync(file, "utf8").includes("/testing/"))
    .map((file) => relative(REPO_ROOT, file));
  assertNoMatches(matches, "production source imports testing helpers");
});
