import type {
  BaselineScheduleActivityInput,
  CalculateCriticalPathResult,
  CreateScheduleActivityInput,
  CriticalPathActivityResult,
  ScheduleActivity,
  ScheduleActivityDependency,
  ScheduleManagementError,
  ScheduleManagementFailure,
  ScheduleManagementMetadata,
  ScheduleManagementResult,
  ScheduleManagementSuccess,
  ScheduleSCurvePoint,
  UpdateActivityProgressInput,
} from "./schedule-management.types";
import { ScheduleActivityStatus, ScheduleDependencyType } from "./schedule-management.types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function createScheduleActivity(
  input: CreateScheduleActivityInput,
): ScheduleManagementResult {
  const metadata = createActivityMetadata(input);
  const errors = validateCreateActivity(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject<ScheduleManagementFailure>({
      success: false,
      activity: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ScheduleManagementSuccess>({
    success: true,
    activity: createActivityEntity(input),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function updateActivityProgress(
  input: UpdateActivityProgressInput,
): ScheduleManagementResult {
  const metadata: ScheduleManagementMetadata = {
    ...input.activity.metadata,
    ...(input.metadata ?? {}),
    activityId: input.activity.id,
  };

  if (!Number.isFinite(input.percentComplete) || input.percentComplete < 0 || input.percentComplete > 100) {
    return freezeDomainObject<ScheduleManagementFailure>({
      success: false,
      activity: null,
      errors: [
        createActivityError(
          "invalid_percent_complete",
          "percentComplete",
          "Percent complete must be between 0 and 100.",
          metadata,
        ),
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ScheduleManagementSuccess>({
    success: true,
    activity: {
      ...input.activity,
      percentComplete: input.percentComplete,
      actualStart: input.actualStart ?? input.activity.actualStart,
      actualEnd: input.actualEnd ?? input.activity.actualEnd,
      status: statusForPercentComplete(input.percentComplete, input.activity.status),
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Fase 1 — "Linha de base". Congela as datas planejadas atuais em
 * `baseline`; é um ato explícito, nunca um efeito colateral de
 * `updateActivityProgress`. Reinvocar substitui a linha de base
 * anterior — um re-baseline deliberado, não um erro.
 */
export function baselineScheduleActivity(
  input: BaselineScheduleActivityInput,
): ScheduleManagementResult {
  const metadata: ScheduleManagementMetadata = {
    ...input.activity.metadata,
    ...(input.metadata ?? {}),
    activityId: input.activity.id,
  };

  return freezeDomainObject<ScheduleManagementSuccess>({
    success: true,
    activity: {
      ...input.activity,
      baseline: {
        plannedStart: input.activity.plannedStart,
        plannedEnd: input.activity.plannedEnd,
        durationDays: input.activity.durationDays,
        baselinedAt: input.occurredAt,
      },
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Fase 1 — Caminho crítico (CPM real: passada de ida e volta,
 * suportando os quatro tipos de dependência com atraso/lag). Linhas de
 * agrupamento da EAP (`isSummary: true`) nunca entram na rede — apenas
 * organizam a exibição, não consomem tempo por si só. Dependências
 * cíclicas ou apontando para uma atividade fora do conjunto são
 * ignoradas defensivamente (nunca lança exceção): esta é uma função
 * pura de cálculo, não um validador de entrada.
 */
export function calculateCriticalPath(
  activities: ReadonlyArray<ScheduleActivity>,
): CalculateCriticalPathResult {
  const leaf = activities.filter((activity) => !activity.isSummary);
  const leafIds = new Set(leaf.map((activity) => activity.id));
  const byId = new Map(leaf.map((activity) => [activity.id, activity]));

  const order = topologicalOrder(leaf, leafIds);

  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();

  order.forEach((activityId) => {
    const activity = byId.get(activityId);

    if (activity === undefined) {
      return;
    }

    const validDependencies = activity.dependencies.filter((dependency) => leafIds.has(dependency.predecessorId));

    const es =
      validDependencies.length === 0
        ? 0
        : Math.max(
            0,
            ...validDependencies.map((dependency) =>
              earlyStartConstraint(dependency, earlyStart, earlyFinish, activity.durationDays),
            ),
          );

    earlyStart.set(activityId, es);
    earlyFinish.set(activityId, es + activity.durationDays);
  });

  const projectDurationDays =
    leaf.length === 0 ? 0 : Math.max(0, ...leaf.map((activity) => earlyFinish.get(activity.id) ?? 0));

  const successorsOf = buildSuccessorIndex(leaf, leafIds);

  const lateFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();

  [...order].reverse().forEach((activityId) => {
    const activity = byId.get(activityId);

    if (activity === undefined) {
      return;
    }

    const successorEdges = successorsOf.get(activityId) ?? [];

    const lf =
      successorEdges.length === 0
        ? projectDurationDays
        : Math.min(
            ...successorEdges.map((edge) =>
              lateFinishConstraint(edge, lateStart, lateFinish, activity.durationDays),
            ),
          );

    lateFinish.set(activityId, lf);
    lateStart.set(activityId, lf - activity.durationDays);
  });

  const results: CriticalPathActivityResult[] = leaf.map((activity) => {
    const es = earlyStart.get(activity.id) ?? 0;
    const ef = earlyFinish.get(activity.id) ?? es + activity.durationDays;
    const ls = lateStart.get(activity.id) ?? es;
    const lf = lateFinish.get(activity.id) ?? ef;
    const totalFloatDays = ls - es;

    return {
      activityId: activity.id,
      earlyStart: es,
      earlyFinish: ef,
      lateStart: ls,
      lateFinish: lf,
      totalFloatDays,
      isCritical: totalFloatDays <= 0,
    };
  });

  return {
    activities: results,
    criticalActivityIds: results.filter((result) => result.isCritical).map((result) => result.activityId),
    projectDurationDays,
  };
}

/**
 * Fase 1 — Curva S de progresso físico (percentual ponderado por
 * duração). Não é uma curva de custo: nenhum dado financeiro existe
 * nesta camada ainda (Finance Engine é uma fase futura do roadmap).
 * `actualPercent` é `null` para datas futuras a `asOfDate` — o
 * progresso real projetado adiante seria dado inventado.
 */
export function buildScheduleSCurve(
  activities: ReadonlyArray<ScheduleActivity>,
  asOfDate: string,
): ReadonlyArray<ScheduleSCurvePoint> {
  const leaf = activities.filter((activity) => !activity.isSummary && activity.durationDays > 0);

  if (leaf.length === 0) {
    return [];
  }

  const totalDuration = leaf.reduce((sum, activity) => sum + activity.durationDays, 0);
  const startDates = leaf.map((activity) => toEpochDay(activity.plannedStart));
  const endDates = leaf.map((activity) => toEpochDay(activity.plannedEnd));
  const rangeStart = Math.min(...startDates);
  const rangeEnd = Math.max(...endDates);
  const asOfEpochDay = toEpochDay(asOfDate);

  const points: ScheduleSCurvePoint[] = [];

  for (let day = rangeStart; day <= rangeEnd; day += 7) {
    const plannedPercent = weightedProgress(
      leaf,
      totalDuration,
      (activity) => linearRamp(day, toEpochDay(activity.plannedStart), toEpochDay(activity.plannedEnd)),
    );

    const actualPercent =
      day > asOfEpochDay
        ? null
        : weightedProgress(leaf, totalDuration, (activity) => actualProgressAt(activity, day));

    points.push({
      date: fromEpochDay(day),
      plannedPercent: Math.round(plannedPercent),
      actualPercent: actualPercent === null ? null : Math.round(actualPercent),
    });
  }

  return points;
}

/**
 * BBA Project Studio — Sprint 1, Living Schedule. Simula um atraso
 * aumentando a duração da atividade selecionada; o recálculo do
 * caminho crítico acontece por reinvocar `calculateCriticalPath`
 * (inalterada) sobre o resultado — nenhuma Decision, Recommendation ou
 * regra nova nasce aqui, é puramente uma re-simulação de tempo, em
 * memória, nunca persistida.
 */
export function simulateActivityDelay(
  activities: ReadonlyArray<ScheduleActivity>,
  activityId: string,
  delayDays: number,
): ReadonlyArray<ScheduleActivity> {
  return activities.map((activity) => {
    if (activity.id !== activityId) {
      return activity;
    }

    return {
      ...activity,
      durationDays: activity.durationDays + delayDays,
      plannedEnd: shiftDate(activity.plannedEnd, delayDays),
    };
  });
}

function shiftDate(isoDate: string, days: number): string {
  return new Date(new Date(isoDate).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function actualProgressAt(activity: ScheduleActivity, day: number): number {
  if (activity.actualStart === null) {
    return 0;
  }

  const actualStartDay = toEpochDay(activity.actualStart);

  if (day < actualStartDay) {
    return 0;
  }

  if (activity.actualEnd !== null && day >= toEpochDay(activity.actualEnd)) {
    return activity.percentComplete;
  }

  const ramp = linearRamp(day, actualStartDay, actualStartDay + activity.durationDays) * 100;
  return Math.min(ramp, activity.percentComplete);
}

function linearRamp(day: number, startDay: number, endDay: number): number {
  if (endDay <= startDay) {
    return day >= startDay ? 1 : 0;
  }

  return Math.max(0, Math.min(1, (day - startDay) / (endDay - startDay)));
}

function weightedProgress(
  activities: ReadonlyArray<ScheduleActivity>,
  totalDuration: number,
  progressOf: (activity: ScheduleActivity) => number,
): number {
  if (totalDuration === 0) {
    return 0;
  }

  const weighted = activities.reduce((sum, activity) => {
    const fraction = progressOf(activity);
    const percent = fraction <= 1 ? fraction * 100 : fraction;
    return sum + percent * activity.durationDays;
  }, 0);

  return weighted / totalDuration;
}

function toEpochDay(isoDate: string): number {
  return Math.floor(new Date(isoDate).getTime() / MS_PER_DAY);
}

function fromEpochDay(epochDay: number): string {
  return new Date(epochDay * MS_PER_DAY).toISOString().slice(0, 10);
}

interface SuccessorEdge {
  readonly successorId: string;
  readonly type: ScheduleDependencyType;
  readonly lagDays: number;
  readonly successorDurationDays: number;
}

function buildSuccessorIndex(
  leaf: ReadonlyArray<ScheduleActivity>,
  leafIds: ReadonlySet<string>,
): Map<string, SuccessorEdge[]> {
  const index = new Map<string, SuccessorEdge[]>();

  leaf.forEach((activity) => {
    activity.dependencies
      .filter((dependency) => leafIds.has(dependency.predecessorId))
      .forEach((dependency) => {
        const edges = index.get(dependency.predecessorId) ?? [];
        edges.push({
          successorId: activity.id,
          type: dependency.type,
          lagDays: dependency.lagDays,
          successorDurationDays: activity.durationDays,
        });
        index.set(dependency.predecessorId, edges);
      });
  });

  return index;
}

function earlyStartConstraint(
  dependency: ScheduleActivityDependency,
  earlyStart: Map<string, number>,
  earlyFinish: Map<string, number>,
  ownDurationDays: number,
): number {
  const predecessorEs = earlyStart.get(dependency.predecessorId) ?? 0;
  const predecessorEf = earlyFinish.get(dependency.predecessorId) ?? predecessorEs;

  switch (dependency.type) {
    case ScheduleDependencyType.StartToStart:
      return predecessorEs + dependency.lagDays;
    case ScheduleDependencyType.FinishToFinish:
      return predecessorEf + dependency.lagDays - ownDurationDays;
    case ScheduleDependencyType.StartToFinish:
      return predecessorEs + dependency.lagDays - ownDurationDays;
    case ScheduleDependencyType.FinishToStart:
    default:
      return predecessorEf + dependency.lagDays;
  }
}

function lateFinishConstraint(
  edge: SuccessorEdge,
  lateStart: Map<string, number>,
  lateFinish: Map<string, number>,
  ownDurationDays: number,
): number {
  const successorLs = lateStart.get(edge.successorId) ?? lateFinish.get(edge.successorId) ?? 0;
  const successorLf = lateFinish.get(edge.successorId) ?? successorLs;

  switch (edge.type) {
    case ScheduleDependencyType.StartToStart:
      return successorLs - edge.lagDays + ownDurationDays;
    case ScheduleDependencyType.FinishToFinish:
      return successorLf - edge.lagDays;
    case ScheduleDependencyType.StartToFinish:
      return successorLf - edge.lagDays + ownDurationDays;
    case ScheduleDependencyType.FinishToStart:
    default:
      return successorLs - edge.lagDays;
  }
}

/**
 * Ordenação topológica (Kahn). Uma dependência cíclica nunca deveria
 * existir num cronograma válido; se acontecer, as atividades que nunca
 * atingem grau de entrada zero são anexadas ao final, na ordem
 * original — mantém a função total (nunca lança exceção) em vez de
 * travar num cronograma malformado.
 */
function topologicalOrder(
  leaf: ReadonlyArray<ScheduleActivity>,
  leafIds: ReadonlySet<string>,
): ReadonlyArray<string> {
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  leaf.forEach((activity) => {
    const validDependencies = activity.dependencies.filter((dependency) => leafIds.has(dependency.predecessorId));
    inDegree.set(activity.id, validDependencies.length);

    validDependencies.forEach((dependency) => {
      const list = dependents.get(dependency.predecessorId) ?? [];
      list.push(activity.id);
      dependents.set(dependency.predecessorId, list);
    });
  });

  const queue = leaf.filter((activity) => (inDegree.get(activity.id) ?? 0) === 0).map((activity) => activity.id);
  const visited = new Set<string>();
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined || visited.has(current)) {
      continue;
    }

    visited.add(current);
    order.push(current);

    (dependents.get(current) ?? []).forEach((dependentId) => {
      const remaining = (inDegree.get(dependentId) ?? 0) - 1;
      inDegree.set(dependentId, remaining);

      if (remaining <= 0) {
        queue.push(dependentId);
      }
    });
  }

  leaf.forEach((activity) => {
    if (!visited.has(activity.id)) {
      order.push(activity.id);
    }
  });

  return order;
}

function statusForPercentComplete(
  percentComplete: number,
  currentStatus: ScheduleActivityStatus,
): ScheduleActivityStatus {
  if (currentStatus === ScheduleActivityStatus.Cancelled) {
    return currentStatus;
  }

  if (percentComplete >= 100) {
    return ScheduleActivityStatus.Completed;
  }

  if (percentComplete > 0) {
    return ScheduleActivityStatus.InProgress;
  }

  return ScheduleActivityStatus.NotStarted;
}

function createActivityEntity(input: CreateScheduleActivityInput): ScheduleActivity {
  return {
    id: input.id,
    projectId: input.projectId,
    code: input.code,
    name: input.name,
    parentActivityId: input.parentActivityId ?? null,
    sequence: input.sequence,
    isSummary: input.isSummary ?? false,
    isMilestone: input.isMilestone ?? false,
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    durationDays: input.durationDays,
    actualStart: null,
    actualEnd: null,
    percentComplete: input.percentComplete ?? 0,
    status: statusForPercentComplete(input.percentComplete ?? 0, ScheduleActivityStatus.NotStarted),
    dependencies: input.dependencies ?? [],
    baseline: null,
    metadata: createActivityMetadata(input),
  };
}

function validateCreateActivity(
  input: CreateScheduleActivityInput,
  metadata: ScheduleManagementMetadata,
): ReadonlyArray<ScheduleManagementError> {
  const errors: ScheduleManagementError[] = [];

  if (isBlank(input.projectId)) {
    errors.push(createActivityError("missing_project_id", "projectId", "Project id is required.", metadata));
  }

  if (isBlank(input.code)) {
    errors.push(createActivityError("missing_code", "code", "Activity code is required.", metadata));
  }

  if (isBlank(input.name)) {
    errors.push(createActivityError("missing_name", "name", "Activity name is required.", metadata));
  }

  if (input.sequence < 0) {
    errors.push(
      createActivityError("invalid_sequence", "sequence", "Activity sequence must be greater than or equal to zero.", metadata),
    );
  }

  if (input.durationDays < 0) {
    errors.push(
      createActivityError("invalid_duration", "durationDays", "Activity duration cannot be negative.", metadata),
    );
  }

  if (new Date(input.plannedEnd).getTime() < new Date(input.plannedStart).getTime()) {
    errors.push(
      createActivityError(
        "invalid_planned_period",
        "plannedEnd",
        "Planned end date cannot be before the planned start date.",
        metadata,
      ),
    );
  }

  const percentComplete = input.percentComplete ?? 0;

  if (percentComplete < 0 || percentComplete > 100) {
    errors.push(
      createActivityError("invalid_percent_complete", "percentComplete", "Percent complete must be between 0 and 100.", metadata),
    );
  }

  return errors;
}

function createActivityError(
  code: ScheduleManagementError["code"],
  field: string,
  message: string,
  metadata: ScheduleManagementMetadata,
): ScheduleManagementError {
  return { code, field, message, metadata };
}

function createActivityMetadata(input: CreateScheduleActivityInput): ScheduleManagementMetadata {
  return {
    ...(input.metadata ?? {}),
    activityId: input.id,
    projectId: input.projectId,
    code: input.code,
    parentActivityId: input.parentActivityId ?? null,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [key, cloneDomainValue(property)]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
