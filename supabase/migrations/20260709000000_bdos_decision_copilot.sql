-- BDOS Decision Copilot — Epic 15, Fase 1 (persistência + auditoria de
-- conversa). Ver packages/bdos-core/docs/DECISION_COPILOT.md para o
-- desenho completo e o racional de cada decisão abaixo — este arquivo é
-- a implementação literal daquele documento, revisado e aprovado com
-- ressalvas pelo CPO em 2026-07-09.
--
-- copilot_conversations e copilot_messages são append-only: nenhuma das
-- duas tem campo mutável hoje (nem title, nem last_message_at, nem
-- archived_at), então nenhuma delas ganha UPDATE nesta migration — abrir
-- a política sem um campo real para ela seria superfície sem uso. Um
-- UPDATE estreito (com trigger protegendo colunas de identidade) só
-- deve ser adicionado no dia em que um campo mutável de verdade for
-- introduzido.
--
-- Cada linha assistant de copilot_messages congela o contexto que a
-- gerou (context_snapshot/reasoning_chain/confidence/explainability
-- como cópia, nunca FK vivo) pelo mesmo motivo que decision_snapshots
-- congela o Health Score (Sprint 13.10): sem isso, a trilha de
-- auditoria desaparece assim que o dado subjacente for recalculado.
--
-- Os dois triggers de consistência de company_id (conversation <->
-- engineering_project, message <-> conversation) fecham, para este
-- Epic, a mesma classe de lacuna que advisor_narratives deixou em
-- aberto (lá, company_id/engineering_project_id/decision_snapshot_id
-- são FKs independentes sem checagem cruzada entre si — não corrigido
-- ali por estar fora do escopo desta migration).

CREATE TABLE IF NOT EXISTS copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  studio_id TEXT NOT NULL CHECK (studio_id IN (
    'bba-project', 'geoespacial', 'evidencias', 'memorias'
    -- estende conforme novos Studios entram em produção (ver
    -- docs/PLATFORM_ARCHITECTURE.md secao 9.1 para os slugs de rota reais)
  )),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  -- Só preenchido para role = 'assistant'. Copia congelada no momento
  -- da resposta, nunca referencia.
  context_snapshot JSONB,
  context_hash TEXT,      -- hash canonico de context_snapshot, calculado em TS (copilot-turn-builder.ts) — nunca gerado no banco
  reasoning_chain JSONB,
  confidence JSONB,
  explainability JSONB,

  -- Referencia (nao congelada) para rastreabilidade — aponta pro
  -- decision_snapshot real que existia no momento do turno, quando
  -- houver um. Nula em turnos que nao geraram novo calculo.
  decision_snapshot_id UUID REFERENCES decision_snapshots(id) ON DELETE SET NULL,

  model TEXT,              -- so para role = 'assistant', ex. "claude-sonnet-5"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT copilot_messages_assistant_has_full_trail CHECK (
    role = 'user'
    OR (
      role = 'assistant'
      AND context_snapshot IS NOT NULL
      AND confidence IS NOT NULL
      AND explainability IS NOT NULL
      AND model IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS copilot_messages_conversation_id_idx
  ON copilot_messages (conversation_id, created_at);

ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;

-- copilot_conversations: SELECT/INSERT company-or-admin. UPDATE e
-- DELETE explicitamente bloqueados (nao apenas ausencia de GRANT —
-- mesma disciplina de defesa em profundidade de advisor_narratives).
DROP POLICY IF EXISTS copilot_conversations_select_company_or_admin ON copilot_conversations;
CREATE POLICY copilot_conversations_select_company_or_admin
ON copilot_conversations
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS copilot_conversations_insert_company_or_admin ON copilot_conversations;
CREATE POLICY copilot_conversations_insert_company_or_admin
ON copilot_conversations
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS copilot_conversations_update_blocked ON copilot_conversations;
CREATE POLICY copilot_conversations_update_blocked
ON copilot_conversations
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS copilot_conversations_delete_blocked ON copilot_conversations;
CREATE POLICY copilot_conversations_delete_blocked
ON copilot_conversations
FOR DELETE
TO authenticated
USING (false);

-- copilot_messages: imutavel, mesmo padrao de advisor_narratives.
DROP POLICY IF EXISTS copilot_messages_select_company_or_admin ON copilot_messages;
CREATE POLICY copilot_messages_select_company_or_admin
ON copilot_messages
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS copilot_messages_insert_company_or_admin ON copilot_messages;
CREATE POLICY copilot_messages_insert_company_or_admin
ON copilot_messages
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS copilot_messages_update_blocked ON copilot_messages;
CREATE POLICY copilot_messages_update_blocked
ON copilot_messages
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS copilot_messages_delete_blocked ON copilot_messages;
CREATE POLICY copilot_messages_delete_blocked
ON copilot_messages
FOR DELETE
TO authenticated
USING (false);

-- Grants explicitos desde a primeira migration — as duas lacunas
-- retroativas de Sprint 13.6 e do hardening de 13.11 nao se repetem.
-- Sem UPDATE em nenhuma das duas tabelas (ver nota no topo do arquivo).
GRANT SELECT, INSERT ON copilot_conversations TO authenticated;
GRANT SELECT, INSERT ON copilot_messages TO authenticated;

-- Trigger 1: copilot_conversations.company_id precisa bater com
-- engineering_projects.company_id do projeto referenciado.
CREATE OR REPLACE FUNCTION enforce_copilot_conversation_company_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id <> (
    SELECT company_id FROM engineering_projects WHERE id = NEW.engineering_project_id
  ) THEN
    RAISE EXCEPTION 'copilot_conversations.company_id must match engineering_projects.company_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS copilot_conversations_company_consistency ON copilot_conversations;
CREATE TRIGGER copilot_conversations_company_consistency
BEFORE INSERT ON copilot_conversations
FOR EACH ROW EXECUTE FUNCTION enforce_copilot_conversation_company_consistency();

-- Trigger 2: copilot_messages.company_id precisa bater com
-- copilot_conversations.company_id da conversa referenciada.
CREATE OR REPLACE FUNCTION enforce_copilot_message_company_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id <> (
    SELECT company_id FROM copilot_conversations WHERE id = NEW.conversation_id
  ) THEN
    RAISE EXCEPTION 'copilot_messages.company_id must match copilot_conversations.company_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS copilot_messages_company_consistency ON copilot_messages;
CREATE TRIGGER copilot_messages_company_consistency
BEFORE INSERT ON copilot_messages
FOR EACH ROW EXECUTE FUNCTION enforce_copilot_message_company_consistency();

COMMENT ON TABLE copilot_conversations IS
  'Thread de conversa do Decision Copilot (Epic 15), escopada a um engineering_project e a um Studio. Append-only — sem campo mutavel na Fase 1.';
COMMENT ON TABLE copilot_messages IS
  'Turno de conversa do Decision Copilot, imutavel. Mensagens assistant congelam context_snapshot/confidence/explainability no momento da resposta — nunca referenciam o estado atual dessas tabelas.';
COMMENT ON COLUMN copilot_messages.context_hash IS
  'Hash canonico de context_snapshot calculado em TypeScript (copilot-turn-builder.ts), nao no banco — ordenacao de chaves em JSONB nao e garantida na serializacao de texto do Postgres. Usado para auditoria/deduplicacao/comparacao entre turnos sem diff em JSONB.';
COMMENT ON COLUMN copilot_messages.model IS
  'Identificador do modelo Anthropic usado para gerar esta resposta (ex.: claude-sonnet-5) — mesmo proposito de advisor_narratives.model.';
