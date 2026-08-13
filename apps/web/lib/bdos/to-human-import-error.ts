/**
 * Human-first import error sanitizer
 * Guarantees [object Object] is NEVER presented to the user.
 */
export function toHumanImportError(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim().length > 0 && payload !== "[object Object]") {
    return payload.trim();
  }
  if (payload instanceof Error && payload.message && payload.message !== "[object Object]") {
    return payload.message.trim();
  }
  if (typeof payload === "object" && payload !== null) {
    const obj = payload as Record<string, unknown>;

    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const first = obj.errors[0];
      if (typeof first === "string" && first.trim().length > 0 && first !== "[object Object]") {
        return first.trim();
      }
    }

    if (typeof obj.message === "string" && obj.message.trim().length > 0 && obj.message !== "[object Object]") {
      return obj.message.trim();
    }

    if (typeof obj.error === "string" && obj.error.trim().length > 0 && obj.error !== "[object Object]") {
      if (obj.error === "file_must_be_xlsx") return "O arquivo selecionado deve ser uma planilha Excel (.xlsx).";
      if (obj.error === "file_too_large") return "O arquivo excede o limite máximo permitido de 10 MB.";
      if (obj.error === "procurement_case_not_found") return "O processo de licitação selecionado não foi encontrado.";
      if (obj.error === "procurement_lot_not_found") return "O lote selecionado não foi encontrado para este processo.";
      if (obj.error === "storage_object_not_found") return "Não foi possível recuperar a planilha no armazenamento seguro.";
      if (obj.error === "storage_integrity_failure") return "Falha na verificação de integridade do arquivo.";
      if (obj.error === "unauthorized_storage_path") return "Caminho de armazenamento não autorizado.";
      return obj.error.trim();
    }
  }
  return fallback;
}
