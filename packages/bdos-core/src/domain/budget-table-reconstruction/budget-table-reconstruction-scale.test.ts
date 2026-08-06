import { reconstructBudgetTable } from "./budget-table-reconstruction";
import {
  buildSyntheticInput,
  entry,
} from "./testing/budget-table-reconstruction-synthetic-fixture";

const columns = [
  { header: "Código", left: 0, right: 70 },
  { header: "Descrição", left: 80, right: 300 },
  { header: "Unidade", left: 310, right: 360 },
  { header: "Quantidade", left: 370, right: 430 },
  { header: "Preço Unitário", left: 440, right: 510 },
  { header: "Preço Total", left: 520, right: 600 },
] as const;

const pages = Array.from({ length: 5 }, (_, pageIndex) => ({
  pageNumber: pageIndex + 1,
  rows: Array.from({ length: 100 }, (_, rowIndex) => [
    entry(`S${pageIndex + 1}-${rowIndex + 1}`, 0),
    entry(`Serviço sintético de escala ${rowIndex + 1}`, 1),
    entry("m", 2),
    entry("2,00", 3),
    entry("3,00", 4),
    entry("6,00", 5),
  ]),
}));

const first = reconstructBudgetTable(buildSyntheticInput(columns, pages));
const second = reconstructBudgetTable(buildSyntheticInput(columns, pages));

if (!/^[a-f0-9]{64}$/.test(first.canonicalFingerprint)) {
  throw new Error("scale result did not produce a full SHA-256 fingerprint");
}
if (first.canonicalFingerprint !== second.canonicalFingerprint) {
  throw new Error("scale reconstruction is not deterministic");
}
if (first.records.length !== 500) {
  throw new Error(`expected 500 scale records, observed ${first.records.length}`);
}
if (first.pages.length !== 5) {
  throw new Error(`expected 5 scale pages, observed ${first.pages.length}`);
}

console.log(
  `ok - 5 pages and 500 logical records complete with incremental fingerprint ${first.canonicalFingerprint}`,
);
