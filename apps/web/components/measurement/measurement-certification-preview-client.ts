import type { MeasurementCertificationPreview } from "@/lib/bdos/measurement-bulletin-certification-preview-service";

/**
 * Prévia de certificação — orquestra
 * `GET /api/measurement/imports/[id]/certification-preview`. Mesmo
 * padrão de measurement-review-client.ts.
 */

export type MeasurementCertificationPreviewFetchOutcome =
  | { readonly kind: "ok"; readonly preview: MeasurementCertificationPreview }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_available" }
  | { readonly kind: "technical_error" };

export function extractValidCertificationPreview(payload: unknown): MeasurementCertificationPreview | null {
  if (typeof payload !== "object" || payload === null) return null;

  const data = (payload as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;

  const candidate = data as Record<string, unknown>;

  if (typeof candidate.bulletinNumber !== "number") return null;
  if (typeof candidate.periodStartDate !== "string") return null;
  if (typeof candidate.periodEndDate !== "string") return null;
  if (typeof candidate.itemCount !== "number") return null;
  if (typeof candidate.sourceCount !== "number") return null;
  if (typeof candidate.materialDivergenceCount !== "number") return null;
  if (candidate.technicalResponsibleName !== null && typeof candidate.technicalResponsibleName !== "string") return null;
  if (typeof candidate.measurementValueDecimal !== "string") return null;
  if (typeof candidate.accumulatedBeforeDecimal !== "string") return null;
  if (typeof candidate.accumulatedAfterDecimal !== "string") return null;
  if (typeof candidate.contractBalanceAfterDecimal !== "string") return null;

  return data as MeasurementCertificationPreview;
}

export async function fetchMeasurementCertificationPreview(
  measurementBulletinImportId: string,
  fetchImpl: typeof fetch = fetch
): Promise<MeasurementCertificationPreviewFetchOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/measurement/imports/${measurementBulletinImportId}/certification-preview`);
  } catch {
    return { kind: "technical_error" };
  }

  if (response.status === 401) return { kind: "unauthenticated" };
  if (response.status === 404) return { kind: "not_found" };
  if (response.status === 409) return { kind: "not_available" };
  if (!response.ok) return { kind: "technical_error" };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "technical_error" };
  }

  const preview = extractValidCertificationPreview(body);
  if (preview === null) return { kind: "technical_error" };

  return { kind: "ok", preview };
}
