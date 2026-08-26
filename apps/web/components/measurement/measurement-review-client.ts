import type { DecisionBriefCriticalItem, DecisionBriefSourceReference } from "@bba/bdos-core/decision-brief";
import type { MeasurementBulletinReview, MeasurementBulletinReviewStatus } from "@/lib/bdos/measurement-bulletin-review-service";

/**
 * "Revisar medição" — orquestra `GET /api/measurement/imports/[id]/review`.
 * Mesmo padrão de measurement-bulletin-formal-status-client.ts:
 * `fetchImpl` injetável, validação estrutural mínima (aceita ou
 * rejeita, nunca normaliza).
 */

export type MeasurementReviewFetchOutcome =
  | { readonly kind: "ok"; readonly review: MeasurementBulletinReview }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_formalized" }
  | { readonly kind: "technical_error" };

const BULLETIN_STATUS_VALUES: ReadonlyArray<MeasurementBulletinReviewStatus> = ["Draft", "Validated", "Finalized", "Cancelled"];

function extractValidCriticalItem(value: unknown): DecisionBriefCriticalItem | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string") return null;
  if (candidate.severity !== "blocking" && candidate.severity !== "warning") return null;
  if (candidate.materiality !== "material" && candidate.materiality !== "technical_observation") return null;
  if (typeof candidate.title !== "string") return null;
  if (typeof candidate.body !== "string") return null;
  if (candidate.consequenceIfAddressed !== null && typeof candidate.consequenceIfAddressed !== "string") return null;
  if (candidate.consequenceIfIgnored !== null && typeof candidate.consequenceIfIgnored !== "string") return null;
  if (!Array.isArray(candidate.evidenceReferences)) return null;
  for (const reference of candidate.evidenceReferences) {
    if (extractValidSourceReference(reference) === null) return null;
  }
  return candidate as unknown as DecisionBriefCriticalItem;
}

function extractValidSourceReference(value: unknown): DecisionBriefSourceReference | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.sourceType !== "spreadsheet_cell") return null;
  if (typeof candidate.sourceId !== "string") return null;
  const locator = candidate.locator;
  if (typeof locator !== "object" || locator === null) return null;
  const locatorCandidate = locator as Record<string, unknown>;
  if (typeof locatorCandidate.sheetName !== "string") return null;
  if (typeof locatorCandidate.row !== "number") return null;
  if (locatorCandidate.column !== undefined && typeof locatorCandidate.column !== "string") return null;
  return candidate as unknown as DecisionBriefSourceReference;
}

export function extractValidMeasurementReview(payload: unknown): MeasurementBulletinReview | null {
  if (typeof payload !== "object" || payload === null) return null;

  const data = (payload as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;

  const candidate = data as Record<string, unknown>;

  if (typeof candidate.bulletinNumber !== "number") return null;
  if (typeof candidate.periodStartDate !== "string") return null;
  if (typeof candidate.periodEndDate !== "string") return null;
  if (typeof candidate.totalValueDecimal !== "string") return null;
  if (typeof candidate.status !== "string" || !BULLETIN_STATUS_VALUES.includes(candidate.status as MeasurementBulletinReviewStatus)) return null;
  if (typeof candidate.itemCount !== "number") return null;
  if (typeof candidate.sourceCount !== "number") return null;
  if (typeof candidate.materialDivergenceCount !== "number") return null;
  if (typeof candidate.technicalObservationCount !== "number") return null;
  if (candidate.technicalResponsibleName !== null && typeof candidate.technicalResponsibleName !== "string") return null;
  if (typeof candidate.certified !== "boolean") return null;
  if (!Array.isArray(candidate.items)) return null;
  if (!Array.isArray(candidate.technicalObservations)) return null;
  for (const observation of candidate.technicalObservations) {
    if (extractValidCriticalItem(observation) === null) return null;
  }

  for (const rawItem of candidate.items) {
    if (typeof rawItem !== "object" || rawItem === null) return null;
    const item = rawItem as Record<string, unknown>;
    if (typeof item.id !== "string") return null;
    if (typeof item.code !== "string") return null;
    if (typeof item.description !== "string") return null;
    if (typeof item.unit !== "string") return null;
    if (typeof item.quantityDecimal !== "string") return null;
    if (typeof item.unitValueDecimal !== "string") return null;
    if (typeof item.valueDecimal !== "string") return null;
    if (!Array.isArray(item.evidenceReferences)) return null;
    for (const reference of item.evidenceReferences) {
      if (extractValidSourceReference(reference) === null) return null;
    }
  }

  return data as MeasurementBulletinReview;
}

export async function fetchMeasurementBulletinReview(
  measurementBulletinImportId: string,
  fetchImpl: typeof fetch = fetch
): Promise<MeasurementReviewFetchOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/measurement/imports/${measurementBulletinImportId}/review`);
  } catch {
    return { kind: "technical_error" };
  }

  if (response.status === 401) return { kind: "unauthenticated" };
  if (response.status === 404) return { kind: "not_found" };
  if (response.status === 409) return { kind: "not_formalized" };
  if (!response.ok) return { kind: "technical_error" };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "technical_error" };
  }

  const review = extractValidMeasurementReview(body);
  if (review === null) return { kind: "technical_error" };

  return { kind: "ok", review };
}
