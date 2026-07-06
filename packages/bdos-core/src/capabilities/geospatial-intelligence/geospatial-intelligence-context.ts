import type {
  GeospatialIntelligenceCapabilityName,
  GeospatialIntelligenceFactDefinition,
  GeospatialIntelligencePatternDefinition,
  GeospatialIntelligenceRuleDefinition,
} from "./geospatial-intelligence.types";

export interface GeospatialIntelligenceContext {
  readonly capability: GeospatialIntelligenceCapabilityName;
  readonly facts: ReadonlyArray<GeospatialIntelligenceFactDefinition>;
  readonly patterns: ReadonlyArray<GeospatialIntelligencePatternDefinition>;
  readonly rules: ReadonlyArray<GeospatialIntelligenceRuleDefinition>;
}
