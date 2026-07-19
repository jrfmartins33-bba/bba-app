import { buildStructurePage, cellFormationRegion, cellHypothesis, gridIntersection, physicalItem, physicalPage, placedOutcome, structureLine, structureSegment } from "./testing/physical-cell-text-evidence-formation-fixture-builders";
import { formRegionCellTextEvidences } from "./physical-cell-text-segment-formation";
import { validateCellHypothesisConservation, validateFragmentDispositionConservation, validateMetricCategoryConservation, validateSegmentOutcomeConservation, validateTextItemOccurrenceConservation } from "./physical-cell-text-evidence-formation-conservation";
import { computeRegionMetrics } from "./physical-cell-text-evidence-formation-metrics";
import type { PhysicalCellTextEvidence, RegionPhysicalCellTextEvidenceFormationMetrics } from "./budget-document-physical-cell-text-evidence-formation.types";

const CONTEXT = { groupKey: "group-1", regionKey: "region-1" };

const page = physicalPage(1, [physicalItem(0, "alpha"), physicalItem(1, "beta")]);
const segA = structureSegment("seg-a", "line-1", 1, 1, [0]);
const segB = structureSegment("seg-b", "line-1", 1, 2, [1]);
const structurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-a", "seg-b"])], [segA, segB], [placedOutcome(0, "line-1", "seg-a"), placedOutcome(1, "line-1", "seg-b")]);
const intersectionA = gridIntersection("gi-a", "line-1", 1, 1, "cell-a", 1, "region-1");
const intersectionB = gridIntersection("gi-b", "line-1", 1, 2, "cell-b", 1, "region-1");
const cellA = cellHypothesis("cell-a", "gi-a", ["seg-a"]);
const cellB = cellHypothesis("cell-b", "gi-b", ["seg-b"]);
const region = cellFormationRegion("region-1", 1, [intersectionA, intersectionB], [cellA, cellB]);
const { cellTextEvidences } = formRegionCellTextEvidences(region, structurePage, page, CONTEXT);

if (!validateCellHypothesisConservation(region, cellTextEvidences)) throw new Error("valid fixture unexpectedly failed cell hypothesis conservation");
if (!validateSegmentOutcomeConservation(region, cellTextEvidences)) throw new Error("valid fixture unexpectedly failed segment outcome conservation");
if (!validateTextItemOccurrenceConservation(structurePage, cellTextEvidences)) throw new Error("valid fixture unexpectedly failed text item occurrence conservation");
if (!validateFragmentDispositionConservation(cellTextEvidences, page)) throw new Error("valid fixture unexpectedly failed fragment/disposition conservation");
const validMetrics = computeRegionMetrics(region.cellHypotheses.length, cellTextEvidences, 0);
if (!validateMetricCategoryConservation(region.cellHypotheses.length, cellTextEvidences, validMetrics)) throw new Error("valid fixture unexpectedly failed metric category conservation");
console.log("ok - all five conservation gates accept the valid fixture");

// --- Portão 1: hipóteses de célula --------------------------------------------
{
  const missingOne = cellTextEvidences.slice(0, 1);
  if (validateCellHypothesisConservation(region, missingOne)) throw new Error("gate 1 did not reject a missing cell evidence");
  const duplicated = [...cellTextEvidences, cellTextEvidences[0]];
  if (validateCellHypothesisConservation(region, duplicated)) throw new Error("gate 1 did not reject a duplicated cellHypothesisKey");
  console.log("ok - gate 1 rejects missing and duplicated cell evidence");
}

// --- Portão 2: segmentos referenciados ----------------------------------------
{
  const tampered: PhysicalCellTextEvidence[] = cellTextEvidences.map((entry) => (entry.cellHypothesisKey === "cell-a" ? { ...entry, segmentOutcomes: [] } : entry));
  if (validateSegmentOutcomeConservation(region, tampered)) throw new Error("gate 2 did not reject a cell missing its segmentOutcomes entry");
  console.log("ok - gate 2 rejects a cell whose segmentOutcomes no longer matches its segmentKeys");
}

// --- Portão 3: ocorrências de itens textuais ----------------------------------
{
  const tampered: PhysicalCellTextEvidence[] = cellTextEvidences.map((entry) => {
    if (entry.cellHypothesisKey !== "cell-a") return entry;
    const outcome = entry.segmentOutcomes[0];
    if (outcome.status !== "resolved") return entry;
    return { ...entry, segmentOutcomes: [{ ...outcome, itemDispositions: [] }, ...entry.segmentOutcomes.slice(1)] };
  });
  if (validateTextItemOccurrenceConservation(structurePage, tampered)) throw new Error("gate 3 did not reject an occurrence count that diverges from segment.sourceTextItemIndices.length");
  console.log("ok - gate 3 rejects a segment whose itemDispositions count diverges from the real sourceTextItemIndices length");
}

// --- Portão 4: fragmento ↔ disposição -----------------------------------------
{
  const tampered: PhysicalCellTextEvidence[] = cellTextEvidences.map((entry) => {
    if (entry.cellHypothesisKey !== "cell-a") return entry;
    const outcome = entry.segmentOutcomes[0];
    if (outcome.status !== "resolved") return entry;
    return { ...entry, segmentOutcomes: [{ ...outcome, fragments: outcome.fragments.map((fragment) => ({ ...fragment, originalText: "tampered" })) }, ...entry.segmentOutcomes.slice(1)] };
  });
  if (validateFragmentDispositionConservation(tampered, page)) throw new Error("gate 4 did not reject a fragment whose originalText diverges from the real physical item");

  const noFragment: PhysicalCellTextEvidence[] = cellTextEvidences.map((entry) => {
    if (entry.cellHypothesisKey !== "cell-a") return entry;
    const outcome = entry.segmentOutcomes[0];
    if (outcome.status !== "resolved") return entry;
    return { ...entry, segmentOutcomes: [{ ...outcome, fragments: [] }, ...entry.segmentOutcomes.slice(1)] };
  });
  if (validateFragmentDispositionConservation(noFragment, page)) throw new Error("gate 4 did not reject an included_in_text_fragment disposition with no matching fragment");

  const extraFragment: PhysicalCellTextEvidence[] = cellTextEvidences.map((entry) => {
    if (entry.cellHypothesisKey !== "cell-a") return entry;
    const outcome = entry.segmentOutcomes[0];
    if (outcome.status !== "resolved") return entry;
    return { ...entry, segmentOutcomes: [{ ...outcome, fragments: [...outcome.fragments, { sourceReferenceOrder: 99, textItemIndex: 99, originalText: "ghost", normalizedText: "ghost" }] }, ...entry.segmentOutcomes.slice(1)] };
  });
  if (validateFragmentDispositionConservation(extraFragment, page)) throw new Error("gate 4 did not reject a fragment with no corresponding disposition");
  console.log("ok - gate 4 rejects divergent text, a disposition without a fragment, and a fragment without a disposition");
}

// --- Portão 5: categorias métricas ---------------------------------------------
{
  if (validateMetricCategoryConservation(region.cellHypotheses.length, cellTextEvidences, { ...validMetrics, includedTextItemReferenceCount: validMetrics.includedTextItemReferenceCount + 1 } as RegionPhysicalCellTextEvidenceFormationMetrics)) {
    throw new Error("gate 5 did not reject a duplicated/inflated metric count");
  }
  if (validateMetricCategoryConservation(region.cellHypotheses.length, cellTextEvidences, { ...validMetrics, includedTextItemReferenceCount: 0, invalidReferenceTextItemCount: validMetrics.invalidReferenceTextItemCount + validMetrics.includedTextItemReferenceCount } as RegionPhysicalCellTextEvidenceFormationMetrics)) {
    throw new Error("gate 5 did not reject counts swapped between categories even when the total still closes");
  }
  if (validateMetricCategoryConservation(region.cellHypotheses.length, cellTextEvidences, { ...validMetrics, totalEligibleTextItemReferenceCount: validMetrics.totalEligibleTextItemReferenceCount + 1 } as RegionPhysicalCellTextEvidenceFormationMetrics)) {
    throw new Error("gate 5 did not reject a total different from the sum of the real categories");
  }
  console.log("ok - gate 5 rejects an inflated count, a category swap that still sums correctly, and a divergent total");
}

console.log("ok - physical-cell-text-evidence-formation-conservation covers all five gates with valid and adversarial fixtures");
