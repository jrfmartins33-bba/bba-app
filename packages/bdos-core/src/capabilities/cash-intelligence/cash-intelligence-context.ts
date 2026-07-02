import type {
  CashIntelligenceCapabilityName,
  CashIntelligenceFactDefinition,
  CashIntelligencePatternDefinition,
  CashIntelligenceRuleDefinition,
} from "./cash-intelligence.types";

export interface CashIntelligenceContext {
  readonly capability: CashIntelligenceCapabilityName;
  readonly facts: ReadonlyArray<CashIntelligenceFactDefinition>;
  readonly patterns: ReadonlyArray<CashIntelligencePatternDefinition>;
  readonly rules: ReadonlyArray<CashIntelligenceRuleDefinition>;
}
