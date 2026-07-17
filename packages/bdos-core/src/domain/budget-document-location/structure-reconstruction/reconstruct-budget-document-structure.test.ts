import { observeDocumentSignals } from "../signal-observation";
import { locateBudgetDocumentPages } from "../page-location";
import { buildPhysicalDocumentReadResultWithGeometry } from "./testing/structure-reconstruction-test-bridge";
import type { SyntheticGeometryPage } from "./testing/structure-reconstruction-test-bridge";
import { reconstructBudgetDocumentStructure } from "./reconstruct-budget-document-structure";
import { BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1 } from "./structure-reconstruction-profile";
import type { SourceTextItemReconstructionOutcome } from "./budget-document-structure-reconstruction.types";

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

// --- pipeline geométrico sintético (ponte de teste, não PDF real) -----------
// Esta seção NUNCA lê um PDF real nem usa `pdfjsPhysicalDocumentReader` — ela
// usa `structure-reconstruction-test-bridge.ts` para produzir um
// `PhysicalDocumentReadResult` já geometricamente posicionado. Útil para
// testes de unidade e integração controlada do reconstrutor, mas nunca a
// prova de que o adaptador real produz um contrato compatível (auditoria
// pós-PR #69, §2). Essa prova vive em
// `reconstruct-budget-document-structure.real-pdf-chain.test.ts`.

runTest("synthetic geometry pipeline (bridge, not real PDF): produces at least one candidate group with lines, segments and blocks", () => {
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

runTest("synthetic geometry pipeline: preserves source byte hash, physical/page-location versions and candidate group keys", () => {
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

runTest("synthetic geometry pipeline: a group with a closing candidate reports hasClosingPage true", () => {
  const { result } = buildEndToEndResult();
  const closingGroup = result.groups.find((group) => group.candidateTypesPresent.includes("closing"));
  assertEqual(closingGroup !== undefined, true, "expected the fixture to produce a group with a closing candidate");
  assertEqual(closingGroup?.hasClosingPage, true);
});

runTest("synthetic geometry pipeline: never produces an economic-domain field key in the result shape", () => {
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

runTest("synthetic geometry pipeline: item conservation holds for every reconstructed page", () => {
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
        m.unresolvedNormalizationFailedCount +
        m.unresolvedStructureReconstructionFailedCount;
      assertEqual(sum, m.totalSourceTextItemCount, `conservation invariant broken on page ${page.pageNumber}`);
      assertEqual(page.sourceItemOutcomes.length, m.totalSourceTextItemCount);
    });
  });
});

// --- exaustividade tipológica das métricas por disposição (auditoria pós-PR #69, §4) ---

runTest("every SourceTextItemReconstructionOutcome status is accounted for at the type level — a new variant must update this map or fail to compile", () => {
  // A `Record` requires every key of the union to be present (TypeScript
  // rejects both a missing key and an extra one). If a future status is
  // added to `SourceTextItemReconstructionOutcome` without adding it here,
  // this file stops compiling — the same guarantee that makes
  // `computePageMetrics`'s internal `default: return assertUnreachableOutcome(outcome)`
  // a compile error instead of a silently-uncounted variant.
  const exhaustiveOutcomeStatusCheck: Record<SourceTextItemReconstructionOutcome["status"], true> = {
    placed: true,
    ignored_whitespace_only: true,
    excluded_outside_page: true,
    unresolved_source_geometry_missing: true,
    unresolved_source_geometry_invalid: true,
    unresolved_source_orientation_unsupported: true,
    unresolved_source_geometry_normalization_failed: true,
    unresolved_structure_reconstruction_failed: true,
  };
  assertEqual(Object.keys(exhaustiveOutcomeStatusCheck).length, 8);
});

// --- determinism (§53, applied end to end) -----------------------------------

runTest("synthetic geometry pipeline: identical input produces a JSON-equivalent result", () => {
  const { physicalRead, pageLocation } = buildEndToEndResult();
  const first = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const second = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  assertEqual(JSON.stringify(first), JSON.stringify(second));
});

runTest("synthetic geometry pipeline: reports the versioned, non-calibrated profile identity", () => {
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

// --- canonicalização da fronteira de saída (auditoria pós-PR #69, §7) -------

runTest("a derived center coordinate that would carry a binary floating point artifact is canonicalized in the output", () => {
  // left=0.1, right=0.2: individually clean, but (0.1 + 0.2) / 2 in IEEE754
  // is 0.15000000000000002, not 0.15 — the exact artifact this fix targets.
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry("canonicalization-artifact-fixture", [
    {
      widthPoints: 600,
      heightPoints: 800,
      items: [
        { text: "1.1 X", leftPoints: 0.1, topPoints: 0.1, rightPoints: 0.2, bottomPoints: 0.2 },
        { text: "BDI", leftPoints: 50, topPoints: 90, rightPoints: 90, bottomPoints: 110 },
      ],
    },
  ]);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const result = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });

  const artifactLine = result.groups[0].pages[0].lines.find((line) => line.leftPoints === 0.1);
  assertEqual(artifactLine !== undefined, true, "expected to find the reconstructed line for the artifact-prone item");
  assertEqual(artifactLine?.centerXPoints, 0.15, "the raw IEEE754 artifact (0.15000000000000002) must be canonicalized away in the output");
  assertEqual(artifactLine?.centerYPoints, 0.15);
  assertEqual(artifactLine?.widthPoints, 0.1, "width must be derived from the canonicalized left/right, not independently re-canonicalized");
  assertEqual(artifactLine?.heightPoints, 0.1);

  // The single artifact-prone item forms its own line, segment and block —
  // the same coherence must hold for all three shapes, not only the line.
  const artifactSegment = result.groups[0].pages[0].segments.find((segment) => segment.leftPoints === 0.1);
  assertEqual(artifactSegment !== undefined, true, "expected to find the reconstructed segment for the artifact-prone item");
  assertEqual(artifactSegment?.centerXPoints, 0.15);
  assertEqual(artifactSegment?.centerYPoints, 0.15);
  assertEqual(artifactSegment?.widthPoints, 0.1);

  const artifactBlock = result.groups[0].pages[0].blocks.find((block) => block.leftPoints === 0.1);
  assertEqual(artifactBlock !== undefined, true, "expected to find the reconstructed block for the artifact-prone item");
  assertEqual(artifactBlock?.centerXPoints, 0.15);
  assertEqual(artifactBlock?.centerYPoints, 0.15);
  assertEqual(artifactBlock?.widthPoints, 0.1);

  // Every geometric field on every line/segment/block, across the whole
  // result, must round-trip through six-decimal canonicalization exactly.
  result.groups.forEach((group) =>
    group.pages.forEach((page) => {
      [...page.lines, ...page.segments, ...page.blocks].forEach((shape) => {
        (["leftPoints", "topPoints", "rightPoints", "bottomPoints", "widthPoints", "heightPoints", "centerXPoints", "centerYPoints"] as const).forEach((field) => {
          const value = shape[field];
          const rounded = Math.round(value * 1e6) / 1e6;
          assertEqual(value, rounded, `${field} on page ${page.pageNumber} is not canonicalized to six decimal places: ${value}`);
        });
      });
      page.segments.forEach((segment) => {
        segment.observedInternalGaps.forEach((gap) => {
          assertEqual(gap, Math.round(gap * 1e6) / 1e6, `observedInternalGaps entry is not canonicalized: ${gap}`);
        });
      });
    }),
  );
});

// --- disposição correta em falha estrutural (auditoria pós-PR #69, §3) ------

runTest("excluded_outside_page is only ever produced for items whose source geometry was genuinely outside the page — never as a structural-failure fallback", () => {
  const { physicalRead, result } = buildEndToEndResult();
  result.groups.forEach((group) => {
    group.pages.forEach((page) => {
      const physicalPage = physicalRead.pages.find((p) => p.pageNumber === page.pageNumber)!;
      page.sourceItemOutcomes.forEach((outcome) => {
        if (outcome.status !== "excluded_outside_page") {
          return;
        }
        const sourceItem = physicalPage.textItems[outcome.sourceTextItemIndex];
        assertEqual(sourceItem.placement.status, "placed");
        assertEqual(
          sourceItem.placement.status === "placed" ? sourceItem.placement.geometry.pageBoundsRelation : null,
          "outside",
          `item ${outcome.sourceTextItemIndex} was marked excluded_outside_page but its source geometry was not actually "outside"`,
        );
      });
    });
  });
});

// --- resultado expõe todas as identidades individuais (auditoria pós-PR #69, §6) ---

runTest("the result exposes every individual source identity, not only the summarizing fingerprint", () => {
  const { physicalRead, pageLocation, result } = buildEndToEndResult();
  assertEqual(result.physicalAdapterVersion, physicalRead.adapterVersion);
  assertEqual(result.physicalUnderlyingLibraryVersion, physicalRead.underlyingLibraryVersion);
  assertEqual(result.physicalTextItemCoordinateSpaceVersion, physicalRead.textItemCoordinateSpaceVersion);
  assertEqual(result.physicalTextItemGeometryProfileVersion, physicalRead.textItemGeometryProfileVersion);
  assertEqual(result.physicalGeometryContextFingerprintVersion, physicalRead.geometryContextFingerprintVersion);
  assertEqual(result.physicalGeometryContextFingerprint, physicalRead.geometryContextFingerprint);
  assertEqual(result.pageLocationDecisionRuleSetVersion, pageLocation.decisionRuleSetVersion);
  assertEqual(result.sourceObservationSchemaVersion, pageLocation.sourceObservationSchemaVersion);
  assertEqual(result.sourceObserverName, pageLocation.sourceObserverName);
  assertEqual(result.sourceObserverVersion, pageLocation.sourceObserverVersion);
  assertEqual(result.sourceObservationRuleSetVersion, pageLocation.sourceObservationRuleSetVersion);
  assertEqual(result.sourceCatalogVersion, pageLocation.sourceCatalogVersion);
});

runTest("a failed result still exposes every individual source identity, not just an empty fingerprint", () => {
  const { physicalRead, pageLocation } = buildEndToEndResult();
  const tamperedPhysicalRead = { ...physicalRead, geometryContextFingerprint: "0".repeat(64) };
  const result = reconstructBudgetDocumentStructure({ physicalRead: tamperedPhysicalRead, pageLocation });
  assertEqual(result.status, "failed");
  assertEqual(result.physicalAdapterVersion, tamperedPhysicalRead.adapterVersion);
  assertEqual(result.physicalUnderlyingLibraryVersion, tamperedPhysicalRead.underlyingLibraryVersion);
  assertEqual(result.sourceObserverName, pageLocation.sourceObserverName);
  assertEqual(result.pageLocationDecisionRuleSetVersion, pageLocation.decisionRuleSetVersion);
});

// --- independência integral da ordem dos itens (auditoria pós-PR #69, seguimento §2) ---

runTest("the entire reconstructed result — including sourceItemOutcomes order — is JSON-equivalent for a permuted item array with the same indices and geometries", () => {
  const SAME_LABEL = "order-independence-full-result-fixture";

  const naturalOrderPages: ReadonlyArray<SyntheticGeometryPage> = [
    {
      widthPoints: PAGE_WIDTH,
      heightPoints: PAGE_HEIGHT,
      items: [
        { text: "1.1 Escavação manual", leftPoints: 50, topPoints: 50, rightPoints: 300, bottomPoints: 70, index: 0 },
        { text: "BDI", leftPoints: 50, topPoints: 90, rightPoints: 90, bottomPoints: 110, index: 1 },
        { text: "15%", leftPoints: 110, topPoints: 90, rightPoints: 150, bottomPoints: 110, index: 2 },
        { text: "1.2 Concreto armado", leftPoints: 50, topPoints: 130, rightPoints: 320, bottomPoints: 150, index: 3 },
      ],
    },
    {
      widthPoints: PAGE_WIDTH,
      heightPoints: PAGE_HEIGHT,
      items: [{ text: "Total Geral: 1000", leftPoints: 50, topPoints: 50, rightPoints: 250, bottomPoints: 70, index: 0 }],
    },
  ];

  // Same items, same explicit indices, same geometries — only the array
  // position (never the index or the geometry) is permuted.
  const shuffledOrderPages: ReadonlyArray<SyntheticGeometryPage> = [
    {
      widthPoints: PAGE_WIDTH,
      heightPoints: PAGE_HEIGHT,
      items: [
        { text: "1.2 Concreto armado", leftPoints: 50, topPoints: 130, rightPoints: 320, bottomPoints: 150, index: 3 },
        { text: "BDI", leftPoints: 50, topPoints: 90, rightPoints: 90, bottomPoints: 110, index: 1 },
        { text: "1.1 Escavação manual", leftPoints: 50, topPoints: 50, rightPoints: 300, bottomPoints: 70, index: 0 },
        { text: "15%", leftPoints: 110, topPoints: 90, rightPoints: 150, bottomPoints: 110, index: 2 },
      ],
    },
    {
      widthPoints: PAGE_WIDTH,
      heightPoints: PAGE_HEIGHT,
      items: [{ text: "Total Geral: 1000", leftPoints: 50, topPoints: 50, rightPoints: 250, bottomPoints: 70, index: 0 }],
    },
  ];

  const naturalPhysicalRead = buildPhysicalDocumentReadResultWithGeometry(SAME_LABEL, naturalOrderPages);
  const shuffledPhysicalRead = buildPhysicalDocumentReadResultWithGeometry(SAME_LABEL, shuffledOrderPages);
  assertEqual(naturalPhysicalRead.sourceByteHash, shuffledPhysicalRead.sourceByteHash, "test setup: both fixtures must share the same source identity for this to be a fair comparison");

  const naturalResult = reconstructBudgetDocumentStructure({
    physicalRead: naturalPhysicalRead,
    pageLocation: locateBudgetDocumentPages(observeDocumentSignals(naturalPhysicalRead)),
  });
  const shuffledResult = reconstructBudgetDocumentStructure({
    physicalRead: shuffledPhysicalRead,
    pageLocation: locateBudgetDocumentPages(observeDocumentSignals(shuffledPhysicalRead)),
  });

  // Sanity: prove the fixture actually produced real structure, so this
  // isn't a vacuous "two empty results are equal" pass.
  assertEqual(naturalResult.groups.length > 0, true);
  assertEqual(naturalResult.groups.reduce((sum, g) => sum + g.metrics.lineCount, 0) > 0, true);

  assertEqual(JSON.stringify(naturalResult), JSON.stringify(shuffledResult));
});
