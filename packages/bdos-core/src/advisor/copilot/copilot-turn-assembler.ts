import type { EngineeringAdvisorContext } from "../advisor-context.types";
import { buildEngineeringAdvisorConfidence } from "../advisor-confidence-builder";
import { buildEngineeringAdvisorExplanations } from "../advisor-explanation-builder";
import type { EngineeringAdvisorHistoricalFacts } from "../advisor-historical-facts.types";
import type { EngineeringAdvisorPromptContext } from "../advisor-prompt-context.types";
import type { EngineeringAdvisorInsight } from "../advisor-summary.types";
import { computeContextHash } from "./context-hash";
import { buildCopilotReasoningChain } from "./copilot-reasoning-chain";
import type { CopilotAssistantTurn } from "./copilot-turn.types";

// Decision Copilot (Epic 15, Fase 1) — monta o CopilotAssistantTurn
// pronto para persistir, a partir do insight já validado
// (copilot-response-validator.ts). Reusa buildEngineeringAdvisorExplanations
// e buildEngineeringAdvisorConfidence sem alteração, tratando o único
// insight do turno como um EngineeringAdvisorSummary de um item — mesma
// lógica que já existe para a narração da Home, zero duplicação.
//
// reasoningChain (CopilotReasoningStep[]) e explainability
// (EngineeringAdvisorExplanation) vêm da MESMA explanation resolvida —
// não são dois cálculos independentes, são duas formas do mesmo dado:
// explainability é a forma que a Explainability Drawer já consome hoje;
// reasoningChain é a forma que o componente Reasoning Chain
// (ReasoningStep[], apps/web/components/bba-project/bba-project-insights.ts)
// já consome — estruturalmente compatível por tipagem, sem import cruzado
// de apps/web (Engine nunca conhece Studio).
export function assembleCopilotAssistantTurn(
  insight: EngineeringAdvisorInsight,
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts,
  promptContext: EngineeringAdvisorPromptContext,
  decisionSnapshotId: string | null,
  model: string
): CopilotAssistantTurn {
  const explanations = buildEngineeringAdvisorExplanations({ insights: [insight] }, context, historicalFacts);
  const explanation = explanations[0];

  const confidence = buildEngineeringAdvisorConfidence(
    { valid: true, summary: { insights: [insight] } },
    explanations,
    historicalFacts
  );

  // structuredClone: garante cópia de valor, não referência viva ao
  // objeto do chamador — mesmo que buildEngineeringAdvisorPromptContext
  // já construa objetos novos hoje, este é o ponto que a "congelar, não
  // referenciar" precisa garantir sem depender de disciplina externa (ver
  // teste em copilot-turn-assembler.test.ts).
  const frozenContextSnapshot = structuredClone(promptContext);

  return {
    content: insight.summary,
    contextSnapshot: frozenContextSnapshot,
    contextHash: computeContextHash(frozenContextSnapshot),
    reasoningChain: buildCopilotReasoningChain(explanation),
    confidence,
    explainability: explanation,
    decisionSnapshotId,
    model
  };
}
