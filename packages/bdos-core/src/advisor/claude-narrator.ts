import Anthropic from "@anthropic-ai/sdk";
import type { EngineeringAdvisorContext } from "./advisor-context.types";
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
const MAX_OUTPUT_TOKENS = 700;

const SYSTEM_PROMPT = `Você é o BBA Advisor, um analista que resume o estado de um projeto de engenharia para o gestor da empresa cliente, a partir de um contexto já calculado pelo BDOS.

CONTEXTO RECEBIDO (JSON, única fonte de fatos permitida):
- snapshot: dados gerais do projeto e Health Score.
- decisions: Decisions já calculadas pelo BDOS, com evidence embutida.
- recommendations: o Candidate Set de Recommendations elegíveis (nunca a lista completa do sistema).
- evidenceIndex: evidências de cada Decision, indexadas por decisionId.
- historySummary: fato histórico simples (ex.: "Health Score 72 → 81").

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
- Nunca responda fora deste schema — nenhum texto, nenhum markdown, nenhuma explicação adicional.`;

export interface EngineeringAdvisorNarrationResult {
  readonly raw: unknown;
  readonly model: string;
}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export async function narrateEngineeringBriefing(
  context: EngineeringAdvisorContext
): Promise<EngineeringAdvisorNarrationResult> {
  const model = process.env.ANTHROPIC_ADVISOR_MODEL?.trim() || DEFAULT_MODEL;
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    // O prompt de sistema é idêntico em toda chamada — cacheado para que
    // só a primeira chamada em cada janela de 5 min pague o preço cheio.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Contexto do Advisor (JSON, única fonte permitida):\n${JSON.stringify(context)}`
      }
    ]
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude não retornou nenhum texto de resposta.");
  }

  return { raw: parseStructuredSummaryText(text), model };
}

// Sem tool_choice (Sprint 14.2 não implementa Tool Use), a adesão ao JSON
// é só por instrução de prompt — o Claude pode envolver a resposta em
// cercas de markdown (```json ... ```) apesar da instrução em contrário.
// Stripamos isso defensivamente aqui; qualquer outro desvio de schema
// (campo faltando, id inventado etc.) é responsabilidade do Response
// Validator (advisor-response-validator.ts), não deste parser — este só
// lida com "é JSON parseável ou não".
function parseStructuredSummaryText(text: string): unknown {
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonText = fenceMatch ? fenceMatch[1] : text;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Claude não retornou um JSON válido: ${error instanceof Error ? error.message : String(error)}`);
  }
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
