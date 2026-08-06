/**
 * Manifesto determinístico da geometria esperada real (schemaVersion 2 — verificação
 * probatória final da PR #82: proveniência corrigida, geometria espacial inalterada).
 * Não editar manualmente: regenerar via o gerador único de dados reais desta Sprint
 * (ver EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §2, para o caminho exato).
 *
 * A identidade do adaptador físico e da biblioteca subjacente (dentro de
 * reproducibleLocator, nos registros de segmento) é registrada apenas por hash (nunca
 * como literal de texto): este arquivo vive fora do único diretório do pacote
 * autorizado a mencionar essa dependência de infraestrutura (guarda arquitetural
 * pré-existente, não desta Sprint). O valor literal completo está documentado em
 * EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §1.
 *
 * historicalReplayVerification registra o resultado, já obtido e aceito, da prova
 * histórica direta (replay no commit de congelamento da verdade de referência, com
 * lockfile congelado — ver EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md):
 * as lineKey/segmentKey históricas não são reproduzíveis por nenhuma execução
 * conhecida da cadeia física. A geometria em si permanece intacta e é a mesma
 * publicada antes desta correção (ver previousFullArtifactSha256/canonicalSpatialGeometrySha256).
 *
 * Campos de aplicabilidade explícitos (correção factual): a resolução direta de
 * lineKey foi de fato tentada e ausente em 186/186 casos (nunca ambígua). A
 * resolução direta de segmentKey NUNCA foi tentada — depende de uma linha já
 * resolvida, e nenhuma resolveu — por isso "bloqueada", nunca "tentada e
 * reprovada". Pelo mesmo motivo, individualBoundingBoxMismatchCount é `null`,
 * nunca `0`: "zero comparações tentadas" não é o mesmo fato que "zero
 * divergências encontradas entre comparações realizadas".
 */
export const REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST = {
  schemaVersion: 2,
  sourceDocumentSha256: "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5",
  realPageNumbers: [46, 50, 54],
  totalCellCount: 1019,
  countByResolutionKind: {"single_source_fragment":683,"shared_source_geometry":336},
  sharedGeometryGroupCount: 167,
  canonicalGenerationSha256: "23a267c23861429fca698b626d5f85095ab61ca1046e6cf85cca29a2515e4aca",
  previousFullArtifactSha256: "b0724ca46e4018b182bcb9d95b5016e7704440a5c5bbaba71e4d9272f02c1da7",
  canonicalSpatialGeometrySha256: "9221d8bb0f7994cdde106cdf1ba718380881d2d4cbe1710add52705bec62680b",
  historicalReplayVerification: {
    historicalReferenceTruthCommitSha: "ccd8f8f1627e4f628f8787c36a2b27517a42e29b",

    historicalLineCount: 186,
    directLineKeyResolutionAttemptCount: 186,
    directLineKeyResolutionSuccessCount: 0,
    directLineKeyResolutionAbsentCount: 186,
    directLineKeyResolutionAmbiguityCount: 0,

    historicalSegmentOccurrenceCount: 936,
    historicalDistinctSegmentKeyCount: 936,

    directSegmentKeyResolutionApplicability: "not_applicable_due_to_zero_resolved_lines",
    directSegmentKeyResolutionAttemptCount: 0,
    directSegmentKeyResolutionSuccessCount: 0,
    directSegmentKeyResolutionFailureCount: 0,
    directSegmentKeyResolutionBlockedCount: 936,

    individualBoundingBoxComparisonApplicability: "not_applicable_due_to_zero_resolved_segments",
    individualBoundingBoxComparisonAttemptCount: 0,
    individualBoundingBoxMismatchCount: null,

    publishedCellReferencedSegmentKeyCount: 850,

    historicalDirectRegistrySha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    currentStructuralBridgeRegistrySha256: "ce2637f13403a0a41f90ff05ec053c56765648fc752972840118ef4d3ca29bdc",
    publishedRegistrySha256: "a9f5d6a9bb7610ac323221af335b91d146c2e33767a85b661ba32c7145669042",
  },
} as const;
