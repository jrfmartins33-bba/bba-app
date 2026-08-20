import type { ContractBaseline } from "../../domain/contract-baseline";
import type { Consortium } from "../../domain/consortium";
import type { ProjectCostCenter } from "../../domain/cost-center";

export interface ContractBaselineRepository {
  saveContractBaseline(
    organizationId: string,
    actor: string,
    baseline: ContractBaseline,
  ): Promise<ContractBaseline>;

  findContractBaselineById(
    organizationId: string,
    id: string,
  ): Promise<ContractBaseline | null>;

  findContractBaselineByProject(
    organizationId: string,
    projectId: string,
  ): Promise<ContractBaseline | null>;
}

export interface ConsortiumRepository {
  saveConsortium(
    organizationId: string,
    actor: string,
    consortium: Consortium,
  ): Promise<Consortium>;

  findConsortiumById(
    organizationId: string,
    id: string,
  ): Promise<Consortium | null>;
}

export interface CostCenterRepository {
  saveCostCenter(
    organizationId: string,
    actor: string,
    costCenter: ProjectCostCenter,
  ): Promise<ProjectCostCenter>;

  listCostCentersByProject(
    organizationId: string,
    projectId: string,
  ): Promise<ReadonlyArray<ProjectCostCenter>>;

  findCostCenterById(
    organizationId: string,
    id: string,
  ): Promise<ProjectCostCenter | null>;
}
