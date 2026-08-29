import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Teste direcionado da migration do Cronograma Físico-Financeiro
// (Obra + Grupo). Estático: lê o .sql e valida forma/segurança. A
// migration NÃO é aplicada nesta rodada -- este teste garante que, ao
// ser aplicada com autorização, ela entra segura e imutável.
// cwd = apps/web (run-tests.mjs), raiz do repo = ../..
const REPO_ROOT = resolve(process.cwd(), "..", "..");
const SQL = readFileSync(
  resolve(REPO_ROOT, "supabase/migrations/20260827000000_bdos_physical_financial_schedule.sql"),
  "utf8"
);

runTest("cria a tabela normalizada com RLS habilitada", () => {
  assertTrue(/CREATE TABLE IF NOT EXISTS public\.physical_financial_schedule_periods/.test(SQL), "tabela deve ser criada");
  assertTrue(/ALTER TABLE public\.physical_financial_schedule_periods\s+ENABLE ROW LEVEL SECURITY/.test(SQL), "RLS deve ser habilitada");
});

runTest("é imutável -- UPDATE e DELETE bloqueados por política (USING (false))", () => {
  assertTrue(/physical_financial_schedule_periods_update_blocked[\s\S]*?FOR UPDATE[\s\S]*?USING \(false\)/.test(SQL), "UPDATE bloqueado");
  assertTrue(/physical_financial_schedule_periods_delete_blocked[\s\S]*?FOR DELETE[\s\S]*?USING \(false\)/.test(SQL), "DELETE bloqueado");
});

runTest("SELECT/INSERT escopados por empresa ou admin -- mesma disciplina de planning_datasets", () => {
  assertTrue(/FOR SELECT[\s\S]*?USING \(company_id = get_my_company_id\(\) OR is_bba_admin\(\)\)/.test(SQL), "SELECT company-or-admin");
  assertTrue(/FOR INSERT[\s\S]*?WITH CHECK \(company_id = get_my_company_id\(\) OR is_bba_admin\(\)\)/.test(SQL), "INSERT company-or-admin");
});

runTest("distingue Obra (agregado) de Grupo (N.0) e nunca aceita um 'grupo' fora do padrão de código", () => {
  assertTrue(/scope TEXT NOT NULL CHECK \(scope IN \('obra', 'group'\)\)/.test(SQL), "scope restrito a obra/group");
  assertTrue(/group_code ~ '\^\[0-9\]\+\\\.0\$'/.test(SQL), "grupo exige código no padrão N.0 -- nunca uma linha de ajuste");
  assertTrue(/scope = 'obra' AND group_code IS NULL/.test(SQL), "obra nunca carrega group_code");
});

runTest("dinheiro e percentual são NUMERIC exato -- nunca tipo de ponto flutuante", () => {
  assertTrue(/planned_period_value NUMERIC\(18, 2\)/.test(SQL), "planejado no período em NUMERIC(18,2)");
  assertTrue(/planned_accumulated_value NUMERIC\(18, 2\)/.test(SQL), "planejado acumulado em NUMERIC(18,2)");
  assertTrue(/actual_accumulated_value NUMERIC\(18, 2\)/.test(SQL), "realizado acumulado em NUMERIC(18,2)");
  assertTrue(/planned_accumulated_percent NUMERIC\(7, 2\)/.test(SQL), "percentual planejado acumulado em NUMERIC(7,2)");
  assertTrue(/actual_accumulated_percent NUMERIC\(7, 2\)/.test(SQL), "percentual realizado acumulado em NUMERIC(7,2)");
  assertTrue(!/(DOUBLE PRECISION|FLOAT4|FLOAT8)/i.test(SQL), "nenhum tipo de ponto flutuante no schema");
});

runTest("idempotência: DOIS índices únicos PARCIAIS, um por escopo -- nunca um UNIQUE de tabela que dependa de group_code para 'obra'", () => {
  // Obra: sem group_code na chave (NULL nunca protege num UNIQUE
  // convencional) -> chave é só (planning_dataset_id, period_index).
  assertTrue(
    /CREATE UNIQUE INDEX[^;]*?physical_financial_schedule_periods_obra_uniq[\s\S]*?\(planning_dataset_id, period_index\)[\s\S]*?WHERE scope = 'obra'/.test(SQL),
    "índice único parcial de obra em (planning_dataset_id, period_index) WHERE scope='obra'"
  );
  // Grupo: group_code faz parte da chave -> grupos diferentes no mesmo
  // período NÃO colidem; mesmo grupo/período colide.
  assertTrue(
    /CREATE UNIQUE INDEX[^;]*?physical_financial_schedule_periods_group_uniq[\s\S]*?\(planning_dataset_id, group_code, period_index\)[\s\S]*?WHERE scope = 'group'/.test(SQL),
    "índice único parcial de grupo em (planning_dataset_id, group_code, period_index) WHERE scope='group'"
  );
  // O UNIQUE de tabela antigo (que não protegia 'obra' por causa do NULL) sumiu.
  assertTrue(
    !/UNIQUE \(planning_dataset_id, scope, group_code, period_index\)/.test(SQL),
    "o UNIQUE de tabela que não protege NULL foi removido"
  );
  // O índice de obra não referencia group_code em lugar nenhum.
  const obraIdx = /physical_financial_schedule_periods_obra_uniq[\s\S]*?;/.exec(SQL)?.[0] ?? "";
  assertTrue(obraIdx.length > 0 && !/group_code/.test(obraIdx), "índice de obra não depende de group_code");
  // O comentário explica o porquê (NULL não colide com NULL).
  assertTrue(/NULL nunca colide[\s\S]{0,12}com NULL/i.test(SQL), "o comentário registra a razão do índice parcial");
});

runTest("cascateia a partir de planning_datasets (Camada 2) e engineering_projects", () => {
  assertTrue(/planning_dataset_id UUID NOT NULL REFERENCES public\.planning_datasets\(id\) ON DELETE CASCADE/.test(SQL), "FK para planning_datasets com cascade");
  assertTrue(/engineering_project_id UUID NOT NULL REFERENCES public\.engineering_projects\(id\) ON DELETE CASCADE/.test(SQL), "FK para engineering_projects com cascade");
});

runTest("o próprio arquivo declara que NÃO deve ser aplicado sem autorização separada", () => {
  assertTrue(/N[ÃA]O APLICAR NO SUPABASE SEM AUTORIZA[ÇC][ÃA]O SEPARADA/i.test(SQL), "aviso explícito de não-aplicação no cabeçalho");
  assertTrue(/n[ãa]o popula nada/i.test(SQL), "declara que nenhuma linha é populada nesta rodada");
});

runTest("planejado acumulado do grupo é somado das parcelas mensais -- o comentário proíbe inferir do BAC", () => {
  assertTrue(
    /nunca inferido do valor total do grupo \(BAC\) nem do percentual físico final/.test(SQL),
    "o COMMENT deve travar a semântica: soma das parcelas, nunca aproximação"
  );
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
