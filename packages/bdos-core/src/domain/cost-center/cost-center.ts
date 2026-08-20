import {
  type ProjectCostCenter,
  CostCenterStatus,
  type CreateProjectCostCenterInput,
} from "./cost-center.types";

export class CostCenterValidationError extends Error {
  constructor(message: string) {
    super(`CostCenterValidationError: ${message}`);
    this.name = "CostCenterValidationError";
  }
}

export function validateCostCenterInput(input: CreateProjectCostCenterInput): void {
  if (!input.id || typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new CostCenterValidationError("Cost center id must be a non-empty string.");
  }
  if (!input.organizationId || typeof input.organizationId !== "string" || input.organizationId.trim().length === 0) {
    throw new CostCenterValidationError("Cost center organizationId must be a non-empty string.");
  }
  if (!input.engineeringProjectId || typeof input.engineeringProjectId !== "string" || input.engineeringProjectId.trim().length === 0) {
    throw new CostCenterValidationError("Cost center engineeringProjectId must be a non-empty string.");
  }
  if (!input.code || typeof input.code !== "string" || input.code.trim().length === 0) {
    throw new CostCenterValidationError("Cost center code must be a non-empty string.");
  }
  if (!input.name || typeof input.name !== "string" || input.name.trim().length === 0) {
    throw new CostCenterValidationError("Cost center name must be a non-empty string.");
  }
}

export function createProjectCostCenter(input: CreateProjectCostCenterInput): ProjectCostCenter {
  validateCostCenterInput(input);

  return {
    id: input.id.trim(),
    organizationId: input.organizationId.trim(),
    engineeringProjectId: input.engineeringProjectId.trim(),
    consortiumMemberId: input.consortiumMemberId ? input.consortiumMemberId.trim() : null,
    code: input.code.trim(),
    name: input.name.trim(),
    status: input.status ?? CostCenterStatus.Active,
    metadata: input.metadata ?? {},
  };
}

/**
 * Invariante de Domínio: A participação no consórcio (ex.: 50%) NÃO implica rateio automático
 * de custos entre os centros de custo. Cada lançamento contábil/econômico possui atribuição
 * própria (100% membro A, 100% membro B, 50/50, ou rateio específico).
 */
export type CostAllocationRule = "DirectAttribution" | "CustomSplit" | "ProRataShare";

export interface CostAttributionPolicy {
  readonly allocationRule: CostAllocationRule;
  readonly description: string;
  readonly allowsManualOverride: boolean;
}

export function getCostCenterPolicy(rule: CostAllocationRule): CostAttributionPolicy {
  switch (rule) {
    case "DirectAttribution":
      return {
        allocationRule: "DirectAttribution",
        description: "Custo atribuído integralmente ao centro de custo do consorciado executor.",
        allowsManualOverride: true,
      };
    case "CustomSplit":
      return {
        allocationRule: "CustomSplit",
        description: "Custo rateado conforme critério operacional específico aprovado pelos consorciados.",
        allowsManualOverride: true,
      };
    case "ProRataShare":
      return {
        allocationRule: "ProRataShare",
        description: "Custo rateado proporcionalmente à participação societária no consórcio quando acordado.",
        allowsManualOverride: true,
      };
  }
}
