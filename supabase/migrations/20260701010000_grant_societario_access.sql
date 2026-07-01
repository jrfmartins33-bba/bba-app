-- Grants required by the Societário module.
-- RLS policies still decide which rows each authenticated user can access.

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'societario_socios',
    'societario_capital_social',
    'societario_alteracoes',
    'societario_assembleias'
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
