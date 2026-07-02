import type {
  DecisionCaseActor,
  DecisionCaseArtifactRef,
  DecisionCaseCapability,
  DecisionCaseDateTime,
  DecisionCaseId,
  DecisionCaseMetadata,
  TimelineEvent,
} from "./decision-case.types";
import { DecisionCaseState } from "./decision-case.types";

export interface DecisionCase {
  readonly id: DecisionCaseId;
  readonly capability: DecisionCaseCapability;
  readonly status: DecisionCaseState;
  readonly createdAt: DecisionCaseDateTime;
  readonly timeline: ReadonlyArray<TimelineEvent>;
  readonly artifacts: ReadonlyArray<DecisionCaseArtifactRef>;
  readonly metadata: DecisionCaseMetadata;
}

export interface CreateDecisionCaseInput {
  readonly id: DecisionCaseId;
  readonly capability: DecisionCaseCapability;
  readonly createdAt: DecisionCaseDateTime;
  readonly actor: DecisionCaseActor;
  readonly artifacts?: ReadonlyArray<DecisionCaseArtifactRef>;
  readonly metadata?: DecisionCaseMetadata;
}

export function createDecisionCase(
  input: CreateDecisionCaseInput,
): DecisionCase {
  const artifacts = input.artifacts ?? [];

  return {
    id: input.id,
    capability: input.capability,
    status: DecisionCaseState.Created,
    createdAt: input.createdAt,
    timeline: [
      {
        id: `${input.id}:timeline:created`,
        type: "decision_case_created",
        occurredAt: input.createdAt,
        actor: input.actor,
        description: "Decision case created.",
        metadata: {
          capability: input.capability,
          artifacts,
        },
      },
    ],
    artifacts,
    metadata: input.metadata ?? {},
  };
}

export function canTransition(
  from: DecisionCaseState,
  to: DecisionCaseState,
): boolean {
  return allowedTransitions[from] === to;
}

const allowedTransitions: Readonly<Record<DecisionCaseState, DecisionCaseState | null>> = {
  [DecisionCaseState.Created]: DecisionCaseState.Observed,
  [DecisionCaseState.Observed]: DecisionCaseState.Diagnosed,
  [DecisionCaseState.Diagnosed]: DecisionCaseState.DecisionBuilt,
  [DecisionCaseState.DecisionBuilt]: DecisionCaseState.Recommended,
  [DecisionCaseState.Recommended]: DecisionCaseState.PlaybookBuilt,
  [DecisionCaseState.PlaybookBuilt]: DecisionCaseState.ActionPlanReady,
  [DecisionCaseState.ActionPlanReady]: DecisionCaseState.Monitoring,
  [DecisionCaseState.Monitoring]: DecisionCaseState.Completed,
  [DecisionCaseState.Completed]: DecisionCaseState.Archived,
  [DecisionCaseState.Archived]: null,
};
