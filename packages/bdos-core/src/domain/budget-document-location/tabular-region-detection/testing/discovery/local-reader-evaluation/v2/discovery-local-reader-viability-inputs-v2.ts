/**
 * Problema E (Sprint 21.4B.3A.3, Momento 3C.1 → implementado no Momento
 * 3C.2A). Proveniência de cada campo congelada em
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §7 e refinada no enunciado de autorização do Momento 3C.2. Deriva
 * `LocalReaderViabilityGateInputs` (v1,
 * `discovery-local-reader-evaluation.types.ts`, tipo NUNCA alterado; a
 * tabela de decisão `classifyLocalReaderViability` também NUNCA alterada)
 * a partir de dados reais — nunca das constantes fixas hoje presentes em
 * `run-local-reader-evaluation.ts` (v1).
 *
 * Extensão mínima e necessária de `LocalReaderViabilityInputDerivationParamsV2`
 * em relação ao stub original (Momento 3C.1): `allObservedCells` (lookup
 * de coordenada convertida por id, necessário para
 * `providedPhysicalOriginForCriticalFields` sem usar `physicalRegionIds`
 * das células esperadas — proibido pelo enunciado do Momento 3C.2),
 * `criticalFieldCellIds` (quais ids de célula esperada são campos
 * críticos, indisponível a partir de `LocalReaderCriticalFieldMetric`
 * sozinho, que só carrega agregados) e `rawOutputHashMatchByPage`
 * (necessário para `reproducibleConfiguration`, já corretamente derivado
 * em v1 mas nunca antes exposto a este módulo). Nenhuma semântica nova —
 * apenas o dado bruto necessário para calcular a semântica já congelada.
 */

import type {
  LocalReaderCellComparisonResult,
  LocalReaderCriticalFieldMetric,
  LocalReaderExecutionMetrics,
  LocalReaderObservedCellRef,
  LocalReaderTool,
  LocalReaderViabilityGateInputs,
} from "../discovery-local-reader-evaluation.types";
import type { LocalReaderRegionTextMetricsV2 } from "./discovery-local-reader-evaluation-v2.types";

export interface LocalReaderViabilityInputDerivationParamsV2 {
  readonly tool: LocalReaderTool;
  readonly execution: LocalReaderExecutionMetrics;
  readonly allCellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>;
  readonly allObservedCells: ReadonlyArray<LocalReaderObservedCellRef>;
  readonly criticalFields: ReadonlyArray<LocalReaderCriticalFieldMetric>;
  readonly criticalFieldCellIds: ReadonlySet<string>;
  readonly regionTextByPageV2: Readonly<Record<number, LocalReaderRegionTextMetricsV2>>;
  readonly incorporatedTcuNoteAsItemOrValue: boolean;
  readonly rawOutputHashMatchByPage: Readonly<Record<number, boolean>>;
  /** Um registro `.meta.json` do manifesto de aquisição por página avaliada (execução 1 — canônica; não reexecutado, apenas lido). */
  readonly acquisitionMetaByPage: Readonly<Record<number, Record<string, unknown>>>;
}

/** Padrões congelados em EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md §7 — nunca ampliados por conveniência, nenhuma correção "inteligente" de formato. */
const MONETARY_PATTERN_V2 = /^\d{1,3}(\.\d{3})*,\d{2}$/;
const PERCENTAGE_PATTERN_V2 = /^\d+,\d+%$/;

function deriveInventedMonetaryValue(allCellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>): boolean {
  return allCellComparisons.some(
    (c) => c.outcome === "invented_cell" && c.normalizedObservedText !== null && (MONETARY_PATTERN_V2.test(c.normalizedObservedText) || PERCENTAGE_PATTERN_V2.test(c.normalizedObservedText)),
  );
}

function deriveProvidedPhysicalOriginForCriticalFields(
  allCellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
  criticalFieldCellIds: ReadonlySet<string>,
  allObservedCells: ReadonlyArray<LocalReaderObservedCellRef>,
): boolean {
  const observedById = new Map(allObservedCells.map((o) => [o.id, o]));
  return allCellComparisons.some((c) => {
    if (c.outcome !== "direct_match") return false;
    if (!c.referenceCellIds.some((id) => criticalFieldCellIds.has(id))) return false;
    return c.observedCellIds.some((oid) => observedById.get(oid)?.boundingBox !== null && observedById.get(oid) !== undefined);
  });
}

/** Termos de rede congelados desde o relatório executivo original do Momento 3B (§2: varredura textual por download/unauthenticated/connection/URLs). */
const NETWORK_EVIDENCE_TERMS_V2 = ["download", "unauthenticated", "connection", "http://", "https://"] as const;

function metaMessages(meta: Record<string, unknown>): ReadonlyArray<string> {
  const warnings = Array.isArray(meta.warnings) ? (meta.warnings as unknown[]).filter((w): w is string => typeof w === "string") : [];
  const errors = Array.isArray(meta.errors) ? (meta.errors as unknown[]).filter((e): e is string => typeof e === "string") : [];
  const configSummary = typeof meta.configurationSummaryPt === "string" ? [meta.configurationSummaryPt] : [];
  return [...warnings, ...errors, ...configSummary];
}

function containsNetworkEvidence(messages: ReadonlyArray<string>): boolean {
  return messages.some((msg) => NETWORK_EVIDENCE_TERMS_V2.some((term) => msg.toLowerCase().includes(term)));
}

function deriveRanOffline(tool: LocalReaderTool, acquisitionMetaByPage: Readonly<Record<number, Record<string, unknown>>>): boolean {
  const metas = Object.values(acquisitionMetaByPage);
  if (metas.length === 0) return false;
  if (tool === "docling") {
    return metas.every((m) => m.hfHubOffline === "1" && m.transformersOffline === "1");
  }
  // paddleocr: sem flag própria de offline no manifesto — ausência de qualquer evidência textual de rede nas mensagens registradas (mesma varredura já usada no relatório original do Momento 3B).
  return metas.every((m) => !containsNetworkEvidence(metaMessages(m)));
}

function deriveRequiredNetworkOrExternalService(acquisitionMetaByPage: Readonly<Record<number, Record<string, unknown>>>): boolean {
  // Evidência registrada, nunca ausência presumida: só é `true` quando um
  // termo de rede aparece de fato numa mensagem registrada — nunca
  // inferido pela negação de `ranOffline`.
  return Object.values(acquisitionMetaByPage).some((m) => containsNetworkEvidence(metaMessages(m)));
}

function deriveImpedingInstability(execution: LocalReaderExecutionMetrics): boolean {
  return execution.pagesFailed > 0 || execution.warnings.length > 0 || execution.partialFailures.length > 0;
}

function deriveProvidedRelevantTraceableComplementaryEvidence(regionTextByPageV2: Readonly<Record<number, LocalReaderRegionTextMetricsV2>>): boolean {
  // Evidência textual exata com coordenada utilizável (Problema A) —
  // nunca apenas sobreposição espacial grosseira (`expectedRegionsCoveredSpatiallyOnly`
  // é deliberadamente excluído desta checagem). Agnóstico de ferramenta —
  // nunca `tool === "paddleocr"` hardcoded.
  return Object.values(regionTextByPageV2).some((m) => m.expectedRegionsWithExactTextualMatch > 0);
}

export function deriveViabilityInputsV2(params: LocalReaderViabilityInputDerivationParamsV2): LocalReaderViabilityGateInputs {
  const { tool, execution, allCellComparisons, allObservedCells, criticalFields, criticalFieldCellIds, regionTextByPageV2, incorporatedTcuNoteAsItemOrValue, rawOutputHashMatchByPage, acquisitionMetaByPage } = params;

  return {
    processedAllThreePages: execution.pagesCompleted === 3,
    inventedMonetaryValue: deriveInventedMonetaryValue(allCellComparisons),
    providedPhysicalOriginForCriticalFields: deriveProvidedPhysicalOriginForCriticalFields(allCellComparisons, criticalFieldCellIds, allObservedCells),
    recoveredRequiredFieldsOf80Items: criticalFields.every((f) => f.literalMatches === f.itemsTotal) && criticalFields.some((f) => f.itemsTotal > 0),
    incorporatedTcuNoteAsItemOrValue,
    producedUsableTableCellStructure: allCellComparisons.some((c) => c.outcome === "direct_match"),
    ranOffline: deriveRanOffline(tool, acquisitionMetaByPage),
    reproducibleConfiguration: Object.values(rawOutputHashMatchByPage).every(Boolean),
    failedOnAnyPage: execution.pagesFailed > 0,
    requiredNetworkOrExternalService: deriveRequiredNetworkOrExternalService(acquisitionMetaByPage),
    impedingInstability: deriveImpedingInstability(execution),
    providedRelevantTraceableComplementaryEvidence: deriveProvidedRelevantTraceableComplementaryEvidence(regionTextByPageV2),
  };
}
