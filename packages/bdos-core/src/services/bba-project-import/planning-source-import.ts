import {
  buildPlanningDatasetFromScheduleActivities,
  buildScheduleSCurve,
  calculateCriticalPath,
  createScheduleActivity,
  toScheduleActivityInputsFromPlanningDataset,
  toWorkPackageInputsFromPlanningDataset,
  type CalculateCriticalPathResult,
  type PlanningDataset,
  type PlanningImportWarning,
  type ScheduleActivity,
  type ScheduleSCurvePoint,
} from "../../domain/schedule-management";
import { importPlanningExcel } from "../../domain/schedule-management/adapters/excel-import";
import { createWorkPackage } from "../../domain/work-package-management";
import type { WorkPackage } from "../../domain/work-package-management/work-package-management.types";
import { generateSpatialObjectsFromWorkPackages } from "../../domain/spatial-object";
import type { SpatialObject } from "../../domain/spatial-object";
import { spatialObjectFactsAdapter } from "../../domain/business-facts-generator/adapters/spatial-object";
import type { BusinessFact } from "../../domain/business-fact";
import { buildDecisions } from "../../engines/decision/builder";
import type { Diagnosis } from "../../engines/decision/pipeline/diagnose";
import type { Decision } from "../../domain/decision";
import { buildRecommendations } from "../../engines/decision/recommendation";
import type { Recommendation } from "../../engines/decision/recommendation";
import { executeRulePack } from "../../engines/decision/rule-engine";
import { buildBbaProjectImportSnapshot, geospatialRulePack } from "./bba-project-import";
import type { BbaProjectImportError } from "./bba-project-import.types";
import type { PlanningImportSnapshot, PlanningImportSourceInput, PlanningImportSummary } from "./planning-source-import.types";

/**
 * BBA Project Studio — Sprint 1 (Planning Dataset Import + Living
 * Schedule, ver `packages/bdos-core/docs/BBA_PROJECT.md`).
 *
 * A ÚNICA porta de entrada nova para o produto: `apps/web` deve
 * chamar apenas esta função (ou `buildBbaProjectImportSnapshot`, que
 * ela mesma reaproveita sem alteração) — nunca
 * `domain/schedule-management`, `domain/spatial-object`,
 * `engines/decision/*` ou `capabilities/geospatial-intelligence`
 * diretamente.
 *
 * REGRA CRÍTICA (Sprint 1, PARTE 8): para `sourceType ===
 * "ms-project-xml"`, esta função delega inteiramente para
 * `buildBbaProjectImportSnapshot` — a mesma função do Sprint Zero,
 * byte a byte inalterada — e apenas empacota o resultado real no novo
 * envelope. Nenhum número do fluxo XML muda; ver
 * `xml-regression.test.ts`.
 *
 * Para `sourceType === "excel"`, a cadeia é a mesma, só a origem dos
 * dados muda: `importPlanningExcel` (adaptador, nunca visto pelo
 * domínio) → Planning Dataset → `WorkPackage[]` (sempre, mesmo sem
 * datas) → `generateSpatialObjectsFromWorkPackages` →
 * `spatialObjectFactsAdapter` → `executeRulePack` (a mesma
 * `capabilities/geospatial-intelligence`, nenhuma regra nova) →
 * `buildDecisions` → `buildRecommendations`; e, só para os registros
 * com datas reais, `ScheduleActivity[]` → `calculateCriticalPath` →
 * `buildScheduleSCurve`.
 */
export function importPlanningSource(input: PlanningImportSourceInput): PlanningImportSnapshot {
  return input.sourceType === "ms-project-xml" ? importFromXml(input) : importFromExcel(input);
}

function importFromXml(input: PlanningImportSourceInput): PlanningImportSnapshot {
  const result = buildBbaProjectImportSnapshot({
    xml: input.xml ?? "",
    organizationId: input.organizationId,
    contractId: input.contractId,
    projectId: input.projectId,
    tenantId: input.tenantId,
    capability: input.capability,
    generatedAt: input.generatedAt,
    correlationId: input.correlationId,
    actor: input.actor,
    occurredAt: input.occurredAt,
    asOfDate: input.asOfDate,
    metadata: input.metadata,
  });

  const planningDataset = buildPlanningDatasetFromScheduleActivities(result.activities, {
    sourceType: "ms-project-xml",
    fileName: input.fileName,
    sheetName: null,
    importedAt: input.generatedAt,
  });

  return {
    success: result.success,
    sourceType: "ms-project-xml",
    detectedPlanningType: "cronograma",
    fileName: input.fileName,
    activities: result.activities,
    criticalPath: result.criticalPath,
    sCurve: result.sCurve,
    spatialObjects: result.spatialObjects,
    facts: result.facts,
    diagnoses: result.diagnoses,
    decisions: result.decisions,
    recommendations: result.recommendations,
    planningDataset,
    warnings: [],
    skippedTasks: result.skippedTasks,
    summary: buildSummary(result.activities, result.spatialObjects, result.decisions, result.recommendations, result.criticalPath),
    errors: result.errors,
  };
}

function importFromExcel(input: PlanningImportSourceInput): PlanningImportSnapshot {
  const errors: BbaProjectImportError[] = [];
  const excelResult = importPlanningExcel({
    bytes: input.excelBytes ?? new Uint8Array(),
    fileName: input.fileName,
    importedAt: input.generatedAt,
  });

  const dataset = excelResult.dataset;

  if (dataset.activities.length === 0) {
    return emptySnapshot(input, dataset, errors);
  }

  const workPackages = buildWorkPackagesFromDataset(input, dataset, errors);

  if (workPackages.length === 0) {
    return emptySnapshot(input, dataset, errors);
  }

  const spatialObjectResult = generateSpatialObjectsFromWorkPackages({
    workPackages,
    actor: input.actor,
    occurredAt: input.occurredAt,
  });

  errors.push(
    ...spatialObjectResult.errors.map((error) => ({
      stage: "spatial_object_generation" as const,
      code: error.code,
      message: error.message,
    })),
  );

  const factsResult = spatialObjectFactsAdapter.generateFacts({
    source: spatialObjectFactsAdapter.supportedSource,
    generatedAt: input.generatedAt,
    correlationId: input.correlationId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    capability: input.capability,
    spatialObjects: spatialObjectResult.spatialObjects,
    metadata: input.metadata ?? {},
  });

  errors.push(
    ...factsResult.errors.map((error) => ({
      stage: "business_fact_generation" as const,
      code: error.code,
      message: error.message,
    })),
  );

  const diagnoses: ReadonlyArray<Diagnosis> = executeRulePack(geospatialRulePack, factsResult.facts);
  const decisions: ReadonlyArray<Decision> = buildDecisions(diagnoses);
  const recommendations: ReadonlyArray<Recommendation> = buildRecommendations(decisions);

  const { activities, warnings: scheduleWarnings } = buildScheduleActivitiesFromDataset(input, dataset);
  const criticalPath = calculateCriticalPath(activities);
  const sCurve = buildScheduleSCurve(activities, input.asOfDate);

  return {
    success: errors.length === 0,
    sourceType: "excel",
    detectedPlanningType: dataset.detectedType,
    fileName: input.fileName,
    activities,
    criticalPath,
    sCurve,
    spatialObjects: spatialObjectResult.spatialObjects,
    facts: factsResult.facts,
    diagnoses,
    decisions,
    recommendations,
    planningDataset: dataset,
    warnings: [...dataset.warnings, ...scheduleWarnings],
    skippedTasks: [],
    summary: buildSummary(activities, spatialObjectResult.spatialObjects, decisions, recommendations, criticalPath),
    errors,
  };
}

function buildWorkPackagesFromDataset(
  input: PlanningImportSourceInput,
  dataset: PlanningDataset,
  errors: BbaProjectImportError[],
): ReadonlyArray<WorkPackage> {
  const workPackages: WorkPackage[] = [];

  toWorkPackageInputsFromPlanningDataset(dataset).forEach((workPackageInput) => {
    const result = createWorkPackage({
      id: workPackageInput.id,
      organizationId: input.organizationId,
      contractId: input.contractId,
      projectId: input.projectId,
      code: workPackageInput.code,
      name: workPackageInput.name,
      description: workPackageInput.name,
      type: workPackageInput.type,
      parentWorkPackageId: workPackageInput.parentWorkPackageId,
      sequence: workPackageInput.sequence,
      correlationId: input.correlationId,
      createdBy: input.actor,
      sourceSystem: "excel-import",
    });

    if (!result.success) {
      errors.push(...result.errors.map((error) => ({ stage: "work_package_creation" as const, code: error.code, message: error.message })));
      return;
    }

    workPackages.push(result.workPackage);
  });

  return workPackages;
}

function buildScheduleActivitiesFromDataset(
  input: PlanningImportSourceInput,
  dataset: PlanningDataset,
): { activities: ReadonlyArray<ScheduleActivity>; warnings: ReadonlyArray<PlanningImportWarning> } {
  const conversion = toScheduleActivityInputsFromPlanningDataset(dataset, {
    projectId: input.projectId,
    correlationId: input.correlationId,
    createdBy: input.actor,
    sourceSystem: "excel-import",
  });

  const activities: ScheduleActivity[] = [];
  conversion.inputs.forEach((activityInput) => {
    const result = createScheduleActivity(activityInput);
    if (result.success) {
      activities.push(result.activity);
    }
  });

  const warnings: PlanningImportWarning[] =
    conversion.skippedIds.length === 0
      ? []
      : [
          {
            code: "missing_dates",
            message: `${conversion.skippedIds.length} atividade(s) sem datas planejadas suficientes não entraram no caminho crítico/curva S calculados — permanecem no Planning Dataset.`,
          },
        ];

  return { activities, warnings };
}

function buildSummary(
  activities: ReadonlyArray<ScheduleActivity>,
  spatialObjects: ReadonlyArray<SpatialObject>,
  decisions: ReadonlyArray<Decision>,
  recommendations: ReadonlyArray<Recommendation>,
  criticalPath: CalculateCriticalPathResult,
): PlanningImportSummary {
  return {
    activityCount: activities.length,
    spatialObjectCount: spatialObjects.length,
    decisionCount: decisions.length,
    recommendationCount: recommendations.length,
    criticalPathDurationDays: criticalPath.projectDurationDays,
    criticalActivityCount: criticalPath.criticalActivityIds.length,
  };
}

function emptySnapshot(
  input: PlanningImportSourceInput,
  dataset: PlanningDataset,
  errors: BbaProjectImportError[],
): PlanningImportSnapshot {
  const emptyCriticalPath: CalculateCriticalPathResult = { activities: [], criticalActivityIds: [], projectDurationDays: 0 };
  const emptySCurve: ReadonlyArray<ScheduleSCurvePoint> = [];

  return {
    success: false,
    sourceType: "excel",
    detectedPlanningType: dataset.detectedType,
    fileName: input.fileName,
    activities: [],
    criticalPath: emptyCriticalPath,
    sCurve: emptySCurve,
    spatialObjects: [],
    facts: [],
    diagnoses: [],
    decisions: [],
    recommendations: [],
    planningDataset: dataset,
    warnings: dataset.warnings,
    skippedTasks: [],
    summary: buildSummary([], [], [], [], emptyCriticalPath),
    errors,
  };
}
