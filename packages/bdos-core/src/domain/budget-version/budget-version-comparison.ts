import { BudgetLineKind, type BudgetLine, type BudgetVersion } from "./budget-version.types";

export type BudgetComparisonClassification = "Reduction" | "Increase" | "Equal" | "Divergence";

export type BudgetDocumentDivergenceKind =
  | "Unit"
  | "Quantity"
  | "Description"
  | "Code"
  | "Correspondence";

export type BudgetLineMatchMethod =
  | "PersistedSourceLineId"
  | "UniqueHierarchicalCode"
  | "UniqueDocumentPosition"
  | "UniqueExternalCode"
  | "UniqueDocumentEvidence";

export interface BudgetMoneyDelta {
  readonly officialCents: number | null;
  readonly winnerCents: number | null;
  /** Positivo representa redução; negativo representa acréscimo. */
  readonly differenceCents: number | null;
  readonly percentageBasisPoints: number | null;
}

export interface BudgetComparedItem {
  readonly proposalLineId: string;
  readonly officialLineId: string | null;
  readonly matchMethod: BudgetLineMatchMethod | null;
  readonly unmatchedReason: string | null;
  readonly classification: BudgetComparisonClassification;
  readonly proposalPosition: number;
  readonly proposalParentLineId: string | null;
  readonly proposalCode: string | null;
  readonly officialCode: string | null;
  readonly proposalDescription: string | null;
  readonly officialDescription: string | null;
  readonly proposalQuantity: string | null;
  readonly officialQuantity: string | null;
  readonly proposalUnit: string | null;
  readonly officialUnit: string | null;
  readonly codeDiffers: boolean;
  readonly descriptionDiffers: boolean;
  readonly quantityDiffers: boolean;
  /** A fonte possuía resíduo além da escala documental, mas o valor canônico é igual. */
  readonly quantityNormalizedForComparison: boolean;
  readonly unitDiffers: boolean;
  readonly documentDivergences: ReadonlyArray<BudgetDocumentDivergenceKind>;
  readonly unitPrice: BudgetMoneyDelta;
  readonly total: BudgetMoneyDelta;
}

export interface BudgetComparisonSummary {
  readonly officialTotalCents: number;
  readonly proposalTotalCents: number;
  readonly differenceCents: number;
  readonly percentageBasisPoints: number | null;
  readonly proposalServiceItemCount: number;
  readonly officialServiceItemCount: number;
  readonly matchedItemCount: number;
  readonly unmatchedProposalItemCount: number;
  readonly unmatchedOfficialItemCount: number;
  readonly reductionCount: number;
  readonly increaseCount: number;
  readonly equalCount: number;
  readonly divergenceCount: number;
  readonly normalizedQuantityMatchCount: number;
  readonly largestReductionProposalLineId: string | null;
  readonly largestIncreaseProposalLineId: string | null;
}

export interface BudgetVersionComparison {
  readonly proposalBudgetVersionId: string;
  readonly officialBudgetVersionId: string;
  readonly summary: BudgetComparisonSummary;
  readonly items: ReadonlyArray<BudgetComparedItem>;
  readonly unmatchedOfficialLineIds: ReadonlyArray<string>;
}

interface MatchResult {
  readonly official: BudgetLine | null;
  readonly method: BudgetLineMatchMethod | null;
  readonly reason: string | null;
}

const PERSISTED_SOURCE_LINE_ID_KEYS = ["sourceBudgetLineId", "officialBudgetLineId"] as const;

/**
 * Compara duas versões consolidadas sem alterar nenhuma delas. O algoritmo
 * nunca usa similaridade textual: primeiro respeita uma referência de linha
 * persistida e, quando ela não existe, aceita apenas evidência documental
 * única nos dois documentos, com validação final de um-para-um.
 */
export function compareBudgetVersions(input: {
  readonly officialBudgetVersion: BudgetVersion;
  readonly proposalBudgetVersion: BudgetVersion;
}): BudgetVersionComparison {
  const { officialBudgetVersion: official, proposalBudgetVersion: proposal } = input;
  validateComparableVersions(official, proposal);

  const officialItems = official.lines.filter((line) => line.kind === BudgetLineKind.ServiceItem);
  const proposalItems = proposal.lines
    .filter((line) => line.kind === BudgetLineKind.ServiceItem)
    .slice()
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));

  const officialById = new Map(officialItems.map((line) => [line.id, line]));
  const officialLinesById = new Map(official.lines.map((line) => [line.id, line]));
  const proposalLinesById = new Map(proposal.lines.map((line) => [line.id, line]));
  const officialHierarchical = uniqueEvidenceIndex(officialItems, hierarchicalCodeOf);
  const proposalHierarchical = uniqueEvidenceIndex(proposalItems, hierarchicalCodeOf);
  const officialDocumentPosition = uniqueEvidenceIndex(officialItems, (line) => documentPositionOf(line, officialLinesById));
  const proposalDocumentPosition = uniqueEvidenceIndex(proposalItems, (line) => documentPositionOf(line, proposalLinesById));
  const officialExternal = uniqueEvidenceIndex(officialItems, (line) => cleanEvidence(line.externalCode));
  const proposalExternal = uniqueEvidenceIndex(proposalItems, (line) => cleanEvidence(line.externalCode));
  const officialDocumentEvidence = uniqueEvidenceIndex(officialItems, documentEvidenceOf);
  const proposalDocumentEvidence = uniqueEvidenceIndex(proposalItems, documentEvidenceOf);
  const usedOfficialIds = new Set<string>();

  const items = proposalItems.map((proposalItem): BudgetComparedItem => {
    const match = matchProposalItem({
      proposalItem,
      officialById,
      officialHierarchical,
      proposalHierarchical,
      officialDocumentPosition,
      proposalDocumentPosition,
      officialExternal,
      proposalExternal,
      officialDocumentEvidence,
      proposalDocumentEvidence,
      usedOfficialIds,
    });
    if (match.official) usedOfficialIds.add(match.official.id);
    return compareItem(proposalItem, match);
  });

  const unmatchedOfficialLineIds = officialItems
    .filter((line) => !usedOfficialIds.has(line.id))
    .map((line) => line.id);
  const officialTotalCents = sumServiceItemTotals(officialItems);
  const proposalTotalCents = sumServiceItemTotals(proposalItems);
  const differenceCents = officialTotalCents - proposalTotalCents;

  const reductionItems = items.filter((item) => item.classification === "Reduction");
  const increaseItems = items.filter((item) => item.classification === "Increase");

  return {
    proposalBudgetVersionId: proposal.id,
    officialBudgetVersionId: official.id,
    summary: {
      officialTotalCents,
      proposalTotalCents,
      differenceCents,
      percentageBasisPoints: percentageBasisPoints(differenceCents, officialTotalCents),
      proposalServiceItemCount: proposalItems.length,
      officialServiceItemCount: officialItems.length,
      matchedItemCount: items.filter((item) => item.officialLineId !== null).length,
      unmatchedProposalItemCount: items.filter((item) => item.officialLineId === null).length,
      unmatchedOfficialItemCount: unmatchedOfficialLineIds.length,
      reductionCount: reductionItems.length,
      increaseCount: increaseItems.length,
      equalCount: items.filter((item) => item.classification === "Equal").length,
      divergenceCount: items.filter((item) => item.classification === "Divergence").length,
      normalizedQuantityMatchCount: items.filter((item) => item.quantityNormalizedForComparison).length,
      largestReductionProposalLineId: extremeItemId(reductionItems, "max"),
      largestIncreaseProposalLineId: extremeItemId(increaseItems, "min"),
    },
    items,
    unmatchedOfficialLineIds,
  };
}

function validateComparableVersions(official: BudgetVersion, proposal: BudgetVersion): void {
  if (official.organizationId !== proposal.organizationId) {
    throw new Error("As versões comparadas pertencem a organizações diferentes.");
  }
  if (official.procurementCaseId !== proposal.procurementCaseId) {
    throw new Error("As versões comparadas pertencem a processos diferentes.");
  }
  if (JSON.stringify(official.scope) !== JSON.stringify(proposal.scope)) {
    throw new Error("As versões comparadas possuem escopos documentais diferentes.");
  }
  if (proposal.originLineage?.sourceBudgetVersionId !== official.id) {
    throw new Error("A proposta não possui rastreabilidade canônica para o orçamento informado.");
  }
}

function matchProposalItem(input: {
  readonly proposalItem: BudgetLine;
  readonly officialById: ReadonlyMap<string, BudgetLine>;
  readonly officialHierarchical: ReadonlyMap<string, BudgetLine | null>;
  readonly proposalHierarchical: ReadonlyMap<string, BudgetLine | null>;
  readonly officialDocumentPosition: ReadonlyMap<string, BudgetLine | null>;
  readonly proposalDocumentPosition: ReadonlyMap<string, BudgetLine | null>;
  readonly officialExternal: ReadonlyMap<string, BudgetLine | null>;
  readonly proposalExternal: ReadonlyMap<string, BudgetLine | null>;
  readonly officialDocumentEvidence: ReadonlyMap<string, BudgetLine | null>;
  readonly proposalDocumentEvidence: ReadonlyMap<string, BudgetLine | null>;
  readonly usedOfficialIds: ReadonlySet<string>;
}): MatchResult {
  const persistedSourceLineId = persistedSourceLineIdOf(input.proposalItem);
  if (persistedSourceLineId) {
    const official = input.officialById.get(persistedSourceLineId) ?? null;
    if (!official) return { official: null, method: null, reason: "O vínculo de origem persistido não aponta para um item oficial válido." };
    if (input.usedOfficialIds.has(official.id)) return { official: null, method: null, reason: "O vínculo persistido reutiliza um item oficial já associado." };
    return { official, method: "PersistedSourceLineId", reason: null };
  }

  const hierarchicalCode = hierarchicalCodeOf(input.proposalItem);
  if (hierarchicalCode) {
    const proposalEvidence = input.proposalHierarchical.get(hierarchicalCode);
    const officialEvidence = input.officialHierarchical.get(hierarchicalCode);
    if (proposalEvidence && officialEvidence && !input.usedOfficialIds.has(officialEvidence.id)) {
      return { official: officialEvidence, method: "UniqueHierarchicalCode", reason: null };
    }
    if (proposalEvidence === null || officialEvidence === null) {
      return { official: null, method: null, reason: "O código hierárquico não é único nos dois documentos." };
    }
  }

  const documentPosition = Array.from(input.proposalDocumentPosition.entries())
    .find(([, line]) => line?.id === input.proposalItem.id)?.[0] ?? null;
  if (documentPosition) {
    const proposalEvidence = input.proposalDocumentPosition.get(documentPosition);
    const officialEvidence = input.officialDocumentPosition.get(documentPosition);
    if (proposalEvidence && officialEvidence && !input.usedOfficialIds.has(officialEvidence.id)) {
      return { official: officialEvidence, method: "UniqueDocumentPosition", reason: null };
    }
  }

  const externalCode = cleanEvidence(input.proposalItem.externalCode);
  if (externalCode) {
    const proposalEvidence = input.proposalExternal.get(externalCode);
    const officialEvidence = input.officialExternal.get(externalCode);
    if (proposalEvidence && officialEvidence && !input.usedOfficialIds.has(officialEvidence.id)) {
      return { official: officialEvidence, method: "UniqueExternalCode", reason: null };
    }
    if (proposalEvidence === null || officialEvidence === null) {
      // Um código de composição pode aparecer legitimamente mais de uma
      // vez. Nesse caso ele não decide sozinho; a evidência composta abaixo
      // ainda pode provar uma correspondência única.
    }
  }

  const documentEvidence = documentEvidenceOf(input.proposalItem);
  if (documentEvidence) {
    const proposalEvidence = input.proposalDocumentEvidence.get(documentEvidence);
    const officialEvidence = input.officialDocumentEvidence.get(documentEvidence);
    if (proposalEvidence && officialEvidence && !input.usedOfficialIds.has(officialEvidence.id)) {
      return { official: officialEvidence, method: "UniqueDocumentEvidence", reason: null };
    }
    if (proposalEvidence === null || officialEvidence === null) {
      return { official: null, method: null, reason: "A combinação documental de código, descrição, quantidade e unidade não é única nos dois documentos." };
    }
  }

  return { official: null, method: null, reason: "Nenhuma evidência documental determinística e única foi encontrada." };
}

function compareItem(proposal: BudgetLine, match: MatchResult): BudgetComparedItem {
  const official = match.official;
  const proposalDescription = descriptionOf(proposal);
  const officialDescription = official ? descriptionOf(official) : null;
  const codeDiffers = official ? cleanEvidence(proposal.externalCode) !== cleanEvidence(official.externalCode) : true;
  const descriptionDiffers = official ? normalizedDocumentText(proposalDescription) !== normalizedDocumentText(officialDescription) : true;
  const rawProposalQuantity = quantityOf(proposal);
  const rawOfficialQuantity = official ? quantityOf(official) : null;
  const proposalQuantity = canonicalDocumentQuantity(rawProposalQuantity);
  const officialQuantity = canonicalDocumentQuantity(rawOfficialQuantity);
  const proposalUnit = unitOf(proposal);
  const officialUnit = official ? unitOf(official) : null;
  const quantityDiffers = official ? proposalQuantity !== officialQuantity : true;
  const quantityNormalizedForComparison = official !== null
    && cleanEvidence(rawProposalQuantity) !== cleanEvidence(rawOfficialQuantity)
    && !quantityDiffers;
  const unitDiffers = official ? proposalUnit !== officialUnit : true;
  const unitPrice = moneyDelta(official ? unitPriceCentsOf(official) : null, unitPriceCentsOf(proposal));
  const total = moneyDelta(official?.totalCents ?? null, proposal.totalCents ?? null);

  const documentDivergences: BudgetDocumentDivergenceKind[] = [];
  if (!official) documentDivergences.push("Correspondence");
  if (official && unitDiffers) documentDivergences.push("Unit");
  if (official && quantityDiffers) documentDivergences.push("Quantity");
  if (official && descriptionDiffers) documentDivergences.push("Description");
  if (official && codeDiffers) documentDivergences.push("Code");

  let classification: BudgetComparisonClassification;
  if (documentDivergences.length > 0 || total.differenceCents === null) {
    classification = "Divergence";
  } else if (total.differenceCents === 0) {
    classification = "Equal";
  } else if (total.differenceCents > 0) {
    classification = "Reduction";
  } else {
    classification = "Increase";
  }

  return {
    proposalLineId: proposal.id,
    officialLineId: official?.id ?? null,
    matchMethod: match.method,
    unmatchedReason: match.reason,
    classification,
    proposalPosition: proposal.position,
    proposalParentLineId: proposal.parentLineId,
    proposalCode: proposal.externalCode,
    officialCode: official?.externalCode ?? null,
    proposalDescription,
    officialDescription,
    proposalQuantity,
    officialQuantity,
    proposalUnit,
    officialUnit,
    codeDiffers,
    descriptionDiffers,
    quantityDiffers,
    quantityNormalizedForComparison,
    unitDiffers,
    documentDivergences,
    unitPrice,
    total,
  };
}

function moneyDelta(officialCents: number | null, winnerCents: number | null): BudgetMoneyDelta {
  if (officialCents === null || winnerCents === null) {
    return { officialCents, winnerCents, differenceCents: null, percentageBasisPoints: null };
  }
  const differenceCents = officialCents - winnerCents;
  return {
    officialCents,
    winnerCents,
    differenceCents,
    percentageBasisPoints: percentageBasisPoints(differenceCents, officialCents),
  };
}

function percentageBasisPoints(difference: number, official: number): number | null {
  if (official === 0) return null;
  const sign = difference < 0 ? -1n : 1n;
  const numerator = BigInt(Math.abs(difference)) * 10_000n;
  const denominator = BigInt(Math.abs(official));
  const rounded = (numerator + denominator / 2n) / denominator;
  const result = Number(sign * rounded);
  if (!Number.isSafeInteger(result)) throw new Error("Percentual fora do intervalo seguro.");
  return result;
}

function sumServiceItemTotals(lines: ReadonlyArray<BudgetLine>): number {
  return lines.reduce((sum, line) => {
    const next = sum + (line.totalCents ?? 0);
    if (!Number.isSafeInteger(next)) throw new Error("Total comparado fora do intervalo seguro.");
    return next;
  }, 0);
}

function uniqueEvidenceIndex(
  lines: ReadonlyArray<BudgetLine>,
  evidenceOf: (line: BudgetLine) => string | null,
): ReadonlyMap<string, BudgetLine | null> {
  const index = new Map<string, BudgetLine | null>();
  for (const line of lines) {
    const evidence = evidenceOf(line);
    if (!evidence) continue;
    index.set(evidence, index.has(evidence) ? null : line);
  }
  return index;
}

function hierarchicalCodeOf(line: BudgetLine): string | null {
  return cleanEvidence(typeof line.metadata.hierarchicalCode === "string" ? line.metadata.hierarchicalCode : null);
}

function documentEvidenceOf(line: BudgetLine): string | null {
  const code = cleanEvidence(line.externalCode);
  const description = normalizedDocumentText(descriptionOf(line));
  const quantity = canonicalDocumentQuantity(quantityOf(line));
  const unit = unitOf(line);
  if (!code && !description) return null;
  return JSON.stringify([code, description, quantity, unit]);
}

function documentPositionOf(line: BudgetLine, linesById: ReadonlyMap<string, BudgetLine>): string | null {
  const persistedHierarchicalCode = hierarchicalCodeOf(line);
  if (persistedHierarchicalCode) return persistedHierarchicalCode;
  if (line.metadata.parentResolutionMethod !== "HierarchicalCode") return null;

  const path: number[] = [];
  const visited = new Set<string>();
  let cursor: BudgetLine | undefined = line;
  while (cursor) {
    if (visited.has(cursor.id)) return null;
    visited.add(cursor.id);
    const siblings = Array.from(linesById.values())
      .filter((candidate) => candidate.parentLineId === cursor?.parentLineId && candidate.kind === cursor?.kind)
      .filter((candidate) => candidate.kind !== BudgetLineKind.ServiceItem || candidate.metadata.parentResolutionMethod === "HierarchicalCode")
      .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
    const ordinal = siblings.findIndex((candidate) => candidate.id === cursor?.id);
    if (ordinal < 0) return null;
    path.unshift(ordinal + 1);
    cursor = cursor.parentLineId === null ? undefined : linesById.get(cursor.parentLineId);
  }
  // Um item raiz (como COT-015 na proposta) não recebe pai por inferência.
  return path.length === 3 ? path.map((part) => String(part).padStart(2, "0")).join(".") : null;
}

function persistedSourceLineIdOf(line: BudgetLine): string | null {
  for (const key of PERSISTED_SOURCE_LINE_ID_KEYS) {
    const value = line.metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function cleanEvidence(value: string | null): string | null {
  const cleaned = value?.trim() ?? "";
  return cleaned.length > 0 ? cleaned : null;
}

function descriptionOf(line: BudgetLine): string | null {
  return line.description.status === "Confirmed" ? line.description.text : null;
}

function quantityOf(line: BudgetLine): string | null {
  if (typeof line.quantity === "string") return line.quantity;
  return typeof line.metadata.quantidade === "string" ? line.metadata.quantidade : null;
}

function unitOf(line: BudgetLine): string | null {
  if (typeof line.unit === "string") return line.unit;
  return typeof line.metadata.unidade === "string" ? line.metadata.unidade : null;
}

function unitPriceCentsOf(line: BudgetLine): number | null {
  const canonical = line.unitPriceCents ?? line.officialUnitPriceCents ?? null;
  if (canonical !== null) return canonical;
  const documented = line.metadata.precoUnitarioComBdiReais;
  return typeof documented === "string" ? decimalMoneyToCents(documented) : null;
}

function decimalMoneyToCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/u.test(value)) return null;
  const [integer, fraction = ""] = value.split(".");
  const cents = Number(BigInt(integer) * 100n + BigInt(fraction.padEnd(2, "0")));
  return Number.isSafeInteger(cents) ? cents : null;
}

function normalizedDocumentText(value: string | null): string | null {
  return value === null ? null : value.trim().replace(/\s+/gu, " ");
}

/**
 * Quantidades documentais admitem até seis casas decimais no domínio BBA.
 * Resíduos de serialização além dessa escala são arredondados com BigInt,
 * sem converter o texto para ponto flutuante. A função é usada tanto na
 * associação quanto na comparação para manter uma única regra canônica.
 */
function canonicalDocumentQuantity(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/u.exec(trimmed);
  if (!match) return cleanEvidence(value);

  const integer = match[1]?.replace(/^0+(?=\d)/u, "") ?? "0";
  const rawFraction = match[2] ?? "";
  const documentScale = 6;
  let scaledValue = BigInt(integer + rawFraction.slice(0, documentScale).padEnd(documentScale, "0"));
  const discarded = rawFraction.slice(documentScale);
  if (discarded.length > 0 && discarded[0]! >= "5") scaledValue += 1n;

  const scaleFactor = 10n ** BigInt(documentScale);
  const canonicalInteger = scaledValue / scaleFactor;
  const canonicalFraction = (scaledValue % scaleFactor)
    .toString()
    .padStart(documentScale, "0")
    .replace(/0+$/u, "");
  return canonicalFraction ? `${canonicalInteger}.${canonicalFraction}` : canonicalInteger.toString();
}

function extremeItemId(items: ReadonlyArray<BudgetComparedItem>, direction: "min" | "max"): string | null {
  if (items.length === 0) return null;
  return items.reduce((selected, item) => {
    const selectedValue = selected.total.differenceCents ?? 0;
    const candidateValue = item.total.differenceCents ?? 0;
    return direction === "max"
      ? candidateValue > selectedValue ? item : selected
      : candidateValue < selectedValue ? item : selected;
  }).proposalLineId;
}
