import { createHash } from "node:crypto";
import {
  PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION,
  PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
  PHYSICAL_DOCUMENT_READER_NAME,
  PHYSICAL_DOCUMENT_READER_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
} from "../../physical-document-read.types";
import type {
  PhysicalDocumentPage,
  PhysicalDocumentReadResult,
  PhysicalDocumentTextItem,
  PhysicalDocumentTextItemLayoutGeometry,
} from "../../physical-document-read.types";
import { derivePageOrientation } from "../../physical-document-page-orientation";
import { normalizePageText } from "../../physical-document-text-normalization";
import { computePageTextMetrics } from "../../physical-document-page-metrics";
import { computeTextItemPlacementMetrics } from "../../physical-document-text-item-placement-metrics";
import { computeGeometryContextFingerprint } from "../../physical-document-geometry-context-fingerprint";
import { canonicalizeGeometryPoints } from "../../physical-document-text-item-geometry-canonicalization";
import { deriveTextItemPageBoundsRelation } from "../../physical-document-text-item-page-bounds-relation";

/**
 * Ponte exclusivamente de teste, local à Sprint 21.4A.2.f.1, entre
 * especificações geométricas simples e um `PhysicalDocumentReadResult`
 * (schema v2) válido com itens textuais `placed`. Distinta e independente
 * de `signal-observation/testing/synthetic-physical-document-bridge.ts`
 * (que constrói deliberadamente `unresolved_missing_geometry`, coerente
 * com sua própria limitação documentada, e por isso é inútil para testar
 * linhas/segmentos/blocos). Não exportada pelo barrel público do domínio
 * nem por `structure-reconstruction/index.ts`; nunca vira fixture de
 * produção.
 */

export interface SyntheticGeometryTextItem {
  readonly text: string;
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
}

export interface SyntheticGeometryPage {
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly items: ReadonlyArray<SyntheticGeometryTextItem>;
}

function buildGeometry(
  pageWidthPoints: number,
  pageHeightPoints: number,
  item: SyntheticGeometryTextItem,
): PhysicalDocumentTextItemLayoutGeometry {
  const leftPoints = canonicalizeGeometryPoints(item.leftPoints);
  const topPoints = canonicalizeGeometryPoints(item.topPoints);
  const rightPoints = canonicalizeGeometryPoints(item.rightPoints);
  const bottomPoints = canonicalizeGeometryPoints(item.bottomPoints);
  const widthPoints = canonicalizeGeometryPoints(rightPoints - leftPoints);
  const heightPoints = canonicalizeGeometryPoints(bottomPoints - topPoints);
  const centerXPoints = canonicalizeGeometryPoints((leftPoints + rightPoints) / 2);
  const centerYPoints = canonicalizeGeometryPoints((topPoints + bottomPoints) / 2);
  const pageBoundsRelation = deriveTextItemPageBoundsRelation(
    { leftPoints, topPoints, rightPoints, bottomPoints },
    pageWidthPoints,
    pageHeightPoints,
  );

  return {
    leftPoints,
    topPoints,
    rightPoints,
    bottomPoints,
    widthPoints,
    heightPoints,
    centerXPoints,
    centerYPoints,
    pageBoundsRelation,
    coordinateSpaceVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
    geometryProfileVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
  };
}

/** Constrói um `PhysicalDocumentReadResult` (schema v2) válido, com geometria real, a partir de especificações sintéticas simples. */
export function buildPhysicalDocumentReadResultWithGeometry(
  sourceLabel: string,
  syntheticPages: ReadonlyArray<SyntheticGeometryPage>,
): PhysicalDocumentReadResult {
  const pages: PhysicalDocumentPage[] = syntheticPages.map((syntheticPage, position) => {
    const pageNumber = position + 1;
    const textItems: PhysicalDocumentTextItem[] = syntheticPage.items.map((item, index) => ({
      index,
      text: item.text,
      placement: {
        status: "placed",
        geometry: buildGeometry(syntheticPage.widthPoints, syntheticPage.heightPoints, item),
        reasonCode: null,
      },
    }));
    const rawTexts = textItems.map((item) => item.text);

    return {
      pageNumber,
      widthPoints: syntheticPage.widthPoints,
      heightPoints: syntheticPage.heightPoints,
      rotationDegrees: 0,
      orientation: derivePageOrientation(syntheticPage.widthPoints, syntheticPage.heightPoints),
      textItems,
      normalizedText: normalizePageText(rawTexts),
      metrics: computePageTextMetrics(rawTexts),
      textItemPlacementMetrics: computeTextItemPlacementMetrics(textItems),
      extractionAvailability: "text_available",
      technicalProblems: [],
    };
  });

  const sourceByteHash = createHash("sha256").update(sourceLabel).digest("hex");
  const underlyingLibraryVersion = "structure-reconstruction-test-bridge-library-v1";
  const adapterVersion = "structure-reconstruction-test-bridge-adapter-v1";

  return {
    schemaVersion: PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
    readerName: PHYSICAL_DOCUMENT_READER_NAME,
    readerVersion: PHYSICAL_DOCUMENT_READER_VERSION,
    adapterVersion,
    underlyingLibraryVersion,
    sourceByteHash,
    totalPageCount: pages.length,
    pages,
    status: "completed",
    technicalProblems: [],
    textItemCoordinateSpaceVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
    textItemGeometryProfileVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
    geometryContextFingerprintVersion: PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION,
    geometryContextFingerprint: computeGeometryContextFingerprint({
      sourceByteHash,
      physicalReadSchemaVersion: PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
      readerName: PHYSICAL_DOCUMENT_READER_NAME,
      readerVersion: PHYSICAL_DOCUMENT_READER_VERSION,
      adapterVersion,
      underlyingLibraryVersion,
      coordinateSpaceVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
      geometryProfileVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
    }),
  };
}
