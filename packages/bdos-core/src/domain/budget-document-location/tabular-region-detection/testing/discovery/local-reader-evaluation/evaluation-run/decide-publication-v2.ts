/**
 * Sprint 21.4B.3A.3 — fechamento consolidado. Decisão pura de publicação:
 * só publica quando as 12 entradas são válidas E as duas execuções (A/B)
 * são semanticamente idênticas — nunca uma sem a outra.
 */
import type { RawInputValidationResultV2 } from "./validate-raw-inputs-v2";
import type { RunRepetitionValidationV2 } from "./compare-canonical-runs-v2";

export interface PublicationDecisionV2 {
  readonly shouldPublish: boolean;
  readonly reason: string;
}

export function decidePublicationV2(rawValidation: RawInputValidationResultV2, repetitionValidation: RunRepetitionValidationV2): PublicationDecisionV2 {
  if (!rawValidation.overallValid) {
    return { shouldPublish: false, reason: "validação das 12 entradas brutas falhou — publicação bloqueada antes de qualquer execução real" };
  }
  if (!repetitionValidation.identical) {
    return { shouldPublish: false, reason: "execuções A e B divergem semanticamente — publicação bloqueada" };
  }
  return { shouldPublish: true, reason: "12 entradas válidas e execuções A/B semanticamente idênticas" };
}
