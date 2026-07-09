import type { EngineeringAdvisorConfidence } from "../advisor-confidence.types";
import type { EngineeringAdvisorExplanation } from "../advisor-explanation.types";
import type { EngineeringAdvisorPromptContext } from "../advisor-prompt-context.types";

// Decision Copilot (Epic 15, Fase 1) — tipos do turno de conversa.
// Composição, não invenção: reaproveita os mesmos contratos que o resto
// do Advisor já produz (EngineeringAdvisorConfidence,
// EngineeringAdvisorExplanation, EngineeringAdvisorPromptContext) — ver
// packages/bdos-core/docs/DECISION_COPILOT.md para o racional completo.
//
// A resposta do Claude reusa o schema de EngineeringAdvisorSummary
// (advisor-summary.types.ts) sem alteração — sempre exatamente 1
// insight por turno (não até 3, como na narração da Home) — e é validada
// pelo mesmo validateEngineeringAdvisorSummary já existente. Nenhum
// schema de resposta novo, nenhum validador duplicado.

export type CopilotMessageRole = "user" | "assistant";

export interface CopilotConversationHistoryEntry {
  readonly role: CopilotMessageRole;
  readonly content: string;
}

// Estruturalmente idêntico a `ReasoningStep`
// (apps/web/components/bba-project/bba-project-insights.ts) — bdos-core
// nunca importa de apps/web (Engine nunca conhece Studio), então este
// tipo é definido aqui com a mesma forma, não importado de lá. Qualquer
// componente que já renderiza `ReasoningStep[]` aceita isto sem
// conversão, por tipagem estrutural.
export interface CopilotReasoningStep {
  readonly label: string;
  readonly count: number;
  readonly description: string;
}

// O que precisa ser persistido em copilot_messages para um turno
// assistant — corresponde 1:1 às colunas não-triviais da tabela (ver
// supabase/migrations/20260709000000_bdos_decision_copilot.sql).
// contextSnapshot/reasoningChain/confidence/explainability aqui são os
// VALORES a congelar, nunca uma referência — é o repository
// (apps/web/lib/bdos/copilot-repository.ts) quem grava exatamente estes
// campos, sem recalcular nada.
export interface CopilotAssistantTurn {
  readonly content: string;
  readonly contextSnapshot: EngineeringAdvisorPromptContext;
  readonly contextHash: string;
  readonly reasoningChain: ReadonlyArray<CopilotReasoningStep>;
  readonly confidence: EngineeringAdvisorConfidence;
  readonly explainability: EngineeringAdvisorExplanation;
  readonly decisionSnapshotId: string | null;
  readonly model: string;
}
