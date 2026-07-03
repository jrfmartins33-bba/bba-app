import type {
  CreateEngineerWorkspaceInput,
  EngineerWorkspace,
  EngineerWorkspaceError,
  EngineerWorkspaceFailure,
  EngineerWorkspaceMetadata,
  EngineerWorkspacePeriod,
  EngineerWorkspaceProject,
  EngineerWorkspaceResult,
  EngineerWorkspaceServiceItem,
  EngineerWorkspaceSuccess,
  EngineerWorkspaceSummary,
  EngineerWorkspaceWorkPackage,
} from "./engineer-workspace.types";

const activeStatus = "Active";
const completedStatus = "Completed";

export function createEngineerWorkspace(
  input: CreateEngineerWorkspaceInput,
): EngineerWorkspaceResult {
  const metadata = createEngineerWorkspaceMetadata(input);
  const errors = validateEngineerWorkspace(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject<EngineerWorkspaceFailure>({
      success: false,
      workspace: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  const workPackages = sortWorkPackages(input.workPackages ?? []);

  return freezeDomainObject<EngineerWorkspaceSuccess>({
    success: true,
    workspace: createWorkspace(input, workPackages, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

function createWorkspace(
  input: CreateEngineerWorkspaceInput,
  workPackages: ReadonlyArray<EngineerWorkspaceWorkPackage>,
  metadata: EngineerWorkspaceMetadata,
): EngineerWorkspace {
  return {
    id: input.id,
    engineerId: input.engineerId,
    engineerName: input.engineerName,
    organizationId: input.organizationId,
    project: cloneProject(input.project as EngineerWorkspaceProject),
    period: clonePeriod(input.period as EngineerWorkspacePeriod),
    workPackages,
    summary: createSummary(workPackages),
    metadata,
  };
}

function validateEngineerWorkspace(
  input: CreateEngineerWorkspaceInput,
  metadata: EngineerWorkspaceMetadata,
): ReadonlyArray<EngineerWorkspaceError> {
  const errors: EngineerWorkspaceError[] = [];

  if (isBlank(input.id)) {
    errors.push(
      createEngineerWorkspaceError(
        "missing_id",
        "id",
        "Engineer workspace id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.engineerId)) {
    errors.push(
      createEngineerWorkspaceError(
        "missing_engineer_id",
        "engineerId",
        "Engineer id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.engineerName)) {
    errors.push(
      createEngineerWorkspaceError(
        "missing_engineer_name",
        "engineerName",
        "Engineer name is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.organizationId)) {
    errors.push(
      createEngineerWorkspaceError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  if (input.project === undefined || input.project === null) {
    errors.push(
      createEngineerWorkspaceError(
        "missing_project",
        "project",
        "Project is required.",
        metadata,
      ),
    );
  }

  if (input.period === undefined || input.period === null) {
    errors.push(
      createEngineerWorkspaceError(
        "missing_period",
        "period",
        "Measurement period is required.",
        metadata,
      ),
    );
  }

  if (input.workPackages === undefined || input.workPackages === null) {
    errors.push(
      createEngineerWorkspaceError(
        "missing_work_packages",
        "workPackages",
        "Work packages are required.",
        metadata,
      ),
    );
  }

  return errors;
}

function sortWorkPackages(
  workPackages: ReadonlyArray<EngineerWorkspaceWorkPackage>,
): ReadonlyArray<EngineerWorkspaceWorkPackage> {
  return [...workPackages]
    .map((workPackage) => ({
      ...workPackage,
      serviceItems: sortServiceItems(workPackage.serviceItems),
    }))
    .sort((left, right) => left.sequence - right.sequence);
}

function sortServiceItems(
  serviceItems: ReadonlyArray<EngineerWorkspaceServiceItem>,
): ReadonlyArray<EngineerWorkspaceServiceItem> {
  return [...serviceItems]
    .map((serviceItem) => ({ ...serviceItem }))
    .sort((left, right) => compareStrings(left.code, right.code));
}

function createSummary(
  workPackages: ReadonlyArray<EngineerWorkspaceWorkPackage>,
): EngineerWorkspaceSummary {
  const serviceItems = workPackages.flatMap((workPackage) => workPackage.serviceItems);

  return {
    totalWorkPackages: workPackages.length,
    totalServiceItems: serviceItems.length,
    activeServiceItems: serviceItems.filter((item) => item.status === activeStatus).length,
    completedServiceItems: serviceItems.filter(
      (item) => item.status === completedStatus,
    ).length,
    itemsWithRemainingQuantity: serviceItems.filter(
      (item) => item.remainingQuantity > 0,
    ).length,
    itemsWithoutRemainingQuantity: serviceItems.filter(
      (item) => item.remainingQuantity <= 0,
    ).length,
  };
}

function cloneProject(project: EngineerWorkspaceProject): EngineerWorkspaceProject {
  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    contractId: project.contractId,
    clientName: project.clientName,
    status: project.status,
    location: project.location,
    metadata: project.metadata,
  };
}

function clonePeriod(period: EngineerWorkspacePeriod): EngineerWorkspacePeriod {
  return {
    measurementPeriodId: period.measurementPeriodId,
    periodNumber: period.periodNumber,
    startDate: period.startDate,
    endDate: period.endDate,
    status: period.status,
    metadata: period.metadata,
  };
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function createEngineerWorkspaceError(
  code: EngineerWorkspaceError["code"],
  field: string,
  message: string,
  metadata: EngineerWorkspaceMetadata,
): EngineerWorkspaceError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createEngineerWorkspaceMetadata(
  input: CreateEngineerWorkspaceInput,
): EngineerWorkspaceMetadata {
  return {
    ...(input.metadata ?? {}),
    workspaceId: input.id,
    engineerId: input.engineerId,
    organizationId: input.organizationId,
    projectId: input.project?.projectId ?? null,
    contractId: input.project?.contractId ?? null,
    measurementPeriodId: input.period?.measurementPeriodId ?? null,
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
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
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
