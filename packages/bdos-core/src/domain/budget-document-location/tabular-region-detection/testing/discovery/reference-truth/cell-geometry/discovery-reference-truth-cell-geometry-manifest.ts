/**
 * Manifesto determinístico da geometria esperada real (Commit 2). Não editar
 * manualmente: regenerar via
 * o gerador único de dados reais desta Sprint (ver EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §2, para o caminho exato).
 *
 * A identidade do adaptador físico e da biblioteca subjacente é registrada aqui
 * apenas por hash (nunca como literal de texto): este arquivo vive fora do único
 * diretório do pacote autorizado a mencionar essa dependência de infraestrutura
 * (guarda arquitetural pré-existente, não desta Sprint). O valor literal completo
 * está documentado em EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md, §1.
 */
export const REFERENCE_TRUTH_CELL_GEOMETRY_MANIFEST = {
  schemaVersion: 1,
  sourceDocumentSha256: "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5",
  physicalAdapterVersionSha256: "0a19b3ed81cf7b470433c6bdb74666cf37c9f7fadea57bf9c511accf85463614",
  physicalUnderlyingLibraryVersionSha256: "9459aab9b2441913fe5c7faa0b815c91820b6c49537d5de72fa6cd210b0f734a",
  realPageNumbers: [46, 50, 54],
  totalCellCount: 1019,
  countByResolutionKind: {"single_source_fragment":683,"shared_source_geometry":336},
  sharedGeometryGroupCount: 167,
  canonicalGenerationSha256: "b0724ca46e4018b182bcb9d95b5016e7704440a5c5bbaba71e4d9272f02c1da7",
} as const;
