/**
 * Problema B (Sprint 21.4B.3A.3, Momento 3C.1 → implementação no Momento
 * 3C.2). Assinatura e algoritmo congelados em
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §4. Substitui, apenas para consumidores v2, a classificação final de
 * `associateObservedRegionsToReference` (v1, `discovery-local-reader-comparison.ts`,
 * NUNCA alterada) — reaproveitando a mesma formação de grafo/componentes,
 * mas nunca colapsando componentes N:1/1:N em `"recovered"` sem evidência
 * textual real.
 *
 * Stub proposital: não implementado nesta etapa (Momento 3C.1 é
 * pré-registro apenas). Lança erro explícito até o Momento 3C.2 ser
 * autorizado e implementado.
 */

import type { LocalReaderExpectedRegionRef, LocalReaderObservedRegionRef } from "../discovery-local-reader-evaluation.types";
import type { LocalReaderRegionComponentResultV2 } from "./discovery-local-reader-evaluation-v2.types";

export function associateObservedRegionsToReferenceV2(
  _expectedRegions: ReadonlyArray<LocalReaderExpectedRegionRef>,
  _observedRegions: ReadonlyArray<LocalReaderObservedRegionRef>,
): ReadonlyArray<LocalReaderRegionComponentResultV2> {
  throw new Error(
    "associateObservedRegionsToReferenceV2: not implemented — Momento 3C.2 pendente de autorização (ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md §4).",
  );
}
