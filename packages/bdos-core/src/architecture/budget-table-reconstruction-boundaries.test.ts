import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIRECTORY = resolve(CURRENT_DIRECTORY, "..");
const ENGINE_DIRECTORY = join(
  SOURCE_DIRECTORY,
  "domain",
  "budget-table-reconstruction",
);
const LOCATION_DIRECTORY = join(
  SOURCE_DIRECTORY,
  "domain",
  "budget-document-location",
);

const DIAGNOSTIC_SEGMENTS = new Set([
  "testing",
  "fixtures",
  "discovery",
  "reference-truth",
  "cell-geometry",
  "expected-cell-geometry",
  "local-reader-evaluation",
  "results",
  "ground-truth",
  "evaluation-output",
  "expected-cells",
]);

const FORBIDDEN_PATH_SEGMENTS = [
  ...DIAGNOSTIC_SEGMENTS,
  "docling",
  "paddleocr",
  "openai",
  "anthropic",
  "supabase",
  "apps/web",
  "pdfjs-dist",
  "infrastructure",
  "budget-version",
  "document-reconstruction",
  "procurement-engineering",
  "persistence",
];

const CASE_SPECIFIC_PATTERNS: ReadonlyArray<RegExp> = [
  /lagoa\s+do\s+arroz/i,
  /05_anexo_tecnico/i,
  /\b(?:page|pagenumber)\s*={2,3}\s*(?:46|50|54)\b/i,
  /\b(?:46|50|54)\s*={2,3}\s*(?:page|pagenumber)\b/i,
  /Date\.now\s*\(/,
  /Math\.random\s*\(/,
  /randomUUID\s*\(/,
  /Math\.round\s*\(/,
  /\.toFixed\s*\(/,
  /parseFloat\s*\(/,
  /\bcanonicalJson\b/,
  /\.localeCompare\s*\(/,
];

function productiveTypeScriptFiles(root: string): ReadonlyArray<string> {
  const output: string[] = [];

  for (const entry of readdirSync(root)) {
    if (DIAGNOSTIC_SEGMENTS.has(entry)) {
      continue;
    }

    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      output.push(...productiveTypeScriptFiles(path));
    } else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) {
      output.push(path);
    }
  }

  return output.sort();
}

function importedSpecifiers(content: string): ReadonlyArray<string> {
  return [
    ...content.matchAll(
      /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    ),
  ].map((match) => match[1]!);
}

function test(name: string, body: () => void): void {
  body();
  console.log(`ok - ${name}`);
}

function assertNoViolations(violations: ReadonlyArray<string>): void {
  if (violations.length > 0) {
    throw new Error(violations.join("\n"));
  }
}

test("engine imports only its upstream physical domain and node crypto", () => {
  const violations: string[] = [];

  for (const file of productiveTypeScriptFiles(ENGINE_DIRECTORY)) {
    for (const specifier of importedSpecifiers(readFileSync(file, "utf8"))) {
      const normalized = specifier.toLowerCase();
      if (FORBIDDEN_PATH_SEGMENTS.some((value) => normalized.includes(value))) {
        violations.push(`${relative(SOURCE_DIRECTORY, file)} imports ${specifier}`);
      }
    }
  }

  assertNoViolations(violations);
});

test("budget document location never imports the semantic engine", () => {
  const violations = productiveTypeScriptFiles(LOCATION_DIRECTORY)
    .filter((file) =>
      importedSpecifiers(readFileSync(file, "utf8")).some((specifier) =>
        specifier.includes("budget-table-reconstruction"),
      ),
    )
    .map((file) => relative(SOURCE_DIRECTORY, file));

  assertNoViolations(violations);
});

test("productive engine has no case-specific or nondeterministic shortcuts", () => {
  const violations: string[] = [];

  for (const file of productiveTypeScriptFiles(ENGINE_DIRECTORY)) {
    const content = readFileSync(file, "utf8");
    for (const pattern of CASE_SPECIFIC_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${relative(SOURCE_DIRECTORY, file)} matches ${pattern}`);
      }
    }
  }

  assertNoViolations(violations);
});

test("productive barrels never export diagnostic paths", () => {
  const diagnosticPathSegments = [...DIAGNOSTIC_SEGMENTS];
  const violations = productiveTypeScriptFiles(ENGINE_DIRECTORY)
    .filter((file) => file.endsWith("index.ts"))
    .flatMap((file) =>
      importedSpecifiers(readFileSync(file, "utf8"))
        .filter((specifier) =>
          diagnosticPathSegments.some((value) =>
            specifier.toLowerCase().includes(value),
          ),
        )
        .map((specifier) => `${relative(SOURCE_DIRECTORY, file)} exports ${specifier}`),
    );

  assertNoViolations(violations);
});
