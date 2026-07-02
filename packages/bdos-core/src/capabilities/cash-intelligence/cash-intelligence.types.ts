export type CashIntelligenceCapabilityName = "cash-intelligence";

export type CashIntelligenceKnowledgeLayer = "facts" | "patterns" | "rules";

export type CashIntelligenceKnowledgeId = string;

export type CashIntelligenceMetadata = Readonly<Record<string, unknown>>;

export interface CashIntelligenceFactDefinition {
  readonly id: CashIntelligenceKnowledgeId;
  readonly layer: "facts";
  readonly name: string;
  readonly description: string;
  readonly metadata: CashIntelligenceMetadata;
}

export interface CashIntelligencePatternDefinition {
  readonly id: CashIntelligenceKnowledgeId;
  readonly layer: "patterns";
  readonly name: string;
  readonly description: string;
  readonly factIds: ReadonlyArray<CashIntelligenceKnowledgeId>;
  readonly metadata: CashIntelligenceMetadata;
}

export interface CashIntelligenceRuleDefinition {
  readonly id: CashIntelligenceKnowledgeId;
  readonly layer: "rules";
  readonly name: string;
  readonly description: string;
  readonly patternIds: ReadonlyArray<CashIntelligenceKnowledgeId>;
  readonly metadata: CashIntelligenceMetadata;
}
