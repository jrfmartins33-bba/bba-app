import type { DecisionBriefCriticalItem, DecisionBriefSourceReference } from "@bba/bdos-core/decision-brief";
import type { MeasurementBulletinReview, MeasurementBulletinReviewItem, MeasurementBulletinReviewStatus } from "@/lib/bdos/measurement-bulletin-review-service";
import type {
  MeasurementEconomicComparisonSummary,
  MeasurementItemEconomicComparison,
  MeasurementItemEconomicInterpretation
} from "@/lib/bdos/measurement-item-economic-comparison-service";

/**
 * "Revisar medição" — orquestra `GET /api/measurement/imports/[id]/review`.
 * Mesmo padrão de measurement-bulletin-formal-status-client.ts:
 * `fetchImpl` injetável, validação estrutural mínima (aceita ou
 * rejeita, nunca normaliza).
 *
 * Evolução econômica: a rota devolve cada item com `economicComparison`
 * (null quando não há correspondência confiável com o Orçamento Oficial/
 * Proposta Vencedora) e um `economicSummary` de topo (null quando
 * nenhum item teve correspondência) -- estende, sem alterar,
 * `MeasurementBulletinReview`/`MeasurementBulletinReviewItem`.
 */

export type PhysicalFinancialSituation = "above_planned" | "on_planned" | "below_planned";

export interface MeasurementReviewPhysicalFinancialObra {
  readonly periodLabel: string;
  readonly periodDate: string;
  readonly plannedAccumulatedValueDecimal: string;
  readonly actualAccumulatedValueDecimal: string;
  readonly deviationValueDecimal: string;
  readonly plannedAccumulatedPercent: string | null;
  readonly actualAccumulatedPercent: string | null;
  readonly deviationPercentPoints: string | null;
  readonly situation: PhysicalFinancialSituation;
}

export interface MeasurementReviewPhysicalFinancialGroup {
  readonly groupCode: string;
  readonly groupName: string;
  readonly plannedPeriodValueDecimal: string;
  readonly plannedAccumulatedValueDecimal: string;
  readonly actualPeriodValueDecimal: string;
  readonly actualAccumulatedValueDecimal: string;
  readonly plannedAccumulatedPercent: string | null;
  readonly actualAccumulatedPercent: string | null;
  readonly deviationValueDecimal: string;
  readonly deviationPercentPoints: string | null;
  readonly situation: PhysicalFinancialSituation;
}

export interface MeasurementReviewPhysicalFinancialAdjustment {
  readonly code: string;
  readonly name: string;
}

export interface MeasurementReviewPhysicalFinancial {
  readonly obraAvailable: boolean;
  readonly obraUnavailableReason: string | null;
  readonly groupsAvailable: boolean;
  readonly groupsUnavailableReason: string | null;
  readonly sourceFileName: string | null;
  readonly sourceSheetName: string | null;
  readonly period: { readonly label: string; readonly date: string } | null;
  readonly obra: MeasurementReviewPhysicalFinancialObra | null;
  readonly groups: ReadonlyArray<MeasurementReviewPhysicalFinancialGroup>;
  readonly adjustments: ReadonlyArray<MeasurementReviewPhysicalFinancialAdjustment>;
}

export interface MeasurementReviewItemWithEconomics extends MeasurementBulletinReviewItem {
  readonly economicComparison: MeasurementItemEconomicComparison | null;
  /** Situação do GRUPO do cronograma físico-financeiro a que este item pertence -- nunca um status individual do item. null quando não há grupo correlacionado ou o cronograma não está disponível. */
  readonly physicalFinancialGroup: MeasurementReviewPhysicalFinancialGroup | null;
}

/** "Ver composição" (correção semântica pós-Preview, item 5) -- um item que contribui para o impacto agregado do deságio, ordenado pelo servidor por maior contribuição. */
export interface MeasurementEconomicCompositionEntry {
  readonly itemId: string;
  readonly code: string;
  readonly description: string;
  readonly quantityDecimal: string;
  readonly officialUnitPriceDecimal: string;
  readonly contractedUnitPriceDecimal: string;
  readonly lineImpactDecimal: string;
  readonly participationPercentage: string | null;
}

export interface MeasurementEconomicSummaryWithComposition extends MeasurementEconomicComparisonSummary {
  readonly composition: ReadonlyArray<MeasurementEconomicCompositionEntry>;
}

export interface MeasurementBulletinReviewWithEconomics extends Omit<MeasurementBulletinReview, "items"> {
  readonly items: ReadonlyArray<MeasurementReviewItemWithEconomics>;
  readonly economicSummary: MeasurementEconomicSummaryWithComposition | null;
  readonly physicalFinancial: MeasurementReviewPhysicalFinancial;
}

export type MeasurementReviewFetchOutcome =
  | { readonly kind: "ok"; readonly review: MeasurementBulletinReviewWithEconomics }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_formalized" }
  | { readonly kind: "technical_error" };

const ECONOMIC_INTERPRETATION_VALUES: ReadonlyArray<MeasurementItemEconomicInterpretation> = ["contract_discount", "contract_premium", "no_variation"];

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

function extractValidItemEconomicComparison(value: unknown): MeasurementItemEconomicComparison | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.officialUnitPriceDecimal !== "string") return undefined;
  if (typeof candidate.contractedUnitPriceDecimal !== "string") return undefined;
  if (typeof candidate.unitPriceDifferenceDecimal !== "string") return undefined;
  if (candidate.unitPriceDifferencePercentage !== null && typeof candidate.unitPriceDifferencePercentage !== "string") return undefined;
  if (!ECONOMIC_INTERPRETATION_VALUES.includes(candidate.interpretation as MeasurementItemEconomicInterpretation)) return undefined;
  if (typeof candidate.lineImpactDecimal !== "string") return undefined;
  if (candidate.participationPercentage !== null && typeof candidate.participationPercentage !== "string") return undefined;
  return candidate as unknown as MeasurementItemEconomicComparison;
}

function extractValidCompositionEntry(value: unknown): MeasurementEconomicCompositionEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.itemId !== "string") return null;
  if (typeof candidate.code !== "string") return null;
  if (typeof candidate.description !== "string") return null;
  if (typeof candidate.quantityDecimal !== "string") return null;
  if (typeof candidate.officialUnitPriceDecimal !== "string") return null;
  if (typeof candidate.contractedUnitPriceDecimal !== "string") return null;
  if (typeof candidate.lineImpactDecimal !== "string") return null;
  if (candidate.participationPercentage !== null && typeof candidate.participationPercentage !== "string") return null;
  return candidate as unknown as MeasurementEconomicCompositionEntry;
}

function extractValidEconomicSummary(value: unknown): MeasurementEconomicSummaryWithComposition | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.matchedItemCount !== "number") return undefined;
  if (typeof candidate.totalItemCount !== "number") return undefined;
  if (typeof candidate.measuredValueAtOfficialPricesDecimal !== "string") return undefined;
  if (typeof candidate.measuredValueAtContractedPricesDecimal !== "string") return undefined;
  if (typeof candidate.contractDiscountImpactDecimal !== "string") return undefined;
  if (!Array.isArray(candidate.composition)) return undefined;
  for (const entry of candidate.composition) {
    if (extractValidCompositionEntry(entry) === null) return undefined;
  }
  return candidate as unknown as MeasurementEconomicSummaryWithComposition;
}

const PHYSICAL_FINANCIAL_SITUATION_VALUES: ReadonlyArray<PhysicalFinancialSituation> = ["above_planned", "on_planned", "below_planned"];

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function extractValidPhysicalFinancialGroup(value: unknown): MeasurementReviewPhysicalFinancialGroup | null {
  if (typeof value !== "object" || value === null) return null;
  const c = value as Record<string, unknown>;
  if (typeof c.groupCode !== "string") return null;
  if (typeof c.groupName !== "string") return null;
  if (typeof c.plannedPeriodValueDecimal !== "string") return null;
  if (typeof c.plannedAccumulatedValueDecimal !== "string") return null;
  if (typeof c.actualPeriodValueDecimal !== "string") return null;
  if (typeof c.actualAccumulatedValueDecimal !== "string") return null;
  if (!isNullableString(c.plannedAccumulatedPercent)) return null;
  if (!isNullableString(c.actualAccumulatedPercent)) return null;
  if (typeof c.deviationValueDecimal !== "string") return null;
  if (!isNullableString(c.deviationPercentPoints)) return null;
  if (!PHYSICAL_FINANCIAL_SITUATION_VALUES.includes(c.situation as PhysicalFinancialSituation)) return null;
  return c as unknown as MeasurementReviewPhysicalFinancialGroup;
}

function extractValidPhysicalFinancialObra(value: unknown): MeasurementReviewPhysicalFinancialObra | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object") return undefined;
  const c = value as Record<string, unknown>;
  if (typeof c.periodLabel !== "string") return undefined;
  if (typeof c.periodDate !== "string") return undefined;
  if (typeof c.plannedAccumulatedValueDecimal !== "string") return undefined;
  if (typeof c.actualAccumulatedValueDecimal !== "string") return undefined;
  if (typeof c.deviationValueDecimal !== "string") return undefined;
  if (!isNullableString(c.plannedAccumulatedPercent)) return undefined;
  if (!isNullableString(c.actualAccumulatedPercent)) return undefined;
  if (!isNullableString(c.deviationPercentPoints)) return undefined;
  if (!PHYSICAL_FINANCIAL_SITUATION_VALUES.includes(c.situation as PhysicalFinancialSituation)) return undefined;
  return c as unknown as MeasurementReviewPhysicalFinancialObra;
}

function extractValidPhysicalFinancial(value: unknown): MeasurementReviewPhysicalFinancial | null {
  if (typeof value !== "object" || value === null) return null;
  const c = value as Record<string, unknown>;
  if (typeof c.obraAvailable !== "boolean") return null;
  if (typeof c.groupsAvailable !== "boolean") return null;
  if (!isNullableString(c.obraUnavailableReason)) return null;
  if (!isNullableString(c.groupsUnavailableReason)) return null;
  if (!isNullableString(c.sourceFileName)) return null;
  if (!isNullableString(c.sourceSheetName)) return null;
  if (c.period !== null) {
    if (typeof c.period !== "object" || c.period === null) return null;
    const period = c.period as Record<string, unknown>;
    if (typeof period.label !== "string" || typeof period.date !== "string") return null;
  }
  if (extractValidPhysicalFinancialObra(c.obra) === undefined) return null;
  if (!Array.isArray(c.groups)) return null;
  for (const group of c.groups) {
    if (extractValidPhysicalFinancialGroup(group) === null) return null;
  }
  if (!Array.isArray(c.adjustments)) return null;
  for (const adjustment of c.adjustments) {
    if (typeof adjustment !== "object" || adjustment === null) return null;
    const row = adjustment as Record<string, unknown>;
    if (typeof row.code !== "string" || typeof row.name !== "string") return null;
  }
  return c as unknown as MeasurementReviewPhysicalFinancial;
}

export function extractValidMeasurementReview(payload: unknown): MeasurementBulletinReviewWithEconomics | null {
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
    if (extractValidItemEconomicComparison(item.economicComparison) === undefined) return null;
    if (item.physicalFinancialGroup !== null && extractValidPhysicalFinancialGroup(item.physicalFinancialGroup) === null) return null;
  }

  if (extractValidEconomicSummary(candidate.economicSummary) === undefined) return null;
  if (extractValidPhysicalFinancial(candidate.physicalFinancial) === null) return null;

  return data as MeasurementBulletinReviewWithEconomics;
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
