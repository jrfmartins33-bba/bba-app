import type { BbaProjectImportResult } from "@bba/bdos-core/services/bba-project-import";

export type BbaProjectSnapshot = BbaProjectImportResult;
export type BbaProjectActivity = BbaProjectSnapshot["activities"][number];
export type BbaProjectFact = BbaProjectSnapshot["facts"][number];
export type BbaProjectDecision = BbaProjectSnapshot["decisions"][number];
export type BbaProjectRecommendation = BbaProjectSnapshot["recommendations"][number];
