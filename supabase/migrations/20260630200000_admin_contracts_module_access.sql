-- Admin BBA 2.0: extend the "view as client" workspace switch to the
-- Contratos module so bba_admin can read/write any client's service
-- contracts and scope items. Client-facing access (company_id = own
-- profile) is unchanged.

DROP POLICY IF EXISTS "svc_contracts_sel" ON service_contracts;
CREATE POLICY "svc_contracts_sel" ON service_contracts
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "svc_contracts_ins" ON service_contracts;
CREATE POLICY "svc_contracts_ins" ON service_contracts
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "svc_contracts_upd" ON service_contracts;
CREATE POLICY "svc_contracts_upd" ON service_contracts
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "svc_scope_sel" ON service_scope_items;
CREATE POLICY "svc_scope_sel" ON service_scope_items
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "svc_scope_ins" ON service_scope_items;
CREATE POLICY "svc_scope_ins" ON service_scope_items
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "svc_scope_upd" ON service_scope_items;
CREATE POLICY "svc_scope_upd" ON service_scope_items
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());
