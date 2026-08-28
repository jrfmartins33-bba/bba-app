import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Camada B — teste direcionado da migration do histórico documental
// item a item (grão de OBSERVAÇÃO item × período/medição × campo
// semântico, v2). Estático: valida forma/segurança. A migration NÃO é
// aplicada nesta rodada.
const REPO_ROOT = resolve(process.cwd(), "..", "..");
const SQL = readFileSync(resolve(REPO_ROOT, "supabase/migrations/20260828000000_measurement_item_documentary_history.sql"), "utf8");

runTest("cria a tabela com RLS habilitada, DELETE bloqueado", () => {
  assertTrue(/CREATE TABLE IF NOT EXISTS public\.measurement_item_documentary_history/.test(SQL), "tabela");
  assertTrue(/ENABLE ROW LEVEL SECURITY/.test(SQL), "RLS");
  assertTrue(/measurement_item_documentary_history_delete_blocked[\s\S]*?FOR DELETE[\s\S]*?USING \(false\)/.test(SQL), "DELETE bloqueado");
  assertTrue(/company_id = get_my_company_id\(\) OR is_bba_admin\(\)/.test(SQL), "RLS company-or-admin");
});

runTest("declara explicitamente que NÃO deve ser aplicada sem autorização e que nada é populado", () => {
  assertTrue(/N[ÃA]O APLICAR NO SUPABASE SEM AUTORIZA[ÇC][ÃA]O SEPARADA/i.test(SQL), "aviso no cabeçalho");
  assertTrue(/n[ãa]o é populada por nenhum writer nesta rodada/i.test(SQL), "nenhuma linha populada nesta rodada");
});

runTest("grão v2: uma linha por observação (item × campo semântico × Nº de medição), NUMERIC exato, sem float", () => {
  assertTrue(/quantity_decimal NUMERIC\(20, 6\)/.test(SQL) && !/quantity_decimal NUMERIC\(20, 6\) NOT NULL/.test(SQL), "quantity_decimal NUMERIC(20,6) nullable");
  assertTrue(/unit_price_decimal NUMERIC\(20, 6\)/.test(SQL), "unit_price_decimal NUMERIC(20,6)");
  assertTrue(/value_decimal NUMERIC\(20, 2\)/.test(SQL), "value_decimal NUMERIC(20,2)");
  assertTrue(/measurement_ref SMALLINT/.test(SQL), "measurement_ref (Nº da medião de referência)");
  assertTrue(!/(DOUBLE PRECISION|FLOAT4|FLOAT8)/i.test(SQL), "nenhum ponto flutuante");
});

runTest("taxonomia semântica obrigatória com CHECK: 'executada' ≠ 'medida', 'no período' ≠ 'acumulada'", () => {
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
});

runTest("confiabilidade: layout enum + numeric_format_hint + is_unambiguous + reason_if_ambiguous + identity_basis", () => {
  assertTrue(/layout TEXT NOT NULL CHECK \(layout IN \(/.test(SQL), "layout com CHECK");
  assertTrue(/'resumo_label_bleed'/.test(SQL) && /'not_item_memoria'/.test(SQL), "valores de layout");
  assertTrue(/numeric_format_hint TEXT NOT NULL DEFAULT 'ambiguous'[\s\S]*?CHECK \(numeric_format_hint IN \('comma_decimal', 'dot_decimal', 'ambiguous'\)\)/.test(SQL), "numeric_format_hint enum");
  assertTrue(/is_unambiguous BOOLEAN NOT NULL DEFAULT false/.test(SQL), "is_unambiguous default false");
  assertTrue(/reason_if_ambiguous TEXT/.test(SQL), "reason_if_ambiguous");
  assertTrue(/identity_basis TEXT NOT NULL DEFAULT 'documentary_code_only'[\s\S]*?CHECK \(identity_basis IN \('operational_item_id', 'documentary_code_only', 'unresolved'\)\)/.test(SQL), "identity_basis enum (vínculo por id operacional, nunca por descrição)");
  assertTrue(/derived_from_cumulative BOOLEAN NOT NULL DEFAULT false/.test(SQL), "derived_from_cumulative explícito");
});

runTest("idempotência lógica: dois índices únicos parciais para o grão (measurement_ref pode ser NULL)", () => {
  assertTrue(
    /CREATE UNIQUE INDEX[\s\S]*?\(managed_service_item_id, measurement_bulletin_import_id, semantic_field, measurement_ref\)\s*\n\s*WHERE measurement_ref IS NOT NULL/.test(SQL),
    "índice único parcial com measurement_ref"
  );
  assertTrue(
    /CREATE UNIQUE INDEX[\s\S]*?\(managed_service_item_id, measurement_bulletin_import_id, semantic_field, source_sheet_name\)\s*\n\s*WHERE measurement_ref IS NULL/.test(SQL),
    "índice único parcial sem measurement_ref"
  );
});

runTest("proveniência obrigatória (aba, arquivo, células) e cascata a partir de item / boletim", () => {
  assertTrue(/source_sheet_name TEXT NOT NULL/.test(SQL) && /source_file_name TEXT NOT NULL/.test(SQL), "proveniência NOT NULL");
  assertTrue(/source_cells TEXT\[\] NOT NULL DEFAULT '\{\}'/.test(SQL), "source_cells (endereços de célula da evidência)");
  assertTrue(/managed_service_item_id UUID NOT NULL REFERENCES public\.managed_service_items\(id\) ON DELETE CASCADE/.test(SQL), "FK item");
  assertTrue(/measurement_bulletin_import_id UUID NOT NULL REFERENCES public\.measurement_bulletin_imports\(id\) ON DELETE CASCADE/.test(SQL), "FK boletim");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}
function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
