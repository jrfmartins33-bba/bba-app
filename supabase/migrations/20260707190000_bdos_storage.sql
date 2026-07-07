-- BDOS Storage (Sprint 13.5)
--
-- Implements docs/BDOS_PERSISTENCE_ARCHITECTURE.md, seção 7: bucket
-- dedicado para os arquivos brutos referenciados por
-- planning_imports.storage_path. Caminho:
--   {company_id}/{engineering_project_id}/{planning_import_id}/{file_name}
-- RLS de storage.objects espelha a mesma regra company_id/is_bba_admin()
-- já usada nas tabelas BDOS, comparando o primeiro segmento do path
-- (storage.foldername(name)[1]) com get_my_company_id().
--
-- Não confirmado ainda: escrita real nesse bucket a partir da rota de
-- import (apps/web/app/api/bba-project/import/route.ts) — isso depende
-- da autenticação server-side ainda não implementada (ver architecture
-- doc, seção 8, Sprint 13.6). Esta migration só prepara o terreno.

-- BLOCO 1: bucket dedicado, privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('bdos-imports', 'bdos-imports', false)
ON CONFLICT (id) DO NOTHING;

-- BLOCO 2: RLS — storage.objects, escopado a este bucket via bucket_id
-- (a tabela é compartilhada por todos os buckets do projeto Supabase;
-- toda política aqui filtra bucket_id = 'bdos-imports' primeiro para
-- nunca afetar outros buckets).
DROP POLICY IF EXISTS bdos_imports_select_company_or_admin ON storage.objects;
CREATE POLICY bdos_imports_select_company_or_admin
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'bdos-imports'
  AND ((storage.foldername(name))[1] = get_my_company_id()::text OR is_bba_admin())
);

DROP POLICY IF EXISTS bdos_imports_insert_company_or_admin ON storage.objects;
CREATE POLICY bdos_imports_insert_company_or_admin
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bdos-imports'
  AND ((storage.foldername(name))[1] = get_my_company_id()::text OR is_bba_admin())
);

-- Arquivo de import é proveniência imutável (mesmo raciocínio de
-- planning_imports na migration 13.4): sem UPDATE, sem DELETE por
-- sessão de aplicação.
DROP POLICY IF EXISTS bdos_imports_update_blocked ON storage.objects;
CREATE POLICY bdos_imports_update_blocked
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'bdos-imports' AND false);

DROP POLICY IF EXISTS bdos_imports_delete_blocked ON storage.objects;
CREATE POLICY bdos_imports_delete_blocked
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'bdos-imports' AND false);

-- Nota: sem COMMENT ON POLICY aqui — storage.objects é gerenciada pelo
-- Supabase (owner é um role interno), e COMMENT ON POLICY exige
-- ownership real da relação, que o role de migração não tem
-- (confirmado ao vivo: SQLSTATE 42501 "must be owner of relation
-- objects"). CREATE POLICY/DROP POLICY funcionam normalmente; só o
-- comentário de documentação não é permitido nesta tabela.
