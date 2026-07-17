import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "./testing/tabular-region-detection-test-bridge";
import { buildTabularRegionDetectionFixture } from "./testing/tabular-region-detection-test-bridge";
import { detectBudgetDocumentTabularRegions } from "./detect-budget-document-tabular-regions";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const ROW_HEIGHT = 12;
const ROW_STEP = 25;

/**
 * `count` linhas de duas colunas (100-160 e 300-360), idênticas entre
 * linhas — um "bloco tabular" físico limpo. Índices explícitos (mesmo
 * padrão de `SyntheticGeometryTextItem.index` da Sprint anterior) para que
 * embaralhar o array de itens produza a mesma página com os mesmos
 * índices, permitindo provar independência de ordem.
 */
function twoColumnRows(count: number, startTop = 700): ReadonlyArray<SyntheticGeometryTextItem> {
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < count; row += 1) {
    const top = startTop - row * ROW_STEP;
    items.push({ text: `col1-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + ROW_HEIGHT, index: row * 2 });
    items.push({ text: `col2-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: row * 2 + 1 });
  }
  return items;
}

/** `count` linhas de um único parágrafo, cada uma com a margem esquerda estável mas larguras variáveis — nunca duas evidências de alinhamento distintas. */
function ordinaryParagraphRows(count: number, startTop = 700): ReadonlyArray<SyntheticGeometryTextItem> {
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < count; row += 1) {
    const top = startTop - row * ROW_STEP;
    const width = 200 + (row % 4) * 15;
    items.push({ text: `line-${row}`, leftPoints: 80, topPoints: top, rightPoints: 80 + width, bottomPoints: top + ROW_HEIGHT });
  }
  return items;
}

function page(items: ReadonlyArray<SyntheticGeometryTextItem>): SyntheticGeometryPage {
  return { widthPoints: PAGE_WIDTH, heightPoints: PAGE_HEIGHT, items };
}

runTest("a clean two-column, four-row tabular block on one page forms exactly one detected region", () => {
  const structureReconstruction = buildTabularRegionDetectionFixture("clean-table", [page(twoColumnRows(4))]);
  assertEqual(structureReconstruction.status, "completed", "fixture precondition: structure reconstruction must succeed cleanly");

  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  assertEqual(result.status, "completed");
  assertEqual(result.groups.length, 1);
  const page1 = result.groups[0].pages[0];
  assertEqual(page1.status, "detected");
  assertEqual(page1.regions.length, 1);
  assertEqual(page1.regions[0].lineKeys.length, 4);
  assertEqual(page1.regions[0].supportingAlignmentKeys.length >= 2, true);
  assertEqual(page1.lineDispositions.every((d) => d.status === "included_in_candidate_region"), true);
});

runTest("an ordinary paragraph with a stable left margin but no second recurring alignment never forms a region", () => {
  const structureReconstruction = buildTabularRegionDetectionFixture("paragraph", [page(ordinaryParagraphRows(6))]);
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const page1 = result.groups[0].pages[0];
  assertEqual(page1.regions.length, 0);
  assertEqual(page1.status, "no_candidate_region");
  assertEqual(page1.lineDispositions.every((d) => d.status === "not_in_tabular_region"), true);
});

runTest("a numbered list (stable left margin, varying content width) never forms a region, same as an ordinary paragraph", () => {
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < 6; row += 1) {
    const top = 700 - row * ROW_STEP;
    const width = 150 + row * 22;
    items.push({ text: `${row + 1}. item`, leftPoints: 90, topPoints: top, rightPoints: 90 + width, bottomPoints: top + ROW_HEIGHT });
  }
  const structureReconstruction = buildTabularRegionDetectionFixture("numbered-list", [page(items)]);
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  assertEqual(result.groups[0].pages[0].regions.length, 0);
});

runTest("two lines (below the minimum of three) never form a region even with perfect two-column alignment", () => {
  const structureReconstruction = buildTabularRegionDetectionFixture("two-rows", [page(twoColumnRows(2))]);
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  assertEqual(result.groups[0].pages[0].regions.length, 0);
  assertEqual(result.groups[0].pages[0].status, "no_candidate_region");
});

runTest("a wide title line adjacent to a clean tabular block never merges into or is absorbed by the region", () => {
  const items = [
    { text: "PLANILHA DE SERVICOS", leftPoints: 80, topPoints: 730, rightPoints: 500, bottomPoints: 742, index: 8 },
    ...twoColumnRows(4, 700),
  ];
  const structureReconstruction = buildTabularRegionDetectionFixture("title-plus-table", [page(items)]);
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const page1 = result.groups[0].pages[0];
  assertEqual(page1.regions.length, 1);
  assertEqual(page1.regions[0].lineKeys.length, 4, "the title line never becomes a member of the region");
});

runTest("a note line adjacent below a clean tabular block never merges into the region", () => {
  const items = [...twoColumnRows(4, 700), { text: "Nota explicativa qualquer", leftPoints: 80, topPoints: 590, rightPoints: 400, bottomPoints: 602, index: 8 }];
  const structureReconstruction = buildTabularRegionDetectionFixture("table-plus-note", [page(items)]);
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const page1 = result.groups[0].pages[0];
  assertEqual(page1.regions.length, 1);
  assertEqual(page1.regions[0].lineKeys.length, 4);
});

runTest("two independent tabular blocks with different column positions on the same page form two separate detected regions", () => {
  const upperBlock = twoColumnRows(3, 760).map((item) => ({ ...item }));
  const lowerBlock: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < 3; row += 1) {
    const top = 500 - row * ROW_STEP;
    lowerBlock.push({ text: `low1-${row}`, leftPoints: 200, topPoints: top, rightPoints: 250, bottomPoints: top + ROW_HEIGHT, index: 6 + row * 2 });
    lowerBlock.push({ text: `low2-${row}`, leftPoints: 450, topPoints: top, rightPoints: 500, bottomPoints: top + ROW_HEIGHT, index: 6 + row * 2 + 1 });
  }
  const structureReconstruction = buildTabularRegionDetectionFixture("two-regions", [page([...upperBlock, ...lowerBlock])]);
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const page1 = result.groups[0].pages[0];
  assertEqual(page1.regions.length, 2, "two structurally independent blocks never merge into one region");
  assertEqual(page1.lineDispositions.every((d) => d.status === "included_in_candidate_region"), true);
});

runTest("conservation: every physical line ends in exactly one disposition, and the counts close exactly against the metrics", () => {
  const structureReconstruction = buildTabularRegionDetectionFixture("conservation", [page(twoColumnRows(5))]);
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const page1 = result.groups[0].pages[0];
  const total =
    page1.metrics.includedInCandidateRegionLineCount +
    page1.metrics.notInTabularRegionLineCount +
    page1.metrics.unresolvedAmbiguityLineCount +
    page1.metrics.unresolvedDetectionFailedLineCount;
  assertEqual(total, page1.metrics.totalLineCount);
  assertEqual(page1.lineDispositions.length, page1.metrics.totalLineCount);
  const uniqueLineKeys = new Set(page1.lineDispositions.map((d) => d.lineKey));
  assertEqual(uniqueLineKeys.size, page1.lineDispositions.length, "no duplicated line disposition");
});

runTest("permutation independence: shuffling the input item array produces a JSON-equivalent full detection result", () => {
  const ordered = twoColumnRows(4);
  const shuffled = [ordered[3], ordered[0], ordered[2], ordered[1], ordered[5], ordered[4], ordered[7], ordered[6]];
  const a = detectBudgetDocumentTabularRegions({ structureReconstruction: buildTabularRegionDetectionFixture("permutation", [page(ordered)]) });
  const b = detectBudgetDocumentTabularRegions({ structureReconstruction: buildTabularRegionDetectionFixture("permutation", [page(shuffled)]) });
  assertEqual(JSON.stringify(a), JSON.stringify(b));
});

runTest("determinism: two independent detections of the same input produce a JSON-equivalent result", () => {
  const structureReconstruction = buildTabularRegionDetectionFixture("determinism", [page(twoColumnRows(4))]);
  const a = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const b = detectBudgetDocumentTabularRegions({ structureReconstruction });
  assertEqual(JSON.stringify(a), JSON.stringify(b));
});

runTest("the input structureReconstruction is never mutated", () => {
  const structureReconstruction = buildTabularRegionDetectionFixture("immutability", [page(twoColumnRows(4))]);
  const before = JSON.stringify(structureReconstruction);
  Object.freeze(structureReconstruction);
  detectBudgetDocumentTabularRegions({ structureReconstruction });
  assertEqual(JSON.stringify(structureReconstruction), before);
});

runTest("individual source identities are preserved and equal to the ones carried by the structure reconstruction result", () => {
  const structureReconstruction = buildTabularRegionDetectionFixture("identities", [page(twoColumnRows(4))]);
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  assertEqual(result.sourceByteHash, structureReconstruction.sourceByteHash);
  assertEqual(result.sourceReconstructorName, structureReconstruction.reconstructorName);
  assertEqual(result.sourceReconstructorVersion, structureReconstruction.reconstructorVersion);
  assertEqual(result.sourceReconstructionContextFingerprint, structureReconstruction.reconstructionContextFingerprint);
});

runTest("the result declares every required limitation code, never claiming commercial readiness or economic interpretation", () => {
  const structureReconstruction = buildTabularRegionDetectionFixture("limitations", [page(twoColumnRows(4))]);
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction });
  ["candidate_region_is_not_a_confirmed_table", "no_budget_version_created", "no_commercial_readiness_claim", "real_document_out_of_scope"].forEach((code) => {
    assertEqual(result.limitations.includes(code as (typeof result.limitations)[number]), true, `missing limitation ${code}`);
  });
});

runTest("a source contract with an unsupported schema version is rejected as failed, never silently accepted", () => {
  const structureReconstruction = buildTabularRegionDetectionFixture("unsupported", [page(twoColumnRows(4))]);
  const tampered = { ...structureReconstruction, schemaVersion: 2 as unknown as typeof structureReconstruction.schemaVersion };
  const result = detectBudgetDocumentTabularRegions({ structureReconstruction: tampered });
  assertEqual(result.status, "failed");
  assertEqual(result.technicalProblems.some((p) => p.code === "source_contract_version_unsupported"), true);
  assertEqual(result.sourceByteHash, structureReconstruction.sourceByteHash, "source identities remain present even when failed");
});
