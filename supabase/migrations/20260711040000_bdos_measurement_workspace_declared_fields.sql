-- Epic 19, Sprint 4.0 (Contract Freeze) — measurement_workspaces
-- ganha três campos "declarados" e um índice de idempotência. Ver
-- packages/bdos-core/docs/EPIC_19_SPRINT_4_REPOSITORY_API_DESIGN.md
-- para o raciocínio completo. Migration exclusiva desta mudança de
-- schema — nenhum repository, endpoint ou outra alteração aqui.
--
-- Semântica (repetida nos comentários de coluna abaixo, para nunca
-- depender só deste cabeçalho): declared_* é o que o arquivo externo
-- afirmava; period_number/start_date/end_date (já existentes) é o
-- período OFICIAL adotado pelo workspace. Os dois podem coincidir,
-- mas não são o mesmo conceito -- o parser só extrai o declarado; o
-- Application Service decide o oficial, ou sinaliza revisão quando
-- divergem ou faltam.

ALTER TABLE measurement_workspaces
  ADD COLUMN IF NOT EXISTS declared_bulletin_number INT,
  ADD COLUMN IF NOT EXISTS declared_period_start DATE,
  ADD COLUMN IF NOT EXISTS declared_period_end DATE;

ALTER TABLE measurement_workspaces
  ADD CONSTRAINT measurement_workspaces_declared_bulletin_number_positive
    CHECK (declared_bulletin_number IS NULL OR declared_bulletin_number > 0);

ALTER TABLE measurement_workspaces
  ADD CONSTRAINT measurement_workspaces_declared_period_consistent
    CHECK (
      declared_period_start IS NULL
      OR declared_period_end IS NULL
      OR declared_period_end >= declared_period_start
    );

COMMENT ON COLUMN measurement_workspaces.declared_bulletin_number IS
  'Número de boletim que o arquivo de origem declarava (ex.: "BOLETIM DE MEDIÇÃO 08" -> 8) -- nunca o número oficial. O número oficial vive em measurement_bulletins.bulletin_number, atribuído pelo Application Service na geração do boletim, não copiado automaticamente deste campo.';

COMMENT ON COLUMN measurement_workspaces.declared_period_start IS
  'Data de início que o arquivo de origem declarava para o período -- comparação/auditoria, nunca o período oficial. O período oficial é start_date/end_date desta mesma tabela.';

COMMENT ON COLUMN measurement_workspaces.declared_period_end IS
  'Data de fim que o arquivo de origem declarava para o período -- mesma ressalva de declared_period_start.';

-- Idempotência por import: um measurement_bulletin_imports só pode
-- originar, no máximo, um measurement_workspaces. Parcial (WHERE ...
-- IS NOT NULL) para preservar o Caminho A -- múltiplos workspaces
-- nativos (sem import associado) continuam permitidos, sem colisão
-- entre si.
CREATE UNIQUE INDEX IF NOT EXISTS uq_measurement_workspaces_bulletin_import
  ON measurement_workspaces (measurement_bulletin_import_id)
  WHERE measurement_bulletin_import_id IS NOT NULL;
