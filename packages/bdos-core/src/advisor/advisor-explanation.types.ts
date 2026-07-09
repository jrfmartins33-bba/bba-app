import type { DecisionId } from "../domain/decision";
import type { RecommendationId } from "../engines/decision/recommendation";

// Epic 14 (BBA Advisor Evolution), Sprint 14.4 — Engineering Advisor
// Explainability. EngineeringAdvisorExplanation é a prova, montada pelo
// BDOS, de um insight já validado: usa exclusivamente os ids que o
// Claude retornou e que o Validator já confirmou (decisionIds/
// recommendationIds/evidenceDecisionIds), resolvidos contra o
// EngineeringAdvisorContext completo. Nunca pede nada novo ao Claude,
// nunca infere nada — só resolve id → objeto.
//
// missingReferences existe para o caso defensivo (não deveria acontecer,
// dado que o Validator já barra ids inexistentes) de um id citado não
// ser encontrado no contexto: em vez de lançar exceção ou omitir
// silenciosamente, o builder registra explicitamente qual id faltou, em
// qual categoria — a Explanation nunca falha, mas também nunca esconde
// uma inconsistência.

export interface EngineeringAdvisorExplanationDecision {
  readonly id: DecisionId;
  readonly title: string;
  readonly priority: string;
}

export interface EngineeringAdvisorExplanationRecommendation {
  readonly id: RecommendationId;
  readonly title: string;
  readonly isNew: boolean;
  readonly recurring: boolean;
}

export interface EngineeringAdvisorExplanationEvidence {
  readonly decisionId: DecisionId;
  readonly source: string;
  readonly description: string;
}

export interface EngineeringAdvisorExplanationMissingReferences {
  readonly decisionIds: ReadonlyArray<DecisionId>;
  readonly recommendationIds: ReadonlyArray<RecommendationId>;
  readonly evidenceDecisionIds: ReadonlyArray<DecisionId>;
}

export interface EngineeringAdvisorExplanation {
  readonly insightTitle: string;
  readonly decisions: ReadonlyArray<EngineeringAdvisorExplanationDecision>;
  readonly recommendations: ReadonlyArray<EngineeringAdvisorExplanationRecommendation>;
  readonly evidence: ReadonlyArray<EngineeringAdvisorExplanationEvidence>;
  readonly missingReferences: EngineeringAdvisorExplanationMissingReferences;
}
