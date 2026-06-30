-- Admin BBA 2.0: allow bba_admin to read/write any client's data so the
-- "view as client" workspace switch can show fiscal, financial and
-- registration data for a company the admin does not belong to.
-- Client-facing access (company_id = own profile) is unchanged.

DROP POLICY IF EXISTS "client_companies_sel" ON client_companies;
CREATE POLICY "client_companies_sel" ON client_companies
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "client_companies_ins" ON client_companies;
CREATE POLICY "client_companies_ins" ON client_companies
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "client_companies_upd" ON client_companies;
CREATE POLICY "client_companies_upd" ON client_companies
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fobrig_sel" ON fiscal_obrigacoes;
CREATE POLICY "fobrig_sel" ON fiscal_obrigacoes
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fobrig_ins" ON fiscal_obrigacoes;
CREATE POLICY "fobrig_ins" ON fiscal_obrigacoes
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fobrig_upd" ON fiscal_obrigacoes;
CREATE POLICY "fobrig_upd" ON fiscal_obrigacoes
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fguias_sel" ON fiscal_guias;
CREATE POLICY "fguias_sel" ON fiscal_guias
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fguias_ins" ON fiscal_guias;
CREATE POLICY "fguias_ins" ON fiscal_guias
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fguias_upd" ON fiscal_guias;
CREATE POLICY "fguias_upd" ON fiscal_guias
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fnf_sel" ON fiscal_notas_fiscais;
CREATE POLICY "fnf_sel" ON fiscal_notas_fiscais
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fnf_ins" ON fiscal_notas_fiscais;
CREATE POLICY "fnf_ins" ON fiscal_notas_fiscais
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fnf_upd" ON fiscal_notas_fiscais;
CREATE POLICY "fnf_upd" ON fiscal_notas_fiscais
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fparc_sel" ON fiscal_parcelamentos;
CREATE POLICY "fparc_sel" ON fiscal_parcelamentos
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fparc_ins" ON fiscal_parcelamentos;
CREATE POLICY "fparc_ins" ON fiscal_parcelamentos
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fparc_upd" ON fiscal_parcelamentos;
CREATE POLICY "fparc_upd" ON fiscal_parcelamentos
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_contas_sel" ON financial_contas;
CREATE POLICY "fin_contas_sel" ON financial_contas
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_contas_ins" ON financial_contas;
CREATE POLICY "fin_contas_ins" ON financial_contas
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_contas_upd" ON financial_contas;
CREATE POLICY "fin_contas_upd" ON financial_contas
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_cat_sel" ON financial_categorias;
CREATE POLICY "fin_cat_sel" ON financial_categorias
FOR SELECT TO authenticated
USING (company_id IS NULL OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_cat_ins" ON financial_categorias;
CREATE POLICY "fin_cat_ins" ON financial_categorias
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_cat_upd" ON financial_categorias;
CREATE POLICY "fin_cat_upd" ON financial_categorias
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_lanc_sel" ON financial_lancamentos;
CREATE POLICY "fin_lanc_sel" ON financial_lancamentos
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_lanc_ins" ON financial_lancamentos;
CREATE POLICY "fin_lanc_ins" ON financial_lancamentos
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_lanc_upd" ON financial_lancamentos;
CREATE POLICY "fin_lanc_upd" ON financial_lancamentos
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_cob_sel" ON financial_cobrancas;
CREATE POLICY "fin_cob_sel" ON financial_cobrancas
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_cob_ins" ON financial_cobrancas;
CREATE POLICY "fin_cob_ins" ON financial_cobrancas
FOR INSERT TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());

DROP POLICY IF EXISTS "fin_cob_upd" ON financial_cobrancas;
CREATE POLICY "fin_cob_upd" ON financial_cobrancas
FOR UPDATE TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_bba_admin());
