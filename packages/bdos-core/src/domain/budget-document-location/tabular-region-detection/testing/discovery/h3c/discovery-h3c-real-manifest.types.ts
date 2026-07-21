/**
 * Tipos do manifesto real pré-registrado da Sprint 21.4B.3A.1 (§9.2 do
 * enunciado). Exclusivamente diagnóstico — nunca importado por código de
 * produção, nunca por `discovery-candidate-hypotheses.ts` ou qualquer
 * candidata (H0-H4/H3b/H3c).
 */

export type H3cRealManifestLabel = "must_include" | "must_exclude" | "uncertain";

export type H3cRealManifestCoverageTag =
  | "legitimate_wide_continuation"
  | "external_adversarial_element"
  | "insufficient_physical_evidence"
  | "conventional_tabular_line"
  | "external_header_footer_or_note"
  | "other";

export type H3cRealManifestAnnotationStatus = "proposed_for_human_review" | "human_approved";

/**
 * `annotationRuleId` identifica qual das nove regras auditáveis (ver
 * `EPIC_21_SPRINT_4B3A1_H3C_PREREGISTRATION.md` §13, tabela de regras)
 * originou a proposta desta entrada — preservado explicitamente por
 * exigência da aprovação humana (Sprint 21.4B.3A.1): o manifesto
 * commitado é ESTÁTICO (dados literais, nunca recomputados por regex em
 * tempo de avaliação); `annotationRuleId` é só proveniência auditável de
 * como o rótulo foi originalmente proposto, nunca uma função que o
 * avaliador de H3c possa invocar.
 */
export type H3cRealManifestAnnotationRuleId =
  | "title_block"
  | "column_caption_header"
  | "group_header"
  | "item_row"
  | "continuation"
  | "citation_note_external"
  | "footer"
  | "hybrid_merge_artifact"
  | "total_geral";

export interface H3cRealManifestEntry {
  readonly id: string;
  readonly realPageNumber: number;
  readonly lineKey: string;
  readonly verticalOrder: number;
  readonly textLocatorForHumanAudit: string;
  readonly label: H3cRealManifestLabel;
  readonly annotationRuleId: H3cRealManifestAnnotationRuleId;
  readonly rationalePt: string;
  readonly coverageTags: ReadonlyArray<H3cRealManifestCoverageTag>;
  readonly annotationStatus: H3cRealManifestAnnotationStatus;
}

export const H3C_REAL_MANIFEST_SCHEMA_VERSION = 1 as const;
export const H3C_REAL_MANIFEST_SOURCE_FINGERPRINT_SHA256 = "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5" as const;
export const H3C_REAL_MANIFEST_PAGE_RANGE = { start: 46, end: 54 } as const;
export const H3C_REAL_MANIFEST_BASE_COMMIT = "aa63e1264c93a56e8c77b6d3aba8ade17979584c" as const;
export const H3C_REAL_MANIFEST_PROFILE_ID = "budget-document-tabular-region-detection-profile-v1" as const;
export const H3C_REAL_MANIFEST_PROFILE_VERSION = 1 as const;
export const H3C_REAL_MANIFEST_EXTRACTION_RULE_PT =
  "Extraído pela cadeia real de produção, inalterada: leitura física (pdfjs) → observação de sinais → localização de páginas → reconstrução estrutural (f.0/f.1). Nenhuma etapa de detecção de região tabular (f.2a) ou candidata de pertencimento (H0-H4/H3b/H3c) foi executada para produzir este manifesto.";
export const H3C_REAL_MANIFEST_CANDIDATE_USAGE_PROHIBITION_PT =
  "A candidata H3c (e qualquer outra) NUNCA pode receber `textLocatorForHumanAudit` como entrada — apenas identidade, ordem e geometria. Este campo existe exclusivamente para auditoria humana.";
export const H3C_REAL_MANIFEST_NO_OBSERVED_RESULTS_PT =
  "Este manifesto não contém, em nenhum campo, o resultado observado de nenhuma candidata (H0, H1, H2, H3, H3b ou H3c) para nenhuma entrada — apenas rótulo humano proposto, justificativa e etiquetas de cobertura.";
