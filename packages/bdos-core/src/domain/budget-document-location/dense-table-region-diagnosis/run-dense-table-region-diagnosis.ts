import { buildTabularRegionDetectionFixture } from "../tabular-region-detection/testing/tabular-region-detection-test-bridge";
import { detectBudgetDocumentTabularRegions } from "../tabular-region-detection/detect-budget-document-tabular-regions";
import type { BudgetDocumentTabularRegionDetectionResult, TabularRegionDetectionPage } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { BudgetDocumentStructureReconstructionResult, ReconstructedBudgetDocumentPage } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { SyntheticGeometryPage } from "../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import {
  CASE_E_WRAP_STEP_VARIANTS,
  caseA_denseTableNoWrap,
  caseB_denseTableTwoWraps,
  caseC_simpleTableWithWrap,
  caseD_denseTableSingleCleanWrap,
  caseE_wrapStepVariant,
  caseF_denseTableWithLegitimateSparseRow,
  caseG_legitimateContinuationFixture,
  caseH_externalTitleBetweenTabularBlocks,
  caseI_lateralNoteOutsideEnvelope,
  caseJ_accidentalSingleAlignmentParagraph,
  caseK_sparseInternalHeader,
} from "./dense-table-region-diagnosis-fixtures";

/**
 * Script diagnóstico exclusivamente manual da Sprint 21.4B.1 — nunca parte
 * de `pnpm test` (não é `*.test.ts`, não roda em CI). Nenhum PDF real,
 * nenhum dado do caso Lagoa do Arroz: apenas geometria sintética genérica
 * (Casos A-G) através da cadeia real f.1 → f.2a, para caracterizar
 * objetivamente onde e como a continuidade de região se rompe diante de
 * descrições que quebram em duas linhas físicas. Não altera nem invoca
 * nenhuma lógica de produção além de chamar as funções públicas reais
 * (`reconstructBudgetDocumentStructure` via `buildTabularRegionDetectionFixture`,
 * `detectBudgetDocumentTabularRegions`) exatamente como qualquer chamador
 * legítimo faria. Execução: `npx tsx src/domain/budget-document-location/dense-table-region-diagnosis/run-dense-table-region-diagnosis.ts`
 * a partir de `packages/bdos-core`.
 */

interface CaseDefinition {
  readonly label: string;
  readonly page: SyntheticGeometryPage;
}

function runCase(definition: CaseDefinition): void {
  const structureReconstruction: BudgetDocumentStructureReconstructionResult = buildTabularRegionDetectionFixture(
    definition.label,
    [definition.page],
  );
  const detection: BudgetDocumentTabularRegionDetectionResult = detectBudgetDocumentTabularRegions({ structureReconstruction });

  console.log(`\n=== ${definition.label} ===`);
  console.log(`structure-reconstruction.status = ${structureReconstruction.status}`);
  console.log(`tabular-region-detection.status = ${detection.status}`);

  const reconstructedPage: ReconstructedBudgetDocumentPage | undefined = structureReconstruction.groups[0]?.pages[0];
  const detectedPage: TabularRegionDetectionPage | undefined = detection.groups[0]?.pages[0];

  if (!reconstructedPage || !detectedPage) {
    console.log("  (nenhuma página reconstruída/detectada — ver technicalProblems)");
    console.log("  reconstruction.technicalProblems =", JSON.stringify(structureReconstruction.technicalProblems));
    console.log("  detection.technicalProblems =", JSON.stringify(detection.technicalProblems));
    return;
  }

  console.log(`  f.1 linhas físicas: ${reconstructedPage.lines.length}`);
  for (const line of [...reconstructedPage.lines].sort((a, b) => a.verticalOrder - b.verticalOrder)) {
    const supportingAlignmentCount = detectedPage.alignments.filter((alignment) => alignment.lineKeys.includes(line.lineKey)).length;
    console.log(
      `    linha #${line.verticalOrder} top=${line.topPoints} colunas(segmentos)=${line.segmentKeys.length} alinhamentos-sustentados=${supportingAlignmentCount}/${detectedPage.alignments.length}`,
    );
  }

  console.log(`  f.2a alinhamentos verticais recorrentes: ${detectedPage.alignments.length}`);
  console.log(`  f.2a regiões candidatas confirmadas: ${detectedPage.regions.length}`);
  for (const region of detectedPage.regions) {
    console.log(
      `    região order=${region.order} linhas=${region.lineKeys.length} alinhamentos-sustentando=${region.supportingAlignmentKeys.length}`,
    );
  }

  const dispositionCounts = new Map<string, number>();
  for (const disposition of detectedPage.lineDispositions) {
    dispositionCounts.set(disposition.status, (dispositionCounts.get(disposition.status) ?? 0) + 1);
  }
  console.log(`  disposição por linha: ${JSON.stringify(Object.fromEntries(dispositionCounts))}`);
  console.log(
    `  métricas: totalLineCount=${detectedPage.metrics.totalLineCount} includedInCandidateRegionLineCount=${detectedPage.metrics.includedInCandidateRegionLineCount} regionCount=${detectedPage.metrics.regionCount}`,
  );
}

function main(): void {
  runCase({ label: "Caso A — denso, sem quebra (controle)", page: caseA_denseTableNoWrap() });
  runCase({ label: "Caso B — denso, duas linhas com descrição quebrada", page: caseB_denseTableTwoWraps() });
  runCase({ label: "Caso C — simples (2 colunas), uma descrição quebrada", page: caseC_simpleTableWithWrap() });
  runCase({ label: "Caso D — denso, uma quebra isolada, geometria uniforme", page: caseD_denseTableSingleCleanWrap() });

  for (const wrapStep of CASE_E_WRAP_STEP_VARIANTS) {
    runCase({ label: `Caso E — sensibilidade de tolerância, wrapStep=${wrapStep}`, page: caseE_wrapStepVariant(wrapStep) });
  }

  runCase({ label: "Caso F — linha esparsa legítima (sem quebra, espaçamento normal)", page: caseF_denseTableWithLegitimateSparseRow() });
  runCase({ label: "Caso G — fixture de continuação legítima (reaproveita D)", page: caseG_legitimateContinuationFixture() });
  runCase({ label: "Caso H — título externo largo entre dois blocos", page: caseH_externalTitleBetweenTabularBlocks() });
  runCase({ label: "Caso I — nota lateral fora do envelope horizontal", page: caseI_lateralNoteOutsideEnvelope() });
  runCase({ label: "Caso J — ADVERSARIAL: parágrafo com 1 alinhamento acidental", page: caseJ_accidentalSingleAlignmentParagraph() });
  runCase({ label: "Caso K — cabeçalho interno esparso (ITEM+DESCRICAO)", page: caseK_sparseInternalHeader() });
}

main();
