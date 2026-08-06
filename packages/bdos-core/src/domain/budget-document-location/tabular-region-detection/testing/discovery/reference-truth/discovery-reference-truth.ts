import { REFERENCE_TRUTH_DOCUMENT, REFERENCE_TRUTH_PAGES } from "./discovery-reference-truth-document";
import { REFERENCE_TRUTH_COLUMNS } from "./discovery-reference-truth-columns";
import { REFERENCE_TRUTH_PAGE_46_PHYSICAL_REGIONS, REFERENCE_TRUTH_PAGE_46_LOGICAL_ROWS, REFERENCE_TRUTH_PAGE_46_CELLS, REFERENCE_TRUTH_PAGE_46_MATH_RELATIONS } from "./discovery-reference-truth-page-46";
import { REFERENCE_TRUTH_PAGE_50_PHYSICAL_REGIONS, REFERENCE_TRUTH_PAGE_50_LOGICAL_ROWS, REFERENCE_TRUTH_PAGE_50_CELLS, REFERENCE_TRUTH_PAGE_50_MATH_RELATIONS } from "./discovery-reference-truth-page-50";
import { REFERENCE_TRUTH_PAGE_54_PHYSICAL_REGIONS, REFERENCE_TRUTH_PAGE_54_LOGICAL_ROWS, REFERENCE_TRUTH_PAGE_54_CELLS, REFERENCE_TRUTH_PAGE_54_MATH_RELATIONS } from "./discovery-reference-truth-page-54";
import type { ReferenceTruthPageBundle } from "./discovery-reference-truth.types";

export { REFERENCE_TRUTH_DOCUMENT, REFERENCE_TRUTH_PAGES, REFERENCE_TRUTH_COLUMNS };
export * from "./discovery-reference-truth.types";

export const REFERENCE_TRUTH_BUNDLES: ReadonlyArray<ReferenceTruthPageBundle> = [
  {
    page: REFERENCE_TRUTH_PAGES.find((p) => p.realPageNumber === 46)!,
    physicalRegions: REFERENCE_TRUTH_PAGE_46_PHYSICAL_REGIONS,
    logicalRows: REFERENCE_TRUTH_PAGE_46_LOGICAL_ROWS,
    cells: REFERENCE_TRUTH_PAGE_46_CELLS,
    mathRelations: REFERENCE_TRUTH_PAGE_46_MATH_RELATIONS,
  },
  {
    page: REFERENCE_TRUTH_PAGES.find((p) => p.realPageNumber === 50)!,
    physicalRegions: REFERENCE_TRUTH_PAGE_50_PHYSICAL_REGIONS,
    logicalRows: REFERENCE_TRUTH_PAGE_50_LOGICAL_ROWS,
    cells: REFERENCE_TRUTH_PAGE_50_CELLS,
    mathRelations: REFERENCE_TRUTH_PAGE_50_MATH_RELATIONS,
  },
  {
    page: REFERENCE_TRUTH_PAGES.find((p) => p.realPageNumber === 54)!,
    physicalRegions: REFERENCE_TRUTH_PAGE_54_PHYSICAL_REGIONS,
    logicalRows: REFERENCE_TRUTH_PAGE_54_LOGICAL_ROWS,
    cells: REFERENCE_TRUTH_PAGE_54_CELLS,
    mathRelations: REFERENCE_TRUTH_PAGE_54_MATH_RELATIONS,
  },
];
