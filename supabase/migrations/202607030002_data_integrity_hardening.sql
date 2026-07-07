-- ============================================================
-- SEC-03 — Data Integrity hardening
-- ============================================================

-- 1) Regras de integridade para profiles/companies
CREATE OR REPLACE FUNCTION public.profiles_validate_client_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'client' AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'profiles.role = client requires company_id';
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE UPDATE only, not INSERT: the real signup flow (handle_new_user()
-- in 202506280001, followed by packages/lib/src/auth.ts) creates the
-- profile with role='client' and company_id=NULL first, then updates
-- company_id moments later once the company row exists. Firing on INSERT
-- blocked that legitimate transitional state and broke all new client
-- signups in production (confirmed live, hotfixed 2026-07-07 before this
-- file was corrected to match). The UPDATE case still blocks a client
-- being left/set back to company_id NULL after creation.
DROP TRIGGER IF EXISTS trg_profiles_validate_client_company ON public.profiles;
CREATE TRIGGER trg_profiles_validate_client_company
BEFORE UPDATE OF role, company_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_validate_client_company();

CREATE OR REPLACE FUNCTION public.companies_validate_owner_and_account_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'companies.owner_id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.owner_id
      AND p.role = 'client'
  ) THEN
    RAISE EXCEPTION 'companies.owner_id must reference a client profile';
  END IF;

  IF NEW.account_owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.account_owner_id
      AND p.role = 'bba_admin'
  ) THEN
    RAISE EXCEPTION 'companies.account_owner_id must reference a bba_admin profile';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_validate_owner_and_account_owner ON public.companies;
CREATE TRIGGER trg_companies_validate_owner_and_account_owner
BEFORE INSERT OR UPDATE OF owner_id, account_owner_id ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.companies_validate_owner_and_account_owner();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.companies WHERE owner_id IS NULL) THEN
    RAISE NOTICE 'Skipping companies.owner_id NOT NULL enforcement because existing rows are inconsistent';
  ELSE
    ALTER TABLE public.companies ALTER COLUMN owner_id SET NOT NULL;
  END IF;
END $$;

-- 2) Constraints de valor/estado para módulos financeiros/fiscais/RH/societário
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_contas_non_negative_values') THEN
    ALTER TABLE public.financial_contas
      ADD CONSTRAINT financial_contas_non_negative_values
      CHECK (saldo_inicial >= 0 AND saldo_atual >= 0 AND COALESCE(limite_cartao, 0) >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_cobrancas_non_negative_values') THEN
    ALTER TABLE public.financial_cobrancas
      ADD CONSTRAINT financial_cobrancas_non_negative_values
      CHECK (valor >= 0 AND valor_desconto >= 0 AND valor_acrescimo >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_cobrancas_dates_consistent') THEN
    ALTER TABLE public.financial_cobrancas
      ADD CONSTRAINT financial_cobrancas_dates_consistent
      CHECK (data_pagamento IS NULL OR data_pagamento >= data_emissao) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_guias_non_negative_values') THEN
    ALTER TABLE public.fiscal_guias
      ADD CONSTRAINT fiscal_guias_non_negative_values
      CHECK (valor_principal >= 0 AND valor_multa >= 0 AND valor_juros >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_guias_dates_consistent') THEN
    ALTER TABLE public.fiscal_guias
      ADD CONSTRAINT fiscal_guias_dates_consistent
      CHECK (data_pagamento IS NULL OR data_pagamento >= data_vencimento) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_notas_fiscais_non_negative_values') THEN
    ALTER TABLE public.fiscal_notas_fiscais
      ADD CONSTRAINT fiscal_notas_fiscais_non_negative_values
      CHECK (
        valor_produtos >= 0 AND valor_servicos >= 0 AND valor_frete >= 0 AND valor_seguro >= 0
        AND valor_desconto >= 0 AND valor_outros >= 0 AND valor_total >= 0
        AND base_calculo_icms >= 0 AND valor_icms >= 0 AND valor_icms_st >= 0 AND valor_ipi >= 0
        AND valor_pis >= 0 AND valor_cofins >= 0 AND base_calculo_iss >= 0 AND valor_iss >= 0
        AND valor_irrf >= 0 AND valor_inss_retido >= 0 AND valor_pcc_retido >= 0
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_notas_fiscais_dates_consistent') THEN
    ALTER TABLE public.fiscal_notas_fiscais
      ADD CONSTRAINT fiscal_notas_fiscais_dates_consistent
      CHECK (data_saida_entrada IS NULL OR data_saida_entrada >= data_emissao) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_parcelamentos_non_negative_values') THEN
    ALTER TABLE public.fiscal_parcelamentos
      ADD CONSTRAINT fiscal_parcelamentos_non_negative_values
      CHECK (
        valor_total_debito >= 0 AND valor_entrada >= 0 AND valor_parcela >= 0 AND valor_pago >= 0
        AND quantidade_parcelas > 0 AND parcelas_pagas >= 0
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rh_funcionarios_non_negative_values') THEN
    ALTER TABLE public.rh_funcionarios
      ADD CONSTRAINT rh_funcionarios_non_negative_values
      CHECK (salario_base IS NULL OR salario_base >= 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rh_funcionarios_dates_consistent') THEN
    ALTER TABLE public.rh_funcionarios
      ADD CONSTRAINT rh_funcionarios_dates_consistent
      CHECK (data_demissao IS NULL OR data_demissao >= data_admissao) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rh_folha_pagamentos_non_negative_values') THEN
    ALTER TABLE public.rh_folha_pagamentos
      ADD CONSTRAINT rh_folha_pagamentos_non_negative_values
      CHECK (
        salario_bruto >= 0 AND desconto_inss >= 0 AND desconto_irpf >= 0 AND desconto_outros >= 0
        AND adicional_hrs_extras >= 0 AND adicional_outros >= 0 AND salario_liquido >= 0
        AND fgts_competencia >= 0
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.client_socios') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_socios_participacao_range') THEN
      ALTER TABLE public.client_socios
        ADD CONSTRAINT client_socios_participacao_range
        CHECK (participacao_pct IS NULL OR (participacao_pct >= 0 AND participacao_pct <= 100)) NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_socios_valor_quota_non_negative') THEN
      ALTER TABLE public.client_socios
        ADD CONSTRAINT client_socios_valor_quota_non_negative
        CHECK (valor_quota IS NULL OR valor_quota >= 0) NOT VALID;
    END IF;
  END IF;
END $$;
