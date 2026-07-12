/**
 * Epic 20 (Decision Experience), Sprint 20.1A — Decision Brief Core
 * Contract. Índice de Confiabilidade genérico -- mesmo molde de
 * `HealthScoreResult`
 * (apps/web/components/bba-project/bba-project-insights.ts),
 * generalizado para qualquer Studio: cada fator declara se está
 * `available`, nunca preenche um fator indisponível com um valor
 * neutro disfarçado. Ver
 * packages/bdos-core/docs/EPIC_20_DECISION_EXPERIENCE_VISION.md §M e
 * packages/bdos-core/docs/EPIC_20_SPRINT_1_MEASUREMENT_DECISION_BRIEF_DESIGN.md
 * (III.2) para a justificativa completa.
 */

export type ReliabilityLevel = "healthy" | "attention" | "risk" | "critical";

export interface ReliabilityFactor {
  readonly label: string;
  readonly penalty: number;
  readonly available: boolean;
  readonly unavailableReason: string | null;
}

export interface ReliabilityIndexResult {
  readonly score: number;
  readonly level: ReliabilityLevel;
  readonly label: string;
  readonly factors: ReadonlyArray<ReliabilityFactor>;
}
