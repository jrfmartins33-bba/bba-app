import { buildStructurePage, cellFormationRegion, cellHypothesis, gridIntersection, physicalItem, physicalPage, placedOutcome, structureLine, structureSegment } from "./testing/physical-cell-text-evidence-formation-fixture-builders";
import { buildEligibleTextItemOccurrences, deriveRegionCellSegmentDrafts, formRegionCellTextEvidences } from "./physical-cell-text-segment-formation";
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

// --- Portão 2: rederivação completa de cada outcome não-resolved -------------
{
  function replaceCellAFirstOutcome(outcome: unknown) {
    return replaceCellA(cellTextEvidences, { segmentOutcomes: [outcome as never] });
  }

  const validAsInvalid = replaceCellAFirstOutcome({ status: "unresolved_segment_reference_invalid", segmentKey: "seg-a" });
  if (validateSegmentOutcomeConservation(region, structurePage, validAsInvalid)) throw new Error("gate 2 did not reject a genuinely resolvable segment published as unresolved_segment_reference_invalid");

  // segmento inexistente publicado como resolved
  const ghostIntersection = gridIntersection("gi-ghost", "line-1", 1, 3, "cell-ghost", 1, "region-1");
  const ghostCell = cellHypothesis("cell-ghost", "gi-ghost", ["seg-missing"]);
  const ghostRegion = cellFormationRegion("region-1", 1, [ghostIntersection], [ghostCell]);
  const { cellTextEvidences: ghostEvidences } = formRegionCellTextEvidences(ghostRegion, structurePage, page, CONTEXT);
  if (ghostEvidences[0].segmentOutcomes[0]?.status !== "unresolved_segment_reference_invalid") throw new Error("test setup did not produce a genuine reference_invalid segment");
  const ghostFabricatedResolved = ghostEvidences.map((entry) => ({ ...entry, segmentOutcomes: [{ status: "resolved" as const, segmentKey: "seg-missing", lineKey: "line-1", fragments: [], itemDispositions: [] }] }));
  if (validateSegmentOutcomeConservation(ghostRegion, structurePage, ghostFabricatedResolved)) throw new Error("gate 2 did not reject a nonexistent segmentKey published as resolved");

  // reason trocado, expectedLineKey/actualLineKey adulterados (fixture line_mismatch)
  const lmPage = physicalPage(1, [physicalItem(0, "x")]);
  const lmStructurePage = buildStructurePage(1, [structureLine("line-2", 1, ["seg-lm"])], [structureSegment("seg-lm", "line-2", 1, 1, [0])], [placedOutcome(0, "line-2", "seg-lm")]);
  const lmIntersection = gridIntersection("gi-lm", "line-1", 1, 1, "cell-lm", 1, "region-1");
  const lmCell = cellHypothesis("cell-lm", "gi-lm", ["seg-lm"]);
  const lmRegion = cellFormationRegion("region-1", 1, [lmIntersection], [lmCell]);
  const { cellTextEvidences: lmEvidences } = formRegionCellTextEvidences(lmRegion, lmStructurePage, lmPage, CONTEXT);
  if (lmEvidences[0].segmentOutcomes[0]?.status !== "unresolved_segment_incompatible") throw new Error("test setup did not produce a genuine line_mismatch");

  const reasonSwapped = lmEvidences.map((entry) => ({ ...entry, segmentOutcomes: [{ status: "unresolved_segment_incompatible" as const, reason: "page_mismatch" as const, segmentKey: "seg-lm", expectedPageNumber: 1, actualPageNumber: 2 }] }));
  if (validateSegmentOutcomeConservation(lmRegion, lmStructurePage, reasonSwapped)) throw new Error("gate 2 did not reject a swapped incompatibility reason (line_mismatch published as page_mismatch)");

  const expectedLineTampered = lmEvidences.map((entry) => ({ ...entry, segmentOutcomes: [{ status: "unresolved_segment_incompatible" as const, reason: "line_mismatch" as const, segmentKey: "seg-lm", expectedLineKey: "line-ghost", actualLineKey: "line-2" }] }));
  if (validateSegmentOutcomeConservation(lmRegion, lmStructurePage, expectedLineTampered)) throw new Error("gate 2 did not reject an adulterated expectedLineKey");

  const actualLineTampered = lmEvidences.map((entry) => ({ ...entry, segmentOutcomes: [{ status: "unresolved_segment_incompatible" as const, reason: "line_mismatch" as const, segmentKey: "seg-lm", expectedLineKey: "line-1", actualLineKey: "line-ghost" }] }));
  if (validateSegmentOutcomeConservation(lmRegion, lmStructurePage, actualLineTampered)) throw new Error("gate 2 did not reject an adulterated actualLineKey");

  // página adulterada (fixture page_mismatch)
  const pmPage = physicalPage(1, [physicalItem(0, "x")]);
  const pmStructurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-pm"])], [structureSegment("seg-pm", "line-1", 2, 1, [0])], [placedOutcome(0, "line-1", "seg-pm")]);
  const pmIntersection = gridIntersection("gi-pm", "line-1", 1, 1, "cell-pm", 1, "region-1");
  const pmCell = cellHypothesis("cell-pm", "gi-pm", ["seg-pm"]);
  const pmRegion = cellFormationRegion("region-1", 1, [pmIntersection], [pmCell]);
  const { cellTextEvidences: pmEvidences } = formRegionCellTextEvidences(pmRegion, pmStructurePage, pmPage, CONTEXT);
  if (pmEvidences[0].segmentOutcomes[0]?.status !== "unresolved_segment_incompatible") throw new Error("test setup did not produce a genuine page_mismatch");
  const pageTampered = pmEvidences.map((entry) => ({ ...entry, segmentOutcomes: [{ status: "unresolved_segment_incompatible" as const, reason: "page_mismatch" as const, segmentKey: "seg-pm", expectedPageNumber: 1, actualPageNumber: 99 }] }));
  if (validateSegmentOutcomeConservation(pmRegion, pmStructurePage, pageTampered)) throw new Error("gate 2 did not reject an adulterated actualPageNumber");

  // conflictingCellHypothesisKeys incompleta (fixture referenced_by_multiple_cell_hypotheses)
  const mcPage = physicalPage(1, [physicalItem(0, "x")]);
  const mcStructurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-mc"])], [structureSegment("seg-mc", "line-1", 1, 1, [0])], [placedOutcome(0, "line-1", "seg-mc")]);
  const mcIntersectionA = gridIntersection("gi-mc-a", "line-1", 1, 1, "cell-mc-a", 1, "region-1");
  const mcIntersectionB = gridIntersection("gi-mc-b", "line-1", 1, 2, "cell-mc-b", 1, "region-1");
  const mcCellA = cellHypothesis("cell-mc-a", "gi-mc-a", ["seg-mc"]);
  const mcCellB = cellHypothesis("cell-mc-b", "gi-mc-b", ["seg-mc"]);
  const mcRegion = cellFormationRegion("region-1", 1, [mcIntersectionA, mcIntersectionB], [mcCellA, mcCellB]);
  const { cellTextEvidences: mcEvidences } = formRegionCellTextEvidences(mcRegion, mcStructurePage, mcPage, CONTEXT);
  const incompleteConflict = mcEvidences.map((entry) => ({ ...entry, segmentOutcomes: [{ status: "unresolved_segment_incompatible" as const, reason: "referenced_by_multiple_cell_hypotheses" as const, segmentKey: "seg-mc", conflictingCellHypothesisKeys: [entry.cellHypothesisKey] }] }));
  if (validateSegmentOutcomeConservation(mcRegion, mcStructurePage, incompleteConflict)) throw new Error("gate 2 did not reject an incomplete conflictingCellHypothesisKeys");

  // failedPhase incorreta (fixture de ordem inválida)
  const oiPage = physicalPage(1, [physicalItem(0, "x"), physicalItem(1, "y")]);
  const oiSegA = structureSegment("seg-oi-a", "line-1", 1, 1, [0]);
  const oiSegB = structureSegment("seg-oi-b", "line-1", 1, 2, [1]);
  const oiStructurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-oi-a", "seg-oi-b"])], [oiSegA, oiSegB], [placedOutcome(0, "line-1", "seg-oi-a"), placedOutcome(1, "line-1", "seg-oi-b")]);
  const oiIntersection = gridIntersection("gi-oi", "line-1", 1, 1, "cell-oi", 1, "region-1");
  const oiCell = cellHypothesis("cell-oi", "gi-oi", ["seg-oi-b", "seg-oi-a"]);
  const oiRegion = cellFormationRegion("region-1", 1, [oiIntersection], [oiCell]);
  const { cellTextEvidences: oiEvidences } = formRegionCellTextEvidences(oiRegion, oiStructurePage, oiPage, CONTEXT);
  const wrongPhase = oiEvidences.map((entry) => ({ ...entry, segmentOutcomes: entry.segmentOutcomes.map((outcome) => (outcome.status === "unresolved_segment_formation_failed" ? { ...outcome, failedPhase: "text_item_resolution" as const } : outcome)) }));
  if (validateSegmentOutcomeConservation(oiRegion, oiStructurePage, wrongPhase)) throw new Error("gate 2 did not reject an incorrect failedPhase for an order-invalid cell");
  // Uma forma que nem sequer é um substituto uniforme (failedPhase
  // divergente entre os dois segmentos da mesma célula) não pode ser
  // resgatada mesmo que o chamador afirme (falsamente) que se trata do
  // substituto de falha regional — a reconfirmação estrutural exige
  // failedPhase idêntica em toda a região.
  const mixedPhase = oiEvidences.map((entry) => ({ ...entry, segmentOutcomes: entry.segmentOutcomes.map((outcome, index) => (outcome.status === "unresolved_segment_formation_failed" && index === 0 ? { ...outcome, failedPhase: "text_item_resolution" as const } : outcome)) }));
  if (validateSegmentOutcomeConservation(oiRegion, oiStructurePage, mixedPhase, true)) throw new Error("gate 2 did not reject a non-uniform failedPhase even when the caller claims the whole-region substitute");

  console.log("ok - gate 2 fully rederives every non-resolved outcome: rejects a valid segment published as failed, a nonexistent segment published as resolved, a swapped reason, adulterated line/page fields, an incomplete conflict list, and an incorrect failedPhase — even when a fabricated substitute claim is attached");
}

// --- Portão 2: o sinalizador de substituto regional é confiável, nunca a forma sozinha --
{
  // Uma célula única com ordem inválida produz exatamente a mesma forma
  // superficial (unresolved_technical_failure / unresolved_segment_formation_failed)
  // que um substituto de falha regional de uma única célula — a diferença
  // objetiva está apenas na failedPhase ("segment_resolution" vs
  // "text_item_resolution"/"fragment_assembly"). Sem o sinalizador explícito
  // do chamador, o Portão 2 rederiva pela precedência normal e aceita a
  // forma de ordem inválida legítima (flag false); com o sinalizador
  // (produzido de fato pelo orquestrador via buildFormationFailedSubstitute,
  // nunca aqui fabricado), aceita a forma de substituto legítima.
  const oiPage2 = physicalPage(1, [physicalItem(0, "x"), physicalItem(1, "y")]);
  const oiSegA2 = structureSegment("seg-oi2-a", "line-1", 1, 1, [0]);
  const oiSegB2 = structureSegment("seg-oi2-b", "line-1", 1, 2, [1]);
  const oiStructurePage2 = buildStructurePage(1, [structureLine("line-1", 1, ["seg-oi2-a", "seg-oi2-b"])], [oiSegA2, oiSegB2], [placedOutcome(0, "line-1", "seg-oi2-a"), placedOutcome(1, "line-1", "seg-oi2-b")]);
  const oiIntersection2 = gridIntersection("gi-oi2", "line-1", 1, 1, "cell-oi2", 1, "region-1");
  const oiCell2 = cellHypothesis("cell-oi2", "gi-oi2", ["seg-oi2-b", "seg-oi2-a"]);
  const oiRegion2 = cellFormationRegion("region-1", 1, [oiIntersection2], [oiCell2]);
  const { cellTextEvidences: oiEvidences2 } = formRegionCellTextEvidences(oiRegion2, oiStructurePage2, oiPage2, CONTEXT);
  if (!validateSegmentOutcomeConservation(oiRegion2, oiStructurePage2, oiEvidences2, false)) throw new Error("gate 2 rejected a genuine order-invalid cell when the substitute flag is correctly false");

  const genuineSubstitute = oiEvidences2.map((entry) => ({ ...entry, segmentOutcomes: entry.segmentOutcomes.map((outcome) => (outcome.status === "unresolved_segment_formation_failed" ? { ...outcome, failedPhase: "fragment_assembly" as const } : outcome)) }));
  if (!validateSegmentOutcomeConservation(oiRegion2, oiStructurePage2, genuineSubstitute, true)) throw new Error("gate 2 rejected a genuinely uniform whole-region substitute when the caller correctly asserts the flag");

  console.log("ok - gate 2 trusts only the caller-asserted substitute flag, reconfirmed structurally — never inferring substitution from shape alone");
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

// --- Portão 3: população elegível alinhada à formação -------------------------
{
  // Célula com segmento válido e outra célula com segmento incompatível, ambos
  // apontando para o mesmo textItemIndex: o segmento incompatível nunca deve
  // entrar na população elegível, então o segmento válido nunca deve ser
  // marcado como duplicado.
  const sharedPage = physicalPage(1, [physicalItem(0, "shared-text")]);
  const validSeg = structureSegment("seg-valid", "line-1", 1, 1, [0]);
  const incompatibleSeg = structureSegment("seg-incompatible", "line-2", 1, 1, [0]);
  const sharedStructurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-valid"]), structureLine("line-2", 1, ["seg-incompatible"])], [validSeg, incompatibleSeg], [placedOutcome(0, "line-1", "seg-valid")]);
  const validIntersection = gridIntersection("gi-valid", "line-1", 1, 1, "cell-valid", 1, "region-1");
  const incompatibleIntersection = gridIntersection("gi-incompatible", "line-1", 2, 1, "cell-incompatible", 1, "region-1"); // espera line-1; o segmento real pertence a line-2
  const validCell = cellHypothesis("cell-valid", "gi-valid", ["seg-valid"]);
  const incompatibleCell = cellHypothesis("cell-incompatible", "gi-incompatible", ["seg-incompatible"]);
  const sharedRegion = cellFormationRegion("region-1", 1, [validIntersection, incompatibleIntersection], [validCell, incompatibleCell]);
  const { cellTextEvidences: sharedEvidences } = formRegionCellTextEvidences(sharedRegion, sharedStructurePage, sharedPage, CONTEXT);

  const validEvidence = sharedEvidences.find((entry) => entry.cellHypothesisKey === "cell-valid")!;
  const validOutcome = validEvidence.segmentOutcomes[0];
  if (validOutcome.status !== "resolved" || validOutcome.itemDispositions[0]?.status !== "included_in_text_fragment") {
    throw new Error("an incompatible segment sharing the same textItemIndex must never falsely mark the valid segment's item as a regional duplicate");
  }
  const incompatibleEvidence = sharedEvidences.find((entry) => entry.cellHypothesisKey === "cell-incompatible")!;
  const incompatibleOutcome = incompatibleEvidence.segmentOutcomes[0];
  if (incompatibleOutcome.status !== "unresolved_segment_incompatible" || incompatibleOutcome.reason !== "line_mismatch") throw new Error("test setup did not produce a genuine incompatible segment");

  if (!validateCellHypothesisConservation(sharedRegion, sharedEvidences)) throw new Error("gate 1 rejected the valid mixed-eligibility fixture");
  if (!validateSegmentOutcomeConservation(sharedRegion, sharedStructurePage, sharedEvidences)) throw new Error("gate 2 rejected the valid mixed-eligibility fixture");
  if (!validateTextItemOccurrenceConservation(sharedRegion, sharedStructurePage, sharedPage, sharedEvidences)) throw new Error("gate 3 rejected the valid mixed-eligibility fixture");
  if (!validateFragmentDispositionConservation(sharedEvidences, sharedPage)) throw new Error("gate 4 rejected the valid mixed-eligibility fixture");
  const sharedMetrics = computeRegionMetrics(sharedRegion.cellHypotheses.length, sharedEvidences, 0);
  if (!validateMetricCategoryConservation(sharedRegion.cellHypotheses.length, sharedEvidences, sharedMetrics)) throw new Error("gate 5 rejected the valid mixed-eligibility fixture");

  // Segmento reivindicado por múltiplas células nunca entra na população elegível.
  const claimPage = physicalPage(1, [physicalItem(0, "claimed")]);
  const claimSeg = structureSegment("seg-claimed", "line-1", 1, 1, [0]);
  const claimStructurePage = buildStructurePage(1, [structureLine("line-1", 1, ["seg-claimed"])], [claimSeg], [placedOutcome(0, "line-1", "seg-claimed")]);
  const claimIntersectionA = gridIntersection("gi-claim-a", "line-1", 1, 1, "cell-claim-a", 1, "region-1");
  const claimIntersectionB = gridIntersection("gi-claim-b", "line-1", 1, 2, "cell-claim-b", 1, "region-1");
  const claimCellA = cellHypothesis("cell-claim-a", "gi-claim-a", ["seg-claimed"]);
  const claimCellB = cellHypothesis("cell-claim-b", "gi-claim-b", ["seg-claimed"]);
  const claimRegion = cellFormationRegion("region-1", 1, [claimIntersectionA, claimIntersectionB], [claimCellA, claimCellB]);
  const claimOccurrences = buildEligibleTextItemOccurrences(deriveRegionCellSegmentDrafts(claimRegion, claimStructurePage));
  if (claimOccurrences.some((entry) => entry.segmentKey === "seg-claimed")) throw new Error("a segment claimed by two cell hypotheses must never enter the eligible textual population");
  const { cellTextEvidences: claimEvidences } = formRegionCellTextEvidences(claimRegion, claimStructurePage, claimPage, CONTEXT);
  if (!validateTextItemOccurrenceConservation(claimRegion, claimStructurePage, claimPage, claimEvidences)) throw new Error("gate 3 rejected the valid multiple-claim fixture");

  console.log("ok - gate 3's eligible population is exactly the formation's population: an incompatible segment sharing a textItemIndex with a valid segment, and a segment claimed by two cells, never enter it");
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
