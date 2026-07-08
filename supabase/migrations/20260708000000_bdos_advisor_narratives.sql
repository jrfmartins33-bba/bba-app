-- BDOS Advisor — narrativa sintetizada por LLM (Sprint 13.12, "diferencial
-- BBA" V1). Uma linha por decision_snapshot: gerada uma única vez, no
-- momento em que o snapshot é gravado (ver import/route.ts), nunca
-- recalculada em cada leitura da Home — mesmo raciocínio de
-- decision_snapshots/recommendations, memória imutável, não cache
-- reconstruível.
--
-- O texto em `narrative` é sempre derivado do que
-- getEngineeringAdvisorBriefing() já calculou (EngineeringAdvisorItem[]) —
-- a LLM nunca lê esta tabela nem qualquer outra diretamente, só recebe o
-- JSON desses itens já prontos. Se a chamada à LLM falhar, nenhuma linha é
-- gravada e a Home cai de volta nos itens template determinísticos que já
-- existiam antes desta Sprint.
CREATE TABLE IF NOT EXISTS advisor_narratives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  decision_snapshot_id UUID NOT NULL REFERENCES decision_snapshots(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  narrative TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT advisor_narratives_snapshot_unique UNIQUE (decision_snapshot_id)
);

ALTER TABLE advisor_narratives ENABLE ROW LEVEL SECURITY;

-- Imutável por design, mesmo raciocínio de decision_snapshots: um novo
-- cálculo sempre cria uma nova linha (novo decision_snapshot_id), nunca
-- sobrescreve uma existente.
DROP POLICY IF EXISTS advisor_narratives_select_company_or_admin ON advisor_narratives;
CREATE POLICY advisor_narratives_select_company_or_admin
ON advisor_narratives
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS advisor_narratives_insert_company_or_admin ON advisor_narratives;
CREATE POLICY advisor_narratives_insert_company_or_admin
ON advisor_narratives
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS advisor_narratives_update_blocked ON advisor_narratives;
CREATE POLICY advisor_narratives_update_blocked
ON advisor_narratives
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS advisor_narratives_delete_blocked ON advisor_narratives;
CREATE POLICY advisor_narratives_delete_blocked
ON advisor_narratives
FOR DELETE
TO authenticated
USING (false);

GRANT SELECT, INSERT ON advisor_narratives TO authenticated;

COMMENT ON TABLE advisor_narratives IS
  'Narrativa em linguagem natural gerada por LLM (Claude) a partir dos itens já calculados por getEngineeringAdvisorBriefing() — uma por decision_snapshot, imutável. Nunca é a fonte do dado, só a redação dele.';
COMMENT ON COLUMN advisor_narratives.model IS
  'Identificador do modelo Anthropic usado na geração (ex.: claude-sonnet-5) — permite auditar/migrar sem ambiguidade quando o modelo padrão mudar.';
