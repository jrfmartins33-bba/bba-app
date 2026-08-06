/**
 * Problema A (Sprint 21.4B.3A.3, Momento 3C.1 → implementado no Momento
 * 3C.2A). Assinatura e algoritmo congelados em
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §3. Aditiva a `computeLocalReaderRegionTextMetrics` (v1, NUNCA alterada)
 * — conta regiões esperadas individuais cobertas por qualquer componente,
 * distinguindo correspondência textual exata de mera sobreposição
 * espacial, em vez de contar por componente de associação.
 *
 * Extensão mínima e necessária de assinatura em relação ao stub original:
 * o tipo `LocalReaderRegionComponentResultV2` (congelado no Momento 3C.1)
 * carrega apenas ids, nunca texto — a distinção "correspondência textual
 * exata" vs. "cobertura apenas espacial" por região individual exige o
 * texto normalizado de cada região, indisponível a partir dos ids
 * sozinhos. Esta função recebe também os arrays originais de região
 * esperada/observada (os mesmos já passados para
 * `associateObservedRegionsToReferenceV2`) apenas para essa consulta —
 * nenhuma semântica nova, apenas o dado bruto necessário para calcular a
 * semântica já congelada.
 */

import { normalizeLocalReaderText } from "../discovery-local-reader-normalization";
import type { LocalReaderExpectedRegionRef, LocalReaderObservedRegionRef } from "../discovery-local-reader-evaluation.types";
import type { LocalReaderRegionComponentResultV2, LocalReaderRegionTextMetricsV2 } from "./discovery-local-reader-evaluation-v2.types";

export function computeLocalReaderRegionTextMetricsV2(
  components: ReadonlyArray<LocalReaderRegionComponentResultV2>,
  expectedRegions: ReadonlyArray<LocalReaderExpectedRegionRef>,
  observedRegions: ReadonlyArray<LocalReaderObservedRegionRef>,
): LocalReaderRegionTextMetricsV2 {
  const expectedTextById = new Map(expectedRegions.map((e) => [e.id, normalizeLocalReaderText(e.normalizedText)]));
  const observedTextById = new Map(observedRegions.map((o) => [o.id, normalizeLocalReaderText(o.normalizedText)]));

  let associationComponents = 0;
  let expectedRegionsWithExactTextualMatch = 0;
  let expectedRegionsCoveredSpatiallyOnly = 0;
  let expectedRegionsOmitted = 0;
  let observedRegionsAdditional = 0;

  for (const c of components) {
    associationComponents += 1;

    if (c.observedRegionIds.length === 0) {
      expectedRegionsOmitted += c.referenceRegionIds.length;
      continue;
    }
    if (c.referenceRegionIds.length === 0) {
      observedRegionsAdditional += c.observedRegionIds.length;
      continue;
    }

    const observedTextsInComponent = c.observedRegionIds.map((oid) => observedTextById.get(oid) ?? "");
    c.referenceRegionIds.forEach((eid) => {
      const expectedText = expectedTextById.get(eid) ?? "";
      if (observedTextsInComponent.includes(expectedText)) {
        expectedRegionsWithExactTextualMatch += 1;
      } else {
        expectedRegionsCoveredSpatiallyOnly += 1;
      }
    });
  }

  return {
    associationComponents,
    expectedRegionsCoveredByAnyComponent: expectedRegionsWithExactTextualMatch + expectedRegionsCoveredSpatiallyOnly,
    expectedRegionsWithExactTextualMatch,
    expectedRegionsCoveredSpatiallyOnly,
    expectedRegionsOmitted,
    observedRegionsAdditional,
  };
}
