export * from "./discovery-local-reader-evaluation.types";
export { normalizeLocalReaderText, computeLocalReaderTextualDistance } from "./discovery-local-reader-normalization";
export { convertLocalReaderBoundingBox } from "./discovery-local-reader-coordinates";
export { boxesOverlapStrictly, associateObservedCellsToReference, associateObservedRegionsToReference } from "./discovery-local-reader-comparison";
export {
  computeLocalReaderExecutionMetrics,
  computeLocalReaderRegionTextMetrics,
  computeLocalReaderTableStructureMetrics,
  computeLocalReaderCriticalFieldMetric,
  classifyLocalReaderMultilineDescription,
  classifyLocalReaderExternalContent,
  classifyLocalReaderMathEvidence,
} from "./discovery-local-reader-metrics";
export type { LocalReaderCriticalFieldOutcome, LocalReaderMathEvidenceFieldKey } from "./discovery-local-reader-metrics";
export { classifyLocalReaderViability } from "./discovery-local-reader-viability";
export { classifyLocalReaderRepetitionDifference, classifyLocalReaderRepetitionDifferences, NONSEMANTIC_PROPERTY_ORDER_DIFFERENCE_PATH } from "./discovery-local-reader-repetition";
export { parseDoclingRawExport } from "./raw-adapters/discovery-local-reader-docling-adapter";
export type { DoclingAdapterResult, DoclingRawExport } from "./raw-adapters/discovery-local-reader-docling-adapter";
export { parsePaddleOcrRawExport } from "./raw-adapters/discovery-local-reader-paddleocr-adapter";
export type { PaddleOcrAdapterResult, PaddleOcrRawExport } from "./raw-adapters/discovery-local-reader-paddleocr-adapter";
