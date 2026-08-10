import type { BudgetTableReconstructionInput } from "../budget-table-reconstruction.types";

export interface SyntheticColumn {
  readonly header: string;
  readonly left: number;
  readonly right: number;
  readonly observedBands?: ReadonlyArray<{
    readonly left: number;
    readonly right: number;
  }>;
}

export interface SyntheticTextPart {
  readonly text: string;
  readonly left: number;
  readonly right: number;
}

export interface SyntheticEntry {
  readonly text: string;
  readonly fromColumn: number;
  readonly toColumn?: number;
  /**
   * Explicit horizontal bounds for this entry's text box, overriding the
   * column-derived ones. Real headers routinely have labels narrower than,
   * or offset from, the column they name -- a centered parent title can even
   * fail to reach its own outer children -- and a fixture that always draws
   * a label exactly as wide as its column cannot represent that at all.
   */
  readonly left?: number;
  readonly right?: number;
  /**
   * Several text items inside ONE segment, each with its own geometry. This
   * is how upstream structure reconstruction frequently reports a run of
   * adjacent economic values: one merged segment whose individual text items
   * are the only per-value geometry available.
   */
  readonly parts?: ReadonlyArray<SyntheticTextPart>;
}

export type SyntheticRow = ReadonlyArray<SyntheticEntry>;

export interface SyntheticPage {
  readonly pageNumber: number;
  readonly includeHeader?: boolean;
  readonly rows: ReadonlyArray<SyntheticRow>;
  /**
   * Replaces the per-SyntheticColumn upstream hypothesis generation for this
   * page with an explicit list of raw hypothesis bands (segment membership
   * still derived from real positive geometric overlap, never invented).
   * Used only to construct a single upstream band that is wider than one
   * real column, so wide-band-splitting tests do not need to fabricate a
   * one-to-one column-to-hypothesis mapping.
   */
  readonly columnHypothesisOverride?: ReadonlyArray<{
    readonly left: number;
    readonly right: number;
  }>;
}

export interface SyntheticFixtureOptions {
  readonly keyPrefix?: string;
  readonly columnEvidence?: "available" | "unavailable";
  readonly physicalCellEvidence?: "available" | "unavailable";
  readonly pageSelection?: ReadonlyArray<number> | "all";
}

function entryLeft(
  sourceEntry: SyntheticEntry,
  columns: ReadonlyArray<SyntheticColumn>,
): number {
  return sourceEntry.left ?? columns[sourceEntry.fromColumn]!.left;
}

function entryRight(
  sourceEntry: SyntheticEntry,
  columns: ReadonlyArray<SyntheticColumn>,
): number {
  return sourceEntry.right ?? columns[sourceEntry.toColumn ?? sourceEntry.fromColumn]!.right;
}

function geometry(left: number, right: number, top: number, bottom: number) {
  return {
    leftPoints: left,
    rightPoints: right,
    topPoints: top,
    bottomPoints: bottom,
    widthPoints: right - left,
    heightPoints: bottom - top,
    centerXPoints: (left + right) / 2,
    centerYPoints: (top + bottom) / 2,
  };
}

export function entry(
  text: string,
  fromColumn: number,
  toColumn = fromColumn,
): SyntheticEntry {
  return { text, fromColumn, toColumn };
}

/** An entry whose text box is given directly rather than derived from a
 * column, for headers whose labels do not span their own column. */
export function placedEntry(
  text: string,
  left: number,
  right: number,
  anchorColumn = 0,
): SyntheticEntry {
  return { text, fromColumn: anchorColumn, toColumn: anchorColumn, left, right };
}

/** One segment holding several independently placed text items. */
export function mergedEntry(
  parts: ReadonlyArray<SyntheticTextPart>,
  anchorColumn = 0,
): SyntheticEntry {
  return {
    text: parts.map((part) => part.text).join(""),
    fromColumn: anchorColumn,
    toColumn: anchorColumn,
    left: Math.min(...parts.map((part) => part.left)),
    right: Math.max(...parts.map((part) => part.right)),
    parts,
  };
}

export function buildSyntheticInput(
  columns: ReadonlyArray<SyntheticColumn>,
  pages: ReadonlyArray<SyntheticPage>,
  options: SyntheticFixtureOptions = {},
): BudgetTableReconstructionInput {
  const sourceByteHash = "a".repeat(64);
  const keyPrefix = options.keyPrefix ?? "runtime";
  const physicalPages: any[] = [];
  const structurePages: any[] = [];
  const columnPages: any[] = [];
  const physicalCellPages: any[] = [];
  const physicalCellTextPages: any[] = [];

  for (const pageSpec of pages) {
    const sourceRows: ReadonlyArray<SyntheticRow> = [
      ...(pageSpec.includeHeader === false
        ? []
        : [columns.map((column, index) => entry(column.header, index))]),
      ...pageSpec.rows,
    ];
    const textItems: any[] = [];
    const lines: any[] = [];
    const segments: any[] = [];
    const sourceItemOutcomes: any[] = [];
    const cellHypotheses: any[] = [];
    const gridIntersections: any[] = [];
    const cellTextEvidences: any[] = [];
    let textItemIndex = 0;

    for (const [rowIndex, row] of sourceRows.entries()) {
      const lineKey = `${keyPrefix}-p${pageSpec.pageNumber}-line-${rowIndex}`;
      const sourceTextItemIndices: number[] = [];
      const segmentKeys: string[] = [];
      for (const [segmentIndex, sourceEntry] of row.entries()) {
        const left = entryLeft(sourceEntry, columns);
        const right = entryRight(sourceEntry, columns);
        const top = rowIndex * 20;
        const bottom = top + 10;
        const segmentKey = `${keyPrefix}-p${pageSpec.pageNumber}-segment-${rowIndex}-${segmentIndex}`;
        const parts: ReadonlyArray<SyntheticTextPart> =
          sourceEntry.parts ?? [{ text: sourceEntry.text, left, right }];
        const partIndices: number[] = [];
        for (const part of parts) {
          const index = textItemIndex;
          textItemIndex += 1;
          partIndices.push(index);
          sourceTextItemIndices.push(index);
          textItems.push({
            index,
            text: part.text,
            placement: {
              status: "placed",
              reasonCode: null,
              geometry: {
                ...geometry(part.left, part.right, top, bottom),
                pageBoundsRelation: "inside",
                coordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
                geometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
              },
            },
          });
          sourceItemOutcomes.push({
            status: "placed",
            sourceTextItemIndex: index,
            lineKey,
            segmentKey,
          });
        }
        segmentKeys.push(segmentKey);
        segments.push({
          segmentKey,
          lineKey,
          pageNumber: pageSpec.pageNumber,
          horizontalOrder: segmentIndex + 1,
          ...geometry(left, right, top, bottom),
          sourceTextItemIndices: partIndices,
          observedInternalGaps: [],
          formationRuleId: "synthetic",
          formationRuleVersion: 1,
          profileId: "synthetic",
          profileVersion: 1,
        });
        const cellHypothesisKey = `${keyPrefix}-cell-hypothesis-${pageSpec.pageNumber}-${rowIndex}-${segmentIndex}`;
        const gridIntersectionKey = `${keyPrefix}-grid-${pageSpec.pageNumber}-${rowIndex}-${segmentIndex}`;
        cellHypotheses.push({
          cellHypothesisKey,
          gridIntersectionKey,
          observedContentBounds: geometry(left, right, top, bottom),
          segmentKeys: [segmentKey],
          cellFormationRuleId: "synthetic",
          cellFormationRuleVersion: 1,
          profileId: "synthetic",
          profileVersion: 1,
        });
        gridIntersections.push({
          gridIntersectionKey,
          sourceLineKey: lineKey,
          // A segment that merges several columns' text has no single
          // physical column hypothesis upstream; modelling it as belonging to
          // one would hand the whole run to that column before geometry is
          // ever consulted, which is not what upstream reports for a merged
          // run.
          sourcePhysicalColumnHypothesisKey:
            parts.length > 1
              ? `${keyPrefix}-merged-run-${pageSpec.pageNumber}-${rowIndex}-${segmentIndex}`
              : `${keyPrefix}-hypothesis-${pageSpec.pageNumber}-${sourceEntry.fromColumn}-0`,
          sourceRegionKey: `${keyPrefix}-region-${pageSpec.pageNumber}`,
          pageNumber: pageSpec.pageNumber,
          rowOrder: rowIndex + 1,
          columnOrder: sourceEntry.fromColumn + 1,
          gridBounds: geometry(left, right, top, bottom),
          status: "cell_hypothesis_formed",
          cellHypothesisKey,
        });
        cellTextEvidences.push({
          cellHypothesisKey,
          gridIntersectionKey,
          status: "formed",
          segmentOutcomes: [
            {
              status: "resolved",
              segmentKey,
              lineKey,
              fragments: parts.map((part, partIndex) => ({
                sourceReferenceOrder: partIndex + 1,
                textItemIndex: partIndices[partIndex]!,
                originalText: part.text,
                normalizedText: part.text.normalize("NFKC"),
              })),
              itemDispositions: parts.map((_, partIndex) => ({
                status: "included_in_text_fragment",
                segmentKey,
                sourceReferenceOrder: partIndex + 1,
                textItemIndex: partIndices[partIndex]!,
              })),
            },
          ],
        });
      }
      const left = Math.min(...row.map((sourceEntry) => entryLeft(sourceEntry, columns)));
      const right = Math.max(...row.map((sourceEntry) => entryRight(sourceEntry, columns)));
      lines.push({
        lineKey,
        pageNumber: pageSpec.pageNumber,
        verticalOrder: rowIndex + 1,
        ...geometry(left, right, rowIndex * 20, rowIndex * 20 + 10),
        seedSourceTextItemIndex: sourceTextItemIndices[0],
        sourceTextItemIndices,
        segmentKeys,
        formationRuleId: "synthetic",
        formationRuleVersion: 1,
        profileId: "synthetic",
        profileVersion: 1,
      });
    }

    physicalPages.push({
      pageNumber: pageSpec.pageNumber,
      widthPoints: 600,
      heightPoints: 800,
      rotationDegrees: 0,
      orientation: "portrait",
      textItems,
      normalizedText: textItems.map((item) => item.text).join(" "),
      metrics: {
        textItemCount: textItems.length,
        nonEmptyCharacterCount: textItems.reduce(
          (total, item) => total + item.text.length,
          0,
        ),
        replacementCharacterCount: 0,
        unexpectedControlCharacterCount: 0,
      },
      textItemPlacementMetrics: {
        totalAdmittedTextItemCount: textItems.length,
        placedTextItemCount: textItems.length,
        unresolvedMissingGeometryCount: 0,
        unresolvedInvalidGeometryCount: 0,
        unresolvedUnsupportedOrientationCount: 0,
        unresolvedNormalizationFailedCount: 0,
      },
      extractionAvailability: "text_available",
      technicalProblems: [],
    });
    structurePages.push({
      pageReconstructionKey: `${keyPrefix}-page-${pageSpec.pageNumber}`,
      pageNumber: pageSpec.pageNumber,
      candidateType: "direct",
      sourceDecisionReasonCode: "candidate_service_item_and_total",
      status: "reconstructed",
      sourceItemOutcomes,
      lines,
      segments,
      blocks: [],
      technicalProblems: [],
      metrics: {},
      profileId: "synthetic",
      profileVersion: 1,
    });
    columnPages.push({
      pageNumber: pageSpec.pageNumber,
      regions: [
        {
          sourceRegionKey: `${keyPrefix}-region-${pageSpec.pageNumber}`,
          hypotheses: pageSpec.columnHypothesisOverride
            ? pageSpec.columnHypothesisOverride.map((observed, index) => ({
                hypothesisKey: `${keyPrefix}-override-hypothesis-${pageSpec.pageNumber}-${index}`,
                pageNumber: pageSpec.pageNumber,
                order: index + 1,
                contributingAlignmentKeys: [],
                lineKeys: lines.map((line) => line.lineKey),
                segmentKeys: segments
                  .filter(
                    (segment) =>
                      segment.leftPoints < observed.right && segment.rightPoints > observed.left,
                  )
                  .map((segment) => segment.segmentKey),
                ...geometry(observed.left, observed.right, 0, sourceRows.length * 20),
                formationRuleId: "synthetic",
                formationRuleVersion: 1,
                profileId: "synthetic",
                profileVersion: 1,
              }))
            : columns.flatMap((column, columnIndex) =>
                (column.observedBands ?? [{ left: column.left, right: column.right }]).map(
                  (observed, observationIndex) => ({
                hypothesisKey: `${keyPrefix}-hypothesis-${pageSpec.pageNumber}-${columnIndex}-${observationIndex}`,
                pageNumber: pageSpec.pageNumber,
                order: columnIndex + 1,
                contributingAlignmentKeys: [],
                lineKeys: lines.map((line) => line.lineKey),
                segmentKeys: segments
                  .filter(
                    (segment) =>
                      segment.leftPoints >= column.left && segment.rightPoints <= column.right,
                  )
                  .map((segment) => segment.segmentKey),
                ...geometry(observed.left, observed.right, 0, sourceRows.length * 20),
                formationRuleId: "synthetic",
                formationRuleVersion: 1,
                profileId: "synthetic",
                profileVersion: 1,
              }))),
        },
      ],
    });
    physicalCellPages.push({
      pageNumber: pageSpec.pageNumber,
      regions: [{
        sourceRegionKey: `${keyPrefix}-region-${pageSpec.pageNumber}`,
        gridIntersections,
        cellHypotheses,
      }],
    });
    physicalCellTextPages.push({
      pageNumber: pageSpec.pageNumber,
      regions: [{
        sourceRegionKey: `${keyPrefix}-region-${pageSpec.pageNumber}`,
        cellTextEvidences,
      }],
    });
  }

  const physicalRead: any = {
    schemaVersion: 2,
    readerName: "physical-document-reader",
    readerVersion: "physical-document-reader-v2",
    adapterVersion: "synthetic-adapter",
    underlyingLibraryVersion: "synthetic-library",
    sourceByteHash,
    totalPageCount: physicalPages.length,
    pages: physicalPages,
    status: "completed",
    technicalProblems: [],
    textItemCoordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
    textItemGeometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
    geometryContextFingerprintVersion: "physical-document-geometry-context-fingerprint-v1",
    geometryContextFingerprint: "b".repeat(64),
  };
  const pageLocation: any = {
    schemaVersion: 1,
    locatorName: "budget-document-page-locator",
    locatorVersion: "budget-document-page-locator-v1",
    decisionRuleSetVersion: "synthetic-rules",
    sourceByteHash,
    status: "completed",
    candidateGroups: [],
    pageDecisions: [],
  };
  const structureReconstruction: any = {
    schemaVersion: 1,
    reconstructorName: "budget-document-structure-reconstructor",
    reconstructorVersion: "budget-document-structure-reconstructor-v1",
    reconstructionProfileId: "synthetic",
    reconstructionProfileVersion: 1,
    reconstructionContextFingerprintVersion: "v1",
    reconstructionContextFingerprint: "c".repeat(64),
    sourceByteHash,
    physicalReaderName: physicalRead.readerName,
    physicalReaderVersion: physicalRead.readerVersion,
    physicalAdapterVersion: physicalRead.adapterVersion,
    physicalUnderlyingLibraryVersion: physicalRead.underlyingLibraryVersion,
    physicalTextItemCoordinateSpaceVersion: physicalRead.textItemCoordinateSpaceVersion,
    physicalTextItemGeometryProfileVersion: physicalRead.textItemGeometryProfileVersion,
    physicalGeometryContextFingerprintVersion: physicalRead.geometryContextFingerprintVersion,
    physicalGeometryContextFingerprint: physicalRead.geometryContextFingerprint,
    pageLocatorName: pageLocation.locatorName,
    pageLocatorVersion: pageLocation.locatorVersion,
    groups: [{ pages: structurePages }],
    status: "completed",
  };
  const columnResult: any = {
    schemaVersion: 1,
    reconstructorName: "budget-document-physical-column-hypothesis-reconstructor",
    reconstructorVersion: "v1",
    reconstructionProfileId: "synthetic",
    reconstructionProfileVersion: 1,
    reconstructionContextFingerprintVersion: "v1",
    reconstructionContextFingerprint: "d".repeat(64),
    sourceByteHash,
    sourceStructureReconstructionContextFingerprint:
      structureReconstruction.reconstructionContextFingerprint,
    groups: [{ pages: columnPages }],
    status: "completed",
  };
  const cellHypothesisFormation: any = {
    sourceByteHash,
    sourceStructureReconstructionContextFingerprint:
      structureReconstruction.reconstructionContextFingerprint,
    formationContextFingerprint: "e".repeat(64),
    groups: [{ pages: physicalCellPages }],
    status: "completed",
  };
  const cellTextEvidenceFormation: any = {
    sourceByteHash,
    sourceStructureReconstructionContextFingerprint:
      structureReconstruction.reconstructionContextFingerprint,
    sourcePhysicalCellHypothesisFormationContextFingerprint:
      cellHypothesisFormation.formationContextFingerprint,
    formationContextFingerprint: "f".repeat(64),
    groups: [{ pages: physicalCellTextPages }],
    status: "completed",
  };

  return {
    physicalRead,
    pageLocation,
    structureReconstruction,
    pageSelection: options.pageSelection ?? "all",
    columnEvidence:
      options.columnEvidence === "unavailable"
        ? { availability: "unavailable", reasonCode: "synthetic_unavailable" }
        : { availability: "available", result: columnResult },
    physicalCellEvidence:
      options.physicalCellEvidence === "unavailable"
        ? { availability: "unavailable", reasonCode: "synthetic_unavailable" }
        : {
            availability: "available",
            cellHypothesisFormation,
            cellTextEvidenceFormation,
          },
  };
}
