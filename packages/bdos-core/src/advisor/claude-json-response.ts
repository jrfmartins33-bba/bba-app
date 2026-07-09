// Parser defensivo de JSON para respostas do Claude, extraído de
// claude-narrator.ts (Sprint 13.12/14.2) no momento em que um segundo
// consumidor (Decision Copilot, Epic 15) precisou da mesma coisa — sem
// tool_choice, a adesão ao JSON é só por instrução de prompt, então o
// Claude pode envolver a resposta em cercas de markdown
// (```json ... ```) apesar da instrução em contrário. Stripamos isso
// defensivamente aqui; qualquer outro desvio de schema (campo faltando,
// id inventado etc.) é responsabilidade de cada Response Validator, não
// deste parser — este só lida com "é JSON parseável ou não".
export function parseJsonResponseText(text: string): unknown {
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonText = fenceMatch ? fenceMatch[1] : text;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Claude não retornou um JSON válido: ${error instanceof Error ? error.message : String(error)}`);
  }
}
