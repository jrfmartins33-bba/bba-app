import type {
  BudgetReviewAuditAction,
  BudgetReviewFieldChange,
  BudgetReviewRow,
  BudgetReviewSession,
  ReconciliationDecision,
} from "../../domain/budget-official-review";

/** Um evento de auditoria a persistir junto de uma mutação de linha ou consolidação — sempre na mesma transação (enunciado §19). */
export interface AuditEventToPersist {
  readonly id: string;
  readonly action: BudgetReviewAuditAction;
  readonly actor: string;
  readonly occurredAt: string;
  readonly fieldChanges: ReadonlyArray<BudgetReviewFieldChange>;
  readonly justification: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type CreateSessionResult = { readonly outcome: "created" | "reused"; readonly sessionId: string };

/**
 * Contrato mínimo exigido pelos Serviços de Aplicação da Sessão de
 * Revisão do Orçamento Oficial (Epic 21.5A). Não depende de Supabase.
 * Diferente de `BudgetVersionRepository`, cada operação de linha persiste
 * apenas a linha alterada (nunca o retrato inteiro da sessão) — a Sessão
 * pode ter centenas de linhas, e substituir todas a cada confirmação
 * individual seria fisicamente inviável, além de destruir o histórico de
 * auditoria de linhas não tocadas.
 */
export interface BudgetReviewRepository {
  /**
   * Resolve o `organizationId` real de uma Sessão apenas pelo seu id —
   * nunca aceita `organizationId` vindo do corpo de uma requisição do
   * navegador quando o próprio banco pode derivá-lo (mesma disciplina do
   * enunciado §20). Admin BBA lê entre organizações (RLS `is_bba_admin()`);
   * este lookup é sempre o primeiro passo de qualquer rota Admin antes de
   * chamar qualquer outro método deste contrato.
   */
  findOrganizationIdForSession(sessionId: string): Promise<string | null>;

  loadSession(organizationId: string, sessionId: string): Promise<BudgetReviewSession | null>;

  /** Idempotência física por (procurementCaseId, sourceSha256, acquisitionMechanism) — enunciado §25. */
  findSessionByAcquisition(
    organizationId: string,
    procurementCaseId: string,
    sourceSha256: string,
    acquisitionMechanism: string,
  ): Promise<BudgetReviewSession | null>;

  /** `actor` é a identidade já autenticada e resolvida pela camada de servidor — nunca um valor independente escolhido pelo chamador. */
  createSession(organizationId: string, actor: string, session: BudgetReviewSession): Promise<CreateSessionResult>;

  /**
   * Persiste UMA linha (nova ou alterada) e, quando fornecido, o evento
   * de auditoria correspondente, na mesma transação física. Usada tanto
   * para uma única mutação (confirmar/corrigir/excluir/restaurar/inserir)
   * quanto, em sequência, para uma confirmação em lote (uma chamada por
   * linha do lote — cada linha e seu evento continuam atômicos entre si).
   */
  mutateRow(
    organizationId: string,
    actor: string,
    session: BudgetReviewSession,
    row: BudgetReviewRow,
    isNewRow: boolean,
    auditEvent: AuditEventToPersist | null,
  ): Promise<void>;

  /** Consolida a Sessão (InProgress -> Consolidated) e grava o evento SessionConsolidated na mesma transação. */
  consolidateSession(organizationId: string, actor: string, sessionId: string, auditEventId: string): Promise<{ readonly success: boolean }>;

  /** Importação inicial em lote — todas Pendente, cada uma com seu próprio evento RowImported, uma única transação física. */
  importRows(organizationId: string, actor: string, sessionId: string, rows: ReadonlyArray<BudgetReviewRow>, occurredAt: string): Promise<number>;

  /**
   * Persiste uma Decisão de Reconciliação (`AcceptedAsDocumented`) e seu
   * evento de auditoria na mesma transação — nunca altera `revised` ou
   * `state` (correção §7: "valores revised NÃO mudam"). Mutação distinta de
   * `mutateRow` porque altera colunas diferentes (nunca `state`/`revised`).
   */
  recordReconciliationDecision(
    organizationId: string,
    actor: string,
    sessionId: string,
    rowId: string,
    decision: ReconciliationDecision,
    auditEvent: AuditEventToPersist,
  ): Promise<void>;
}
