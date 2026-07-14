import type { BudgetVersion } from "../../domain/budget-version";

/**
 * Invólucro que separa o retrato de domínio (`entity`) da revisão física de
 * concorrência otimista (`revision`) — `revision` é controle físico de
 * persistência, nunca um campo do domínio puro da Sprint 21.3B (ver
 * `budget-version.types.ts`, que não possui esse campo).
 */
export interface PersistedEntity<T> {
  readonly entity: T;
  readonly revision: number;
}

/** Revisão física inicial de toda Versão do Orçamento recém-criada. */
export const INITIAL_BUDGET_VERSION_REVISION = 0;

export type SaveBudgetVersionResult =
  | { readonly outcome: "saved"; readonly revision: number }
  | { readonly outcome: "concurrency_conflict" };

/**
 * Contrato mínimo exigido pelos Serviços de Aplicação da Versão do
 * Orçamento (Sprint 21.3C, seção 8.2). Não depende de Supabase. Cada
 * alteração persiste o retrato completo já validado pelo domínio — Linhas,
 * Relação de Rastreabilidade, estado de consolidação, tudo dentro de uma
 * mesma revisão — nunca uma alteração parcial (seção 16 da instrução:
 * atomicidade do agregado).
 */
export interface BudgetVersionRepository {
  /**
   * `actor` é a identidade já autenticada e resolvida pela camada de
   * servidor (correção de fronteira de confiança) — usada para autorizar
   * a escrita e como autoria persistida (`created_by`), nunca um valor
   * independente escolhido pelo chamador.
   */
  createDraftBudgetVersion(
    organizationId: string,
    actor: string,
    budgetVersion: BudgetVersion,
  ): Promise<PersistedEntity<BudgetVersion>>;

  /** Carrega o retrato completo: origem, Relação de Rastreabilidade, Linhas, hierarquia, posições, metadados, revisão. */
  loadBudgetVersion(
    organizationId: string,
    id: string,
  ): Promise<PersistedEntity<BudgetVersion> | null>;

  /**
   * Persiste um novo retrato inteiro da Versão do Orçamento (já validado
   * pelo domínio) condicionado à revisão esperada. Retorna a nova revisão
   * em caso de sucesso, ou conflito de concorrência explícito — nunca
   * sobrescrita silenciosa, nunca persistência parcial. `actor` é sempre a
   * identidade que está executando esta alteração específica — nunca
   * derivada de `budgetVersion.metadata.createdBy` (que reflete apenas
   * quem criou a Versão originalmente, podendo estar desatualizado).
   */
  saveBudgetVersion(
    organizationId: string,
    actor: string,
    budgetVersion: BudgetVersion,
    expectedRevision: number,
  ): Promise<SaveBudgetVersionResult>;
}
