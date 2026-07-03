import type {
  AdvanceProjectStatusInput,
  CreateProjectInput,
  Project,
  ProjectManagementError,
  ProjectManagementFailure,
  ProjectManagementMetadata,
  ProjectManagementResult,
  ProjectManagementSuccess,
} from "./project-management.types";
import { ProjectStatus } from "./project-management.types";

export function createProject(input: CreateProjectInput): ProjectManagementResult {
  const metadata = createProjectMetadata(input);
  const errors = validateProject(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject<ProjectManagementFailure>({
      success: false,
      project: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ProjectManagementSuccess>({
    success: true,
    project: createProjectEntity(input, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceProjectStatus(
  input: AdvanceProjectStatusInput,
): ProjectManagementResult {
  const metadata = createTransitionMetadata(input);

  if (!canAdvanceProjectStatus(input.project.status, input.toStatus)) {
    return freezeDomainObject<ProjectManagementFailure>({
      success: false,
      project: null,
      errors: [
        {
          code: "invalid_project_transition",
          field: "status",
          message: `Cannot transition project from ${input.project.status} to ${input.toStatus}.`,
          metadata,
        },
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ProjectManagementSuccess>({
    success: true,
    project: {
      ...input.project,
      status: input.toStatus,
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function createProjectEntity(
  input: CreateProjectInput,
  metadata: ProjectManagementMetadata,
): Project {
  return {
    id: input.id,
    projectCode: input.projectCode,
    projectName: input.projectName,
    organizationId: input.organizationId,
    contractId: input.contractId,
    clientName: input.owner.clientName,
    location: input.location.location,
    city: input.location.city,
    state: input.location.state,
    country: input.location.country,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    projectManagerId: input.projectManagerId,
    projectManagerName: input.projectManagerName,
    inspectionAgency: input.inspectionAgency,
    supervisingEngineer: input.supervisingEngineer,
    startDate: input.period.startDate,
    expectedEndDate: input.period.expectedEndDate,
    status: input.status ?? ProjectStatus.Draft,
    metadata,
  };
}

function validateProject(
  input: CreateProjectInput,
  metadata: ProjectManagementMetadata,
): ReadonlyArray<ProjectManagementError> {
  const errors: ProjectManagementError[] = [];

  if (isBlank(input.projectCode)) {
    errors.push(
      createProjectError(
        "missing_project_code",
        "projectCode",
        "Project code is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.projectName)) {
    errors.push(
      createProjectError(
        "missing_project_name",
        "projectName",
        "Project name is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.organizationId)) {
    errors.push(
      createProjectError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.contractId)) {
    errors.push(
      createProjectError(
        "missing_contract_id",
        "contractId",
        "Contract id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.owner.clientName)) {
    errors.push(
      createProjectError(
        "missing_client",
        "owner.clientName",
        "Client is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.location.city)) {
    errors.push(
      createProjectError(
        "missing_city",
        "location.city",
        "City is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.location.state)) {
    errors.push(
      createProjectError(
        "missing_state",
        "location.state",
        "State is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.location.country)) {
    errors.push(
      createProjectError(
        "missing_country",
        "location.country",
        "Country is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.period.startDate)) {
    errors.push(
      createProjectError(
        "missing_start_date",
        "period.startDate",
        "Start date is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.period.expectedEndDate)) {
    errors.push(
      createProjectError(
        "missing_expected_end_date",
        "period.expectedEndDate",
        "Expected end date is required.",
        metadata,
      ),
    );
  }

  if (
    !isBlank(input.period.startDate) &&
    !isBlank(input.period.expectedEndDate) &&
    input.period.expectedEndDate < input.period.startDate
  ) {
    errors.push(
      createProjectError(
        "invalid_project_period",
        "period.expectedEndDate",
        "Expected end date cannot be earlier than start date.",
        metadata,
      ),
    );
  }

  if (isBlank(input.projectManagerId) || isBlank(input.projectManagerName)) {
    errors.push(
      createProjectError(
        "missing_project_manager",
        "projectManager",
        "Project manager id and name are required.",
        metadata,
      ),
    );
  }

  return errors;
}

function canAdvanceProjectStatus(
  fromStatus: ProjectStatus,
  toStatus: ProjectStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

function createProjectError(
  code: ProjectManagementError["code"],
  field: string,
  message: string,
  metadata: ProjectManagementMetadata,
): ProjectManagementError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createProjectMetadata(input: CreateProjectInput): ProjectManagementMetadata {
  return {
    ...(input.metadata ?? {}),
    projectId: input.id,
    projectCode: input.projectCode,
    organizationId: input.organizationId,
    contractId: input.contractId,
    clientName: input.owner.clientName,
    city: input.location.city,
    state: input.location.state,
    country: input.location.country,
    projectManagerId: input.projectManagerId,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createTransitionMetadata(
  input: AdvanceProjectStatusInput,
): ProjectManagementMetadata {
  return {
    ...input.project.metadata,
    ...(input.metadata ?? {}),
    projectId: input.project.id,
    projectCode: input.project.projectCode,
    organizationId: input.project.organizationId,
    contractId: input.project.contractId,
    fromStatus: input.project.status,
    toStatus: input.toStatus,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

const allowedTransitions: Readonly<
  Record<ProjectStatus, ReadonlyArray<ProjectStatus>>
> = {
  [ProjectStatus.Draft]: [ProjectStatus.Planning, ProjectStatus.Cancelled],
  [ProjectStatus.Planning]: [
    ProjectStatus.Executing,
    ProjectStatus.Cancelled,
  ],
  [ProjectStatus.Executing]: [
    ProjectStatus.Suspended,
    ProjectStatus.Completed,
    ProjectStatus.Cancelled,
  ],
  [ProjectStatus.Suspended]: [ProjectStatus.Executing],
  [ProjectStatus.Completed]: [],
  [ProjectStatus.Cancelled]: [],
};

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
