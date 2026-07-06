import type { CalculateCriticalPathResult, ScheduleActivity, ScheduleSCurvePoint } from "../../domain/schedule-management";
import type { PlanningDataset, PlanningDetectedType, PlanningImportWarning } from "../../domain/schedule-management";
import type { SpatialObject } from "../../domain/spatial-object";
import type { BusinessFact } from "../../domain/business-fact";
import type { Diagnosis } from "../../engines/decision/pipeline/diagnose";
import type { Decision } from "../../domain/decision";
import type { Recommendation } from "../../engines/decision/recommendation";
import type { ImportProjectXmlSkip } from "../../domain/schedule-management/adapters/ms-project-xml-import";
import type { BbaProjectImportError } from "./bba-project-import.types";

export type PlanningImportSourceType = "ms-project-xml" | "excel";

export interface PlanningImportSourceInput {
  readonly sourceType: PlanningImportSourceType;
  /** Obrigatório quando `sourceType === "ms-project-xml"`. */
  readonly xml?: string;
  /** Obrigatório quando `sourceType === "excel"`. */
  readonly excelBytes?: Uint8Array;
  readonly fileName: string;
  readonly organizationId: string;
  readonly contractId: string;
  readonly projectId: string;
  readonly tenantId: string;
  readonly capability: string;
  readonly generatedAt: string;
  readonly correlationId: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly asOfDate: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PlanningImportSummary {
  readonly activityCount: number;
  readonly spatialObjectCount: number;
  readonly decisionCount: number;
  readonly recommendationCount: number;
  readonly criticalPathDurationDays: number;
  readonly criticalActivityCount: number;
}

/**
 * Envelope uniforme para qualquer fonte de planejamento. Para
 * `sourceType === "ms-project-xml"`, `activities`/`criticalPath`/
 * `sCurve`/`spatialObjects`/`facts`/`decisions`/`recommendations`/
 * `errors` são exatamente os mesmos valores que
 * `buildBbaProjectImportSnapshot` (Sprint Zero, inalterada) já
 * produzia — este envelope só acrescenta campos, nunca substitui os
 * existentes.
 */
export interface PlanningImportSnapshot {
  readonly success: boolean;
  readonly sourceType: PlanningImportSourceType;
  readonly detectedPlanningType: PlanningDetectedType;
  readonly fileName: string;
  readonly activities: ReadonlyArray<ScheduleActivity>;
  readonly criticalPath: CalculateCriticalPathResult;
  readonly sCurve: ReadonlyArray<ScheduleSCurvePoint>;
  readonly spatialObjects: ReadonlyArray<SpatialObject>;
  readonly facts: ReadonlyArray<BusinessFact>;
  readonly diagnoses: ReadonlyArray<Diagnosis>;
  readonly decisions: ReadonlyArray<Decision>;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly planningDataset: PlanningDataset;
  readonly warnings: ReadonlyArray<PlanningImportWarning>;
  readonly skippedTasks: ReadonlyArray<ImportProjectXmlSkip>;
  readonly summary: PlanningImportSummary;
  readonly errors: ReadonlyArray<BbaProjectImportError>;
}
