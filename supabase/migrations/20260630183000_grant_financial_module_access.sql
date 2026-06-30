-- Grants required by the financial module screen.
-- RLS policies still decide which rows each authenticated user can access.

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'financial_categorias'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY[
    'financial_contas',
    'financial_lancamentos',
    'financial_cobrancas'
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
