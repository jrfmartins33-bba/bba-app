/**
 * Traduz erros internos de ação de revisão (domain_error, persistence_failure, etc.)
 * para mensagens human-first legíveis em português.
 * NENHUM código técnico interno (domain_error, row_has_active_inconsistency, etc.)
 * é exposto visualmente ao usuário.
 */
export function toHumanReviewActionError(payload: unknown, fallbackMessage: string): string {
  if (!payload || typeof payload !== "object") {
    if (typeof payload === "string" && payload.trim().length > 0) {
      return translateErrorCode(payload.trim());
    }
    return fallbackMessage;
  }

  const obj = payload as Record<string, unknown>;

  // Check details array from domain_error response
  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    const firstErr = obj.errors[0];
    if (typeof firstErr === "string") return translateErrorCode(firstErr);
    if (typeof firstErr === "object" && firstErr !== null) {
      const eObj = firstErr as Record<string, unknown>;
      if (typeof eObj.message === "string" && eObj.message.trim().length > 0) {
        return translateErrorCode(eObj.message.trim());
      }
      if (typeof eObj.code === "string" && eObj.code.trim().length > 0) {
        return translateErrorCode(eObj.code.trim());
      }
    }
  }

  if (typeof obj.message === "string" && obj.message.trim().length > 0) {
    return translateErrorCode(obj.message.trim());
  }

  if (typeof obj.error === "string" && obj.error.trim().length > 0) {
    return translateErrorCode(obj.error.trim());
  }

  return fallbackMessage;
}

function translateErrorCode(codeOrMsg: string): string {
  const map: Record<string, string> = {
    domain_error: "Não foi possível concluir a ação devido a uma pendência de validação dos dados.",
    persistence_failure: "Ocorreu uma falha ao salvar as alterações no banco de dados.",
    session_consolidated: "A sessão de revisão já foi consolidada e não pode mais ser alterada.",
    row_not_pending: "Um ou mais itens selecionados já foram revisados.",
    unknown_row: "O item selecionado não foi encontrado na sessão.",
    empty_row_selection: "Selecione pelo menos um item para realizar a ação em lote.",
    missing_justification: "A justificativa é obrigatória para esta ação.",
    row_has_active_inconsistency: "O item possui divergência documental pendente.",
  };

  return map[codeOrMsg] ?? codeOrMsg;
}
