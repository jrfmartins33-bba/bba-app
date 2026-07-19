export {
  formBudgetDocumentPhysicalCellTextEvidenceWithDependencies,
  getDefaultPhysicalCellTextEvidenceFormationDependencies,
} from "../form-budget-document-physical-cell-text-evidence";
export type { PhysicalCellTextEvidenceFormationDependencies } from "../form-budget-document-physical-cell-text-evidence";

import { buildPhysicalDocumentReadResultWithGeometry } from "../../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "../../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import { buildPhysicalColumnHypothesisReconstructionFixture } from "../../physical-column-hypothesis-reconstruction/testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "../../physical-column-hypothesis-reconstruction";
import { formBudgetDocumentPhysicalCellHypotheses } from "../../physical-cell-hypothesis-formation";
import type { BudgetDocumentPhysicalCellTextEvidenceFormationInput } from "../budget-document-physical-cell-text-evidence-formation.types";

/**
 * Ponte exclusivamente de teste, local à Sprint 21.4A.2.g.1, entre
 * especificações geométricas simples (reaproveitando as pontes de teste já
 * existentes das Sprints anteriores, sem duplicar leitura física,
 * reconstrução estrutural, detecção de regiões, reconstrução de colunas ou
 * formação de células) e o trio real e válido `{ physicalRead,
 * structureReconstruction, physicalCellHypothesisFormation }` — encadeia os
 * reconstrutores/formadores reais, nunca uma simulação manual de qualquer um
 * dos três resultados. Não exportada pelo barrel público do domínio nem por
 * `physical-cell-text-evidence-formation/index.ts`; nunca vira fixture de
 * produção; usa apenas geometria sintética, nunca documento real.
 */
export function buildPhysicalCellTextEvidenceFormationFixture(
  sourceLabel: string,
  syntheticPages: ReadonlyArray<SyntheticGeometryPage>,
): BudgetDocumentPhysicalCellTextEvidenceFormationInput {
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry(sourceLabel, syntheticPages);
  const upstream = buildPhysicalColumnHypothesisReconstructionFixture(sourceLabel, syntheticPages);
  const physicalColumnHypothesisReconstruction = reconstructBudgetDocumentPhysicalColumnHypotheses(upstream);
  const physicalCellHypothesisFormation = formBudgetDocumentPhysicalCellHypotheses({ ...upstream, physicalColumnHypothesisReconstruction });
  return { physicalRead, structureReconstruction: upstream.structureReconstruction, physicalCellHypothesisFormation };
}

export type { SyntheticGeometryPage, SyntheticGeometryTextItem };
