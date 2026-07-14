-- Epic 21, Sprint 21.3C — última verificação de privilégios dos auxiliares.
--
-- Achado: a migração 20260714000004 nunca emitiu REVOKE/GRANT para
-- get_company_id_for_actor(UUID)/is_bba_admin_actor(UUID) — ela restringiu
-- EXECUTE nas 4 funções de mutação, mas presumiu (sem verificar) que a
-- mesma restrição valeria para os dois auxiliares que elas chamam. Ficaram
-- sem ACL própria (dono postgres, sem REVOKE/GRANT explícito), então o
-- comportamento padrão do Postgres para funções — EXECUTE concedido a
-- PUBLIC por criação — nunca foi removido. Confirmado empiricamente contra
-- o projeto real via has_function_privilege(): PUBLIC, anon e authenticated
-- tinham EXECUTE efetivo nos dois auxiliares, ambos SECURITY DEFINER.
--
-- Impacto real do achado: is_bba_admin_actor é inofensiva isoladamente
-- (só devolve um booleano), mas get_company_id_for_actor(p_actor_id),
-- sendo SECURITY DEFINER e executável por qualquer `authenticated` (e por
-- `anon`, sem sessão nenhuma), permitia consultar a company_id de QUALQUER
-- ator só sabendo o UUID — uma função interna de autorização virou um
-- oráculo de enumeração de organização, sem relação com o dono da sessão.
-- Nenhuma das 4 funções de mutação foi comprometida por isso (elas
-- continuam exigindo EXECUTE só de service_role, e usam o resultado só
-- para autorizar a própria chamada, nunca o devolvem ao chamador) — mas o
-- auxiliar em si era uma porta lateral de leitura, não coberta pela
-- correção anterior.
--
-- Esta migração:
--
-- 1. Recria os dois auxiliares como SECURITY INVOKER (troca de DEFINER).
--    Verificado antes desta troca, não presumido: `service_role` tem
--    rolbypassrls = true (ignora toda política de RLS de `profiles`) e já
--    possui GRANT de SELECT na tabela `profiles` (grant de base herdado da
--    criação original da tabela, fora desta Sprint) — logo, com EXECUTE
--    restrito a service_role, SECURITY INVOKER lê profiles.company_id/role
--    exatamente como SECURITY DEFINER lia, sem nenhuma elevação de
--    privilégio necessária. Não há motivo técnico real para manter
--    SECURITY DEFINER aqui.
-- 2. Qualifica a tabela como public.profiles e fixa
--    SET search_path = public, pg_temp (mesma disciplina já aplicada às 4
--    funções de mutação em 20260714000004; os auxiliares tinham ficado só
--    com `SET search_path = public`, sem pg_temp).
-- 3. REVOKE ALL de PUBLIC/anon/authenticated e GRANT EXECUTE só para
--    service_role, nas mesmas duas instruções que já deveriam ter existido
--    em 20260714000004.
--
-- A assinatura de ambos os auxiliares (p_actor_id UUID) nunca mudou desde
-- que foram criados nesta mesma migração 20260714000004 — não há
-- sobrecarga antiga para remover, e CREATE OR REPLACE preserva o dono
-- (postgres) sem precisar de DROP FUNCTION. As 4 funções de mutação
-- continuam chamando os dois auxiliares pelo nome não qualificado
-- (search_path já resolve para public em ambos os lados) — nenhuma delas
-- precisa ser alterada.

CREATE OR REPLACE FUNCTION get_company_id_for_actor(p_actor_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = p_actor_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_bba_admin_actor(p_actor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_actor_id
      AND role = 'bba_admin'
  );
$$;

REVOKE ALL ON FUNCTION get_company_id_for_actor(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_company_id_for_actor(UUID) FROM anon;
REVOKE ALL ON FUNCTION get_company_id_for_actor(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_company_id_for_actor(UUID) TO service_role;

REVOKE ALL ON FUNCTION is_bba_admin_actor(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_bba_admin_actor(UUID) FROM anon;
REVOKE ALL ON FUNCTION is_bba_admin_actor(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION is_bba_admin_actor(UUID) TO service_role;

COMMENT ON FUNCTION get_company_id_for_actor IS
  'Epic 21.3C — operação exclusiva de servidor (EXECUTE só para service_role, corrigido em 20260714000005 — a migração anterior nunca havia restringido este auxiliar). SECURITY INVOKER: só service_role chama, já ignora RLS de profiles e tem GRANT de tabela; sem motivo para SECURITY DEFINER.';
COMMENT ON FUNCTION is_bba_admin_actor IS
  'Epic 21.3C — operação exclusiva de servidor (EXECUTE só para service_role, corrigido em 20260714000005). Mesma disciplina de get_company_id_for_actor.';
