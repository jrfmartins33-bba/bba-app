/**
 * Contratos da verdade de referência estruturada (Sprint 21.4B.3A.3,
 * Momento 2 do enunciado). Exclusivamente diagnóstico — fora da
 * produção, nunca importado por código produtivo, nunca por Docling ou
 * PaddleOCR, nunca contém saída de nenhum leitor local, nunca contém
 * campo de avaliação de ferramenta, nunca calcula nada por conta
 * própria (todo valor é literal, transcrito ou verificado manualmente
 * antes do congelamento).
 *
 * Valores monetários e decimais são representados exclusivamente como
 * inteiros escalados (centavos para moeda; décimos/centésimos/milésimos
 * para quantidade, conforme a precisão exibida no próprio documento) —
 * nunca `number` de ponto flutuante para nenhum valor que participe de
 * reconciliação matemática.
 */

// --- Documento e página (§ "Documento e página") ---------------------------

export interface ReferenceTruthDocument {
  readonly sourceFileName: string;
  readonly sourceFingerprintSha256: string;
  readonly sourceUrl: string;
}

export interface ReferenceTruthPage {
  readonly realPageNumber: number;
  readonly renderingHashSha256: string;
  readonly pageWidthPoints: number;
  readonly pageHeightPoints: number;
  readonly renderedWidthPixels: number;
  readonly renderedHeightPixels: number;
  readonly renderingResolutionDpi: number;
  readonly renderingMethodIdentity: string;
  readonly pageSelectionRulePt: string;
}

// --- Região física (§ "Região física") --------------------------------------

export type ReferenceTruthPhysicalRegionClassification =
  | "conteudo_tabular"
  | "cabecalho_da_planilha"
  | "rodape"
  | "nota_externa"
  | "titulo"
  | "elemento_grafico"
  | "incerto";

export interface ReferenceTruthPhysicalRegion {
  readonly id: string;
  readonly realPageNumber: number;
  readonly verticalOrder: number;
  readonly boundingBox: { readonly leftPoints: number; readonly topPoints: number; readonly rightPoints: number; readonly bottomPoints: number };
  readonly observedText: string;
  readonly lineKey: string | null;
  readonly segmentKeys: ReadonlyArray<string>;
  readonly classification: ReferenceTruthPhysicalRegionClassification;
  readonly classificationBasisPt: string;
  /** Proveniência: qual regra/fonte originou esta classificação — nunca um cálculo de ferramenta. */
  readonly classificationProvenancePt: string;
}

// --- Coluna esperada (§ "Coluna esperada") ----------------------------------

export type ReferenceTruthColumnRole =
  | "item"
  | "codigo"
  | "fonte"
  | "tipo"
  | "descricao"
  | "unidade"
  | "quantidade"
  | "custo_unitario_sem_bdi"
  | "bdi_percentual"
  | "preco_unitario_com_bdi"
  | "preco_total_com_bdi"
  | "col_fgv";

export interface ReferenceTruthColumn {
  readonly id: string;
  readonly role: ReferenceTruthColumnRole;
  readonly observedHeaderLabelPt: string;
  readonly horizontalIntervalPoints: { readonly leftPoints: number; readonly rightPoints: number };
  readonly presentOnPages: ReadonlyArray<number>;
  readonly variationAcrossPagesPt: string;
  /** Registrado explicitamente quando esta coluna frequentemente compartilha um único segmento físico de texto com outra (nunca assumido em silêncio). */
  readonly frequentPhysicalMergeWithColumnId: string | null;
}

// --- Célula esperada (§ "Célula esperada") ----------------------------------

export type ReferenceTruthCellObservedType =
  | "codigo"
  | "descricao"
  | "unidade"
  | "quantidade"
  | "preco_unitario"
  | "preco_total"
  | "subtotal"
  | "total"
  | "rotulo_estrutural"
  | "vazio_intencional"
  | "incerto";

export interface ReferenceTruthCell {
  readonly id: string;
  readonly realPageNumber: number;
  readonly logicalRowId: string;
  readonly columnId: string;
  readonly physicalRegionIds: ReadonlyArray<string>;
  readonly literalText: string;
  /** Valor interpretado apenas quando inequívoco; nulo quando não é possível interpretar sem ambiguidade. */
  readonly interpretedValue:
    | { readonly kind: "monetary_cents"; readonly amountCents: number }
    | { readonly kind: "decimal_scaled"; readonly scaledValue: number; readonly scale: number }
    | { readonly kind: "percentage_scaled"; readonly scaledValue: number; readonly scale: number }
    | { readonly kind: "text"; readonly value: string }
    | { readonly kind: "unresolved" }
    | null;
  readonly observedType: ReferenceTruthCellObservedType;
  readonly displayedDecimalPrecision: number | null;
  readonly physicalOriginPt: string;
}

// --- Linha lógica esperada (§ "Linha lógica esperada") ----------------------

export type ReferenceTruthLogicalRowType =
  | "grupo"
  | "subgrupo"
  | "item_de_servico"
  | "continuacao_de_descricao"
  | "subtotal"
  | "total"
  | "cabecalho"
  | "conteudo_externo"
  | "incerto";

export interface ReferenceTruthLogicalRow {
  readonly id: string;
  readonly type: ReferenceTruthLogicalRowType;
  readonly cellIds: ReadonlyArray<string>;
  readonly physicalRegionIds: ReadonlyArray<string>;
  readonly continuityRelationPt: string;
  readonly startRealPageNumber: number;
  readonly endRealPageNumber: number;
  readonly observedHierarchicalCode: string | null;
  /** Só preenchido quando o pai é verificável dentro do próprio recorte (nunca presumido por proximidade). */
  readonly parentLogicalRowId: string | null;
}

// --- Relação matemática esperada (§ "Relação matemática esperada") ---------

/**
 * Quatro estados semanticamente distintos (correção da Sprint 21.4B.3A.3,
 * Momento 2) — nunca um estado ambíguo entre falha de reconstrução e
 * inconsistência do documento de origem:
 *
 * - `reconciliado_diretamente`: quantidade × preço unitário exibido =
 *   total exibido, exatamente, sem nenhuma prova adicional.
 * - `reconciliado_por_precisao_nao_exibida`: a igualdade direta não se
 *   sustenta, mas existe demonstravelmente um valor de maior precisão,
 *   consistente com a regra de arredondamento identificada, que
 *   reproduz o total oficial — o preço oficial exibido nunca é
 *   substituído por esse valor implícito.
 * - `inconsistencia_aritmetica_confirmada_na_fonte`: nem a igualdade
 *   direta nem a prova de precisão se sustentam — os três valores
 *   (quantidade, preço unitário, total) foram confirmados fiéis ao
 *   documento (renderização + texto bruto), e a divergência é uma
 *   inconsistência real do próprio documento oficial, nunca um erro de
 *   extração. Uma reconstrução que reproduza esses valores exatamente
 *   como exibidos é FIEL, mesmo que a fonte não feche matematicamente —
 *   o motor de reconciliação nunca deve corrigir, substituir ou
 *   descartar esses valores por essa causa.
 * - `nao_verificavel_fora_do_recorte`: a verificação exigiria dados de
 *   páginas fora deste recorte de 3 páginas — nunca uma afirmação de
 *   inconsistência nem de reconciliação.
 */
export type ReferenceTruthMathVerificationResult =
  | "reconciliado_diretamente"
  | "reconciliado_por_precisao_nao_exibida"
  | "inconsistencia_aritmetica_confirmada_na_fonte"
  | "nao_verificavel_fora_do_recorte";

/** Presente somente quando `result === "reconciliado_por_precisao_nao_exibida"`. Cobre exatamente os 6 pontos exigidos: precisão exibida, regra de arredondamento, intervalo admissível, existência demonstrada de valor compatível, preservação do preço oficial, ausência de afirmação sobre um preço oculto verdadeiro. */
export interface ReferenceTruthUndisplayedPrecisionProof {
  readonly displayedDecimalPrecision: number;
  readonly assumedRoundingRulePt: string;
  readonly admissibleIntervalDescriptionPt: string;
  readonly compatibleValueExistenceDemonstratedPt: string;
  readonly officialPricePreservedPt: string;
  readonly noAssertionOfTrueHiddenPricePt: string;
}

/** Presente somente quando `result === "inconsistencia_aritmetica_confirmada_na_fonte"`. Registro rico exigido linha a linha — nunca resumido. */
export interface ReferenceTruthSourceArithmeticInconsistencyRecord {
  readonly realPageNumber: number;
  readonly literalQuantity: string;
  readonly literalUnitPrice: string;
  readonly literalTotal: string;
  readonly exactMathematicalProductCents: number;
  readonly exactDifferenceCents: number;
  readonly fieldProvenance: {
    readonly quantity: string;
    readonly unitPrice: string;
    readonly total: string;
  };
  readonly confirmedAgainstRenderingPt: string;
  readonly confirmedAgainstRawTextPt: string;
  readonly fidelityJustificationPt: string;
}

/** Presente somente em relações de nível de grupo (`logicalRowId` referenciando uma linha do tipo `grupo`) cuja soma dos descendentes capturados bate exatamente com o total oficial exibido. */
export interface ReferenceTruthGroupCompletenessProof {
  readonly includedDescendantLogicalRowIds: ReadonlyArray<string>;
  readonly pageScopeDescriptionPt: string;
  readonly sumCents: number;
  readonly officialTotalCents: number;
  readonly differenceCents: number;
  readonly completenessProofPt: string;
}

export interface ReferenceTruthMathRelation {
  readonly id: string;
  readonly logicalRowId: string;
  readonly quantityScaled: { readonly scaledValue: number; readonly scale: number } | null;
  readonly displayedUnitPriceCents: number | null;
  readonly displayedTotalCents: number | null;
  readonly officialSubtotalOrTotalCents: number | null;
  readonly verifiableOperationPt: string;
  readonly result: ReferenceTruthMathVerificationResult;
  readonly undisplayedPrecisionProof: ReferenceTruthUndisplayedPrecisionProof | null;
  readonly sourceArithmeticInconsistency: ReferenceTruthSourceArithmeticInconsistencyRecord | null;
  readonly groupCompletenessProof: ReferenceTruthGroupCompletenessProof | null;
  readonly notesPt: string;
}

// --- agregado por página -----------------------------------------------------

export interface ReferenceTruthPageBundle {
  readonly page: ReferenceTruthPage;
  readonly physicalRegions: ReadonlyArray<ReferenceTruthPhysicalRegion>;
  readonly logicalRows: ReadonlyArray<ReferenceTruthLogicalRow>;
  readonly cells: ReadonlyArray<ReferenceTruthCell>;
  readonly mathRelations: ReadonlyArray<ReferenceTruthMathRelation>;
}

export const REFERENCE_TRUTH_SCHEMA_VERSION = 1 as const;
