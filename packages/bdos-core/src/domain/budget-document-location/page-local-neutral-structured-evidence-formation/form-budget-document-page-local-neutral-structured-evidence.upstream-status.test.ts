import { formBudgetDocumentPageLocalNeutralStructuredEvidence } from "./form-budget-document-page-local-neutral-structured-evidence";
import { buildPageLocalNeutralStructuredEvidenceFormationInput } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";
import type { SyntheticGeometryPage } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";

function cell(text: string, left: number, top: number) { return { text, leftPoints: left, topPoints: top, rightPoints: left + 40, bottomPoints: top + 10 }; }
function pageOf(prefix: string): SyntheticGeometryPage {
  const rows = [0, 1, 2, 3].map((r) => { const y = 100 + r * 20; return [cell(`${prefix}.${r + 1}`, 50, y), cell(`Servico ${r}`, 120, y), cell(`${r + 1}0,00`, 300, y)]; });
  return { widthPoints: 600, heightPoints: 800, items: rows.flat() };
}
const input = buildPageLocalNeutralStructuredEvidenceFormationInput("upstream-status", [pageOf("1"), pageOf("2")]);
const result = formBudgetDocumentPageLocalNeutralStructuredEvidence(input);

const group = result.groups[0];
const cellGroup = input.physicalCellHypothesisFormation.groups.find((g) => g.sourceCandidateGroupKey === group.sourceCandidateGroupKey)!;
const textGroup = input.physicalCellTextEvidenceFormation.groups.find((g) => g.sourceCandidateGroupKey === group.sourceCandidateGroupKey)!;
const detectionGroup = input.tabularRegionDetection.groups.find((g) => g.sourceCandidateGroupKey === group.sourceCandidateGroupKey)!;

if (group.sourceTabularRegionDetectionGroupStatus !== detectionGroup.status) throw new Error("group must preserve the tabular-region-detection group status");
if (group.sourcePhysicalCellHypothesisFormationGroupStatus !== cellGroup.status) throw new Error("group must preserve the f.2c group status");
if (group.sourcePhysicalCellTextEvidenceFormationGroupStatus !== textGroup.status) throw new Error("group must preserve the g.1 group status");

for (const page of group.pages) {
  const cellPage = cellGroup.pages.find((p) => p.pageNumber === page.pageNumber)!;
  const textPage = textGroup.pages.find((p) => p.pageNumber === page.pageNumber)!;
  const detectionPage = detectionGroup.pages.find((p) => p.pageNumber === page.pageNumber)!;
  if (page.sourceTabularRegionDetectionPageStatus !== detectionPage.status) throw new Error("page must preserve the tabular-region-detection page status");
  if (page.sourcePhysicalCellHypothesisFormationPageStatus !== cellPage.status) throw new Error("page must preserve the f.2c page status");
  if (page.sourcePhysicalCellTextEvidenceFormationPageStatus !== textPage.status) throw new Error("page must preserve the g.1 page status");

  for (const region of page.regions) {
    const cellRegion = cellPage.regions.find((r) => r.sourceRegionKey === region.sourceRegionKey)!;
    const textRegion = textPage.regions.find((r) => r.sourceRegionKey === region.sourceRegionKey)!;
    if (region.sourcePhysicalCellHypothesisFormationRegionStatus !== cellRegion.status) throw new Error("region must preserve the f.2c region status separately from its own g.2 status");
    if (region.sourcePhysicalCellTextEvidenceFormationRegionStatus !== textRegion.status) throw new Error("region must preserve the g.1 region status separately from its own g.2 status");

    for (const line of region.documentLines) {
      for (const position of line.positions) {
        if (position.status !== "cell_structured") continue;
        const upstreamEvidence = textRegion.cellTextEvidences.find((e) => e.cellHypothesisKey === position.cell.cellHypothesisKey)!;
        if (position.cell.sourceTextEvidenceStatus !== upstreamEvidence.status) throw new Error("cell must preserve the g.1 text-evidence status separately from its own g.2 cell status");
      }
    }
  }
}

console.log("ok - every neutral level preserves the upstream tabular-region/f.2c/g.1 states separately from its own g.2 state — a successful neutral organization never erases an upstream status");
