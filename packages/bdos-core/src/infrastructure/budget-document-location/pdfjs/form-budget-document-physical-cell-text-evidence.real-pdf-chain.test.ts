import { pdfjsPhysicalDocumentReader } from "./pdfjs-physical-document-reader";
import { buildSyntheticPdfBytes } from "./testing/synthetic-pdf-bytes";
import { observeDocumentSignals, locateBudgetDocumentPages, reconstructBudgetDocumentStructure, detectBudgetDocumentTabularRegions, reconstructBudgetDocumentPhysicalColumnHypotheses, formBudgetDocumentPhysicalCellHypotheses, formBudgetDocumentPhysicalCellTextEvidence } from "../../../domain/budget-document-location";

function equal(a: unknown, b: unknown, m = "values differ"): void { if (a !== b) throw new Error(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const bytes = buildSyntheticPdfBytes([{ items: [0, 1, 2, 3].flatMap((row) => { const y = 700 - row * 34; return [{ text: `1.${row + 1} Servico ${row}`, x: 72, y, fontSize: 18 }, { text: `${row + 1}0,00`, x: 400, y, fontSize: 18 }, ...(row === 0 ? [{ text: "BDI", x: 500, y, fontSize: 18 }] : [])]; }) }]);

async function chain() {
  const physicalRead = await pdfjsPhysicalDocumentReader.read(bytes.slice());
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const tabularRegionDetection = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const physicalColumnHypothesisReconstruction = reconstructBudgetDocumentPhysicalColumnHypotheses({ structureReconstruction, tabularRegionDetection });
  const physicalCellHypothesisFormation = formBudgetDocumentPhysicalCellHypotheses({ structureReconstruction, tabularRegionDetection, physicalColumnHypothesisReconstruction });
  return formBudgetDocumentPhysicalCellTextEvidence({ physicalRead, structureReconstruction, physicalCellHypothesisFormation });
}

async function main() {
  const a = await chain();
  equal(a.status, "completed");
  equal(a.groups.length, 1);
  const region = a.groups[0].pages[0].regions[0];
  equal(region.cellTextEvidences.length, 8);
  equal(region.cellTextEvidences.every((entry) => entry.status === "formed"), true, "every real cell must form a safe fragment, no economic interpretation involved");
  const allFragmentTexts = region.cellTextEvidences.flatMap((entry) => entry.segmentOutcomes.flatMap((outcome) => (outcome.status === "resolved" ? outcome.fragments.map((fragment) => fragment.originalText) : [])));
  equal(allFragmentTexts.some((text) => text.includes("Servico")), true, "a real text fragment must carry the verbatim source text");
  equal(allFragmentTexts.includes("BDI"), false, "the BDI orphan segment must never appear as a cell fragment");
  equal(a.metrics.cellTextEvidenceFormedCount, 8);
  equal(a.metrics.formationFailedTextItemCount, 0);

  const b = await chain();
  equal(JSON.stringify(a), JSON.stringify(b), "real PDF chain through text evidence must be deterministic");
  console.log("ok - synthetic PDF bytes traverse the complete real chain through physical cell text evidence");
}
main().catch((e) => { console.error(e); process.exit(1); });
