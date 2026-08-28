import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Camada B — teste direcionado da migration do histórico documental
// item a item (grão de OBSERVAÇÃO item × período/medição × campo
// semântico, v2). Estático: valida forma/segurança. A migration NÃO é
// aplicada nesta rodada.
const REPO_ROOT = resolve(process.cwd(), "..", "..");
const SQL = readFileSync(resolve(REPO_ROOT, "supabase/migrations/20260828000000_measurement_item_documentary_history.sql"), "utf8");

runTest("NÃO aplicada + cabeçalho com fatos comprovados (193/300, sem 'replanilhamento' como conclusão)", () => {
  assertTrue(/CREATE TABLE IF NOT EXISTS public\.measurement_item_documentary_history/.test(SQL), "tabela");
  assertTrue(/N[ÃA]O APLICAR NO SUPABASE SEM AUTORIZA[ÇC][ÃA]O SEPARADA/i.test(SQL), "aviso no cabeçalho");
  assertTrue(/n[ãa]o é populada por nenhum writer nesta rodada/i.test(SQL), "nenhuma linha populada nesta rodada");
  assertTrue(/193 \/ 300 itens sem hist[óo]rico documental recuper[áa]vel/.test(SQL), "número exato 193/300 (não '~229')");
  assertTrue(!/~229|pendentes de replanilhamento/i.test(SQL), "sem aproximação '~229' e sem 'pendentes de replanilhamento' (conclusão não comprovada)");
  assertTrue(/29 itens com QUANTIDADE DOCUMENTAL acima da quantidade/i.test(SQL) && /observa[çc][ãa]o factual/i.test(SQL), "29 itens descritos factualmente, não como conclusão");
});

runTest("VALOR DERIVADO DE REFERÊNCIA — nomenclatura inequívoca, com chave de política e CHECK", () => {
  assertTrue(/derived_reference_value_decimal NUMERIC\(20, 2\)/.test(SQL), "coluna derived_reference_value_decimal NUMERIC(20,2)");
  assertTrue(/derived_reference_monetary_policy_key TEXT/.test(SQL), "coluna da chave de política monetária");
  assertTrue(!/\bvalue_decimal\b|\bvalue_is_derived\b/.test(SQL), "modelo antigo (value_decimal / value_is_derived) removido");
  assertTrue(/VALOR DERIVADO DE REFERÊNCIA/.test(SQL), "campo nomeado 'VALOR DERIVADO DE REFERÊNCIA'");
  const docMentions = SQL.match(/valor documental/gi) ?? [];
  const negatedMentions = SQL.match(/N[ÃA]O é "?valor documental/gi) ?? [];
  assertTrue(docMentions.length === negatedMentions.length, "'valor documental' só aparece negado — nunca como rótulo do campo derivado");
  assertTrue(
    /CHECK \(derived_reference_value_decimal IS NULL OR derived_reference_monetary_policy_key IS NOT NULL\)/.test(SQL),
    "CHECK: valor derivado NOT NULL exige política NOT NULL"
  );
  assertTrue(/source-document-truncation-to-cents/.test(SQL) && /N[ÃA]O é default/i.test(SQL), "política do BM08 citada, sem virar default universal");
});

runTest("identidade persistida = SOMENTE id operacional (sem coluna identity_basis, sem 'documentary_code_only'/'unresolved')", () => {
  assertTrue(!/identity_basis TEXT/.test(SQL), "coluna identity_basis removida (a FK NOT NULL é a identidade)");
  assertTrue(!/documentary_code_only|'unresolved'/.test(SQL), "valores de identidade não-autoritativa não aparecem");
  assertTrue(
    /managed_service_item_id UUID NOT NULL REFERENCES public\.managed_service_items\(id\) ON DELETE CASCADE/.test(SQL),
    "FK NOT NULL para managed_service_items é a base de identidade"
  );
  assertTrue(/Nunca vínculo por descri[çc][ãa]o\/similaridade/i.test(SQL), "COMMENT trava o critério de identidade");
});

runTest("SÓ observações inequívocas são persistíveis — CHECK bloqueia ambiguidade", () => {
  assertTrue(
    /CHECK \(is_unambiguous = true AND semantic_field <> 'ambiguous' AND numeric_format_hint <> 'ambiguous'\)/.test(SQL),
    "CHECK: is_unambiguous = true, semantic_field != ambiguous, formato != ambiguous"
  );
  assertTrue(/quantity_decimal NUMERIC\(20, 6\) NOT NULL/.test(SQL), "quantity_decimal NOT NULL (ausência documental fica fora)");
  assertTrue(/S[ÓO] OBSERVA[ÇC][ÃA]O INEQU[ÍI]VOCA [ÉE] PERSIST[ÍI]VEL/i.test(SQL), "comentário: só inequívoca é persistível");
  assertTrue(/205 observa[çc][õo]es[\s\S]{0,40}ficam de fora/i.test(SQL), "comentário: as 205 ambíguas ficam de fora");
});

runTest("taxonomia semântica com CHECK: 'executada' ≠ 'medida', 'no período' ≠ 'acumulada'", () => {
  assertTrue(/semantic_field TEXT NOT NULL CHECK \(semantic_field IN \(/.test(SQL), "semantic_field com CHECK");
  for (const v of [
    "'contract_quantity'",
    "'executed_accumulated_quantity'",
    "'measured_accumulated_quantity_prior'",
    "'quantity_to_measure_in_period'",
    "'contract_balance_quantity'",
    "'monthly_series_quantity'",
    "'ambiguous'"
  ]) {
    assertTrue(SQL.includes(v), `valor de taxonomia ${v}`);
  }
  assertTrue(/scope TEXT NOT NULL CHECK \(scope IN \('period', 'accumulated_prior', 'contract', 'balance', 'unknown'\)\)/.test(SQL), "scope com CHECK");
  assertTrue(/"executada" ≠ "medida"/.test(SQL), "COMMENT trava a semântica executada≠medida");
  assertTrue(!/(DOUBLE PRECISION|FLOAT4|FLOAT8)/i.test(SQL), "nenhum ponto flutuante");
});

runTest("idempotência lógica: dois índices únicos parciais para o grão (measurement_ref pode ser NULL)", () => {
  assertTrue(
    /CREATE UNIQUE INDEX[\s\S]*?\(managed_service_item_id, measurement_bulletin_import_id, semantic_field, measurement_ref\)\s*\n\s*WHERE measurement_ref IS NOT NULL/.test(SQL),
    "índice único parcial com measurement_ref"
  );
  assertTrue(
    /CREATE UNIQUE INDEX[\s\S]*?\(managed_service_item_id, measurement_bulletin_import_id, semantic_field, source_sheet_name, period_date\)\s*\n\s*WHERE measurement_ref IS NULL/.test(SQL),
    "índice único parcial sem measurement_ref"
  );
});

runTest("segurança: privilégios explícitos — DELETE NÃO é concedido ao writer da aplicação (service_role)", () => {
  assertTrue(/ENABLE ROW LEVEL SECURITY/.test(SQL), "RLS habilitada");
  assertTrue(/REVOKE ALL ON public\.measurement_item_documentary_history FROM PUBLIC/.test(SQL), "REVOKE ALL de PUBLIC");
  assertTrue(/REVOKE ALL ON public\.measurement_item_documentary_history FROM anon/.test(SQL), "REVOKE ALL de anon");
  assertTrue(/REVOKE ALL ON public\.measurement_item_documentary_history FROM service_role/.test(SQL), "REVOKE ALL de service_role (antes do GRANT seletivo)");
  assertTrue(/GRANT SELECT ON public\.measurement_item_documentary_history TO authenticated/.test(SQL), "authenticated: SELECT apenas");
  assertTrue(/GRANT SELECT, INSERT, UPDATE ON public\.measurement_item_documentary_history TO service_role/.test(SQL), "service_role: SELECT+INSERT+UPDATE, sem DELETE");
  assertTrue(!/GRANT[^;]*DELETE[^;]*measurement_item_documentary_history/.test(SQL), "DELETE não é concedido a papel nenhum");
  assertTrue(/DELETE deliberadamente N[ÃA]O concedido/i.test(SQL), "comentário explícito sobre DELETE");
  assertTrue(/RLS não se aplica a service_role/i.test(SQL), "afirmação tecnicamente correta sobre service_role × RLS");
  assertTrue(
    /measurement_item_documentary_history_select_company_or_admin[\s\S]*?FOR SELECT[\s\S]*?USING \(company_id = get_my_company_id\(\) OR is_bba_admin\(\)\)/.test(SQL),
    "SELECT company-or-admin"
  );
  assertTrue(/measurement_item_documentary_history_client_insert_blocked[\s\S]*?WITH CHECK \(false\)/.test(SQL), "INSERT do cliente bloqueado (defesa em profundidade)");
  assertTrue(/measurement_item_documentary_history_delete_blocked[\s\S]*?FOR DELETE[\s\S]*?USING \(false\)/.test(SQL), "DELETE do cliente bloqueado");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}
function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
