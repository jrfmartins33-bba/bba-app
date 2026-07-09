import type { Recommendation } from "../recommendation";

export type PlaybookId = string;

export type PlaybookStepId = string;

export type PlaybookStepPriority = "critical" | "high" | "medium" | "low";

export type PlaybookEstimatedImpact = "high" | "medium" | "low";

export type PlaybookEstimatedEffort = "high" | "medium" | "low";

export type PlaybookMetadata = Readonly<Record<string, unknown>>;

export interface PlaybookStep {
  readonly id: PlaybookStepId;
  readonly title: string;
  readonly description: string;
  readonly priority: PlaybookStepPriority;
  // Opcionais (Epic 16.6A — ver
  // packages/bdos-core/docs/ACTIONPLAN_MATERIALIZATION_BOUNDARY.md,
  // regra de honestidade): atributos de enriquecimento, não de
  // causalidade — a cadeia que PRINCIPLE 006 protege
  // (RecommendationOption -> PlaybookStep -> Action) não depende
  // deles. Templates curados (ex.: Cash Protection) podem preenchê-los;
  // buildGenericPlaybook nunca inventa um valor quando não há dado
  // real na Recommendation de origem.
  readonly estimatedImpact?: PlaybookEstimatedImpact;
  readonly estimatedEffort?: PlaybookEstimatedEffort;
}

export interface Playbook {
  readonly id: PlaybookId;
  readonly name: string;
  readonly objective: string;
  readonly description: string;
  readonly recommendationId: string;
  readonly steps: ReadonlyArray<PlaybookStep>;
  readonly kpis: ReadonlyArray<string>;
  readonly risks: ReadonlyArray<string>;
  readonly successCriteria: ReadonlyArray<string>;
  readonly metadata: PlaybookMetadata;
}

export type BuildPlaybooksInput = ReadonlyArray<Recommendation>;

export type BuildPlaybooksResult = ReadonlyArray<Playbook>;
