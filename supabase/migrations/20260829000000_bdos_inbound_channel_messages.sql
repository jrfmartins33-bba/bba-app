-- ============================================================================
-- BDOS — Fatia A: Ledger de INGRESSO de canais externos (WhatsApp Cloud API)
-- Migration: 20260829000000_bdos_inbound_channel_messages.sql
--
-- PREPARADA PARA REVISÃO HUMANA. Estritamente ADITIVA:
--   1. NÃO altera nenhuma tabela existente (document_artifacts,
--      document_versions, document_processing_attempts, project_cost_*,
--      financial_lancamentos, contract_baselines, budget_*, measurement_*).
--   2. NÃO executa INSERT/UPDATE/DELETE em dados de produção.
--   3. Cria UMA tabela: inbound_channel_messages — apenas o registro de
--      ENTREGA do canal externo (idempotência de transporte). NÃO é uma
--      segunda evidência documental; a evidência canônica continua sendo
--      DocumentArtifact + DocumentVersion.
--   4. RLS company-or-admin para leitura; escrita só service_role
--      (SELECT/INSERT/UPDATE). DELETE não é concedido a ninguém.
--
-- >>> NÃO APLICAR NO SUPABASE SEM AUTORIZAÇÃO SEPARADA. <<<
-- >>> NÃO usar `supabase db push` (aplicaria outras migrations pendentes). <<<
--
-- Identidade de ingresso = (channel, provider_account_id, provider_message_id).
-- Descrição NUNCA é identidade. Nome de arquivo NUNCA é identidade. O SHA
-- do arquivo NÃO substitui provider_message_id como identidade de entrega.
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbound_channel_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id  UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,

  channel                 TEXT NOT NULL CHECK (length(trim(channel)) > 0),
  -- phone_number_id validado da conta Meta.
  provider_account_id     TEXT NOT NULL CHECK (length(trim(provider_account_id)) > 0),
  -- Identidade de ENTREGA do canal (ex.: wamid...).
  provider_message_id     TEXT NOT NULL CHECK (length(trim(provider_message_id)) > 0),
  provider_media_id       TEXT,
  -- wa_id do remetente. Persistido para rastreabilidade; nunca logado inteiro.
  sender_external_id      TEXT NOT NULL CHECK (length(trim(sender_external_id)) > 0),
  message_type            TEXT NOT NULL CHECK (length(trim(message_type)) > 0),
  received_at             TIMESTAMPTZ NOT NULL,

  status                  TEXT NOT NULL CHECK (status IN ('Received', 'Preserved', 'Failed')),

  document_id             UUID REFERENCES document_artifacts(id) ON DELETE SET NULL,
  document_version_id     UUID REFERENCES document_versions(id) ON DELETE SET NULL,

  error_code              TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}',

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Preserved exige documento + versão presentes.
  CONSTRAINT inbound_channel_messages_preserved_requires_document CHECK (
    status <> 'Preserved' OR (document_id IS NOT NULL AND document_version_id IS NOT NULL)
  ),
  -- Falha guarda apenas um código técnico controlado (nunca stack/token).
  CONSTRAINT inbound_channel_messages_failed_has_error_code CHECK (
    status <> 'Failed' OR (error_code IS NOT NULL AND length(trim(error_code)) > 0)
  )
);

-- IDENTIDADE DE INGRESSO — deduplicação de transporte. Um retry da Meta
-- com o mesmo provider_message_id colide aqui; NUNCA cria um segundo
-- DocumentArtifact nem um segundo objeto no Storage.
CREATE UNIQUE INDEX IF NOT EXISTS inbound_channel_messages_delivery_identity_idx
  ON inbound_channel_messages (channel, provider_account_id, provider_message_id);

CREATE INDEX IF NOT EXISTS inbound_channel_messages_company_id_idx
  ON inbound_channel_messages (company_id);
CREATE INDEX IF NOT EXISTS inbound_channel_messages_project_id_idx
  ON inbound_channel_messages (engineering_project_id);
CREATE INDEX IF NOT EXISTS inbound_channel_messages_status_idx
  ON inbound_channel_messages (company_id, status);
CREATE INDEX IF NOT EXISTS inbound_channel_messages_document_id_idx
  ON inbound_channel_messages (document_id) WHERE document_id IS NOT NULL;

COMMENT ON TABLE inbound_channel_messages IS
  'Fatia A — ledger de entrega de canais externos (WhatsApp Cloud API). Idempotência de transporte por (channel, provider_account_id, provider_message_id). NÃO é evidência: a evidência canônica é document_artifacts + document_versions.';

-- Consistência multiempresa/multiobra + coerência dos vínculos documentais.
CREATE OR REPLACE FUNCTION enforce_inbound_channel_message_consistency() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM engineering_projects
    WHERE id = NEW.engineering_project_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'inbound_channel_messages.company_id must match the company_id of its engineering_project_id';
  END IF;

  IF NEW.document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM document_artifacts WHERE id = NEW.document_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'inbound_channel_messages.document_id must belong to the same company_id';
  END IF;

  IF NEW.document_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM document_versions WHERE id = NEW.document_version_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'inbound_channel_messages.document_version_id must belong to the same company_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_inbound_channel_messages_consistency ON inbound_channel_messages;
CREATE TRIGGER enforce_inbound_channel_messages_consistency
BEFORE INSERT OR UPDATE ON inbound_channel_messages
FOR EACH ROW
EXECUTE FUNCTION enforce_inbound_channel_message_consistency();

DROP TRIGGER IF EXISTS set_inbound_channel_messages_updated_at ON inbound_channel_messages;
CREATE TRIGGER set_inbound_channel_messages_updated_at
BEFORE UPDATE ON inbound_channel_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + privilégios
-- ---------------------------------------------------------------------------
ALTER TABLE inbound_channel_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inbound_channel_messages_select_company_or_admin ON inbound_channel_messages;
CREATE POLICY inbound_channel_messages_select_company_or_admin
ON inbound_channel_messages FOR SELECT TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS inbound_channel_messages_insert_blocked ON inbound_channel_messages;
CREATE POLICY inbound_channel_messages_insert_blocked ON inbound_channel_messages FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS inbound_channel_messages_update_blocked ON inbound_channel_messages;
CREATE POLICY inbound_channel_messages_update_blocked ON inbound_channel_messages FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS inbound_channel_messages_delete_blocked ON inbound_channel_messages;
CREATE POLICY inbound_channel_messages_delete_blocked ON inbound_channel_messages FOR DELETE TO authenticated USING (false);

-- REVOKE explícito ANTES dos GRANTs — estado conhecido: ninguém tem nada.
REVOKE ALL ON inbound_channel_messages FROM PUBLIC;
REVOKE ALL ON inbound_channel_messages FROM anon;
REVOKE ALL ON inbound_channel_messages FROM authenticated;
REVOKE ALL ON inbound_channel_messages FROM service_role;

-- PUBLIC / anon: nenhum acesso.
-- authenticated: apenas SELECT (RLS company-or-admin). Sem INSERT/UPDATE/DELETE.
GRANT SELECT ON inbound_channel_messages TO authenticated;
-- service_role: SELECT/INSERT/UPDATE (escrita server-side controlada).
-- DELETE NÃO é concedido a ninguém.
GRANT SELECT, INSERT, UPDATE ON inbound_channel_messages TO service_role;

-- ============================================================================
-- FIM. Nenhuma linha inserida. Nenhuma tabela existente alterada.
-- ============================================================================
