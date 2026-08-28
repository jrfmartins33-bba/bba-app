/**
 * Camada operacional de Centros de Custo — regras puras.
 *
 * Sem I/O. Dinheiro em decimal exato canonicalizado a centavos
 * (measurement-certification). Percentuais em basis points inteiros
 * (1..10000) e, para leitura, string decimal de 2 casas calculada por
 * bigint — nunca float.
 *
 * Invariantes protegidas aqui (espelham o briefing):
 *   1. Um custo pertence a uma empresa e uma obra.
 *   2. Uma alocação só aponta para Centro de Custo da MESMA empresa e da MESMA obra.
 *   3. Nunca se vincula Centro de Custo por nome textual (sempre por id).
 *   4. allocated_amount_decimal > 0.
 *   5. allocation_basis_points inteiro, 1..10000.
 *   6. Um Centro de Custo não aparece duas vezes na mesma despesa.
 *   7. status = Allocated ⇒ Σ alocações = valor total do custo, EXATAMENTE.
 *   8. Diferença de centavos nunca é compensada silenciosamente.
 *   9. status = Draft ⇒ pode haver valor não atribuído.
 *  10. valorNãoAtribuído = total − Σ alocações.
 *  11. Participação no consórcio nunca cria alocação automaticamente.
 *  12. EQUAL_SPLIT só quando explicitamente solicitado.
 *  13. CUSTOM_SPLIT persiste o percentual realmente utilizado.
 */

import {
  addMeasurementDecimals,
  canonicalizeMeasurementDecimal,
  subtractMeasurementDecimals,
  MeasurementDecimalQuantizationMode,
} from "../measurement-certification";
import {
  CostAllocationMethod,
  CostDataNature,
  CostEntrySourceKind,
  CostEntryStatus,
  type AllocatableCostCenter,
  type ProjectCostAllocation,
  type ProjectCostEntry,
} from "./project-cost-allocation.types";

const MONEY_SCALE = 2;
const MONEY_MODE = MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero;
export const ALLOCATION_BPS_TOTAL = 10_000;

export class CostAllocationValidationError extends Error {
  constructor(message: string) {
    super(`CostAllocationValidationError: ${message}`);
    this.name = "CostAllocationValidationError";
  }
}

export function canonMoney(decimal: string): string {
  return canonicalizeMeasurementDecimal(decimal, MONEY_SCALE, MONEY_MODE);
}

/** cents inteiros (bigint) a partir de string decimal, sem float. */
export function moneyToCents(decimal: string): bigint {
  const canon = canonMoney(decimal);
  const negative = canon.startsWith("-");
  const unsigned = negative ? canon.slice(1) : canon;
  const [intPart, fracPart = ""] = unsigned.split(".");
  const padded = (fracPart + "00").slice(0, MONEY_SCALE);
  const value = BigInt(intPart || "0") * 100n + BigInt(padded || "0");
  return negative ? -value : value;
}

/** |num| ÷ |den| × 100, duas casas, bigint. null quando den = 0. Pode passar de 100. */
export function sharePercent(numeratorDecimal: string, denominatorDecimal: string): string | null {
  const den = absBig(moneyToCents(denominatorDecimal));
  if (den === 0n) return null;
  const num = absBig(moneyToCents(numeratorDecimal));
  const basisPoints = (num * 10_000n + den / 2n) / den;
  const whole = basisPoints / 100n;
  const frac = (basisPoints % 100n).toString().padStart(2, "0");
  return `${whole.toString()}.${frac}`;
}

function absBig(v: bigint): bigint {
  return v < 0n ? -v : v;
}

// ---------------------------------------------------------------------------
// Proveniência do custo — origem vs. natureza
// ---------------------------------------------------------------------------

/**
 * `financial_categoria_id` CLASSIFICA o custo — nunca prova sua origem.
 * A proveniência é declarada em `source_kind`. Regras mínimas:
 *
 *   A. source_kind = ManualDemonstration ⇒ data_nature = Demonstrative.
 *   B. data_nature = Actual ⇒ source_kind ≠ ManualDemonstration.
 *      (A e B são contrapositivas; ambas são checadas por clareza.)
 *   C. source_kind = FinancialEntry ⇒ financial_lancamento_id ≠ null.
 *
 * As demais origens de custo real (Payroll, Document, Import, Integration,
 * ManualControlled) permanecem válidas SEM exigir financial_lancamento_id;
 * o que precisa ser explícito é a natureza da origem em `source_kind`.
 */
export function validateCostEntryProvenance(entry: ProjectCostEntry): void {
  // Regra A
  if (
    entry.sourceKind === CostEntrySourceKind.ManualDemonstration &&
    entry.dataNature !== CostDataNature.Demonstrative
  ) {
    throw new CostAllocationValidationError(
      `Custo ${entry.id}: source_kind = ManualDemonstration exige data_nature = Demonstrative.`,
    );
  }

  // Regra B
  if (
    entry.dataNature === CostDataNature.Actual &&
    entry.sourceKind === CostEntrySourceKind.ManualDemonstration
  ) {
    throw new CostAllocationValidationError(
      `Custo ${entry.id}: data_nature = Actual não pode ter source_kind = ManualDemonstration.`,
    );
  }

  // Regra C
  if (
    entry.sourceKind === CostEntrySourceKind.FinancialEntry &&
    (entry.financialLancamentoId === null || entry.financialLancamentoId === undefined)
  ) {
    throw new CostAllocationValidationError(
      `Custo ${entry.id}: source_kind = FinancialEntry exige financial_lancamento_id (a categoria financeira não prova origem).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Validação de invariantes
// ---------------------------------------------------------------------------

export interface CostAllocationInvariantReport {
  readonly entryId: string;
  readonly totalDecimal: string;
  readonly allocatedDecimal: string;
  readonly unallocatedDecimal: string;
  readonly allocationCount: number;
}

/**
 * Valida um custo + suas alocações contra TODAS as invariantes. Lança
 * `CostAllocationValidationError` na primeira violação (sem compensar
 * centavos). Retorna a reconciliação quando tudo é válido.
 */
export function validateCostEntryAllocations(
  entry: ProjectCostEntry,
  allocations: ReadonlyArray<ProjectCostAllocation>,
  costCentersById: ReadonlyMap<string, AllocatableCostCenter>,
): CostAllocationInvariantReport {
  // Invariante 1
  if (!entry.organizationId || !entry.engineeringProjectId) {
    throw new CostAllocationValidationError("Custo deve pertencer a uma empresa e uma obra.");
  }
  if (moneyToCents(entry.amountDecimal) <= 0n) {
    throw new CostAllocationValidationError(`Custo ${entry.id}: amount_decimal deve ser > 0.`);
  }

  // Proveniência: origem (source_kind) vs. natureza (data_nature).
  validateCostEntryProvenance(entry);

  const seenCostCenters = new Set<string>();

  for (const alloc of allocations) {
    if (alloc.projectCostEntryId !== entry.id) {
      throw new CostAllocationValidationError(
        `Alocação ${alloc.id} não pertence ao custo ${entry.id}.`,
      );
    }

    // Invariante 3 — sempre por id
    const center = costCentersById.get(alloc.projectCostCenterId);
    if (!center) {
      throw new CostAllocationValidationError(
        `Alocação ${alloc.id}: Centro de Custo ${alloc.projectCostCenterId} não resolvido por identidade.`,
      );
    }

    // Invariante 2 — mesma empresa e mesma obra
    if (center.organizationId !== entry.organizationId) {
      throw new CostAllocationValidationError(
        `Alocação ${alloc.id}: Centro de Custo pertence a outra empresa (${center.organizationId} ≠ ${entry.organizationId}).`,
      );
    }
    if (center.engineeringProjectId !== entry.engineeringProjectId) {
      throw new CostAllocationValidationError(
        `Alocação ${alloc.id}: Centro de Custo pertence a outra obra (${center.engineeringProjectId} ≠ ${entry.engineeringProjectId}).`,
      );
    }

    // Invariante 4
    if (moneyToCents(alloc.allocatedAmountDecimal) <= 0n) {
      throw new CostAllocationValidationError(
        `Alocação ${alloc.id}: allocated_amount_decimal deve ser > 0.`,
      );
    }

    // Invariante 5
    if (
      !Number.isInteger(alloc.allocationBasisPoints) ||
      alloc.allocationBasisPoints < 1 ||
      alloc.allocationBasisPoints > ALLOCATION_BPS_TOTAL
    ) {
      throw new CostAllocationValidationError(
        `Alocação ${alloc.id}: allocation_basis_points deve ser inteiro entre 1 e ${ALLOCATION_BPS_TOTAL}.`,
      );
    }

    // Invariante 6
    if (seenCostCenters.has(alloc.projectCostCenterId)) {
      throw new CostAllocationValidationError(
        `Custo ${entry.id}: Centro de Custo ${alloc.projectCostCenterId} aparece duas vezes na mesma despesa.`,
      );
    }
    seenCostCenters.add(alloc.projectCostCenterId);
  }

  const totalDecimal = canonMoney(entry.amountDecimal);
  const allocatedDecimal = addMeasurementDecimals(
    allocations.map((a) => a.allocatedAmountDecimal),
    MONEY_SCALE,
  );
  const unallocatedDecimal = subtractMeasurementDecimals(totalDecimal, allocatedDecimal, MONEY_SCALE);

  // Invariante 7 + 8 — Allocated exige igualdade EXATA
  if (entry.status === CostEntryStatus.Allocated) {
    if (moneyToCents(allocatedDecimal) !== moneyToCents(totalDecimal)) {
      throw new CostAllocationValidationError(
        `Custo ${entry.id} (ALLOCATED): soma das alocações (${allocatedDecimal}) ≠ valor total (${totalDecimal}). Diferença não é compensada silenciosamente.`,
      );
    }
  } else {
    // Invariante 9 — Draft nunca ultrapassa o total
    if (moneyToCents(allocatedDecimal) > moneyToCents(totalDecimal)) {
      throw new CostAllocationValidationError(
        `Custo ${entry.id} (DRAFT): soma das alocações (${allocatedDecimal}) excede o valor total (${totalDecimal}).`,
      );
    }
  }

  return {
    entryId: entry.id,
    totalDecimal,
    allocatedDecimal,
    unallocatedDecimal,
    allocationCount: allocations.length,
  };
}

// ---------------------------------------------------------------------------
// Construção de alocações a partir de INTENÇÃO explícita
// ---------------------------------------------------------------------------

export interface DirectAllocationIntent {
  readonly method: CostAllocationMethod.Direct;
  /** Valores explícitos por centro. Um único centro com 100% é o caso comum. */
  readonly amountsByCostCenterId: ReadonlyArray<{ readonly costCenterId: string; readonly amountDecimal: string }>;
}

export interface EqualSplitAllocationIntent {
  readonly method: CostAllocationMethod.EqualSplit;
  /** Centros entre os quais o custo é dividido igualmente. Solicitado explicitamente. */
  readonly costCenterIds: ReadonlyArray<string>;
}

export interface CustomSplitAllocationIntent {
  readonly method: CostAllocationMethod.CustomSplit;
  /** Percentual REALMENTE utilizado, em basis points. Σ deve ser 10000. */
  readonly basisPointsByCostCenterId: ReadonlyArray<{ readonly costCenterId: string; readonly basisPoints: number }>;
}

export type AllocationIntent =
  | DirectAllocationIntent
  | EqualSplitAllocationIntent
  | CustomSplitAllocationIntent;

export interface BuiltAllocation {
  readonly projectCostCenterId: string;
  readonly allocationMethod: CostAllocationMethod;
  readonly allocationBasisPoints: number;
  readonly allocatedAmountDecimal: string;
}

/**
 * Deriva as linhas de alocação de um custo a partir de uma intenção
 * explícita. O último centro absorve o resíduo de arredondamento para
 * que Σ seja EXATAMENTE o total (nunca distribui centavos "mágicos" —
 * o resíduo é sempre consciente e vai para uma linha só).
 */
export function buildAllocations(
  totalAmountDecimal: string,
  intent: AllocationIntent,
): ReadonlyArray<BuiltAllocation> {
  const totalCents = moneyToCents(totalAmountDecimal);
  if (totalCents <= 0n) {
    throw new CostAllocationValidationError("Valor total do custo deve ser > 0 para distribuir.");
  }

  if (intent.method === CostAllocationMethod.Direct) {
    if (intent.amountsByCostCenterId.length === 0) {
      throw new CostAllocationValidationError("DIRECT: informe ao menos um Centro de Custo com valor.");
    }
    const rows = intent.amountsByCostCenterId
      .filter((a) => moneyToCents(a.amountDecimal) > 0n)
      .map((a) => {
        const cents = moneyToCents(a.amountDecimal);
        const bps = Number((cents * BigInt(ALLOCATION_BPS_TOTAL)) / totalCents);
        return {
          projectCostCenterId: a.costCenterId,
          allocationMethod: CostAllocationMethod.Direct,
          allocationBasisPoints: Math.max(1, Math.min(ALLOCATION_BPS_TOTAL, bps)),
          allocatedAmountDecimal: canonMoney(a.amountDecimal),
        };
      });
    if (rows.length === 0) {
      throw new CostAllocationValidationError("DIRECT: nenhuma linha com valor > 0.");
    }
    return rows;
  }

  if (intent.method === CostAllocationMethod.EqualSplit) {
    const ids = intent.costCenterIds;
    if (ids.length < 2) {
      throw new CostAllocationValidationError("EQUAL_SPLIT: exige ao menos dois Centros de Custo.");
    }
    const n = BigInt(ids.length);
    const baseCents = totalCents / n;
    const remainderCents = totalCents - baseCents * n;
    const baseBps = Math.floor(ALLOCATION_BPS_TOTAL / ids.length);
    const bpsRemainder = ALLOCATION_BPS_TOTAL - baseBps * ids.length;
    return ids.map((id, index) => {
      const isLast = index === ids.length - 1;
      const cents = baseCents + (isLast ? remainderCents : 0n);
      return {
        projectCostCenterId: id,
        allocationMethod: CostAllocationMethod.EqualSplit,
        allocationBasisPoints: baseBps + (isLast ? bpsRemainder : 0),
        allocatedAmountDecimal: centsToMoney(cents),
      };
    });
  }

  // CUSTOM_SPLIT
  const entries = intent.basisPointsByCostCenterId;
  if (entries.length === 0) {
    throw new CostAllocationValidationError("CUSTOM_SPLIT: informe os percentuais por Centro de Custo.");
  }
  const bpsSum = entries.reduce((sum, e) => sum + e.basisPoints, 0);
  if (bpsSum !== ALLOCATION_BPS_TOTAL) {
    throw new CostAllocationValidationError(
      `CUSTOM_SPLIT: soma dos basis points é ${bpsSum}, deve ser ${ALLOCATION_BPS_TOTAL}.`,
    );
  }
  let assignedCents = 0n;
  return entries.map((e, index) => {
    const isLast = index === entries.length - 1;
    if (!Number.isInteger(e.basisPoints) || e.basisPoints < 1 || e.basisPoints > ALLOCATION_BPS_TOTAL) {
      throw new CostAllocationValidationError(
        `CUSTOM_SPLIT: basis points inválido (${e.basisPoints}) para Centro de Custo ${e.costCenterId}.`,
      );
    }
    const cents = isLast
      ? totalCents - assignedCents
      : (totalCents * BigInt(e.basisPoints)) / BigInt(ALLOCATION_BPS_TOTAL);
    assignedCents += cents;
    return {
      projectCostCenterId: e.costCenterId,
      allocationMethod: CostAllocationMethod.CustomSplit,
      allocationBasisPoints: e.basisPoints,
      allocatedAmountDecimal: centsToMoney(cents),
    };
  });
}

export function centsToMoney(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const digits = abs.toString().padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
