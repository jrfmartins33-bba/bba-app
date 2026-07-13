import type { DecisionBriefReadiness } from "@bba/bdos-core/decision-brief";
import type { ReliabilityIndexResult } from "@bba/bdos-core/decision-brief";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.3 — apresentação pura do
 * Decision Hero. Traduz `readiness`/`confidence` para texto de
 * interface; nunca reinterpreta, recalcula ou infere um estado a
 * partir de outro campo do Brief (ex.: nunca conta itens críticos
 * para decidir prontidão -- isso já é decisão do builder).
 */

export type ReadinessTone = "positive" | "caution" | "negative" | "neutral";
export type ReadinessIcon = "check" | "alert" | "cross" | "help";

export interface ReadinessPresentation {
  readonly label: string;
  readonly tone: ReadinessTone;
  readonly icon: ReadinessIcon;
}

// Mapeamento obrigatório (Sprint 20.1E.3) -- nunca usa vocabulário de
// aprovação formal (Aprovada/Reprovada/Certificada/Homologada/
// Aceita/Rejeitada), porque readiness é prontidão técnica, não
// decisão humana consumada.
const READINESS_PRESENTATION: Record<DecisionBriefReadiness, ReadinessPresentation> = {
  ready: { label: "Apta para seguir para aprovação", tone: "positive", icon: "check" },
  ready_with_reservations: { label: "Apta para seguir com ressalvas", tone: "caution", icon: "alert" },
  not_ready: { label: "Não apta no estado atual", tone: "negative", icon: "cross" },
  inconclusive: { label: "Análise inconclusiva", tone: "neutral", icon: "help" }
};

export function translateReadiness(readiness: DecisionBriefReadiness): ReadinessPresentation {
  return READINESS_PRESENTATION[readiness];
}

/**
 * `unavailable` é a única variante que o builder de Medições produz
 * hoje -- nunca vira 0%, "confiança baixa" ou barra vazia (é uma
 * afirmação diferente: "não sei calcular isso ainda"). O ramo
 * `available` existe no tipo mas não tem desenho numérico aprovado
 * nesta Sprint -- devolve só `label` (texto já humano-legível do
 * próprio contrato), nunca `score`/`level`/percentual. Uma futura
 * visualização numérica é extensão registrada, não implementada aqui.
 */
export function describeConfidence(confidence: ReliabilityIndexResult): string {
  if (confidence.status === "unavailable") {
    return "Índice ainda não calculado.";
  }
  return confidence.label;
}
