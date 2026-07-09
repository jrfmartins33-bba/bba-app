import type { Decision, DecisionEvidence, DecisionId } from "../domain/decision";
import type { Recommendation } from "../engines/decision/recommendation";

// Epic 14 (BBA Advisor Evolution), Sprint 14.1 — contrato próprio do
// Advisor: o Claude nunca recebe Decision[]/Recommendation[] cru, só este
// contexto já filtrado (Candidate Set) e resolvido pelo
// AdvisorContextBuilder (ver advisor-context-builder.ts). Formato de
// saída da narração (texto livre) não muda nesta Sprint.

export type { Decision, DecisionEvidence, Recommendation };

export interface EngineeringAdvisorContextSnapshot {
  readonly engineeringProjectId: string;
  readonly engineeringProjectName: string;
  readonly computedAt: string;
  readonly healthScore: number;
  readonly previousHealthScore: number | null;
}

// Chave = Decision.id. Resolvida deterministicamente a partir de
// Decision.evidence, já embutido no domínio (sem I/O extra). Não confundir
// com Recommendation.traceability.businessFactIds/evidenceReferences: essas
// permanecem como referências passthrough dentro de `recommendations[]` —
// não há store de BusinessFact neste pipeline hoje, então não são
// resolvidas aqui (ver nota em advisor-context-builder.ts).
export type EngineeringAdvisorEvidenceIndex = Readonly<Record<DecisionId, ReadonlyArray<DecisionEvidence>>>;

export interface EngineeringAdvisorContext {
  readonly snapshot: EngineeringAdvisorContextSnapshot;
  readonly decisions: ReadonlyArray<Decision>;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly evidenceIndex: EngineeringAdvisorEvidenceIndex;
  readonly historySummary: string;
}
