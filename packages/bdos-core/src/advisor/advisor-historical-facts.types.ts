import type { DecisionId } from "../domain/decision";
import type { RecommendationId } from "../engines/decision/recommendation";

// Epic 14 (BBA Advisor Evolution), Sprint 14.3 — Engineering Advisor
// Memory. EngineeringAdvisorHistoricalFacts é o dado cru buscado no
// Supabase (apps/web/lib/bdos/advisor-historical-facts-repository.ts) e
// entregue a buildEngineeringAdvisorPromptContext(), que é quem de fato
// interpreta esses fatos (isNew, priorityChanged, recurring etc.) — a
// busca não faz nenhuma interpretação, só projeta o que veio do banco.
//
// Nenhuma inferência estatística aqui: previousDecisions vem do snapshot
// imediatamente anterior (comparação de 2 pontos, não série completa);
// recommendationOpenSinceImportCountByRefId é uma contagem determinística
// (quantos decision_snapshots com trigger_reason='import' aconteceram
// desde que aquela recommendation apareceu pela primeira vez em
// recommendations.created_at — estável entre reimports por causa do
// correlationId fixo por engineeringProjectId, ver route.ts).

export interface EngineeringAdvisorPreviousDecisionFact {
  readonly id: DecisionId;
  readonly priority: string;
}

export interface EngineeringAdvisorHistoricalFacts {
  readonly previousDecisions: ReadonlyArray<EngineeringAdvisorPreviousDecisionFact>;
  readonly recommendationOpenSinceImportCountByRefId: Readonly<Record<RecommendationId, number>>;
}
