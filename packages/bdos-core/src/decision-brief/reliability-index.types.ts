/**
 * Epic 20 (Decision Experience). Índice de Confiabilidade genérico --
 * mesmo molde de `HealthScoreResult`
 * (apps/web/components/bba-project/bba-project-insights.ts),
 * generalizado para qualquer Studio.
 *
 * `ReliabilityIndexResult` é uma união discriminada por `status`:
 * `available` (score/level/factors calculados) nunca é confundido
 * com `unavailable` (nenhum modelo determinístico de cálculo existe
 * ainda). "Indisponível" não significa score zero, nível neutro ou
 * confiança baixa -- é uma afirmação diferente ("não sei calcular
 * isso ainda"), nunca disfarçada de um resultado calculado. Nenhuma
 * UI deve inferir score ou level quando `status === "unavailable"`.
 */

export type ReliabilityLevel = "healthy" | "attention" | "risk" | "critical";

export interface ReliabilityFactor {
  readonly label: string;
  readonly penalty: number;
  readonly available: boolean;
  readonly unavailableReason: string | null;
}

export interface ReliabilityIndexAvailable {
  readonly status: "available";
  readonly score: number;
  readonly level: ReliabilityLevel;
  readonly label: string;
  readonly factors: ReadonlyArray<ReliabilityFactor>;
  /** Versão do modelo de cálculo de confiabilidade -- própria, independente de `DecisionBriefMetadata.builderVersion`. */
  readonly modelVersion: string;
}

export type ReliabilityIndexUnavailableReason = "calculation_model_not_defined";

export interface ReliabilityIndexUnavailable {
  readonly status: "unavailable";
  readonly reason: ReliabilityIndexUnavailableReason;
}

export type ReliabilityIndexResult = ReliabilityIndexAvailable | ReliabilityIndexUnavailable;
