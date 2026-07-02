export type DecisionCaseId = string;

export type DecisionCaseCapability = string;

export type DecisionCaseDateTime = string;

export type DecisionCaseActor = string;

export type DecisionCaseArtifactId = string;

export type DecisionCaseMetadata = Readonly<Record<string, unknown>>;

export type DecisionCaseArtifactType =
  | "decision"
  | "recommendation"
  | "playbook"
  | "action-plan";

export interface DecisionCaseArtifactRef {
  readonly id: DecisionCaseArtifactId;
  readonly type: DecisionCaseArtifactType;
}

export enum DecisionCaseState {
  Created = "created",
  Observed = "observed",
  Diagnosed = "diagnosed",
  DecisionBuilt = "decision_built",
  Recommended = "recommended",
  PlaybookBuilt = "playbook_built",
  ActionPlanReady = "action_plan_ready",
  Monitoring = "monitoring",
  Completed = "completed",
  Archived = "archived",
}

export type TimelineEventType = "decision_case_created";

export interface TimelineEvent {
  readonly id: string;
  readonly type: TimelineEventType;
  readonly occurredAt: DecisionCaseDateTime;
  readonly actor: DecisionCaseActor;
  readonly description: string;
  readonly metadata: DecisionCaseMetadata;
}
