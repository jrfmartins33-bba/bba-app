import type { PhysicalCellTextEvidence } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { PhysicalGridIntersection } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type {
  NeutralDocumentCellStatus,
  NeutralDocumentGroup,
  NeutralDocumentGroupStatus,
  NeutralDocumentLineStatus,
  NeutralDocumentPage,
  NeutralDocumentPageStatus,
  NeutralDocumentPosition,
  NeutralDocumentPositionStatus,
  NeutralDocumentRegion,
  NeutralDocumentRegionStatus,
  PageLocalNeutralStructuredEvidenceFormationStatus,
} from "./budget-document-page-local-neutral-structured-evidence-formation.types";

/**
 * Um classificador único por nível (emenda 2). Cada classificador é a ÚNICA
 * fonte do estado próprio da g.2 naquele nível e alimenta simultaneamente: o
 * campo `status` do objeto, as métricas categóricas e o portão de
 * conservação. Nunca existem duas implementações paralelas da mesma
 * classificação. Todos os estados são estritamente estruturais — nunca
 * score, confiança, precisão, prontidão ou interpretação econômica.
 */

// --- posição (§14/§17): mapeia a interseção física para a posição documental
export function mapIntersectionToPositionStatus(intersection: PhysicalGridIntersection): NeutralDocumentPositionStatus {
  switch (intersection.status) {
    case "cell_hypothesis_formed": return "cell_structured";
    case "empty": return "empty";
    case "unresolved_technical_failure": return "technical_failure";
    case "unresolved_segment_association_ambiguity":
      switch (intersection.ambiguityReason) {
        case "partial_segment_intersection": return "ambiguous_partial_intersection";
        case "segment_claimed_by_multiple_intersections": return "ambiguous_multiple_intersections";
        case "observed_content_outside_grid_bounds": return "ambiguous_content_outside_grid_bounds";
      }
  }
}

// --- célula (§15): derivada do estado textual da g.1, nunca reinterpretada
export function classifyCellStatus(textEvidenceStatus: PhysicalCellTextEvidence["status"], formationFailed: boolean): NeutralDocumentCellStatus {
  if (formationFailed) return "failed";
  if (textEvidenceStatus === "formed") return "structured";
  if (textEvidenceStatus === "partially_formed") return "structured_with_text_problems";
  return "structured_without_resolved_text";
}

// --- linha documental (§13/§21)
export interface LineStatusInputs {
  readonly positionCount: number;
  readonly technicalProblemCount: number;
  readonly regionUpstreamNotProcessable: boolean;
  readonly formationFailed: boolean;
}
export function deriveLineStatus(inputs: LineStatusInputs): NeutralDocumentLineStatus {
  if (inputs.formationFailed) return "failed";
  if (inputs.regionUpstreamNotProcessable) return "upstream_not_processable";
  if (inputs.positionCount === 0) return "without_positions";
  if (inputs.technicalProblemCount > 0) return "structured_with_problems";
  return "structured";
}

// --- região (§7/§20.1/§21)
export interface RegionStatusInputs {
  readonly upstreamNotProcessable: boolean;
  readonly withoutPhysicalGrid: boolean;
  readonly documentCellCount: number;
  readonly ambiguousPositionCount: number;
  readonly technicalProblemCount: number;
  readonly formationFailed: boolean;
}
export function deriveRegionStatus(inputs: RegionStatusInputs): NeutralDocumentRegionStatus {
  if (inputs.formationFailed) return "failed";
  if (inputs.upstreamNotProcessable) return "upstream_not_processable";
  if (inputs.withoutPhysicalGrid) return "without_physical_grid";
  // Correção B1: um problema técnico (ex.: falha localizada de linha/posição/
  // célula) é verificado ANTES de `documentCellCount === 0` — caso contrário,
  // uma região cujo único documentCellCount chegou a zero por causa de uma
  // falha de formação (não porque a malha legitimamente não tinha células)
  // seria mascarada como `grid_without_cells`, escondendo o problema real.
  if (inputs.technicalProblemCount > 0) return "structured_with_problems";
  if (inputs.documentCellCount === 0) return "grid_without_cells";
  if (inputs.ambiguousPositionCount > 0) return "structured_with_ambiguities";
  return "structured";
}

// --- helpers de agregação de contêiner ---------------------------------------
const REGION_STRUCTURE_STATES: ReadonlyArray<NeutralDocumentRegionStatus> = ["structured", "structured_with_ambiguities", "structured_with_problems"];
const REGION_NON_STRUCTURE_STATES: ReadonlyArray<NeutralDocumentRegionStatus> = ["grid_without_cells", "without_physical_grid", "upstream_not_processable"];

export function derivePageStatus(regions: ReadonlyArray<NeutralDocumentRegion>, pageFailed: boolean): NeutralDocumentPageStatus {
  if (pageFailed) return "failed";
  if (regions.length === 0) return "without_neutral_structure";
  if (regions.every((entry) => entry.status === "upstream_not_processable")) return "upstream_not_processable";
  const anyProblem = regions.some((entry) => entry.status === "structured_with_problems" || entry.status === "failed");
  const anyStructure = regions.some((entry) => REGION_STRUCTURE_STATES.includes(entry.status));
  const anyNonStructure = regions.some((entry) => REGION_NON_STRUCTURE_STATES.includes(entry.status));
  if (anyProblem) return "structured_with_problems";
  if (anyStructure && anyNonStructure) return "partially_structured";
  if (anyStructure) return "structured";
  return "without_neutral_structure";
}

const PAGE_STRUCTURE_STATES: ReadonlyArray<NeutralDocumentPageStatus> = ["structured", "structured_with_problems", "partially_structured"];
const PAGE_NON_STRUCTURE_STATES: ReadonlyArray<NeutralDocumentPageStatus> = ["without_neutral_structure", "upstream_not_processable"];

export function deriveGroupStatus(pages: ReadonlyArray<NeutralDocumentPage>, groupFailed: boolean): NeutralDocumentGroupStatus {
  if (groupFailed) return "failed";
  if (pages.length === 0) return "without_neutral_structure";
  if (pages.every((entry) => entry.status === "upstream_not_processable")) return "upstream_not_processable";
  const anyProblem = pages.some((entry) => entry.status === "structured_with_problems" || entry.status === "failed");
  const anyStructure = pages.some((entry) => PAGE_STRUCTURE_STATES.includes(entry.status));
  const anyNonStructure = pages.some((entry) => PAGE_NON_STRUCTURE_STATES.includes(entry.status));
  if (anyProblem) return "structured_with_problems";
  if (anyStructure && anyNonStructure) return "partially_structured";
  if (anyStructure) return "structured";
  return "without_neutral_structure";
}

const GROUP_STRUCTURE_STATES: ReadonlyArray<NeutralDocumentGroupStatus> = ["structured", "structured_with_problems", "partially_structured"];
const GROUP_NON_STRUCTURE_STATES: ReadonlyArray<NeutralDocumentGroupStatus> = ["without_neutral_structure", "upstream_not_processable"];

export function deriveGlobalStatus(groups: ReadonlyArray<NeutralDocumentGroup>): PageLocalNeutralStructuredEvidenceFormationStatus {
  const anyProblem = groups.some((entry) => entry.status === "structured_with_problems" || entry.status === "failed");
  const anyStructure = groups.some((entry) => GROUP_STRUCTURE_STATES.includes(entry.status));
  const anyNonStructure = groups.some((entry) => GROUP_NON_STRUCTURE_STATES.includes(entry.status));
  if (anyProblem) return "structured_with_problems";
  if (anyStructure && anyNonStructure) return "partially_structured";
  return "structured";
}

// --- categorização de posição por status para métricas/conservação -----------
export function positionCategory(position: NeutralDocumentPosition): NeutralDocumentPositionStatus {
  return position.status;
}
