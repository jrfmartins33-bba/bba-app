import type {
  BusinessFact,
  BusinessFactCapability,
} from "../../../domain/business-fact";
import type { Diagnosis } from "../pipeline/diagnose";

export type RuleResult = ReadonlyArray<Diagnosis>;

export type Rule = (facts: ReadonlyArray<BusinessFact>) => RuleResult;

export type RulePackMetadata = Readonly<Record<string, unknown>>;

export interface RulePack {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capability: BusinessFactCapability;
  readonly rules: ReadonlyArray<Rule>;
  readonly metadata: RulePackMetadata;
}

export interface RuleContext {
  readonly rulePack: RulePack;
  readonly facts: ReadonlyArray<BusinessFact>;
}
