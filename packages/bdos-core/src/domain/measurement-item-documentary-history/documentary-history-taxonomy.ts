import type { ParsedMemoriaResumo } from "./measurement-item-documentary-history.types";

/**
 * TAXONOMIA DOCUMENTAL (Camada B) — antes de extrair qualquer valor
 * para saldo gerencial, cada campo encontrado nas memórias de cálculo é
 * classificado SEMANTICAMENTE. Nunca assumir equivalência entre estes
 * conceitos: "executada" ≠ "medida", "no período" ≠ "acumulada",
 * "física" ≠ "financeira". Quando o documento não permite determinar o
 * campo, ele é `ambiguous` e NÃO entra em reconciliação nem em saldo.
 */

export type DocumentarySemanticField =
  | "contract_quantity"
  | "executed_accumulated_quantity" // execução física declarada — pode divergir da medida e superar o contrato
  | "measured_accumulated_quantity_prior" // medida acumulada "em medições anteriores" (relativo ao Nº da MEDIÇÃO da própria aba)
  | "quantity_to_measure_in_period" // do período da PRÓPRIA aba (heterogêneo entre abas: MED-01..MED-08)
  | "contract_balance_quantity"
  | "monthly_series_quantity" // grade "PERÍODO | QUANTIDADE" (rara: ~2/177)
  | "ambiguous";

export type DocumentaryScope = "period" | "accumulated_prior" | "contract" | "balance" | "unknown";

export interface DocumentaryFieldObservation {
  readonly itemCode: string;
  readonly sheetName: string;
  readonly semanticField: DocumentarySemanticField;
  readonly scope: DocumentaryScope;
  /**
   * Nº da MEDIÇÃO ao qual o campo se refere. Para
   * `quantity_to_measure_in_period` é o Nº da própria aba; para
   * `measured_accumulated_quantity_prior` é (Nº da aba − 1). `null`
   * quando a aba não traz cabeçalho de medição legível.
   */
  readonly measurementRef: number | null;
  readonly measurementPeriodLabel: string | null;
  /** Quantidade documental EXATA como string decimal. `null` = ausência documental (nunca 0). */
  readonly quantityDecimal: string | null;
  readonly unit: string | null;
  readonly isUnambiguous: boolean;
  readonly reasonIfAmbiguous: string | null;
  /** true quando o valor foi DERIVADO (ex.: diferença de acumulados), nunca lido direto. */
  readonly derivedFromCumulative: boolean;
  readonly sourceCells: ReadonlyArray<string>;
}

const NUMBER_SANITY = /^-?\d+(\.\d+)?$/;

function toDecimalString(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  // Representação decimal exata do número lido — NUNCA arredonda aqui;
  // a canonicalização à escala do item acontece na fronteira de escrita.
  const asString = Number.isInteger(value) ? value.toString() : value.toPrecision(15).replace(/\.?0+$/, "");
  return NUMBER_SANITY.test(asString) ? asString : String(value);
}

/**
 * Classifica os campos do bloco RESUMO de UMA aba de memória em
 * observações semânticas. A ambiguidade do parser (layout / formato
 * numérico) é propagada campo a campo — um layout `label_bleed` ou
 * formato `ambiguous` marca TODOS os campos daquela aba como não
 * inequívocos, com motivo explícito.
 */
export function classifyMemoriaResumo(parsed: ParsedMemoriaResumo): ReadonlyArray<DocumentaryFieldObservation> {
  const sheetAmbiguityReason =
    parsed.layout === "resumo_with_ref_errors"
      ? "aba com #REF! — bloco RESUMO não confiável"
      : parsed.layout === "resumo_label_bleed"
        ? "rótulo vaza para a coluna de valor (label bleed) — leitura não confiável sem inspeção"
        : parsed.layout === "no_resumo_block"
          ? "aba sem bloco RESUMO reconhecível"
          : parsed.layout === "not_item_memoria"
            ? "aba sem cabeçalho MEMÓRIA DE CÁLCULO"
            : parsed.numericFormatHint === "ambiguous"
              ? "formato numérico da aba não decidível (vírgula decimal × ponto de milhar)"
              : null;

  const base = {
    itemCode: parsed.itemCode,
    sheetName: parsed.sheetName,
    measurementPeriodLabel: parsed.measurementPeriodLabel,
    unit: parsed.unit
  };

  const make = (
    semanticField: DocumentarySemanticField,
    scope: DocumentaryScope,
    measurementRef: number | null,
    value: number | null,
    sourceCells: ReadonlyArray<string>
  ): DocumentaryFieldObservation => ({
    ...base,
    semanticField,
    scope,
    measurementRef,
    quantityDecimal: toDecimalString(value),
    isUnambiguous: sheetAmbiguityReason === null && value !== null,
    reasonIfAmbiguous: sheetAmbiguityReason ?? (value === null ? "campo ausente na aba" : null),
    derivedFromCumulative: false,
    sourceCells
  });

  const meas = parsed.measurementNumber;
  const observations: DocumentaryFieldObservation[] = [
    make("contract_quantity", "contract", meas, parsed.contractQuantity, [`${parsed.sheetName}!RESUMO/Quantidade Contratada`]),
    make(
      "executed_accumulated_quantity",
      "accumulated_prior",
      meas,
      parsed.executedAccumulatedQuantity,
      [`${parsed.sheetName}!RESUMO/Quantidade executada acumulada`]
    ),
    make(
      "measured_accumulated_quantity_prior",
      "accumulated_prior",
      meas === null ? null : meas - 1,
      parsed.measuredAccumulatedQuantity,
      [`${parsed.sheetName}!RESUMO/Quantidade medida acumulada em medições anteriores`]
    ),
    make(
      "quantity_to_measure_in_period",
      "period",
      meas,
      parsed.quantityToMeasureInPeriod,
      [`${parsed.sheetName}!RESUMO/Quantidade a medir no período`]
    ),
    make("contract_balance_quantity", "balance", meas, parsed.contractBalanceQuantity, [`${parsed.sheetName}!RESUMO/Saldo contratual`])
  ];

  for (const point of parsed.periodSeries) {
    observations.push({
      ...base,
      semanticField: "monthly_series_quantity",
      scope: "period",
      measurementRef: null,
      quantityDecimal: toDecimalString(point.quantity),
      isUnambiguous: sheetAmbiguityReason === null && point.quantity !== null && point.date !== null,
      reasonIfAmbiguous:
        point.date === null
          ? "linha da grade PERÍODO|QUANTIDADE sem data resolvível"
          : point.quantity === null
            ? "linha da grade sem quantidade"
            : sheetAmbiguityReason,
      derivedFromCumulative: false,
      sourceCells: [`${parsed.sheetName}!PERÍODO=${point.rawPeriod}`]
    });
  }

  return observations;
}

/** Rótulo → nº de MED-NN. "JUNHO / 2026" -> 8 nesta obra? Não — o vínculo mês↔MED é por aba, nunca inferido do texto do mês. Helper só normaliza o rótulo. */
export function normalizeMeasurementPeriodLabel(raw: string | null): string | null {
  if (raw === null) return null;
  const match = /([A-Za-zÀ-ú]{3,10})\s*\/\s*(\d{4})/.exec(raw);
  return match ? `${match[1].toUpperCase()}/${match[2]}` : raw.trim().toUpperCase();
}
