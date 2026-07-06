import type { ScheduleActivity } from "./schedule-management.types";
import { ScheduleDependencyType, type CreateScheduleActivityInput } from "./schedule-management.types";
import { WorkPackageType } from "../work-package-management";
import type {
  PlanningActivityRecord,
  PlanningDataset,
  PlanningDatasetOrigin,
  PlanningDependencyType,
} from "./planning-dataset.types";

/**
 * BBA Project Studio — Sprint 1. Estas funções nunca alteram
 * `schedule-management.ts` nem os importadores existentes; elas
 * apenas convertem DE/PARA o Planning Dataset, o modelo consolidado
 * que o resto do produto consome.
 */

/**
 * Envolve o resultado já existente do importador XML (Sprint Zero, sem
 * nenhuma alteração) na mesma forma de Planning Dataset que o Excel
 * produz — para que a API tenha um envelope uniforme, sem tocar no
 * cálculo original.
 */
export function buildPlanningDatasetFromScheduleActivities(
  activities: ReadonlyArray<ScheduleActivity>,
  origin: PlanningDatasetOrigin,
): PlanningDataset {
  const records: PlanningActivityRecord[] = activities.map((activity) => ({
    id: activity.id,
    code: activity.code,
    name: activity.name,
    parentId: activity.parentActivityId,
    sequence: activity.sequence,
    isSummary: activity.isSummary,
    isMilestone: activity.isMilestone,
    plannedStart: activity.plannedStart,
    plannedEnd: activity.plannedEnd,
    durationDays: activity.durationDays,
    percentPlanned: null,
    percentActual: activity.percentComplete,
    plannedValue: null,
    actualValue: null,
    weight: null,
    dependencies: activity.dependencies.map((dependency) => ({
      predecessorId: dependency.predecessorId,
      type: dependency.type as PlanningDependencyType,
      lagDays: dependency.lagDays,
    })),
  }));

  return {
    origin,
    detectedType: "cronograma",
    activities: records,
    periodSeries: [],
    financial: null,
    warnings: [],
  };
}

export interface PlanningWorkPackageInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: WorkPackageType;
  readonly parentWorkPackageId: string | null;
  readonly sequence: number;
}

/**
 * `WorkPackage` (`domain/work-package-management`) não exige datas —
 * por isso toda linha do Planning Dataset, com ou sem cronograma
 * detalhado, pode virar um `WorkPackage` e, através do adaptador já
 * existente (`domain/spatial-object/adapters/work-package-management`,
 * Sprint 12), um `SpatialObject` real. O Advisor nunca depende de a
 * atividade ter data.
 */
export function toWorkPackageInputsFromPlanningDataset(
  dataset: PlanningDataset,
): ReadonlyArray<PlanningWorkPackageInput> {
  return dataset.activities.map((activity, index) => ({
    id: activity.id,
    code: activity.code,
    name: activity.name,
    type: activity.isSummary ? WorkPackageType.ScopeGroup : WorkPackageType.ExecutionFront,
    parentWorkPackageId: activity.parentId,
    sequence: activity.sequence ?? index,
  }));
}

export interface PlanningScheduleActivityConversion {
  readonly inputs: ReadonlyArray<CreateScheduleActivityInput>;
  /** Ids de registros do Planning Dataset sem datas/duração suficientes para entrar no cronograma detalhado (CPM/curva S). */
  readonly skippedIds: ReadonlyArray<string>;
}

/**
 * Só os registros com datas planejadas e duração reais viram
 * `ScheduleActivity` (e portanto entram no caminho crítico e na curva
 * S calculada) — uma linha de físico-financeiro sem datas não tem seu
 * cronograma inventado; ela continua existindo no Planning Dataset e
 * no `SpatialObject`/Advisor, só não no CPM.
 */
export function toScheduleActivityInputsFromPlanningDataset(
  dataset: PlanningDataset,
  context: { readonly projectId: string; readonly correlationId: string; readonly createdBy: string; readonly sourceSystem: string },
): PlanningScheduleActivityConversion {
  const inputs: CreateScheduleActivityInput[] = [];
  const skippedIds: string[] = [];

  dataset.activities.forEach((activity, index) => {
    if (activity.plannedStart === null || activity.plannedEnd === null || activity.durationDays === null) {
      skippedIds.push(activity.id);
      return;
    }

    inputs.push({
      id: activity.id,
      projectId: context.projectId,
      code: activity.code,
      name: activity.name,
      parentActivityId: activity.parentId,
      sequence: activity.sequence ?? index,
      isSummary: activity.isSummary,
      isMilestone: activity.isMilestone,
      plannedStart: activity.plannedStart,
      plannedEnd: activity.plannedEnd,
      durationDays: activity.durationDays,
      percentComplete: activity.percentActual ?? 0,
      dependencies: activity.dependencies.map((dependency) => ({
        predecessorId: dependency.predecessorId,
        type: toScheduleDependencyType(dependency.type),
        lagDays: dependency.lagDays,
      })),
      correlationId: context.correlationId,
      createdBy: context.createdBy,
      sourceSystem: context.sourceSystem,
      metadata: {},
    });
  });

  return { inputs, skippedIds };
}

function toScheduleDependencyType(type: PlanningDependencyType): ScheduleDependencyType {
  switch (type) {
    case "StartToStart":
      return ScheduleDependencyType.StartToStart;
    case "FinishToFinish":
      return ScheduleDependencyType.FinishToFinish;
    case "StartToFinish":
      return ScheduleDependencyType.StartToFinish;
    case "FinishToStart":
    default:
      return ScheduleDependencyType.FinishToStart;
  }
}
