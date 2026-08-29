-- ETAPA 2C.1A — corrige exclusivamente a fronteira de segurança da
-- rastreabilidade entre proposta contratada e execução.
--
-- Esta migration é aditiva: não redefine rotinas, não altera regras de
-- negócio e não persiste vínculos.

DO $$
DECLARE
  v_persistence_owner NAME;
BEGIN
  SELECT pg_get_userbyid(p.proowner)
    INTO v_persistence_owner
  FROM pg_proc p
  WHERE p.oid =
    'public.persist_contract_execution_item_links_manifest(uuid,text,jsonb)'::regprocedure;

  IF v_persistence_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION
      'Traceability persistence owner must be postgres; found %.',
      COALESCE(v_persistence_owner, '<missing>')
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- A tabela é somente leitura para papéis da aplicação. Toda escrita passa
-- pela rotina atômica autorizada abaixo.
REVOKE ALL PRIVILEGES
  ON TABLE public.contract_execution_item_links
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT
  ON TABLE public.contract_execution_item_links
  TO authenticated, service_role;

-- A função mantém exatamente o mesmo corpo e as mesmas validações. Apenas
-- passa a executar com os privilégios de seu proprietário confirmado.
ALTER FUNCTION public.persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB)
  SECURITY DEFINER;

ALTER FUNCTION public.persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB)
  SET search_path = public, pg_temp;

REVOKE ALL PRIVILEGES
  ON FUNCTION public.persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
  ON FUNCTION public.persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB)
  TO service_role;

-- Reafirma a fronteira já existente da revalidação sem alterar sua definição.
REVOKE ALL PRIVILEGES
  ON FUNCTION public.revalidate_contract_execution_item_link_manifest(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
  ON FUNCTION public.revalidate_contract_execution_item_link_manifest(JSONB)
  TO service_role;
