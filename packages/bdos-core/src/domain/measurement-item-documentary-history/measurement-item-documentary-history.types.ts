/**
 * Camada B (ESPECIFICAÇÃO — não materializada) — histórico documental
 * item a item das MEMÓRIAS DE CÁLCULO do Boletim de Medição.
 *
 * Cada item contratado pode ter uma aba "MEMÓRIA DE CÁLCULO" própria
 * (nome = código do item) com um bloco RESUMO. Estes campos são
 * PREENCHIDOS À MÃO e semanticamente distintos — nunca normalizar dois
 * campos diferentes só porque "parecem" iguais:
 *
 *   - `contractQuantity`         — Quantidade Contratada
 *   - `executedAccumulatedQuantity` — "Quantidade executada acumulada
 *      atual" (execução física declarada — pode divergir do medido e
 *      pode superar o contrato, com nota de replanilhamento)
 *   - `measuredAccumulatedQuantity` — "Quantidade medida acumulada em
 *      medições anteriores" (o que efetivamente entrou em BM — é este
 *      o candidato a "acumulado documental" para o Controle Gerencial)
 *   - `quantityToMeasureInPeriod` — "Quantidade a medir no período"
 *   - `contractBalanceQuantity`  — Saldo contratual
 *
 * Reconciliação: a soma item a item NÃO fecha automaticamente com o
 * acumulado físico-financeiro da obra (Curva S), que é grupo a grupo e
 * de metodologia diferente. Ver docs/MEASUREMENT_ITEM_DOCUMENTARY_HISTORY_SPEC.md.
 */

export const MEASUREMENT_ITEM_DOCUMENTARY_HISTORY_SCHEMA_VERSION = 1;

/**
 * Grão do MODELO DE OBSERVAÇÃO item × período (v2 — proposto, NÃO
 * materializado). Diferente do snapshot v1 (uma linha por item por
 * boletim): aqui uma linha por (item, período/medição, campo semântico),
 * com proveniência de célula e classificação de ambiguidade. Ver
 * documentary-history-taxonomy.ts / documentary-history-observation.ts.
 */
export const MEASUREMENT_ITEM_DOCUMENTARY_OBSERVATION_SCHEMA_VERSION = 2;

/** Taxonomia de layouts encontrados nas abas de memória. */
export type MemoriaSheetLayout =
  | "resumo_value_after_unit" // "9 MÊS" — valor antes da unidade na leitura, rótulo à esquerda
  | "resumo_value_before_unit" // "TON X KM 0" — unidade antes do valor
  | "resumo_label_bleed" // rótulo vaza para a coluna de valor
  | "resumo_with_ref_errors" // contém #REF!
  | "no_resumo_block" // aba existe mas sem bloco RESUMO reconhecível
  | "not_item_memoria"; // aba com nome de código mas sem cabeçalho "MEMÓRIA DE CÁLCULO"

export interface ParsedMemoriaResumo {
  readonly itemCode: string;
  readonly sheetName: string;
  readonly hidden: boolean;
  readonly layout: MemoriaSheetLayout;
  readonly unit: string | null;
  /**
   * Cabeçalho "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº NN - MÊS / ANO" verbatim.
   * Cada aba carrega SUA PRÓPRIA data de medição — as abas NÃO estão
   * todas no mesmo corte. `null` quando não há cabeçalho reconhecível.
   */
  readonly measurementHeaderRaw: string | null;
  /** Nº da medição da aba (1..N) extraído do cabeçalho. `null` quando ilegível. */
  readonly measurementNumber: number | null;
  /** Rótulo do mês/ano da aba ("JUNHO / 2026") verbatim do cabeçalho. `null` quando ausente. */
  readonly measurementPeriodLabel: string | null;
  /**
   * Detecção de formato numérico POR ABA — os arquivos misturam vírgula
   * decimal ("430,92") e ponto de milhar ("43.092"). `ambiguous` quando
   * a aba não fornece pista suficiente; nesse caso os campos numéricos
   * NÃO são inequívocos.
   */
  readonly numericFormatHint: "comma_decimal" | "dot_decimal" | "ambiguous";
  /** Cada campo pode faltar (null) — nunca inferido a partir de outro. */
  readonly contractQuantity: number | null;
  readonly executedAccumulatedQuantity: number | null;
  readonly measuredAccumulatedQuantity: number | null;
  readonly quantityToMeasureInPeriod: number | null;
  readonly contractBalanceQuantity: number | null;
  /** true quando os 3 campos decisórios (contratada, medida acumulada, a medir) foram lidos de forma inequívoca. */
  readonly unambiguous: boolean;
  /** Notas livres coladas no bloco (P.S., replanilhamento) — evidência, nunca dado. */
  readonly freeformNotes: ReadonlyArray<string>;
  /** Série "PERÍODO | QUANTIDADE" quando existir na aba (datas em ISO). */
  readonly periodSeries: ReadonlyArray<{ readonly date: string | null; readonly rawPeriod: string; readonly quantity: number | null }>;
}

export interface MemoriaExtractionResult {
  readonly sourceFileName: string;
  readonly totalCodeSheets: number;
  readonly parsed: ReadonlyArray<ParsedMemoriaResumo>;
  readonly layoutCounts: Readonly<Record<MemoriaSheetLayout, number>>;
  readonly unambiguousCount: number;
  /** Códigos de itens contratados SEM aba de memória correspondente. Preenchido pelo chamador que conhece a base contratual. */
  readonly codesWithoutMemoria: ReadonlyArray<string>;
}

/** Grão canônico de persistência PROPOSTO (Camada B) — item × campo × valor + proveniência. NÃO materializado. */
export interface MeasurementItemDocumentaryHistoryRecordProposal {
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly managedServiceItemId: string;
  readonly measurementBulletinImportId: string;
  readonly itemCode: string;
  readonly unit: string | null;
  readonly contractQuantityDecimal: string | null;
  readonly executedAccumulatedQuantityDecimal: string | null;
  readonly measuredAccumulatedQuantityDecimal: string | null;
  readonly quantityToMeasureInPeriodDecimal: string | null;
  readonly contractBalanceQuantityDecimal: string | null;
  readonly layout: MemoriaSheetLayout;
  readonly unambiguous: boolean;
  readonly sourceSheetName: string;
  readonly sourceFileName: string;
}
