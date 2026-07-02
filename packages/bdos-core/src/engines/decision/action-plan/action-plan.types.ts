import type { Playbook, PlaybookStepId } from "../playbook";

export type ActionPlanId = string;

export type ActionId = string;

export type CheckpointId = string;

export type ActionPlanStatus = "created";

export type ActionPriority = "critical" | "high" | "medium" | "low";

export type ActionPlanMetadata = Readonly<Record<string, unknown>>;

export interface Action {
  readonly id: ActionId;
  readonly title: string;
  readonly description: string;
  readonly sequence: number;
  readonly priority: ActionPriority;
  readonly expectedOutcome: string;
  readonly sourceStepId: PlaybookStepId;
}

export interface Checkpoint {
  readonly id: CheckpointId;
  readonly title: string;
  readonly description: string;
  readonly sequence: number;
  readonly successCriteria: ReadonlyArray<string>;
}

export interface ActionPlan {
  readonly id: ActionPlanId;
  readonly playbookId: string;
  readonly name: string;
  readonly objective: string;
  readonly actions: ReadonlyArray<Action>;
  readonly checkpoints: ReadonlyArray<Checkpoint>;
  readonly ownerRole: string;
  readonly status: ActionPlanStatus;
  readonly metadata: ActionPlanMetadata;
}

export type BuildActionPlansInput = ReadonlyArray<Playbook>;

export type BuildActionPlansResult = ReadonlyArray<ActionPlan>;
