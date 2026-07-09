import type { DecisionId } from "../domain/decision";
import type { RecommendationId } from "../engines/decision/recommendation";
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
// sobrevivem aqui: nenhum "options", nenhum traceability.businessFactIds/
// evidenceReferences, nenhum metadata de bookkeeping interno do BDOS.

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

export interface EngineeringAdvisorPromptContext {
  readonly snapshot: EngineeringAdvisorContextSnapshot;
  readonly history: EngineeringAdvisorPromptHistory;
  readonly decisions: ReadonlyArray<EngineeringAdvisorPromptDecision>;
  readonly recommendations: ReadonlyArray<EngineeringAdvisorPromptRecommendation>;
  readonly evidence: EngineeringAdvisorPromptEvidenceIndex;
}
