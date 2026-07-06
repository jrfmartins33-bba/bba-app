import type { PlanningImportSnapshot } from "@bba/bdos-core/services/bba-project-import";

export type BbaProjectSnapshot = PlanningImportSnapshot;
export type BbaProjectActivity = BbaProjectSnapshot["activities"][number];
export type BbaProjectFact = BbaProjectSnapshot["facts"][number];
export type BbaProjectDecision = BbaProjectSnapshot["decisions"][number];
export type BbaProjectRecommendation = BbaProjectSnapshot["recommendations"][number];
export type BbaProjectPlanningDataset = BbaProjectSnapshot["planningDataset"];
export type BbaProjectPlanningActivity = BbaProjectPlanningDataset["activities"][number];
export type BbaProjectPeriodSeries = BbaProjectPlanningDataset["periodSeries"][number];
export type BbaProjectWarning = BbaProjectSnapshot["warnings"][number];
