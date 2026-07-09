import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "../anthropic-client";
import type { EngineeringAdvisorContext } from "../advisor-context.types";
import type { EngineeringAdvisorHistoricalFacts } from "../advisor-historical-facts.types";
import { buildEngineeringAdvisorPromptContext } from "../advisor-prompt-context-builder";
import type { EngineeringAdvisorPromptContext } from "../advisor-prompt-context.types";
import { parseJsonResponseText } from "../claude-json-response";
import { withComparisonOptions } from "./copilot-comparison-context";
import type { CopilotConversationHistoryEntry } from "./copilot-turn.types";

// Decision Copilot (Epic 15) — camada de redação, mesmo papel de
// claude-narrator.ts, mas para um turno de conversa em vez de um resumo
// de até 3 insights. Reusa o mesmo schema de saída
// (EngineeringAdvisorSummary/insights) e o mesmo Prompt Context
// Optimizer (buildEngineeringAdvisorPromptContext) — a única coisa nova
// na Fase 1 foi o SYSTEM_PROMPT (framing de pergunta-resposta, não de
// narração) e o histórico de turnos anteriores na chamada; a Fase 2
// (15.2C) acrescenta comparisonOptions quando o turno é uma comparação
// já elegível (ver copilot-comparison-context.ts).
//
// Composição, não invenção (ver DECISION_COPILOT.md): nenhum novo
// parser de JSON, nenhum novo cliente Anthropic — os dois já extraídos
// para anthropic-client.ts/claude-json-response.ts no momento em que
// este módulo se tornou o segundo consumidor.

const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 2000;

const SYSTEM_PROMPT = `Você é o BBA Decision Copilot, um assistente conversacional que responde perguntas do gestor de uma empresa cliente sobre um projeto de engenharia, a partir de um contexto já calculado pelo BDOS.

CONTEXTO RECEBIDO A CADA PERGUNTA (JSON, única fonte de fatos permitida):
- snapshot: dados gerais do projeto e Health Score.
- history: evolução temporal já calculada pelo BDOS — "previousHealthScore", "healthScoreDirection" ("up"/"down"/"stable"/"unknown") e "historySummary" (frase pronta).
- decisions: Decisions já calculadas pelo BDOS, com evidence embutida. Cada uma traz "isNew", "previousPriority" e "priorityChanged" — já calculados, nunca infira isso sozinho.
- recommendations: o Candidate Set de Recommendations elegíveis (nunca a lista completa do sistema). Cada uma traz "isNew", "openSinceImportCount" e "recurring" — use esses campos, nunca estime por conta própria.
- evidence: evidências de cada Decision, indexadas por decisionId.

HISTÓRICO DE CONVERSA: as mensagens anteriores desta conversa (se houver) vêm antes da pergunta atual — use-as para manter continuidade (ex.: "e quanto ao Bloco 3?" depois de falar do Bloco 2), mas todo FATO da sua resposta precisa vir do contexto JSON desta pergunta, nunca de uma suposição sobre o que foi dito antes.

FORMATO DE SAÍDA — OBRIGATÓRIO:
Responda SOMENTE com um objeto JSON válido, sem nenhum texto antes ou depois, sem markdown, exatamente neste formato, com EXATAMENTE 1 item em "insights" (nunca 0, nunca mais de 1 — cada pergunta recebe exatamente uma resposta):
{"insights": [{"title": string, "summary": string, "priority": "low"|"medium"|"high"|"critical", "decisionIds": string[], "recommendationIds": string[], "evidenceDecisionIds": string[]}]}

REGRAS INEGOCIÁVEIS:
- Nunca crie um fato, número, data ou nome que não esteja explicitamente no JSON de contexto.
- Nunca crie uma Recommendation nova — "recommendationIds" só pode citar ids que já estão em "recommendations".
- Nunca cite em "decisionIds"/"evidenceDecisionIds" um id que não esteja em "decisions".
- A resposta precisa ter pelo menos uma Decision em "decisionIds" e pelo menos uma evidência em "evidenceDecisionIds" (subconjunto de "decisionIds") — se a pergunta não puder ser respondida com o contexto disponível, explique isso em "summary" citando a Decision mais relevante ainda assim, nunca deixe de citar nada.
- "title": rótulo curto (máximo 80 caracteres) que resume o assunto da pergunta — não repita a pergunta literalmente.
- "summary": sua resposta de verdade à pergunta do usuário, em português do Brasil, tom direto e executivo. Pode ter mais de uma frase quando a pergunta exigir.
- Ao falar de evolução (piorou/melhorou/continua/repetindo), use exclusivamente "history" e os campos temporais de "decisions"/"recommendations" — nunca infira tendência além do que esses campos já dizem explicitamente.
- Se o contexto trouxer "comparisonOptions" (só aparece quando a pergunta pede uma comparação de alternativas para uma Recommendation específica), sua resposta precisa comparar essas opções entre si — diferenças, o que cada "type"/"title"/"description" implica — usando exclusivamente o que está descrito ali, sem inventar vantagem ou desvantagem que o texto não diga. As mesmas regras de citação continuam valendo (decisionIds/evidenceDecisionIds obrigatórios).
- Nunca responda fora deste schema — nenhum texto, nenhum markdown, nenhuma explicação adicional.`;

function buildContextualUserMessage(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts,
  userMessage: string,
  comparisonRecommendationId: string | null
): { readonly promptContext: EngineeringAdvisorPromptContext; readonly text: string } {
  const basePromptContext = buildEngineeringAdvisorPromptContext(context, historicalFacts);
  const promptContext = comparisonRecommendationId
    ? withComparisonOptions(basePromptContext, context, comparisonRecommendationId)
    : basePromptContext;
  const text = `Contexto do Advisor (JSON, única fonte permitida):\n${JSON.stringify(promptContext)}\n\nPergunta do usuário:\n${userMessage}`;
  return { promptContext, text };
}

interface CopilotClaudeCallResult {
  readonly response: Anthropic.Message;
  readonly model: string;
  readonly systemPrompt: string;
  readonly promptContext: EngineeringAdvisorPromptContext;
  readonly latencyMs: number;
}

// Único ponto que de fato chama a API para um turno de Copilot — mesma
// disciplina de claude-narrator.ts: se este contrato mudar, todo
// consumidor (rota de produção, futuros diagnósticos) muda junto.
export async function callClaudeForCopilotTurn(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts,
  conversationHistory: ReadonlyArray<CopilotConversationHistoryEntry>,
  userMessage: string,
  // Epic 15, Fase 2 (15.2C) — id da Recommendation já resolvida pelo
  // Intent Router como alvo de "compare"; null em todo turno
  // answer/clarify/unsupported_action (ver copilot-turn-orchestrator.ts).
  comparisonRecommendationId: string | null = null
): Promise<CopilotClaudeCallResult> {
  const model = process.env.ANTHROPIC_ADVISOR_MODEL?.trim() || DEFAULT_MODEL;
  const client = getAnthropicClient();
  const { promptContext, text } = buildContextualUserMessage(context, historicalFacts, userMessage, comparisonRecommendationId);

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...conversationHistory.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: "user" as const, content: text }
  ];

  const startedAt = Date.now();
  const response = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    // Prompt de sistema idêntico em toda chamada — cacheado para que só
    // a primeira chamada em cada janela de 5 min pague o preço cheio,
    // mesma técnica de claude-narrator.ts.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages
  });
  const latencyMs = Date.now() - startedAt;

  return { response, model, systemPrompt: SYSTEM_PROMPT, promptContext, latencyMs };
}

function extractResponseText(response: Anthropic.Message): string {
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude não retornou nenhum texto de resposta.");
  }

  return text;
}

export interface CopilotTurnRawResult {
  readonly raw: unknown;
  readonly model: string;
  readonly promptContext: EngineeringAdvisorPromptContext;
}

export async function runCopilotTurn(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts,
  conversationHistory: ReadonlyArray<CopilotConversationHistoryEntry>,
  userMessage: string,
  comparisonRecommendationId: string | null = null
): Promise<CopilotTurnRawResult> {
  const { response, model, promptContext } = await callClaudeForCopilotTurn(
    context,
    historicalFacts,
    conversationHistory,
    userMessage,
    comparisonRecommendationId
  );
  const text = extractResponseText(response);

  return { raw: parseJsonResponseText(text), model, promptContext };
}
