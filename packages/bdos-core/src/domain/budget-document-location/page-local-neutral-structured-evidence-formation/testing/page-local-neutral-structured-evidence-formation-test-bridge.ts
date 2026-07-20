export {
  formBudgetDocumentPageLocalNeutralStructuredEvidenceWithDependencies,
  getDefaultPageLocalNeutralStructuredEvidenceFormationDependencies,
} from "../form-budget-document-page-local-neutral-structured-evidence";
export type { PageLocalNeutralStructuredEvidenceFormationDependencies } from "../form-budget-document-page-local-neutral-structured-evidence";

import { buildPhysicalDocumentReadResultWithGeometry } from "../../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "../../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import { buildPhysicalColumnHypothesisReconstructionFixture } from "../../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypotheses } from "../../physical-cell-hypothesis-formation";
import { formBudgetDocumentPhysicalCellTextEvidence } from "../../physical-cell-text-evidence-formation";
import type { BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput } from "../budget-document-page-local-neutral-structured-evidence-formation.types";

/**
 * Ponte exclusivamente de teste, local à Sprint 21.4A.2.g.2, entre
 * especificações geométricas simples e o quádruplo real e válido
 * `{ structureReconstruction, tabularRegionDetection,
 * physicalCellHypothesisFormation, physicalCellTextEvidenceFormation }` —
 * encadeia os reconstrutores/detectores/formadores reais das Sprints
 * anteriores, nunca uma simulação manual de qualquer um dos quatro
 * resultados. Não exportada pelo barrel público; usa apenas geometria
 * sintética, nunca documento real.
 */
export function buildPageLocalNeutralStructuredEvidenceFormationInput(
  sourceLabel: string,
  syntheticPages: ReadonlyArray<SyntheticGeometryPage>,
): BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput {
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry(sourceLabel, syntheticPages);
  const upstream = buildPhysicalColumnHypothesisReconstructionFixture(sourceLabel, syntheticPages);
  const physicalColumnHypothesisReconstruction = reconstructBudgetDocumentPhysicalColumnHypotheses(upstream);
  const physicalCellHypothesisFormation = formBudgetDocumentPhysicalCellHypotheses({ ...upstream, physicalColumnHypothesisReconstruction });
  const physicalCellTextEvidenceFormation = formBudgetDocumentPhysicalCellTextEvidence({ physicalRead, structureReconstruction: upstream.structureReconstruction, physicalCellHypothesisFormation });
  return {
    structureReconstruction: upstream.structureReconstruction,
    tabularRegionDetection: upstream.tabularRegionDetection,
    physicalCellHypothesisFormation,
    physicalCellTextEvidenceFormation,
  };
}

export type { SyntheticGeometryPage, SyntheticGeometryTextItem };
