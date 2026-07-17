import type { PhysicalDocumentTextItem, PhysicalDocumentTextItemPlacementMetrics } from "./physical-document-read.types";

/**
 * Calcula as contagens objetivas de disposição geométrica de uma página a
 * partir dos itens textuais já admitidos (Sprint 21.4A.2.f.0, seção 17).
 * Puramente derivada do array recebido — a invariante `total ===
 * placed + missing + invalid + unsupportedOrientation + normalizationFailed`
 * é uma consequência estrutural desta implementação (cada item contribui
 * para exatamente um contador), testada explicitamente em
 * `physical-document-text-item-placement-metrics.test.ts`.
 */
export function computeTextItemPlacementMetrics(
  items: ReadonlyArray<PhysicalDocumentTextItem>,
): PhysicalDocumentTextItemPlacementMetrics {
  let placedTextItemCount = 0;
  let unresolvedMissingGeometryCount = 0;
  let unresolvedInvalidGeometryCount = 0;
  let unresolvedUnsupportedOrientationCount = 0;
  let unresolvedNormalizationFailedCount = 0;

  for (const item of items) {
    switch (item.placement.status) {
      case "placed":
        placedTextItemCount += 1;
        break;
      case "unresolved_missing_geometry":
        unresolvedMissingGeometryCount += 1;
        break;
      case "unresolved_invalid_geometry":
        unresolvedInvalidGeometryCount += 1;
        break;
      case "unresolved_unsupported_orientation":
        unresolvedUnsupportedOrientationCount += 1;
        break;
      case "unresolved_normalization_failed":
        unresolvedNormalizationFailedCount += 1;
        break;
    }
  }

  return {
    totalAdmittedTextItemCount: items.length,
    placedTextItemCount,
    unresolvedMissingGeometryCount,
    unresolvedInvalidGeometryCount,
    unresolvedUnsupportedOrientationCount,
    unresolvedNormalizationFailedCount,
  };
}
