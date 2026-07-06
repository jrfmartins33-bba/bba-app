export type GeospatialIntelligenceCapabilityName = "geospatial-intelligence";

export type GeospatialIntelligenceKnowledgeLayer = "facts" | "patterns" | "rules";

export type GeospatialIntelligenceKnowledgeId = string;

export type GeospatialIntelligenceMetadata = Readonly<Record<string, unknown>>;

export interface GeospatialIntelligenceFactDefinition {
  readonly id: GeospatialIntelligenceKnowledgeId;
  readonly layer: "facts";
  readonly name: string;
  readonly description: string;
  readonly metadata: GeospatialIntelligenceMetadata;
}

export interface GeospatialIntelligencePatternDefinition {
  readonly id: GeospatialIntelligenceKnowledgeId;
  readonly layer: "patterns";
  readonly name: string;
  readonly description: string;
  readonly factIds: ReadonlyArray<GeospatialIntelligenceKnowledgeId>;
  readonly metadata: GeospatialIntelligenceMetadata;
}

export interface GeospatialIntelligenceRuleDefinition {
  readonly id: GeospatialIntelligenceKnowledgeId;
  readonly layer: "rules";
  readonly name: string;
  readonly description: string;
  readonly patternIds: ReadonlyArray<GeospatialIntelligenceKnowledgeId>;
  readonly metadata: GeospatialIntelligenceMetadata;
}
