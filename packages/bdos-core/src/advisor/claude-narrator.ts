import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic-client";
import type { EngineeringAdvisorContext } from "./advisor-context.types";
import type { EngineeringAdvisorHistoricalFacts } from "./advisor-historical-facts.types";
import { buildEngineeringAdvisorPromptContext } from "./advisor-prompt-context-builder";
import { parseJsonResponseText } from "./claude-json-response";
import type { EngineeringAdvisorSummary } from "./advisor-summary.types";

// BBA Advisor — narrador via Claude (Sprint 13.12, "diferencial BBA" V1;
// Sprint 14.1 do Epic 14 trocou o input pobre — EngineeringAdvisorItem[] —
// por EngineeringAdvisorContext; Sprint 14.2 trocou a saída de texto
// livre por Structured Advisor Summary, ver advisor-summary.types.ts e
// advisor-response-validator.ts). Camada de redação, não de cálculo:
// recebe só o contexto já filtrado/resolvido pelo AdvisorContextBuilder
// (apps/web/lib/bdos/advisor.ts monta e chama) e devolve JSON bruto ainda
// não validado. Nunca lê banco, nunca chama outro Engine, nunca recebe
// Decision[]/Recommendation[] cru — a mesma regra de fronteira que já
// vale para o resto do Advisor (ver docs/PLATFORM_ARCHITECTURE.md, seção
// 1: "Advisor... nunca cria regra de negócio, só interpreta o que os
// Engines já calcularam") vale para a LLM.
//
// Se esta chamada falhar (rede, quota, JSON malformado, API fora do ar),
// quem chama (import/route.ts) captura o erro e não grava narrativa
// nenhuma — a Home cai de volta nos itens template determinísticos que
// já existiam antes da Sprint 13.12. Esta função nunca deve ser o motivo
// de um import falhar.

const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 2000;

const SYSTEM_PROMPT = `Você é o BBA Advisor, um analista que resume o estado de um projeto de engenharia para o gestor da empresa cliente, a partir de um contexto já calculado pelo BDOS.

CONTEXTO RECEBIDO (JSON, única fonte de fatos permitida):
- snapshot: dados gerais do projeto e Health Score.
- history: evolução temporal já calculada pelo BDOS — "previousHealthScore", "healthScoreDirection" ("up"/"down"/"stable"/"unknown") e "historySummary" (frase pronta).
- decisions: Decisions já calculadas pelo BDOS, com evidence embutida. Cada uma traz "isNew" (não existia no snapshot anterior), "previousPriority" e "priorityChanged" — já calculados, nunca infira isso sozinho.
- recommendations: o Candidate Set de Recommendations elegíveis (nunca a lista completa do sistema). Cada uma traz "isNew", "openSinceImportCount" (quantas importações ela já está aberta) e "recurring" (já sinaliza recorrência, limiar decidido pelo BDOS) — use esses campos, nunca estime por conta própria.
- evidence: evidências de cada Decision, indexadas por decisionId.

FORMATO DE SAÍDA — OBRIGATÓRIO:
Responda SOMENTE com um objeto JSON válido, sem nenhum texto antes ou depois, sem markdown, exatamente neste formato:
{"insights": [{"title": string, "summary": string, "priority": "low"|"medium"|"high"|"critical", "decisionIds": string[], "recommendationIds": string[], "evidenceDecisionIds": string[]}]}

REGRAS INEGOCIÁVEIS:
- Nunca crie um fato, número, data ou nome que não esteja explicitamente no JSON de contexto.
- Nunca crie uma Recommendation nova — "recommendationIds" só pode citar ids que já estão em "recommendations".
- Nunca cite em "decisionIds"/"evidenceDecisionIds" um id que não esteja em "decisions".
- Todo insight precisa ter pelo menos uma Decision em "decisionIds" e pelo menos uma evidência em "evidenceDecisionIds" (subconjunto de "decisionIds").
- Dentro de "recommendations", os campos "traceability.businessFactIds" e "traceability.evidenceReferences" são apenas referências internas — nunca descreva ou infira o conteúdo delas.
- Se não houver nenhum insight relevante para reportar, responda {"insights": []}.
- Escreva "title" e "summary" em português do Brasil, tom direto e executivo, sem jargão técnico.
- Máximo de 3 insights por resposta. Se houver mais de 3 pontos relevantes no Candidate Set, escolha os 3 mais críticos e ignore o restante.
- "title": no máximo 80 caracteres.
- "summary": no máximo 240 caracteres, em 1 única frase.
- Ao falar de evolução (piorou/melhorou/continua/repetindo), use exclusivamente "history" e os campos temporais de "decisions"/"recommendations" — nunca infira tendência além do que esses campos já dizem explicitamente.
- Nunca responda fora deste schema — nenhum texto, nenhum markdown, nenhuma explicação adicional.`;

export interface EngineeringAdvisorNarrationResult {
  readonly raw: unknown;
  readonly model: string;
}

// Sprint 14.2B (Advisor Prompt Context Optimizer) — o que vai para o
// Claude é a visão compacta (EngineeringAdvisorPromptContext), nunca o
// EngineeringAdvisorContext completo; este continua intacto e é o que o
// Validator sempre recebe (chamado por quem invoca este módulo, com o
// context original, não com o que foi serializado aqui).
function buildUserPrompt(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts
): string {
  const promptContext = buildEngineeringAdvisorPromptContext(context, historicalFacts);
  return `Contexto do Advisor (JSON, única fonte permitida):\n${JSON.stringify(promptContext)}`;
}

interface ClaudeCallResult {
  readonly response: Anthropic.Message;
  readonly model: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly latencyMs: number;
}

// Único ponto que de fato chama a API — narrateEngineeringBriefing (uso
// de produção) e narrateEngineeringBriefingWithDiagnostics (Advisor Lab,
// Sprint 14.2A) passam por aqui, então nunca podem divergir no prompt ou
// na forma da chamada; só diferem no que cada uma extrai da resposta.
async function callClaude(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts
): Promise<ClaudeCallResult> {
  const model = process.env.ANTHROPIC_ADVISOR_MODEL?.trim() || DEFAULT_MODEL;
  const client = getAnthropicClient();
  const userPrompt = buildUserPrompt(context, historicalFacts);

  const startedAt = Date.now();
  const response = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    // O prompt de sistema é idêntico em toda chamada — cacheado para que
    // só a primeira chamada em cada janela de 5 min pague o preço cheio.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }]
  });
  const latencyMs = Date.now() - startedAt;

  return { response, model, systemPrompt: SYSTEM_PROMPT, userPrompt, latencyMs };
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

export async function narrateEngineeringBriefing(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts
): Promise<EngineeringAdvisorNarrationResult> {
  const { response, model } = await callClaude(context, historicalFacts);
  const text = extractResponseText(response);

  return { raw: parseJsonResponseText(text), model };
}

// Epic 14 (BBA Advisor Evolution), Sprint 14.2A — Advisor Lab. Extensão
// aditiva: reusa exatamente a mesma chamada (callClaude, mesmo
// SYSTEM_PROMPT, mesmo buildUserPrompt) que narrateEngineeringBriefing já
// usa em produção — só expõe também os campos de diagnóstico que a
// produção descarta (prompts exatos, tokens, stop_reason, response id,
// latência). narrateEngineeringBriefing continua com o mesmo contrato de
// sempre; nada no caminho de produção (route.ts) muda por causa disto.
//
// Retorno discriminado por `ok`: diferente de narrateEngineeringBriefing
// (que lança e deixa o fallback de produção assumir), o Lab precisa
// conseguir EXIBIR o que deu errado — se o parse falhar, `ok: false`
// ainda carrega rawText/parseError junto com stopReason/usage/responseId
// já capturados, em vez de perder tudo numa exceção. Isso não muda
// max_tokens, prompt, nem o parser em si (parseJsonResponseText
// continua igual, só passa a ser chamado dentro de um try local aqui).
interface EngineeringAdvisorNarrationDiagnosticsBase {
  readonly model: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly stopReason: string | null;
  readonly responseId: string;
}

export type EngineeringAdvisorNarrationDiagnostics =
  | (EngineeringAdvisorNarrationDiagnosticsBase & { readonly ok: true; readonly raw: unknown })
  | (EngineeringAdvisorNarrationDiagnosticsBase & {
      readonly ok: false;
      readonly rawText: string;
      readonly parseError: string;
    });

export async function narrateEngineeringBriefingWithDiagnostics(
  context: EngineeringAdvisorContext,
  historicalFacts: EngineeringAdvisorHistoricalFacts
): Promise<EngineeringAdvisorNarrationDiagnostics> {
  const { response, model, systemPrompt, userPrompt, latencyMs } = await callClaude(context, historicalFacts);

  const base: EngineeringAdvisorNarrationDiagnosticsBase = {
    model,
    systemPrompt,
    userPrompt,
    latencyMs,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    stopReason: response.stop_reason,
    responseId: response.id
  };

  let text: string;

  try {
    text = extractResponseText(response);
  } catch (error) {
    return { ok: false, rawText: "", parseError: toErrorMessage(error), ...base };
  }

  try {
    return { ok: true, raw: parseJsonResponseText(text), ...base };
  } catch (error) {
    return { ok: false, rawText: text, parseError: toErrorMessage(error), ...base };
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Camada de redação pós-validação: advisor_narratives.narrative continua
// TEXT (Sprint 14.2 não altera banco) — este é o texto achatado que vai
// para essa coluna depois que advisor-response-validator.ts já validou o
// EngineeringAdvisorSummary. As citações (decisionIds etc.) já cumpriram
// seu papel na validação; não são re-serializadas aqui.
export function renderEngineeringAdvisorSummaryToText(summary: EngineeringAdvisorSummary): string {
  if (summary.insights.length === 0) {
    return "Nenhum ponto exige atenção no momento.";
  }

  return summary.insights.map((insight) => `${insight.title}\n${insight.summary}`).join("\n\n");
}
