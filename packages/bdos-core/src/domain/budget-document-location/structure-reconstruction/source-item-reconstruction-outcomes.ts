import type { PhysicalDocumentTextItem, PhysicalDocumentTextItemLayoutGeometry } from "../physical-document-read.types";

/**
 * Elegibilidade geométrica de um item textual (Sprint 21.4A.2.f.1, §22-23).
 * Estágio intermediário entre o item de origem e a disposição final
 * (`SourceTextItemReconstructionOutcome`), que só existe depois que linhas e
 * segmentos são formados. O único uso permitido de `item.text` em toda a
 * reconstrução é `trim().length === 0` — nunca interpretação de conteúdo.
 */
export type SourceItemEligibility =
  | { readonly kind: "eligible"; readonly sourceTextItemIndex: number; readonly geometry: PhysicalDocumentTextItemLayoutGeometry }
  | { readonly kind: "ignored_whitespace_only"; readonly sourceTextItemIndex: number }
  | { readonly kind: "excluded_outside_page"; readonly sourceTextItemIndex: number }
  | { readonly kind: "unresolved_source_geometry_missing"; readonly sourceTextItemIndex: number }
  | { readonly kind: "unresolved_source_geometry_invalid"; readonly sourceTextItemIndex: number }
  | { readonly kind: "unresolved_source_orientation_unsupported"; readonly sourceTextItemIndex: number }
  | { readonly kind: "unresolved_source_geometry_normalization_failed"; readonly sourceTextItemIndex: number };

export function classifySourceTextItem(item: PhysicalDocumentTextItem): SourceItemEligibility {
  const { placement } = item;

  if (placement.status === "unresolved_missing_geometry") {
    return { kind: "unresolved_source_geometry_missing", sourceTextItemIndex: item.index };
  }
  if (placement.status === "unresolved_invalid_geometry") {
    return { kind: "unresolved_source_geometry_invalid", sourceTextItemIndex: item.index };
  }
  if (placement.status === "unresolved_unsupported_orientation") {
    return { kind: "unresolved_source_orientation_unsupported", sourceTextItemIndex: item.index };
  }
  if (placement.status === "unresolved_normalization_failed") {
    return { kind: "unresolved_source_geometry_normalization_failed", sourceTextItemIndex: item.index };
  }

  if (item.text.trim().length === 0) {
    return { kind: "ignored_whitespace_only", sourceTextItemIndex: item.index };
  }
  if (placement.geometry.pageBoundsRelation === "outside") {
    return { kind: "excluded_outside_page", sourceTextItemIndex: item.index };
  }

  return { kind: "eligible", sourceTextItemIndex: item.index, geometry: placement.geometry };
}

export interface EligibleSourceTextItem {
  readonly sourceTextItemIndex: number;
  readonly geometry: PhysicalDocumentTextItemLayoutGeometry;
}

/**
 * Ordem canônica dos itens elegíveis (§23): `topPoints`, `centerYPoints`,
 * `leftPoints`, `rightPoints`, `sourceTextItemIndex` como desempate final.
 * Nunca a ordem original do array — resultado idêntico para qualquer
 * permutação de entrada com os mesmos índices e geometrias (§55).
 */
export function sortEligibleItemsCanonically(items: ReadonlyArray<EligibleSourceTextItem>): ReadonlyArray<EligibleSourceTextItem> {
  return [...items].sort((left, right) => {
    if (left.geometry.topPoints !== right.geometry.topPoints) {
      return left.geometry.topPoints - right.geometry.topPoints;
    }
    if (left.geometry.centerYPoints !== right.geometry.centerYPoints) {
      return left.geometry.centerYPoints - right.geometry.centerYPoints;
    }
    if (left.geometry.leftPoints !== right.geometry.leftPoints) {
      return left.geometry.leftPoints - right.geometry.leftPoints;
    }
    if (left.geometry.rightPoints !== right.geometry.rightPoints) {
      return left.geometry.rightPoints - right.geometry.rightPoints;
    }
    return left.sourceTextItemIndex - right.sourceTextItemIndex;
  });
}
