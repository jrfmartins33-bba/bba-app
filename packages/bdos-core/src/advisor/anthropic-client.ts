import Anthropic from "@anthropic-ai/sdk";

// Cliente Anthropic cacheado, extraído de claude-narrator.ts (Sprint
// 13.12) no momento em que um segundo consumidor (Decision Copilot,
// Epic 15) precisou da mesma coisa — regra de generalização tardia já
// em uso no resto da plataforma (ver docs/PLATFORM_ARCHITECTURE.md §7):
// não existia motivo para extrair isso com um único consumidor.

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
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
