-- Deterministic RLS / tenant-isolation checks for the BBA demo data.
-- Assumptions:
--   1. The core schema migrations were applied.
--   2. The demo seed from supabase/seeds/demo_seed_real.sql was applied.
--
-- Run this script in the Supabase SQL Editor after applying the migrations.
-- It uses request.jwt.claim.* settings so the same SQL can be executed as
-- different authenticated users in a controlled way.

CREATE OR REPLACE FUNCTION public._set_authenticated_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', user_id::text, 'role', 'authenticated')::text, true);
END;
$$;

DO $$
DECLARE
  v_client_a uuid := 'd9e849b1-cd4a-4855-888c-857d8a7a6050';
  v_client_b uuid := '9ff84319-08bf-4a67-975e-4a229effdf4d';
  v_admin uuid := '673e0c35-5afc-4c54-a82a-0c8e63279b99';
  v_company_a uuid := 'eeeeeeee-0000-0000-0000-000000000001';
  v_company_b uuid := 'eeeeeeee-0000-0000-0000-000000000002';
  v_rows integer;
BEGIN
  -- Cliente A: só deve ver o próprio profile.
  PERFORM public._set_authenticated_user(v_client_a);

  SELECT COUNT(*) INTO v_rows FROM public.profiles;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Client A should see exactly one profile row, saw %', v_rows;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id <> v_client_a) THEN
    RAISE EXCEPTION 'Client A can read another profile row';
  END IF;

  -- Cliente A: só deve ver a própria company.
  SELECT COUNT(*) INTO v_rows FROM public.companies;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Client A should see exactly one company row, saw %', v_rows;
  END IF;

  IF EXISTS (SELECT 1 FROM public.companies WHERE id <> v_company_a) THEN
    RAISE EXCEPTION 'Client A can read another company row';
  END IF;

  -- Cliente A: não deve ler dados do tenant B.
  IF EXISTS (SELECT 1 FROM public.tasks WHERE company_id = v_company_b) THEN
    RAISE EXCEPTION 'Client A can read company B task rows';
  END IF;

  -- Cliente A: não deve trocar de tenant via profile.company_id.
  WITH updated AS (
    UPDATE public.profiles
    SET company_id = v_company_b
    WHERE id = auth.uid()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_rows FROM updated;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Client A could change its tenant assignment';
  END IF;

  -- Cliente A: não deve atualizar dados de outro tenant.
  WITH updated AS (
    UPDATE public.tasks
    SET title = 'tampered-by-client-a'
    WHERE company_id = v_company_b
    RETURNING id
  )
  SELECT COUNT(*) INTO v_rows FROM updated;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Client A updated company B tasks';
  END IF;

  -- Cliente A: não deve deletar dados de outro tenant.
  WITH deleted AS (
    DELETE FROM public.tasks
    WHERE company_id = v_company_b
    RETURNING id
  )
  SELECT COUNT(*) INTO v_rows FROM deleted;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Client A deleted company B tasks';
  END IF;

  -- Cliente A: não deve se autopromover para bba_admin.
  WITH updated AS (
    UPDATE public.profiles
    SET role = 'bba_admin'
    WHERE id = auth.uid()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_rows FROM updated;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Client A promoted itself to bba_admin';
  END IF;

  -- Admin BBA: deve ver todos os tenants permitidos.
  PERFORM public._set_authenticated_user(v_admin);

  SELECT COUNT(*) INTO v_rows FROM public.companies;
  IF v_rows < 3 THEN
    RAISE EXCEPTION 'BBA admin should see all companies, saw %', v_rows;
  END IF;

  SELECT COUNT(DISTINCT company_id) INTO v_rows FROM public.tasks;
  IF v_rows < 3 THEN
    RAISE EXCEPTION 'BBA admin should see multi-tenant task data, saw % distinct companies', v_rows;
  END IF;
END $$;
