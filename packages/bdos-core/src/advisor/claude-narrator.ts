import Anthropic from "@anthropic-ai/sdk";

// BBA Advisor — narrador via Claude (Sprint 13.12, "diferencial BBA" V1).
// Camada de redação, não de cálculo: recebe só os itens que
// getEngineeringAdvisorBriefing() já produziu (apps/web/lib/bdos/advisor.ts)
// e devolve uma síntese em linguagem natural. Nunca lê banco, nunca chama
// outro Engine, nunca recebe nada além do JSON fechado abaixo — a mesma
// regra de fronteira que já vale para o resto do Advisor (ver
// docs/PLATFORM_ARCHITECTURE.md, seção 1: "Advisor... nunca cria regra de
// negócio, só interpreta o que os Engines já calcularam") vale para a LLM.
//
// Se esta chamada falhar (rede, quota, API fora do ar), quem chama
// (import/route.ts) captura o erro e não grava narrativa nenhuma — a Home
// cai de volta nos itens template determinísticos que já existiam antes
// desta Sprint. Esta função nunca deve ser o motivo de um import falhar.

const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 400;

const SYSTEM_PROMPT = `Você é o BBA Advisor, um narrador que resume o estado de um projeto de engenharia para o gestor da empresa cliente.

REGRAS INEGOCIÁVEIS:
- Use exclusivamente os fatos fornecidos no JSON abaixo. Nunca invente número, data, nome de atividade ou valor que não esteja explicitamente presente.
- Se um dado necessário não estiver no JSON, diga que a informação não está disponível — nunca estime ou infira um valor ausente.
- Não dê conselho jurídico, financeiro ou contratual além do que os itens já descrevem.
- Escreva em português do Brasil, tom direto e executivo, sem jargão técnico.
- No máximo 3 parágrafos curtos. Comece pelo que exige ação, se houver algo crítico ou de atenção.`;

export interface EngineeringAdvisorNarrationItem {
  readonly severity: "critical" | "attention" | "info" | "trend";
  readonly headline: string;
  readonly detail: string;
}

export interface EngineeringAdvisorNarrationInput {
  readonly engineeringProjectName: string;
  readonly items: ReadonlyArray<EngineeringAdvisorNarrationItem>;
}

export interface EngineeringAdvisorNarrationResult {
  readonly narrative: string;
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
  input: EngineeringAdvisorNarrationInput
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
        content: `Projeto: ${input.engineeringProjectName}\n\nFatos (JSON, única fonte permitida):\n${JSON.stringify(input.items)}`
      }
    ]
  });

  const narrative = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!narrative) {
    throw new Error("Claude não retornou nenhum texto de narrativa.");
  }

  return { narrative, model };
}
