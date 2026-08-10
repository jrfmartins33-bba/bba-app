import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reconstructBudgetTable } from "../domain/budget-table-reconstruction";
import {
  buildSyntheticInput,
  mergedEntry,
  placedEntry,
} from "../domain/budget-table-reconstruction/testing/budget-table-reconstruction-synthetic-fixture";

/**
 * A synthetic page in the hierarchical-header class: two parent titles, each
 * narrower than and centered over its own three qualifier leaves, two lines
 * above them, plus body rows whose economic values arrive as a single merged
 * segment. Entirely invented -- generic vocabulary, invented codes, invented
 * amounts, invented coordinates.
 */
function hierarchicalGuardInput() {
  const columns = [
    { header: "", left: 0, right: 40 },
    { header: "", left: 140, right: 400 },
    { header: "", left: 490, right: 540 },
    { header: "", left: 560, right: 610 },
    { header: "", left: 630, right: 680 },
    { header: "", left: 700, right: 760 },
    { header: "", left: 780, right: 840 },
    { header: "", left: 860, right: 920 },
  ];
  const parentLine = [placedEntry("VALOR UNITÁRIO", 752, 866, 6)];
  const flatLine = [
    placedEntry("ITEM", 5, 35, 0),
    placedEntry("DESCRIÇÃO", 230, 310, 1),
    placedEntry("UNIDADE", 492, 538, 2),
    placedEntry("QTD", 560, 585, 3),
    placedEntry("BDI %", 632, 668, 4),
  ];
  const qualifierLine = [
    placedEntry("SEM BDI", 705, 750, 5),
    placedEntry("BDI", 795, 825, 6),
    placedEntry("COM BDI", 870, 912, 7),
  ];
  const bodyRow = (code: string, quantity: string) => [
    placedEntry(code, 2, 38, 0),
    placedEntry(`Composição sintética ${code}`, 140, 395, 1),
    placedEntry("m³", 500, 530, 2),
    mergedEntry([
      { text: quantity, left: 572, right: 608 },
      { text: "12,50%", left: 634, right: 678 },
      { text: "R$ 100,00", left: 702, right: 758 },
      { text: "R$ 12,50", left: 784, right: 838 },
      { text: "R$ 112,50", left: 862, right: 918 },
    ]),
  ];
  return buildSyntheticInput(columns, [
    {
      pageNumber: 1,
      includeHeader: false,
      rows: [parentLine, flatLine, qualifierLine, bodyRow("3.1.1", "2,00"), bodyRow("3.1.2", "5,00")],
    },
  ]);
}

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

/**
 * Column/band disambiguation must stay evidence-based: real observed
 * geometry, header-path structure, and exact-rational arithmetic only.
 * These patterns target actual declarations, not prose -- doc comments are
 * free to explain that no epsilon/threshold/score exists.
 */
const ARBITRARY_TOLERANCE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:const|let)\s+\w*epsilon\w*\s*=/i,
  /\b(?:const|let)\s+\w*threshold\w*\s*=/i,
  /\b(?:const|let)\s+\w*score\w*\s*=/i,
  /\b(?:const|let)\s+\w*tolerance\w*\s*=/i,
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

test("column and band disambiguation introduces no arbitrary epsilon, threshold, score, or tolerance", () => {
  const violations: string[] = [];

  for (const file of productiveTypeScriptFiles(ENGINE_DIRECTORY)) {
    const content = readFileSync(file, "utf8");
    for (const pattern of ARBITRARY_TOLERANCE_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${relative(SOURCE_DIRECTORY, file)} matches ${pattern}`);
      }
    }
  }

  assertNoViolations(violations);
});

/**
 * Structural invariants of the reconstructed table itself, checked on a
 * synthetic hierarchical-header page rather than by reading source text.
 * These are the three properties that, when violated, silently corrupt every
 * downstream number:
 *
 *   1. a resolved semantic column never shares documented geometry with
 *      another resolved semantic column, so one value can never be claimed by
 *      two roles at once;
 *   2. header semantics come only from the selected header block -- no atom
 *      used to name a column may originate on a body line;
 *   3. a line proven to belong to the header never becomes a business record.
 */
test("reconstruction invariants hold on a hierarchical header", () => {
  const violations: string[] = [];
  const result = reconstructBudgetTable(hierarchicalGuardInput());

  const resolved = result.columns.filter(
    (column) => column.status === "resolved" && column.role !== "unknown",
  );
  for (const left of resolved) {
    for (const right of resolved) {
      if (left.columnId >= right.columnId || left.pageNumber !== right.pageNumber) continue;
      if (left.leftPoints < right.rightPoints && right.leftPoints < left.rightPoints) {
        violations.push(
          `overlapping resolved semantic bands: ${left.role} and ${right.role} on page ${left.pageNumber}`,
        );
      }
    }
  }

  const headerRows = result.logicalRows.filter((row) => row.kind === "header");
  const headerLocatorIds = new Set(headerRows.map((row) => row.locatorId));
  const headerTextItemIds = new Set(
    result.lines
      .filter((line) => headerLocatorIds.has(line.locatorId))
      .flatMap((line) => line.textItemEvidenceIds),
  );
  for (const column of result.columns) {
    for (const atomId of column.headerAtomIds) {
      if (!headerTextItemIds.has(atomId)) {
        violations.push(`header atom ${atomId} does not originate on a selected header line`);
      }
    }
  }

  const headerRowIds = new Set(headerRows.map((row) => row.rowId));
  for (const record of result.records) {
    for (const rowId of record.rowIds) {
      if (headerRowIds.has(rowId)) {
        violations.push(`record ${record.recordId} was produced from selected header line ${rowId}`);
      }
    }
  }

  if (headerRows.length === 0) {
    violations.push("the guard fixture must actually select a header block");
  }
  if (resolved.length < 2) {
    violations.push("the guard fixture must actually resolve semantic columns");
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
