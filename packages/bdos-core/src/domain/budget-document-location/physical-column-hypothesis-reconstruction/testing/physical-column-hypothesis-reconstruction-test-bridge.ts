import type { SyntheticGeometryPage } from "../../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import { buildTabularRegionDetectionFixture } from "../../tabular-region-detection/testing/tabular-region-detection-test-bridge";
import { detectBudgetDocumentTabularRegions } from "../../tabular-region-detection";
import type { BudgetDocumentPhysicalColumnHypothesisReconstructionInput } from "../budget-document-physical-column-hypothesis-reconstruction.types";

/**
 * Ponte exclusivamente de teste, local à Sprint 21.4A.2.f.2b, entre
 * especificações geométricas simples (reaproveitando `SyntheticGeometryPage`
 * e `buildTabularRegionDetectionFixture` das duas Sprints anteriores, sem
 * duplicar a fabricação da leitura física ou da localização de página) e o
 * par real e válido `{ structureReconstruction, tabularRegionDetection }`:
 * encadeia o leitor sintético de geometria, a localização de página
 * fabricada (todas as páginas candidatas diretas), o reconstrutor
 * estrutural real e o detector de regiões real (`detectBudgetDocumentTabularRegions`)
 * — nunca uma simulação manual de qualquer um dos dois resultados. Não
 * exportada pelo barrel público do domínio nem por
 * `physical-column-hypothesis-reconstruction/index.ts`; nunca vira fixture
 * de produção; usa apenas geometria sintética, nunca documento real.
 */
export function buildPhysicalColumnHypothesisReconstructionFixture(
  sourceLabel: string,
  syntheticPages: ReadonlyArray<SyntheticGeometryPage>,
): BudgetDocumentPhysicalColumnHypothesisReconstructionInput {
  const structureReconstruction = buildTabularRegionDetectionFixture(sourceLabel, syntheticPages);
  const tabularRegionDetection = detectBudgetDocumentTabularRegions({ structureReconstruction });
  return { structureReconstruction, tabularRegionDetection };
}

export type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "../../structure-reconstruction/testing/structure-reconstruction-test-bridge";
