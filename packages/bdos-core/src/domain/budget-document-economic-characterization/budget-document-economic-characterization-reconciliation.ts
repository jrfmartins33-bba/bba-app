import { isValidMoneyCents } from "../budget-version";
import type { MoneyCents } from "../budget-version";
import type {
  IndependentBudgetReferenceLine,
  IndependentReferenceLineDiff,
  IndependentReferenceLineDiffEntry,
  LineReconciliation,
  ProposedBudgetLine,
  SelfConsistencyDiagnostic,
} from "./budget-document-economic-characterization.types";
import { PROFILE } from "./budget-document-economic-characterization-profile";

/**
 * Multiplica quantidade (texto decimal exato, escala preservada) por preço
 * unitário (centavos inteiros) usando aritmética inteira exata (`BigInt`)
 * — nunca ponto flutuante. Arredondamento explícito e versionado:
 * meio-para-cima (`round half up`), nunca silencioso, nunca `Math.round`
 * sobre um `number` de ponto flutuante.
 */
function multiplyQuantityByUnitPriceCents(exactDecimalText: string, decimalPlaces: number, unitPriceCents: MoneyCents): MoneyCents | null {
  const digitsOnly = exactDecimalText.replace(".", "");
  if (!/^\d+$/.test(digitsOnly)) return null;
  const quantityInteger = BigInt(digitsOnly);
  const scale = BigInt(10) ** BigInt(decimalPlaces);
  const numerator = quantityInteger * BigInt(unitPriceCents);
  const quotient = numerator / scale;
  const remainder = numerator % scale;
  const rounded = remainder * BigInt(2) >= scale ? quotient + BigInt(1) : quotient;
  const result = Number(rounded);
  return isValidMoneyCents(result) ? result : null;
}

/**
 * Reconcilia uma linha proposta do tipo Item de Serviço: quantidade ×
 * preço unitário, comparado ao total documental — nunca sobrescreve o
 * total original, apenas registra divergência (§18). Tolerância de
 * arredondamento versionada no perfil (`reconciliationRoundingToleranceCents`).
 */
export function reconcileLine(line: ProposedBudgetLine): LineReconciliation {
  if (line.type !== "service_item") {
    return { proposedLineId: line.proposedLineId, status: "not_applicable", recalculatedTotalCents: null, declaredTotalCents: null, differenceCents: null };
  }
  if (line.extractionStatus === "technical_failure") {
    return { proposedLineId: line.proposedLineId, status: "technical_failure", recalculatedTotalCents: null, declaredTotalCents: null, differenceCents: null };
  }

  const declaredTotalCents = line.total.status === "parsed" ? line.total.cents : null;
  const hasQuantity = line.quantity.status === "parsed" && line.quantity.exactDecimalText !== null && line.quantity.decimalPlaces !== null;
  const hasUnitPrice = line.unitPrice.status === "parsed" && line.unitPrice.cents !== null;

  if (!hasQuantity || !hasUnitPrice || declaredTotalCents === null) {
    return { proposedLineId: line.proposedLineId, status: "insufficient_data", recalculatedTotalCents: null, declaredTotalCents, differenceCents: null };
  }

  const recalculatedTotalCents = multiplyQuantityByUnitPriceCents(line.quantity.exactDecimalText!, line.quantity.decimalPlaces!, line.unitPrice.cents!);
  if (recalculatedTotalCents === null) {
    return { proposedLineId: line.proposedLineId, status: "insufficient_data", recalculatedTotalCents: null, declaredTotalCents, differenceCents: null };
  }

  const differenceCents = Math.abs(recalculatedTotalCents - declaredTotalCents);
  if (differenceCents === 0) return { proposedLineId: line.proposedLineId, status: "reconciled", recalculatedTotalCents, declaredTotalCents, differenceCents: 0 };
  if (differenceCents <= PROFILE.reconciliationRoundingToleranceCents) {
    return { proposedLineId: line.proposedLineId, status: "reconciled_with_rounding", recalculatedTotalCents, declaredTotalCents, differenceCents };
  }
  return { proposedLineId: line.proposedLineId, status: "mismatch", recalculatedTotalCents, declaredTotalCents, differenceCents };
}

function normalizeForComparison(text: string | null): string | null {
  if (text === null) return null;
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Diff linha a linha contra uma referência independente (§5 do mandato) —
 * nunca produzida quando a referência não existe (ver
 * `buildSelfConsistencyDiagnostic` para esse caso). Código externo é usado
 * apenas como CHAVE DE COMPARAÇÃO documental — nunca como identidade
 * interna. Itens sem código de nenhum dos dois lados são comparados por
 * descrição normalizada.
 */
export function buildIndependentReferenceDiff(
  proposedLines: ReadonlyArray<ProposedBudgetLine>,
  referenceLines: ReadonlyArray<IndependentBudgetReferenceLine> | null,
  referenceSourceDescription: string | null,
): IndependentReferenceLineDiff {
  if (referenceLines === null) return { availability: "unavailable", referenceSourceDescription: null, entries: [] };

  // A população comparável inclui Grupo/Subgrupo/Item de Serviço — uma referência
  // independente tipicamente descreve a hierarquia inteira, não só os itens (§5).
  const proposedComparable = proposedLines.filter((line) => line.type === "group" || line.type === "subgroup" || line.type === "service_item");
  const proposedByCode = new Map<string, ProposedBudgetLine[]>();
  const proposedByDescription = new Map<string, ProposedBudgetLine[]>();
  for (const line of proposedComparable) {
    const codeKey = line.externalCode !== null ? normalizeForComparison(line.externalCode) : null;
    if (codeKey !== null) {
      const list = proposedByCode.get(codeKey) ?? [];
      list.push(line);
      proposedByCode.set(codeKey, list);
    }
    const descKey = normalizeForComparison(line.descriptionOriginal);
    if (descKey !== null) {
      const list = proposedByDescription.get(descKey) ?? [];
      list.push(line);
      proposedByDescription.set(descKey, list);
    }
  }

  const matchedProposedIds = new Set<string>();
  const entries: IndependentReferenceLineDiffEntry[] = [];

  for (const reference of referenceLines) {
    const referenceKey = reference.externalCode !== null ? normalizeForComparison(reference.externalCode) : (reference.hierarchicalCode ?? null);
    const candidates = referenceKey !== null ? (proposedByCode.get(referenceKey) ?? []) : (proposedByDescription.get(normalizeForComparison(reference.description)!) ?? []);

    if (candidates.length === 0) {
      entries.push({
        referenceExternalCode: reference.externalCode, referenceHierarchicalCode: reference.hierarchicalCode,
        matchedProposedLineId: null, outcome: "missing_from_extraction",
        descriptionDivergence: false, unitDivergence: false, quantityDivergence: false, totalDivergenceCents: null,
      });
      continue;
    }
    if (candidates.length > 1) {
      entries.push({
        referenceExternalCode: reference.externalCode, referenceHierarchicalCode: reference.hierarchicalCode,
        matchedProposedLineId: null, outcome: "duplicate_code_in_extraction",
        descriptionDivergence: false, unitDivergence: false, quantityDivergence: false, totalDivergenceCents: null,
      });
      continue;
    }

    const matched = candidates[0];
    matchedProposedIds.add(matched.proposedLineId);
    const totalDivergenceCents = matched.total.status === "parsed" && reference.totalCents !== null && matched.total.cents !== null
      ? Math.abs(matched.total.cents - reference.totalCents)
      : null;

    entries.push({
      referenceExternalCode: reference.externalCode, referenceHierarchicalCode: reference.hierarchicalCode,
      matchedProposedLineId: matched.proposedLineId, outcome: "matched",
      descriptionDivergence: normalizeForComparison(matched.descriptionOriginal) !== normalizeForComparison(reference.description),
      unitDivergence: normalizeForComparison(matched.unitOriginal) !== normalizeForComparison(reference.unit),
      quantityDivergence: matched.quantity.exactDecimalText !== reference.quantityDecimalText,
      totalDivergenceCents,
    });
  }

  for (const line of proposedComparable) {
    if (matchedProposedIds.has(line.proposedLineId)) continue;
    entries.push({
      referenceExternalCode: null, referenceHierarchicalCode: null,
      matchedProposedLineId: line.proposedLineId, outcome: "extra_in_extraction",
      descriptionDivergence: false, unitDivergence: false, quantityDivergence: false, totalDivergenceCents: null,
    });
  }

  return { availability: "available", referenceSourceDescription, entries };
}

/**
 * Diagnóstico produzido quando não há referência independente — nunca
 * finge "faltante"/"excedente" comparando o resultado contra ele mesmo
 * (§5 do mandato). Sinaliza candidatos estruturais que EXPLICAM eventual
 * divergência agregada: linhas físicas sem disposição econômica, possíveis
 * duplicidades de código, lacunas de hierarquia.
 */
export function buildSelfConsistencyDiagnostic(proposedLines: ReadonlyArray<ProposedBudgetLine>, totalPhysicalLines: number): SelfConsistencyDiagnostic {
  const dispositioned = proposedLines.length;
  const ambiguousLineCount = proposedLines.filter((line) => line.type === "ambiguous").length;

  const codeOccurrences = new Map<string, number>();
  for (const line of proposedLines) {
    if (line.externalCode === null) continue;
    const key = normalizeForComparison(line.externalCode)!;
    codeOccurrences.set(key, (codeOccurrences.get(key) ?? 0) + 1);
  }
  const possibleDuplicateExternalCodes = [...codeOccurrences.entries()].filter(([, count]) => count > 1).map(([code]) => code);

  const proposedLineById = new Map(proposedLines.map((line) => [line.proposedLineId, line]));
  let hierarchyGapCount = 0;
  for (const line of proposedLines) {
    if (line.parentProposedLineId === null) continue;
    if (!proposedLineById.has(line.parentProposedLineId)) hierarchyGapCount += 1;
  }

  return {
    physicalLinesWithoutEconomicDisposition: Math.max(0, totalPhysicalLines - dispositioned),
    ambiguousLineCount,
    possibleDuplicateExternalCodes,
    hierarchyGapCount,
    pageVsGlobalCountDivergence: false,
  };
}
