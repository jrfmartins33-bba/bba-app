import type { DecisionId } from "../domain/decision";
import type { RecommendationId } from "../engines/decision/recommendation";
import type { EngineeringAdvisorContextSnapshot } from "./advisor-context.types";

// Epic 14 (BBA Advisor Evolution), Sprint 14.2B — Advisor Prompt Context
// Optimizer. EngineeringAdvisorPromptContext é a visão compacta de
// EngineeringAdvisorContext que de fato vai para o Claude (ver
// advisor-prompt-context-builder.ts) — o contexto completo continua
// intacto e é o que o Validator sempre usa. Só os campos que o system
// prompt realmente instrui o Claude a citar sobrevivem aqui: nenhum
// "options" (o prompt nunca pediu para o Claude descrever opções),
// nenhum traceability.businessFactIds/evidenceReferences (o prompt já
// instrui a tratá-los como referência interna, nunca descrever), nenhum
// metadata de bookkeeping interno do BDOS.

export interface EngineeringAdvisorPromptDecision {
  readonly id: DecisionId;
  readonly title: string;
  readonly summary: string;
  readonly priority: string;
}

export interface EngineeringAdvisorPromptRecommendation {
  readonly id: RecommendationId;
  readonly decisionId: DecisionId;
  readonly title: string;
  readonly summary: string;
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
  readonly decisions: ReadonlyArray<EngineeringAdvisorPromptDecision>;
  readonly recommendations: ReadonlyArray<EngineeringAdvisorPromptRecommendation>;
  readonly evidenceIndex: EngineeringAdvisorPromptEvidenceIndex;
  readonly historySummary: string;
}
