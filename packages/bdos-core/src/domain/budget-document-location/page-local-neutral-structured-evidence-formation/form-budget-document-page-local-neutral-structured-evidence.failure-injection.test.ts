import { formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies, getDefaultPageLocalNeutralStructuredEvidenceFormationDependencies } from "./form-budget-document-page-local-neutral-structured-evidence";
import { buildPageLocalNeutralStructuredEvidenceFormationInput } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";
import type { SyntheticGeometryPage } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";

function cell(text: string, left: number, top: number) { return { text, leftPoints: left, topPoints: top, rightPoints: left + 40, bottomPoints: top + 10 }; }
function pageOf(prefix: string): SyntheticGeometryPage {
  const rows = [0, 1, 2, 3].map((r) => { const y = 100 + r * 20; return [cell(`${prefix}.${r + 1}`, 50, y), cell(`Servico ${r}`, 120, y), cell(`${r + 1}0,00`, 300, y)]; });
  return { widthPoints: 600, heightPoints: 800, items: rows.flat() };
}
const input = buildPageLocalNeutralStructuredEvidenceFormationInput("failure-injection", [pageOf("1")]);
const base = getDefaultPageLocalNeutralStructuredEvidenceFormationDependencies();

// (1) Falha de conservação injetada: a região é degradada para
// structured_with_problems com o código exato, e o resultado global COMPLETA
// com structured_with_problems — nunca uma falha global.
{
  const dependencies = { ...base, validateRegionConservation: () => "position_conservation_failed" as const };
  const result = formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies(input, dependencies);
  const region = result.groups[0].pages[0].regions[0];
  if (region.status !== "structured_with_problems") throw new Error("a conservation failure must degrade the region to structured_with_problems");
  if (region.technicalProblems.every((p) => p.code !== "position_conservation_failed")) throw new Error("the injected conservation failure code must be recorded on the region");
  if (region.metrics.technicalProblemCount < 1) throw new Error("the region metrics must count the conservation problem");
  if (result.status !== "structured_with_problems") throw new Error("an injected conservation failure must complete globally with problems, never fail globally");
}

// (2) Exceção de conservação (throw): tratada como falha de conservação, nunca propaga.
{
  const dependencies = { ...base, validateRegionConservation: () => { throw new Error("boom"); } };
  const result = formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies(input, dependencies);
  const region = result.groups[0].pages[0].regions[0];
  if (region.technicalProblems.every((p) => p.code !== "region_conservation_failed")) throw new Error("a thrown conservation check must be isolated as region_conservation_failed");
  if (result.status !== "structured_with_problems") throw new Error("a thrown conservation check must not fail the whole execution");
}

// (3) Exceção antes do processamento global → falha global controlada.
{
  const dependencies = { ...base, beforeGlobalProcessing: () => { throw new Error("boom"); } };
  const result = formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies(input, dependencies);
  if (result.status !== "failed") throw new Error("an unexpected pre-processing exception must produce a controlled global failure");
  if (result.technicalProblems.every((p) => p.code !== "page_local_neutral_structure_unexpected_failure")) throw new Error("the global failure must carry the unexpected-failure code");
  if (result.groups.length !== 0) throw new Error("a global failure must produce no groups");
}

console.log("ok - injected conservation failures (returned or thrown) are isolated to the region with the exact code and only degrade the global status; an unexpected pre-processing exception yields a controlled global failure");
