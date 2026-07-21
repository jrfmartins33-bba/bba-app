/**
 * Tipos do manifesto real independente pré-registrado da Sprint
 * 21.4B.3A.2 (§11.4 do enunciado). Exclusivamente diagnóstico — nunca
 * importado por código de produção, nunca por
 * `discovery-candidate-hypotheses.ts` ou qualquer candidata (H0-H4/H3b/
 * H3c/H3c-r1/H3d).
 */

export type H3dIndependentManifestLabel = "must_include" | "must_exclude" | "uncertain";

export type H3dIndependentManifestCoverageTag =
  | "external_adversarial_element"
  | "external_header_footer_or_note"
  | "conventional_tabular_line"
  | "legitimate_wide_continuation"
  | "grid_total"
  | "insufficient_physical_evidence"
  | "other";

export type H3dIndependentManifestAnnotationStatus = "proposed_for_human_review" | "human_approved";

/**
 * `annotationRuleId` identifica qual das seis regras auditáveis descritas
 * no relatório de pré-registro originou a proposta desta entrada —
 * preservado explicitamente por exigência da aprovação humana (mesma
 * disciplina da Sprint 21.4B.3A.1 para H3c): o manifesto commitado é
 * ESTÁTICO (dados literais, nunca recomputados por regex em tempo de
 * avaliação); `annotationRuleId` é só proveniência auditável de como o
 * rótulo foi originalmente proposto, nunca uma função que o avaliador de
 * H3d possa invocar.
 */
export type H3dIndependentManifestAnnotationRuleId =
  | "page_header_metadata_block"
  | "column_caption_header"
  | "page_footer_pagination"
  | "group_or_item_row"
  | "item_description_continuation"
  | "grid_total_line";

export interface H3dIndependentManifestEntry {
  readonly id: string;
  readonly realPageNumber: number;
  readonly lineKey: string;
  readonly verticalOrder: number;
  readonly textLocatorForHumanAudit: string;
  readonly label: H3dIndependentManifestLabel;
  readonly annotationRuleId: H3dIndependentManifestAnnotationRuleId;
  readonly rationalePt: string;
  readonly coverageTags: ReadonlyArray<H3dIndependentManifestCoverageTag>;
  readonly annotationStatus: H3dIndependentManifestAnnotationStatus;
}

export const H3D_INDEPENDENT_MANIFEST_SCHEMA_VERSION = 1 as const;
export const H3D_INDEPENDENT_MANIFEST_SOURCE_FILE_NAME = "20_Proposta_Precos_Concretisa_R01.pdf" as const;
export const H3D_INDEPENDENT_MANIFEST_SOURCE_FINGERPRINT_SHA256 = "a6202275e34689a4b157d99e4dbd717ee45b2d18a9ebfa52b94db5667e4e00f3" as const;
export const H3D_INDEPENDENT_MANIFEST_PAGE_RANGE = { start: 2, end: 21 } as const;
export const H3D_INDEPENDENT_MANIFEST_PROFILE_ID = "budget-document-tabular-region-detection-profile-v1" as const;
export const H3D_INDEPENDENT_MANIFEST_PROFILE_VERSION = 1 as const;
export const H3D_INDEPENDENT_MANIFEST_SELECTION_RULE_PT =
  "Fonte selecionada deterministicamente a partir do inventário existente `_local-documents/epic-21/lagoa-do-arroz/MANIFESTO_SHA256.csv`: excluídos atalhos .url e o documento Lagoa do Arroz já usado por H3c/H3c-r1 (`05_Anexo_Tecnico_Termo_Referencia.pdf`, fingerprint 5031da75...); dos documentos restantes com estrutura orçamentária tabular, ordenados por caminho relativo, o primeiro elegível é `02_Impugnacoes_Fase_Inicial/20_Proposta_Precos_Concretisa_R01.pdf` (Proposta de Preços da licitante Concretisa, documento distinto, nunca referenciado em nenhum teste ou manifesto de H1-H3c-r1). Páginas relevantes (2-21) determinadas por inspeção estrutural: correspondem à seção 'PLANILHA ORÇAMENTÁRIA' (grade hierárquica de itens), a única seção do documento de 184 páginas com a mesma classe estrutural de tabela usada por H3c/H3d — as demais seções (composições auxiliares, curva ABC, cronograma físico-financeiro, composição do BDI, encargos sociais) são tabelas de outra forma e ficam fora do escopo.";
export const H3D_INDEPENDENT_MANIFEST_EXTRACTION_RULE_PT =
  "Extraído pela cadeia real de produção, inalterada: leitura física (adaptador de extração de texto/geometria da fonte real) → observação de sinais → localização de páginas → reconstrução estrutural (f.0/f.1). Nenhuma etapa de detecção de região tabular (f.2a, `formTabularRegionCandidateWindows`) ou candidata de pertencimento (H0-H4/H3b/H3c/H3c-r1/H3d) foi executada para produzir este manifesto.";
export const H3D_INDEPENDENT_MANIFEST_CANDIDATE_USAGE_PROHIBITION_PT =
  "A candidata H3d (e qualquer outra) NUNCA pode receber `textLocatorForHumanAudit` como entrada — apenas identidade, ordem e geometria (lineKey, verticalOrder, alinhamentos). Este campo existe exclusivamente para auditoria humana.";
export const H3D_INDEPENDENT_MANIFEST_NO_OBSERVED_RESULTS_PT =
  "Este manifesto não contém, em nenhum campo, o resultado observado de nenhuma candidata (H0-H4, H3b, H3c, H3c-r1 ou H3d) para nenhuma entrada — apenas rótulo humano proposto, justificativa e etiquetas de cobertura.";
