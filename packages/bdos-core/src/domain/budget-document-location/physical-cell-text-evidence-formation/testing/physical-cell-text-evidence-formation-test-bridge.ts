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
import type { BudgetDocumentPhysicalCellHypothesisFormationResult } from "../../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import { computeContentFingerprint as computeCellHypothesisFormationContentFingerprint } from "../../physical-cell-hypothesis-formation/physical-cell-hypothesis-formation-context-fingerprint";
import type { BudgetDocumentPhysicalCellTextEvidenceFormationInput } from "../budget-document-physical-cell-text-evidence-formation.types";
import { recomputePhysicalCellHypothesisFormationIdentityFingerprint } from "../physical-cell-text-evidence-formation-upstream-fingerprint-validation";

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

/**
 * Reassina o fingerprint de conteúdo da f.2c após uma mutação de teste em
 * `groups`/`status`/`technicalProblems`/`metrics` — nunca uma fórmula nova,
 * reaproveita a mesma identidade (inalterada, pois nenhum campo achatado de
 * linhagem muda) e a mesma função real `computeContentFingerprint` da f.2c.
 * Sem isto, qualquer teste que mude `groups` diretamente seria capturado
 * pelo portão global de fingerprint da g.1 antes de alcançar o cenário que
 * pretende exercitar — mesmo papel de `replaceAndResignColumnGroups` uma
 * camada abaixo. Nunca usada para simular um resultado real da f.2c "do
 * zero"; sempre parte de um resultado real e válido já produzido pela
 * cadeia real.
 */
export function resignPhysicalCellHypothesisFormationResult(
  original: BudgetDocumentPhysicalCellHypothesisFormationResult,
  patch: Partial<Pick<BudgetDocumentPhysicalCellHypothesisFormationResult, "status" | "groups" | "technicalProblems" | "metrics">>,
): BudgetDocumentPhysicalCellHypothesisFormationResult {
  const merged = { ...original, ...patch };
  const identity = recomputePhysicalCellHypothesisFormationIdentityFingerprint(original);
  const formationContextFingerprint = computeCellHypothesisFormationContentFingerprint(identity, {
    status: merged.status, groups: merged.groups, technicalProblems: merged.technicalProblems, metrics: merged.metrics, limitations: merged.limitations,
  });
  return { ...merged, formationContextFingerprint };
}
