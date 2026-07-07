/**
 * BBA Project Studio — Sprint 1 (Planning Dataset Import + Living
 * Schedule). Ver `packages/bdos-core/docs/BBA_PROJECT.md`.
 *
 * O Planning Dataset é o modelo consolidado de planejamento: um
 * cronograma XML, um Excel de cronograma, uma curva S e um
 * físico-financeiro produzem, todos, a mesma forma — nenhum consumidor
 * (Advisor, mapa, painel executivo) depende do arquivo de origem.
 */

export type PlanningSourceType = "ms-project-xml" | "excel";

/**
 * Carimbo manual da forma de `PlanningDataset` (Sprint 13.7 —
 * persistência da Camada 2, `planning_datasets.dataset_schema_version`).
 * Incrementar sempre que esta interface mudar de verdade, nunca como
 * semver automático — é o que permite saber quais linhas antigas
 * precisam de migração/reinterpretação quando o formato evoluir.
 */
export const PLANNING_DATASET_SCHEMA_VERSION = 1;

export type PlanningDetectedType = "cronograma" | "curva-s" | "fisico-financeiro" | "mixed" | "unknown";

export interface PlanningDatasetOrigin {
  readonly sourceType: PlanningSourceType;
  readonly fileName: string;
  readonly sheetName: string | null;
  readonly importedAt: string;
}

export type PlanningDependencyType = "FinishToStart" | "StartToStart" | "FinishToFinish" | "StartToFinish";

export interface PlanningActivityDependency {
  readonly predecessorId: string;
  readonly type: PlanningDependencyType;
  readonly lagDays: number;
}

/**
 * Deliberadamente permissivo — a maioria dos campos é opcional. Uma
 * linha de físico-financeiro real (ver `BBA_PROJECT.md`, Sprint 1) não
 * tem datas nem dependências; isso é uma limitação real do arquivo de
 * origem, não um erro de importação.
 */
export interface PlanningActivityRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly sequence: number;
  readonly isSummary: boolean;
  readonly isMilestone: boolean;
  readonly plannedStart: string | null;
  readonly plannedEnd: string | null;
  readonly durationDays: number | null;
  readonly percentPlanned: number | null;
  readonly percentActual: number | null;
  readonly plannedValue: number | null;
  readonly actualValue: number | null;
  readonly weight: number | null;
  readonly dependencies: ReadonlyArray<PlanningActivityDependency>;
}

export interface PlanningPeriodPoint {
  /** Rótulo bruto da coluna de origem, ex.: "mês 8". */
  readonly period: string;
  /** Data resolvida, quando a planilha traz uma linha de referência de datas por período. */
  readonly date: string | null;
  readonly plannedPercent: number | null;
  readonly plannedValue: number | null;
  readonly actualPercent: number | null;
  readonly actualValue: number | null;
}

export interface PlanningPeriodSeries {
  /** `null` = série agregada do projeto inteiro (a Curva S consolidada). */
  readonly activityId: string | null;
  readonly label: string;
  readonly points: ReadonlyArray<PlanningPeriodPoint>;
}

export interface PlanningFinancialSummary {
  readonly contractValue: number | null;
  readonly amendmentsValue: number | null;
  readonly measuredAccumulatedValue: number | null;
  readonly remainingBalanceValue: number | null;
}

export type PlanningImportWarningCode =
  | "missing_dependencies"
  | "missing_dates"
  | "missing_column"
  | "unrecognized_sheet"
  | "hidden_sheet_skipped"
  | "no_activities_recognized"
  | "ambiguous_planning_type";

export interface PlanningImportWarning {
  readonly code: PlanningImportWarningCode;
  readonly message: string;
  readonly sheetName?: string;
}

export interface PlanningDataset {
  readonly origin: PlanningDatasetOrigin;
  readonly detectedType: PlanningDetectedType;
  readonly activities: ReadonlyArray<PlanningActivityRecord>;
  readonly periodSeries: ReadonlyArray<PlanningPeriodSeries>;
  readonly financial: PlanningFinancialSummary | null;
  readonly warnings: ReadonlyArray<PlanningImportWarning>;
}
