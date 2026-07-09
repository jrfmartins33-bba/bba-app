import type { DecisionId } from "../domain/decision";
import type { RecommendationActionType, RecommendationId, RecommendationOptionId } from "../engines/decision/recommendation";
import type { EngineeringAdvisorContextSnapshot } from "./advisor-context.types";

// Epic 14 (BBA Advisor Evolution), Sprint 14.2B — Advisor Prompt Context
// Optimizer; Sprint 14.3 — Engineering Advisor Memory estendeu este
// mesmo contrato com "history" e os campos temporais por item, a pedido
// explícito: um único objeto enviado ao Claude, nenhuma composição de
// dois contratos no Narrator. Toda a inteligência (o que é "novo", o que
// "mudou de prioridade", o que está "recorrente") é decidida por
// buildEngineeringAdvisorPromptContext() — o Narrator só serializa.
//
// Só os campos que o system prompt realmente instrui o Claude a citar
// sobrevivem aqui: nenhum traceability.businessFactIds/
// evidenceReferences, nenhum metadata de bookkeeping interno do BDOS.
//
// Exceção deliberada, Decision Copilot (Epic 15, Fase 2, Sub-sprint
// 15.2C — DECISION_COPILOT_PHASE2.md §3): "comparisonOptions" reabre,
// de propósito e só quando presente, as opções de UMA Recommendation
// já resolvida como alvo de comparação pelo Intent Router
// (copilot-intent-router.ts) — nunca "todas as opções de todas as
// Recommendations". buildEngineeringAdvisorPromptContext() nunca
// popula este campo sozinho; só copilot-comparison-context.ts o
// adiciona, depois que o gate de elegibilidade do Router já resolveu
// um alvo único.

export interface EngineeringAdvisorPromptHistory {
  readonly previousHealthScore: number | null;
  readonly healthScoreDirection: "up" | "down" | "stable" | "unknown";
  readonly historySummary: string;
}

export interface EngineeringAdvisorPromptDecision {
  readonly id: DecisionId;
  readonly title: string;
  readonly summary: string;
  readonly priority: string;
  readonly isNew: boolean;
  readonly previousPriority: string | null;
  readonly priorityChanged: boolean;
}

export interface EngineeringAdvisorPromptRecommendation {
  readonly id: RecommendationId;
  readonly decisionId: DecisionId;
  readonly title: string;
  readonly summary: string;
  readonly isNew: boolean;
  readonly openSinceImportCount: number;
  readonly recurring: boolean;
}

export interface EngineeringAdvisorPromptEvidence {
  readonly source: string;
  readonly sourceReference: string;
  readonly description: string;
}

export type EngineeringAdvisorPromptEvidenceIndex = Readonly<
  Record<DecisionId, ReadonlyArray<EngineeringAdvisorPromptEvidence>>
>;

// Decision Copilot (Epic 15, Fase 2, 15.2C) — ver nota de exceção
// deliberada no topo do arquivo. Estrutura idêntica a
// RecommendationOption (engines/decision/recommendation), copiada aqui
// (não reexportada) pela mesma razão do resto deste arquivo: só o
// subconjunto que o system prompt de fato instrui a citar entra neste
// contrato.
export interface EngineeringAdvisorPromptRecommendationOption {
  readonly id: RecommendationOptionId;
  readonly type: RecommendationActionType;
  readonly title: string;
  readonly description: string;
}

export interface EngineeringAdvisorPromptContext {
  readonly snapshot: EngineeringAdvisorContextSnapshot;
  readonly history: EngineeringAdvisorPromptHistory;
  readonly decisions: ReadonlyArray<EngineeringAdvisorPromptDecision>;
  readonly recommendations: ReadonlyArray<EngineeringAdvisorPromptRecommendation>;
  readonly evidence: EngineeringAdvisorPromptEvidenceIndex;
  // Presente só quando o Intent Router resolveu "compare" para uma
  // Recommendation específica (ver nota de exceção acima). Ausente
  // (undefined) em todo turno "answer"/"clarify"/"unsupported_action".
  readonly comparisonOptions?: ReadonlyArray<EngineeringAdvisorPromptRecommendationOption>;
}
