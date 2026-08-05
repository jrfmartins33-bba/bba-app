/**
 * Problema C (Sprint 21.4B.3A.3, Momento 3C.1 → implementação no Momento
 * 3C.2). Assinatura e algoritmo congelados em
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §5. Deriva os três argumentos de `classifyLocalReaderMultilineDescription`
 * (v1, `discovery-local-reader-metrics.ts`, NUNCA alterada) a partir de
 * comparações de célula reais — nunca de `[]`/`false`/`null` fixos como em
 * `run-local-reader-evaluation.ts` hoje.
 *
 * Stub proposital: não implementado nesta etapa (Momento 3C.1 é
 * pré-registro apenas). Lança erro explícito até o Momento 3C.2 ser
 * autorizado e implementado.
 */

import type { LocalReaderCellComparisonResult } from "../discovery-local-reader-evaluation.types";
import type { ReferenceTruthPageBundle } from "../../reference-truth/discovery-reference-truth.types";
import type { LocalReaderMultilineObservedInputV2 } from "./discovery-local-reader-evaluation-v2.types";

export function deriveObservedDescriptionLinesV2(
  _bundle: ReferenceTruthPageBundle,
  _logicalRowId: string,
  _cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
): LocalReaderMultilineObservedInputV2 {
  throw new Error(
    "deriveObservedDescriptionLinesV2: not implemented — Momento 3C.2 pendente de autorização (ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md §5).",
  );
}
