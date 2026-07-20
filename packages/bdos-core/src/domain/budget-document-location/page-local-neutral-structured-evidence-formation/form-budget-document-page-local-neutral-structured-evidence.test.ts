import { formBudgetDocumentPageLocalNeutralStructuredEvidence } from "./form-budget-document-page-local-neutral-structured-evidence";
import { buildPageLocalNeutralStructuredEvidenceFormationInput } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";
import type { SyntheticGeometryPage } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";

const HEX_64 = /^[0-9a-f]{64}$/;
function cell(text: string, left: number, top: number) { return { text, leftPoints: left, topPoints: top, rightPoints: left + 40, bottomPoints: top + 10 }; }
function pageOf(prefix: string): SyntheticGeometryPage {
  const rows = [0, 1, 2, 3].map((r) => { const y = 100 + r * 20; return [cell(`${prefix}.${r + 1}`, 50, y), cell(`Servico ${r}`, 120, y), cell(`${r + 1}0,00`, 300, y)]; });
  return { widthPoints: 600, heightPoints: 800, items: rows.flat() };
}
const input = buildPageLocalNeutralStructuredEvidenceFormationInput("main", [pageOf("1"), pageOf("2"), pageOf("3")]);

const result = formBudgetDocumentPageLocalNeutralStructuredEvidence(input);

if (result.status !== "structured") throw new Error(`expected structured, got ${result.status}`);
if (!HEX_64.test(result.identityFingerprint)) throw new Error("identity fingerprint is not a canonical SHA-256 hex digest");
if (!HEX_64.test(result.resultFingerprint)) throw new Error("result fingerprint is not a canonical SHA-256 hex digest");
if (result.identityFingerprint === result.resultFingerprint) throw new Error("identity and result fingerprints must be distinct (identity excludes produced content)");
if (result.groups.length !== 1) throw new Error("expected one provenance group");
if (result.groups[0].pages.length !== 3) throw new Error("expected three pages");
if (!result.limitations.includes("neutral_structure_is_local_to_the_page")) throw new Error("page-local limitation must be declared");
if (!result.limitations.includes("no_cross_page_continuity_evaluated")) throw new Error("cross-page continuity limitation must be declared");
if (result.technicalProblems.length !== 0) throw new Error("a clean document must have no global technical problems");

// Identidades de origem preservadas isoladamente.
if (result.sourceStructureReconstructionContextFingerprint !== input.structureReconstruction.reconstructionContextFingerprint) throw new Error("structure fingerprint must be preserved");
if (result.sourceTabularRegionDetectionContextFingerprint !== input.tabularRegionDetection.detectionContextFingerprint) throw new Error("tabular fingerprint must be preserved");
if (result.sourcePhysicalCellHypothesisFormationContextFingerprint !== input.physicalCellHypothesisFormation.formationContextFingerprint) throw new Error("cell hypothesis fingerprint must be preserved");
if (result.sourcePhysicalCellTextEvidenceFormationContextFingerprint !== input.physicalCellTextEvidenceFormation.formationContextFingerprint) throw new Error("text evidence fingerprint must be preserved");
if (result.sourceByteHash !== input.structureReconstruction.sourceByteHash) throw new Error("sourceByteHash must be preserved");

// Determinismo total.
const again = formBudgetDocumentPageLocalNeutralStructuredEvidence(input);
if (JSON.stringify(result) !== JSON.stringify(again)) throw new Error("formation must be deterministic across identical runs");

// Cada célula documental reúne hipótese física + evidência textual materializadas por referência.
const anyCell = result.groups[0].pages[0].regions[0].documentLines.flatMap((line) => line.positions).find((p) => p.status === "cell_structured");
if (!anyCell || anyCell.status !== "cell_structured") throw new Error("a structured page must contain at least one cell position");
if (!anyCell.cell.sourceCellHypothesis || !anyCell.cell.sourceTextEvidence) throw new Error("a structured (non-failed) cell must always preserve both source objects");
if (anyCell.cell.sourceCellHypothesis.cellHypothesisKey !== anyCell.cell.cellHypothesisKey) throw new Error("cell must materialize its f.2c hypothesis by reference");
if (anyCell.cell.sourceTextEvidence.cellHypothesisKey !== anyCell.cell.cellHypothesisKey) throw new Error("cell must materialize its g.1 text evidence by reference");

// Entrada com um contrato failed → falha global, sem grupos, com problema técnico.
const failedInput = { ...input, structureReconstruction: { ...input.structureReconstruction, status: "failed" as const } };
const failed = formBudgetDocumentPageLocalNeutralStructuredEvidence(failedInput);
if (failed.status !== "failed" || failed.groups.length !== 0 || failed.technicalProblems.length === 0) throw new Error("a failed source contract must produce a global failure with no groups and a technical problem");
// Mesmo em falha global, as identidades de origem permanecem preenchidas e os fingerprints são calculados.
if (!HEX_64.test(failed.resultFingerprint)) throw new Error("result fingerprint must still be computed on global failure");

console.log("ok - orchestrator forms a deterministic, fingerprinted, page-local neutral structure over the real quadruple, preserves source identities and materializes upstream by reference, and fails globally on an invalid source contract");
