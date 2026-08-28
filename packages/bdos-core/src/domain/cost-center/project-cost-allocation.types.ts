/**
 * Camada operacional de Centros de Custo — tipos.
 *
 * PROJECT COST ENTRY  = um custo do projeto ANTES da distribuição.
 * PROJECT COST ALLOCATION = quanto desse custo pertence a cada Centro de Custo.
 *
 * Invariante de domínio (herdada de cost-center.ts): a participação
 * societária no consórcio NÃO determina automaticamente a distribuição
 * dos custos. Nenhuma alocação é criada por participação. EQUAL_SPLIT só
 * existe quando explicitamente solicitado; CUSTOM_SPLIT persiste o
 * percentual realmente utilizado.
 *
 * Dinheiro: string decimal exata (canonicalizada a centavos pela camada
 * measurement-certification). Nunca float.
 */

import type { OrganizationId, EngineeringProjectId } from "./cost-center.types";

export type ProjectCostCenterId = string;
export type ProjectCostEntryId = string;
export type ProjectCostAllocationId = string;

/**
 * Natureza semântica do dado — precisa existir no modelo, no read model
 * e na UI. NÃO é apenas observação textual.
 *   Demonstrative → dado de demonstração da funcionalidade ("DADOS DEMONSTRATIVOS").
 *   Actual        → custo real da obra.
 */
export enum CostDataNature {
  Demonstrative = "Demonstrative",
  Actual = "Actual",
}

/** Origem/natureza do dado de custo. */
export enum CostEntrySourceKind {
  ManualDemonstration = "ManualDemonstration",
  FinancialEntry = "FinancialEntry",
  Payroll = "Payroll",
  Document = "Document",
  Import = "Import",
  Integration = "Integration",
  ManualControlled = "ManualControlled",
}

/** Ciclo de vida do custo. */
export enum CostEntryStatus {
  /** Pode haver valor ainda não atribuído. */
  Draft = "Draft",
  /** Soma das alocações = valor total do custo, EXATAMENTE. */
  Allocated = "Allocated",
}

/**
 * Classificação gerencial de alto nível. Vem PRONTA do domínio/read
 * model — nunca derivada por comparação frágil de descrição na UI.
 * "RH" consolida Folha de Pagamento + Encargos Trabalhistas.
 */
export enum CostFamily {
  RH = "RH",
  Combustivel = "Combustivel",
  LocacaoEquipamentos = "LocacaoEquipamentos",
  Outros = "Outros",
}

/**
 * Método de distribuição de um custo entre Centros de Custo.
 *   DIRECT       → "Atribuição direta"  (um centro recebe 100%, ou valores explícitos por centro)
 *   EQUAL_SPLIT  → "Rateio igual"       (dividido igualmente entre N centros — só quando solicitado)
 *   CUSTOM_SPLIT → "Rateio específico"  (percentual específico por centro, persistido verbatim)
 */
export enum CostAllocationMethod {
  Direct = "DIRECT",
  EqualSplit = "EQUAL_SPLIT",
  CustomSplit = "CUSTOM_SPLIT",
}

export interface ProjectCostEntry {
  readonly id: ProjectCostEntryId;
  readonly organizationId: OrganizationId;
  readonly engineeringProjectId: EngineeringProjectId;
  /** Vínculo OPCIONAL futuro com o Financeiro real. Nunca duplica o Financeiro. */
  readonly financialLancamentoId: string | null;
  /** Reutiliza financial_categorias quando aplicável. */
  readonly financialCategoriaId: string | null;
  /** Rótulo textual da categoria financeira, para leitura (não é a chave). */
  readonly categoryLabel: string | null;
  readonly costFamily: CostFamily;
  readonly description: string;
  readonly supplierName: string | null;
  /** Decimal exato "54000.00". amount > 0. */
  readonly amountDecimal: string;
  /** Competência do custo — "YYYY-MM" (período) ou "YYYY-MM-DD". */
  readonly competencePeriod: string;
  readonly dataNature: CostDataNature;
  readonly sourceKind: CostEntrySourceKind;
  readonly status: CostEntryStatus;
  readonly notes: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ProjectCostAllocation {
  readonly id: ProjectCostAllocationId;
  readonly organizationId: OrganizationId;
  readonly engineeringProjectId: EngineeringProjectId;
  readonly projectCostEntryId: ProjectCostEntryId;
  readonly projectCostCenterId: ProjectCostCenterId;
  readonly allocationMethod: CostAllocationMethod;
  /** Inteiro 1..10000. Percentual realmente utilizado (bps). */
  readonly allocationBasisPoints: number;
  /** Decimal exato "54000.00". allocated > 0. */
  readonly allocatedAmountDecimal: string;
  readonly rationale: string | null;
}

/** Centro de Custo mínimo necessário para validar uma alocação. */
export interface AllocatableCostCenter {
  readonly id: ProjectCostCenterId;
  readonly organizationId: OrganizationId;
  readonly engineeringProjectId: EngineeringProjectId;
  readonly code: string;
  readonly name: string;
}
