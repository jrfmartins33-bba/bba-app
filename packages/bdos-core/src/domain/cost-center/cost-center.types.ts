export type CostCenterId = string;
export type OrganizationId = string;
export type EngineeringProjectId = string;
export type ConsortiumMemberId = string;

export enum CostCenterStatus {
  Active = "Active",
  Inactive = "Inactive",
}

export interface ProjectCostCenter {
  readonly id: CostCenterId;
  readonly organizationId: OrganizationId;
  readonly engineeringProjectId: EngineeringProjectId;
  readonly consortiumMemberId: ConsortiumMemberId | null;
  readonly code: string;
  readonly name: string;
  readonly status: CostCenterStatus;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CreateProjectCostCenterInput {
  readonly id: CostCenterId;
  readonly organizationId: OrganizationId;
  readonly engineeringProjectId: EngineeringProjectId;
  readonly consortiumMemberId?: ConsortiumMemberId | null;
  readonly code: string;
  readonly name: string;
  readonly status?: CostCenterStatus;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
