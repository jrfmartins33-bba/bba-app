import type { EngineeringAdvisorPromptContext } from "../advisor-prompt-context.types";
import {
  CLARIFY_LIST_LIMIT,
  buildCopilotCandidates,
  candidateId,
  candidateTitle,
  topCopilotCandidates,
  type CopilotCandidate
} from "./copilot-candidates";
import { CLARIFY_LIST_INTRO } from "./copilot-deterministic-turn-builder";
import type { CopilotConversationHistoryEntry } from "./copilot-turn.types";

// Decision Copilot (Epic 15, Fase 2) — Intent Router
// (DECISION_COPILOT_PHASE2.md §1). 100% rule-based: nenhuma
// classificação por modelo, aqui ou em versão futura, sem revisar essa
// decisão em documento próprio primeiro (§6, regra "determinístico
// primeiro"). Só decide a FORMA da resposta (responder / perguntar /
// comparar / recusar) — nunca conteúdo de negócio.

export type CopilotIntent = "answer" | "clarify" | "compare" | "unsupported_action";

export interface CopilotResolvedTarget {
  readonly kind: CopilotCandidate["kind"];
  readonly id: string;
  readonly title: string;
}

export interface CopilotIntentClassification {
  readonly intent: CopilotIntent;
  readonly target: CopilotResolvedTarget | null;
}

// Verbos no imperativo — vocabulário previsível de pedido de ação
// (DECISION_COPILOT_PHASE2.md §1: "cobre o caso mais importante... com
// alta precisão").
const UNSUPPORTED_ACTION_VERBS = [
  "aprove",
  "aprova",
  "aprovar",
  "adie",
  "adia",
  "adiar",
  "execute",
  "executa",
  "executar",
  "aplique",
  "aplica",
  "aplicar",
  "cancele",
  "cancela",
  "cancelar",
  "rejeite",
  "rejeita",
  "rejeitar",
  "conclua",
  "conclui",
  "concluir",
  "marque",
  "marca",
  "marcar",
  "mude o status",
  "altere o status"
];

const COMPARISON_KEYWORDS = [
  "compare",
  "comparar",
  "comparação",
  "diferença entre",
  "qual das duas",
  "qual das opções",
  " vs ",
  " vs. ",
  "versus"
];

// "2", "a 2", "opção 2", "a segunda opção" (só dígito — números por
// extenso ficam fora do escopo desta heurística, mesma disciplina de
// não resolver por inferência o que a UI pode simplesmente pedir em
// dígito).
const CLARIFY_SELECTION_PATTERN = /^\s*(?:a\s+|op[cç][aã]o\s+)?(\d+)\.?\s*$/i;

export function classifyCopilotIntent(
  message: string,
  context: EngineeringAdvisorPromptContext,
  conversationHistory: ReadonlyArray<CopilotConversationHistoryEntry>
): CopilotIntentClassification {
  const normalizedMessage = normalize(message);

  if (containsAny(normalizedMessage, UNSUPPORTED_ACTION_VERBS)) {
    return { intent: "unsupported_action", target: null };
  }

  const resumingClarifySelection =
    CLARIFY_SELECTION_PATTERN.test(message.trim()) && lastAssistantMessageIsClarifyList(conversationHistory);
  const explicitComparisonRequest = containsAny(normalizedMessage, COMPARISON_KEYWORDS);

  // Escopo desta entrega (15.2A+15.2B): só "compare" — explícito ou
  // retomado de uma lista de clarify anterior — passa pela resolução
  // de alvo. Ambiguidade em perguntas comuns ("qual decisão é essa?")
  // fica fora desta heurística por ora — ver nota de escopo em
  // DECISION_COPILOT_PHASE2.md §2 ("Problema"); adicionar um gatilho
  // de ambiguidade geral aqui arriscaria falso-positivo sobre o
  // caminho "answer" já validado na Fase 1.
  if (!explicitComparisonRequest && !resumingClarifySelection) {
    return { intent: "answer", target: null };
  }

  const target = resolveCopilotTarget(message, context, conversationHistory);
  return target ? { intent: "compare", target } : { intent: "clarify", target: null };
}

function resolveCopilotTarget(
  message: string,
  context: EngineeringAdvisorPromptContext,
  conversationHistory: ReadonlyArray<CopilotConversationHistoryEntry>
): CopilotResolvedTarget | null {
  // Id/título buscam em TODOS os candidatos do contexto — só a
  // resolução por número (abaixo) fica restrita ao top-N que
  // buildClarifyTurn de fato mostrou.
  const candidates = buildCopilotCandidates(context);

  const idMatch = candidates.find((candidate) => message.includes(candidateId(candidate)));
  if (idMatch) {
    return toResolvedTarget(idMatch);
  }

  const titleMatches = candidates.filter((candidate) => matchesTitle(message, candidateTitle(candidate)));
  if (titleMatches.length === 1) {
    return toResolvedTarget(titleMatches[0]);
  }
  if (titleMatches.length > 1) {
    // Mais de um título bate com a mensagem — alvo ambíguo, mesmo
    // tratamento de "nenhum alvo resolvido" (vira clarify).
    return null;
  }

  const selected = resolveFromLastClarifyList(message, conversationHistory, context);
  return selected ? toResolvedTarget(selected) : null;
}

function resolveFromLastClarifyList(
  message: string,
  conversationHistory: ReadonlyArray<CopilotConversationHistoryEntry>,
  context: EngineeringAdvisorPromptContext
): CopilotCandidate | null {
  const match = CLARIFY_SELECTION_PATTERN.exec(message.trim());
  if (!match || !lastAssistantMessageIsClarifyList(conversationHistory)) {
    return null;
  }

  const index = Number(match[1]) - 1;
  // Redenerivada do contexto atual, não persistida em lugar nenhum —
  // mesma lista/ordem que buildClarifyTurn já produziu, porque as duas
  // partem da mesma função pura (DECISION_COPILOT_PHASE2.md §1, item 3).
  const candidates = topCopilotCandidates(context, CLARIFY_LIST_LIMIT);
  return candidates[index] ?? null;
}

function lastAssistantMessageIsClarifyList(conversationHistory: ReadonlyArray<CopilotConversationHistoryEntry>): boolean {
  for (let index = conversationHistory.length - 1; index >= 0; index -= 1) {
    const entry = conversationHistory[index];
    if (entry.role === "assistant") {
      return entry.content.startsWith(CLARIFY_LIST_INTRO);
    }
  }
  return false;
}

function toResolvedTarget(candidate: CopilotCandidate): CopilotResolvedTarget {
  return { kind: candidate.kind, id: candidateId(candidate), title: candidateTitle(candidate) };
}

function matchesTitle(message: string, title: string): boolean {
  const normalizedTitle = normalize(title);
  if (normalizedTitle.length === 0) {
    return false;
  }
  return normalize(message).includes(normalizedTitle);
}

function containsAny(normalizedMessage: string, terms: ReadonlyArray<string>): boolean {
  return terms.some((term) => normalizedMessage.includes(normalize(term)));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
