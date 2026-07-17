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
import { SUPPORTED_PHYSICAL_ADAPTER_VERSION, SUPPORTED_PHYSICAL_UNDERLYING_LIBRARY_VERSION } from "../structure-reconstruction-source-contracts";

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
  /**
   * Índice técnico explícito do item (Sprint 21.4A.2.f.1, auditoria pós-PR
   * #69, §4). Omitido = a posição do item no array de `items`, o
   * comportamento histórico. Fornecido explicitamente permite construir
   * duas leituras físicas com os mesmos itens/índices em ordens de array
   * diferentes, para provar que a reconstrução (e a validação de entrada)
   * nunca dependem da ordem do array — apenas do próprio `index`.
   */
  readonly index?: number;
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
    const textItems: PhysicalDocumentTextItem[] = syntheticPage.items.map((item, position) => ({
      index: item.index ?? position,
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
  // Auditoria pós-PR #69: o portão de compatibilidade agora exige
  // igualdade exata de adaptador/biblioteca concreta (não apenas do
  // fingerprint recalculável). Esta ponte nunca lê um documento real nem
  // carrega a biblioteca de extração — reutiliza as duas constantes
  // nomeadas e exportadas por `structure-reconstruction-source-contracts.ts`
  // (a única fonte de verdade dessas identidades no domínio) para poder
  // exercitar o reconstrutor completo (linhas/segmentos/blocos) em testes
  // de unidade e integração controlada, sem depender de extração real. A
  // prova de que o adaptador real produz um resultado compatível vive em
  // `reconstruct-budget-document-structure.real-pdf-chain.test.ts`, que usa
  // bytes sintéticos e o leitor físico real de verdade — nunca esta ponte.
  const underlyingLibraryVersion = SUPPORTED_PHYSICAL_UNDERLYING_LIBRARY_VERSION;
  const adapterVersion = SUPPORTED_PHYSICAL_ADAPTER_VERSION;

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
