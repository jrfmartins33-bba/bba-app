/**
 * Sprint 21.4B.3A.3 — fechamento consolidado, §7. Gera
 * `comparison-v1-v2.json` mecanicamente a partir dos resultados v1 já
 * versionados (`results/*.json`, byte a byte intactos) e dos resultados
 * v2 recém-publicados — nunca com valores esperados de Docling/PaddleOCR
 * codificados antecipadamente. Os VALORES vêm sempre da leitura real dos
 * dois conjuntos de arquivos; apenas a CATEGORIA de interpretação de
 * cada métrica é atribuída por uma tabela fixa, decidida a partir de
 * qual Problema (A-E) — já documentado nos Momentos 3C.1/3C.1A/3C.1B —
 * tocou aquela métrica, nunca a partir do valor observado.
 */

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeysDeep(v)]));
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

export type ComparisonChangeTypeV2 = "unchanged" | "changed" | "missing_in_v1" | "missing_in_v2";

export type ComparisonInterpretationCategoryV2 = "unchanged" | "same_conclusion_now_derived" | "corrected_misleading_v1_metric" | "new_v2_audit_detail" | "outside_v2_correction_scope";

export interface ComparisonRowV2 {
  readonly tool: string;
  readonly metric: string;
  readonly v1Value: unknown;
  readonly v2Value: unknown;
  readonly changeType: ComparisonChangeTypeV2;
  readonly interpretationCategory: ComparisonInterpretationCategoryV2;
}

type BaseCategory = "outside_v2_correction_scope" | "corrected_v2_target" | "new_v2_audit_detail";

/**
 * Tabela fixa: qual Problema (A-E) — ou a lacuna do fechamento §4 —
 * tocou cada métrica. Decidida por documentação da Sprint, nunca pelo
 * valor observado.
 */
const METRIC_BASE_CATEGORY: Record<string, BaseCategory> = {
  "execution.pagesCompleted": "outside_v2_correction_scope",
  "execution.pagesFailed": "outside_v2_correction_scope",
  "repetition.rawOutputHashMatchByPage": "outside_v2_correction_scope",
  "repetition.canonicalOutputHashMatchByPage": "outside_v2_correction_scope",
  "mathEvidenceTotal": "outside_v2_correction_scope",
  "multilineCaseCount": "outside_v2_correction_scope",
  "criticalFieldLiteralMatchesTotal": "outside_v2_correction_scope",
  "directMatchCellsTotal": "outside_v2_correction_scope",
  "tableStructureByPage": "outside_v2_correction_scope",
  "criticalFields": "outside_v2_correction_scope",

  "regions.componentGranularity": "new_v2_audit_detail",
  "regions.expectedRegionsWithExactTextualMatch": "new_v2_audit_detail",
  "regions.expectedRegionsCoveredSpatiallyOnly": "new_v2_audit_detail",
  "regions.expectedRegionsOmitted": "new_v2_audit_detail",
  "regions.observedRegionsAdditional": "new_v2_audit_detail",
  "mathEvidence.fieldStatesDetail": "new_v2_audit_detail",
  "mathEvidence.missingDivergentLists": "new_v2_audit_detail",

  "regions.expectedRegionsCoveredByAnyComponent": "corrected_v2_target",
  "multilineOutcomeCounts": "corrected_v2_target",
  "mathEvidenceCounts": "corrected_v2_target",
  "externalContent": "corrected_v2_target",
  "viability.classification": "corrected_v2_target",
  "viability.gateInputs.inventedMonetaryValue": "corrected_v2_target",
  "viability.gateInputs.providedPhysicalOriginForCriticalFields": "corrected_v2_target",
  "viability.gateInputs.ranOffline": "corrected_v2_target",
  "viability.gateInputs.requiredNetworkOrExternalService": "corrected_v2_target",
  "viability.gateInputs.impedingInstability": "corrected_v2_target",
};

function refineCategory(metric: string, changed: boolean): ComparisonInterpretationCategoryV2 {
  const base = METRIC_BASE_CATEGORY[metric] ?? "outside_v2_correction_scope";
  if (base === "new_v2_audit_detail") return "new_v2_audit_detail";
  if (base === "outside_v2_correction_scope") return changed ? "corrected_misleading_v1_metric" : "unchanged"; // um metric fora do escopo nunca deveria mudar; se mudar, é um achado a investigar, não presumido correto
  // base === "corrected_v2_target"
  return changed ? "corrected_misleading_v1_metric" : "same_conclusion_now_derived";
}

function row(tool: string, metric: string, v1Value: unknown, v2Value: unknown): ComparisonRowV2 {
  const v1Present = v1Value !== undefined;
  const v2Present = v2Value !== undefined;
  let changeType: ComparisonChangeTypeV2;
  if (!v1Present && v2Present) changeType = "missing_in_v1";
  else if (v1Present && !v2Present) changeType = "missing_in_v2";
  else changeType = canonicalJson(v1Value) === canonicalJson(v2Value) ? "unchanged" : "changed";

  const interpretationCategory = changeType === "missing_in_v1" ? "new_v2_audit_detail" : refineCategory(metric, changeType === "changed");
  return { tool, metric, v1Value, v2Value, changeType, interpretationCategory };
}

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc !== null && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

/**
 * `v1Result`/`v2Result` são os objetos completos de
 * `results/{tool}-evaluation-result.json` (v1) e
 * `{tool}-evaluation-result.v2.json` (v2) — já lidos do disco pelo
 * chamador, nunca lidos aqui (mantém esta função pura e testável com
 * fixtures sintéticas).
 */
export function buildComparisonRowsV1V2(tool: string, v1Result: Record<string, unknown>, v2Result: Record<string, unknown>): ReadonlyArray<ComparisonRowV2> {
  const rows: ComparisonRowV2[] = [];

  rows.push(row(tool, "execution.pagesCompleted", get(v1Result, "execution.pagesCompleted"), get(v2Result, "execution.pagesCompleted")));
  rows.push(row(tool, "execution.pagesFailed", get(v1Result, "execution.pagesFailed"), get(v2Result, "execution.pagesFailed")));
  rows.push(row(tool, "repetition.rawOutputHashMatchByPage", get(v1Result, "repetition.rawOutputHashMatchByPage"), get(v2Result, "repetition.rawOutputHashMatchByPage")));
  rows.push(row(tool, "repetition.canonicalOutputHashMatchByPage", get(v1Result, "repetition.canonicalOutputHashMatchByPage"), get(v2Result, "repetition.canonicalOutputHashMatchByPage")));
  rows.push(row(tool, "tableStructureByPage", get(v1Result, "tableStructureByPage"), get(v2Result, "tableStructureByPage")));
  rows.push(row(tool, "criticalFields", get(v1Result, "criticalFields"), get(v2Result, "criticalFields")));
  rows.push(row(tool, "multilineCaseCount", get(v1Result, "multilineCaseCount"), get(v2Result, "multilineCaseCount")));
  rows.push(row(tool, "mathEvidenceTotal", get(v1Result, "mathEvidenceTotal"), get(v2Result, "mathEvidenceTotal")));
  rows.push(row(tool, "mathEvidenceCounts", get(v1Result, "mathEvidenceCounts"), get(v2Result, "mathEvidenceCounts")));
  rows.push(row(tool, "externalContent", get(v1Result, "externalContent"), get(v2Result, "externalContent")));
  rows.push(row(tool, "viability.classification", get(v1Result, "viability.classification"), get(v2Result, "viability.classification")));
  rows.push(row(tool, "viability.reasonsPt", get(v1Result, "viability.reasonsPt"), get(v2Result, "viability.reasonsPt")));

  // Regiões: v1 conta por componente (regionTextByPage.expectedRegionsRecovered
  // por página), v2 conta por região individual — comparação explícita da
  // mudança estrutural, página a página.
  const v1RegionTextByPage = get(v1Result, "regionTextByPage") as Record<string, Record<string, unknown>> | undefined;
  const v2RegionTextByPage = get(v2Result, "regionTextByPage") as Record<string, Record<string, unknown>> | undefined;
  const pages = new Set<string>([...(v1RegionTextByPage ? Object.keys(v1RegionTextByPage) : []), ...(v2RegionTextByPage ? Object.keys(v2RegionTextByPage) : [])]);
  [...pages].sort().forEach((page) => {
    rows.push(row(tool, `regions.page${page}.expectedRegionsCoveredByAnyComponent`, v1RegionTextByPage?.[page]?.expectedRegionsRecovered, v2RegionTextByPage?.[page]?.expectedRegionsCoveredByAnyComponent));
    rows.push(row(tool, `regions.page${page}.expectedRegionsWithExactTextualMatch`, undefined, v2RegionTextByPage?.[page]?.expectedRegionsWithExactTextualMatch));
    rows.push(row(tool, `regions.page${page}.expectedRegionsCoveredSpatiallyOnly`, undefined, v2RegionTextByPage?.[page]?.expectedRegionsCoveredSpatiallyOnly));
    rows.push(row(tool, `regions.page${page}.expectedRegionsOmitted`, v1RegionTextByPage?.[page]?.regionsOmitted, v2RegionTextByPage?.[page]?.expectedRegionsOmitted));
    rows.push(row(tool, `regions.page${page}.observedRegionsAdditional`, v1RegionTextByPage?.[page]?.regionsAdditional, v2RegionTextByPage?.[page]?.observedRegionsAdditional));
    rows.push(row(tool, `regions.page${page}.associationComponents`, undefined, v2RegionTextByPage?.[page]?.associationComponents));
  });

  // multilineOutcomeCounts: v1 nunca teve essa distribuição no arquivo por
  // ferramenta (apenas a contagem total de casos aplicáveis); construída
  // aqui a partir do array `multiline` real de cada lado, sem número
  // hardcoded.
  const countOutcomes = (arr: unknown): Record<string, number> => (Array.isArray(arr) ? arr.reduce<Record<string, number>>((acc, o) => ({ ...acc, [String(o)]: (acc[String(o)] ?? 0) + 1 }), {}) : {});
  rows.push(row(tool, "multilineOutcomeCounts", countOutcomes(get(v1Result, "multiline")), countOutcomes(get(v2Result, "multiline"))));

  // Insumos de viabilidade individuais corrigidos (Problema E / 3C.1A §7) —
  // não disponíveis explicitamente no JSON v1 (apenas o resultado final da
  // classificação), então comparados apenas do lado v2 aqui como detalhe de
  // auditoria novo; a linha "viability.classification" acima já cobre a
  // comparação de valor real entre v1 e v2.
  rows.push(row(tool, "mathEvidence.fieldStatesDetail", undefined, get(v2Result, "mathEvidence")));

  return rows;
}
