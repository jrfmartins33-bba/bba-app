import { computePageTextMetrics } from "../../physical-document-page-metrics";
import { computeTextItemPlacementMetrics } from "../../physical-document-text-item-placement-metrics";
import { computeGeometryContextFingerprint } from "../../physical-document-geometry-context-fingerprint";
import { derivePageOrientation } from "../../physical-document-page-orientation";
import type {
  PhysicalDocumentPage,
  PhysicalDocumentReadResult,
  PhysicalDocumentTextExtractionAvailability,
  PhysicalDocumentTextItem,
} from "../../physical-document-read.types";
import {
  PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION,
  PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
  PHYSICAL_DOCUMENT_READER_NAME,
  PHYSICAL_DOCUMENT_READER_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
} from "../../physical-document-read.types";
import { normalizePageText } from "../../physical-document-text-normalization";
import { observeDocumentSignals } from "../../signal-observation/signal-observation";
import type {
  DocumentSignalObservationResult,
  SignalEvaluation,
} from "../../signal-observation/signal-observation.types";

export const TEST_SOURCE_HASH = "a".repeat(64);

/**
 * Nenhum destes testes exercita a extração PDF real: os itens desta
 * fixture nunca tiveram geometria, mesmo antes da Sprint 21.4A.2.f.0 —
 * `unresolved_missing_geometry` reflete isso com exatidão.
 */
const NO_GEOMETRY_PLACEMENT: PhysicalDocumentTextItem["placement"] = {
  status: "unresolved_missing_geometry",
  geometry: null,
  reasonCode: "text_item_geometry_missing",
};

export interface PageLocationTestPageSpec {
  readonly texts?: ReadonlyArray<string>;
  readonly widthPoints?: number | null;
  readonly heightPoints?: number | null;
  readonly extractionAvailability?: PhysicalDocumentTextExtractionAvailability;
}

export const SIGNAL_TEXT = {
  reference: "planilha or\u00e7ament\u00e1ria",
  serviceItem: "SV-001 Servico de teste",
  bdi: "BDI",
  total: "Total geral R$ 100,00",
  ordinary: "Texto administrativo comum sem conteudo de orcamento",
} as const;

function buildPage(spec: PageLocationTestPageSpec, pageNumber: number): PhysicalDocumentPage {
  const texts = spec.texts ?? [SIGNAL_TEXT.ordinary];
  const extractionAvailability = spec.extractionAvailability ?? "text_available";
  const textItems: PhysicalDocumentTextItem[] =
    extractionAvailability === "text_available" ? texts.map((text, index) => ({ index, text, placement: NO_GEOMETRY_PLACEMENT })) : [];
  const sourceTexts = textItems.map((item) => item.text);
  const widthPoints = spec.widthPoints === undefined ? 612 : spec.widthPoints;
  const heightPoints = spec.heightPoints === undefined ? 792 : spec.heightPoints;
  return {
    pageNumber,
    widthPoints,
    heightPoints,
    rotationDegrees: 0,
    orientation: derivePageOrientation(widthPoints, heightPoints),
    textItems,
    normalizedText: normalizePageText(sourceTexts),
    metrics: computePageTextMetrics(sourceTexts),
    textItemPlacementMetrics: computeTextItemPlacementMetrics(textItems),
    extractionAvailability,
    technicalProblems:
      extractionAvailability === "extraction_failed"
        ? [
            {
              code: "page_text_extraction_failed",
              level: "page",
              pageNumber,
              message: "Falha tecnica controlada para fixture.",
            },
          ]
        : [],
  };
}

export function buildObservation(
  specs: ReadonlyArray<PageLocationTestPageSpec>,
  sourceByteHash = TEST_SOURCE_HASH,
): DocumentSignalObservationResult {
  const pages = specs.map((spec, index) => buildPage(spec, index + 1));
  const hasPageFailure = pages.some((page) => page.technicalProblems.length > 0);
  const adapterVersion = "page-location-test-adapter-v1";
  const underlyingLibraryVersion = "synthetic-library-v1";
  const readResult: PhysicalDocumentReadResult = {
    schemaVersion: PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
    readerName: PHYSICAL_DOCUMENT_READER_NAME,
    readerVersion: PHYSICAL_DOCUMENT_READER_VERSION,
    adapterVersion,
    underlyingLibraryVersion,
    sourceByteHash,
    totalPageCount: pages.length,
    pages,
    status: hasPageFailure ? "completed_with_page_failures" : "completed",
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
  return observeDocumentSignals(readResult);
}

function ruleFailure(evaluation: SignalEvaluation): SignalEvaluation {
  return {
    ...evaluation,
    outcome: "not_evaluable",
    evidence: null,
    notEvaluableReasonCode: "observer_rule_execution_failed",
    notEvaluableDimension: null,
  };
}

export function withObserverRuleFailure(
  source: DocumentSignalObservationResult,
  pageNumber: number,
  signalId: string,
): DocumentSignalObservationResult {
  const page = source.pages.find((entry) => entry.pageNumber === pageNumber);
  const evaluation = page?.signalEvaluations.find((entry) => entry.signalId === signalId);
  if (page === undefined || evaluation === undefined || evaluation.ruleId === null) {
    throw new Error("Fixture rule failure targets a missing or unsupported signal.");
  }
  const key = `${pageNumber}:${signalId}`;
  const existingProblems = source.technicalProblems.filter(
    (technicalProblem) => `${technicalProblem.pageNumber}:${technicalProblem.signalId}` !== key,
  );
  return {
    ...source,
    pages: source.pages.map((entry) =>
      entry.pageNumber !== pageNumber
        ? entry
        : {
            ...entry,
            signalEvaluations: entry.signalEvaluations.map((candidate) =>
              candidate.signalId === signalId ? ruleFailure(candidate) : candidate,
            ),
          },
    ),
    status: "completed_with_observer_problems",
    technicalProblems: [
      ...existingProblems,
      {
        code: "observer_rule_execution_failed",
        pageNumber,
        signalId,
        message: "Falha tecnica controlada de regra para fixture.",
      },
    ],
  };
}

export function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    return Object.freeze(value);
  }
  return value;
}

export function cloneObservation(source: DocumentSignalObservationResult): DocumentSignalObservationResult {
  return structuredClone(source);
}
