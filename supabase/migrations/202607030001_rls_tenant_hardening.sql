-- Harden tenant isolation for profile-based company scoping.
-- Root cause: clients could change their own profile.company_id and then
-- inherit a different tenant through get_my_company_id() and related RLS policies.

CREATE OR REPLACE FUNCTION public.profiles_enforce_tenant_boundaries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id AND NOT public.is_bba_admin() THEN
      RAISE EXCEPTION 'Clients cannot change their assigned company';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_bba_admin() THEN
      RAISE EXCEPTION 'Clients cannot change their profile role';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_tenant_boundaries ON public.profiles;
CREATE TRIGGER trg_profiles_tenant_boundaries
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_enforce_tenant_boundaries();

DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;
CREATE POLICY profiles_update_own_or_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_bba_admin())
WITH CHECK (
  (id = auth.uid() AND role = 'client')
  OR public.is_bba_admin()
);
