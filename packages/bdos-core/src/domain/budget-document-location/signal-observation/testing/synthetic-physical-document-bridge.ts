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
  PhysicalDocumentReadStatus,
  PhysicalDocumentTextItem,
} from "../../physical-document-read.types";
import { derivePageOrientation } from "../../physical-document-page-orientation";
import { normalizePageText } from "../../physical-document-text-normalization";
import { computePageTextMetrics } from "../../physical-document-page-metrics";
import { computeTextItemPlacementMetrics } from "../../physical-document-text-item-placement-metrics";
import { computeGeometryContextFingerprint } from "../../physical-document-geometry-context-fingerprint";
import { createTechnicalProblem } from "../../physical-document-technical-problem";

/**
 * Todo item textual desta ponte de teste é, por construção,
 * `unresolved_missing_geometry`: não há biblioteca concreta de extração
 * de PDF nem `viewport`/`transform` reais neste caminho puramente
 * sintético (Sprint 21.4A.2.f.0) — apenas texto literal autorado. Isso é
 * deliberado e coerente com a fronteira desta ponte: ela nunca teve a
 * pretensão de produzir geometria real, apenas texto para as regras do
 * observador operarem sobre `item.text`/`item.index`.
 */
const NO_GEOMETRY_PLACEMENT: PhysicalDocumentTextItem["placement"] = {
  status: "unresolved_missing_geometry",
  geometry: null,
  reasonCode: "text_item_geometry_missing",
};
import { SyntheticPageExtractionAvailability } from "../../testing/synthetic-reference-suite.types";
import type {
  PhysicalDocumentTextExtractionAvailability,
} from "../../physical-document-read.types";
import type { SyntheticPageReference } from "../../testing/synthetic-reference-suite.types";

/**
 * Ponte exclusivamente de teste entre a suíte sintética protegida da
 * Sprint 21.4A.2.b (`SyntheticPageReference`, que descreve a expectativa
 * humana em prosa via `observedForm`, sem texto documental literal) e o
 * contrato `PhysicalDocumentReadResult` da Sprint 21.4A.2.c (que exige
 * texto literal real para as regras do observador operarem).
 *
 * `observedForm` é descrição da observação esperada — nunca o conteúdo
 * físico da página. O texto literal usado aqui é autorado à parte,
 * coerente com essa expectativa, nunca extraído automaticamente dela.
 *
 * Não altera a suíte protegida, não é exportada pela API pública do
 * pacote e não deve virar fixture de produção.
 */

function mapExtractionAvailability(
  value: SyntheticPageExtractionAvailability,
): PhysicalDocumentTextExtractionAvailability {
  switch (value) {
    case SyntheticPageExtractionAvailability.TextAvailable:
      return "text_available";
    case SyntheticPageExtractionAvailability.NoExtractableText:
      return "no_extractable_text";
    case SyntheticPageExtractionAvailability.ExtractionError:
      return "extraction_failed";
    default:
      return "no_extractable_text";
  }
}

export interface SyntheticBridgePageInput {
  readonly reference: SyntheticPageReference;
  /** Texto literal autorado para esta página, coerente com `reference.expectedSignals`/`explicitlyAbsentSignalIds`. Ignorado quando a disponibilidade não for `text_available`. */
  readonly itemTexts: ReadonlyArray<string>;
}

/**
 * Constrói um `PhysicalDocumentReadResult` válido a partir de uma
 * sequência curada de páginas sintéticas, renumeradas densamente a partir
 * de 1 (a numeração física real nunca tem lacunas) — mesmo quando a
 * seleção usa um subconjunto das páginas originais de um documento da
 * suíte. Isso significa que a página "anterior"/"posterior" observada
 * pelas regras de página vizinha é a vizinha dentro do subconjunto
 * escolhido, não necessariamente a vizinha no documento sintético
 * completo — documentado explicitamente em cada uso.
 */
export function buildPhysicalDocumentReadResultFromSyntheticPages(
  sourceLabel: string,
  inputs: ReadonlyArray<SyntheticBridgePageInput>,
): PhysicalDocumentReadResult {
  const pages: PhysicalDocumentPage[] = inputs.map((input, position) => {
    const pageNumber = position + 1;
    const availability = mapExtractionAvailability(input.reference.extractionAvailability);
    const textItems: PhysicalDocumentTextItem[] =
      availability === "text_available"
        ? input.itemTexts.map((text, index) => ({ index, text, placement: NO_GEOMETRY_PLACEMENT }))
        : [];
    const rawTexts = textItems.map((item) => item.text);
    const widthPoints = input.reference.geometry.widthPoints;
    const heightPoints = input.reference.geometry.heightPoints;

    return {
      pageNumber,
      widthPoints,
      heightPoints,
      rotationDegrees: null,
      orientation: derivePageOrientation(widthPoints, heightPoints),
      textItems,
      normalizedText: normalizePageText(rawTexts),
      metrics: computePageTextMetrics(rawTexts),
      textItemPlacementMetrics: computeTextItemPlacementMetrics(textItems),
      extractionAvailability: availability,
      technicalProblems:
        availability === "extraction_failed" ? [createTechnicalProblem("page_text_extraction_failed", "page", pageNumber)] : [],
    };
  });

  const status: PhysicalDocumentReadStatus = pages.some((page) => page.technicalProblems.length > 0)
    ? "completed_with_page_failures"
    : "completed";

  const sourceByteHash = `synthetic-bridge-${sourceLabel}`;
  const underlyingLibraryVersion: string | null = null;
  const adapterVersion = "synthetic-bridge-adapter";

  return {
    schemaVersion: PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
    readerName: PHYSICAL_DOCUMENT_READER_NAME,
    readerVersion: PHYSICAL_DOCUMENT_READER_VERSION,
    adapterVersion,
    underlyingLibraryVersion,
    sourceByteHash,
    totalPageCount: pages.length,
    pages,
    status,
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
