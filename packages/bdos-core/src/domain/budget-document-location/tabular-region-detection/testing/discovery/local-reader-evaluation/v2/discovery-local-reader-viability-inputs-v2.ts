/**
 * Problema E (Sprint 21.4B.3A.3, Momento 3C.1 → implementação no Momento
 * 3C.2). Proveniência de cada campo congelada em
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §7. Deriva `LocalReaderViabilityGateInputs` (v1,
 * `discovery-local-reader-evaluation.types.ts`, tipo NUNCA alterado; a
 * tabela de decisão `classifyLocalReaderViability` também NUNCA alterada)
 * a partir de dados reais — nunca das 5 constantes fixas hoje presentes em
 * `run-local-reader-evaluation.ts`.
 *
 * Stub proposital: não implementado nesta etapa (Momento 3C.1 é
 * pré-registro apenas). Lança erro explícito até o Momento 3C.2 ser
 * autorizado e implementado.
 */

import type { LocalReaderCellComparisonResult, LocalReaderCriticalFieldMetric, LocalReaderExecutionMetrics, LocalReaderTool, LocalReaderViabilityGateInputs } from "../discovery-local-reader-evaluation.types";
import type { LocalReaderRegionTextMetricsV2 } from "./discovery-local-reader-evaluation-v2.types";

export interface LocalReaderViabilityInputDerivationParamsV2 {
  readonly tool: LocalReaderTool;
  readonly execution: LocalReaderExecutionMetrics;
  readonly allCellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>;
  readonly criticalFields: ReadonlyArray<LocalReaderCriticalFieldMetric>;
  readonly regionTextByPageV2: Readonly<Record<number, LocalReaderRegionTextMetricsV2>>;
  readonly incorporatedTcuNoteAsItemOrValue: boolean;
  /** Um registro `.meta.json` do manifesto de aquisição por página avaliada (não reexecutado, apenas lido). */
  readonly acquisitionMetaByPage: Readonly<Record<number, Record<string, unknown>>>;
}

export function deriveViabilityInputsV2(_params: LocalReaderViabilityInputDerivationParamsV2): LocalReaderViabilityGateInputs {
  throw new Error(
    "deriveViabilityInputsV2: not implemented — Momento 3C.2 pendente de autorização (ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md §7).",
  );
}
