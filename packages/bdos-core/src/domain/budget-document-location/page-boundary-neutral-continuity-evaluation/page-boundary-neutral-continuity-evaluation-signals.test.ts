import {
  evaluateBoundaryLineExistence,
  evaluateBoundaryRegionExistence,
  evaluateColumnSignatureCompatibility,
  evaluateHorizontalGeometryCompatibility,
  evaluatePageProcessability,
} from "./page-boundary-neutral-continuity-evaluation-signals";
import { lineFixture, pageFixture, positionFixture, regionCandidateFixture } from "./testing/page-boundary-neutral-continuity-evaluation-fixture-builders";

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// --- Sinal A: processabilidade de página ---------------------------------------

const structuredPage = pageFixture(1, "structured", []);
const notProcessablePage = pageFixture(2, "upstream_not_processable", []);

equal(evaluatePageProcessability(structuredPage, structuredPage).outcome, "both_pages_processable", "two processable pages");
equal(evaluatePageProcessability(notProcessablePage, structuredPage).outcome, "origin_page_not_processable", "not-processable origin only");
equal(evaluatePageProcessability(structuredPage, notProcessablePage).outcome, "target_page_not_processable", "not-processable target only");
equal(evaluatePageProcessability(notProcessablePage, notProcessablePage).outcome, "both_pages_not_processable", "both not processable");

// --- Sinal B/C: existência (wrappers de flags) ---------------------------------

equal(evaluateBoundaryRegionExistence(false, false).outcome, "both_boundary_regions_available", "both available");
equal(evaluateBoundaryRegionExistence(true, false).outcome, "origin_boundary_region_missing", "origin missing");
equal(evaluateBoundaryRegionExistence(false, true).outcome, "target_boundary_region_missing", "target missing");
equal(evaluateBoundaryRegionExistence(true, true).outcome, "both_boundary_regions_missing", "both missing");

equal(evaluateBoundaryLineExistence(false, false).outcome, "both_boundary_lines_available", "both available");
equal(evaluateBoundaryLineExistence(true, true).outcome, "both_boundary_lines_missing", "both missing");

// --- Sinal D: assinatura de colunas (comparação exata, sem threshold) ---------

const positionsOf = (columnOrders: ReadonlyArray<number>, pageNumber: number, lineKey: string) =>
  columnOrders.map((columnOrder, index) => positionFixture(`gi-${lineKey}-${index}`, lineKey, 1, columnOrder, pageNumber, "R"));

const lineWith = (columnOrders: ReadonlyArray<number>, key: string, pageNumber: number) => lineFixture(key, pageNumber, 1, "structured", positionsOf(columnOrders, pageNumber, key));

const matchD = evaluateColumnSignatureCompatibility(lineWith([1, 2], "La", 1), lineWith([1, 2], "Lb", 2));
equal(matchD.outcome, "column_signature_match", "identical columnOrder sequences must match");

const mismatchDifferentValue = evaluateColumnSignatureCompatibility(lineWith([1, 2], "La", 1), lineWith([1, 3], "Lb", 2));
equal(mismatchDifferentValue.outcome, "column_signature_mismatch", "same length, different columnOrder value must mismatch");

const mismatchDifferentLength = evaluateColumnSignatureCompatibility(lineWith([1, 2], "La", 1), lineWith([1, 2, 3], "Lb", 2));
equal(mismatchDifferentLength.outcome, "column_signature_mismatch", "different position count must mismatch, never inconclusive");

const inconclusiveEmptyOrigin = evaluateColumnSignatureCompatibility(lineWith([], "La", 1), lineWith([1, 2], "Lb", 2));
equal(inconclusiveEmptyOrigin.outcome, "column_signature_inconclusive", "an empty origin line must be inconclusive, never mismatch");

const inconclusiveEmptyTarget = evaluateColumnSignatureCompatibility(lineWith([1, 2], "La", 1), lineWith([], "Lb", 2));
equal(inconclusiveEmptyTarget.outcome, "column_signature_inconclusive", "an empty target line must be inconclusive");

// --- Sinal E: compatibilidade geométrica horizontal (perfil v1: 0.85/0.90/0.05/0.05) ---

const origin = regionCandidateFixture("RO", 1, 1, [], { leftPoints: 0, rightPoints: 100, widthPoints: 100 });

const identical = regionCandidateFixture("RT1", 2, 1, [], { leftPoints: 0, rightPoints: 100, widthPoints: 100 });
equal(evaluateHorizontalGeometryCompatibility(origin, identical).outcome, "geometry_compatible", "identical geometry must be compatible");

const atLeftThreshold = regionCandidateFixture("RT2", 2, 1, [], { leftPoints: 5, rightPoints: 105, widthPoints: 100 });
equal(evaluateHorizontalGeometryCompatibility(origin, atLeftThreshold).outcome, "geometry_compatible", "deviation exactly at the 0.05 threshold must still be compatible (<=, not <)");

const isolatedLeftOverThreshold = regionCandidateFixture("RT3", 2, 1, [], { leftPoints: 5.01, rightPoints: 100, widthPoints: 100 });
const leftOver = evaluateHorizontalGeometryCompatibility(origin, isolatedLeftOverThreshold);
equal(leftOver.outcome, "geometry_incompatible", "left boundary deviation strictly over 0.05 must be incompatible");
equal(leftOver.leftBoundaryDeviationRatio !== null && leftOver.leftBoundaryDeviationRatio > 0.05, true, "reported leftBoundaryDeviationRatio must reflect the actual computed value");

const isolatedRightOverThreshold = regionCandidateFixture("RT4", 2, 1, [], { leftPoints: 0, rightPoints: 105.01, widthPoints: 100 });
equal(evaluateHorizontalGeometryCompatibility(origin, isolatedRightOverThreshold).outcome, "geometry_incompatible", "right boundary deviation strictly over 0.05 must be incompatible");

const lowOverlap = regionCandidateFixture("RT5", 2, 1, [], { leftPoints: 90, rightPoints: 190, widthPoints: 100 });
equal(evaluateHorizontalGeometryCompatibility(origin, lowOverlap).outcome, "geometry_incompatible", "horizontal overlap ratio below 0.85 must be incompatible");

const lowWidthSimilarity = regionCandidateFixture("RT6", 2, 1, [], { leftPoints: 0, rightPoints: 100, widthPoints: 80 });
equal(evaluateHorizontalGeometryCompatibility(origin, lowWidthSimilarity).outcome, "geometry_incompatible", "width similarity ratio below 0.90 must be incompatible");

const degenerateWidth = regionCandidateFixture("RT7", 2, 1, [], { leftPoints: 0, rightPoints: 100, widthPoints: 0 });
const inconclusiveGeometry = evaluateHorizontalGeometryCompatibility(origin, degenerateWidth);
equal(inconclusiveGeometry.outcome, "geometry_inconclusive", "a degenerate (zero or negative) minimum width must be inconclusive, never a division by zero");
equal(inconclusiveGeometry.horizontalOverlapRatio, null, "inconclusive geometry must report null ratios, never a garbage number");

// --- Sinal E: geometria não finita (NaN/Infinity) nunca vira geometry_incompatible ---

function assertAllRatiosNull(outcome: ReturnType<typeof evaluateHorizontalGeometryCompatibility>, label: string): void {
  equal(outcome.outcome, "geometry_inconclusive", `${label}: must be geometry_inconclusive, never geometry_incompatible`);
  equal(outcome.horizontalOverlapRatio, null, `${label}: horizontalOverlapRatio must be null`);
  equal(outcome.widthSimilarityRatio, null, `${label}: widthSimilarityRatio must be null`);
  equal(outcome.leftBoundaryDeviationRatio, null, `${label}: leftBoundaryDeviationRatio must be null`);
  equal(outcome.rightBoundaryDeviationRatio, null, `${label}: rightBoundaryDeviationRatio must be null`);
}

const nanWidth = regionCandidateFixture("RT8", 2, 1, [], { leftPoints: 0, rightPoints: 100, widthPoints: NaN });
assertAllRatiosNull(evaluateHorizontalGeometryCompatibility(origin, nanWidth), "widthPoints = NaN");

const infiniteLeft = regionCandidateFixture("RT9", 2, 1, [], { leftPoints: Infinity, rightPoints: 100, widthPoints: 100 });
assertAllRatiosNull(evaluateHorizontalGeometryCompatibility(origin, infiniteLeft), "leftPoints = Infinity");

// Todas as seis entradas brutas são finitas, mas a magnitude extrema faz uma razão DERIVADA
// transbordar para Infinity (1e308 / 5e-324 excede Number.MAX_VALUE) — caso tecnicamente
// possível mesmo com entradas finitas, e por isso verificado separadamente da guarda de
// entrada bruta.
const extremeOrigin = regionCandidateFixture("RT10", 1, 1, [], { leftPoints: 0, rightPoints: 1e308, widthPoints: 1e308 });
const extremeTarget = regionCandidateFixture("RT11", 2, 1, [], { leftPoints: 0, rightPoints: 1e308, widthPoints: 5e-324 });
assertAllRatiosNull(evaluateHorizontalGeometryCompatibility(extremeOrigin, extremeTarget), "derived ratio overflow (finite inputs, non-finite result)");

console.log("ok - signal A (page processability, all four combinations), signal B/C (existence wrappers, all four combinations each), signal D (exact columnOrder sequence comparison — match/mismatch by value/mismatch by length/inconclusive on either empty side), signal E (identical geometry, exact threshold boundary for left/right deviation, strictly-over rejection, low overlap, low width similarity, degenerate width guarded as inconclusive)");
