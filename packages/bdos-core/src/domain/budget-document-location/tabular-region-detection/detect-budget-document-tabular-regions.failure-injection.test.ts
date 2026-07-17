import type { SyntheticGeometryTextItem } from "./testing/tabular-region-detection-test-bridge";
import { buildTabularRegionDetectionFixture } from "./testing/tabular-region-detection-test-bridge";
import { detectBudgetDocumentTabularRegionsWithDependencies } from "./detect-budget-document-tabular-regions";
import { observeVerticalAlignments } from "./vertical-alignment-observation";
import { formTabularRegionCandidateWindows } from "./tabular-region-formation";

/**
 * Seam de injeção de dependências (auditoria pós-PR #69 do domínio, mesmo
 * padrão de `reconstruct-budget-document-structure.failure-injection.test.ts`)
 * — nenhuma das duas funções puras reais (observação de alinhamento,
 * formação de região) tem um caminho natural de exceção a partir de
 * entrada geometricamente válida. Este arquivo prova, uma fase por vez,
 * que uma falha controlada é tratada corretamente: página `not_detectable`,
 * disposição `unresolved_tabular_region_detection_failed` com a fase
 * correta, conservação íntegra, nunca `not_in_tabular_region` como
 * falsificação de ausência de comportamento tabular.
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const ROW_HEIGHT = 12;
const ROW_STEP = 25;

function twoColumnRows(count: number, startTop = 700): ReadonlyArray<SyntheticGeometryTextItem> {
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < count; row += 1) {
    const top = startTop - row * ROW_STEP;
    items.push({ text: `col1-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + ROW_HEIGHT, index: row * 2 });
    items.push({ text: `col2-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: row * 2 + 1 });
  }
  return items;
}

function buildFixture() {
  return buildTabularRegionDetectionFixture("failure-injection", [{ widthPoints: 612, heightPoints: 792, items: twoColumnRows(4) }]);
}

runTest("a controlled failure in alignment observation makes the page not_detectable, never a false no_candidate_region", () => {
  const structureReconstruction = buildFixture();
  const result = detectBudgetDocumentTabularRegionsWithDependencies(
    { structureReconstruction },
    {
      observeAlignments: () => {
        throw new Error("controlled test failure: alignment observation");
      },
      formRegions: formTabularRegionCandidateWindows,
    },
  );
  const page1 = result.groups[0].pages[0];
  assertEqual(page1.status, "not_detectable");
  assertEqual(page1.regions.length, 0);
  assertEqual(page1.alignments.length, 0);
  assertEqual(page1.lineDispositions.length, 4, "every physical line still receives a disposition — none silently disappears");
  assertEqual(page1.lineDispositions.every((d) => d.status === "unresolved_tabular_region_detection_failed"), true);
  page1.lineDispositions.forEach((d) => {
    if (d.status === "unresolved_tabular_region_detection_failed") {
      assertEqual(d.failedPhase, "alignment_detection");
    }
  });
  assertEqual(page1.technicalProblems.some((p) => p.code === "vertical_alignment_detection_failed"), true);
});

runTest("a controlled failure in region formation makes the page not_detectable, never falsified as ordinary absence of tabular structure", () => {
  const structureReconstruction = buildFixture();
  const result = detectBudgetDocumentTabularRegionsWithDependencies(
    { structureReconstruction },
    {
      observeAlignments: observeVerticalAlignments,
      formRegions: () => {
        throw new Error("controlled test failure: region formation");
      },
    },
  );
  const page1 = result.groups[0].pages[0];
  assertEqual(page1.status, "not_detectable");
  assertEqual(page1.regions.length, 0);
  assertEqual(page1.lineDispositions.every((d) => d.status === "unresolved_tabular_region_detection_failed"), true);
  page1.lineDispositions.forEach((d) => {
    if (d.status === "unresolved_tabular_region_detection_failed") {
      assertEqual(d.failedPhase, "region_formation");
    }
  });
  assertEqual(page1.technicalProblems.some((p) => p.code === "tabular_region_formation_failed"), true);
});

runTest("global status becomes completed_with_problems when a page failure occurs, never failed (a per-page failure is not a contract-level failure)", () => {
  const structureReconstruction = buildFixture();
  const result = detectBudgetDocumentTabularRegionsWithDependencies(
    { structureReconstruction },
    {
      observeAlignments: () => {
        throw new Error("controlled");
      },
      formRegions: formTabularRegionCandidateWindows,
    },
  );
  assertEqual(result.status, "completed_with_problems");
});

runTest("a manufactured concurrent claim (two windows sharing a line, injected via formRegions) never becomes a confirmed region and marks every affected line ambiguous", () => {
  const structureReconstruction = buildFixture();
  const result = detectBudgetDocumentTabularRegionsWithDependencies(
    { structureReconstruction },
    {
      observeAlignments: observeVerticalAlignments,
      formRegions: (lines) => {
        const ordered = [...lines].sort((a, b) => a.verticalOrder - b.verticalOrder);
        const windowA = { lineKeys: ordered.slice(0, 3).map((l) => l.lineKey), supportingAlignmentKeys: ["synthetic-a", "synthetic-b"], conflicted: true };
        const windowB = { lineKeys: ordered.slice(1, 4).map((l) => l.lineKey), supportingAlignmentKeys: ["synthetic-c", "synthetic-d"], conflicted: true };
        return [windowA, windowB];
      },
    },
  );
  const page1 = result.groups[0].pages[0];
  assertEqual(page1.regions.length, 0, "no conflicting formation is ever declared a valid region");
  assertEqual(page1.lineDispositions.every((d) => d.status === "unresolved_tabular_region_ambiguity"), true);
  page1.lineDispositions.forEach((d) => {
    if (d.status === "unresolved_tabular_region_ambiguity") {
      assertEqual(d.conflictingCandidateRegionKeys.length >= 1, true);
    }
  });
  assertEqual(page1.technicalProblems.some((p) => p.code === "tabular_region_overlap_detected"), true);
  assertEqual(page1.status, "detected_with_problems");
});
