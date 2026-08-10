import { reconstructBudgetTable } from "./budget-table-reconstruction";
import { classifyRecords } from "./budget-table-reconstruction-record-classification";
import type {
  BudgetColumnRole,
  BudgetTableReconstructionResult,
  BudgetTableSchemaExpectation,
  ReconstructedCell,
  ReconstructedLogicalRow,
  ResolvedColumn,
} from "./budget-table-reconstruction.types";
import {
  buildSyntheticInput,
  entry,
  mergedEntry,
  placedEntry,
  type SyntheticColumn,
  type SyntheticEntry,
  type SyntheticPage,
} from "./testing/budget-table-reconstruction-synthetic-fixture";

/**
 * Closure suite for the structural defect classes proven on the real
 * regression corpus and reproduced here on entirely synthetic documents:
 *
 *   D1 a repeated table schema must reconstruct the same roles on every page
 *      of the family, even where one page's geometry alone cannot prove the
 *      parent/child relation;
 *   D2 a collision between two widened header bands must be resolved locally,
 *      never by reverting the whole header line;
 *   D3 a description continuation continues the description and opens no new
 *      economic obligation;
 *   D5 a grouping row that documents a consolidated total must reconstruct it
 *      from the total-price leaf, never a sibling and never a concatenation;
 *   D6 a role the schema was proven to have stays expected on a page that
 *      failed to resolve it, so no record is falsely reported as resolved;
 *   D7 an empty structural-issue list is not a completeness claim.
 *
 * Every fixture below is invented: generic budget vocabulary, invented codes,
 * invented amounts, invented coordinates.
 */

let failures = 0;

function test(name: string, body: () => void): void {
  try {
    body();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`not ok - ${name}`);
    console.log(String(error instanceof Error ? error.stack : error));
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message = "values differ"): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const ECONOMIC_SCHEMA_ROLES: ReadonlyArray<BudgetColumnRole> = [
  "item_code",
  "description",
  "unit",
  "quantity",
  "bdi_rate",
  "unit_cost",
  "unit_price",
  "total_price",
];

function rolesResolvedOnPage(
  result: BudgetTableReconstructionResult,
  pageNumber: number,
): ReadonlySet<BudgetColumnRole> {
  return new Set(
    result.columns
      .filter(
        (column) =>
          column.pageNumber === pageNumber &&
          column.status === "resolved" &&
          column.role !== "unknown",
      )
      .map((column) => column.role),
  );
}

function columnsForRole(
  result: BudgetTableReconstructionResult,
  pageNumber: number,
  role: BudgetColumnRole,
): ReadonlyArray<ResolvedColumn> {
  return result.columns.filter(
    (column) =>
      column.pageNumber === pageNumber && column.role === role && column.status === "resolved",
  );
}

// ---------------------------------------------------------------------------
// D1 -- repeated table schema across pages
// ---------------------------------------------------------------------------

/**
 * Eleven physical columns: identity, description, unit, quantity, a rate, and
 * two hierarchical families of three qualifier leaves each. The two parent
 * titles are what a real budget draws over such families, and the point of
 * the fixture is that a parent title is NOT reliably as wide as the family it
 * governs.
 */
const FAMILY_COLUMNS: ReadonlyArray<SyntheticColumn> = [
  { header: "", left: 0, right: 40 },
  { header: "", left: 60, right: 300 },
  { header: "", left: 320, right: 370 },
  { header: "", left: 390, right: 440 },
  { header: "", left: 460, right: 510 },
  { header: "", left: 530, right: 580 },
  { header: "", left: 600, right: 650 },
  { header: "", left: 670, right: 720 },
  { header: "", left: 740, right: 790 },
  { header: "", left: 810, right: 860 },
  { header: "", left: 880, right: 930 },
];

function familyFlatHeaderLine(shift: number): SyntheticEntry[] {
  return [
    placedEntry("ITEM", 5 + shift, 35 + shift, 0),
    placedEntry("DESCRIÇÃO", 120 + shift, 220 + shift, 1),
    placedEntry("UNIDADE", 325 + shift, 365 + shift, 2),
    placedEntry("QTD", 395 + shift, 435 + shift, 3),
    placedEntry("BDI %", 465 + shift, 505 + shift, 4),
  ];
}

function familyQualifierHeaderLine(shift: number): SyntheticEntry[] {
  return [
    placedEntry("SEM BDI", 532 + shift, 578 + shift, 5),
    placedEntry("BDI", 615 + shift, 640 + shift, 6),
    placedEntry("COM BDI", 672 + shift, 718 + shift, 7),
    placedEntry("SEM BDI", 742 + shift, 788 + shift, 8),
    placedEntry("BDI", 825 + shift, 850 + shift, 9),
    placedEntry("COM BDI", 882 + shift, 928 + shift, 10),
  ];
}

/** Parent titles wide enough to contain their own outer children: the page
 * whose geometry alone proves the hierarchy. */
function wideParentHeaderLine(shift: number): SyntheticEntry[] {
  return [
    placedEntry("VALOR UNITÁRIO", 530 + shift, 720 + shift, 6),
    placedEntry("PREÇO TOTAL", 740 + shift, 930 + shift, 9),
  ];
}

/** Parent titles centered over the middle child only, exactly as a real
 * centered title behaves: the page whose geometry alone proves nothing about
 * its own outer children. */
function narrowParentHeaderLine(shift: number): SyntheticEntry[] {
  return [
    placedEntry("VALOR UNITÁRIO", 610 + shift, 645 + shift, 6),
    placedEntry("PREÇO TOTAL", 820 + shift, 855 + shift, 9),
  ];
}

function familyItemRow(code: string, shift: number): SyntheticEntry[] {
  return [
    placedEntry(code, 2 + shift, 38 + shift, 0),
    placedEntry(`Composição sintética ${code}`, 62 + shift, 290 + shift, 1),
    placedEntry("m³", 325 + shift, 365 + shift, 2),
    placedEntry("2,00", 397 + shift, 437 + shift, 3),
    placedEntry("25,00%", 465 + shift, 505 + shift, 4),
    placedEntry("R$ 100,00", 532 + shift, 578 + shift, 5),
    placedEntry("R$ 25,00", 602 + shift, 648 + shift, 6),
    placedEntry("R$ 125,00", 672 + shift, 718 + shift, 7),
    placedEntry("R$ 200,00", 742 + shift, 788 + shift, 8),
    placedEntry("R$ 50,00", 812 + shift, 858 + shift, 9),
    placedEntry("R$ 250,00", 882 + shift, 928 + shift, 10),
  ];
}

function familyPage(
  pageNumber: number,
  parentLine: SyntheticEntry[],
  shift: number,
): SyntheticPage {
  return {
    pageNumber,
    includeHeader: false,
    rows: [
      parentLine,
      familyFlatHeaderLine(shift),
      familyQualifierHeaderLine(shift),
      familyItemRow("4.1.1", shift),
      familyItemRow("4.1.2", shift),
    ],
  };
}

function multiPageFamilyResult(): BudgetTableReconstructionResult {
  return reconstructBudgetTable(
    buildSyntheticInput(FAMILY_COLUMNS, [
      // Page 1: ideal geometry -- the parent titles reach their own children.
      familyPage(1, wideParentHeaderLine(0), 0),
      // Page 2: narrow parent labels; the outer children sit outside them.
      familyPage(2, narrowParentHeaderLine(0), 0),
      // Page 3: narrow parent labels AND a small physical displacement, so the
      // schema is identical while the geometry is not.
      familyPage(3, narrowParentHeaderLine(7), 7),
    ]),
  );
}

test("D1: every page of a proven schema family resolves the same eight roles exactly once", () => {
  const result = multiPageFamilyResult();
  for (const pageNumber of [1, 2, 3]) {
    for (const role of ECONOMIC_SCHEMA_ROLES) {
      const columns = columnsForRole(result, pageNumber, role);
      equal(
        columns.length,
        1,
        `page ${pageNumber} must resolve exactly one ${role} column`,
      );
    }
  }
});

test("D1: no leaf family falls back to unknown for want of a local parent", () => {
  const result = multiPageFamilyResult();
  for (const pageNumber of [1, 2, 3]) {
    const resolved = rolesResolvedOnPage(result, pageNumber);
    for (const role of ECONOMIC_SCHEMA_ROLES) {
      assert(resolved.has(role), `page ${pageNumber} lost role ${role}`);
    }
  }
});

test("D1: schema semantics travel between pages of a family, page geometry never does", () => {
  const result = multiPageFamilyResult();
  const bandOf = (pageNumber: number, role: BudgetColumnRole) =>
    columnsForRole(result, pageNumber, role)[0]!;
  // Page 3 is physically displaced; its bands must be measured where its own
  // evidence is, not copied from the page that proved the ancestry.
  assert(
    bandOf(3, "unit_cost").leftPoints !== bandOf(1, "unit_cost").leftPoints,
    "page 3 must keep its own geometry",
  );
  assert(
    bandOf(3, "total_price").leftPoints > bandOf(1, "total_price").leftPoints,
    "page 3's displacement must be preserved",
  );
});

test("D1: every page of the family publishes the same expected role set", () => {
  const result = multiPageFamilyResult();
  const expectations = result.schemaCompleteness.pages;
  equal(expectations.length, 3);
  const familyIds = new Set(expectations.map((page) => page.schemaFamilyId));
  equal(familyIds.size, 1, "all three pages must belong to one schema family");
  for (const page of expectations) {
    assert(page.schemaFamilyId !== null, "each page must have a proven schema family");
    for (const role of ECONOMIC_SCHEMA_ROLES) {
      assert(
        page.expectedRoles.includes(role),
        `page ${page.pageNumber} must expect ${role}`,
      );
    }
    equal(page.unresolvedExpectedRoles.length, 0, `page ${page.pageNumber} left roles unresolved`);
  }
});

test("D1: a complete economic row fills every role from its own leaf on every page", () => {
  const result = multiPageFamilyResult();
  const items = result.records.filter((record) => record.kind === "service_item");
  equal(items.length, 6, "expected two items on each of three pages");
  for (const item of items) {
    equal(item.quantity?.status, "resolved", `quantity on page ${item.pageNumber}`);
    equal(item.unitCost?.status, "resolved", `unit cost on page ${item.pageNumber}`);
    equal(item.bdiRate?.status, "resolved", `bdi rate on page ${item.pageNumber}`);
    equal(item.unitPrice?.status, "resolved", `unit price on page ${item.pageNumber}`);
    equal(item.totalPrice?.status, "resolved", `total price on page ${item.pageNumber}`);
    equal(item.unitCost?.rawText, "R$ 100,00");
    equal(item.unitPrice?.rawText, "R$ 125,00");
    equal(item.totalPrice?.rawText, "R$ 250,00");
  }
});

// ---------------------------------------------------------------------------
// D2 -- a local collision must stay local
// ---------------------------------------------------------------------------

const COLLISION_COLUMNS: ReadonlyArray<SyntheticColumn> = [
  { header: "", left: 0, right: 45 },
  { header: "", left: 50, right: 105 },
  { header: "", left: 110, right: 300 },
  { header: "", left: 310, right: 360 },
  { header: "", left: 370, right: 430 },
  { header: "", left: 520, right: 600 },
];

const COLLISION_HEADER: SyntheticEntry[] = [
  placedEntry("ITEM", 5, 35, 0),
  placedEntry("CÓDIGO", 55, 95, 1),
  // The description caption occupies only part of the column it names.
  placedEntry("DESCRIÇÃO", 180, 240, 2),
  placedEntry("UNIDADE", 315, 355, 3),
  placedEntry("QTD", 375, 425, 4),
  placedEntry("PREÇO TOTAL", 525, 595, 5),
];

function collisionResult(): BudgetTableReconstructionResult {
  return reconstructBudgetTable(
    buildSyntheticInput(COLLISION_COLUMNS, [
      {
        pageNumber: 1,
        includeHeader: false,
        rows: [
          COLLISION_HEADER,
          // A wide auxiliary value: it overlaps the auxiliary caption and
          // nothing else, so it stretches that band right across the start of
          // the description column.
          [placedEntry("7", 2, 38, 0), placedEntry("REF-SINT-000123", 52, 140, 1)],
          // A short description starting at the left edge of its own column
          // and ending BEFORE the caption above it: exactly the row a
          // whole-line reversion loses.
          [
            placedEntry("7.1", 2, 38, 0),
            placedEntry("Serviço curto", 112, 150, 2),
            placedEntry("m", 315, 355, 3),
            placedEntry("3,00", 375, 425, 4),
            placedEntry("R$ 90,00", 525, 595, 5),
          ],
          [
            placedEntry("7.2", 2, 38, 0),
            placedEntry("Serviço sintético mais longo desta linha", 112, 290, 2),
            placedEntry("m", 315, 355, 3),
            placedEntry("4,00", 375, 425, 4),
            placedEntry("R$ 120,00", 525, 595, 5),
          ],
        ],
      },
    ]),
  );
}

test("D2: a collision with an auxiliary band leaves the description column spanning its data", () => {
  const result = collisionResult();
  const description = columnsForRole(result, 1, "description")[0];
  assert(description !== undefined, "the description column must survive the collision");
  assert(
    description!.leftPoints <= 112,
    `description band must reach its data, got left=${description!.leftPoints}`,
  );
});

test("D2: a short description left of its own caption is still reconstructed", () => {
  const result = collisionResult();
  const item = result.records.find((record) => record.itemCode === "7.1");
  assert(item !== undefined, "expected the short-description item");
  equal(item?.description, "Serviço curto");
});

test("D2: the remaining semantic bands are untouched by someone else's collision", () => {
  const result = collisionResult();
  for (const role of ["unit", "quantity", "total_price"] as const) {
    equal(columnsForRole(result, 1, role).length, 1, `${role} must survive`);
  }
  const item = result.records.find((record) => record.itemCode === "7.2");
  equal(item?.unit, "m");
  equal(item?.quantity?.rawText, "4,00");
  equal(item?.totalPrice?.rawText, "R$ 120,00");
});

test("D2: auxiliary evidence is preserved, never erased", () => {
  const result = collisionResult();
  const auxiliaryText = result.textItems.find((item) => item.rawText === "REF-SINT-000123");
  assert(auxiliaryText !== undefined, "the auxiliary value must remain in the evidence graph");
  const disposition = result.evidenceDispositions.find(
    (candidate) => candidate.evidenceId === auxiliaryText!.evidenceId,
  );
  assert(disposition !== undefined, "the auxiliary value must have a recorded disposition");
  assert(
    disposition!.disposition !== "failed",
    `auxiliary evidence must not fail: ${disposition!.disposition}`,
  );
});

test("D2: no body text is lost and nothing is invented", () => {
  const result = collisionResult();
  equal(result.structuralIssues.length, 0, JSON.stringify(result.structuralIssues));
  equal(
    result.arithmeticEvaluations.filter((candidate) => candidate.outcome === "invented_evidence")
      .length,
    0,
  );
});

// ---------------------------------------------------------------------------
// D3 -- description continuations
// ---------------------------------------------------------------------------

const CONTINUATION_COLUMNS: ReadonlyArray<SyntheticColumn> = [
  { header: "Código", left: 0, right: 70 },
  { header: "Descrição", left: 80, right: 300 },
  { header: "Unidade", left: 310, right: 360 },
  { header: "Quantidade", left: 370, right: 430 },
  { header: "BDI", left: 440, right: 500 },
  { header: "Custo Unitário", left: 510, right: 580 },
  { header: "Preço Unitário", left: 590, right: 660 },
  { header: "Preço Total", left: 670, right: 750 },
];

const CONTINUATION_ITEM: SyntheticEntry[] = [
  entry("B1", 0),
  entry("Serviço sintético completo", 1),
  entry("m", 2),
  entry("2,00", 3),
  entry("25,00%", 4),
  entry("100,00", 5),
  entry("125,00", 6),
  entry("250,00", 7),
];

function continuationResult(
  continuationTexts: ReadonlyArray<string>,
  trailingItem = false,
): BudgetTableReconstructionResult {
  return reconstructBudgetTable(
    buildSyntheticInput(CONTINUATION_COLUMNS, [
      {
        pageNumber: 1,
        rows: [
          CONTINUATION_ITEM,
          ...continuationTexts.map((text) => [entry(text, 1)]),
          ...(trailingItem ? [CONTINUATION_ITEM.map((value) => value)] : []),
        ],
      },
    ]),
  );
}

test("D3 A: one clean continuation leaves a complete item resolved", () => {
  const result = continuationResult(["continuação sintética da descrição"]);
  const item = result.records.find((record) => record.kind === "service_item");
  assert(item !== undefined, "expected a service item");
  equal(item?.status, "resolved");
  assert(
    (item?.description ?? "").includes("continuação sintética da descrição"),
    "the continuation text must join the description",
  );
});

test("D3 B: two clean continuations still leave the item resolved", () => {
  const result = continuationResult([
    "primeira continuação sintética",
    "segunda continuação sintética",
  ]);
  const item = result.records.find((record) => record.kind === "service_item");
  equal(item?.status, "resolved");
});

test("D3 D: an economic field genuinely absent from the base row still downgrades the item", () => {
  const withoutQuantity = CONTINUATION_ITEM.filter(
    (candidate) => candidate.text !== "2,00",
  );
  const result = reconstructBudgetTable(
    buildSyntheticInput(CONTINUATION_COLUMNS, [
      { pageNumber: 1, rows: [withoutQuantity, [entry("continuação sintética", 1)]] },
    ]),
  );
  const item = result.records.find((record) => record.kind === "service_item");
  assert(item !== undefined, "expected a service item");
  assert(item?.status !== "resolved", "a missing base-row field must still downgrade the item");
});

test("D3 E: a continuation never supplies an economic value to its item", () => {
  const result = continuationResult(["continuação sintética da descrição"]);
  const item = result.records.find((record) => record.kind === "service_item");
  equal(item?.quantity?.rawText, "2,00");
  equal(item?.unitCost?.rawText, "100,00");
  equal(item?.unitPrice?.rawText, "125,00");
  equal(item?.totalPrice?.rawText, "250,00");
});

function fakeColumn(role: BudgetColumnRole, columnId: string): ResolvedColumn {
  return {
    columnId,
    pageNumber: 1,
    horizontalOrder: 1,
    leftPoints: 0,
    rightPoints: 10,
    candidateRoles: [role],
    role,
    status: "resolved",
    headerLineIds: [],
    evidenceLocatorIds: [],
    sourcePhysicalColumnHypothesisIds: [],
    contributingRegionIds: [],
    contributingLineIds: [],
    contributingSegmentIds: [],
    groupingRuleId: "header-band-v1",
    representativePhysicalColumnHypothesisId: null,
    nonGroupingReasonCodes: [],
    bandProvenance: "header-derived",
    headerAtomIds: [],
    splitReasonCode: null,
  };
}

function fakeCell(
  cellId: string,
  role: BudgetColumnRole,
  state: ReconstructedCell["state"],
): ReconstructedCell {
  return {
    cellId,
    pageNumber: 1,
    rowLocatorId: "locator:row",
    lineId: "line:row",
    columnId: `column:${role}`,
    role,
    geometryUse: "exclusive",
    state,
    sourceSegmentIds: [],
    fragmentIds: [],
    upstreamCellHypothesisIds: [],
    reasonCode: "synthetic",
  };
}

test("D3 C: a continuation whose attribution is ambiguous contaminates its candidate records", () => {
  const columns = [fakeColumn("description", "column:description")];
  const baseRow: ReconstructedLogicalRow = {
    rowId: "row:base",
    pageNumber: 1,
    locatorId: "locator:base",
    kind: "service_item",
    status: "resolved",
    cellIds: ["cell:description"],
    description: "Serviço",
    descriptionSourceRowIds: [],
    continuationCandidateRowIds: [],
  };
  const continuationRow: ReconstructedLogicalRow = {
    rowId: "row:continuation",
    pageNumber: 1,
    locatorId: "locator:continuation",
    kind: "description_continuation",
    status: "ambiguous",
    cellIds: [],
    description: "continuação",
    descriptionSourceRowIds: [],
    continuationCandidateRowIds: [baseRow.rowId, "row:other"],
  };
  const cells = [fakeCell("cell:description", "description", "present")];
  const rows = [baseRow, continuationRow];
  const records = classifyRecords(rows, {
    cells,
    fragments: [],
    textItems: [],
    columns,
    rows,
  });
  const record = records.find((candidate) => candidate.kind === "service_item");
  equal(record?.status, "ambiguous");
});

// ---------------------------------------------------------------------------
// D5 -- grouping economics
// ---------------------------------------------------------------------------

function groupingResult(includeGroupTotals: boolean): BudgetTableReconstructionResult {
  const groupRow = (code: string, label: string): SyntheticEntry[] => [
    placedEntry(code, 2, 38, 0),
    placedEntry(label, 62, 290, 1),
    ...(includeGroupTotals
      ? [
          mergedEntry(
            [
              { text: "R$ 400,00", left: 742, right: 788 },
              { text: "R$ 100,00", left: 812, right: 858 },
              { text: "R$ 500,00", left: 882, right: 928 },
            ],
            8,
          ),
        ]
      : []),
  ];
  return reconstructBudgetTable(
    buildSyntheticInput(FAMILY_COLUMNS, [
      {
        pageNumber: 1,
        includeHeader: false,
        rows: [
          wideParentHeaderLine(0),
          familyFlatHeaderLine(0),
          familyQualifierHeaderLine(0),
          groupRow("5", "Grupo sintético"),
          groupRow("5.1", "Subgrupo sintético"),
          familyItemRow("5.1.1", 0),
          familyItemRow("5.1.2", 0),
        ],
      },
    ]),
  );
}

test("D5: a grouping row's total comes from the with-BDI total leaf, never a sibling", () => {
  const result = groupingResult(true);
  const group = result.records.find((record) => record.itemCode === "5");
  const subgroup = result.records.find((record) => record.itemCode === "5.1");
  assert(group !== undefined, "expected the group");
  assert(subgroup !== undefined, "expected the subgroup");
  equal(group?.totalPrice?.rawText, "R$ 500,00");
  equal(subgroup?.totalPrice?.rawText, "R$ 500,00");
});

test("D5: sibling monetary leaves are never concatenated into one total", () => {
  const result = groupingResult(true);
  for (const record of result.records) {
    const raw = record.totalPrice?.rawText ?? "";
    assert(!raw.includes("|"), `concatenated total on ${record.itemCode}: ${raw}`);
    assert(
      !(raw.includes("R$ 400,00") && raw.includes("R$ 500,00")),
      `sibling amounts merged on ${record.itemCode}: ${raw}`,
    );
  }
});

test("D5: a grouping row with no aggregate evidence is not required to invent one", () => {
  const result = groupingResult(false);
  const group = result.records.find((record) => record.itemCode === "5");
  assert(group !== undefined, "expected the group");
  equal(group?.totalPrice, null);
  equal(group?.status, "resolved");
});

// ---------------------------------------------------------------------------
// D6 -- expected schema versus resolved schema
// ---------------------------------------------------------------------------

test("D6 A: a schema that genuinely has no rate column does not penalise its items", () => {
  const columns: ReadonlyArray<SyntheticColumn> = [
    { header: "Código", left: 0, right: 70 },
    { header: "Descrição", left: 80, right: 300 },
    { header: "Unidade", left: 310, right: 360 },
    { header: "Quantidade", left: 370, right: 430 },
    { header: "Preço Unitário", left: 440, right: 510 },
    { header: "Preço Total", left: 520, right: 600 },
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      {
        pageNumber: 1,
        rows: [
          [
            entry("C1", 0),
            entry("Serviço sintético", 1),
            entry("m", 2),
            entry("2,00", 3),
            entry("3,00", 4),
            entry("6,00", 5),
          ],
        ],
      },
    ]),
  );
  const item = result.records.find((record) => record.kind === "service_item");
  equal(item?.status, "resolved");
  const expectation = result.schemaCompleteness.pages.find((page) => page.pageNumber === 1);
  assert(
    !(expectation?.expectedRoles ?? []).includes("bdi_rate"),
    "a schema without a rate column must not expect one",
  );
});

function classifyWithExpectation(
  expectedRoles: ReadonlyArray<BudgetColumnRole>,
  presentRoles: ReadonlyArray<BudgetColumnRole>,
): ReturnType<typeof classifyRecords> {
  const columns = presentRoles.map((role) => fakeColumn(role, `column:${role}`));
  const cells = presentRoles.map((role) => fakeCell(`cell:${role}`, role, "present"));
  const row: ReconstructedLogicalRow = {
    rowId: "row:item",
    pageNumber: 1,
    locatorId: "locator:item",
    kind: "service_item",
    status: "resolved",
    cellIds: cells.map((cell) => cell.cellId),
    description: "Serviço",
    descriptionSourceRowIds: [],
    continuationCandidateRowIds: [],
  };
  const schemaExpectations: ReadonlyArray<BudgetTableSchemaExpectation> = [
    {
      pageNumber: 1,
      schemaFamilyId: "header-family:synthetic",
      expectedRoles,
      resolvedRoles: presentRoles,
      unresolvedExpectedRoles: expectedRoles.filter((role) => !presentRoles.includes(role)),
    },
  ];
  return classifyRecords([row], {
    cells,
    fragments: [],
    textItems: [],
    columns,
    rows: [row],
    schemaExpectations,
  });
}

test("D6 B: a role the family has, unresolved on this page, still blocks a resolved verdict", () => {
  const records = classifyWithExpectation(ECONOMIC_SCHEMA_ROLES, [
    "item_code",
    "description",
    "unit",
    "quantity",
    "unit_cost",
    "unit_price",
    "total_price",
  ]);
  const item = records.find((record) => record.kind === "service_item");
  assert(item !== undefined, "expected a service item");
  assert(item?.status !== "resolved", "an expected-but-unresolved role must not be ignored");
});

test("D6 C: an item carrying five of eight expected roles is never resolved", () => {
  const records = classifyWithExpectation(ECONOMIC_SCHEMA_ROLES, [
    "item_code",
    "description",
    "unit",
    "quantity",
    "total_price",
  ]);
  equal(records.find((record) => record.kind === "service_item")?.status, "insufficient_evidence");
});

test("D6 D: an item carrying all eight expected roles cleanly is resolved", () => {
  // Reconstructed end to end rather than from stub cells, because "carrying a
  // role" means carrying usable evidence for it, not merely owning a cell.
  const result = multiPageFamilyResult();
  const expectation = result.schemaCompleteness.pages.find((page) => page.pageNumber === 2);
  equal(expectation?.expectedRoles.length, ECONOMIC_SCHEMA_ROLES.length);
  const items = result.records.filter(
    (record) => record.kind === "service_item" && record.pageNumber === 2,
  );
  assert(items.length > 0, "expected items on page 2");
  for (const item of items) equal(item.status, "resolved", `item ${item.itemCode}`);
});

test("D6: no record of the multi-page family is resolved while missing an expected role", () => {
  const result = multiPageFamilyResult();
  equal(result.schemaCompleteness.resolvedRecordsMissingExpectedRoleCount, 0);
});

// ---------------------------------------------------------------------------
// D7 -- completeness is not the absence of invariant violations
// ---------------------------------------------------------------------------

test("D7 B: a fully reconstructed repeated schema reports positive completeness", () => {
  const result = multiPageFamilyResult();
  equal(result.structuralIssues.length, 0);
  equal(result.schemaCompleteness.status, "complete");
  equal(result.schemaCompleteness.pagesWithDemonstratedSchema, 3);
  equal(result.schemaCompleteness.pagesWithCompleteSchema, 3);
});

test("D7 A: a document that never demonstrated a schema does not claim completeness", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(
      [
        { header: "", left: 0, right: 70 },
        { header: "", left: 80, right: 300 },
      ],
      [
        {
          pageNumber: 1,
          includeHeader: false,
          rows: [[placedEntry("Texto sintético qualquer", 0, 300, 1)]],
        },
      ],
    ),
  );
  equal(result.structuralIssues.length, 0);
  assert(
    result.schemaCompleteness.status !== "complete",
    "an empty structural-issue list must not imply completeness",
  );
  equal(result.schemaCompleteness.status, "not_demonstrated");
});

// ---------------------------------------------------------------------------
// Closure invariants (§48)
// ---------------------------------------------------------------------------

test("closure invariants hold on the multi-page family fixture", () => {
  const result = multiPageFamilyResult();
  const violations: string[] = [];

  // 1 + 15: a selected header line never becomes a business record.
  const headerRowIds = new Set(
    result.logicalRows.filter((row) => row.kind === "header").map((row) => row.rowId),
  );
  for (const record of result.records) {
    for (const rowId of record.rowIds) {
      if (headerRowIds.has(rowId)) violations.push(`header line became record ${record.recordId}`);
    }
  }

  // 2: a header atom only ever comes from a selected header line.
  const headerLocatorIds = new Set(
    result.logicalRows.filter((row) => row.kind === "header").map((row) => row.locatorId),
  );
  const headerTextItemIds = new Set(
    result.lines
      .filter((line) => headerLocatorIds.has(line.locatorId))
      .flatMap((line) => line.textItemEvidenceIds),
  );
  for (const column of result.columns) {
    for (const atomId of column.headerAtomIds) {
      if (!headerTextItemIds.has(atomId)) violations.push(`header atom ${atomId} came from a body line`);
    }
  }

  // 3: resolved semantic bands never overlap destructively.
  const semantic = result.columns.filter(
    (column) => column.status === "resolved" && column.role !== "unknown",
  );
  for (const left of semantic) {
    for (const right of semantic) {
      if (left.columnId >= right.columnId || left.pageNumber !== right.pageNumber) continue;
      if (left.leftPoints < right.rightPoints && right.leftPoints < left.rightPoints) {
        violations.push(`bands overlap: ${left.role}/${right.role} on page ${left.pageNumber}`);
      }
    }
  }

  // 4: equivalent schema pages carry a consistent expected role set.
  const expectedSignatures = new Set(
    result.schemaCompleteness.pages.map((page) => page.expectedRoles.join(",")),
  );
  if (expectedSignatures.size !== 1) violations.push("expected role sets diverged across the family");

  // 5: a resolved record never misses an expected role.
  if (result.schemaCompleteness.resolvedRecordsMissingExpectedRoleCount > 0) {
    violations.push("a resolved record is missing an expected role");
  }

  // 8: sibling monetary leaves are never concatenated.
  for (const record of result.records) {
    for (const field of [record.quantity, record.unitCost, record.bdiRate, record.unitPrice, record.totalPrice]) {
      if (field !== null && field.grammarId === "divergent-source-cells-v1") {
        violations.push(`artificial sibling conflict on ${record.recordId}`);
      }
    }
  }

  // 10: nothing invented.
  if (result.arithmeticEvaluations.some((candidate) => candidate.outcome === "invented_evidence")) {
    violations.push("invented evidence");
  }

  if (violations.length > 0) throw new Error(violations.join("\n"));
});

test("the multi-page family reconstruction is deterministic", () => {
  const first = multiPageFamilyResult();
  const second = multiPageFamilyResult();
  equal(first.canonicalFingerprint, second.canonicalFingerprint);
});

if (failures > 0) {
  throw new Error(`${failures} closure test(s) failed`);
}
