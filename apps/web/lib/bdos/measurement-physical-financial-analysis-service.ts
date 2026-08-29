/**
 * "Revisar medição" — análise FÍSICO-FINANCEIRA determinística sobre o
 * Cronograma Físico-Financeiro oficial (DNOCS) já persistido como
 * Planning Dataset. Função pura, sem I/O: recebe o `PlanningDataset`
 * (JSON verbatim da Camada 2) + o período da medição + os códigos dos
 * itens medidos, e projeta:
 *
 *   - a situação físico-financeira da OBRA no período (da série
 *     agregada da Curva S — pontos ACUMULADOS, verbatim da planilha);
 *   - a situação de cada GRUPO do cronograma (1.0 … 11.0) no período
 *     (das séries mensais por grupo — schema v2 do Planning Dataset —,
 *     com o acumulado derivado por SOMA DECIMAL EXATA, nunca float);
 *   - a correlação determinística item → grupo por prefixo hierárquico
 *     de código (`01.xx.xx` → `1.0`), sem fuzzy, sem casar por texto.
 *
 * NUNCA infere planejado acumulado de grupo a partir do BAC, do
 * percentual físico final, nem de qualquer aproximação — só soma as
 * células mensais PREVISTO realmente existentes. Fonte insuficiente
 * (dataset v1 sem série por grupo, período ausente na planilha, tipo
 * de dataset errado) degrada para "indisponível" com motivo explícito,
 * nunca para um número inventado.
 *
 * Realizado aqui = o declarado na Curva S importada (fonte documental
 * daquele arquivo). NÃO é o acumulado de medições/certificações do
 * BDOS — essa reconciliação é uma camada gerencial própria, item a
 * item, alimentada pelo histórico de medições, e não se mistura com o
 * cronograma oficial Obra + Grupo.
 */

import type { PlanningDataset } from "@bba/bdos-core/domain/schedule-management";
import {
  addMeasurementDecimals,
  calculateMeasurementLineValue,
  canonicalizeMeasurementDecimal,
  subtractMeasurementDecimals,
  MeasurementDecimalQuantizationMode
} from "@bba/bdos-core/domain/measurement-certification";

const MONEY_SCALE = 2;
const PERCENT_POINT_SCALE = 2;
const PERCENT_POINT_POLICY = {
  key: "PP",
  scale: PERCENT_POINT_SCALE,
  quantizationMode: MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero
};

/**
 * realizado > planejado → acima; iguais → no previsto; realizado <
 * planejado → abaixo; planejado e realizado ambos zerados até o corte →
 * "sem programação até o período" (nada estava previsto ainda, então
 * "no previsto" induziria leitura errada). Vocabulário deliberadamente
 * sem conotação temporal: a fonte não traz datas/durações por grupo.
 */
export type PhysicalFinancialSituation = "above_planned" | "on_planned" | "below_planned" | "not_scheduled";

export interface PhysicalFinancialObraReading {
  readonly periodLabel: string;
  readonly periodDate: string;
  readonly plannedAccumulatedValueDecimal: string;
  readonly actualAccumulatedValueDecimal: string;
  /** realizado − planejado (negativo = abaixo do previsto). */
  readonly deviationValueDecimal: string;
  readonly plannedAccumulatedPercent: string | null;
  readonly actualAccumulatedPercent: string | null;
  /** realizado% − planejado%, em pontos percentuais (negativo = abaixo). */
  readonly deviationPercentPoints: string | null;
  readonly situation: PhysicalFinancialSituation;
}

export interface PhysicalFinancialGroupReading {
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
  /** |desvio do grupo| ÷ |desvio líquido da obra|, em % -- null quando o desvio líquido da obra é zero. */
  readonly sharePercent: string | null;
  readonly situation: PhysicalFinancialSituation;
}

/** Linhas não operacionais do cronograma (ajustes financeiros/documentais). Nunca são grupos físicos, nunca recebem itens de execução. */
export interface PhysicalFinancialAdjustmentRow {
  readonly code: string;
  readonly name: string;
}

/**
 * Leitura gerencial derivada DETERMINISTICAMENTE dos grupos já
 * calculados -- só rankeia e soma o que já existe; nunca reclassifica,
 * nunca imputa causa ou responsabilidade operacional -- a fonte
 * comprova o DESVIO físico-financeiro, não a causalidade.
 */
export interface PhysicalFinancialGroupImpact {
  readonly groupCode: string;
  readonly groupName: string;
  readonly plannedAccumulatedValueDecimal: string;
  readonly actualAccumulatedValueDecimal: string;
  readonly deviationValueDecimal: string;
  readonly deviationPercentPoints: string | null;
  /** |desvio do grupo| ÷ |desvio líquido da obra|, em % -- null quando o desvio líquido é zero. */
  readonly sharePercent: string | null;
}

export interface PhysicalFinancialManagementSummary {
  readonly headline: {
    readonly direction: "below" | "above" | "on";
    /** |desvio da obra| em decimal canônico -- a magnitude a exibir. */
    readonly magnitudeValueDecimal: string;
    readonly plannedPercent: string | null;
    readonly actualPercent: string | null;
    readonly deviationPercentPoints: string | null;
  };
  /** Grupo com o maior desvio financeiro NEGATIVO absoluto acumulado. null quando nenhum grupo está abaixo do previsto. */
  readonly principalNegativeImpact: PhysicalFinancialGroupImpact | null;
  /** Concentração do desvio nos maiores grupos negativos (até 3). null quando nenhum grupo está abaixo do previsto. */
  readonly concentration: {
    readonly groups: ReadonlyArray<{ readonly groupCode: string; readonly groupName: string; readonly deviationValueDecimal: string }>;
    readonly combinedAbsDeviationDecimal: string;
    readonly obraNetAbsDeviationDecimal: string;
    readonly sharePercent: string | null;
  } | null;
  /** Maior desvio financeiro POSITIVO absoluto acumulado (execução acima do previsto -- nunca "ganho"/"economia"). null quando nenhum grupo está acima do previsto. */
  readonly positiveCounterpoint: PhysicalFinancialGroupImpact | null;
}

export interface MeasurementPhysicalFinancialAnalysis {
  readonly obraAvailable: boolean;
  readonly obraUnavailableReason: string | null;
  readonly groupsAvailable: boolean;
  readonly groupsUnavailableReason: string | null;
  readonly sourceFileName: string | null;
  readonly sourceSheetName: string | null;
  readonly datasetId: string | null;
  readonly period: { readonly label: string; readonly date: string } | null;
  readonly obra: PhysicalFinancialObraReading | null;
  readonly groups: ReadonlyArray<PhysicalFinancialGroupReading>;
  readonly adjustments: ReadonlyArray<PhysicalFinancialAdjustmentRow>;
  /** Leitura gerencial (headline, principal impacto, concentração, contraponto positivo). null quando não há obra/grupos. */
  readonly management: PhysicalFinancialManagementSummary | null;
  /** código do item medido (execução) → código do grupo do cronograma ("1.0"). Só entra quem resolve para um grupo REAL existente. */
  readonly itemGroupByCode: ReadonlyMap<string, string>;
}

export interface MeasurementPhysicalFinancialAnalysisInput {
  /** `dataset` (JSONB verbatim) da linha escolhida de `planning_datasets`. null quando o projeto não tem físico-financeiro consolidado. */
  readonly planningDataset: PlanningDataset | null;
  readonly datasetId: string | null;
  readonly sourceFileName: string | null;
  /** Período da medição — usado só para localizar o mês correspondente na planilha (casamento por ano-mês da data de fim). */
  readonly measurementPeriod: { readonly startDate: string; readonly endDate: string };
  readonly measuredItemCodes: ReadonlyArray<string>;
}

const GROUP_CODE_PATTERN = /^\d+\.0$/;

// -------------------------------------------------------------------
// Seleção determinística entre importações concorrentes do mesmo
// cronograma físico-financeiro (item 1 da especificação).
// -------------------------------------------------------------------

export interface PhysicalFinancialDatasetCandidateInput {
  readonly id: string;
  /** `planning_datasets.dataset_schema_version` -- a maior versão disponível vence. */
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly fileName: string | null;
  /** `planning_datasets.dataset` verbatim (JSONB). Forma não validada. */
  readonly dataset: unknown;
}

export interface SelectedPhysicalFinancialDataset {
  readonly id: string;
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly fileName: string | null;
  readonly dataset: PlanningDataset;
}

export type PhysicalFinancialDatasetSelection =
  | { readonly outcome: "selected"; readonly selected: SelectedPhysicalFinancialDataset; readonly candidateCount: number }
  | { readonly outcome: "none" }
  | { readonly outcome: "divergent"; readonly reason: string };

/**
 * Regra de seleção (ordem estrita):
 *   1. Só linhas `fisico-financeiro`.
 *   2. A MAIOR `schemaVersion` disponível vence -- versões anteriores
 *      (ex.: v1 sem série por grupo) são descartadas por completo, nunca
 *      entram na comparação nem no resultado.
 *   3. Dentro da versão vencedora, agrupa por LINHAGEM (arquivo-fonte,
 *      `origin.fileName`). Vence a linhagem com o `created_at` mais
 *      recente -- linhagens diferentes são documentos diferentes, não
 *      "divergência".
 *   4. Dentro dessa versão + linhagem: se houver mais de um candidato e
 *      as impressões digitais ESTRUTURAIS divergirem, não escolhe nada
 *      -- devolve `divergent`. Caso contrário, usa o mais recente.
 *
 * A impressão digital ignora `origin.importedAt`, então dois imports do
 * mesmo arquivo em horários diferentes NÃO contam como divergência.
 */
export function selectConsolidatedPhysicalFinancialDataset(
  candidates: ReadonlyArray<PhysicalFinancialDatasetCandidateInput>
): PhysicalFinancialDatasetSelection {
  const parsed = candidates
    .map((candidate) => ({ candidate, dataset: asPlanningDatasetOrNull(candidate.dataset) }))
    .filter((entry): entry is { candidate: PhysicalFinancialDatasetCandidateInput; dataset: PlanningDataset } => entry.dataset !== null)
    .filter((entry) => entry.dataset.detectedType === "fisico-financeiro");

  if (parsed.length === 0) {
    return { outcome: "none" };
  }

  const maxVersion = Math.max(...parsed.map((entry) => entry.candidate.schemaVersion));
  const winningVersion = parsed.filter((entry) => entry.candidate.schemaVersion === maxVersion);

  const lineageKey = (dataset: PlanningDataset): string => (dataset.origin.fileName ?? "").trim().toLowerCase();
  const lineages = new Map<string, typeof winningVersion>();
  for (const entry of winningVersion) {
    const key = lineageKey(entry.dataset);
    const bucket = lineages.get(key) ?? [];
    bucket.push(entry);
    lineages.set(key, bucket);
  }

  const winningLineage = [...lineages.values()].sort(
    (a, b) => compareIsoDesc(mostRecentCreatedAt(a), mostRecentCreatedAt(b))
  )[0];

  const fingerprints = new Set(winningLineage.map((entry) => physicalFinancialFingerprint(entry.dataset)));
  if (fingerprints.size > 1) {
    return {
      outcome: "divergent",
      reason:
        "Há mais de um cronograma físico-financeiro consolidado (mesma versão e mesmo arquivo-fonte) com diferenças materiais entre si. Consolide a fonte antes de comparar a medição ao planejamento."
    };
  }

  const mostRecent = [...winningLineage].sort((a, b) => compareIsoDesc(a.candidate.createdAt, b.candidate.createdAt))[0];
  return {
    outcome: "selected",
    candidateCount: winningLineage.length,
    selected: {
      id: mostRecent.candidate.id,
      schemaVersion: mostRecent.candidate.schemaVersion,
      createdAt: mostRecent.candidate.createdAt,
      fileName: mostRecent.candidate.fileName,
      dataset: mostRecent.dataset
    }
  };
}

function mostRecentCreatedAt(entries: ReadonlyArray<{ readonly candidate: PhysicalFinancialDatasetCandidateInput }>): string {
  return [...entries].map((entry) => entry.candidate.createdAt).sort(compareIsoDesc)[0] ?? "";
}

/** Impressão digital estrutural: quantidade de atividades + soma canônica de planejado/realizado + a série agregada por ponto datado. Dois datasets com a mesma impressão são tratados como equivalentes. */
function physicalFinancialFingerprint(dataset: PlanningDataset): string {
  const activityPart = dataset.activities
    .map((activity) => `${activity.code}|${canonicalOrNull(activity.plannedValue) ?? "-"}|${canonicalOrNull(activity.actualValue) ?? "-"}`)
    .sort()
    .join(";");

  const aggregate = dataset.periodSeries.find((series) => series.activityId === null);
  const aggregatePart = aggregate
    ? aggregate.points
        .filter((point) => point.date !== null)
        .map(
          (point) =>
            `${point.date}|${canonicalOrNull(point.plannedValue) ?? "-"}|${canonicalOrNull(point.actualValue) ?? "-"}`
        )
        .join(";")
    : "";

  return `${dataset.activities.length}#${activityPart}#${aggregatePart}`;
}

function compareIsoDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

/** Guarda estrutural mínima: aceita ou rejeita a forma de `PlanningDataset`, nunca normaliza. */
export function asPlanningDatasetOrNull(value: unknown): PlanningDataset | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.detectedType !== "string") return null;
  if (!Array.isArray(candidate.activities)) return null;
  if (!Array.isArray(candidate.periodSeries)) return null;
  if (typeof candidate.origin !== "object" || candidate.origin === null) return null;
  return value as PlanningDataset;
}

const EMPTY_ANALYSIS = (
  overrides: Partial<MeasurementPhysicalFinancialAnalysis>
): MeasurementPhysicalFinancialAnalysis => ({
  obraAvailable: false,
  obraUnavailableReason: null,
  groupsAvailable: false,
  groupsUnavailableReason: null,
  sourceFileName: null,
  sourceSheetName: null,
  datasetId: null,
  period: null,
  obra: null,
  groups: [],
  adjustments: [],
  management: null,
  itemGroupByCode: new Map(),
  ...overrides
});

export function buildMeasurementPhysicalFinancialAnalysis(
  input: MeasurementPhysicalFinancialAnalysisInput
): MeasurementPhysicalFinancialAnalysis {
  const dataset = input.planningDataset;

  if (!dataset || dataset.detectedType !== "fisico-financeiro") {
    return EMPTY_ANALYSIS({
      obraUnavailableReason: "Ainda não há um cronograma físico-financeiro consolidado importado para esta obra.",
      groupsUnavailableReason: "Ainda não há um cronograma físico-financeiro consolidado importado para esta obra.",
      datasetId: input.datasetId,
      sourceFileName: input.sourceFileName
    });
  }

  const sourceSheetName = dataset.origin.sheetName;
  const aggregateSeries = dataset.periodSeries.find((series) => series.activityId === null) ?? null;
  const targetYearMonth = toYearMonth(input.measurementPeriod.endDate) ?? toYearMonth(input.measurementPeriod.startDate);

  const targetIndex =
    aggregateSeries && targetYearMonth !== null
      ? aggregateSeries.points.findIndex((point) => point.date !== null && toYearMonth(point.date) === targetYearMonth)
      : -1;

  if (!aggregateSeries || targetIndex < 0) {
    return EMPTY_ANALYSIS({
      obraUnavailableReason: "O período desta medição não foi localizado no cronograma físico-financeiro consolidado.",
      groupsUnavailableReason: "O período desta medição não foi localizado no cronograma físico-financeiro consolidado.",
      datasetId: input.datasetId,
      sourceFileName: input.sourceFileName,
      sourceSheetName
    });
  }

  const targetPoint = aggregateSeries.points[targetIndex];
  const period = { label: targetPoint.period, date: targetPoint.date as string };

  const obra = buildObraReading(targetPoint);

  // --- Grupos (schema v2: uma série mensal por atividade de grupo) ---
  const activityById = new Map(dataset.activities.map((activity) => [activity.id, activity]));
  const groupSeries = dataset.periodSeries.filter((series) => series.activityId !== null);

  const groups: PhysicalFinancialGroupReading[] = [];
  for (const series of groupSeries) {
    const activity = series.activityId ? activityById.get(series.activityId) : undefined;
    if (!activity || !GROUP_CODE_PATTERN.test(activity.code)) {
      continue;
    }
    if (series.points.length <= targetIndex) {
      continue;
    }
    groups.push(buildGroupReading(activity.code, activity.name, series.points.slice(0, targetIndex + 1), obra));
  }
  groups.sort((a, b) => groupSortKey(a.groupCode) - groupSortKey(b.groupCode));

  const adjustments: PhysicalFinancialAdjustmentRow[] = dataset.activities
    .filter((activity) => !GROUP_CODE_PATTERN.test(activity.code))
    .map((activity) => ({ code: activity.code, name: activity.name }));

  const groupsAvailable = groups.length > 0;
  const groupsUnavailableReason = groupsAvailable
    ? null
    : "O cronograma físico-financeiro consolidado ainda não traz o detalhamento mensal por grupo.";

  const knownGroupCodes = new Set(groups.map((group) => group.groupCode));
  const itemGroupByCode = new Map<string, string>();
  for (const rawCode of input.measuredItemCodes) {
    const groupCode = resolveGroupCode(rawCode);
    if (groupCode !== null && knownGroupCodes.has(groupCode)) {
      itemGroupByCode.set(rawCode, groupCode);
    }
  }

  return {
    obraAvailable: true,
    obraUnavailableReason: null,
    groupsAvailable,
    groupsUnavailableReason,
    sourceFileName: input.sourceFileName ?? dataset.origin.fileName,
    sourceSheetName,
    datasetId: input.datasetId,
    period,
    obra,
    groups,
    adjustments,
    management: buildManagementSummary(obra, groups),
    itemGroupByCode
  };
}

// ===================================================================
// HISTÓRICO DA EXECUÇÃO (OBRA × MÊS e GRUPO × MÊS) — Parte A.
//
// Mesma fonte e mesmas primitivas de `buildMeasurementPhysicalFinancialAnalysis`
// (série agregada da Curva S + séries mensais por grupo do Planning
// Dataset consolidado). A diferença é o eixo: aqui devolvemos a série
// INTEIRA (todos os períodos canônicos), não só o mês da medição atual.
// A Curva S é a espinha dorsal histórica da OBRA e dos GRUPOS; ela NÃO
// substitui o histórico item a item (Camada B). Nenhum cálculo novo:
// planejado/realizado no período da OBRA saem por SUBTRAÇÃO DECIMAL
// EXATA de acumulados consecutivos (a série agregada só traz acumulado);
// os do GRUPO já são mensais na planilha e o acumulado é a soma decimal
// de `points[0..i]`. Nada de float, nada de UI.
// ===================================================================

export interface PhysicalFinancialHistoryPoint {
  readonly periodLabel: string;
  readonly periodDate: string;
  readonly plannedPeriodValueDecimal: string;
  /** null quando a Curva S ainda não traz realização para o período (mês futuro) — nunca 0, nunca negativo. */
  readonly actualPeriodValueDecimal: string | null;
  readonly plannedAccumulatedValueDecimal: string;
  /** null quando não há acumulado realizado documentado para o período. */
  readonly actualAccumulatedValueDecimal: string | null;
  readonly plannedAccumulatedPercent: string | null;
  readonly actualAccumulatedPercent: string | null;
  /** realizado acumulado − planejado acumulado (negativo = abaixo do previsto). null quando não há realização documentada. */
  readonly deviationAccumulatedValueDecimal: string | null;
  readonly deviationAccumulatedPercentPoints: string | null;
  /** null quando não há realização documentada no período para comparar. */
  readonly situation: PhysicalFinancialSituation | null;
}

export interface PhysicalFinancialGroupHistory {
  readonly groupCode: string;
  readonly groupName: string;
  readonly points: ReadonlyArray<PhysicalFinancialHistoryPoint>;
}

export interface PhysicalFinancialExecutionHistory {
  readonly available: boolean;
  readonly unavailableReason: string | null;
  readonly sourceFileName: string | null;
  readonly sourceSheetName: string | null;
  readonly datasetId: string | null;
  readonly periods: ReadonlyArray<{ readonly label: string; readonly date: string }>;
  readonly obra: ReadonlyArray<PhysicalFinancialHistoryPoint>;
  readonly groups: ReadonlyArray<PhysicalFinancialGroupHistory>;
}

export interface PhysicalFinancialExecutionHistoryInput {
  readonly planningDataset: PlanningDataset | null;
  readonly datasetId: string | null;
  readonly sourceFileName: string | null;
}

const EMPTY_HISTORY = (overrides: Partial<PhysicalFinancialExecutionHistory>): PhysicalFinancialExecutionHistory => ({
  available: false,
  unavailableReason: null,
  sourceFileName: null,
  sourceSheetName: null,
  datasetId: null,
  periods: [],
  obra: [],
  groups: [],
  ...overrides
});

export function buildPhysicalFinancialExecutionHistory(
  input: PhysicalFinancialExecutionHistoryInput
): PhysicalFinancialExecutionHistory {
  const dataset = input.planningDataset;
  if (!dataset || dataset.detectedType !== "fisico-financeiro") {
    return EMPTY_HISTORY({
      unavailableReason: "Ainda não há um cronograma físico-financeiro consolidado importado para esta obra.",
      datasetId: input.datasetId,
      sourceFileName: input.sourceFileName
    });
  }

  const aggregateSeries = dataset.periodSeries.find((series) => series.activityId === null) ?? null;
  const datedPoints = (aggregateSeries?.points ?? []).filter((point) => point.date !== null);
  if (!aggregateSeries || datedPoints.length === 0) {
    return EMPTY_HISTORY({
      unavailableReason: "O cronograma físico-financeiro consolidado ainda não traz a série histórica mensal da obra.",
      datasetId: input.datasetId,
      sourceFileName: input.sourceFileName,
      sourceSheetName: dataset.origin.sheetName
    });
  }

  const periods = datedPoints.map((point) => ({ label: point.period, date: point.date as string }));

  // OBRA: os pontos são ACUMULADOS. planejado/realizado NO PERÍODO =
  // acumulado_i − acumulado_{i-1} (subtração decimal exata; acumulado
  // "anterior" ao primeiro ponto é 0).
  const obra: PhysicalFinancialHistoryPoint[] = datedPoints.map((point, index) => {
    const previous = index > 0 ? datedPoints[index - 1] : null;
    const plannedAccumulatedValueDecimal = canonicalOrNull(point.plannedValue) ?? "0.00";
    const prevPlannedAccumulated = previous ? canonicalOrNull(previous.plannedValue) ?? "0.00" : "0.00";
    const plannedPeriodValueDecimal = subtractMeasurementDecimals(plannedAccumulatedValueDecimal, prevPlannedAccumulated, MONEY_SCALE);

    // Realizado: a célula "...ACUMULADO..." pode estar VAZIA num mês
    // ainda não realizado (ex.: mês final do cronograma com a medição
    // do período ainda em aberto). Vazio = SEM DADO -> null em tudo que
    // depende de realização; nunca 0, nunca acumulado_anterior negativo.
    const actualAccumulatedRaw = canonicalOrNull(point.actualValue);
    const prevActualAccumulatedRaw = previous ? canonicalOrNull(previous.actualValue) : null;
    const actualAccumulatedValueDecimal = actualAccumulatedRaw;
    const actualPeriodValueDecimal =
      actualAccumulatedRaw !== null
        ? subtractMeasurementDecimals(actualAccumulatedRaw, prevActualAccumulatedRaw ?? "0.00", MONEY_SCALE)
        : null;

    const plannedAccumulatedPercent = fractionToPercentPoints(point.plannedPercent);
    const actualAccumulatedPercent = fractionToPercentPoints(point.actualPercent);
    const deviationAccumulatedValueDecimal =
      actualAccumulatedRaw !== null
        ? subtractMeasurementDecimals(actualAccumulatedRaw, plannedAccumulatedValueDecimal, MONEY_SCALE)
        : null;
    const deviationAccumulatedPercentPoints =
      plannedAccumulatedPercent !== null && actualAccumulatedPercent !== null
        ? subtractMeasurementDecimals(actualAccumulatedPercent, plannedAccumulatedPercent, PERCENT_POINT_SCALE)
        : null;

    return {
      periodLabel: point.period,
      periodDate: point.date as string,
      plannedPeriodValueDecimal,
      actualPeriodValueDecimal,
      plannedAccumulatedValueDecimal,
      actualAccumulatedValueDecimal,
      plannedAccumulatedPercent,
      actualAccumulatedPercent,
      deviationAccumulatedValueDecimal,
      deviationAccumulatedPercentPoints,
      situation:
        deviationAccumulatedValueDecimal === null
          ? null
          : classifySituation(deviationAccumulatedPercentPoints, deviationAccumulatedValueDecimal)
    };
  });

  // GRUPOS: pontos MENSAIS. Acumulado = soma decimal de points[0..i].
  const activityById = new Map(dataset.activities.map((activity) => [activity.id, activity]));
  const groupHistories: PhysicalFinancialGroupHistory[] = [];
  for (const series of dataset.periodSeries) {
    if (series.activityId === null) continue;
    const activity = activityById.get(series.activityId);
    if (!activity || !GROUP_CODE_PATTERN.test(activity.code)) continue;

    const points: PhysicalFinancialHistoryPoint[] = [];
    const upperBound = Math.min(series.points.length, datedPoints.length);
    for (let index = 0; index < upperBound; index++) {
      const monthly = series.points[index];
      const window = series.points.slice(0, index + 1);
      const plannedPeriodValueDecimal = canonicalOrNull(monthly.plannedValue ?? null) ?? "0.00";
      const plannedAccumulatedValueDecimal = sumValues(window.map((wp) => wp.plannedValue));
      const plannedAccumulatedPercent = sumFractionsToPercentPoints(window.map((wp) => wp.plannedPercent));

      // MESMA SEMÂNTICA DA OBRA: se o PERÍODO CORRENTE do grupo não tem
      // realização documentada (`monthly.actualValue` vazio), então TUDO
      // que depende de realizado fica null — nunca 0, e nunca carregar o
      // acumulado dos meses anteriores como se fosse a posição
      // documental deste mês. O planejado segue disponível.
      const hasActualThisPeriod = monthly.actualValue !== null && Number.isFinite(monthly.actualValue);
      const actualPeriodValueDecimal = hasActualThisPeriod
        ? canonicalOrNull(monthly.actualValue ?? null)
        : null;
      const actualAccumulatedValueDecimal = hasActualThisPeriod
        ? sumValues(window.map((wp) => wp.actualValue))
        : null;
      const actualAccumulatedPercent = hasActualThisPeriod
        ? sumFractionsToPercentPoints(window.map((wp) => wp.actualPercent))
        : null;
      const deviationAccumulatedValueDecimal =
        actualAccumulatedValueDecimal !== null
          ? subtractMeasurementDecimals(actualAccumulatedValueDecimal, plannedAccumulatedValueDecimal, MONEY_SCALE)
          : null;
      const deviationAccumulatedPercentPoints =
        actualAccumulatedPercent !== null && plannedAccumulatedPercent !== null
          ? subtractMeasurementDecimals(actualAccumulatedPercent, plannedAccumulatedPercent, PERCENT_POINT_SCALE)
          : null;
      const nothingScheduled =
        isCanonicalZero(plannedAccumulatedValueDecimal) &&
        (actualAccumulatedValueDecimal === null || isCanonicalZero(actualAccumulatedValueDecimal));

      points.push({
        periodLabel: datedPoints[index].period,
        periodDate: datedPoints[index].date as string,
        plannedPeriodValueDecimal,
        actualPeriodValueDecimal,
        plannedAccumulatedValueDecimal,
        actualAccumulatedValueDecimal,
        plannedAccumulatedPercent,
        actualAccumulatedPercent,
        deviationAccumulatedValueDecimal,
        deviationAccumulatedPercentPoints,
        situation:
          deviationAccumulatedValueDecimal === null
            ? null
            : nothingScheduled
              ? "not_scheduled"
              : classifySituation(deviationAccumulatedPercentPoints, deviationAccumulatedValueDecimal)
      });
    }
    groupHistories.push({ groupCode: activity.code, groupName: activity.name, points });
  }
  groupHistories.sort((a, b) => groupSortKey(a.groupCode) - groupSortKey(b.groupCode));

  return {
    available: true,
    unavailableReason: null,
    sourceFileName: input.sourceFileName ?? dataset.origin.fileName,
    sourceSheetName: dataset.origin.sheetName,
    datasetId: input.datasetId,
    periods,
    obra,
    groups: groupHistories
  };
}

/** Série agregada: os pontos JÁ são acumulados (linhas "...ACUMULADO..." da planilha). */
function buildObraReading(point: PlanningDataset["periodSeries"][number]["points"][number]): PhysicalFinancialObraReading {
  const plannedValue = canonicalOrNull(point.plannedValue);
  const actualValue = canonicalOrNull(point.actualValue);
  const plannedPct = fractionToPercentPoints(point.plannedPercent);
  const actualPct = fractionToPercentPoints(point.actualPercent);

  const plannedAccumulatedValueDecimal = plannedValue ?? "0.00";
  const actualAccumulatedValueDecimal = actualValue ?? "0.00";
  const deviationValueDecimal = subtractMeasurementDecimals(actualAccumulatedValueDecimal, plannedAccumulatedValueDecimal, MONEY_SCALE);
  const deviationPercentPoints =
    plannedPct !== null && actualPct !== null ? subtractMeasurementDecimals(actualPct, plannedPct, PERCENT_POINT_SCALE) : null;

  return {
    periodLabel: point.period,
    periodDate: point.date as string,
    plannedAccumulatedValueDecimal,
    actualAccumulatedValueDecimal,
    deviationValueDecimal,
    plannedAccumulatedPercent: plannedPct,
    actualAccumulatedPercent: actualPct,
    deviationPercentPoints,
    situation: classifySituation(deviationPercentPoints, deviationValueDecimal)
  };
}

/** Série por grupo: pontos MENSAIS. O acumulado é a soma decimal exata de `points[0..alvo]`. */
function buildGroupReading(
  groupCode: string,
  groupName: string,
  pointsUpToTarget: ReadonlyArray<PlanningDataset["periodSeries"][number]["points"][number]>,
  obra: PhysicalFinancialObraReading
): PhysicalFinancialGroupReading {
  const last = pointsUpToTarget[pointsUpToTarget.length - 1];

  const plannedPeriodValueDecimal = canonicalOrNull(last?.plannedValue ?? null) ?? "0.00";
  const actualPeriodValueDecimal = canonicalOrNull(last?.actualValue ?? null) ?? "0.00";

  const plannedAccumulatedValueDecimal = sumValues(pointsUpToTarget.map((point) => point.plannedValue));
  const actualAccumulatedValueDecimal = sumValues(pointsUpToTarget.map((point) => point.actualValue));

  const plannedAccumulatedPercent = sumFractionsToPercentPoints(pointsUpToTarget.map((point) => point.plannedPercent));
  const actualAccumulatedPercent = sumFractionsToPercentPoints(pointsUpToTarget.map((point) => point.actualPercent));

  const deviationValueDecimal = subtractMeasurementDecimals(actualAccumulatedValueDecimal, plannedAccumulatedValueDecimal, MONEY_SCALE);
  const deviationPercentPoints =
    plannedAccumulatedPercent !== null && actualAccumulatedPercent !== null
      ? subtractMeasurementDecimals(actualAccumulatedPercent, plannedAccumulatedPercent, PERCENT_POINT_SCALE)
      : null;

  // Nada previsto E nada realizado até o corte -> "sem programação até o
  // período". Classificar como "no previsto" (desvio zero) induziria
  // leitura errada: não havia execução programada. Regra genérica e
  // determinística sobre os valores acumulados resultantes.
  const nothingScheduled = isCanonicalZero(plannedAccumulatedValueDecimal) && isCanonicalZero(actualAccumulatedValueDecimal);

  return {
    groupCode,
    groupName,
    plannedPeriodValueDecimal,
    plannedAccumulatedValueDecimal,
    actualPeriodValueDecimal,
    actualAccumulatedValueDecimal,
    plannedAccumulatedPercent,
    actualAccumulatedPercent,
    deviationValueDecimal,
    deviationPercentPoints,
    sharePercent: sharePercent(deviationValueDecimal, obra.deviationValueDecimal),
    situation: nothingScheduled ? "not_scheduled" : classifySituation(deviationPercentPoints, deviationValueDecimal)
  };
}

// -------------------------------------------------------------------
// Leitura gerencial derivada (headline, principal impacto,
// concentração, contraponto positivo) -- só rankeia e soma grupos já
// calculados. Nunca reclassifica, nunca infere causa operacional.
// -------------------------------------------------------------------

function buildManagementSummary(
  obra: PhysicalFinancialObraReading | null,
  groups: ReadonlyArray<PhysicalFinancialGroupReading>
): PhysicalFinancialManagementSummary | null {
  if (obra === null || groups.length === 0) {
    return null;
  }

  const obraDeviationCents = decimalToCents(obra.deviationValueDecimal);
  const direction: "below" | "above" | "on" = obraDeviationCents < 0n ? "below" : obraDeviationCents > 0n ? "above" : "on";
  const obraNetAbsDeviationDecimal = absDecimal(obra.deviationValueDecimal);

  const toImpact = (group: PhysicalFinancialGroupReading): PhysicalFinancialGroupImpact => ({
    groupCode: group.groupCode,
    groupName: group.groupName,
    plannedAccumulatedValueDecimal: group.plannedAccumulatedValueDecimal,
    actualAccumulatedValueDecimal: group.actualAccumulatedValueDecimal,
    deviationValueDecimal: group.deviationValueDecimal,
    deviationPercentPoints: group.deviationPercentPoints,
    sharePercent: group.sharePercent
  });

  const negative = groups
    .filter((group) => decimalToCents(group.deviationValueDecimal) < 0n)
    .sort((a, b) => Number(decimalToCents(a.deviationValueDecimal) - decimalToCents(b.deviationValueDecimal))); // mais negativo primeiro

  const positive = groups
    .filter((group) => decimalToCents(group.deviationValueDecimal) > 0n)
    .sort((a, b) => Number(decimalToCents(b.deviationValueDecimal) - decimalToCents(a.deviationValueDecimal))); // maior positivo primeiro

  const principalNegativeImpact = negative.length > 0 ? toImpact(negative[0]) : null;

  let concentration: PhysicalFinancialManagementSummary["concentration"] = null;
  if (negative.length > 0) {
    const top = negative.slice(0, 3);
    const combinedAbsDeviationDecimal = addMeasurementDecimals(
      top.map((group) => absDecimal(group.deviationValueDecimal)),
      MONEY_SCALE
    );
    concentration = {
      groups: top.map((group) => ({ groupCode: group.groupCode, groupName: group.groupName, deviationValueDecimal: group.deviationValueDecimal })),
      combinedAbsDeviationDecimal,
      obraNetAbsDeviationDecimal,
      sharePercent: sharePercent(combinedAbsDeviationDecimal, obra.deviationValueDecimal)
    };
  }

  return {
    headline: {
      direction,
      magnitudeValueDecimal: obraNetAbsDeviationDecimal,
      plannedPercent: obra.plannedAccumulatedPercent,
      actualPercent: obra.actualAccumulatedPercent,
      deviationPercentPoints: obra.deviationPercentPoints
    },
    principalNegativeImpact,
    concentration,
    positiveCounterpoint: positive.length > 0 ? toImpact(positive[0]) : null
  };
}

/** |numerador| ÷ |denominador| em %, duas casas -- bigint sobre centavos, sem float. null quando o denominador é zero. */
function sharePercent(numeratorDecimal: string, denominatorDecimal: string): string | null {
  const denom = absBigInt(decimalToCents(denominatorDecimal));
  if (denom === 0n) {
    return null;
  }
  const numer = absBigInt(decimalToCents(numeratorDecimal));
  const basisPoints = (numer * 10_000n + denom / 2n) / denom; // half-up
  const whole = basisPoints / 100n;
  const frac = (basisPoints % 100n).toString().padStart(2, "0");
  return `${whole.toString()}.${frac}`;
}

function decimalToCents(decimal: string): bigint {
  const negative = decimal.startsWith("-");
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const cents = BigInt(integerPart || "0") * 100n + BigInt((fractionalPart + "00").slice(0, 2) || "0");
  return negative ? -cents : cents;
}

function absDecimal(decimal: string): string {
  return decimal.startsWith("-") ? decimal.slice(1) : decimal;
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/**
 * Regra explícita e determinística (item 7 da especificação). Sem LLM,
 * sem limiar de tolerância inventado: qualquer desvio diferente de zero
 * já classifica. Prioriza os pontos percentuais (metodologia do próprio
 * documento de origem); cai para o valor quando não há percentual.
 */
function classifySituation(deviationPercentPoints: string | null, deviationValueDecimal: string): PhysicalFinancialSituation {
  const primary = deviationPercentPoints ?? deviationValueDecimal;
  if (isCanonicalZero(primary)) {
    return "on_planned";
  }
  return primary.startsWith("-") ? "below_planned" : "above_planned";
}

function isCanonicalZero(decimal: string): boolean {
  return /^-?0(\.0+)?$/.test(decimal);
}

function canonicalOrNull(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return canonicalizeMeasurementDecimal(value, MONEY_SCALE, MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero);
}

/**
 * Acumulado monetário de um grupo: soma decimal das parcelas mensais em
 * alta precisão e canonicaliza a centavos UMA única vez no fim — o
 * acumulado é a grandeza de interesse e deve ficar fiel à planilha
 * (arredondar mês a mês introduziria deriva de centavos frente ao total
 * do grupo). Nunca usa float como fonte de decisão: `addMeasurementDecimals`
 * já opera sobre a representação decimal exata de cada parcela.
 */
function sumValues(values: ReadonlyArray<number | null>): string {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (present.length === 0) {
    return "0.00";
  }
  return canonicalizeMeasurementDecimal(addMeasurementDecimals(present, 6), MONEY_SCALE, MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero);
}

/** Fração (0–1) → pontos percentuais "94.14". null quando não há valor. */
function fractionToPercentPoints(fraction: number | null): string | null {
  if (fraction === null || !Number.isFinite(fraction)) {
    return null;
  }
  return calculateMeasurementLineValue({ quantity: fraction, unitValue: "100", policy: PERCENT_POINT_POLICY });
}

/** Soma de frações mensais (0–1) → pontos percentuais acumulados "94.14". null quando nenhuma parcela existe. */
function sumFractionsToPercentPoints(fractions: ReadonlyArray<number | null>): string | null {
  const present = fractions.filter((value): value is number => value !== null && Number.isFinite(value));
  if (present.length === 0) {
    return null;
  }
  const summedFraction = addMeasurementDecimals(present, 12);
  return calculateMeasurementLineValue({ quantity: summedFraction, unitValue: "100", policy: PERCENT_POINT_POLICY });
}

/** "01.05.03" / "1-5-3" / "11.02" → "1.0" / "1.0" / "11.0". null quando o primeiro segmento não é inteiro positivo. Determinístico, sem fuzzy. */
export function resolveGroupCode(itemCode: string): string | null {
  const firstSegment = itemCode.trim().split(/[.\-\/\s]/)[0];
  if (!/^\d+$/.test(firstSegment)) {
    return null;
  }
  const groupNumber = Number.parseInt(firstSegment, 10);
  return groupNumber > 0 ? `${groupNumber}.0` : null;
}

function groupSortKey(groupCode: string): number {
  return Number.parseInt(groupCode.split(".")[0] ?? "0", 10);
}

/** "2026-06-01T..." / "2026-06-30" → "2026-06". null quando não parseável. */
function toYearMonth(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate.trim());
  return match ? `${match[1]}-${match[2]}` : null;
}
