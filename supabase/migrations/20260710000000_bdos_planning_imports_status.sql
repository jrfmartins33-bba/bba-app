-- Resilient Planning Import (Epic 18) — planning_imports ganha um
-- campo mutável, `status`.
--
-- Ver packages/bdos-core/docs/RESILIENT_PLANNING_IMPORT.md para o
-- desenho completo. `planning_imports` era, desde a Sprint 13.4,
-- deliberadamente imutável (RLS bloqueava UPDATE/DELETE, GRANT só
-- tinha SELECT/INSERT) — esta migration muda isso conscientemente,
-- não como efeito colateral: `status` representa exclusivamente o
-- ciclo operacional da importação (upload -> processamento ->
-- conclusão/falha), nunca uma segunda responsabilidade além dela.
-- `planning_imports` continua sendo o registro canônico de
-- proveniência do arquivo — `source_type`/`file_name`/`storage_path`
-- nunca são reescritos por esta migration nem pelo código que a usa.
--
-- Decisão explícita registrada no desenho: sem tabela de histórico
-- separada (`planning_import_status_history`, mesmo padrão de
-- execution_task_status_history) — 5 estados lineares, sem
-- ramificação, sem exigência de auditoria granular por transição.
-- Adicionar essa tabela seria a abstração paralela que o Epic 18 foi
-- explicitamente instruído a evitar.

-- BLOCO 1: colunas novas.
ALTER TABLE planning_imports
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_upload'
    CHECK (status IN ('pending_upload', 'uploaded', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN planning_imports.status IS
  'Ciclo operacional da importação (upload -> processamento -> conclusão/falha), nunca o ciclo de vida do arquivo em si. planning_imports continua sendo o registro canônico de proveniência — este campo não é uma segunda responsabilidade além do ciclo operacional. Ver packages/bdos-core/docs/RESILIENT_PLANNING_IMPORT.md.';

-- BLOCO 2: trigger de updated_at (reaproveita a função já existente,
-- mesma usada por workspaces/execution_tasks — nenhuma função nova).
DROP TRIGGER IF EXISTS set_planning_imports_updated_at ON planning_imports;
CREATE TRIGGER set_planning_imports_updated_at
BEFORE UPDATE ON planning_imports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 3: substitui a policy de UPDATE bloqueado por uma policy real,
-- company-scoped — mesmo padrão de execution_tasks_update_company_or_admin.
-- Nenhuma restrição de coluna via trigger (mesma disciplina já usada
-- em execution_tasks): a policy autoriza a linha, a camada de
-- repository (apps/web/lib/bdos/repository.ts) é responsável por só
-- tocar `status`/`updated_at`, nunca `source_type`/`file_name`/
-- `storage_path`.
DROP POLICY IF EXISTS planning_imports_update_blocked ON planning_imports;
DROP POLICY IF EXISTS planning_imports_update_company_or_admin ON planning_imports;
CREATE POLICY planning_imports_update_company_or_admin
ON planning_imports
FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

-- BLOCO 4: grant explícito para o novo verbo.
GRANT UPDATE ON public.planning_imports TO authenticated;
