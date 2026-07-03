import type { BusinessFact } from "../../../business-fact";
import type { DecisionCase } from "../../decision-case";

export type EngineeringDecisionCaseMetadata = Readonly<Record<string, unknown>>;

export interface EngineeringDecisionCaseTrace {
  readonly action: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly description: string;
  readonly metadata: EngineeringDecisionCaseMetadata;
}

/**
 * One translated outcome: the engineering BusinessFact that triggered it,
 * the resulting DecisionCase (built via the existing, unmodified
 * `createDecisionCase` from `domain/decision-case`), and this bridge's own
 * trace of the translation step.
 */
export interface EngineeringDecisionCaseSnapshot {
  readonly sourceFactId: string;
  readonly sourceFactType: string;
  readonly correlationId: string;
  readonly decisionCase: DecisionCase;
  readonly trace: ReadonlyArray<EngineeringDecisionCaseTrace>;
  readonly metadata: EngineeringDecisionCaseMetadata;
}

export interface EngineeringDecisionCaseSummary {
  readonly totalFactsConsidered: number;
  readonly totalDecisionCasesGenerated: number;
  readonly totalFactsSkipped: number;
  readonly caseCountByFactType: Readonly<Record<string, number>>;
}

export interface GenerateEngineeringDecisionCasesInput {
  readonly facts: ReadonlyArray<BusinessFact>;
  readonly actor?: string;
  readonly metadata?: EngineeringDecisionCaseMetadata;
}

export interface GenerateEngineeringDecisionCasesResult {
  readonly decisionCases: ReadonlyArray<EngineeringDecisionCaseSnapshot>;
  readonly summary: EngineeringDecisionCaseSummary;
  readonly metadata: EngineeringDecisionCaseMetadata;
}

/**
 * Descriptor for this bridge, mirroring the shape already established by
 * `BusinessFactsAdapter` in Sprint 11.3 (adapterId + supported-thing +
 * generation function) even though `domain/decision-case` has no adapter
 * contract of its own to conform to — this is the "smallest possible
 * adapter" for a translation step that did not previously exist.
 */
export interface EngineeringDecisionCaseAdapter {
  readonly adapterId: string;
  readonly supportedFactTypes: ReadonlyArray<string>;
  readonly generate: (
    input: GenerateEngineeringDecisionCasesInput,
  ) => GenerateEngineeringDecisionCasesResult;
}
