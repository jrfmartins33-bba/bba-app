import { evaluateArithmetic } from "./budget-table-reconstruction-arithmetic";
import { conserveEvidence } from "./budget-table-reconstruction-conservation";
import { canonicalChunks, fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import { headerVocabularyRoles } from "./budget-table-reconstruction-profile";
import { reconstructBudgetTable } from "./budget-table-reconstruction";
import type {
  ParsedNumericEvidence,
  ReconstructedBudgetRecord,
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
      nonGroupingReasonCodes: [] },
    { columnId: "u", pageNumber: 1, horizontalOrder: 2, leftPoints: 1, rightPoints: 2,
      candidateRoles: ["unit_price"], role: "unit_price", status: "resolved", headerLineIds: [], evidenceLocatorIds: [],
      sourcePhysicalColumnHypothesisIds: [], contributingRegionIds: [], contributingLineIds: [],
      contributingSegmentIds: [], groupingRuleId: "header-band-v1", representativePhysicalColumnHypothesisId: null,
      nonGroupingReasonCodes: [] },
    { columnId: "t", pageNumber: 1, horizontalOrder: 3, leftPoints: 2, rightPoints: 3,
      candidateRoles: ["total_price"], role: "total_price", status: "resolved", headerLineIds: [], evidenceLocatorIds: [],
      sourcePhysicalColumnHypothesisIds: [], contributingRegionIds: [], contributingLineIds: [],
      contributingSegmentIds: [], groupingRuleId: "header-band-v1", representativePhysicalColumnHypothesisId: null,
      nonGroupingReasonCodes: [] },
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
