import type { ColumnSignatureSignalOutcome, HorizontalGeometrySignalOutcome } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import { classifyMeritSignals, deriveGlobalStatus } from "./page-boundary-neutral-continuity-evaluation-classifiers";

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const D: ReadonlyArray<ColumnSignatureSignalOutcome> = ["column_signature_match", "column_signature_mismatch", "column_signature_inconclusive"];
const E: ReadonlyArray<HorizontalGeometrySignalOutcome> = ["geometry_compatible", "geometry_incompatible", "geometry_inconclusive"];

/**
 * Matriz de verdade completa (3x3 = 9 combinações) da classificação de
 * mérito (§4): qualquer contrária presente → not_sustained; ambas
 * favoráveis e nenhuma contrária → sustained; demais sem contrária →
 * ambiguous.
 */
const expected: Record<string, "continuity_sustained" | "continuity_ambiguous" | "continuity_not_sustained"> = {
  "column_signature_match|geometry_compatible": "continuity_sustained",
  "column_signature_match|geometry_incompatible": "continuity_not_sustained",
  "column_signature_match|geometry_inconclusive": "continuity_ambiguous",
  "column_signature_mismatch|geometry_compatible": "continuity_not_sustained",
  "column_signature_mismatch|geometry_incompatible": "continuity_not_sustained",
  "column_signature_mismatch|geometry_inconclusive": "continuity_not_sustained",
  "column_signature_inconclusive|geometry_compatible": "continuity_ambiguous",
  "column_signature_inconclusive|geometry_incompatible": "continuity_not_sustained",
  "column_signature_inconclusive|geometry_inconclusive": "continuity_ambiguous",
};

for (const d of D) {
  for (const e of E) {
    const result = classifyMeritSignals(d, e);
    equal(result.status, expected[`${d}|${e}`], `classification mismatch for D=${d}, E=${e}`);
  }
}

// Evidência: favorável apenas quando match/compatible; contrária apenas quando mismatch/incompatible; nunca para inconclusivo.
const sustained = classifyMeritSignals("column_signature_match", "geometry_compatible");
equal(sustained.favorableEvidence.length, 2, "sustained must carry exactly two favorable evidence entries");
equal(sustained.contraryEvidence.length, 0, "sustained must carry zero contrary evidence entries");

const inconclusiveBoth = classifyMeritSignals("column_signature_inconclusive", "geometry_inconclusive");
equal(inconclusiveBoth.favorableEvidence.length, 0, "inconclusive signals must never produce favorable evidence");
equal(inconclusiveBoth.contraryEvidence.length, 0, "inconclusive signals must never produce contrary evidence");

const oneContraryOneFavorable = classifyMeritSignals("column_signature_match", "geometry_incompatible");
equal(oneContraryOneFavorable.favorableEvidence.length, 1, "one favorable when only D is favorable");
equal(oneContraryOneFavorable.contraryEvidence.length, 1, "one contrary when only E is contrary — contrary dominates the status regardless");
equal(oneContraryOneFavorable.favorableEvidence[0].evidence, "matching_column_signature", "favorable evidence code must match the favorable signal");
equal(oneContraryOneFavorable.contraryEvidence[0].evidence, "incompatible_horizontal_geometry", "contrary evidence code must match the contrary signal");

// --- status global -------------------------------------------------------------

const noProblems = deriveGlobalStatus(0, [{ status: "continuity_sustained" }, { status: "continuity_not_processable" }], 0);
equal(noProblems, "evaluated", "no incoherent groups, no failed evaluations, no global problems must derive 'evaluated'");

const withIncoherentGroup = deriveGlobalStatus(1, [{ status: "continuity_sustained" }], 0);
equal(withIncoherentGroup, "evaluated_with_problems", "any incoherent group must derive 'evaluated_with_problems'");

const withFailedEvaluation = deriveGlobalStatus(0, [{ status: "continuity_evaluation_failed" }], 0);
equal(withFailedEvaluation, "evaluated_with_problems", "any continuity_evaluation_failed evaluation must derive 'evaluated_with_problems'");

const withGlobalProblem = deriveGlobalStatus(0, [{ status: "continuity_sustained" }], 1);
equal(withGlobalProblem, "evaluated_with_problems", "any global technical problem (e.g. conservation failure) must derive 'evaluated_with_problems'");

console.log("ok - full 3x3 merit classification truth table (D x E), evidence presence/absence per cell, contrary dominance over favorable, and global status derivation across all three problem sources (incoherent group, failed evaluation, global technical problem)");
