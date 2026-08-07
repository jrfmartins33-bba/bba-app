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
