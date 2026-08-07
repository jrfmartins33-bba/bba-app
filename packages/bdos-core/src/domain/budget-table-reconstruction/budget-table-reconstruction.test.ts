import { evaluateArithmetic } from "./budget-table-reconstruction-arithmetic";
import { conserveEvidence } from "./budget-table-reconstruction-conservation";
import { canonicalChunks, fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import { headerPathRoles, headerVocabularyRoles } from "./budget-table-reconstruction-profile";
import { classifyRecords } from "./budget-table-reconstruction-record-classification";
import { reconstructBudgetTable } from "./budget-table-reconstruction";
import type {
  BudgetColumnRole,
  CellState,
  ParsedNumericEvidence,
  ReconstructedBudgetRecord,
  ReconstructedCell,
  ReconstructedLogicalRow,
  ReconstructedRecordKind,
  ResolvedColumn,
} from "./budget-table-reconstruction.types";
import {
  buildSyntheticInput,
  entry,
} from "./testing/budget-table-reconstruction-synthetic-fixture";

function test(name: string, body: () => void): void {
  body();
  console.log(`ok - ${name}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, message = "values differ"): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const SIMPLE_COLUMNS = [
  { header: "Código", left: 0, right: 70 },
  { header: "Descrição", left: 80, right: 300 },
  { header: "Unidade", left: 310, right: 360 },
  { header: "Quantidade", left: 370, right: 430 },
  { header: "Preço Unitário", left: 440, right: 510 },
  { header: "Preço Total", left: 520, right: 600 },
] as const;

const SIMPLE_ITEM = [
  entry("A1", 0),
  entry("Serviço sintético", 1),
  entry("m", 2),
  entry("2,00", 3),
  entry("3,00", 4),
  entry("6,00", 5),
] as const;

function simpleResult() {
  return reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [SIMPLE_ITEM] }]),
  );
}

const FULL_COLUMNS = [
  { header: "Código", left: 0, right: 70 },
  { header: "Descrição", left: 80, right: 300 },
  { header: "Unidade", left: 310, right: 360 },
  { header: "Quantidade", left: 370, right: 430 },
  { header: "Custo Unitário", left: 440, right: 500 },
  { header: "BDI", left: 510, right: 560 },
  { header: "Preço Unitário", left: 570, right: 630 },
  { header: "Preço Total", left: 640, right: 700 },
] as const;

const FULL_ITEM = [
  entry("A1", 0),
  entry("Serviço completo", 1),
  entry("m", 2),
  entry("2,00", 3),
  entry("10,00", 4),
  entry("20,00", 5),
  entry("12,00", 6),
  entry("24,00", 7),
] as const;

const NO_BDI_COLUMNS = [
  { header: "Código", left: 0, right: 70 },
  { header: "Descrição", left: 80, right: 300 },
  { header: "Unidade", left: 310, right: 360 },
  { header: "Quantidade", left: 370, right: 430 },
  { header: "Custo Unitário", left: 440, right: 500 },
  { header: "Preço Unitário", left: 510, right: 570 },
  { header: "Preço Total", left: 580, right: 640 },
] as const;

const NO_BDI_ITEM = [
  entry("A1", 0),
  entry("Serviço genérico completo", 1),
  entry("m", 2),
  entry("2,00", 3),
  entry("10,00", 4),
  entry("20,00", 5),
  entry("40,00", 6),
] as const;

/** SPEC_SEMANTIC_ROLES_BY_KIND mirrors the applicability matrix given directly
 * by the record-status specification (independent of the production
 * SEMANTIC_ROLES_BY_KIND constant), so the sweep test below checks the
 * output against the documented contract rather than against the
 * implementation's own internal constant. */
const SPEC_SEMANTIC_ROLES_BY_KIND: Partial<Record<ReconstructedRecordKind, ReadonlySet<BudgetColumnRole>>> = {
  service_item: new Set([
    "item_code", "description", "unit", "quantity",
    "unit_cost", "bdi_rate", "unit_price", "total_price",
  ]),
  group: new Set(["item_code", "description"]),
  subgroup: new Set(["item_code", "description"]),
  subtotal: new Set(["description", "total_price"]),
  total: new Set(["description", "total_price"]),
};

function assertNoResolvedRecordHasApplicableEvidenceGap(
  result: ReturnType<typeof reconstructBudgetTable>,
): void {
  for (const record of result.records) {
    if (record.status !== "resolved") continue;
    const base = SPEC_SEMANTIC_ROLES_BY_KIND[record.kind];
    if (base === undefined) continue;
    const resolvedRolesOnPage = new Set(
      result.columns
        .filter((column) => column.pageNumber === record.pageNumber && column.status === "resolved")
        .map((column) => column.role),
    );
    const applicableRoles = new Set([...base].filter((role) => resolvedRolesOnPage.has(role)));
    const rowCellIds = new Set(
      result.logicalRows
        .filter((row) => record.rowIds.includes(row.rowId))
        .flatMap((row) => row.cellIds),
    );
    const semanticCells = result.cells.filter(
      (cell) => rowCellIds.has(cell.cellId) && applicableRoles.has(cell.role),
    );
    for (const cell of semanticCells) {
      assert(
        cell.state !== "missing" && cell.state !== "ambiguous" && cell.state !== "divergent",
        `resolved record ${record.recordId} has an applicable ${cell.role} cell in state ${cell.state}`,
      );
    }
  }
}

/** Direct-construction helpers for unit-testing classifyRecords/
 * recordRelevantStatus against state combinations (a divergent cell state,
 * an ambiguous/insufficient_evidence continuation row) that the current
 * production pipeline (cell-formation, logical-row-formation) does not
 * itself produce today -- verified by inspection, not assumption: no
 * producer in the domain ever emits state: "divergent", and
 * eligibleContinuationReceivers only ever populates descriptionSourceRowIds
 * for the exactly-one-receiver ("resolved") case, never for the ambiguous
 * or insufficient_evidence cases. These tests prove recordRelevantStatus
 * honors its full documented contract regardless, without touching either
 * upstream file (out of this round's scope). */
function fakeColumn(pageNumber: number, role: BudgetColumnRole, columnId: string): ResolvedColumn {
  return {
    columnId,
    pageNumber,
    horizontalOrder: 0,
    leftPoints: 0,
    rightPoints: 100,
    candidateRoles: [role],
    role,
    status: "resolved",
    headerLineIds: [],
    evidenceLocatorIds: [],
    sourcePhysicalColumnHypothesisIds: [],
    contributingRegionIds: [],
    contributingLineIds: [],
    contributingSegmentIds: [],
    groupingRuleId: "overlap-semantic-noncooccupancy-components-v1",
    representativePhysicalColumnHypothesisId: null,
    nonGroupingReasonCodes: [],
    bandProvenance: "upstream",
    headerAtomIds: [],
    splitReasonCode: null,
  };
}

function fakeCell(
  cellId: string,
  pageNumber: number,
  rowLocatorId: string,
  lineId: string,
  columnId: string,
  role: BudgetColumnRole,
  state: CellState,
): ReconstructedCell {
  return {
    cellId,
    pageNumber,
    rowLocatorId,
    lineId,
    columnId,
    role,
    geometryUse: state === "missing" ? "absent" : "exclusive",
    state,
    sourceSegmentIds: [],
    fragmentIds: [],
    upstreamCellHypothesisIds: [],
    reasonCode: "synthetic-direct-classifier-unit-test",
  };
}

test("simple table reconstructs displayed values end to end", () => {
  const result = simpleResult();
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  equal(record?.itemCode, "A1");
  equal(record?.unit, "m");
  equal(record?.quantity?.exactValue, { numerator: "2", denominator: "1" });
  equal(record?.unitPrice?.exactValue, { numerator: "3", denominator: "1" });
  equal(record?.totalPrice?.exactValue, { numerator: "6", denominator: "1" });
  assert(
    result.arithmeticEvaluations.some(
      (evaluation) => evaluation.outcome === "direct_correspondence",
    ),
    "expected exact quantity × unit price correspondence",
  );
});

test("BDI relation is evaluated through reconstructBudgetTable", () => {
  const columns = [
    ...SIMPLE_COLUMNS.slice(0, 4),
    { header: "Custo Unitário", left: 440, right: 500 },
    { header: "BDI", left: 510, right: 550 },
    { header: "Preço Unitário", left: 560, right: 620 },
    { header: "Preço Total", left: 630, right: 700 },
  ];
  const row = [
    entry("B2", 0), entry("Composição sintética", 1), entry("m", 2), entry("1", 3),
    entry("100", 4), entry("25", 5), entry("125", 6), entry("125", 7),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [{ pageNumber: 1, rows: [row] }]),
  );
  assert(
    result.arithmeticEvaluations.some(
      (evaluation) =>
        evaluation.relation === "unit_cost_with_bdi" &&
        evaluation.outcome === "direct_correspondence",
    ),
    "expected exact unit cost with BDI correspondence",
  );
});

test("single eligible multiline-description receiver is resolved", () => {
  const continuation = [entry("continuação exclusivamente descritiva", 1)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [
      { pageNumber: 1, rows: [SIMPLE_ITEM, continuation] },
    ]),
  );
  const row = result.logicalRows.find(
    (candidate) => candidate.kind === "description_continuation",
  );
  equal(row?.status, "resolved");
  equal(row?.descriptionSourceRowIds.length, 1);
});

test("two complete items give priority to the immediately preceding receiver", () => {
  const secondItem = SIMPLE_ITEM.map((sourceEntry, index) =>
    index === 0 ? entry("A2", 0) : sourceEntry,
  );
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [
      {
        pageNumber: 1,
        rows: [SIMPLE_ITEM, secondItem, [entry("continuação descritiva", 1)]],
      },
    ]),
  );
  const row = result.logicalRows.find(
    (candidate) => candidate.kind === "description_continuation",
  );
  equal(row?.status, "resolved");
  equal(row?.continuationCandidateRowIds.length, 1);
});

test("physically equivalent multiline-description receivers stay ambiguous", () => {
  const secondItem = SIMPLE_ITEM.map((sourceEntry, index) =>
    index === 0 ? entry("A2", 0) : sourceEntry,
  );
  const input = buildSyntheticInput(SIMPLE_COLUMNS, [{
    pageNumber: 1,
    rows: [SIMPLE_ITEM, secondItem, [entry("continuaÃ§Ã£o descritiva", 1)]],
  }]);
  const evidences = (input.physicalCellEvidence as any)
    .cellTextEvidenceFormation.groups[0].pages[0].regions[0].cellTextEvidences;
  const continuationEvidence = evidences.find((candidate: any) =>
    candidate.segmentOutcomes[0].segmentKey.endsWith("segment-3-0"),
  );
  continuationEvidence.cellHypothesisKey =
    "runtime-cell-hypothesis-1-1-1";
  const result = reconstructBudgetTable(input);
  const row = result.logicalRows.find(
    (candidate) => candidate.kind === "description_continuation",
  );
  equal(row?.status, "ambiguous");
  equal(row?.continuationCandidateRowIds.length, 2);
});

test("local branch hierarchy links group, subgroup and item", () => {
  const rows = [
    [entry("1", 0), entry("Grupo sintético", 1)],
    [entry("1.1", 0), entry("Subgrupo sintético", 1)],
    [entry("1.1.1", 0), ...SIMPLE_ITEM.slice(1)],
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows }]),
  );
  const group = result.records.find((record) => record.kind === "group");
  const subgroup = result.records.find((record) => record.kind === "subgroup");
  const item = result.records.find((record) => record.kind === "service_item");
  equal(subgroup?.parentRecordId, group?.recordId);
  equal(item?.parentRecordId, subgroup?.recordId);
});

test("subtotal and total use exact, non-overlapping summands", () => {
  const itemTwo = SIMPLE_ITEM.map((sourceEntry, index) =>
    index === 0 ? entry("A2", 0) : sourceEntry,
  );
  const rows = [
    SIMPLE_ITEM,
    itemTwo,
    [entry("Subtotal", 1), entry("12,00", 5)],
    [entry("Total", 1), entry("12,00", 5)],
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows }]),
  );
  const subtotal = result.arithmeticEvaluations.find(
    (evaluation) =>
      result.records.find((record) => record.recordId === evaluation.recordId)?.kind ===
      "subtotal",
  );
  const total = result.arithmeticEvaluations.find(
    (evaluation) =>
      result.records.find((record) => record.recordId === evaluation.recordId)?.kind ===
      "total",
  );
  equal(subtotal?.outcome, "direct_correspondence");
  equal(subtotal?.summandRecordIds.length, 2);
  equal(total?.outcome, "direct_correspondence");
  equal(total?.summandRecordIds.length, 1);
});

test("divergent logical field produces divergent_cell", () => {
  const row = [...SIMPLE_ITEM, entry("7,00", 5)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  assert(
    result.arithmeticEvaluations.some(
      (evaluation) => evaluation.outcome === "divergent_cell",
    ),
    "expected divergent arithmetic cell",
  );
  assert(result.completeness.divergentFieldCount > 0, "expected divergent completeness count");
});

test("invented operand is classified and traceable by arithmetic helper", () => {
  const sourced: ParsedNumericEvidence = {
    rawText: "2",
    normalizedText: "2",
    displayedScale: 0,
    grammarId: "decimal-point-v1",
    exactValue: { numerator: "2", denominator: "1" },
    alternativeValues: [],
    status: "resolved",
    sourceCellIds: ["cell-1"],
    sourceFragmentIds: ["fragment-1"],
  };
  const invented = { ...sourced, sourceCellIds: [], sourceFragmentIds: [] };
  const record: ReconstructedBudgetRecord = {
    recordId: "record-1", pageNumber: 1, documentOrder: 0, kind: "service_item",
    status: "resolved", rowIds: ["row-1"], parentRecordId: null, itemCode: "X",
    description: "Synthetic", unit: "m", quantity: invented, unitCost: null,
    bdiRate: null, unitPrice: sourced, totalPrice: sourced,
  };
  const evaluations = evaluateArithmetic([record], [
    { columnId: "q", pageNumber: 1, horizontalOrder: 1, leftPoints: 0, rightPoints: 1,
      candidateRoles: ["quantity"], role: "quantity", status: "resolved", headerLineIds: [], evidenceLocatorIds: [],
      sourcePhysicalColumnHypothesisIds: [], contributingRegionIds: [], contributingLineIds: [],
      contributingSegmentIds: [], groupingRuleId: "header-band-v1", representativePhysicalColumnHypothesisId: null,
      nonGroupingReasonCodes: [], bandProvenance: "header-derived", headerAtomIds: [], splitReasonCode: null },
    { columnId: "u", pageNumber: 1, horizontalOrder: 2, leftPoints: 1, rightPoints: 2,
      candidateRoles: ["unit_price"], role: "unit_price", status: "resolved", headerLineIds: [], evidenceLocatorIds: [],
      sourcePhysicalColumnHypothesisIds: [], contributingRegionIds: [], contributingLineIds: [],
      contributingSegmentIds: [], groupingRuleId: "header-band-v1", representativePhysicalColumnHypothesisId: null,
      nonGroupingReasonCodes: [], bandProvenance: "header-derived", headerAtomIds: [], splitReasonCode: null },
    { columnId: "t", pageNumber: 1, horizontalOrder: 3, leftPoints: 2, rightPoints: 3,
      candidateRoles: ["total_price"], role: "total_price", status: "resolved", headerLineIds: [], evidenceLocatorIds: [],
      sourcePhysicalColumnHypothesisIds: [], contributingRegionIds: [], contributingLineIds: [],
      contributingSegmentIds: [], groupingRuleId: "header-band-v1", representativePhysicalColumnHypothesisId: null,
      nonGroupingReasonCodes: [], bandProvenance: "header-derived", headerAtomIds: [], splitReasonCode: null },
  ]);
  equal(evaluations[0]?.outcome, "invented_evidence");
});

test("schema without cost and BDI produces not_applicable", () => {
  const result = simpleResult();
  equal(
    result.arithmeticEvaluations.find(
      (evaluation) => evaluation.relation === "unit_cost_with_bdi",
    )?.outcome,
    "not_applicable",
  );
});

test("undisplayed precision requires higher source precision", () => {
  const row = SIMPLE_ITEM.map((sourceEntry, index) =>
    index === 3
      ? entry("1", 3)
      : index === 4
        ? entry("1,2345", 4)
        : index === 5
          ? entry("1,23", 5)
          : sourceEntry,
  );
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  equal(
    result.arithmeticEvaluations.find(
      (evaluation) => evaluation.relation === "quantity_times_unit_price",
    )?.outcome,
    "undisplayed_precision",
  );
});

test("missing cells receive a non-exclusive disposition", () => {
  const row = SIMPLE_ITEM.slice(0, 5);
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  const missingCell = result.cells.find(
    (cell) => cell.state === "missing" && cell.role === "total_price",
  );
  const disposition = result.evidenceDispositions.find(
    (candidate) => candidate.evidenceId === missingCell?.cellId,
  );
  equal(disposition?.disposition, "not_applicable");
});

test("available f.2c and g.1 evidence is preferred", () => {
  const result = simpleResult();
  assert(
    result.cells.some(
      (cell) =>
        cell.upstreamCellHypothesisIds.length > 0 &&
        cell.reasonCode === "preferred_g1_physical_cell_text_association",
    ),
    "expected upstream physical cell provenance",
  );
});

test("unavailable f.2c evidence keeps structural lines", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(
      SIMPLE_COLUMNS,
      [{ pageNumber: 1, rows: [SIMPLE_ITEM] }],
      { physicalCellEvidence: "unavailable" },
    ),
  );
  assert(result.lines.length > 0, "structural lines must remain");
  assert(
    result.cells.every((cell) => cell.upstreamCellHypothesisIds.length === 0),
    "no upstream cell ids should be invented",
  );
});

test("line omitted by upstream cells remains in semantic reconstruction", () => {
  const input = buildSyntheticInput(SIMPLE_COLUMNS, [
    { pageNumber: 1, rows: [SIMPLE_ITEM] },
  ]);
  const cellPages = (input.physicalCellEvidence as any).cellHypothesisFormation.groups[0].pages;
  cellPages[0].regions[0].cellHypotheses = [];
  const result = reconstructBudgetTable(input);
  assert(result.lines.length === 2, "header and item lines must remain");
  assert(result.records.some((record) => record.kind === "service_item"), "item must remain");
});

test("shared segment decomposes uniquely into two fragments", () => {
  const columns = [
    { header: "Descrição", left: 0, right: 200 },
    { header: "Preço total", left: 210, right: 280 },
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, rows: [[entry("Impermeabilização extensa R$ 10", 0, 1)]] },
    ], { physicalCellEvidence: "unavailable" }),
  );
  const shared = result.cells.filter(
    (cell) => cell.geometryUse === "shared" && cell.reasonCode === "unique_contiguous_token_role_partition",
  );
  equal(shared.length, 2);
  equal(new Set(shared.flatMap((cell) => cell.fragmentIds)).size, 4);
});

test("shared segment decomposes uniquely into more than two fragments", () => {
  const columns = [
    { header: "Descrição", left: 0, right: 200 },
    { header: "Unidade", left: 210, right: 280 },
    { header: "Quantidade", left: 290, right: 360 },
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, rows: [[entry("Impermeabilização m 2", 0, 2)]] },
    ], { physicalCellEvidence: "unavailable" }),
  );
  equal(
    result.cells.filter(
      (cell) => cell.reasonCode === "unique_contiguous_token_role_partition",
    ).length,
    3,
  );
});

test("impossible shared decomposition preserves shared references", () => {
  const columns = [
    { header: "Descrição", left: 0, right: 200 },
    { header: "Unidade", left: 210, right: 280 },
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, rows: [[entry("123 456", 0, 1)]] },
    ], { physicalCellEvidence: "unavailable" }),
  );
  assert(
    result.cells.filter((cell) => cell.geometryUse === "shared").every(
      (cell) => cell.state === "ambiguous",
    ),
    "ambiguous decomposition must stay ambiguous",
  );
});

test("column roles continue only across exactly compatible page bands", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [
      { pageNumber: 1, rows: [SIMPLE_ITEM] },
      { pageNumber: 2, includeHeader: false, rows: [SIMPLE_ITEM] },
    ]),
  );
  assert(
    result.columns.filter((column) => column.pageNumber === 2).every(
      (column) => column.status === "resolved",
    ),
    "compatible page should inherit unique schema",
  );
});

test("duplicate incompatible roles stay ambiguous", () => {
  const columns = [
    { header: "Descrição", left: 0, right: 100 },
    { header: "Quantidade", left: 110, right: 210 },
    { header: "Quantidade", left: 220, right: 320 },
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, rows: [[entry("Serviço sintético", 0), entry("1", 1), entry("2", 2)]] },
    ]),
  );
  assert(
    result.columns
      .filter((column) => column.candidateRoles.includes("quantity"))
      .every((column) => column.status === "ambiguous"),
    "duplicate roles",
  );
});

test("page selection excludes non-requested pages from all semantic catalogs", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(
      SIMPLE_COLUMNS,
      [
        { pageNumber: 1, rows: [SIMPLE_ITEM] },
        { pageNumber: 2, rows: [SIMPLE_ITEM] },
      ],
      { pageSelection: [2] },
    ),
  );
  equal(result.pages.map((page) => page.pageNumber), [2]);
  assert(result.lines.every((line) => line.pageNumber === 2), "line selection");
  assert(result.records.every((record) => record.pageNumber === 2), "record selection");
});

test("runtime keys do not affect decisions or fingerprint", () => {
  const first = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [SIMPLE_ITEM] }], {
      keyPrefix: "one",
    }),
  );
  const second = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [SIMPLE_ITEM] }], {
      keyPrefix: "two",
    }),
  );
  equal(first.canonicalFingerprint, second.canonicalFingerprint);
});

test("permuted upstream collections retain canonical fingerprint", () => {
  const firstInput = buildSyntheticInput(SIMPLE_COLUMNS, [
    { pageNumber: 1, rows: [SIMPLE_ITEM] },
  ]);
  const secondInput = buildSyntheticInput(SIMPLE_COLUMNS, [
    { pageNumber: 1, rows: [SIMPLE_ITEM] },
  ]);
  const physicalPage = (secondInput.physicalRead.pages[0] as any);
  physicalPage.textItems = [...physicalPage.textItems].reverse();
  const structurePage = (secondInput.structureReconstruction.groups[0] as any).pages[0];
  structurePage.lines = [...structurePage.lines].reverse();
  structurePage.segments = [...structurePage.segments].reverse();
  equal(
    reconstructBudgetTable(firstInput).canonicalFingerprint,
    reconstructBudgetTable(secondInput).canonicalFingerprint,
  );
});

test("f.2c and g.1 lineage mismatch fails explicitly", () => {
  const input = buildSyntheticInput(SIMPLE_COLUMNS, [
    { pageNumber: 1, rows: [SIMPLE_ITEM] },
  ]);
  (input.physicalCellEvidence as any).cellTextEvidenceFormation
    .sourcePhysicalCellHypothesisFormationContextFingerprint = "0".repeat(64);
  equal(reconstructBudgetTable(input).status, "failed");
});

test("normalized output stores locators once and refers by id", () => {
  const result = simpleResult();
  equal(new Set(result.locators.map((entry) => entry.locatorId)).size, result.locators.length);
  assert(result.lines.every((line) => typeof line.locatorId === "string"), "line locator ids");
  assert(result.cells.every((cell) => typeof cell.rowLocatorId === "string"), "cell locator ids");
  assert(result.logicalRows.every((row) => Array.isArray(row.cellIds)), "row cell ids");
});

test("incremental canonical chunks produce the same stable hash", () => {
  const value = { z: [3, 2, 1], a: { b: true, a: null } };
  const firstChunks = [...canonicalChunks(value)];
  const secondChunks = [...canonicalChunks(value)];
  equal(firstChunks, secondChunks);
  equal(fingerprintCanonical(value), fingerprintCanonical(value));
  assert(firstChunks.length > 1, "serialization must be chunked");
});

test("jittered overlapping observations with one semantic identity form one medoid column", () => {
  const columns = [
    {
      header: "Quantidade",
      left: 100,
      right: 160,
      observedBands: [
        { left: 100, right: 160 },
        { left: 101, right: 161 },
        { left: 99, right: 159 },
      ],
    },
    { header: "Descrição", left: 200, right: 400 },
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, rows: [[entry("2", 0), entry("Serviço", 1)]] },
    ]),
  );
  const quantity = result.columns.find((column) => column.role === "quantity");
  equal(result.columns.length, 2);
  equal(quantity?.leftPoints, 100);
  equal(quantity?.rightPoints, 160);
  equal(quantity?.sourcePhysicalColumnHypothesisIds.length, 3);
  equal(quantity?.status, "resolved");
});

test("distinct simultaneously occupied columns with the same role remain ambiguous", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(
      [
        { header: "Quantidade", left: 0, right: 50 },
        { header: "Quantidade", left: 60, right: 110 },
        { header: "Descrição", left: 120, right: 300 },
      ],
      [{ pageNumber: 1, rows: [[entry("1", 0), entry("2", 1), entry("Serviço", 2)]] }],
    ),
  );
  equal(result.columns.length, 3);
  const duplicateQuantity = result.columns.filter((column) =>
    column.candidateRoles.includes("quantity"),
  );
  assert(
    duplicateQuantity.length === 2 &&
      duplicateQuantity.every((column) => column.status === "ambiguous"),
    "distinct duplicate roles",
  );
});

test("nonconsecutive selected page never inherits an identical schema", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(
      SIMPLE_COLUMNS,
      [
        { pageNumber: 1, rows: [SIMPLE_ITEM] },
        { pageNumber: 3, includeHeader: false, rows: [SIMPLE_ITEM] },
      ],
      { pageSelection: [1, 3] },
    ),
  );
  assert(
    result.columns
      .filter((column) => column.pageNumber === 3)
      .every((column) => column.status === "insufficient_evidence"),
    "page 3 must not inherit page 1",
  );
});

test("normalized page selection makes duplicate permutation canonical", () => {
  const pages = [
    { pageNumber: 1, rows: [SIMPLE_ITEM] },
    { pageNumber: 3, rows: [SIMPLE_ITEM] },
  ];
  const first = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, pages, { pageSelection: [3, 1, 3] }),
  );
  const second = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, pages, { pageSelection: [1, 3] }),
  );
  equal(first.pageSelection, [1, 3]);
  equal(first.canonicalFingerprint, second.canonicalFingerprint);
});

test("group hierarchy crosses exactly one positively continuous page", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [
      { pageNumber: 1, rows: [[entry("1", 0), entry("Grupo", 1)]] },
      {
        pageNumber: 2,
        includeHeader: false,
        rows: [
          [entry("1.1", 0), entry("Subgrupo", 1)],
          [entry("1.1.1", 0), ...SIMPLE_ITEM.slice(1)],
        ],
      },
    ]),
  );
  const group = result.records.find((record) => record.kind === "group");
  const subgroup = result.records.find((record) => record.kind === "subgroup");
  const item = result.records.find((record) => record.kind === "service_item");
  equal(subgroup?.parentRecordId, group?.recordId);
  equal(item?.parentRecordId, subgroup?.recordId);
});

test("subtotal can close service items on the immediately continuous page", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [
      { pageNumber: 1, rows: [SIMPLE_ITEM] },
      {
        pageNumber: 2,
        includeHeader: false,
        rows: [[entry("Subtotal", 1), entry("6", 5)]],
      },
    ]),
  );
  const subtotal = result.records.find((record) => record.kind === "subtotal");
  const evaluation = result.arithmeticEvaluations.find(
    (candidate) => candidate.recordId === subtotal?.recordId,
  );
  equal(evaluation?.outcome, "direct_correspondence");
  equal(evaluation?.summandRecordIds.length, 1);
});

test("total can consume a subtotal on the immediately continuous page", () => {
  const subtotal = [entry("Subtotal", 1), entry("6", 5)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [
      { pageNumber: 1, rows: [SIMPLE_ITEM, subtotal] },
      {
        pageNumber: 2,
        includeHeader: false,
        rows: [[entry("Total", 1), entry("6", 5)]],
      },
    ]),
  );
  const total = result.records.find((record) => record.kind === "total");
  const evaluation = result.arithmeticEvaluations.find(
    (candidate) => candidate.recordId === total?.recordId,
  );
  equal(evaluation?.outcome, "direct_correspondence");
  equal(evaluation?.summandRecordIds.length, 1);
});

test("new header prevents hierarchy and totalization across a page boundary", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [
      { pageNumber: 1, rows: [[entry("1", 0), entry("Grupo", 1)], SIMPLE_ITEM] },
      {
        pageNumber: 2,
        rows: [
          [entry("1.1", 0), entry("Subgrupo", 1)],
          [entry("Subtotal", 1), entry("20", 5)],
        ],
      },
    ]),
  );
  const subgroup = result.records.find((record) => record.itemCode === "1.1");
  const subtotal = result.records.find((record) => record.kind === "subtotal");
  const evaluation = result.arithmeticEvaluations.find(
    (candidate) => candidate.recordId === subtotal?.recordId,
  );
  equal(subgroup?.parentRecordId, null);
  equal(evaluation?.summandRecordIds.length, 0);
});

test("g.1 association overrides a conflicting simplified geometry intersection", () => {
  const input = buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [SIMPLE_ITEM] }]);
  const cellFormation = (input.physicalCellEvidence as any).cellHypothesisFormation;
  const grid = cellFormation.groups[0].pages[0].regions[0].gridIntersections.find(
    (candidate: any) => candidate.sourceLineKey.endsWith("line-1") && candidate.columnOrder === 2,
  );
  grid.sourcePhysicalColumnHypothesisKey = "runtime-hypothesis-1-3-0";
  const result = reconstructBudgetTable(input);
  const descriptionSegment = result.segments.find(
    (segment) => segment.rawText.includes("Serviço sintético"),
  );
  const preferredCell = result.cells.find(
    (cell) => cell.sourceSegmentIds.includes(descriptionSegment!.segmentId),
  );
  equal(preferredCell?.role, "quantity");
  equal(preferredCell?.reasonCode, "preferred_g1_physical_cell_text_association");
});

test("column and logical-row stages use the same versioned header vocabulary", () => {
  const headerText = "Código Descrição Unidade Quantidade Preço total";
  assert(headerVocabularyRoles(headerText).length >= 2, "profile vocabulary must recognize header");
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [SIMPLE_ITEM] }]),
  );
  equal(result.logicalRows[0]?.kind, "header");
  assert(result.columns.some((column) => column.role === "description"), "same vocabulary in columns");
});

test("source arithmetic inconsistency is produced end to end", () => {
  const inconsistent = SIMPLE_ITEM.map((sourceEntry, index) =>
    index === 5 ? entry("21", 5) : sourceEntry,
  );
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [inconsistent] }]),
  );
  assert(
    result.arithmeticEvaluations.some(
      (evaluation) => evaluation.outcome === "source_arithmetic_inconsistency",
    ),
    "inconsistency outcome",
  );
});

test("missing arithmetic cell is produced end to end", () => {
  const missingTotal = SIMPLE_ITEM.slice(0, 5);
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [missingTotal] }]),
  );
  assert(
    result.arithmeticEvaluations.some((evaluation) => evaluation.outcome === "missing_cell"),
    "missing cell outcome",
  );
});

test("ambiguous numeric grammar produces insufficient evidence end to end", () => {
  const ambiguous = SIMPLE_ITEM.map((sourceEntry, index) =>
    index === 3 ? entry("1.234", 3) : sourceEntry,
  );
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [ambiguous] }]),
  );
  assert(
    result.arithmeticEvaluations.some(
      (evaluation) => evaluation.outcome === "insufficient_evidence",
    ),
    "insufficient evidence outcome",
  );
});

test("conservation explicitly fails an injected source-less value", () => {
  const result = simpleResult();
  const record = result.records.find((candidate) => candidate.kind === "service_item")!;
  const invalidRecord = {
    ...record,
    quantity: record.quantity === null
      ? null
      : { ...record.quantity, sourceCellIds: [], sourceFragmentIds: [] },
  };
  const conservation = conserveEvidence({
    textItems: result.textItems,
    fragments: result.fragments,
    segments: result.segments,
    lines: result.lines,
    cells: result.cells,
    logicalRows: result.logicalRows,
    records: result.records.map((candidate) =>
      candidate.recordId === record.recordId ? invalidRecord : candidate,
    ),
    arithmeticEvaluations: result.arithmeticEvaluations,
  });
  assert(
    conservation.issues.some(
      (issue) => issue.severity === "failure" && issue.code.includes("invented"),
    ),
    "source-less value must fail conservation",
  );
});

test("runtime references are omitted from both semantic fingerprint and canonical file projection", () => {
  const firstInput = buildSyntheticInput(
    SIMPLE_COLUMNS,
    [{ pageNumber: 1, rows: [SIMPLE_ITEM] }],
    { keyPrefix: "runtime-a" },
  );
  const secondInput = buildSyntheticInput(
    SIMPLE_COLUMNS,
    [{ pageNumber: 1, rows: [SIMPLE_ITEM] }],
    { keyPrefix: "runtime-b" },
  );
  const first = reconstructBudgetTable(firstInput);
  const second = reconstructBudgetTable(secondInput);
  const projection = { omitCanonicalFingerprint: true, omitRuntimeReferences: true };
  const firstBytes = [...canonicalChunks(first, projection)].join("");
  const secondBytes = [...canonicalChunks(second, projection)].join("");
  equal(first.canonicalFingerprint, second.canonicalFingerprint);
  equal(firstBytes, secondBytes);
  equal(fingerprintCanonical(firstBytes), fingerprintCanonical(secondBytes));
});

// ---------------------------------------------------------------------------
// Hierarchical economic column semantics (fix: HeaderAtom/HeaderPath model,
// wide-band splitting, upstream+header complementarity, arithmetic as a
// disambiguation constraint). Every fixture below is synthetic and generic --
// none of it encodes any real document's pages, text, coordinates, or codes.
// ---------------------------------------------------------------------------

test("header path classifier: bare BDI resolves to bdi_rate directly", () => {
  equal(headerPathRoles(["bdi"]), ["bdi_rate"]);
  equal(headerPathRoles(["bdi (%)"]), ["bdi_rate"]);
});

test("header path classifier: unit price and total price with BDI never collapse to bdi_rate", () => {
  equal(headerPathRoles(["preco", "unit. c/ bdi"]), ["unit_price"]);
  equal(headerPathRoles(["preco", "total c/bdi"]), ["total_price"]);
});

test("header path classifier: nested item_code is demoted under an unrelated parent group", () => {
  equal(headerPathRoles(["item"]), ["item_code"]);
  equal(headerPathRoles(["fonte de pesquisa", "codigo"]), []);
});

test("hierarchical two-line header resolves parent-qualified unit and total price", () => {
  const columns = [
    { header: "", left: 0, right: 50 },
    { header: "", left: 100, right: 150 },
    { header: "", left: 150, right: 200 },
  ];
  const headerParent = [entry("Preço", 1, 2)];
  const headerChildren = [entry("Unitário", 1), entry("Total", 2)];
  const dataRow = [entry("A1", 0), entry("100,00", 1), entry("200,00", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, includeHeader: false, rows: [headerParent, headerChildren, dataRow] },
    ]),
  );
  const unitPriceColumn = result.columns.find((column) => column.leftPoints === 100);
  const totalPriceColumn = result.columns.find((column) => column.leftPoints === 150);
  equal(unitPriceColumn?.role, "unit_price");
  equal(unitPriceColumn?.status, "resolved");
  equal(totalPriceColumn?.role, "total_price");
  equal(totalPriceColumn?.status, "resolved");
});

test("CUSTO hierarchy resolves unit cost without BDI and BDI rate distinctly", () => {
  const columns = [
    { header: "", left: 0, right: 50 },
    { header: "", left: 300, right: 350 },
    { header: "", left: 350, right: 400 },
  ];
  const headerParent = [entry("Custo", 1, 2)];
  const headerChildren = [entry("Unit.S/BDI", 1), entry("BDI (%)", 2)];
  const dataRow = [entry("A1", 0), entry("80,00", 1), entry("25,00", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, includeHeader: false, rows: [headerParent, headerChildren, dataRow] },
    ]),
  );
  const unitCostColumn = result.columns.find((column) => column.leftPoints === 300);
  const bdiColumn = result.columns.find((column) => column.leftPoints === 350);
  equal(unitCostColumn?.role, "unit_cost");
  equal(unitCostColumn?.status, "resolved");
  equal(bdiColumn?.role, "bdi_rate");
  equal(bdiColumn?.status, "resolved");
});

test("PRECO hierarchy resolves unit and total price with BDI without becoming bdi_rate", () => {
  const columns = [
    { header: "", left: 0, right: 50 },
    { header: "", left: 500, right: 560 },
    { header: "", left: 560, right: 620 },
  ];
  const headerParent = [entry("Preço", 1, 2)];
  const headerChildren = [entry("Unit. C/ BDI", 1), entry("Total C/BDI", 2)];
  const dataRow = [entry("A1", 0), entry("100,00", 1), entry("200,00", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, includeHeader: false, rows: [headerParent, headerChildren, dataRow] },
    ]),
  );
  const unitPriceWithBdi = result.columns.find((column) => column.leftPoints === 500);
  const totalPriceWithBdi = result.columns.find((column) => column.leftPoints === 560);
  equal(unitPriceWithBdi?.role, "unit_price");
  assert(unitPriceWithBdi?.role !== "bdi_rate", "unit price with BDI must not collapse into bdi_rate");
  equal(totalPriceWithBdi?.role, "total_price");
  assert(totalPriceWithBdi?.role !== "bdi_rate", "total price with BDI must not collapse into bdi_rate");
});

test("item_code is confirmed at header root but demoted when nested under an unrelated group", () => {
  const columns = [
    { header: "", left: 0, right: 50 },
    { header: "", left: 100, right: 150 },
    { header: "", left: 150, right: 200 },
    { header: "", left: 250, right: 300 },
  ];
  const headerParent = [entry("Item", 0), entry("Fonte", 1, 2)];
  const headerChild = [entry("Código", 1)];
  const dataRow = [entry("A1", 0), entry("X1", 1), entry("5,00", 3)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, includeHeader: false, rows: [headerParent, headerChild, dataRow] },
    ]),
  );
  const itemColumn = result.columns.find((column) => column.leftPoints === 0);
  const nestedCodeColumn = result.columns.find((column) => column.leftPoints === 100);
  equal(itemColumn?.role, "item_code");
  equal(itemColumn?.status, "resolved");
  assert(
    nestedCodeColumn?.role !== "item_code",
    "code nested under an unrelated group must not become item_code",
  );
});

test("wide upstream band spanning two incompatible header paths is split by observed geometry", () => {
  const columns = [
    { header: "", left: 0, right: 50 },
    { header: "", left: 300, right: 350 },
    { header: "", left: 350, right: 400 },
  ];
  const headerParent = [entry("Custo", 1, 2)];
  const headerChildren = [entry("Unitário", 1), entry("BDI", 2)];
  const dataRow1 = [entry("A1", 0), entry("80,00", 1), entry("25,00", 2)];
  const dataRow2 = [entry("A2", 0), entry("90,00", 1), entry("20,00", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      {
        pageNumber: 1,
        includeHeader: false,
        rows: [headerParent, headerChildren, dataRow1, dataRow2],
        columnHypothesisOverride: [{ left: 300, right: 400 }],
      },
    ]),
  );
  const unitCostColumn = result.columns.find((column) => column.role === "unit_cost");
  const bdiColumn = result.columns.find((column) => column.role === "bdi_rate");
  assert(unitCostColumn !== undefined, "wide band must split off a resolved unit_cost column");
  assert(bdiColumn !== undefined, "wide band must split off a resolved bdi_rate column");
  equal(unitCostColumn?.leftPoints, 300);
  equal(unitCostColumn?.rightPoints, 350);
  equal(bdiColumn?.leftPoints, 350);
  equal(bdiColumn?.rightPoints, 400);
  equal(unitCostColumn?.groupingRuleId, "wide-band-geometric-split-v1");
  equal(unitCostColumn?.bandProvenance, "upstream-refined");
});

test("a band matching exactly one header path is never split even when upstream is present", () => {
  const columns = [{ header: "", left: 400, right: 460 }];
  const header = [entry("Quantidade", 0)];
  const dataRow = [entry("2,00", 0)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      {
        pageNumber: 1,
        includeHeader: false,
        rows: [header, dataRow],
        columnHypothesisOverride: [{ left: 400, right: 460 }],
      },
    ]),
  );
  equal(result.columns.length, 1);
  equal(result.columns[0]?.role, "quantity");
  equal(result.columns[0]?.status, "resolved");
  assert(
    result.columns[0]?.groupingRuleId !== "wide-band-geometric-split-v1",
    "a genuinely single column must never be split",
  );
});

test("header geometry complements a partial upstream schema without duplicating covered columns", () => {
  const columns = [
    { header: "Código", left: 0, right: 60 },
    { header: "Descrição", left: 80, right: 300 },
    { header: "Quantidade", left: 320, right: 380 },
    { header: "Preço Unitário", left: 400, right: 470 },
  ];
  const dataRow = [entry("A1", 0), entry("Serviço", 1), entry("2,00", 2), entry("50,00", 3)];
  const input = buildSyntheticInput(columns, [{ pageNumber: 1, rows: [dataRow] }]);
  const page = (input.columnEvidence as any).result.groups[0].pages[0];
  page.regions[0].hypotheses = page.regions[0].hypotheses.filter(
    (hypothesis: any) => !(hypothesis.leftPoints === 320 && hypothesis.rightPoints === 380),
  );
  const result = reconstructBudgetTable(input);
  const quantityColumns = result.columns.filter((column) => column.role === "quantity");
  equal(quantityColumns.length, 1);
  equal(quantityColumns[0]?.bandProvenance, "header-derived");
  equal(quantityColumns[0]?.leftPoints, 320);
  const codeColumns = result.columns.filter((column) => column.role === "item_code");
  equal(codeColumns.length, 1);
  equal(codeColumns[0]?.bandProvenance, "upstream");
});

test("economic column reconstructs from header geometry alone when upstream column evidence is entirely unavailable", () => {
  const columns = [
    { header: "", left: 0, right: 50 },
    { header: "", left: 100, right: 170 },
  ];
  const header = [entry("Código", 0), entry("Preço Unitário", 1)];
  const dataRow = [entry("A1", 0), entry("50,00", 1)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(
      columns,
      [{ pageNumber: 1, includeHeader: false, rows: [header, dataRow] }],
      { columnEvidence: "unavailable" },
    ),
  );
  const priceColumn = result.columns.find((column) => column.leftPoints === 100);
  equal(priceColumn?.role, "unit_price");
  equal(priceColumn?.status, "resolved");
  equal(priceColumn?.bandProvenance, "header-derived");
});

test("ambiguous economic column stays ambiguous when no unique arithmetic bijection is consistent", () => {
  const columns = [
    { header: "Quantidade", left: 0, right: 60 },
    { header: "Custo Total", left: 80, right: 150 },
    { header: "Preço Unitário", left: 170, right: 240 },
  ];
  const dataRow = [entry("2", 0), entry("999,00", 1), entry("100,00", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [{ pageNumber: 1, rows: [dataRow] }]),
  );
  const ambiguousColumn = result.columns.find((column) => column.leftPoints === 80);
  equal(ambiguousColumn?.status, "ambiguous");
  assert(
    (ambiguousColumn?.candidateRoles ?? []).includes("unit_cost") &&
      (ambiguousColumn?.candidateRoles ?? []).includes("total_price"),
    "column must retain both economically plausible roles when no bijection is uniquely consistent",
  );
});

test("ambiguous economic column resolves when exactly one arithmetic bijection is consistent", () => {
  const columns = [
    { header: "Quantidade", left: 0, right: 60 },
    { header: "Custo Total", left: 80, right: 150 },
    { header: "BDI", left: 170, right: 220 },
    { header: "Preço Unitário", left: 240, right: 310 },
  ];
  const dataRow = [entry("2", 0), entry("80,00", 1), entry("25", 2), entry("100,00", 3)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [{ pageNumber: 1, rows: [dataRow] }]),
  );
  const resolvedColumn = result.columns.find((column) => column.leftPoints === 80);
  equal(resolvedColumn?.role, "unit_cost");
  equal(resolvedColumn?.status, "resolved");
});

test("an auxiliary column with no economic role stays unknown without causing failure", () => {
  const columns = [
    { header: "Código", left: 0, right: 60 },
    { header: "Fonte de Pesquisa", left: 80, right: 200 },
    { header: "Descrição", left: 220, right: 400 },
    { header: "Quantidade", left: 420, right: 480 },
  ];
  const dataRow = [entry("A1", 0), entry("SINAPI", 1), entry("Serviço", 2), entry("2,00", 3)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [{ pageNumber: 1, rows: [dataRow] }]),
  );
  const auxiliaryColumn = result.columns.find((column) => column.leftPoints === 80);
  equal(auxiliaryColumn?.role, "unknown");
  equal(auxiliaryColumn?.status, "insufficient_evidence");
  assert(result.status !== "failed", "an unresolved auxiliary column must not fail the reconstruction");
});

test("header path resolution is invariant to synthetic runtime key naming", () => {
  const columns = [
    { header: "", left: 0, right: 50 },
    { header: "", left: 100, right: 150 },
    { header: "", left: 150, right: 200 },
  ];
  const headerParent = [entry("Preço", 1, 2)];
  const headerChildren = [entry("Unitário", 1), entry("Total", 2)];
  const dataRow = [entry("A1", 0), entry("10,00", 1), entry("20,00", 2)];
  const rows = [headerParent, headerChildren, dataRow];
  const first = reconstructBudgetTable(
    buildSyntheticInput(columns, [{ pageNumber: 1, includeHeader: false, rows }], {
      keyPrefix: "alpha",
    }),
  );
  const second = reconstructBudgetTable(
    buildSyntheticInput(columns, [{ pageNumber: 1, includeHeader: false, rows }], {
      keyPrefix: "beta",
    }),
  );
  equal(first.canonicalFingerprint, second.canonicalFingerprint);
  equal(first.columns.find((column) => column.leftPoints === 100)?.role, "unit_price");
  equal(second.columns.find((column) => column.leftPoints === 100)?.role, "unit_price");
});

test("geometric text-item partition prefers real per-text-item geometry over lexical token splitting", () => {
  const columns = [
    { header: "Custo", left: 300, right: 350 },
    { header: "BDI", left: 350, right: 400 },
  ];
  const dataRow = [entry("80,00", 0), entry("25,00", 1)];
  const input = buildSyntheticInput(
    columns,
    [{ pageNumber: 1, rows: [dataRow] }],
    { physicalCellEvidence: "unavailable" },
  );
  const structurePage: any = (input.structureReconstruction as any).groups[0].pages[0];
  const dataLine = structurePage.lines[structurePage.lines.length - 1];
  const [firstSegment, secondSegment] = structurePage.segments.filter(
    (segment: any) => segment.lineKey === dataLine.lineKey,
  );
  firstSegment.sourceTextItemIndices = [
    ...firstSegment.sourceTextItemIndices,
    ...secondSegment.sourceTextItemIndices,
  ];
  firstSegment.rightPoints = secondSegment.rightPoints;
  firstSegment.widthPoints = firstSegment.rightPoints - firstSegment.leftPoints;
  firstSegment.centerXPoints = (firstSegment.leftPoints + firstSegment.rightPoints) / 2;
  structurePage.segments = structurePage.segments.filter(
    (segment: any) => segment.segmentKey !== secondSegment.segmentKey,
  );
  for (const outcome of structurePage.sourceItemOutcomes) {
    if (outcome.segmentKey === secondSegment.segmentKey) outcome.segmentKey = firstSegment.segmentKey;
  }
  dataLine.segmentKeys = dataLine.segmentKeys.filter(
    (key: string) => key !== secondSegment.segmentKey,
  );

  const result = reconstructBudgetTable(input);
  const geometricCells = result.cells.filter(
    (cell) => cell.reasonCode === "unique_textitem_geometry_partition",
  );
  equal(geometricCells.length, 2);
  const custoCell = geometricCells.find((cell) => cell.role === "unit_cost");
  const bdiCell = geometricCells.find((cell) => cell.role === "bdi_rate");
  assert(
    custoCell !== undefined && bdiCell !== undefined,
    "each merged text item must land in its own real column",
  );
  equal(new Set(geometricCells.flatMap((cell) => cell.fragmentIds)).size, 2);

  const conservation = conserveEvidence({
    textItems: result.textItems,
    fragments: result.fragments,
    segments: result.segments,
    lines: result.lines,
    cells: result.cells,
    logicalRows: result.logicalRows,
    records: result.records,
    arithmeticEvaluations: result.arithmeticEvaluations,
  });
  assert(conservation.issues.length === 0, "geometric partition must not introduce conservation failures");
});

// ---------------------------------------------------------------------------
// Surgical corrections A-E (this round): unique-positive-overlap parent/child
// linkage instead of full containment; recurrence proof by EvidenceTextItem
// instead of Segment; grouping-label parents never becoming false columns;
// record status scoped to the record's own semantic fields instead of any
// cell in the row; undisplayed-precision presentation via any one declared
// profile rule instead of a scale precondition that is false for
// multiplication; and descendant_sum requiring a proven scope before it can
// claim a source inconsistency. All fixtures below are synthetic and
// generic -- none of it encodes any real document's pages, text,
// coordinates, or codes.
// ---------------------------------------------------------------------------

test("parent fully containing child continues to link (regression)", () => {
  const columns = [
    { header: "", left: 400, right: 500 },
    { header: "", left: 420, right: 480 },
    { header: "", left: 600, right: 660 },
  ];
  const headerParent = [entry("Preço", 0)];
  const headerChild = [entry("Unitário", 1), entry("Total", 2)];
  const dataRow = [entry("100,00", 1), entry("200,00", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      {
        pageNumber: 1,
        includeHeader: false,
        rows: [headerParent, headerChild, dataRow],
        // upstream provides bands for the real data columns only -- a header
        // label's own text box is not itself a physical column hypothesis.
        columnHypothesisOverride: [
          { left: 420, right: 480 },
          { left: 600, right: 660 },
        ],
      },
    ]),
  );
  equal(result.columns.find((column) => column.leftPoints === 420)?.role, "unit_price");
});

test("parent partially overlapping child links when overlap is unique even without full containment", () => {
  const columns = [
    { header: "", left: 400, right: 460 },
    { header: "", left: 420, right: 480 },
    { header: "", left: 600, right: 660 },
  ];
  const headerParent = [entry("Preço", 0)];
  const headerChild = [entry("Unitário", 1), entry("Total", 2)];
  const dataRow = [entry("100,00", 1), entry("200,00", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      {
        pageNumber: 1,
        includeHeader: false,
        rows: [headerParent, headerChild, dataRow],
        columnHypothesisOverride: [
          { left: 420, right: 480 },
          { left: 600, right: 660 },
        ],
      },
    ]),
  );
  equal(result.columns.find((column) => column.leftPoints === 420)?.role, "unit_price");
});

test("child intersecting two parents is not linked to either", () => {
  const columns = [
    { header: "", left: 400, right: 450 },
    { header: "", left: 450, right: 500 },
    { header: "", left: 430, right: 470 },
  ];
  const headerParents = [entry("Preço", 0), entry("Custo", 1)];
  const headerChild = [entry("Unitário", 2)];
  const dataRow = [entry("100,00", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, includeHeader: false, rows: [headerParents, headerChild, dataRow] },
    ]),
  );
  equal(result.columns.find((column) => column.leftPoints === 430)?.role, "unknown");
});

test("child with no overlapping parent remains a root leaf", () => {
  const columns = [
    { header: "", left: 100, right: 150 },
    { header: "", left: 400, right: 460 },
    { header: "", left: 500, right: 560 },
  ];
  const headerParent = [entry("Preço", 0)];
  const headerChild = [entry("Item", 1)];
  // a companion decimal value is required so the data row itself carries a
  // recognizable economic literal and correctly terminates the header block
  // -- a bare alphanumeric code alone ("A1") does not.
  const dataRow = [entry("A1", 1), entry("5,00", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, includeHeader: false, rows: [headerParent, headerChild, dataRow] },
    ]),
  );
  equal(result.columns.find((column) => column.leftPoints === 400)?.role, "item_code");
});

test("CUSTO parent with UNITARIO and BDI children produces only two leaf columns", () => {
  const columns = [
    { header: "", left: 430, right: 480 },
    { header: "", left: 480, right: 530 },
  ];
  const headerParent = [entry("Custo", 0, 1)];
  const headerChildren = [entry("Unitário", 0), entry("BDI", 1)];
  const dataRow = [entry("80,00", 0), entry("25,00", 1)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, includeHeader: false, rows: [headerParent, headerChildren, dataRow] },
    ]),
  );
  equal(result.columns.length, 2);
  equal(result.columns.map((column) => column.role).sort(), ["bdi_rate", "unit_cost"]);
});

test("PRECO parent with UNITARIO and TOTAL children produces only two leaf columns", () => {
  const columns = [
    { header: "", left: 550, right: 610 },
    { header: "", left: 610, right: 670 },
  ];
  const headerParent = [entry("Preço", 0, 1)];
  const headerChildren = [entry("Unitário", 0), entry("Total", 1)];
  const dataRow = [entry("100,00", 0), entry("200,00", 1)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, includeHeader: false, rows: [headerParent, headerChildren, dataRow] },
    ]),
  );
  equal(result.columns.length, 2);
  equal(result.columns.map((column) => column.role).sort(), ["total_price", "unit_price"]);
});

test("a generic grouping parent atom never becomes a false standalone column", () => {
  const columns = [
    { header: "", left: 700, right: 750 },
    { header: "", left: 750, right: 800 },
  ];
  const headerParent = [entry("Faixa Genérica", 0, 1)];
  const headerChildren = [entry("Quantidade", 0), entry("Unidade", 1)];
  const dataRow = [entry("2,00", 0), entry("m", 1)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [
      { pageNumber: 1, includeHeader: false, rows: [headerParent, headerChildren, dataRow] },
    ]),
  );
  equal(result.columns.length, 2);
});

test("wide-band recurrence is proven by real text-item geometry even when a segment's own bounds are corrupted", () => {
  const columns = [
    { header: "", left: 430, right: 480 },
    { header: "", left: 480, right: 530 },
  ];
  const headerParent = [entry("Custo", 0, 1)];
  const headerChildren = [entry("Unitário", 0), entry("BDI", 1)];
  const dataRow1 = [entry("80,00", 0), entry("25,00", 1)];
  const dataRow2 = [entry("90,00", 0), entry("20,00", 1)];
  const input = buildSyntheticInput(columns, [
    {
      pageNumber: 1,
      includeHeader: false,
      rows: [headerParent, headerChildren, dataRow1, dataRow2],
      columnHypothesisOverride: [{ left: 430, right: 530 }],
    },
  ]);
  const structurePage: any = (input.structureReconstruction as any).groups[0].pages[0];
  const dataLines = structurePage.lines.slice(2);
  const corrupted = structurePage.segments.find(
    (segment: any) => segment.lineKey === dataLines[0].lineKey && segment.leftPoints === 480,
  );
  corrupted.leftPoints = 0;
  corrupted.rightPoints = 10;
  corrupted.widthPoints = 10;
  corrupted.centerXPoints = 5;

  const result = reconstructBudgetTable(input);
  const bdiColumn = result.columns.find((column) => column.role === "bdi_rate");
  assert(
    bdiColumn !== undefined,
    "recurrence must be proven from the text item's own geometry, not the corrupted segment bounds",
  );
});

test("wide-band split does not happen when text-item recurrence is not actually proven, even if a segment's bounds would misleadingly suggest it", () => {
  const columns = [
    { header: "", left: 430, right: 480 },
    { header: "", left: 480, right: 530 },
  ];
  const headerParent = [entry("Custo", 0, 1)];
  const headerChildren = [entry("Unitário", 0), entry("BDI", 1)];
  const dataRow1 = [entry("80,00", 0), entry("25,00", 1)];
  const dataRow2 = [entry("90,00", 0)];
  const input = buildSyntheticInput(columns, [
    {
      pageNumber: 1,
      includeHeader: false,
      rows: [headerParent, headerChildren, dataRow1, dataRow2],
      columnHypothesisOverride: [{ left: 430, right: 530 }],
    },
  ]);
  const structurePage: any = (input.structureReconstruction as any).groups[0].pages[0];
  const dataLines = structurePage.lines.slice(2);
  const row2Segment = structurePage.segments.find(
    (segment: any) => segment.lineKey === dataLines[1].lineKey,
  );
  row2Segment.rightPoints = 530;
  row2Segment.widthPoints = row2Segment.rightPoints - row2Segment.leftPoints;
  row2Segment.centerXPoints = (row2Segment.leftPoints + row2Segment.rightPoints) / 2;

  const result = reconstructBudgetTable(input);
  const bdiColumn = result.columns.find((column) => column.role === "bdi_rate");
  assert(bdiColumn === undefined, "a widened segment must not substitute for genuine text-item recurrence");
});

test("an ambiguous auxiliary unknown column does not contaminate an otherwise complete service_item", () => {
  const columns = [
    { header: "Código", left: 0, right: 60 },
    { header: "Descrição", left: 80, right: 300 },
    { header: "Unidade", left: 320, right: 360 },
    { header: "Quantidade", left: 380, right: 430 },
    { header: "Preço Unitário", left: 450, right: 520 },
    { header: "Preço Total", left: 540, right: 600 },
    { header: "BDI", left: 620, right: 660 },
    { header: "BDI", left: 680, right: 720 },
  ];
  const dataRow = [
    entry("A1", 0), entry("Serviço", 1), entry("m", 2), entry("2,00", 3),
    entry("50,00", 4), entry("100,00", 5), entry("10", 6), entry("20", 7),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [{ pageNumber: 1, rows: [dataRow] }]),
  );
  const auxiliaryColumns = result.columns.filter((column) => column.leftPoints === 620 || column.leftPoints === 680);
  assert(
    auxiliaryColumns.every((column) => column.role === "unknown" && column.status === "ambiguous"),
    "expected the duplicate BDI columns to collide into an ambiguous auxiliary pair",
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "resolved");
});

test("an ambiguous quantity cell still contaminates the service_item's status", () => {
  const columns = [
    { header: "", left: 80, right: 300 },
    { header: "", left: 320, right: 380 },
    { header: "", left: 380, right: 440 },
  ];
  const header = [entry("Descrição", 0), entry("Quantidade", 1), entry("Preço Unitário", 2)];
  const dataRow = [entry("Serviço", 0), entry("2,0 3,0 4,0", 1, 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(
      columns,
      [{ pageNumber: 1, includeHeader: false, rows: [header, dataRow] }],
      { physicalCellEvidence: "unavailable" },
    ),
  );
  const quantityCell = result.cells.find(
    (cell) => cell.role === "quantity" && cell.state === "ambiguous",
  );
  assert(
    quantityCell !== undefined,
    "expected the shared quantity cell to remain ambiguous",
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item classification");
  equal(record?.status, "ambiguous");
});

test("an ambiguous unit_price cell still contaminates the service_item's status", () => {
  const columns = [
    { header: "", left: 80, right: 300 },
    { header: "", left: 320, right: 380 },
    { header: "", left: 380, right: 440 },
  ];
  const header = [entry("Descrição", 0), entry("Preço Unitário", 1), entry("Preço Total", 2)];
  const dataRow = [entry("Serviço", 0), entry("2,0 3,0 4,0", 1, 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(
      columns,
      [{ pageNumber: 1, includeHeader: false, rows: [header, dataRow] }],
      { physicalCellEvidence: "unavailable" },
    ),
  );
  const unitPriceCell = result.cells.find(
    (cell) => cell.role === "unit_price" && cell.state === "ambiguous",
  );
  assert(
    unitPriceCell !== undefined,
    "expected the shared unit_price cell to remain ambiguous",
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item classification");
  equal(record?.status, "ambiguous");
});

test("an ambiguous item_code cell still contaminates the service_item's status", () => {
  const columns = [
    { header: "", left: 0, right: 60 },
    { header: "", left: 60, right: 120 },
    { header: "", left: 140, right: 360 },
  ];
  const header = [entry("Item", 0), entry("Quantidade", 1), entry("Descrição", 2)];
  const dataRow = [entry("1 2,0 3", 0, 1), entry("Serviço", 2)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(
      columns,
      [{ pageNumber: 1, includeHeader: false, rows: [header, dataRow] }],
      { physicalCellEvidence: "unavailable" },
    ),
  );
  const itemCodeCell = result.cells.find(
    (cell) => cell.role === "item_code" && cell.state === "ambiguous",
  );
  assert(
    itemCodeCell !== undefined,
    "expected the shared item_code cell to remain ambiguous",
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item classification");
  equal(record?.status, "ambiguous");
});

test("multiplication producing more decimals than either operand can still prove undisplayed_precision", () => {
  const row = [
    entry("A1", 0), entry("Serviço sintético", 1), entry("m", 2),
    entry("19,24", 3), entry("45,59", 4), entry("877,15", 5),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  equal(
    result.arithmeticEvaluations.find((evaluation) => evaluation.relation === "quantity_times_unit_price")
      ?.outcome,
    "undisplayed_precision",
  );
});

test("truncation alone explains an undisplayed-precision result", () => {
  const row = [
    entry("A1", 0), entry("Serviço sintético", 1), entry("m", 2),
    entry("1,00", 3), entry("2,5651", 4), entry("2,56", 5),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  equal(
    result.arithmeticEvaluations.find((evaluation) => evaluation.relation === "quantity_times_unit_price")
      ?.outcome,
    "undisplayed_precision",
  );
});

test("half-away-from-zero rounding alone explains an undisplayed-precision result", () => {
  const row = [
    entry("A1", 0), entry("Serviço sintético", 1), entry("m", 2),
    entry("1,00", 3), entry("2,5679", 4), entry("2,57", 5),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  equal(
    result.arithmeticEvaluations.find((evaluation) => evaluation.relation === "quantity_times_unit_price")
      ?.outcome,
    "undisplayed_precision",
  );
});

test("no declared presentation rule explains a mismatched result", () => {
  const row = [
    entry("A1", 0), entry("Serviço sintético", 1), entry("m", 2),
    entry("19,24", 3), entry("45,59", 4), entry("999,00", 5),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  equal(
    result.arithmeticEvaluations.find((evaluation) => evaluation.relation === "quantity_times_unit_price")
      ?.outcome,
    "source_arithmetic_inconsistency",
  );
});

test("a total following an explicit prior total boundary can be evaluated normally", () => {
  const itemA = [
    entry("A1", 0), entry("Item A", 1), entry("m", 2), entry("1,00", 3), entry("10,00", 4), entry("10,00", 5),
  ];
  const totalA = [entry("Total", 1), entry("10,00", 5)];
  const itemB = [
    entry("A2", 0), entry("Item B", 1), entry("m", 2), entry("1,00", 3), entry("20,00", 4), entry("20,00", 5),
  ];
  const totalB = [entry("Total", 1), entry("20,00", 5)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [itemA, totalA, itemB, totalB] }]),
  );
  const totals = result.arithmeticEvaluations.filter((evaluation) => evaluation.relation === "descendant_sum");
  equal(totals.length, 2);
  equal(totals[0]?.outcome, "direct_correspondence");
  equal(totals[1]?.outcome, "direct_correspondence");
});

test("a total whose scope is not provably complete after a page-selection gap is not misclassified as inconsistent", () => {
  const item = [
    entry("A1", 0), entry("Item A", 1), entry("m", 2), entry("1,00", 3), entry("10,00", 4), entry("10,00", 5),
  ];
  const total = [entry("Total", 1), entry("999,00", 5)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 5, rows: [item, total] }]),
  );
  equal(
    result.arithmeticEvaluations.find((evaluation) => evaluation.relation === "descendant_sum")?.outcome,
    "insufficient_evidence",
  );
});

test("corrections A-E preserve determinism, runtime-key invariance, conservation, and evidence integrity together", () => {
  const columns = [
    { header: "", left: 0, right: 50 },
    { header: "", left: 70, right: 300 },
    { header: "", left: 320, right: 380 },
    { header: "", left: 400, right: 460 },
    { header: "", left: 480, right: 540 },
  ];
  const headerRow = [
    entry("Item", 0), entry("Descrição", 1), entry("Quantidade", 2), entry("Preço Unitário", 3), entry("Fonte", 4),
  ];
  const dataRow = [entry("A1", 0), entry("Serviço sintético", 1), entry("2,00", 2), entry("10,00", 3), entry("X", 4)];
  const buildResult = (keyPrefix: string) =>
    reconstructBudgetTable(
      buildSyntheticInput(columns, [{ pageNumber: 1, rows: [headerRow, dataRow] }], { keyPrefix }),
    );
  const first = buildResult("alpha");
  const second = buildResult("beta");
  equal(first.canonicalFingerprint, second.canonicalFingerprint);
  assert(
    first.arithmeticEvaluations.every((evaluation) => evaluation.outcome !== "invented_evidence"),
    "no invented evidence",
  );
  assert(first.structuralIssues.length === 0, "no structural issues");
  const conservation = conserveEvidence({
    textItems: first.textItems,
    fragments: first.fragments,
    segments: first.segments,
    lines: first.lines,
    cells: first.cells,
    logicalRows: first.logicalRows,
    records: first.records,
    arithmeticEvaluations: first.arithmeticEvaluations,
  });
  equal(conservation.issues.length, 0);
});

// Record status: applicable-field semantics (this round)

test("record status: a service_item with all applicable fields present resolves", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(FULL_COLUMNS, [{ pageNumber: 1, rows: [FULL_ITEM] }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "resolved");
});

test("record status: a service_item missing an applicable quantity cell becomes insufficient_evidence", () => {
  const row = [
    entry("A1", 0), entry("Serviço", 1), entry("m", 2),
    entry("10,00", 4), entry("20,00", 5), entry("12,00", 6), entry("24,00", 7),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(FULL_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "insufficient_evidence");
});

test("record status: a service_item missing an applicable item_code cell becomes insufficient_evidence", () => {
  const row = [
    entry("Serviço", 1), entry("m", 2), entry("2,00", 3),
    entry("10,00", 4), entry("20,00", 5), entry("12,00", 6), entry("24,00", 7),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(FULL_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "insufficient_evidence");
});

test("record status: a service_item missing an applicable unit_price cell becomes insufficient_evidence", () => {
  const row = [
    entry("A1", 0), entry("Serviço", 1), entry("m", 2), entry("2,00", 3),
    entry("10,00", 4), entry("20,00", 5), entry("24,00", 7),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(FULL_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "insufficient_evidence");
});

test("record status: a service_item missing an applicable total_price cell becomes insufficient_evidence", () => {
  const row = [
    entry("A1", 0), entry("Serviço", 1), entry("m", 2), entry("2,00", 3),
    entry("10,00", 4), entry("20,00", 5), entry("12,00", 6),
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(FULL_COLUMNS, [{ pageNumber: 1, rows: [row] }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "insufficient_evidence");
});

test("record status: unit_cost absent because the page schema has no unit_cost column does not force insufficient_evidence", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [SIMPLE_ITEM] }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "resolved");
});

test("record status: bdi_rate absent because the page schema has no bdi_rate column does not force insufficient_evidence", () => {
  const result = reconstructBudgetTable(
    buildSyntheticInput(NO_BDI_COLUMNS, [{ pageNumber: 1, rows: [NO_BDI_ITEM] }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "resolved");
});

test("record status: a divergent applicable cell contaminates the record to ambiguous (direct classifier unit)", () => {
  const pageNumber = 1;
  const columns = [
    fakeColumn(pageNumber, "description", "column:description"),
    fakeColumn(pageNumber, "quantity", "column:quantity"),
  ];
  const row: ReconstructedLogicalRow = {
    rowId: "row:main",
    pageNumber,
    locatorId: "locator:main",
    kind: "service_item",
    status: "resolved",
    cellIds: ["cell:description", "cell:quantity"],
    description: "Serviço",
    descriptionSourceRowIds: [],
    continuationCandidateRowIds: [],
  };
  const cells: ReadonlyArray<ReconstructedCell> = [
    fakeCell("cell:description", pageNumber, "locator:main", "line:main", "column:description", "description", "present"),
    fakeCell("cell:quantity", pageNumber, "locator:main", "line:main", "column:quantity", "quantity", "divergent"),
  ];
  const rows = [row];
  const records = classifyRecords(rows, { cells, fragments: [], textItems: [], columns, rows });
  const record = records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "ambiguous");
});

test("record status: an applicable missing field and an applicable ambiguous field together resolve to ambiguous (precedence)", () => {
  const pageNumber = 1;
  const columns = [
    fakeColumn(pageNumber, "description", "column:description"),
    fakeColumn(pageNumber, "quantity", "column:quantity"),
    fakeColumn(pageNumber, "unit_price", "column:unit_price"),
  ];
  const row: ReconstructedLogicalRow = {
    rowId: "row:main",
    pageNumber,
    locatorId: "locator:main",
    kind: "service_item",
    status: "resolved",
    cellIds: ["cell:description", "cell:quantity", "cell:unit_price"],
    description: "Serviço",
    descriptionSourceRowIds: [],
    continuationCandidateRowIds: [],
  };
  const cells: ReadonlyArray<ReconstructedCell> = [
    fakeCell("cell:description", pageNumber, "locator:main", "line:main", "column:description", "description", "present"),
    fakeCell("cell:quantity", pageNumber, "locator:main", "line:main", "column:quantity", "quantity", "missing"),
    fakeCell("cell:unit_price", pageNumber, "locator:main", "line:main", "column:unit_price", "unit_price", "ambiguous"),
  ];
  const rows = [row];
  const records = classifyRecords(rows, { cells, fragments: [], textItems: [], columns, rows });
  const record = records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "ambiguous");
});

test("record status: a group with only identity fields present resolves even though economic columns are missing", () => {
  const groupRow = [entry("01", 0), entry("Serviços Gerais", 1)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows: [groupRow] }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "group");
  assert(record !== undefined, "expected a group record");
  equal(record?.status, "resolved");
});

test("record status: a subgroup with only identity fields present resolves even though economic columns are missing", () => {
  const rows = [
    [entry("1", 0), entry("Grupo sintético", 1)],
    [entry("1.1", 0), entry("Subgrupo sintético", 1)],
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "subgroup");
  assert(record !== undefined, "expected a subgroup record");
  equal(record?.status, "resolved");
});

test("record status: a total with only description and total_price present resolves despite missing economic detail columns", () => {
  const rows = [SIMPLE_ITEM, [entry("Total", 1), entry("6,00", 5)]];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "total");
  assert(record !== undefined, "expected a total record");
  equal(record?.status, "resolved");
});

test("record status: a subtotal with only description and total_price present resolves despite missing economic detail columns", () => {
  const rows = [SIMPLE_ITEM, [entry("Subtotal", 1), entry("6,00", 5)]];
  const result = reconstructBudgetTable(
    buildSyntheticInput(SIMPLE_COLUMNS, [{ pageNumber: 1, rows }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "subtotal");
  assert(record !== undefined, "expected a subtotal record");
  equal(record?.status, "resolved");
});

test("record status: an ambiguous description continuation propagates ambiguous to its record (direct classifier unit)", () => {
  const pageNumber = 1;
  const columns = [fakeColumn(pageNumber, "description", "column:description")];
  const mainRow: ReconstructedLogicalRow = {
    rowId: "row:main",
    pageNumber,
    locatorId: "locator:main",
    kind: "service_item",
    status: "resolved",
    cellIds: ["cell:description"],
    description: "Serviço",
    descriptionSourceRowIds: [],
    continuationCandidateRowIds: [],
  };
  const continuationRow: ReconstructedLogicalRow = {
    rowId: "row:continuation",
    pageNumber,
    locatorId: "locator:continuation",
    kind: "description_continuation",
    status: "ambiguous",
    cellIds: [],
    description: "continuação",
    descriptionSourceRowIds: [mainRow.rowId],
    continuationCandidateRowIds: [mainRow.rowId, "row:other-candidate"],
  };
  const cells: ReadonlyArray<ReconstructedCell> = [
    fakeCell("cell:description", pageNumber, "locator:main", "line:main", "column:description", "description", "present"),
  ];
  const rows = [mainRow, continuationRow];
  const records = classifyRecords(rows, { cells, fragments: [], textItems: [], columns, rows });
  const record = records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "ambiguous");
});

test("record status: an insufficient_evidence description continuation propagates insufficient_evidence to its record (direct classifier unit)", () => {
  const pageNumber = 1;
  const columns = [fakeColumn(pageNumber, "description", "column:description")];
  const mainRow: ReconstructedLogicalRow = {
    rowId: "row:main",
    pageNumber,
    locatorId: "locator:main",
    kind: "service_item",
    status: "resolved",
    cellIds: ["cell:description"],
    description: "Serviço",
    descriptionSourceRowIds: [],
    continuationCandidateRowIds: [],
  };
  const continuationRow: ReconstructedLogicalRow = {
    rowId: "row:continuation",
    pageNumber,
    locatorId: "locator:continuation",
    kind: "description_continuation",
    status: "insufficient_evidence",
    cellIds: [],
    description: "continuação",
    descriptionSourceRowIds: [mainRow.rowId],
    continuationCandidateRowIds: [],
  };
  const cells: ReadonlyArray<ReconstructedCell> = [
    fakeCell("cell:description", pageNumber, "locator:main", "line:main", "column:description", "description", "present"),
  ];
  const rows = [mainRow, continuationRow];
  const records = classifyRecords(rows, { cells, fragments: [], textItems: [], columns, rows });
  const record = records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "insufficient_evidence");
});

test("record status: a role entirely absent from the page schema does not force insufficient_evidence", () => {
  const columns = [
    { header: "Descrição", left: 80, right: 300 },
    { header: "Quantidade", left: 320, right: 380 },
    { header: "Preço Unitário", left: 400, right: 460 },
    { header: "Preço Total", left: 480, right: 540 },
  ] as const;
  const row = [entry("Serviço", 0), entry("2,00", 1), entry("10,00", 2), entry("20,00", 3)];
  const result = reconstructBudgetTable(
    buildSyntheticInput(columns, [{ pageNumber: 1, rows: [row] }]),
  );
  const record = result.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "resolved");
});

test("record status: applicable-field precedence preserves determinism, runtime-key invariance, and conservation", () => {
  const rowMissingQuantity = [
    entry("A1", 0), entry("Serviço", 1), entry("m", 2),
    entry("10,00", 4), entry("20,00", 5), entry("12,00", 6), entry("24,00", 7),
  ];
  const buildResult = (keyPrefix: string) =>
    reconstructBudgetTable(
      buildSyntheticInput(FULL_COLUMNS, [{ pageNumber: 1, rows: [rowMissingQuantity] }], { keyPrefix }),
    );
  const first = buildResult("alpha");
  const second = buildResult("beta");
  equal(first.canonicalFingerprint, second.canonicalFingerprint);
  const record = first.records.find((candidate) => candidate.kind === "service_item");
  assert(record !== undefined, "expected a service_item record");
  equal(record?.status, "insufficient_evidence");
  const conservation = conserveEvidence({
    textItems: first.textItems,
    fragments: first.fragments,
    segments: first.segments,
    lines: first.lines,
    cells: first.cells,
    logicalRows: first.logicalRows,
    records: first.records,
    arithmeticEvaluations: first.arithmeticEvaluations,
  });
  equal(conservation.issues.length, 0);
});

test("record status invariant: no resolved record in a mixed synthetic reconstruction has an applicable field in a bad state", () => {
  const rows = [
    FULL_ITEM,
    [
      entry("A2", 0), entry("Serviço parcial", 1), entry("m", 2),
      entry("10,00", 4), entry("20,00", 5), entry("12,00", 6), entry("24,00", 7),
    ],
    [entry("02", 0), entry("Grupo dois", 1)],
    [entry("Subtotal", 1), entry("24,00", 7)],
    [entry("Total", 1), entry("24,00", 7)],
  ];
  const result = reconstructBudgetTable(
    buildSyntheticInput(FULL_COLUMNS, [{ pageNumber: 1, rows }]),
  );
  assertNoResolvedRecordHasApplicableEvidenceGap(result);
  assert(
    result.records.some((record) => record.status === "resolved"),
    "expected at least one resolved record to make the sweep meaningful",
  );
});
