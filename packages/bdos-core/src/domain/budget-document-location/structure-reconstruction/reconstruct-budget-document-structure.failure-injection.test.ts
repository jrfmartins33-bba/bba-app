import { observeDocumentSignals } from "../signal-observation";
import { locateBudgetDocumentPages } from "../page-location";
import { buildPhysicalDocumentReadResultWithGeometry } from "./testing/structure-reconstruction-test-bridge";
import { reconstructBudgetDocumentStructureWithDependencies } from "./reconstruct-budget-document-structure";
import type { StructureReconstructionDependencies } from "./reconstruct-budget-document-structure";
import { reconstructPhysicalLines } from "./physical-line-reconstruction";
import { reconstructHorizontalSegments } from "./horizontal-segment-reconstruction";
import { reconstructPhysicalTextBlocks } from "./physical-text-block-reconstruction";
import type { BudgetDocumentStructureReconstructionInput } from "./budget-document-structure-reconstruction.types";

/**
 * Exercita, de forma direta e controlada, cada uma das três fases de falha
 * estrutural (auditoria pós-PR #69, §5) — via
 * `reconstructBudgetDocumentStructureWithDependencies`, o seam de injeção
 * interno que nunca é exportado por nenhum barrel público e que
 * `reconstructBudgetDocumentStructure` (a única função pública) nunca
 * expõe. Nenhuma das três funções reais de reconstrução (linha/segmento/
 * bloco) tem hoje um caminho natural de exceção a partir de entrada
 * válida — este seam é o único jeito honesto de provar o comportamento
 * correto de cada ramo de falha sem inventar geometria adversarial frágil.
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

const REAL_DEPENDENCIES: StructureReconstructionDependencies = {
  reconstructLines: reconstructPhysicalLines,
  reconstructSegments: reconstructHorizontalSegments,
  reconstructBlocks: reconstructPhysicalTextBlocks,
};

function buildValidInput(): BudgetDocumentStructureReconstructionInput {
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry("failure-injection-fixture", [
    {
      widthPoints: 600,
      heightPoints: 800,
      items: [
        { text: "1.1 Escavação manual", leftPoints: 50, topPoints: 50, rightPoints: 300, bottomPoints: 70 },
        { text: "BDI", leftPoints: 50, topPoints: 90, rightPoints: 90, bottomPoints: 110 },
      ],
    },
  ]);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  return { physicalRead, pageLocation };
}

runTest("sanity: the real dependencies produce a normal, reconstructed page (proves the fixture is meaningful)", () => {
  const input = buildValidInput();
  const result = reconstructBudgetDocumentStructureWithDependencies(input, REAL_DEPENDENCIES);
  assertEqual(result.groups.length > 0, true);
  assertEqual(result.groups[0].pages[0].status, "reconstructed");
  assertEqual(result.groups[0].pages[0].lines.length > 0, true);
});

// --- falha de linha -----------------------------------------------------

runTest("line failure: physical_line_reconstruction_failed, phase line_reconstruction, page not_reconstructable, empty structures, correct item disposition, conservation holds", () => {
  const input = buildValidInput();
  const dependencies: StructureReconstructionDependencies = {
    ...REAL_DEPENDENCIES,
    reconstructLines: () => {
      throw new Error("injected line reconstruction failure");
    },
  };
  const result = reconstructBudgetDocumentStructureWithDependencies(input, dependencies);

  const page = result.groups[0].pages[0];
  assertEqual(page.status, "not_reconstructable");
  assertEqual(page.lines.length, 0);
  assertEqual(page.segments.length, 0);
  assertEqual(page.blocks.length, 0);
  assertEqual(page.technicalProblems.some((p) => p.code === "physical_line_reconstruction_failed" && p.phase === "line_reconstruction"), true);

  const eligibleOutcomes = page.sourceItemOutcomes.filter((o) => o.status === "unresolved_structure_reconstruction_failed");
  assertEqual(eligibleOutcomes.length, 2, "both eligible items on this page must carry the new failure disposition");
  eligibleOutcomes.forEach((outcome) => {
    assertEqual(outcome.status === "unresolved_structure_reconstruction_failed" && outcome.failedPhase, "line_reconstruction");
  });
  assertEqual(page.sourceItemOutcomes.some((o) => o.status === "excluded_outside_page"), false, "a line-reconstruction failure must never be reported as excluded_outside_page");

  const m = page.metrics;
  const sum =
    m.placedTextItemCount +
    m.ignoredWhitespaceOnlyCount +
    m.excludedOutsidePageCount +
    m.unresolvedMissingGeometryCount +
    m.unresolvedInvalidGeometryCount +
    m.unresolvedUnsupportedOrientationCount +
    m.unresolvedNormalizationFailedCount +
    m.unresolvedStructureReconstructionFailedCount;
  assertEqual(sum, m.totalSourceTextItemCount, "conservation invariant must hold even under injected failure");
});

// --- falha de segmento ----------------------------------------------------

runTest("segment failure: horizontal_segment_reconstruction_failed, phase segment_reconstruction, page not_reconstructable, empty structures, correct item disposition, conservation holds", () => {
  const input = buildValidInput();
  const dependencies: StructureReconstructionDependencies = {
    ...REAL_DEPENDENCIES,
    reconstructSegments: () => {
      throw new Error("injected segment reconstruction failure");
    },
  };
  const result = reconstructBudgetDocumentStructureWithDependencies(input, dependencies);

  const page = result.groups[0].pages[0];
  assertEqual(page.status, "not_reconstructable");
  assertEqual(page.lines.length, 0);
  assertEqual(page.segments.length, 0);
  assertEqual(page.blocks.length, 0);
  assertEqual(page.technicalProblems.some((p) => p.code === "horizontal_segment_reconstruction_failed" && p.phase === "segment_reconstruction"), true);
  assertEqual(page.technicalProblems.some((p) => p.code === "physical_line_reconstruction_failed"), false, "must not be misreported as a line failure");

  const eligibleOutcomes = page.sourceItemOutcomes.filter((o) => o.status === "unresolved_structure_reconstruction_failed");
  assertEqual(eligibleOutcomes.length, 2);
  eligibleOutcomes.forEach((outcome) => {
    assertEqual(outcome.status === "unresolved_structure_reconstruction_failed" && outcome.failedPhase, "segment_reconstruction");
  });
  assertEqual(page.sourceItemOutcomes.some((o) => o.status === "excluded_outside_page"), false);

  const m = page.metrics;
  const sum =
    m.placedTextItemCount +
    m.ignoredWhitespaceOnlyCount +
    m.excludedOutsidePageCount +
    m.unresolvedMissingGeometryCount +
    m.unresolvedInvalidGeometryCount +
    m.unresolvedUnsupportedOrientationCount +
    m.unresolvedNormalizationFailedCount +
    m.unresolvedStructureReconstructionFailedCount;
  assertEqual(sum, m.totalSourceTextItemCount);
});

// --- falha de bloco ---------------------------------------------------------

runTest("block failure: physical_block_reconstruction_failed, lines and segments preserved, items placed, blocks empty, page reconstructed_with_problems, conservation holds", () => {
  const input = buildValidInput();
  const dependencies: StructureReconstructionDependencies = {
    ...REAL_DEPENDENCIES,
    reconstructBlocks: () => {
      throw new Error("injected block reconstruction failure");
    },
  };
  const result = reconstructBudgetDocumentStructureWithDependencies(input, dependencies);

  const page = result.groups[0].pages[0];
  assertEqual(page.status, "reconstructed_with_problems");
  assertEqual(page.lines.length > 0, true, "lines must be preserved when only block reconstruction fails");
  assertEqual(page.segments.length > 0, true, "segments must be preserved when only block reconstruction fails");
  assertEqual(page.blocks.length, 0, "blocks must be empty, never partially populated");
  assertEqual(page.technicalProblems.some((p) => p.code === "physical_block_reconstruction_failed" && p.phase === "block_reconstruction"), true);

  const placedOutcomes = page.sourceItemOutcomes.filter((o) => o.status === "placed");
  assertEqual(placedOutcomes.length, 2, "every eligible item must remain placed — a block failure never falsifies item disposition");
  assertEqual(page.sourceItemOutcomes.some((o) => o.status === "unresolved_structure_reconstruction_failed"), false);

  const m = page.metrics;
  const sum =
    m.placedTextItemCount +
    m.ignoredWhitespaceOnlyCount +
    m.excludedOutsidePageCount +
    m.unresolvedMissingGeometryCount +
    m.unresolvedInvalidGeometryCount +
    m.unresolvedUnsupportedOrientationCount +
    m.unresolvedNormalizationFailedCount +
    m.unresolvedStructureReconstructionFailedCount;
  assertEqual(sum, m.totalSourceTextItemCount);
});
