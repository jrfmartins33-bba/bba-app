import { performance } from "node:perf_hooks";
import { reconstructBudgetTable } from "./budget-table-reconstruction";
import {
  buildSyntheticInput,
  entry,
  type SyntheticRow,
} from "./testing/budget-table-reconstruction-synthetic-fixture";

const columns = [
  { header: "Código", left: 0, right: 70 },
  { header: "Descrição", left: 80, right: 300 },
  { header: "Unidade", left: 310, right: 360 },
  {
    header: "Quantidade",
    left: 370,
    right: 430,
    observedBands: [
      { left: 370, right: 430 },
      { left: 371, right: 431 },
      { left: 369, right: 429 },
    ],
  },
  { header: "Preço\nUnitário", left: 440, right: 510 },
  { header: "Preço Total", left: 520, right: 600 },
] as const;

function serviceRows(pageNumber: number, count: number): ReadonlyArray<SyntheticRow> {
  return Array.from({ length: count }, (_, rowIndex) => [
    entry(`S${pageNumber}-${rowIndex + 1}`, 0),
    entry(`Serviço sintético diversificado ${rowIndex + 1}`, 1),
    entry("m", 2),
    entry("2,00", 3),
    entry("3,00", 4),
    entry("6,00", 5),
  ]);
}

const pages = [
  {
    pageNumber: 1,
    rows: [
      [entry("1", 0), entry("Grupo sintético", 1)],
      [entry("1.1", 0), entry("Subgrupo sintético", 1)],
      ...serviceRows(1, 100),
      [entry("continuação descritiva da última composição", 1)],
      [entry("descrição compartilhada R$ 6,00", 1, 5)],
    ],
  },
  {
    pageNumber: 2,
    includeHeader: false,
    rows: [
      [entry("Subtotal", 1), entry("600", 5)],
      ...serviceRows(2, 100),
      [entry("Subtotal", 1), entry("600", 5)],
    ],
  },
  {
    pageNumber: 3,
    includeHeader: false,
    rows: [
      [entry("Total", 1), entry("1200", 5)],
      ...serviceRows(3, 100),
    ],
  },
  {
    pageNumber: 5,
    rows: serviceRows(5, 100),
  },
  {
    pageNumber: 6,
    includeHeader: false,
    rows: serviceRows(6, 100),
  },
];

const start = performance.now();
const first = reconstructBudgetTable(buildSyntheticInput(columns, pages));
const afterFirstHeap = process.memoryUsage().heapUsed;
const second = reconstructBudgetTable(buildSyntheticInput(columns, pages));
const elapsedMilliseconds = performance.now() - start;
const peakObservedHeapBytes = Math.max(afterFirstHeap, process.memoryUsage().heapUsed);

if (!/^[a-f0-9]{64}$/.test(first.canonicalFingerprint)) {
  throw new Error("scale result did not produce a full SHA-256 fingerprint");
}
if (first.canonicalFingerprint !== second.canonicalFingerprint) {
  throw new Error("scale reconstruction is not deterministic");
}
if (first.records.length < 500) {
  throw new Error(`expected at least 500 scale records, observed ${first.records.length}`);
}
if (first.pages.map((page) => page.pageNumber).join(",") !== "1,2,3,5,6") {
  throw new Error("scale selection lost the nonconsecutive-page proof");
}
if (first.structuralIssues.some((issue) => issue.severity === "failure")) {
  throw new Error("scale reconstruction violated evidence conservation");
}
if (
  first.columns
    .filter((column) => column.pageNumber === 5)
    .some((column) => column.headerLineIds.length === 0)
) {
  throw new Error("nonconsecutive page unexpectedly inherited its schema");
}

// ---------------------------------------------------------------------------
// Second, independent reconstruction: hierarchical two-line header (CUSTO and
// PREÇO parents each covering two children), one deliberately wide upstream
// band that must be split by observed geometry, an auxiliary column with no
// economic role, and a full item_code/description/unit/quantity/unit_cost/
// bdi_rate/unit_price/total_price schema across multiple pages -- kept
// separate from the reconstruction above so none of its already-proven
// diversity (group/subtotal/total hierarchy, nonconsecutive page selection,
// jittered near-duplicate bands) is disturbed.
// ---------------------------------------------------------------------------

const ECONOMIC_COLUMN_BOUNDS = {
  itemCode: { left: 0, right: 50 },
  description: { left: 70, right: 300 },
  unit: { left: 310, right: 350 },
  quantity: { left: 360, right: 410 },
  unitCost: { left: 430, right: 480 },
  bdiRate: { left: 480, right: 530 },
  unitPrice: { left: 550, right: 610 },
  totalPrice: { left: 610, right: 670 },
  auxiliary: { left: 690, right: 800 },
} as const;

const ECONOMIC_OVERRIDE_BANDS = [
  ECONOMIC_COLUMN_BOUNDS.itemCode,
  ECONOMIC_COLUMN_BOUNDS.description,
  ECONOMIC_COLUMN_BOUNDS.unit,
  ECONOMIC_COLUMN_BOUNDS.quantity,
  { left: ECONOMIC_COLUMN_BOUNDS.unitCost.left, right: ECONOMIC_COLUMN_BOUNDS.bdiRate.right },
  ECONOMIC_COLUMN_BOUNDS.unitPrice,
  ECONOMIC_COLUMN_BOUNDS.totalPrice,
  ECONOMIC_COLUMN_BOUNDS.auxiliary,
];

const economicHeaderParentLine = [
  entry("Item", 0),
  entry("Descrição", 1),
  entry("Unidade", 2),
  entry("Quantidade", 3),
  entry("Custo", 4, 5),
  entry("Preço", 6, 7),
  entry("Fonte de Pesquisa", 8),
];
const economicHeaderChildLine = [
  entry("Unit.S/BDI", 4),
  entry("BDI", 5),
  entry("Unitário", 6),
  entry("Total", 7),
];

function economicDataRow(pageIndex: number, rowIndex: number) {
  const unitCost = 100 + 4 * rowIndex;
  const unitPrice = Math.round(unitCost * 1.25);
  const quantity = 2;
  const totalPrice = quantity * unitPrice;
  return [
    entry(`E${pageIndex + 1}-${rowIndex + 1}`, 0),
    entry(`Composição sintética de escala ${rowIndex + 1}`, 1),
    entry("m", 2),
    entry(`${quantity},00`, 3),
    entry(`${unitCost},00`, 4),
    entry("25,00", 5),
    entry(`${unitPrice},00`, 6),
    entry(`${totalPrice},00`, 7),
    entry("SINAPI", 8),
  ];
}

const economicColumns = Object.entries(ECONOMIC_COLUMN_BOUNDS).map(([key, bounds]) => ({
  header: key,
  left: bounds.left,
  right: bounds.right,
}));

const economicPages = Array.from({ length: 5 }, (_, pageIndex) => ({
  pageNumber: pageIndex + 1,
  includeHeader: false as const,
  rows: [
    economicHeaderParentLine,
    economicHeaderChildLine,
    ...Array.from({ length: 100 }, (_, rowIndex) => economicDataRow(pageIndex, rowIndex)),
  ],
  columnHypothesisOverride: ECONOMIC_OVERRIDE_BANDS,
}));

const economicFirst = reconstructBudgetTable(buildSyntheticInput(economicColumns, economicPages));
const economicSecond = reconstructBudgetTable(buildSyntheticInput(economicColumns, economicPages));

if (!/^[a-f0-9]{64}$/.test(economicFirst.canonicalFingerprint)) {
  throw new Error("economic scale result did not produce a full SHA-256 fingerprint");
}
if (economicFirst.canonicalFingerprint !== economicSecond.canonicalFingerprint) {
  throw new Error("economic scale reconstruction is not deterministic");
}
if (economicFirst.records.length !== 500) {
  throw new Error(`expected 500 economic scale records, observed ${economicFirst.records.length}`);
}
const economicServiceItems = economicFirst.records.filter((record) => record.kind === "service_item");
if (economicServiceItems.length !== 500) {
  throw new Error(
    `expected all 500 economic records to classify as service_item, observed ${economicServiceItems.length}`,
  );
}
if (
  !economicServiceItems.every(
    (record) =>
      record.itemCode !== null &&
      record.description !== null &&
      record.unit !== null &&
      record.quantity?.exactValue !== null &&
      record.unitCost?.exactValue !== null &&
      record.bdiRate?.exactValue !== null &&
      record.unitPrice?.exactValue !== null &&
      record.totalPrice?.exactValue !== null,
  )
) {
  throw new Error("expected every economic scale service item to carry a full economic field set");
}
const economicWideBandSplit = economicFirst.columns.some(
  (column) => column.groupingRuleId === "wide-band-geometric-split-v1",
);
if (!economicWideBandSplit) {
  throw new Error("expected the deliberately wide CUSTO band to be split at scale");
}
const economicAuxiliaryColumns = economicFirst.columns.filter(
  (column) => column.leftPoints === ECONOMIC_COLUMN_BOUNDS.auxiliary.left,
);
if (!economicAuxiliaryColumns.every((column) => column.role === "unknown")) {
  throw new Error("expected the auxiliary column to remain unknown at scale");
}
if (
  economicFirst.arithmeticEvaluations.some((evaluation) => evaluation.outcome === "invented_evidence")
) {
  throw new Error("expected zero invented_evidence outcomes in the economic scale reconstruction");
}
if (
  !economicFirst.arithmeticEvaluations.some(
    (evaluation) => evaluation.outcome === "direct_correspondence",
  )
) {
  throw new Error("expected direct_correspondence outcomes in the economic scale reconstruction");
}

console.log(
  JSON.stringify({
    message: "ok - diversified scale reconstruction",
    pages: first.pages.length,
    records: first.records.length,
    fingerprint: first.canonicalFingerprint,
    elapsedMilliseconds: Math.round(elapsedMilliseconds),
    peakObservedHeapBytes,
  }),
);
console.log(
  JSON.stringify({
    message: "ok - hierarchical-header/wide-band/full-economic-schema scale reconstruction",
    pages: economicFirst.pages.length,
    records: economicFirst.records.length,
    serviceItems: economicServiceItems.length,
    wideBandSplit: economicWideBandSplit,
    fingerprint: economicFirst.canonicalFingerprint,
  }),
);
