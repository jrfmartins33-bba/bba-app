import type { DecisionId } from "../domain/decision";
import type { RecommendationId } from "../engines/decision/recommendation";
import type { EngineeringAdvisorContext } from "./advisor-context.types";
import type {
  EngineeringAdvisorInsight,
  EngineeringAdvisorInsightPriority,
  EngineeringAdvisorSummary
} from "./advisor-summary.types";

// Epic 14 (BBA Advisor Evolution), Sprint 14.2 — Response Validator.
// Único portão entre o que o Claude respondeu (Structured Advisor
// Summary) e o que pode ser persistido em advisor_narratives. Sem
// tool_choice (esta Sprint não implementa Tool Use), aderência ao schema
// é só por instrução de prompt — este validador é quem de fato garante
// que nenhuma citação inexistente ou fora do Candidate Set passe.
//
// Puro, sem I/O, sem exceptions: devolve { valid: false, reason } em vez
// de lançar. Quem chama (route.ts) decide o que fazer com isso — hoje,
// reusar o fallback já existente (não persistir, deixar a Home cair nos
// itens template), sem duplicar essa lógica aqui.
//
// Rastreabilidade obrigatória nesta Sprint: Recommendation → Decision →
// DecisionEvidence. BusinessFact continua fora do pipeline (ver
// advisor-context-builder.ts) — não há nenhum lookup para ela aqui.

const VALID_PRIORITIES: ReadonlySet<string> = new Set(["low", "medium", "high", "critical"]);

export type EngineeringAdvisorValidationResult =
  | { readonly valid: true; readonly summary: EngineeringAdvisorSummary }
  | { readonly valid: false; readonly reason: string };

export function validateEngineeringAdvisorSummary(
  raw: unknown,
  context: EngineeringAdvisorContext
): EngineeringAdvisorValidationResult {
  if (!isRecord(raw) || !Array.isArray(raw.insights)) {
    return { valid: false, reason: 'Resposta não é um objeto com "insights" (array).' };
  }

  const eligibleRecommendationIds = new Set(context.recommendations.map((recommendation) => recommendation.id));
  const eligibleDecisionIds = new Set(context.decisions.map((decision) => decision.id));

  const insights: EngineeringAdvisorInsight[] = [];

  for (let index = 0; index < raw.insights.length; index += 1) {
    const result = validateInsight(raw.insights[index], index, eligibleRecommendationIds, eligibleDecisionIds);
    if (!result.valid) {
      return result;
    }
    insights.push(result.insight);
  }

  return { valid: true, summary: { insights } };
}

type InsightValidationResult =
  | { readonly valid: true; readonly insight: EngineeringAdvisorInsight }
  | { readonly valid: false; readonly reason: string };

function validateInsight(
  raw: unknown,
  index: number,
  eligibleRecommendationIds: ReadonlySet<RecommendationId>,
  eligibleDecisionIds: ReadonlySet<DecisionId>
): InsightValidationResult {
  if (!isRecord(raw)) {
    return { valid: false, reason: `insights[${index}] não é um objeto.` };
  }

  if (typeof raw.title !== "string" || raw.title.trim().length === 0) {
    return { valid: false, reason: `insights[${index}].title ausente ou vazio.` };
  }

  if (typeof raw.summary !== "string" || raw.summary.trim().length === 0) {
    return { valid: false, reason: `insights[${index}].summary ausente ou vazio.` };
  }

  if (typeof raw.priority !== "string" || !VALID_PRIORITIES.has(raw.priority)) {
    return { valid: false, reason: `insights[${index}].priority inválida: ${String(raw.priority)}.` };
  }

  const decisionIds = readStringArray(raw.decisionIds);
  if (!decisionIds) {
    return { valid: false, reason: `insights[${index}].decisionIds não é um array de strings.` };
  }

  const recommendationIds = readStringArray(raw.recommendationIds);
  if (!recommendationIds) {
    return { valid: false, reason: `insights[${index}].recommendationIds não é um array de strings.` };
  }

  const evidenceDecisionIds = readStringArray(raw.evidenceDecisionIds);
  if (!evidenceDecisionIds) {
    return { valid: false, reason: `insights[${index}].evidenceDecisionIds não é um array de strings.` };
  }

  if (decisionIds.length === 0) {
    return { valid: false, reason: `insights[${index}] não cita nenhuma Decision (decisionIds vazio).` };
  }

  if (evidenceDecisionIds.length === 0) {
    return { valid: false, reason: `insights[${index}] não cita nenhuma evidência (evidenceDecisionIds vazio).` };
  }

  for (const id of decisionIds) {
    if (!eligibleDecisionIds.has(id)) {
      return { valid: false, reason: `insights[${index}] cita Decision inexistente no contexto: "${id}".` };
    }
  }

  for (const id of evidenceDecisionIds) {
    if (!decisionIds.includes(id)) {
      return {
        valid: false,
        reason: `insights[${index}].evidenceDecisionIds tem "${id}" fora de decisionIds — evidência precisa apoiar uma Decision já citada.`
      };
    }
  }

  for (const id of recommendationIds) {
    if (!eligibleRecommendationIds.has(id)) {
      return {
        valid: false,
        reason: `insights[${index}] cita Recommendation fora do Candidate Set: "${id}".`
      };
    }
  }

  return {
    valid: true,
    insight: {
      title: raw.title,
      summary: raw.summary,
      priority: raw.priority as EngineeringAdvisorInsightPriority,
      decisionIds,
      recommendationIds,
      evidenceDecisionIds
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): ReadonlyArray<string> | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.every((item): item is string => typeof item === "string") ? value : null;
}
