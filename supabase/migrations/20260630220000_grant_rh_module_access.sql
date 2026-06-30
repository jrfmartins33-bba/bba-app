-- Grants required by the Trabalhista/RH module.
-- RLS policies still decide which rows each authenticated user can access.

DO $$
DECLARE
  table_name TEXT;
BEGIN
  -- Reference tables (read-only)
  FOREACH table_name IN ARRAY ARRAY[
    'ref_salario_minimo',
    'ref_irpf_faixas',
    'ref_irpf_deducoes',
    'ref_inss_faixas',
    'ref_inss_tetos',
    'ref_fgts',
    'ref_inss_contribuicao_empresa',
    'ref_cbo',
    'ref_contribuicao_sindical'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
    END IF;
  END LOOP;

  -- Transactional RH tables (read + write)
  FOREACH table_name IN ARRAY ARRAY[
    'rh_funcionarios',
    'rh_folha_pagamentos'
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
