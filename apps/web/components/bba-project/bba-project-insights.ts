import { activityIdFromSpatialObjectId } from "./bba-project-ids";
import type { BbaProjectPlanningActivity, BbaProjectSnapshot } from "./bba-project-view-types";

/**
 * BBA Project Studio — Sprint 2 (EPIC 02, Decision First Experience).
 * Nenhuma regra de negócio nova vive aqui — só leitura executiva dos
 * mesmos campos que `PlanningImportSnapshot` já traz. Nenhum destes
 * cálculos chama o BDOS; são puramente de apresentação.
 */

const WARNING_CODE_LABELS: Record<string, string> = {
  no_current_geometry: "nenhuma geometria de campo registrada ainda",
  current_geometry_low_precision: "geometria atual com baixa precisão",
  single_geometry_version: "geometria nunca foi refinada por uma segunda medição",
  single_layer_attached: "apenas uma camada de dado anexada até agora",
  no_evidential_layer: "nenhuma evidência de campo anexada"
};

export type HealthScoreLevel = "healthy" | "attention" | "risk" | "critical";

export interface HealthScoreResult {
  readonly score: number;
  readonly level: HealthScoreLevel;
  readonly label: string;
  /** Cada fator, já convertido em pontos perdidos — usado para explicar o número, nunca escondido. */
  readonly factors: ReadonlyArray<{ readonly label: string; readonly penalty: number }>;
}

/**
 * Health Score (0–100). Começa em 100 e desconta, de forma transparente:
 *
 * - Densidade de risco (até -50 pontos): decisões ÷ objetos espaciais
 *   analisados — quanto maior a proporção de itens com Decision aberta,
 *   pior o placar.
 * - Avisos de importação (até -20 pontos): 5 pontos por warning
 *   estrutural (dado que a origem não trouxe).
 * - Confiança espacial dominante (até -20 pontos): o nível de
 *   confiança mais frequente entre os fatos existentes
 *   (Low = -20, Medium = -10, High/Verified = 0).
 * - Risco no caminho crítico (-10 pontos): quando pelo menos uma
 *   decisão recai sobre uma atividade que também é crítica.
 *
 * Nenhum destes pesos vem de um algoritmo de ML ou de uma nova regra
 * do Decision Engine — são constantes de apresentação, documentadas
 * aqui, e podem ser recalibradas sem tocar em nenhum Engine.
 */
export function computeHealthScore(snapshot: BbaProjectSnapshot): HealthScoreResult {
  const totalObjects = Math.max(1, snapshot.spatialObjects.length);
  const riskDensity = snapshot.decisions.length / totalObjects;
  const riskPenalty = Math.min(50, Math.round(riskDensity * 50));

  const warningPenalty = Math.min(20, snapshot.warnings.length * 5);

  const confidenceLevels = snapshot.facts
    .map((fact) => (typeof fact.metadata.spatialConfidenceLevel === "string" ? (fact.metadata.spatialConfidenceLevel as string) : null))
    .filter((level): level is string => level !== null);
  const dominantConfidence = mostFrequent(confidenceLevels);
  const confidencePenalty = dominantConfidence === "Low" ? 20 : dominantConfidence === "Medium" ? 10 : 0;

  const criticalIds = new Set(snapshot.criticalPath.criticalActivityIds);
  const hasCriticalRisk = snapshot.decisions.some((decision) => {
    const activityId = activityIdFromDecision(decision);
    return activityId !== null && criticalIds.has(activityId);
  });
  const criticalRiskPenalty = hasCriticalRisk ? 10 : 0;

  const score = clamp(100 - riskPenalty - warningPenalty - confidencePenalty - criticalRiskPenalty, 0, 100);

  return {
    score,
    level: levelForScore(score),
    label: labelForScore(score),
    factors: [
      { label: "Densidade de risco", penalty: riskPenalty },
      { label: "Avisos de importação", penalty: warningPenalty },
      { label: "Confiança espacial", penalty: confidencePenalty },
      { label: "Risco no caminho crítico", penalty: criticalRiskPenalty }
    ]
  };
}

function levelForScore(score: number): HealthScoreLevel {
  if (score >= 80) return "healthy";
  if (score >= 60) return "attention";
  if (score >= 40) return "risk";
  return "critical";
}

function labelForScore(score: number): string {
  if (score >= 80) return "Planejamento saudável";
  if (score >= 60) return "Atenção recomendada";
  if (score >= 40) return "Projeto requer atenção";
  return "Risco elevado";
}

export interface HeroNarrative {
  readonly greeting: string;
  readonly lines: ReadonlyArray<string>;
  readonly focusActivity: BbaProjectPlanningActivity | null;
}

/**
 * Texto do Hero Executive — inteiramente derivado do snapshot real
 * (contagens de decisões, atividade em maior risco, caminho crítico,
 * recomendação real). Nunca um texto fixo por trás de um "parece
 * dinâmico".
 */
export function buildHeroNarrative(snapshot: BbaProjectSnapshot, focusActivityId: string | null): HeroNarrative {
  const greeting = greetingForNow();
  const riskCount = snapshot.decisions.length;
  const focusActivity = snapshot.planningDataset.activities.find((activity) => activity.id === focusActivityId) ?? null;
  const criticalIds = new Set(snapshot.criticalPath.criticalActivityIds);
  const focusIsCritical = focusActivity !== null && criticalIds.has(focusActivity.id);
  const focusRecommendation = focusActivity ? recommendationForActivity(snapshot, focusActivity.id) : null;

  if (riskCount === 0) {
    return {
      greeting,
      lines: [
        "Analisei o planejamento importado.",
        "Não encontrei atividades com risco de confiança espacial no momento."
      ],
      focusActivity: null
    };
  }

  const lines = [
    "Analisei o planejamento importado.",
    `Encontrei ${riskCount} ${riskCount === 1 ? "atividade" : "atividades"} sem validação espacial suficiente.`
  ];

  if (focusActivity !== null) {
    lines.push(
      focusIsCritical
        ? `A principal delas, "${focusActivity.name}", está no caminho crítico e poderá impactar o prazo do projeto.`
        : `A principal delas é "${focusActivity.name}".`
    );
  }

  if (focusRecommendation !== null) {
    lines.push(`Minha recomendação é ${lowerFirst(focusRecommendation.summary)}`);
  }

  return { greeting, lines, focusActivity };
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia.";
  if (hour < 18) return "Boa tarde.";
  return "Boa noite.";
}

export interface AdvisorNarrativeSection {
  readonly title: string;
  readonly body: string;
}

export interface AdvisorNarrative {
  readonly situacao: AdvisorNarrativeSection;
  readonly motivo: AdvisorNarrativeSection;
  readonly impacto: AdvisorNarrativeSection;
  readonly recomendacao: AdvisorNarrativeSection;
}

/**
 * As mesmas quatro perguntas de sempre (PRINCIPLE 001), só que
 * escritas como narrativa corrida em vez de rótulo técnico de
 * accordion — o dado por trás é idêntico ao que já alimentava o
 * `DecisionInsightCard`.
 */
export function buildAdvisorNarrative(params: {
  readonly activity: BbaProjectPlanningActivity | null;
  readonly warningCodes: ReadonlyArray<string>;
  readonly isCritical: boolean;
  readonly hasSchedule: boolean;
  readonly recommendationSummary: string | null;
}): AdvisorNarrative {
  const { activity, warningCodes, isCritical, hasSchedule, recommendationSummary } = params;
  const activityName = activity?.name ?? "a atividade selecionada";

  return {
    situacao: {
      title: "Situação",
      body: activity ? `"${activityName}" encontra-se sem evidências suficientes para confirmar sua localização real.` : "Selecione uma atividade para ver a análise."
    },
    motivo: {
      title: "Motivo",
      body:
        warningCodes.length > 0
          ? capitalize(warningCodes.map((code) => WARNING_CODE_LABELS[code] ?? code).join("; ")) + "."
          : "Ainda não existe evidência de campo suficiente registrada para esta atividade."
    },
    impacto: {
      title: "Impacto",
      body: !hasSchedule
        ? "Sem datas/dependências explícitas na origem, o impacto no prazo não pôde ser calculado."
        : isCritical
          ? "A atividade permanece no caminho crítico — qualquer atraso aqui atrasa o projeto inteiro."
          : "A atividade possui folga; um atraso aqui não afeta o prazo final, por ora."
    },
    recomendacao: {
      title: "Recomendação",
      body: recommendationSummary ?? "Nenhuma recomendação pendente para esta atividade."
    }
  };
}

export interface ReasoningStep {
  readonly label: string;
  readonly count: number;
  readonly description: string;
}

/**
 * "Como cheguei nesta conclusão?" — a mesma cadeia real
 * Planejamento → SpatialObject → BusinessFact → Diagnosis → Decision →
 * Recommendation, com a contagem real de cada estágio. Nenhum estágio é
 * novo; é a mesma sequência que `services/bba-project-import` já
 * executa.
 *
 * Epic 17.0 (vocabulário de produto) — os `label`s exibidos usam
 * vocabulário de produto, nunca os nomes internos de arquitetura
 * (BusinessFact/Diagnosis/Decision/Recommendation, em inglês). Cada um
 * reaproveita, de propósito, uma palavra já usada em outro lugar desta
 * mesma tela — "Confiança" já aparece nos cards executivos e no Modelo
 * Espacial; "Decisão"/"Recomendação" já aparecem no bloco do Advisor —
 * para que o mesmo conceito nunca tenha dois nomes diferentes em telas
 * diferentes (`PRODUCT_VOCABULARY.md`, Risco 1).
 */
export function buildReasoningChain(snapshot: BbaProjectSnapshot): ReadonlyArray<ReasoningStep> {
  return [
    {
      label: "Planejamento",
      count: snapshot.planningDataset.activities.length,
      description: "itens reconhecidos no arquivo importado"
    },
    {
      label: "Objeto Espacial",
      count: snapshot.spatialObjects.length,
      description: "objetos espaciais gerados"
    },
    {
      label: "Confiança Espacial",
      count: snapshot.facts.length,
      description: "fatos de confiança espacial avaliados"
    },
    {
      label: "Diagnóstico",
      count: snapshot.diagnoses.length,
      description: "diagnósticos de risco identificados"
    },
    {
      label: "Decisão",
      count: snapshot.decisions.length,
      description: "decisões abertas"
    },
    {
      label: "Recomendação",
      count: snapshot.recommendations.length,
      description: "recomendações geradas"
    }
  ];
}

export function activityIdFromDecision(decision: BbaProjectSnapshot["decisions"][number]): string | null {
  const spatialObjectId = decision.evidence[0]?.sourceReference;
  return spatialObjectId ? activityIdFromSpatialObjectId(spatialObjectId) : null;
}

function recommendationForActivity(
  snapshot: BbaProjectSnapshot,
  activityId: string
): BbaProjectSnapshot["recommendations"][number] | null {
  const decision = snapshot.decisions.find((candidate) => activityIdFromDecision(candidate) === activityId);
  if (decision === undefined) {
    return null;
  }
  return snapshot.recommendations.find((recommendation) => recommendation.decisionId === decision.id) ?? null;
}

function mostFrequent(values: ReadonlyArray<string>): string | null {
  if (values.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  let best: string | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  });

  return best;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lowerFirst(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toLowerCase() + value.slice(1);
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}
