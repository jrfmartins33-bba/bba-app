import { formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies, getDefaultPageLocalNeutralStructuredEvidenceFormationDependencies } from "./form-budget-document-page-local-neutral-structured-evidence";
import { buildPageLocalNeutralStructuredEvidenceFormationInput } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";
import type { SyntheticGeometryPage } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";

function cell(text: string, left: number, top: number) { return { text, leftPoints: left, topPoints: top, rightPoints: left + 40, bottomPoints: top + 10 }; }
function pageOf(prefix: string): SyntheticGeometryPage {
  const rows = [0, 1, 2, 3].map((r) => { const y = 100 + r * 20; return [cell(`${prefix}.${r + 1}`, 50, y), cell(`Servico ${r}`, 120, y), cell(`${r + 1}0,00`, 300, y)]; });
  return { widthPoints: 600, heightPoints: 800, items: rows.flat() };
}
const input = buildPageLocalNeutralStructuredEvidenceFormationInput("isolation", [pageOf("1"), pageOf("2"), pageOf("3")]);

const base = getDefaultPageLocalNeutralStructuredEvidenceFormationDependencies();
// Injeta uma falha de formação exclusivamente na região da página 2.
const dependencies = {
  ...base,
  formNeutralDocumentRegion: (regionCandidate: Parameters<typeof base.formNeutralDocumentRegion>[0], ...rest: DropFirst<Parameters<typeof base.formNeutralDocumentRegion>>) => {
    if (regionCandidate.pageNumber === 2) throw new Error("injected region formation failure");
    return base.formNeutralDocumentRegion(regionCandidate, ...rest);
  },
};
type DropFirst<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest] ? Rest : never;

const result = formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies(input, dependencies);

const pages = result.groups[0].pages;
const page1 = pages.find((p) => p.pageNumber === 1)!;
const page2 = pages.find((p) => p.pageNumber === 2)!;
const page3 = pages.find((p) => p.pageNumber === 3)!;

if (page1.regions[0].status !== "structured" || page3.regions[0].status !== "structured") throw new Error("regions on unaffected pages must remain fully structured despite a failure elsewhere");
if (page1.regions[0].documentLines.length === 0 || page3.regions[0].documentLines.length === 0) throw new Error("unaffected pages must keep their document lines");
if (page2.regions[0].status !== "failed") throw new Error("the injected-failure region must be isolated as failed");
if (page2.regions[0].technicalProblems.every((problem) => problem.code !== "neutral_region_formation_failed")) throw new Error("the failed region must carry a neutral_region_formation_failed problem");
if (page2.status !== "structured_with_problems") throw new Error("a page whose only region failed must be structured_with_problems, not a global failure");
if (result.status !== "structured_with_problems") throw new Error("a localized region failure must degrade the global status to structured_with_problems, never to a full failure");

// A falha de uma região nunca contamina as métricas das outras.
if (page1.metrics.cellStructuredCount === 0 || page3.metrics.cellStructuredCount === 0) throw new Error("unaffected pages must still report their structured cells");

console.log("ok - a formation failure injected into a single region is isolated: other regions/pages remain fully structured, the failed region is a failed shell with its own problem, and the global status degrades only to structured_with_problems");
