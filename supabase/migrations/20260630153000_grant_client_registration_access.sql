-- Grants required by the client registration screen.
-- RLS policies still decide which rows each authenticated user can access.

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ref_ufs',
    'ref_paises',
    'ref_municipios',
    'ref_bancos',
    'ref_regimes_tributarios',
    'ref_naturezas_juridicas',
    'ref_tipos_documento_fiscal',
    'ref_cnae',
    'ref_cfop',
    'ref_ncm'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY[
    'client_companies',
    'client_socios',
    'client_cnaes_secundarios',
    'client_documents',
    'service_contracts',
    'service_scope_items',
    'onboarding_checklist'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO authenticated',
        table_name
      );
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
