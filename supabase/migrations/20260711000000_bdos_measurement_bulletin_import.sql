-- Epic 19, Sprint 3 (Measurement Bulletin Import) — primeira camada de
-- persistência do Studio de Medições. Ver
-- packages/bdos-core/docs/EPIC_19_SPRINT_3_PERSISTENCE_ARCHITECTURE.md
-- para o desenho completo e o raciocínio de cada decisão abaixo.
--
-- Escopo desta migration: só a cadeia ratificada MeasurementWorkspace
-- -> MeasurementBulletin, mais WorkPackage/ManagedServiceItem
-- (identidade de EAP e catálogo de serviços). MeasurementCycle
-- (certificação) fica deliberadamente fora — ver Sprint 3, tabela 7.
-- MeasurementEntry/measurement-entry-processor/measurement-engine
-- também ficam fora — pipeline paralela, não reconciliada (Epic 19,
-- checagem à parte antes da Sprint 3).
--
-- Precisões travadas antes desta migration (Sprint 3, revisão à luz
-- do BDOS_VISION.md):
--   1. measurement_bulletins.status = 'Finalized' atesta só o
--      congelamento do documento produzido pelo BDOS — nunca
--      certificação externa, aprovação contratual ou reconhecimento
--      para faturamento. Essas três coisas pertencem ao futuro
--      measurement_cycles.
--   2. managed_service_items não tem nenhuma coluna ou FK que a
--      acople a uma importação — o Caminho B (este Epic) a povoa
--      via o adaptador do boletim, mas o schema não impõe essa
--      origem.

-- BLOCO 1: TABELA work_packages (identidade canônica de EAP,
-- ratificada Epic 19 Sprint 2 como bounded context de plataforma, não
-- pertencente a nenhum Studio — ver PLATFORM_ARCHITECTURE.md secao 5).
-- Primeira vez que WorkPackage ganha persistência: hoje o Project
-- Studio só o cria em memória durante um import (achado da Sprint
-- 19.1). Esta tabela não migra esse comportamento — fora de escopo
-- deste Epic, registrado como dívida no desenho.
CREATE TABLE IF NOT EXISTS work_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (length(trim(code)) > 0),
  -- Chave de correlação (find-or-create), nunca a de exibição —
  -- regra de identidade ratificada na Sprint 2: um nó de EAP tem um
  -- único work_package_id canônico por projeto, independente de qual
  -- Studio/arquivo o materializou primeiro.
  normalized_code TEXT NOT NULL CHECK (length(trim(normalized_code)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL
    CHECK (type IN ('scope_group', 'execution_front', 'cost_group', 'administration', 'mobilization', 'demobilization', 'other')),
  parent_work_package_id UUID REFERENCES work_packages(id) ON DELETE SET NULL,
  sequence INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Draft', 'Active', 'Suspended', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (engineering_project_id, normalized_code)
);

DROP TRIGGER IF EXISTS set_work_packages_updated_at ON work_packages;
CREATE TRIGGER set_work_packages_updated_at
BEFORE UPDATE ON work_packages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 2: TABELA managed_service_items (catálogo de itens de
-- contrato medíveis, ligados a um work_package). Sem FK/coluna de
-- origem de importação — ver precisão 2 no cabeçalho desta migration.
CREATE TABLE IF NOT EXISTS managed_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  work_package_id UUID NOT NULL REFERENCES work_packages(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (length(trim(code)) > 0),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
  contract_quantity NUMERIC NOT NULL CHECK (contract_quantity >= 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  -- contract_value/accumulated_quantity/remaining_quantity do domínio
  -- (ManagedServiceItem) são derivados na leitura (contract_quantity
  -- * unit_price; acumulado/saldo pela soma dos boletins finalizados)
  -- — nunca colunas próprias, mesmo princípio da reconciliação
  -- físico x financeiro.
  measurement_type TEXT NOT NULL DEFAULT 'quantity'
    CHECK (measurement_type IN ('quantity', 'percentage', 'lump_sum')),
  status TEXT NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Draft', 'Active', 'Suspended', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (engineering_project_id, code)
);

DROP TRIGGER IF EXISTS set_managed_service_items_updated_at ON managed_service_items;
CREATE TRIGGER set_managed_service_items_updated_at
BEFORE UPDATE ON managed_service_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 3: TABELA measurement_bulletin_imports (proveniência bruta do
-- arquivo — mirrors planning_imports, já nascendo com `status`
-- mutável em vez de precisar de uma migration posterior como o Epic
-- 18 precisou). O mesmo fluxo resiliente do Epic 18 (prepare-upload
-- -> upload direto ao Storage -> upload-complete -> process) é
-- reaproveitado literalmente para este import — o arquivo real
-- (BM_08) tem ~5,2MB, mesmo problema de tamanho que motivou aquele
-- desenho.
CREATE TABLE IF NOT EXISTS measurement_bulletin_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL CHECK (length(trim(file_name)) > 0),
  storage_path TEXT NOT NULL CHECK (length(trim(storage_path)) > 0),
  status TEXT NOT NULL DEFAULT 'pending_upload'
    CHECK (status IN ('pending_upload', 'uploaded', 'processing', 'completed', 'failed')),
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_measurement_bulletin_imports_updated_at ON measurement_bulletin_imports;
CREATE TRIGGER set_measurement_bulletin_imports_updated_at
BEFORE UPDATE ON measurement_bulletin_imports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 4: TABELA measurement_workspaces (área de trabalho editável —
-- Caminho A e Caminho B da visão de produto pousam aqui, nunca só
-- Caminho B: measurement_bulletin_import_id é opcional de propósito).
CREATE TABLE IF NOT EXISTS measurement_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  -- Nulo quando o workspace nasce de lançamento direto (Caminho A,
  -- ainda não implementado neste Epic, mas o schema não pode
  -- estruturalmente excluí-lo). Preenchido quando nasce de um boletim
  -- importado (Caminho B, o que este Epic entrega).
  measurement_bulletin_import_id UUID REFERENCES measurement_bulletin_imports(id) ON DELETE SET NULL,
  period_number INT NOT NULL CHECK (period_number > 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'InProgress', 'ReadyForReview', 'Closed', 'Cancelled')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_measurement_workspaces_updated_at ON measurement_workspaces;
CREATE TRIGGER set_measurement_workspaces_updated_at
BEFORE UPDATE ON measurement_workspaces
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 5: TABELA measurement_workspace_lines (normalizada — o
-- próprio domínio já expõe add/remove/updateQuantity por linha,
-- mesmo padrão de mutação individual de execution_tasks; ver Sprint
-- 3, criterio JSONB-vs-normalizado).
CREATE TABLE IF NOT EXISTS measurement_workspace_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_workspace_id UUID NOT NULL REFERENCES measurement_workspaces(id) ON DELETE CASCADE,
  managed_service_item_id UUID NOT NULL REFERENCES managed_service_items(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_value NUMERIC NOT NULL CHECK (unit_value >= 0),
  -- Sempre = quantity * unit_value, recalculado pelo domínio — nunca
  -- o número bruto do Excel de origem (achado da Sprint 0, reforçado
  -- na Sprint 2).
  total_value NUMERIC NOT NULL,
  -- O que a planilha de origem imprimia para esta linha, só para
  -- comparação/auditoria; nulo se não houver divergência a registrar
  -- (ou se a linha nasceu de lançamento nativo, Caminho A, sem
  -- nenhuma fonte externa a comparar).
  declared_total_value NUMERIC,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (measurement_workspace_id, managed_service_item_id)
);

DROP TRIGGER IF EXISTS set_measurement_workspace_lines_updated_at ON measurement_workspace_lines;
CREATE TRIGGER set_measurement_workspace_lines_updated_at
BEFORE UPDATE ON measurement_workspace_lines
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 6: TABELA measurement_bulletins (documento formal, JSONB
-- verbatim — o domínio (bulletin-generator) só valida/finaliza o
-- documento inteiro, nunca edita linha a linha depois de criado;
-- mesmo padrão de planning_datasets).
--
-- finalized_at IS NOT NULL == status Finalized == documento
-- congelado. Não implica certificação externa, aprovação contratual
-- ou reconhecimento para faturamento — ver precisão 1 no cabeçalho
-- desta migration. Nenhum consumidor futuro (em particular o Studio
-- de Finanças) deve tratar este campo como certificação.
--
-- Imutabilidade de lines/totals/validation_issues após finalização é
-- responsabilidade da camada de repository (mesma disciplina já
-- usada em planning_imports/execution_tasks — a policy de UPDATE
-- autoriza a linha inteira; nenhuma restrição de coluna via trigger
-- foi introduzida aqui para não divergir do padrão já estabelecido).
CREATE TABLE IF NOT EXISTS measurement_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  measurement_workspace_id UUID NOT NULL REFERENCES measurement_workspaces(id) ON DELETE RESTRICT,
  bulletin_number INT NOT NULL CHECK (bulletin_number > 0),
  period_number INT NOT NULL CHECK (period_number > 0),
  issue_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Validated', 'Finalized', 'Cancelled')),
  lines JSONB NOT NULL,
  totals JSONB NOT NULL,
  validation_issues JSONB NOT NULL DEFAULT '[]',
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (engineering_project_id, bulletin_number),
  -- Espelha bulletin-generator: finalized_at só existe junto do
  -- status Finalized, nunca parcialmente preenchido.
  CONSTRAINT measurement_bulletins_finalized_at_consistent CHECK (
    (status = 'Finalized' AND finalized_at IS NOT NULL)
    OR
    (status <> 'Finalized' AND finalized_at IS NULL)
  )
);

DROP TRIGGER IF EXISTS set_measurement_bulletins_updated_at ON measurement_bulletins;
CREATE TRIGGER set_measurement_bulletins_updated_at
BEFORE UPDATE ON measurement_bulletins
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN measurement_bulletins.status IS
  'Finalized atesta a integridade e o congelamento do documento produzido pelo BDOS -- nunca certificacao por agente externo, aprovacao contratual ou reconhecimento para faturamento. Essas tres coisas pertencem ao futuro measurement_cycles. Ver packages/bdos-core/docs/EPIC_19_SPRINT_3_PERSISTENCE_ARCHITECTURE.md.';

-- BLOCO 7: RLS — habilitar em todas as tabelas novas.
ALTER TABLE work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_bulletin_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_workspace_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_bulletins ENABLE ROW LEVEL SECURITY;

-- BLOCO 8: policies — work_packages (mutável: status/sequence podem
-- mudar; company-scoped em todas as operações, mesmo padrão de
-- execution_tasks).
DROP POLICY IF EXISTS work_packages_select_company_or_admin ON work_packages;
CREATE POLICY work_packages_select_company_or_admin
ON work_packages FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS work_packages_insert_company_or_admin ON work_packages;
CREATE POLICY work_packages_insert_company_or_admin
ON work_packages FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS work_packages_update_company_or_admin ON work_packages;
CREATE POLICY work_packages_update_company_or_admin
ON work_packages FOR UPDATE TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS work_packages_delete_blocked ON work_packages;
CREATE POLICY work_packages_delete_blocked
ON work_packages FOR DELETE TO authenticated USING (false);

-- BLOCO 9: policies — managed_service_items (mesmo padrão).
DROP POLICY IF EXISTS managed_service_items_select_company_or_admin ON managed_service_items;
CREATE POLICY managed_service_items_select_company_or_admin
ON managed_service_items FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS managed_service_items_insert_company_or_admin ON managed_service_items;
CREATE POLICY managed_service_items_insert_company_or_admin
ON managed_service_items FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS managed_service_items_update_company_or_admin ON managed_service_items;
CREATE POLICY managed_service_items_update_company_or_admin
ON managed_service_items FOR UPDATE TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS managed_service_items_delete_blocked ON managed_service_items;
CREATE POLICY managed_service_items_delete_blocked
ON managed_service_items FOR DELETE TO authenticated USING (false);

-- BLOCO 10: policies — measurement_bulletin_imports (mutável desde o
-- início, ao contrário de planning_imports original — já nasce com o
-- status operacional que o Epic 18 precisou adicionar depois).
DROP POLICY IF EXISTS measurement_bulletin_imports_select_company_or_admin ON measurement_bulletin_imports;
CREATE POLICY measurement_bulletin_imports_select_company_or_admin
ON measurement_bulletin_imports FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_bulletin_imports_insert_company_or_admin ON measurement_bulletin_imports;
CREATE POLICY measurement_bulletin_imports_insert_company_or_admin
ON measurement_bulletin_imports FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_bulletin_imports_update_company_or_admin ON measurement_bulletin_imports;
CREATE POLICY measurement_bulletin_imports_update_company_or_admin
ON measurement_bulletin_imports FOR UPDATE TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_bulletin_imports_delete_blocked ON measurement_bulletin_imports;
CREATE POLICY measurement_bulletin_imports_delete_blocked
ON measurement_bulletin_imports FOR DELETE TO authenticated USING (false);

-- BLOCO 11: policies — measurement_workspaces.
DROP POLICY IF EXISTS measurement_workspaces_select_company_or_admin ON measurement_workspaces;
CREATE POLICY measurement_workspaces_select_company_or_admin
ON measurement_workspaces FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_workspaces_insert_company_or_admin ON measurement_workspaces;
CREATE POLICY measurement_workspaces_insert_company_or_admin
ON measurement_workspaces FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_workspaces_update_company_or_admin ON measurement_workspaces;
CREATE POLICY measurement_workspaces_update_company_or_admin
ON measurement_workspaces FOR UPDATE TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_workspaces_delete_blocked ON measurement_workspaces;
CREATE POLICY measurement_workspaces_delete_blocked
ON measurement_workspaces FOR DELETE TO authenticated USING (false);

-- BLOCO 12: policies — measurement_workspace_lines. Sem company_id
-- própria (linha pertence a um workspace que já é company-scoped) —
-- escopo verificado via subquery contra measurement_workspaces,
-- mesmo padrão de execution_task_evidence_references/
-- execution_task_status_history (tabelas-filha sem company_id
-- redundante).
DROP POLICY IF EXISTS measurement_workspace_lines_select_company_or_admin ON measurement_workspace_lines;
CREATE POLICY measurement_workspace_lines_select_company_or_admin
ON measurement_workspace_lines FOR SELECT TO authenticated
USING (
  is_bba_admin() OR EXISTS (
    SELECT 1 FROM measurement_workspaces w
    WHERE w.id = measurement_workspace_lines.measurement_workspace_id
      AND w.company_id = get_my_company_id()
  )
);

DROP POLICY IF EXISTS measurement_workspace_lines_insert_company_or_admin ON measurement_workspace_lines;
CREATE POLICY measurement_workspace_lines_insert_company_or_admin
ON measurement_workspace_lines FOR INSERT TO authenticated
WITH CHECK (
  is_bba_admin() OR EXISTS (
    SELECT 1 FROM measurement_workspaces w
    WHERE w.id = measurement_workspace_lines.measurement_workspace_id
      AND w.company_id = get_my_company_id()
  )
);

DROP POLICY IF EXISTS measurement_workspace_lines_update_company_or_admin ON measurement_workspace_lines;
CREATE POLICY measurement_workspace_lines_update_company_or_admin
ON measurement_workspace_lines FOR UPDATE TO authenticated
USING (
  is_bba_admin() OR EXISTS (
    SELECT 1 FROM measurement_workspaces w
    WHERE w.id = measurement_workspace_lines.measurement_workspace_id
      AND w.company_id = get_my_company_id()
  )
)
WITH CHECK (
  is_bba_admin() OR EXISTS (
    SELECT 1 FROM measurement_workspaces w
    WHERE w.id = measurement_workspace_lines.measurement_workspace_id
      AND w.company_id = get_my_company_id()
  )
);

DROP POLICY IF EXISTS measurement_workspace_lines_delete_company_or_admin ON measurement_workspace_lines;
CREATE POLICY measurement_workspace_lines_delete_company_or_admin
ON measurement_workspace_lines FOR DELETE TO authenticated
USING (
  is_bba_admin() OR EXISTS (
    SELECT 1 FROM measurement_workspaces w
    WHERE w.id = measurement_workspace_lines.measurement_workspace_id
      AND w.company_id = get_my_company_id()
  )
);

-- BLOCO 13: policies — measurement_bulletins.
DROP POLICY IF EXISTS measurement_bulletins_select_company_or_admin ON measurement_bulletins;
CREATE POLICY measurement_bulletins_select_company_or_admin
ON measurement_bulletins FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_bulletins_insert_company_or_admin ON measurement_bulletins;
CREATE POLICY measurement_bulletins_insert_company_or_admin
ON measurement_bulletins FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_bulletins_update_company_or_admin ON measurement_bulletins;
CREATE POLICY measurement_bulletins_update_company_or_admin
ON measurement_bulletins FOR UPDATE TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_bulletins_delete_blocked ON measurement_bulletins;
CREATE POLICY measurement_bulletins_delete_blocked
ON measurement_bulletins FOR DELETE TO authenticated USING (false);

-- BLOCO 14: índices de apoio às consultas mais previsíveis (listar
-- work packages/itens/workspaces de um projeto; navegar de um
-- workspace para suas linhas; achar o boletim mais recente de um
-- projeto).
CREATE INDEX IF NOT EXISTS idx_work_packages_project ON work_packages (engineering_project_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_parent ON work_packages (parent_work_package_id);
CREATE INDEX IF NOT EXISTS idx_managed_service_items_project ON managed_service_items (engineering_project_id);
CREATE INDEX IF NOT EXISTS idx_managed_service_items_work_package ON managed_service_items (work_package_id);
CREATE INDEX IF NOT EXISTS idx_measurement_bulletin_imports_project ON measurement_bulletin_imports (engineering_project_id);
CREATE INDEX IF NOT EXISTS idx_measurement_workspaces_project ON measurement_workspaces (engineering_project_id);
CREATE INDEX IF NOT EXISTS idx_measurement_workspaces_import ON measurement_workspaces (measurement_bulletin_import_id);
CREATE INDEX IF NOT EXISTS idx_measurement_workspace_lines_workspace ON measurement_workspace_lines (measurement_workspace_id);
CREATE INDEX IF NOT EXISTS idx_measurement_workspace_lines_service_item ON measurement_workspace_lines (managed_service_item_id);
CREATE INDEX IF NOT EXISTS idx_measurement_bulletins_project ON measurement_bulletins (engineering_project_id);
CREATE INDEX IF NOT EXISTS idx_measurement_bulletins_workspace ON measurement_bulletins (measurement_workspace_id);
