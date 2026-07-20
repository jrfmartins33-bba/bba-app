import { pdfjsPhysicalDocumentReader } from "./pdfjs-physical-document-reader";
import { buildSyntheticPdfBytes } from "./testing/synthetic-pdf-bytes";
import {
  observeDocumentSignals, locateBudgetDocumentPages, reconstructBudgetDocumentStructure, detectBudgetDocumentTabularRegions,
  reconstructBudgetDocumentPhysicalColumnHypotheses, formBudgetDocumentPhysicalCellHypotheses, formBudgetDocumentPhysicalCellTextEvidence,
  formBudgetDocumentPageLocalNeutralStructuredEvidence, evaluateBudgetDocumentPageBoundaryNeutralContinuity,
} from "../../../domain/budget-document-location";

function equal(a: unknown, b: unknown, m = "values differ"): void { if (a !== b) throw new Error(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

/**
 * Quatro páginas reais (PDF sintético via pdf.js, nunca documento real).
 *
 * Página 1 carrega o marcador "BDI" (mesmo padrão do teste de cadeia real da
 * g.2) para que a localização de páginas (f.0) a classifique como candidata
 * `direct`; as páginas 2-4, sem BDI próprio, só são reconhecidas como parte
 * do mesmo grupo via `structural_continuity` — o mesmo mecanismo, rio acima,
 * que já prova que um grupo é fronteira de proveniência legítima para a g.3
 * nunca cruzar.
 *
 * O próprio marcador "BDI" estende fisicamente os limites da região da
 * página 1 além da coluna de valor — uma diferença geométrica real e
 * legítima frente às páginas 2-4, que não o carregam. Isso prova o sinal E
 * (geometria) de forma honesta contra um PDF real: a fronteira 1->2 (cuja
 * origem carrega o BDI) NÃO deve sustentar continuidade; a fronteira 2->3,
 * entre duas páginas de layout idêntico sem BDI, DEVE sustentar.
 */
function rowsForPage(withBdi: boolean, servicePrefix: number, xLabel: number, xValue: number): ReadonlyArray<{ text: string; x: number; y: number; fontSize: number }> {
  return [0, 1, 2, 3].flatMap((row) => {
    const y = 700 - row * 34;
    return [
      { text: `${servicePrefix}.${row + 1} Servico ${row}`, x: xLabel, y, fontSize: 18 },
      { text: `${row + 1}0,00`, x: xValue, y, fontSize: 18 },
      ...(row === 0 && withBdi ? [{ text: "BDI", x: xValue + 100, y, fontSize: 18 }] : []),
    ];
  });
}

const fourPageBytes = buildSyntheticPdfBytes([
  { items: rowsForPage(true, 1, 72, 400) },
  { items: rowsForPage(false, 2, 72, 400) },
  { items: rowsForPage(false, 3, 72, 400) },
  { items: rowsForPage(false, 4, 250, 480) }, // geometria deliberadamente deslocada frente à página 3
]);

async function chain(bytes: Uint8Array) {
  const physicalRead = await pdfjsPhysicalDocumentReader.read(bytes.slice());
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const tabularRegionDetection = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const physicalColumnHypothesisReconstruction = reconstructBudgetDocumentPhysicalColumnHypotheses({ structureReconstruction, tabularRegionDetection });
  const physicalCellHypothesisFormation = formBudgetDocumentPhysicalCellHypotheses({ structureReconstruction, tabularRegionDetection, physicalColumnHypothesisReconstruction });
  const physicalCellTextEvidenceFormation = formBudgetDocumentPhysicalCellTextEvidence({ physicalRead, structureReconstruction, physicalCellHypothesisFormation });
  const pageLocalNeutralStructuredEvidence = formBudgetDocumentPageLocalNeutralStructuredEvidence({ structureReconstruction, tabularRegionDetection, physicalCellHypothesisFormation, physicalCellTextEvidenceFormation });
  const continuity = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence });
  return { pageLocalNeutralStructuredEvidence, continuity };
}

async function main() {
  const { pageLocalNeutralStructuredEvidence: neutral, continuity } = await chain(fourPageBytes);

  equal(neutral.status, "structured", "the g.2 chain feeding this scenario must itself be clean");
  equal(neutral.groups.length, 1, "all four pages must be located in the same candidate group (page 1 direct, 2-4 structural_continuity)");
  equal(neutral.groups[0].pages.length, 4, "the group must contain exactly the four synthetic pages");

  equal(continuity.status, "evaluated", "a clean, real four-page chain must evaluate without any technical problem");
  equal(continuity.evaluations.length, 3, "a four-page group must produce exactly three boundaries");

  const oneToTwo = continuity.evaluations.find((e) => e.originPageNumber === 1 && e.targetPageNumber === 2)!;
  const twoToThree = continuity.evaluations.find((e) => e.originPageNumber === 2 && e.targetPageNumber === 3)!;
  const threeToFour = continuity.evaluations.find((e) => e.originPageNumber === 3 && e.targetPageNumber === 4)!;

  equal(oneToTwo.status, "continuity_not_sustained", "the boundary FROM the BDI-bearing page must not sustain continuity — its region genuinely spans a wider physical area than the following, BDI-less page");
  equal(oneToTwo.contraryEvidence.some((e) => e.evidence === "incompatible_horizontal_geometry"), true, "the BDI marker must be the real, physically-measured cause of the geometric incompatibility, proven end-to-end through the real PDF chain (never asserted synthetically)");

  equal(twoToThree.status, "continuity_sustained", "two real, identically-laid-out pages (both without BDI) must sustain continuity end-to-end through the real PDF chain");
  equal(twoToThree.favorableEvidence.length, 2, "both merit signals must be favorable for an identically-laid-out real continuation");
  equal(twoToThree.originRegionKey !== null && twoToThree.targetRegionKey !== null, true, "a sustained evaluation must always carry real, non-null boundary region keys");

  equal(threeToFour.status !== "continuity_sustained", true, "a page with deliberately shifted column geometry (both x positions moved) must never sustain continuity with its structurally different predecessor");

  // Determinismo total da cadeia real (repete a leitura do zero).
  const again = await chain(fourPageBytes);
  equal(JSON.stringify(continuity), JSON.stringify(again.continuity), "the real PDF chain through page boundary neutral continuity evaluation must be deterministic");

  console.log(`ok - synthetic real PDF bytes (four pages) traverse the complete chain through page boundary neutral continuity evaluation; the BDI-bearing origin page correctly fails to sustain continuity on real, measured geometry (${oneToTwo.status}), two identically-laid-out real pages sustain continuity (${twoToThree.favorableEvidence.length} favorable signals), a geometrically shifted page does not (${threeToFour.status}), and the full chain is deterministic`);
}
main().catch((e) => { console.error(e); process.exit(1); });
