import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Camada B — teste direcionado da migration do histórico documental
// item a item. Estático: valida forma/segurança. A migration NÃO é
// aplicada nesta rodada.
const REPO_ROOT = resolve(process.cwd(), "..", "..");
const SQL = readFileSync(resolve(REPO_ROOT, "supabase/migrations/20260828000000_measurement_item_documentary_history.sql"), "utf8");

runTest("cria a tabela com RLS habilitada, DELETE bloqueado", () => {
  assertTrue(/CREATE TABLE IF NOT EXISTS public\.measurement_item_documentary_history/.test(SQL), "tabela");
  assertTrue(/ENABLE ROW LEVEL SECURITY/.test(SQL), "RLS");
  assertTrue(/measurement_item_documentary_history_delete_blocked[\s\S]*?FOR DELETE[\s\S]*?USING \(false\)/.test(SQL), "DELETE bloqueado");
});

runTest("declara explicitamente que NÃO deve ser aplicada sem autorização e que nada é populado", () => {
  assertTrue(/N[ÃA]O APLICAR NO SUPABASE SEM AUTORIZA[ÇC][ÃA]O SEPARADA/i.test(SQL), "aviso no cabeçalho");
  assertTrue(/n[ãa]o é populada por nenhum writer/i.test(SQL), "nenhuma linha populada");
});

runTest("quantidades em NUMERIC exato, nullable -- ausência documental = NULL", () => {
  for (const col of [
    "contract_quantity",
    "executed_accumulated_quantity",
    "measured_accumulated_quantity",
    "quantity_to_measure_in_period",
    "contract_balance_quantity"
  ]) {
    assertTrue(new RegExp(`${col} NUMERIC\\(20, 6\\)`).test(SQL), `${col} NUMERIC(20,6)`);
    assertTrue(!new RegExp(`${col} NUMERIC\\(20, 6\\) NOT NULL`).test(SQL), `${col} é nullable`);
  }
  assertTrue(!/(DOUBLE PRECISION|FLOAT4|FLOAT8)/i.test(SQL), "nenhum ponto flutuante");
});

runTest("classificação de confiabilidade: enum de layout + unambiguous BOOLEAN", () => {
  assertTrue(/layout TEXT NOT NULL CHECK \(layout IN \(/.test(SQL), "layout com CHECK");
  assertTrue(/'resumo_label_bleed'/.test(SQL) && /'not_item_memoria'/.test(SQL), "valores de layout");
  assertTrue(/unambiguous BOOLEAN NOT NULL DEFAULT false/.test(SQL), "unambiguous default false");
});

runTest("idempotência: uma linha por (item, boletim de origem)", () => {
  assertTrue(
    /CREATE UNIQUE INDEX[\s\S]*?\(managed_service_item_id, measurement_bulletin_import_id\)/.test(SQL),
    "índice único do grão"
  );
});

runTest("proveniência obrigatória e cascata a partir de item / boletim", () => {
  assertTrue(/source_sheet_name TEXT NOT NULL/.test(SQL) && /source_file_name TEXT NOT NULL/.test(SQL), "proveniência NOT NULL");
  assertTrue(/managed_service_item_id UUID NOT NULL REFERENCES public\.managed_service_items\(id\) ON DELETE CASCADE/.test(SQL), "FK item");
  assertTrue(/measurement_bulletin_import_id UUID NOT NULL REFERENCES public\.measurement_bulletin_imports\(id\) ON DELETE CASCADE/.test(SQL), "FK boletim");
});

runTest("o COMMENT trava a semântica: 'executada' ≠ 'medida' -- nunca normalizar como mesmo campo", () => {
  assertTrue(/nunca normalizar as duas como se fossem o mesmo campo/i.test(SQL), "comentário de semântica");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}
function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
