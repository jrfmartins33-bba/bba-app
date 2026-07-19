import { buildStructurePage, cellFormationRegion, cellHypothesis, gridIntersection, physicalItem, physicalPage, placedOutcome, structureLine, structureSegment } from "./testing/physical-cell-text-evidence-formation-fixture-builders";
import { formRegionCellTextEvidences } from "./physical-cell-text-segment-formation";
import { validateCellHypothesisConservation, validateFragmentDispositionConservation, validateMetricCategoryConservation, validateSegmentOutcomeConservation, validateTextItemOccurrenceConservation } from "./physical-cell-text-evidence-formation-conservation";
import { computeRegionMetrics } from "./physical-cell-text-evidence-formation-metrics";
import type { PhysicalCellTextEvidence, PhysicalCellTextItemDisposition, RegionPhysicalCellTextEvidenceFormationMetrics, ResolvedPhysicalCellTextSegmentOutcome } from "./budget-document-physical-cell-text-evidence-formation.types";

const CONTEXT = { groupKey: "group-1", regionKey: "region-1" };

// --- fixture base: dois segmentos de um item cada, sem duplicidade -----------
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
if (!validateSegmentOutcomeConservation(region, structurePage, cellTextEvidences)) throw new Error("valid fixture unexpectedly failed segment outcome conservation");
if (!validateTextItemOccurrenceConservation(region, structurePage, page, cellTextEvidences)) throw new Error("valid fixture unexpectedly failed text item occurrence conservation");
if (!validateFragmentDispositionConservation(cellTextEvidences, page)) throw new Error("valid fixture unexpectedly failed fragment/disposition conservation");
const validMetrics = computeRegionMetrics(region.cellHypotheses.length, cellTextEvidences, 0);
if (!validateMetricCategoryConservation(region.cellHypotheses.length, cellTextEvidences, validMetrics)) throw new Error("valid fixture unexpectedly failed metric category conservation");
console.log("ok - all five conservation gates accept the valid fixture");

function replaceCellA(evidences: ReadonlyArray<PhysicalCellTextEvidence>, patch: Partial<PhysicalCellTextEvidence>): ReadonlyArray<PhysicalCellTextEvidence> {
  return evidences.map((entry) => (entry.cellHypothesisKey === "cell-a" ? ({ ...entry, ...patch } as PhysicalCellTextEvidence) : entry));
}
function replaceCellASegment(evidences: ReadonlyArray<PhysicalCellTextEvidence>, patch: Partial<ResolvedPhysicalCellTextSegmentOutcome>): ReadonlyArray<PhysicalCellTextEvidence> {
  return replaceCellA(evidences, {
    segmentOutcomes: cellTextEvidences.find((entry) => entry.cellHypothesisKey === "cell-a")!.segmentOutcomes.map((outcome) => (outcome.status === "resolved" ? { ...outcome, ...patch } : outcome)),
  });
}

// --- Portão 1: hipóteses de célula --------------------------------------------
{
  const missingOne = cellTextEvidences.slice(0, 1);
  if (validateCellHypothesisConservation(region, missingOne)) throw new Error("gate 1 did not reject a missing cell evidence");
  const duplicated = [...cellTextEvidences, cellTextEvidences[0]];
  if (validateCellHypothesisConservation(region, duplicated)) throw new Error("gate 1 did not reject a duplicated cellHypothesisKey");
  const wrongIntersection = replaceCellA(cellTextEvidences, { gridIntersectionKey: "gi-ghost" });
  if (validateCellHypothesisConservation(region, wrongIntersection)) throw new Error("gate 1 did not reject a gridIntersectionKey diverging from the real cell hypothesis");
  const wrongStatus = replaceCellA(cellTextEvidences, { status: "partially_formed" });
  if (validateCellHypothesisConservation(region, wrongStatus)) throw new Error("gate 1 did not reject a published status diverging from the recomputed status");
  console.log("ok - gate 1 rejects missing evidence, duplicated evidence, wrong gridIntersectionKey and a status that does not match the recomputed classification");
}

// --- Portão 2: segmentos referenciados ----------------------------------------
{
  const emptyOutcomes = replaceCellA(cellTextEvidences, { segmentOutcomes: [] });
  if (validateSegmentOutcomeConservation(region, structurePage, emptyOutcomes)) throw new Error("gate 2 did not reject a cell missing its segmentOutcomes entry");
  const wrongLineKey = replaceCellASegment(cellTextEvidences, { lineKey: "line-ghost" });
  if (validateSegmentOutcomeConservation(region, structurePage, wrongLineKey)) throw new Error("gate 2 did not reject a published lineKey diverging from the real segment's own line");
  console.log("ok - gate 2 rejects a cell whose segmentOutcomes diverges from segmentKeys, and a published lineKey that diverges from the real structural segment");
}

// --- Portão 3: ocorrências de itens textuais ----------------------------------
{
  const emptyDispositions = replaceCellASegment(cellTextEvidences, { itemDispositions: [] });
  if (validateTextItemOccurrenceConservation(region, structurePage, page, emptyDispositions)) throw new Error("gate 3 did not reject an occurrence count that diverges from the real sourceTextItemIndices length");

  // Segmento com duas ocorrências, para testar troca de posição e status incorreto.
  const twoItemPage = physicalPage(1, [physicalItem(10, "first"), physicalItem(11, "second")]);
  const segTwo = structureSegment("seg-two", "line-2", 1, 1, [10, 11]);
  const twoItemStructurePage = buildStructurePage(1, [structureLine("line-2", 1, ["seg-two"])], [segTwo], [placedOutcome(10, "line-2", "seg-two"), placedOutcome(11, "line-2", "seg-two")]);
  const twoItemIntersection = gridIntersection("gi-two", "line-2", 1, 1, "cell-two", 1, "region-1");
  const twoItemCell = cellHypothesis("cell-two", "gi-two", ["seg-two"]);
  const twoItemRegion = cellFormationRegion("region-1", 1, [twoItemIntersection], [twoItemCell]);
  const { cellTextEvidences: twoItemEvidences } = formRegionCellTextEvidences(twoItemRegion, twoItemStructurePage, twoItemPage, CONTEXT);
  if (!validateTextItemOccurrenceConservation(twoItemRegion, twoItemStructurePage, twoItemPage, twoItemEvidences)) throw new Error("valid two-item fixture unexpectedly failed gate 3");

  const swapped = twoItemEvidences.map((entry) => {
    const outcome = entry.segmentOutcomes[0];
    if (outcome.status !== "resolved") return entry;
    const [first, second] = outcome.itemDispositions;
    const swappedDispositions: PhysicalCellTextItemDisposition[] = [{ ...first, textItemIndex: second.textItemIndex }, { ...second, textItemIndex: first.textItemIndex }];
    return { ...entry, segmentOutcomes: [{ ...outcome, itemDispositions: swappedDispositions }] };
  });
  if (validateTextItemOccurrenceConservation(twoItemRegion, twoItemStructurePage, twoItemPage, swapped)) throw new Error("gate 3 did not reject two textItemIndex values swapped between positions");

  const wrongStatusForValidOccurrence = twoItemEvidences.map((entry) => {
    const outcome = entry.segmentOutcomes[0];
    if (outcome.status !== "resolved") return entry;
    const [first, ...rest] = outcome.itemDispositions;
    const corrupted: PhysicalCellTextItemDisposition = { status: "unresolved_source_text_item_reference_invalid", segmentKey: first.segmentKey, sourceReferenceOrder: first.sourceReferenceOrder, textItemIndex: first.textItemIndex };
    return { ...entry, segmentOutcomes: [{ ...outcome, itemDispositions: [corrupted, ...rest] }] };
  });
  if (validateTextItemOccurrenceConservation(twoItemRegion, twoItemStructurePage, twoItemPage, wrongStatusForValidOccurrence)) throw new Error("gate 3 did not reject a disposition claiming failure for an occurrence that is genuinely resolvable");

  // Segmento com item pertencente a outro segmento, para testar actualOwningSegmentKey adulterado.
  const mismatchPage = physicalPage(1, [physicalItem(20, "owned-elsewhere")]);
  const segOwner = structureSegment("seg-owner", "line-3", 1, 1, [20]);
  const segClaimer = structureSegment("seg-claimer", "line-3", 1, 2, [20]);
  const mismatchStructurePage = buildStructurePage(1, [structureLine("line-3", 1, ["seg-owner", "seg-claimer"])], [segOwner, segClaimer], [placedOutcome(20, "line-3", "seg-owner")]);
  const mismatchIntersection = gridIntersection("gi-mismatch", "line-3", 1, 1, "cell-mismatch", 1, "region-1");
  const mismatchCell = cellHypothesis("cell-mismatch", "gi-mismatch", ["seg-claimer"]);
  const mismatchRegion = cellFormationRegion("region-1", 1, [mismatchIntersection], [mismatchCell]);
  const { cellTextEvidences: mismatchEvidences } = formRegionCellTextEvidences(mismatchRegion, mismatchStructurePage, mismatchPage, CONTEXT);
  if (!validateTextItemOccurrenceConservation(mismatchRegion, mismatchStructurePage, mismatchPage, mismatchEvidences)) throw new Error("valid segment-mismatch fixture unexpectedly failed gate 3");
  const wrongOwner = mismatchEvidences.map((entry) => {
    const outcome = entry.segmentOutcomes[0];
    if (outcome.status !== "resolved") return entry;
    const disposition = outcome.itemDispositions[0];
    if (disposition.status !== "unresolved_source_text_item_segment_mismatch") throw new Error("test setup did not produce a genuine segment mismatch");
    const corrupted: PhysicalCellTextItemDisposition = { ...disposition, actualOwningSegmentKey: "seg-invented" };
    return { ...entry, segmentOutcomes: [{ ...outcome, itemDispositions: [corrupted] }] };
  });
  if (validateTextItemOccurrenceConservation(mismatchRegion, mismatchStructurePage, mismatchPage, wrongOwner)) throw new Error("gate 3 did not reject an adulterated actualOwningSegmentKey");

  // Duplicidade regional entre duas células, para testar conflictingReferences incompleta e marcação assimétrica.
  const duplicatePage = physicalPage(1, [physicalItem(30, "shared")]);
  const segShareA = structureSegment("seg-share-a", "line-4", 1, 1, [30]);
  const segShareB = structureSegment("seg-share-b", "line-5", 1, 1, [30]);
  const duplicateStructurePage = buildStructurePage(1, [structureLine("line-4", 1, ["seg-share-a"]), structureLine("line-5", 1, ["seg-share-b"])], [segShareA, segShareB], [placedOutcome(30, "line-4", "seg-share-a")]);
  const duplicateIntersectionA = gridIntersection("gi-share-a", "line-4", 1, 1, "cell-share-a", 1, "region-1");
  const duplicateIntersectionB = gridIntersection("gi-share-b", "line-5", 2, 1, "cell-share-b", 1, "region-1");
  const duplicateCellA = cellHypothesis("cell-share-a", "gi-share-a", ["seg-share-a"]);
  const duplicateCellB = cellHypothesis("cell-share-b", "gi-share-b", ["seg-share-b"]);
  const duplicateRegion = cellFormationRegion("region-1", 1, [duplicateIntersectionA, duplicateIntersectionB], [duplicateCellA, duplicateCellB]);
  const { cellTextEvidences: duplicateEvidences } = formRegionCellTextEvidences(duplicateRegion, duplicateStructurePage, duplicatePage, CONTEXT);
  if (!validateTextItemOccurrenceConservation(duplicateRegion, duplicateStructurePage, duplicatePage, duplicateEvidences)) throw new Error("valid duplicate fixture unexpectedly failed gate 3");

  const incompleteConflicts = duplicateEvidences.map((entry) => {
    const outcome = entry.segmentOutcomes[0];
    if (outcome.status !== "resolved") return entry;
    const disposition = outcome.itemDispositions[0];
    if (disposition.status !== "unresolved_source_text_item_duplicate_reference") throw new Error("test setup did not produce a genuine regional duplicate");
    return { ...entry, segmentOutcomes: [{ ...outcome, itemDispositions: [{ ...disposition, conflictingReferences: [] }] }] };
  });
  if (validateTextItemOccurrenceConservation(duplicateRegion, duplicateStructurePage, duplicatePage, incompleteConflicts)) throw new Error("gate 3 did not reject an incomplete conflictingReferences list");

  const asymmetricDuplicate = duplicateEvidences.map((entry) => {
    if (entry.cellHypothesisKey !== "cell-share-a") return entry;
    const outcome = entry.segmentOutcomes[0];
    if (outcome.status !== "resolved") return entry;
    const disposition = outcome.itemDispositions[0];
    if (disposition.status !== "unresolved_source_text_item_duplicate_reference") throw new Error("test setup did not produce a genuine regional duplicate");
    const wronglyIncluded: PhysicalCellTextItemDisposition = { status: "included_in_text_fragment", segmentKey: disposition.segmentKey, sourceReferenceOrder: disposition.sourceReferenceOrder, textItemIndex: disposition.textItemIndex };
    return { ...entry, segmentOutcomes: [{ ...outcome, fragments: [{ sourceReferenceOrder: disposition.sourceReferenceOrder, textItemIndex: disposition.textItemIndex, originalText: "shared", normalizedText: "shared" }], itemDispositions: [wronglyIncluded] }] };
  });
  if (validateTextItemOccurrenceConservation(duplicateRegion, duplicateStructurePage, duplicatePage, asymmetricDuplicate)) throw new Error("gate 3 did not reject marking only one of two conflicting occurrences as duplicate");

  console.log("ok - gate 3 rejects occurrence count mismatch, swapped indices, wrong status for a valid occurrence, adulterated actualOwningSegmentKey, incomplete conflictingReferences, and asymmetric duplicate marking");
}

// --- Portão 4: fragmento ↔ disposição -----------------------------------------
{
  const tamperedText = replaceCellASegment(cellTextEvidences, { fragments: cellTextEvidences.find((entry) => entry.cellHypothesisKey === "cell-a")!.segmentOutcomes.flatMap((outcome) => (outcome.status === "resolved" ? outcome.fragments.map((fragment) => ({ ...fragment, originalText: "tampered" })) : [])) });
  if (validateFragmentDispositionConservation(tamperedText, page)) throw new Error("gate 4 did not reject a fragment whose originalText diverges from the real physical item");

  const noFragment = replaceCellASegment(cellTextEvidences, { fragments: [] });
  if (validateFragmentDispositionConservation(noFragment, page)) throw new Error("gate 4 did not reject an included_in_text_fragment disposition with no matching fragment");

  const originalCellAOutcome = cellTextEvidences.find((entry) => entry.cellHypothesisKey === "cell-a")!.segmentOutcomes[0] as ResolvedPhysicalCellTextSegmentOutcome;
  const extraFragment = replaceCellASegment(cellTextEvidences, { fragments: [...originalCellAOutcome.fragments, { sourceReferenceOrder: 99, textItemIndex: 99, originalText: "ghost", normalizedText: "ghost" }] });
  if (validateFragmentDispositionConservation(extraFragment, page)) throw new Error("gate 4 did not reject a fragment with no corresponding disposition");

  const duplicatedFragment = replaceCellASegment(cellTextEvidences, { fragments: [...originalCellAOutcome.fragments, ...originalCellAOutcome.fragments] });
  if (validateFragmentDispositionConservation(duplicatedFragment, page)) throw new Error("gate 4 did not reject two duplicate fragments for the same occurrence");

  const duplicatedDisposition = replaceCellASegment(cellTextEvidences, { itemDispositions: [...originalCellAOutcome.itemDispositions, ...originalCellAOutcome.itemDispositions] });
  if (validateFragmentDispositionConservation(duplicatedDisposition, page)) throw new Error("gate 4 did not reject two duplicate included_in_text_fragment dispositions for the same occurrence");

  console.log("ok - gate 4 rejects divergent text, a disposition without a fragment, a fragment without a disposition, and duplicate identities on either side");
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
