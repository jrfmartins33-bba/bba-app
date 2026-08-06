/**
 * Contratos da geometria esperada estruturada das células da verdade de
 * referência (Sprint de geometria, posterior à Sprint 21.4B.3A.3).
 * Camada de diagnóstico ADITIVA — nunca reinterpreta ou substitui
 * `ReferenceTruthCell.physicalRegionIds` (permanece `[]` em todas as
 * 1.019 células, exatamente como já congelado); apenas projeta, a partir
 * de `physicalOriginPt` e de evidência física independente (segmentos
 * horizontais reconstruídos), uma geometria auditável indexada por
 * `cellId`. Nunca importa PaddleOCR, Docling, resultado de motor
 * determinístico ou qualquer resultado v1/v2 — apenas os tipos já
 * congelados de `discovery-reference-truth.types` e uma evidência física
 * de segmentos, resolvida à parte.
 *
 * schemaVersion 2 (verificação probatória final da PR #81/#82): a prova
 * histórica direta — replay da cadeia física exatamente no commit em que
 * a verdade de referência foi congelada, com lockfile congelado, contra
 * o documento exato — mostrou que as `lineKey`/`segmentKey` já
 * declaradas em `physicalOriginPt`/`ReferenceTruthPhysicalRegion.segmentKeys`
 * não são reproduzíveis por nenhuma execução, em nenhum commit conhecido,
 * do reconstrutor físico já aprovado do domínio (leitor físico ->
 * observação de sinais -> localização de páginas -> reconstrução de
 * estrutura — ver `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md`). Essas
 * chaves permanecem no contrato exclusivamente como identificadores
 * históricos internos congelados — nunca mais como identidade física
 * reproduzível. A identidade canônica de cada segmento passou a ser o
 * `ReproduciblePhysicalSegmentLocator`, construído deterministicamente a
 * partir de posição estrutural congelada (página, região física, ordem
 * vertical da região, ordem horizontal do segmento) mais identidade
 * verificada do reconstrutor físico — nunca a partir da chave antiga.
 */
import type { ReferenceTruthColumnRole } from "../discovery-reference-truth.types";

export const REFERENCE_TRUTH_CELL_GEOMETRY_SCHEMA_VERSION = 2 as const;

// --- geometria primitiva -----------------------------------------------------

export interface ReferenceTruthBoundingBox {
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
}

export interface ReferenceTruthHorizontalBand {
  readonly leftPoints: number;
  readonly rightPoints: number;
}

// --- identidade histórica (não reproduzível) e identidade reproduzível ------

/**
 * Estado único e definitivo das chaves `lineKey`/`segmentKey` já
 * declaradas na verdade de referência congelada. Comprovado por replay
 * direto no próprio commit de congelamento (ver
 * `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md`): não
 * existe evidência versionada ou execução reproduzível capaz de
 * demonstrar como essas chaves foram produzidas. Nunca tratado como
 * "chave provavelmente errada" ou "chave desatualizada" — apenas como o
 * que é: um identificador histórico interno cuja origem de geração não
 * pôde ser reproduzida.
 */
export type LegacyDeclaredKeyStatus = "legacy_unreproducible";

/**
 * Base formal, e única, da associação entre uma célula e a geometria de
 * um segmento físico nesta camada: mesma página + mesma posição vertical
 * da região física congelada + caixa da região exatamente igual (via
 * pareamento estrutural contra uma reconstrução física fresca) + mesma
 * quantidade de segmentos + mesma ordem horizontal do segmento dentro da
 * linha + duas execuções físicas independentes e idênticas + zero
 * ambiguidade estrutural. Nunca "resolução direta por chave" (as chaves
 * antigas não são reproduzíveis — ver `LegacyDeclaredKeyStatus`), nunca
 * fuzzy matching, nunca aproximação, nunca inferência por conteúdo
 * textual.
 */
export type SegmentGeometryAssociationBasis = "exact_structural_position_with_region_geometry_validation";

/**
 * Localizador estrutural reproduzível — a identidade canônica de um
 * segmento físico nesta camada, a partir do schemaVersion 2. Determinístico
 * por construção: toda entrada é um fato estrutural já congelado (posição
 * da região/segmento) ou uma identidade de reconstrutor já verificada
 * como determinística (duas execuções físicas independentes e
 * idênticas). `reproducibleLineKey`/`reproducibleSegmentKey` são
 * calculadas a partir exclusivamente desses campos — nunca da
 * `lineKey`/`segmentKey` histórica.
 */
export interface ReproduciblePhysicalSegmentLocator {
  readonly sourceDocumentSha256: string;
  readonly realPageNumber: number;

  readonly frozenPhysicalRegionId: string;
  readonly regionVerticalOrder: number;
  readonly segmentHorizontalOrder: number;

  readonly regionBoundingBox: ReferenceTruthBoundingBox;
  readonly segmentBoundingBox: ReferenceTruthBoundingBox;

  readonly physicalAdapterVersionSha256: string;
  readonly physicalUnderlyingLibraryVersionSha256: string;
  readonly reconstructionContextFingerprint: string;
  readonly physicalGeometryContextFingerprint: string;

  readonly reproducibleLineKey: string;
  readonly reproducibleSegmentKey: string;
}

// --- evidência física independente (nunca derivada do motor ou de leitores) -

/**
 * Uma entrada do registro de segmentos físicos, indexada pela chave
 * histórica declarada (a única forma de resolver `physicalOriginPt`,
 * que nunca é reescrito). Carrega, lado a lado: a chave histórica com
 * seu status definitivo, a caixa delimitadora física (obtida por
 * associação estrutural exata — nunca alterada por esta correção), e o
 * localizador estrutural reproduzível que passa a ser a identidade
 * canônica. Não é recalculada por este módulo: é lida de um registro
 * congelado (ver `physical-segments-page-*` nesta mesma pasta),
 * produzido por uma execução independente e determinística do
 * reconstrutor físico contra o documento exato.
 */
export interface ReferenceTruthPhysicalSegmentGeometry {
  readonly legacyDeclaredSegmentKey: string;
  readonly legacyDeclaredSegmentKeyStatus: LegacyDeclaredKeyStatus;
  readonly realPageNumber: number;
  readonly boundingBox: ReferenceTruthBoundingBox;
  readonly associationBasis: SegmentGeometryAssociationBasis;
  readonly reproducibleLocator: ReproduciblePhysicalSegmentLocator;
}

// --- classificação da célula --------------------------------------------------

export type ReferenceTruthCellGeometryResolutionKind =
  | "single_source_fragment"
  | "multiple_source_fragments"
  | "shared_source_geometry"
  | "empty_slot_projection";

export type ReferenceTruthCellGeometrySpatialSemantics = "exclusive" | "shared" | "multi_fragment" | "empty_slot";

export type ReferenceTruthCellGeometryFragmentProjectionKind =
  | "source_segment_column_intersection"
  | "source_segment_exact_box"
  | "row_column_empty_slot";

export interface ReferenceTruthCellGeometryFragment {
  readonly id: string;
  /** Identificador histórico interno congelado — nunca uma identidade física reproduzida. `null` apenas para `row_column_empty_slot`. */
  readonly legacyDeclaredSegmentKey: string | null;
  readonly legacyDeclaredSegmentKeyStatus: LegacyDeclaredKeyStatus | null;
  /** Identidade canônica reproduzível deste fragmento. `null` apenas para `row_column_empty_slot` (que não tem segmento de origem). */
  readonly reproducibleLocator: ReproduciblePhysicalSegmentLocator | null;
  readonly associationBasis: SegmentGeometryAssociationBasis | null;
  readonly sourceBoundingBox: ReferenceTruthBoundingBox | null;
  readonly projectionKind: ReferenceTruthCellGeometryFragmentProjectionKind;
  readonly projectedBoundingBox: ReferenceTruthBoundingBox;
}

export interface ReferenceTruthCellGeometryProvenance {
  readonly cellId: string;
  readonly logicalRowId: string;
  readonly columnId: string;
  readonly columnRole: ReferenceTruthColumnRole;
  readonly physicalOriginPt: string;
  /** Chaves históricas extraídas de `physicalOriginPt`, em ordem declarada — ver `LegacyDeclaredKeyStatus`. */
  readonly legacyDeclaredSegmentKeys: ReadonlyArray<string>;
  readonly rowPhysicalRegionIds: ReadonlyArray<string>;
  readonly resolutionNotesPt: string;
}

export interface ReferenceTruthCellGeometry {
  readonly schemaVersion: typeof REFERENCE_TRUTH_CELL_GEOMETRY_SCHEMA_VERSION;

  readonly cellId: string;
  readonly realPageNumber: number;
  readonly logicalRowId: string;
  readonly columnId: string;

  readonly resolutionKind: ReferenceTruthCellGeometryResolutionKind;
  readonly spatialSemantics: ReferenceTruthCellGeometrySpatialSemantics;

  /** Chaves históricas declaradas por esta célula, em ordem — ver `LegacyDeclaredKeyStatus`. Nunca a identidade canônica (ver `fragments[].reproducibleLocator`). */
  readonly legacyDeclaredSegmentKeys: ReadonlyArray<string>;
  readonly sourcePhysicalRegionIds: ReadonlyArray<string>;

  /** Faixa (caixa) física da linha lógica inteira — evidência/validação independente, nunca a origem da coordenada vertical de uma célula com segmento próprio (ver §7 do enunciado da Sprint). */
  readonly rowBand: ReferenceTruthBoundingBox;
  readonly columnBand: ReferenceTruthHorizontalBand;

  readonly fragments: ReadonlyArray<ReferenceTruthCellGeometryFragment>;
  readonly expectedEnvelope: ReferenceTruthBoundingBox;

  readonly sharedGeometryGroupId: string | null;
  readonly sharedWithCellIds: ReadonlyArray<string>;

  readonly provenance: ReferenceTruthCellGeometryProvenance;
}

// --- entrada do algoritmo genérico -------------------------------------------

export interface ReferenceTruthCellGeometryPageBounds {
  readonly realPageNumber: number;
  readonly pageWidthPoints: number;
  readonly pageHeightPoints: number;
}

/**
 * Entrada pura do projetor: exclusivamente os tipos já congelados da
 * verdade de referência (`discovery-reference-truth.types`) mais o
 * registro de segmentos físicos resolvido à parte. Nunca contém literal
 * de página real, hash real ou topônimo — isso pertence apenas aos
 * arquivos de dados (`*-page-46.ts` etc.), nunca a este contrato.
 */
export interface ReferenceTruthCellGeometryProjectionInput {
  readonly cells: ReadonlyArray<import("../discovery-reference-truth.types").ReferenceTruthCell>;
  readonly logicalRows: ReadonlyArray<import("../discovery-reference-truth.types").ReferenceTruthLogicalRow>;
  readonly physicalRegions: ReadonlyArray<import("../discovery-reference-truth.types").ReferenceTruthPhysicalRegion>;
  readonly columns: ReadonlyArray<import("../discovery-reference-truth.types").ReferenceTruthColumn>;
  readonly physicalSegments: ReadonlyArray<ReferenceTruthPhysicalSegmentGeometry>;
  readonly pageBounds: ReadonlyArray<ReferenceTruthCellGeometryPageBounds>;
}

// --- problemas de integridade (nunca lançados por engano; sempre coletados) --

export type ReferenceTruthCellGeometryIntegrityCode =
  | "column_not_found"
  | "logical_row_not_found"
  | "row_has_no_physical_regions"
  | "row_physical_region_not_found"
  | "row_physical_region_wrong_page"
  | "origin_malformed"
  | "segment_not_found"
  | "segment_wrong_page"
  | "segment_key_ambiguous_in_registry"
  | "empty_cell_declares_origin"
  | "fragment_no_column_intersection"
  | "fragment_outside_page"
  | "fragment_outside_row_band";

export interface ReferenceTruthCellGeometryIntegrityIssue {
  readonly cellId: string;
  readonly code: ReferenceTruthCellGeometryIntegrityCode;
  readonly message: string;
}

export interface ReferenceTruthCellGeometryProjectionResult {
  readonly geometries: ReadonlyArray<ReferenceTruthCellGeometry>;
  readonly integrityIssues: ReadonlyArray<ReferenceTruthCellGeometryIntegrityIssue>;
}
