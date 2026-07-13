import { DECISION_BRIEF_READINESS_VALUES, type DecisionBrief, type DecisionBriefReadiness } from "@bba/bdos-core/decision-brief";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.2 — orquestra
 * `GET /api/measurement/imports/[id]/decision-brief` para a página do
 * Relatório Executivo. Mesmo padrão de `measurement-imports-client.ts`
 * (Sprint 20.1E.1B): `fetchImpl` injetável só para teste, sem
 * biblioteca de requests nova.
 */

export type MeasurementDecisionBriefFetchOutcome =
  | { readonly kind: "ok"; readonly brief: DecisionBrief }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "not_found" }
  | { readonly kind: "analysis_not_available" }
  | { readonly kind: "technical_error" };

/**
 * Validação estrutural mínima do payload de sucesso -- não é um
 * schema completo (sem precedente de Zod neste repositório), só o
 * suficiente para nunca tratar um payload incompatível como um
 * `DecisionBrief` válido: objeto, `data` objeto, `metadata` presente,
 * `metadata.generatedAt` uma string não vazia e efetivamente
 * formatável como data (o cabeçalho consome esse campo diretamente --
 * ver measurement-decision-brief-header.tsx), `executiveConclusion`
 * presente, `readiness` é um dos quatro valores reais do contrato
 * (`DECISION_BRIEF_READINESS_VALUES`). Nunca normaliza ou completa
 * campos -- só aceita ou rejeita.
 */
export function extractValidDecisionBrief(payload: unknown): DecisionBrief | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = (payload as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const candidate = data as { metadata?: unknown; executiveConclusion?: unknown };
  if (typeof candidate.metadata !== "object" || candidate.metadata === null) {
    return null;
  }

  const generatedAt = (candidate.metadata as { generatedAt?: unknown }).generatedAt;
  if (typeof generatedAt !== "string" || generatedAt.trim().length === 0 || Number.isNaN(new Date(generatedAt).getTime())) {
    return null;
  }

  if (typeof candidate.executiveConclusion !== "object" || candidate.executiveConclusion === null) {
    return null;
  }

  const readiness = (candidate.executiveConclusion as { readiness?: unknown }).readiness;
  if (typeof readiness !== "string" || !DECISION_BRIEF_READINESS_VALUES.includes(readiness as DecisionBriefReadiness)) {
    return null;
  }

  return data as DecisionBrief;
}

export async function fetchMeasurementDecisionBrief(
  measurementBulletinImportId: string,
  fetchImpl: typeof fetch = fetch
): Promise<MeasurementDecisionBriefFetchOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/measurement/imports/${measurementBulletinImportId}/decision-brief`);
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
    return { kind: "analysis_not_available" };
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

  const brief = extractValidDecisionBrief(body);
  if (brief === null) {
    return { kind: "technical_error" };
  }

  return { kind: "ok", brief };
}
