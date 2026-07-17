import { observeDocumentSignals } from "../signal-observation";
import { locateBudgetDocumentPages } from "../page-location";
import { buildPhysicalDocumentReadResultWithGeometry } from "./testing/structure-reconstruction-test-bridge";
import type { SyntheticGeometryPage } from "./testing/structure-reconstruction-test-bridge";
import { reconstructBudgetDocumentStructure } from "./reconstruct-budget-document-structure";
import { BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1 } from "./structure-reconstruction-profile";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;

const TWO_PAGE_BUDGET_LIKE_DOCUMENT: ReadonlyArray<SyntheticGeometryPage> = [
  {
    widthPoints: PAGE_WIDTH,
    heightPoints: PAGE_HEIGHT,
    items: [
      { text: "1.1 Escavação manual", leftPoints: 50, topPoints: 50, rightPoints: 300, bottomPoints: 70 },
      { text: "BDI", leftPoints: 50, topPoints: 90, rightPoints: 90, bottomPoints: 110 },
      { text: "15%", leftPoints: 110, topPoints: 90, rightPoints: 150, bottomPoints: 110 },
      { text: "1.2 Concreto armado", leftPoints: 50, topPoints: 130, rightPoints: 320, bottomPoints: 150 },
    ],
  },
  {
    widthPoints: PAGE_WIDTH,
    heightPoints: PAGE_HEIGHT,
    items: [{ text: "Total Geral: 1000", leftPoints: 50, topPoints: 50, rightPoints: 250, bottomPoints: 70 }],
  },
];

function buildEndToEndResult() {
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry("chain-fixture", TWO_PAGE_BUDGET_LIKE_DOCUMENT);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  return { physicalRead, pageLocation, result: reconstructBudgetDocumentStructure({ physicalRead, pageLocation }) };
}

// --- full chain (§58) --------------------------------------------------------

runTest("full chain: PDF sintético -> physical read v2 -> signal observation -> page location -> structure reconstruction produces at least one candidate group with lines, segments and blocks", () => {
  const { pageLocation, result } = buildEndToEndResult();

  assertEqual(pageLocation.candidateGroups.length > 0, true, "expected the synthetic fixture to produce at least one candidate group");
  assertEqual(result.groups.length, pageLocation.candidateGroups.length);
  assertEqual(result.status === "completed" || result.status === "completed_with_problems", true);

  const totalLines = result.groups.reduce((sum, g) => sum + g.metrics.lineCount, 0);
  const totalSegments = result.groups.reduce((sum, g) => sum + g.metrics.segmentCount, 0);
  const totalBlocks = result.groups.reduce((sum, g) => sum + g.metrics.blockCount, 0);
  assertEqual(totalLines > 0, true, "expected at least one reconstructed line");
  assertEqual(totalSegments > 0, true, "expected at least one reconstructed segment");
  assertEqual(totalBlocks > 0, true, "expected at least one reconstructed block");
});

runTest("full chain: preserves source byte hash, physical/page-location versions and candidate group keys", () => {
  const { physicalRead, pageLocation, result } = buildEndToEndResult();

  assertEqual(result.sourceByteHash, physicalRead.sourceByteHash);
  assertEqual(result.physicalReadSchemaVersion, physicalRead.schemaVersion);
  assertEqual(result.physicalReaderVersion, physicalRead.readerVersion);
  assertEqual(result.pageLocationSchemaVersion, pageLocation.schemaVersion);
  assertEqual(result.pageLocatorVersion, pageLocation.locatorVersion);

  result.groups.forEach((group, index) => {
    assertEqual(group.sourceCandidateGroupKey, pageLocation.candidateGroups[index].groupKey);
  });
});

runTest("full chain: a group with a closing candidate reports hasClosingPage true", () => {
  const { result } = buildEndToEndResult();
  const closingGroup = result.groups.find((group) => group.candidateTypesPresent.includes("closing"));
  assertEqual(closingGroup !== undefined, true, "expected the fixture to produce a group with a closing candidate");
  assertEqual(closingGroup?.hasClosingPage, true);
});

runTest("full chain: never produces an economic-domain field key in the result shape", () => {
  const { result } = buildEndToEndResult();
  const serialized = JSON.stringify(result);
  // Field-key form only ("name":) — the limitations array legitimately
  // contains negative declarations like "no_quantity_read" as string
  // *values*, which must not be mistaken for a field being present.
  ["\"quantity\":", "\"unitPrice\":", "\"totalValue\":", "\"bdiPercentage\":", "\"budgetLine\":", "\"economicColumn\":", "\"column\":"].forEach((forbidden) => {
    assertEqual(serialized.includes(forbidden), false, `result must never contain field key ${forbidden}`);
  });
});

// --- conservation (§21, applied end to end) ----------------------------------

runTest("full chain: item conservation holds for every reconstructed page", () => {
  const { result } = buildEndToEndResult();
  result.groups.forEach((group) => {
    group.pages.forEach((page) => {
      const m = page.metrics;
      const sum =
        m.placedTextItemCount +
        m.ignoredWhitespaceOnlyCount +
        m.excludedOutsidePageCount +
        m.unresolvedMissingGeometryCount +
        m.unresolvedInvalidGeometryCount +
        m.unresolvedUnsupportedOrientationCount +
        m.unresolvedNormalizationFailedCount;
      assertEqual(sum, m.totalSourceTextItemCount, `conservation invariant broken on page ${page.pageNumber}`);
      assertEqual(page.sourceItemOutcomes.length, m.totalSourceTextItemCount);
    });
  });
});

// --- determinism (§53, applied end to end) -----------------------------------

runTest("full chain: identical input produces a JSON-equivalent result", () => {
  const { physicalRead, pageLocation } = buildEndToEndResult();
  const first = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const second = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  assertEqual(JSON.stringify(first), JSON.stringify(second));
});

runTest("full chain: reports the versioned, non-calibrated profile identity", () => {
  const { result } = buildEndToEndResult();
  assertEqual(result.reconstructionProfileId, BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1.profileId);
  assertEqual(result.reconstructionProfileVersion, BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1.profileVersion);
});

// --- matriz de falhas (§51) --------------------------------------------------

runTest("no candidate group in the document: global status completed, groups empty", () => {
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry("no-candidates-fixture", [
    { widthPoints: PAGE_WIDTH, heightPoints: PAGE_HEIGHT, items: [{ text: "Nothing budget-related here.", leftPoints: 50, topPoints: 50, rightPoints: 300, bottomPoints: 70 }] },
  ]);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const result = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  assertEqual(pageLocation.candidateGroups.length, 0, "fixture must genuinely produce zero candidate groups");
  assertEqual(result.status, "completed");
  assertEqual(result.groups.length, 0);
});

runTest("an invalid input (tampered physical read fingerprint): global status failed, no groups", () => {
  const { physicalRead, pageLocation } = buildEndToEndResult();
  const tamperedPhysicalRead = { ...physicalRead, geometryContextFingerprint: "0".repeat(64) };
  const result = reconstructBudgetDocumentStructure({ physicalRead: tamperedPhysicalRead, pageLocation });
  assertEqual(result.status, "failed");
  assertEqual(result.groups.length, 0);
  assertEqual(result.technicalProblems.some((p) => p.code === "geometry_context_fingerprint_invalid"), true);
});

runTest("a candidate page whose only signal-bearing items are entirely outside the page bounds is not_reconstructable, and its group follows suit", () => {
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry("all-outside-fixture", [
    {
      widthPoints: PAGE_WIDTH,
      heightPoints: PAGE_HEIGHT,
      items: [
        { text: "1.1 Item fora da página", leftPoints: -2000, topPoints: -2000, rightPoints: -1900, bottomPoints: -1980 },
        { text: "BDI", leftPoints: -2000, topPoints: -1950, rightPoints: -1950, bottomPoints: -1930 },
      ],
    },
  ]);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  assertEqual(pageLocation.candidateGroups.length > 0, true, "the page must still be classified as a candidate by text-only signal rules");

  const result = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  assertEqual(result.groups[0].pages[0].status, "not_reconstructable");
  assertEqual(result.groups[0].status, "not_reconstructable");
  assertEqual(result.status, "completed_with_problems");
  assertEqual(result.groups[0].pages[0].technicalProblems.some((p) => p.code === "candidate_page_has_no_eligible_items"), true);
});

runTest("a candidate page with an item partially outside the page bounds is reconstructed_with_problems, not discarded", () => {
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry("partially-outside-fixture", [
    {
      widthPoints: PAGE_WIDTH,
      heightPoints: PAGE_HEIGHT,
      items: [
        { text: "1.1 Item parcialmente fora", leftPoints: 50, topPoints: 50, rightPoints: PAGE_WIDTH + 100, bottomPoints: 70 },
        { text: "BDI", leftPoints: 50, topPoints: 90, rightPoints: 90, bottomPoints: 110 },
      ],
    },
  ]);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const result = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });

  assertEqual(result.groups[0].pages[0].status, "reconstructed_with_problems");
  assertEqual(result.groups[0].pages[0].technicalProblems.some((p) => p.code === "candidate_page_contains_partially_outside_items"), true);
  // The item is excluded from the structure entirely — it must still be audited as "placed", not dropped.
  const placedOutcome = result.groups[0].pages[0].sourceItemOutcomes.find((o) => o.status === "placed" && o.sourceTextItemIndex === 0);
  assertEqual(placedOutcome !== undefined, true, "a partially-outside item must still be placed into a line/segment, not discarded from the structure");
});

// --- invariantes cruzadas (§59) ----------------------------------------------

runTest("cross invariants: segments reference only placed items, and each placed item belongs to exactly one segment", () => {
  const { result } = buildEndToEndResult();
  result.groups.forEach((group) => {
    group.pages.forEach((page) => {
      const placedIndices = new Set(page.sourceItemOutcomes.filter((o) => o.status === "placed").map((o) => o.sourceTextItemIndex));
      const segmentItemOccurrences = new Map<number, number>();
      page.segments.forEach((segment) => {
        segment.sourceTextItemIndices.forEach((index) => {
          assertEqual(placedIndices.has(index), true, `segment ${segment.segmentKey} references non-placed item ${index}`);
          segmentItemOccurrences.set(index, (segmentItemOccurrences.get(index) ?? 0) + 1);
        });
      });
      placedIndices.forEach((index) => {
        assertEqual(segmentItemOccurrences.get(index), 1, `placed item ${index} must belong to exactly one segment`);
      });
    });
  });
});

runTest("cross invariants: each segment belongs to exactly one line", () => {
  const { result } = buildEndToEndResult();
  result.groups.forEach((group) => {
    group.pages.forEach((page) => {
      const segmentKeyOwners = new Map<string, number>();
      page.lines.forEach((line) => {
        line.segmentKeys.forEach((key) => segmentKeyOwners.set(key, (segmentKeyOwners.get(key) ?? 0) + 1));
      });
      page.segments.forEach((segment) => {
        assertEqual(segmentKeyOwners.get(segment.segmentKey), 1, `segment ${segment.segmentKey} must belong to exactly one line`);
      });
    });
  });
});

runTest("cross invariants: each block references only lines and segments that exist on the same page", () => {
  const { result } = buildEndToEndResult();
  result.groups.forEach((group) => {
    group.pages.forEach((page) => {
      const lineKeys = new Set(page.lines.map((l) => l.lineKey));
      const segmentKeys = new Set(page.segments.map((s) => s.segmentKey));
      page.blocks.forEach((block) => {
        block.lineKeys.forEach((key) => assertEqual(lineKeys.has(key), true, `block ${block.blockKey} references unknown line ${key}`));
        block.segmentKeys.forEach((key) => assertEqual(segmentKeys.has(key), true, `block ${block.blockKey} references unknown segment ${key}`));
      });
    });
  });
});

runTest("cross invariants: no line, segment or block key is duplicated within a page, and none crosses a page boundary", () => {
  const { result } = buildEndToEndResult();
  result.groups.forEach((group) => {
    group.pages.forEach((page) => {
      assertEqual(new Set(page.lines.map((l) => l.lineKey)).size, page.lines.length, `duplicate line key on page ${page.pageNumber}`);
      assertEqual(new Set(page.segments.map((s) => s.segmentKey)).size, page.segments.length, `duplicate segment key on page ${page.pageNumber}`);
      assertEqual(new Set(page.blocks.map((b) => b.blockKey)).size, page.blocks.length, `duplicate block key on page ${page.pageNumber}`);
      page.lines.forEach((line) => assertEqual(line.pageNumber, page.pageNumber));
      page.segments.forEach((segment) => assertEqual(segment.pageNumber, page.pageNumber));
      page.blocks.forEach((block) => assertEqual(block.pageNumber, page.pageNumber));
    });
    const allPageKeysAcrossGroup = group.pages.map((p) => p.pageReconstructionKey);
    assertEqual(new Set(allPageKeysAcrossGroup).size, allPageKeysAcrossGroup.length, "duplicate page reconstruction key within a group");
  });
  const allGroupKeys = result.groups.map((g) => g.groupReconstructionKey);
  assertEqual(new Set(allGroupKeys).size, allGroupKeys.length, "duplicate group reconstruction key");
});
