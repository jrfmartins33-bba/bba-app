import type { BudgetTableReconstructionInput } from "../budget-table-reconstruction.types";

export interface SyntheticColumn {
  readonly header: string;
  readonly left: number;
  readonly right: number;
}

export interface SyntheticEntry {
  readonly text: string;
  readonly fromColumn: number;
  readonly toColumn?: number;
}

export type SyntheticRow = ReadonlyArray<SyntheticEntry>;

export interface SyntheticPage {
  readonly pageNumber: number;
  readonly includeHeader?: boolean;
  readonly rows: ReadonlyArray<SyntheticRow>;
}

export interface SyntheticFixtureOptions {
  readonly keyPrefix?: string;
  readonly columnEvidence?: "available" | "unavailable";
  readonly physicalCellEvidence?: "available" | "unavailable";
  readonly pageSelection?: ReadonlyArray<number> | "all";
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
    let textItemIndex = 0;

    for (const [rowIndex, row] of sourceRows.entries()) {
      const lineKey = `${keyPrefix}-p${pageSpec.pageNumber}-line-${rowIndex}`;
      const sourceTextItemIndices: number[] = [];
      const segmentKeys: string[] = [];
      for (const [segmentIndex, sourceEntry] of row.entries()) {
        const toColumn = sourceEntry.toColumn ?? sourceEntry.fromColumn;
        const left = columns[sourceEntry.fromColumn]!.left;
        const right = columns[toColumn]!.right;
        const top = rowIndex * 20;
        const bottom = top + 10;
        const segmentKey = `${keyPrefix}-p${pageSpec.pageNumber}-segment-${rowIndex}-${segmentIndex}`;
        const index = textItemIndex;
        textItemIndex += 1;
        sourceTextItemIndices.push(index);
        segmentKeys.push(segmentKey);
        textItems.push({
          index,
          text: sourceEntry.text,
          placement: {
            status: "placed",
            reasonCode: null,
            geometry: {
              ...geometry(left, right, top, bottom),
              pageBoundsRelation: "inside",
              coordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
              geometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
            },
          },
        });
        segments.push({
          segmentKey,
          lineKey,
          pageNumber: pageSpec.pageNumber,
          horizontalOrder: segmentIndex + 1,
          ...geometry(left, right, top, bottom),
          sourceTextItemIndices: [index],
          observedInternalGaps: [],
          formationRuleId: "synthetic",
          formationRuleVersion: 1,
          profileId: "synthetic",
          profileVersion: 1,
        });
        sourceItemOutcomes.push({
          status: "placed",
          sourceTextItemIndex: index,
          lineKey,
          segmentKey,
        });
        cellHypotheses.push({
          cellHypothesisKey: `${keyPrefix}-cell-hypothesis-${pageSpec.pageNumber}-${rowIndex}-${segmentIndex}`,
          gridIntersectionKey: `${keyPrefix}-grid-${pageSpec.pageNumber}-${rowIndex}-${segmentIndex}`,
          observedContentBounds: geometry(left, right, top, bottom),
          segmentKeys: [segmentKey],
          cellFormationRuleId: "synthetic",
          cellFormationRuleVersion: 1,
          profileId: "synthetic",
          profileVersion: 1,
        });
      }
      const left = Math.min(...row.map((sourceEntry) => columns[sourceEntry.fromColumn]!.left));
      const right = Math.max(
        ...row.map(
          (sourceEntry) => columns[sourceEntry.toColumn ?? sourceEntry.fromColumn]!.right,
        ),
      );
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
          hypotheses: columns.map((column, columnIndex) => ({
            hypothesisKey: `${keyPrefix}-hypothesis-${pageSpec.pageNumber}-${columnIndex}`,
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
            ...geometry(column.left, column.right, 0, sourceRows.length * 20),
            formationRuleId: "synthetic",
            formationRuleVersion: 1,
            profileId: "synthetic",
            profileVersion: 1,
          })),
        },
      ],
    });
    physicalCellPages.push({
      pageNumber: pageSpec.pageNumber,
      regions: [{ cellHypotheses }],
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
    groups: [],
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
