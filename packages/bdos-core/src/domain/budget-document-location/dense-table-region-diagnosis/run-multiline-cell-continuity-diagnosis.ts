import { buildTabularRegionDetectionFixture } from "../tabular-region-detection/testing/tabular-region-detection-test-bridge";
import { detectBudgetDocumentTabularRegions } from "../tabular-region-detection/detect-budget-document-tabular-regions";
import type { SyntheticGeometryPage } from "../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import {
  caseL1_singleTightContinuation,
  caseL2_twoConsecutiveTightContinuations,
  caseL3_threeConsecutiveTightContinuations,
  caseL4_boundaryProbeContinuation,
  caseL5_normalSubsequentRow,
  caseL6_externalParagraphNormalSpacing,
  caseL7_externalParagraphTightSpacing,
  caseL8_externalTitleTightSpacing,
  caseL9_lateralNoteTightSpacing,
  caseL10_twoLegitimateTabularRowsVeryClose,
  caseL11_tightLineBeforeTableStart,
  caseL12_tightLineAfterTableEnd,
} from "./multiline-cell-continuity-fixtures";

/** Script diagnóstico manual da Sprint 21.4B.2 — nunca *.test.ts, nunca em pnpm test/CI. */

function runCase(label: string, page: SyntheticGeometryPage): void {
  const structureReconstruction = buildTabularRegionDetectionFixture(label, [page]);
  const detection = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const detectedPage = detection.groups[0]?.pages[0];
  console.log(`\n=== ${label} ===`);
  if (!detectedPage) {
    console.log("  sem página detectada");
    return;
  }
  console.log(`  regiões=${detectedPage.regions.length} totalLineCount=${detectedPage.metrics.totalLineCount} included=${detectedPage.metrics.includedInCandidateRegionLineCount}`);
  const reconstructedPage = structureReconstruction.groups[0]?.pages[0];
  const sortedLines = reconstructedPage ? [...reconstructedPage.lines].sort((a, b) => a.verticalOrder - b.verticalOrder) : [];
  for (const line of sortedLines) {
    const disposition = detectedPage.lineDispositions.find((d) => d.lineKey === line.lineKey);
    console.log(`    L#${line.verticalOrder} segs=${line.segmentKeys.length} top=${line.topPoints.toFixed(2)} status=${disposition?.status ?? "?"}`);
  }
}

function main(): void {
  runCase("L1 — continuação apertada única", caseL1_singleTightContinuation());
  runCase("L2 — duas continuações consecutivas", caseL2_twoConsecutiveTightContinuations());
  runCase("L3 — três continuações consecutivas", caseL3_threeConsecutiveTightContinuations());
  runCase("L4 — sonda de fronteira", caseL4_boundaryProbeContinuation());
  runCase("L5 — linha normal subsequente (controle)", caseL5_normalSubsequentRow());
  runCase("L6 — parágrafo externo, espaçamento normal", caseL6_externalParagraphNormalSpacing());
  runCase("L7 — ADVERSARIAL: parágrafo externo apertado", caseL7_externalParagraphTightSpacing());
  runCase("L8 — título externo apertado", caseL8_externalTitleTightSpacing());
  runCase("L9 — nota lateral apertada", caseL9_lateralNoteTightSpacing());
  runCase("L10 — duas linhas tabulares legítimas muito próximas", caseL10_twoLegitimateTabularRowsVeryClose());
  runCase("L11 — linha apertada antes do início da tabela", caseL11_tightLineBeforeTableStart());
  runCase("L12 — linha apertada depois do fim da tabela", caseL12_tightLineAfterTableEnd());
}

main();
