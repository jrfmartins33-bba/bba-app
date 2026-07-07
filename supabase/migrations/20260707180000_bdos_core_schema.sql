-- BDOS core schema (Sprint 13.4 — Schema + RLS)
--
-- Implements the model designed in docs/BDOS_PERSISTENCE_ARCHITECTURE.md
-- (Sprint 13.1): Company -> at most one Workspace per type -> N Workspace
-- Objects (engineering_projects is the first and only one built here), a
-- 3-layer pipeline (planning_imports -> planning_datasets ->
-- decision_snapshots) with engine/decision versioning, and a
-- recommendations table as a separate operational-memory layer.
--
-- Deliberately does NOT reuse the existing `bba_area` enum or `projects`
-- table (see architecture doc, section 2): those power the accounting
-- back-office's own task tracker, a different concept from a BDOS
-- Workspace/engineering project, even though two names collide
-- ("financeiro", "rh"). `engineering_projects.linked_project_id` is the
-- only bridge between the two, and it is optional.

-- BLOCO 1: ENUM bdos_workspace_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bdos_workspace_type') THEN
    CREATE TYPE bdos_workspace_type AS ENUM (
      'engenharia',
      'financeiro',
      'rh',
      'comercial',
      'juridico',
      'operacoes'
    );
  END IF;
END $$;

-- BLOCO 2: TABELA workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_type bdos_workspace_type NOT NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, workspace_type)
);

DROP TRIGGER IF EXISTS set_workspaces_updated_at ON workspaces;
CREATE TRIGGER set_workspaces_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 3: TABELA engineering_projects (o Workspace Object da Workspace
-- Engenharia — cada futura Workspace terá a sua própria tabela de mesmo
-- papel; ver architecture doc, seção 4).
CREATE TABLE IF NOT EXISTS engineering_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linked_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  client_reference TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_engineering_projects_updated_at ON engineering_projects;
CREATE TRIGGER set_engineering_projects_updated_at
BEFORE UPDATE ON engineering_projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 4: TABELA planning_imports (Camada 1 — proveniência; nunca lida
-- pelo Engine, só por auditoria).
CREATE TABLE IF NOT EXISTS planning_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('ms-project-xml', 'excel')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BLOCO 5: TABELA planning_datasets (Camada 2 — Planning Dataset
-- normalizado, guardado verbatim como JSONB; ver architecture doc,
-- seção 5.2, sobre por que não normalizar atividade-por-atividade).
CREATE TABLE IF NOT EXISTS planning_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  planning_import_id UUID NOT NULL REFERENCES planning_imports(id) ON DELETE CASCADE,
  dataset_schema_version INT NOT NULL,
  detected_type TEXT NOT NULL
    CHECK (detected_type IN ('cronograma', 'curva-s', 'fisico-financeiro', 'mixed', 'unknown')),
  dataset JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BLOCO 6: TABELA decision_snapshots (Camada 3 — memória técnica,
-- imutável por design; ver architecture doc, seção 5.3).
CREATE TABLE IF NOT EXISTS decision_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  planning_dataset_id UUID NOT NULL REFERENCES planning_datasets(id) ON DELETE CASCADE,
  engine_version TEXT NOT NULL,
  trigger_reason TEXT NOT NULL CHECK (trigger_reason IN ('import', 'manual_recalculation', 'scheduled')),
  computed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decisions JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BLOCO 7: TABELA recommendations (memória operacional — Recommendation
-- Lifecycle; separada de propósito do `DecisionStatus` já existente e
-- congelado dentro de decision_snapshots.decisions; ver architecture doc,
-- seção 6).
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  decision_snapshot_id UUID NOT NULL REFERENCES decision_snapshots(id) ON DELETE CASCADE,
  recommendation_ref_id TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'dismissed')),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS set_recommendations_updated_at ON recommendations;
CREATE TRIGGER set_recommendations_updated_at
BEFORE UPDATE ON recommendations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 8: HABILITAR RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- BLOCO 9: POLITICAS RLS — workspaces (mutável: settings; nunca
-- hard-deletado por uma sessão de aplicação).
DROP POLICY IF EXISTS workspaces_select_company_or_admin ON workspaces;
CREATE POLICY workspaces_select_company_or_admin
ON workspaces
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS workspaces_insert_company_or_admin ON workspaces;
CREATE POLICY workspaces_insert_company_or_admin
ON workspaces
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS workspaces_update_company_or_admin ON workspaces;
CREATE POLICY workspaces_update_company_or_admin
ON workspaces
FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS workspaces_delete_blocked ON workspaces;
CREATE POLICY workspaces_delete_blocked
ON workspaces
FOR DELETE
TO authenticated
USING (false);

-- BLOCO 10: POLITICAS RLS — engineering_projects (mutável: nome/status;
-- "delete" é sempre status='archived', nunca DELETE de verdade).
DROP POLICY IF EXISTS engineering_projects_select_company_or_admin ON engineering_projects;
CREATE POLICY engineering_projects_select_company_or_admin
ON engineering_projects
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS engineering_projects_insert_company_or_admin ON engineering_projects;
CREATE POLICY engineering_projects_insert_company_or_admin
ON engineering_projects
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS engineering_projects_update_company_or_admin ON engineering_projects;
CREATE POLICY engineering_projects_update_company_or_admin
ON engineering_projects
FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS engineering_projects_delete_blocked ON engineering_projects;
CREATE POLICY engineering_projects_delete_blocked
ON engineering_projects
FOR DELETE
TO authenticated
USING (false);

-- BLOCO 11: POLITICAS RLS — planning_imports (imutável: só SELECT/INSERT,
-- nunca UPDATE nem DELETE, por ser trilha de proveniência/auditoria).
DROP POLICY IF EXISTS planning_imports_select_company_or_admin ON planning_imports;
CREATE POLICY planning_imports_select_company_or_admin
ON planning_imports
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS planning_imports_insert_company_or_admin ON planning_imports;
CREATE POLICY planning_imports_insert_company_or_admin
ON planning_imports
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS planning_imports_update_blocked ON planning_imports;
CREATE POLICY planning_imports_update_blocked
ON planning_imports
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS planning_imports_delete_blocked ON planning_imports;
CREATE POLICY planning_imports_delete_blocked
ON planning_imports
FOR DELETE
TO authenticated
USING (false);

-- BLOCO 12: POLITICAS RLS — planning_datasets (imutável, mesmo raciocínio
-- de planning_imports).
DROP POLICY IF EXISTS planning_datasets_select_company_or_admin ON planning_datasets;
CREATE POLICY planning_datasets_select_company_or_admin
ON planning_datasets
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS planning_datasets_insert_company_or_admin ON planning_datasets;
CREATE POLICY planning_datasets_insert_company_or_admin
ON planning_datasets
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS planning_datasets_update_blocked ON planning_datasets;
CREATE POLICY planning_datasets_update_blocked
ON planning_datasets
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS planning_datasets_delete_blocked ON planning_datasets;
CREATE POLICY planning_datasets_delete_blocked
ON planning_datasets
FOR DELETE
TO authenticated
USING (false);

-- BLOCO 13: POLITICAS RLS — decision_snapshots (imutável por design —
-- "memória técnica"; ver architecture doc, seção 5.3. Um novo cálculo
-- sempre cria uma nova linha, nunca sobrescreve uma existente).
DROP POLICY IF EXISTS decision_snapshots_select_company_or_admin ON decision_snapshots;
CREATE POLICY decision_snapshots_select_company_or_admin
ON decision_snapshots
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS decision_snapshots_insert_company_or_admin ON decision_snapshots;
CREATE POLICY decision_snapshots_insert_company_or_admin
ON decision_snapshots
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS decision_snapshots_update_blocked ON decision_snapshots;
CREATE POLICY decision_snapshots_update_blocked
ON decision_snapshots
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS decision_snapshots_delete_blocked ON decision_snapshots;
CREATE POLICY decision_snapshots_delete_blocked
ON decision_snapshots
FOR DELETE
TO authenticated
USING (false);

-- BLOCO 14: POLITICAS RLS — recommendations (mutável: lifecycle de
-- status; "excluir" é sempre status='dismissed', nunca DELETE de
-- verdade — por isso não há política de DELETE liberada).
DROP POLICY IF EXISTS recommendations_select_company_or_admin ON recommendations;
CREATE POLICY recommendations_select_company_or_admin
ON recommendations
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS recommendations_insert_company_or_admin ON recommendations;
CREATE POLICY recommendations_insert_company_or_admin
ON recommendations
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS recommendations_update_company_or_admin ON recommendations;
CREATE POLICY recommendations_update_company_or_admin
ON recommendations
FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS recommendations_delete_blocked ON recommendations;
CREATE POLICY recommendations_delete_blocked
ON recommendations
FOR DELETE
TO authenticated
USING (false);

-- BLOCO 15: COMENTARIOS
COMMENT ON TABLE workspaces IS
  'Uma linha por (empresa, tipo de Workspace) habilitado — no máximo uma Workspace de cada tipo por empresa (UNIQUE company_id+workspace_type). Ver docs/BDOS_PERSISTENCE_ARCHITECTURE.md.';
COMMENT ON TABLE engineering_projects IS
  'Workspace Object da Workspace Engenharia. Não é a mesma coisa que a tabela `projects` já existente (rastreador de tarefa do back-office contábil) — ver docs/BDOS_PERSISTENCE_ARCHITECTURE.md, seção 2.2.';
COMMENT ON TABLE planning_imports IS
  'Camada 1 do pipeline BDOS — proveniência do arquivo importado. Imutável (só SELECT/INSERT). Nunca lida pelo Engine, só por auditoria.';
COMMENT ON TABLE planning_datasets IS
  'Camada 2 do pipeline BDOS — Planning Dataset normalizado (guardado verbatim como JSONB). Imutável (só SELECT/INSERT).';
COMMENT ON TABLE decision_snapshots IS
  'Camada 3 do pipeline BDOS — memória técnica imutável (só SELECT/INSERT). Um novo cálculo sempre cria uma nova linha, nunca sobrescreve uma existente, para preservar auditabilidade ao longo do tempo.';
COMMENT ON TABLE recommendations IS
  'Memória operacional (Recommendation Lifecycle) — separada do `DecisionStatus` já congelado dentro de decision_snapshots.decisions. Histórico de risco vem de consultar decision_snapshots ao longo do tempo, não desta tabela.';
COMMENT ON COLUMN decision_snapshots.engine_version IS
  'Carimbo manual (ex.: "2026.07.1") incrementado sempre que uma regra/cálculo que afete Decision/Recommendation mudar de verdade — não semver automático.';
COMMENT ON COLUMN engineering_projects.linked_project_id IS
  'Ponte opcional para a tabela `projects` genérica já existente (ex.: para aparecer também em "Tarefas") — nunca obrigatória.';
