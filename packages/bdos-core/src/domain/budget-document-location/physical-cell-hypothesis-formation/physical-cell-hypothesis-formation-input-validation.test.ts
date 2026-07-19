import { buildPhysicalColumnHypothesisReconstructionFixture, type SyntheticGeometryPage, type SyntheticGeometryTextItem } from "../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../physical-column-hypothesis-reconstruction";
import { validatePhysicalCellHypothesisFormationInput } from "./physical-cell-hypothesis-formation-input-validation";

const items: SyntheticGeometryTextItem[] = Array.from({ length: 4 }, (_, row) => {
  const top = 700 - row * 25;
  return [{ text: `a-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + 12, index: row * 2 }, { text: `b-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + 12, index: row * 2 + 1 }];
}).flat();
const page: SyntheticGeometryPage = { widthPoints: 612, heightPoints: 792, items };
function fixture() { const upstream = buildPhysicalColumnHypothesisReconstructionFixture("validation", [page]); return { ...upstream, physicalColumnHypothesisReconstruction: reconstructBudgetDocumentPhysicalColumnHypotheses(upstream) }; }
function expectInvalid(mutator: (input: ReturnType<typeof fixture>) => ReturnType<typeof fixture>, expectedCode: string): void { const result = validatePhysicalCellHypothesisFormationInput(mutator(fixture())); if (result.kind !== "invalid" || result.problems[0].code !== expectedCode) throw new Error(`expected ${expectedCode}, got ${JSON.stringify(result)}`); }
function changeRegion(input: ReturnType<typeof fixture>, mutate: (region: ReturnType<typeof fixture>["physicalColumnHypothesisReconstruction"]["groups"][number]["pages"][number]["regions"][number]) => ReturnType<typeof fixture>["physicalColumnHypothesisReconstruction"]["groups"][number]["pages"][number]["regions"][number]): ReturnType<typeof fixture> {
  const group = input.physicalColumnHypothesisReconstruction.groups[0]; const sourcePage = group.pages[0];
  return { ...input, physicalColumnHypothesisReconstruction: { ...input.physicalColumnHypothesisReconstruction, groups: [{ ...group, pages: [{ ...sourcePage, regions: [mutate(sourcePage.regions[0])] }] }] } };
}

if (validatePhysicalCellHypothesisFormationInput(fixture()).kind !== "valid") throw new Error("real upstream contracts must validate");
expectInvalid((input) => ({ ...input, structureReconstruction: { ...input.structureReconstruction, schemaVersion: 2 as 1 } }), "source_contract_version_unsupported");
expectInvalid((input) => ({ ...input, tabularRegionDetection: { ...input.tabularRegionDetection, detectorVersion: "different" as typeof input.tabularRegionDetection.detectorVersion } }), "source_contract_version_unsupported");
expectInvalid((input) => ({ ...input, physicalColumnHypothesisReconstruction: { ...input.physicalColumnHypothesisReconstruction, reconstructionContextFingerprintVersion: "v2" as typeof input.physicalColumnHypothesisReconstruction.reconstructionContextFingerprintVersion } }), "source_contract_version_unsupported");
expectInvalid((input) => ({ ...input, physicalColumnHypothesisReconstruction: { ...input.physicalColumnHypothesisReconstruction, sourceByteHash: "different" } }), "source_lineage_mismatch");
expectInvalid((input) => ({ ...input, physicalColumnHypothesisReconstruction: { ...input.physicalColumnHypothesisReconstruction, sourceStructureReconstructorVersion: "different" as unknown as typeof input.physicalColumnHypothesisReconstruction.sourceStructureReconstructorVersion } }), "source_lineage_mismatch");
expectInvalid((input) => ({ ...input, tabularRegionDetection: { ...input.tabularRegionDetection, sourceReconstructionSchemaVersion: 99 as 1 } }), "source_lineage_mismatch");
expectInvalid((input) => ({ ...input, tabularRegionDetection: { ...input.tabularRegionDetection, sourceReconstructorName: "different" as unknown as typeof input.tabularRegionDetection.sourceReconstructorName } }), "source_lineage_mismatch");
expectInvalid((input) => ({ ...input, tabularRegionDetection: { ...input.tabularRegionDetection, sourceReconstructionProfileVersion: 99 } }), "source_lineage_mismatch");
expectInvalid((input) => ({ ...input, tabularRegionDetection: { ...input.tabularRegionDetection, sourceReconstructionContextFingerprint: "different" } }), "source_lineage_mismatch");
expectInvalid((input) => { const group = input.physicalColumnHypothesisReconstruction.groups[0]; return { ...input, physicalColumnHypothesisReconstruction: { ...input.physicalColumnHypothesisReconstruction, groups: [{ ...group, sourceCandidateGroupKey: "missing" }] } }; }, "source_group_reference_invalid");
expectInvalid((input) => { const group = input.physicalColumnHypothesisReconstruction.groups[0]; const columnPage = group.pages[0]; return { ...input, physicalColumnHypothesisReconstruction: { ...input.physicalColumnHypothesisReconstruction, groups: [{ ...group, pages: [{ ...columnPage, pageNumber: 99 }] }] } }; }, "source_page_reference_invalid");
expectInvalid((input) => { const group = input.physicalColumnHypothesisReconstruction.groups[0]; const columnPage = group.pages[0]; const region = columnPage.regions[0]; return { ...input, physicalColumnHypothesisReconstruction: { ...input.physicalColumnHypothesisReconstruction, groups: [{ ...group, pages: [{ ...columnPage, regions: [{ ...region, sourceRegionKey: "missing" }] }] }] } }; }, "source_region_reference_invalid");
expectInvalid((input) => {
  const group = input.physicalColumnHypothesisReconstruction.groups[0];
  const columnPage = group.pages[0];
  const region = columnPage.regions[0];
  const hypothesis = region.hypotheses[0];
  return {
    ...input,
    physicalColumnHypothesisReconstruction: {
      ...input.physicalColumnHypothesisReconstruction,
      groups: [{
        ...group,
        pages: [{
          ...columnPage,
          regions: [{
            ...region,
            hypotheses: [{
              ...hypothesis,
              segmentKeys: hypothesis.segmentKeys.slice(1),
            }, ...region.hypotheses.slice(1)],
          }],
        }],
      }],
    },
  };
}, "source_column_hypothesis_reference_invalid");
expectInvalid((input) => changeRegion(input, (region) => ({ ...region, segmentDispositions: region.segmentDispositions.map((entry, index) => index === 0 && entry.status === "included_in_physical_column_hypothesis" ? { ...entry, hypothesisKey: "missing" } : entry) })), "source_column_hypothesis_reference_invalid");
expectInvalid((input) => changeRegion(input, (region) => ({ ...region, segmentDispositions: region.segmentDispositions.slice(1) })), "source_column_hypothesis_reference_invalid");
expectInvalid((input) => changeRegion(input, (region) => {
  const first = region.hypotheses[0]; const second = region.hypotheses[1];
  return { ...region, segmentDispositions: region.segmentDispositions.map((entry) => entry.status === "included_in_physical_column_hypothesis" && entry.hypothesisKey === first.hypothesisKey ? { ...entry, hypothesisKey: second.hypothesisKey } : entry) };
}), "source_column_hypothesis_reference_invalid");
expectInvalid((input) => changeRegion(input, (region) => {
  const hypothesis = region.hypotheses[0];
  return { ...region, hypotheses: [{ ...hypothesis, lineKeys: [hypothesis.lineKeys[1], ...hypothesis.lineKeys.slice(1)] }, ...region.hypotheses.slice(1)] };
}), "source_column_hypothesis_reference_invalid");
console.log("ok - f.2c validates contracts, direct lineage, groups, pages, regions and hypothesis references");
