/**
 * Problema A (Sprint 21.4B.3A.3, Momento 3C.1 → implementação no Momento
 * 3C.2). Assinatura e algoritmo congelados em
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §3. Aditiva a `computeLocalReaderRegionTextMetrics` (v1, NUNCA alterada)
 * — conta regiões esperadas individuais cobertas por qualquer componente,
 * distinguindo correspondência textual exata de mera sobreposição
 * espacial, em vez de contar por componente de associação.
 *
 * Stub proposital: não implementado nesta etapa (Momento 3C.1 é
 * pré-registro apenas). Lança erro explícito até o Momento 3C.2 ser
 * autorizado e implementado.
 */

import type { LocalReaderRegionComponentResultV2, LocalReaderRegionTextMetricsV2 } from "./discovery-local-reader-evaluation-v2.types";

export function computeLocalReaderRegionTextMetricsV2(_components: ReadonlyArray<LocalReaderRegionComponentResultV2>): LocalReaderRegionTextMetricsV2 {
  throw new Error(
    "computeLocalReaderRegionTextMetricsV2: not implemented — Momento 3C.2 pendente de autorização (ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md §3).",
  );
}
