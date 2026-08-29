import type { MeasurementBulletinFormalStatus } from "@/lib/bdos/measurement-bulletin-formal-status-service";

/**
 * Etapa 3C.2 (BM_08) — orquestra
 * `GET /api/measurement/imports/[id]/formal-status` para a tela do
 * Relatório Executivo. Mesmo padrão de measurement-decision-brief-client.ts:
 * `fetchImpl` injetável só para teste, sem biblioteca de requests nova.
 * `not_formalized` (409) é um estado normal, não um erro -- a maioria
 * dos boletins ainda não passou pela Etapa 3C.2.
 */

export type MeasurementBulletinFormalStatusFetchOutcome =
  | { readonly kind: "ok"; readonly formalStatus: MeasurementBulletinFormalStatus }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_formalized" }
  | { readonly kind: "technical_error" };

const FORMAL_STATUS_VALUES = ["Draft", "Validated", "Finalized", "Cancelled"];

/**
 * Validação estrutural mínima -- mesma disciplina de
 * extractValidDecisionBrief: nunca normaliza ou completa campos, só
 * aceita ou rejeita o formato exatamente como o Application Service o
 * produz.
 */
export function extractValidFormalStatus(payload: unknown): MeasurementBulletinFormalStatus | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = (payload as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const candidate = data as Record<string, unknown>;

  if (typeof candidate.bulletinNumber !== "number") return null;
  if (typeof candidate.periodStartDate !== "string") return null;
  if (typeof candidate.periodEndDate !== "string") return null;
  if (typeof candidate.totalValueDecimal !== "string") return null;
  if (typeof candidate.status !== "string" || !FORMAL_STATUS_VALUES.includes(candidate.status)) return null;
  if (typeof candidate.lineCount !== "number") return null;
  if (typeof candidate.sourceCount !== "number") return null;
  if (candidate.technicalResponsibleName !== null && typeof candidate.technicalResponsibleName !== "string") return null;
  if (candidate.formalizationDate !== null && typeof candidate.formalizationDate !== "string") return null;
  if (typeof candidate.certified !== "boolean") return null;

  return data as MeasurementBulletinFormalStatus;
}

export async function fetchMeasurementBulletinFormalStatus(
  measurementBulletinImportId: string,
  fetchImpl: typeof fetch = fetch
): Promise<MeasurementBulletinFormalStatusFetchOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/measurement/imports/${measurementBulletinImportId}/formal-status`);
  } catch {
    return { kind: "technical_error" };
  }

  if (response.status === 401) {
    return { kind: "unauthenticated" };
  }

  if (response.status === 404) {
    return { kind: "not_found" };
  }

  if (response.status === 409) {
    return { kind: "not_formalized" };
  }

  if (!response.ok) {
    return { kind: "technical_error" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "technical_error" };
  }

  const formalStatus = extractValidFormalStatus(body);
  if (formalStatus === null) {
    return { kind: "technical_error" };
  }

  return { kind: "ok", formalStatus };
}
