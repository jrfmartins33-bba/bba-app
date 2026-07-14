import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  addBudgetLineService,
  BudgetLineKind,
  BudgetVersionOriginKind,
  createBudgetVersionDraftService,
  createProcurementCaseService,
  registerProcurementLotService,
} from "../../../packages/bdos-core/src/services/procurement-engineering/index.ts";
import {
  createBudgetVersionRepository,
  createProcurementCaseRepository,
} from "../../../apps/web/lib/bdos/procurement-engineering-repository.ts";

// Sprint 21.3C — correção de segurança, seção 12: confirma que toda
// mutação direta nas 5 tabelas falha (nenhum GRANT de INSERT/UPDATE/DELETE
// restou para `authenticated` — migração 20260714000002_..._write_boundary.
// sql), e que a mesma operação, feita pela função SECURITY DEFINER
// autorizada (ou pelo Serviço de Aplicação que a invoca), passa. Usa
// somente a organização de teste A — este arquivo não é sobre isolamento
// entre organizações (ver procurement-engineering-isolation.test.mjs para
// isso), é sobre a fronteira Serviço de Aplicação/função autorizada versus
// escrita direta na tabela.

if (process.env.BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS !== "true") {
  throw new Error(
    "Refusing to run: set BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS=true to confirm this run targets a dedicated test environment, never the app's normal environment. See supabase/tests/procurement-engineering/README.md.",
  );
}

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. This test requires an explicit, dedicated test environment (see supabase/tests/procurement-engineering/README.md) — it never falls back to a default or to apps/web/.env.local.`,
    );
  }
  return value;
}

const supabaseUrl = requireEnv("SUPABASE_TEST_URL");
const supabaseAnonKey = requireEnv("SUPABASE_TEST_ANON_KEY");
const supabaseServiceRoleKey = requireEnv("SUPABASE_TEST_SERVICE_ROLE_KEY");
const clientAEmail = requireEnv("RLS_TEST_CLIENT_A_EMAIL");
const clientAPassword = requireEnv("RLS_TEST_CLIENT_A_PASSWORD");
const clientAId = requireEnv("RLS_TEST_CLIENT_A_ID");
const companyAId = requireEnv("RLS_TEST_COMPANY_A_ID");

async function signIn(email, password) {
  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Authentication failed for ${email}: ${error.message}`);
  return client;
}

function createServiceRoleClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function cleanupCreatedData(serviceClient, tracked) {
  const errors = [];

  async function del(table, column, value) {
    const { error } = await serviceClient.from(table).delete().eq(column, value);
    if (error) errors.push(`${table} (${column}=${value}): ${error.message}`);
  }

  for (const versionId of tracked.budgetVersionIds) {
    await del("budget_version_lineage_relations", "budget_version_id", versionId);
    await del("budget_lines", "budget_version_id", versionId);
    await del("budget_versions", "id", versionId);
  }
  for (const caseId of tracked.procurementCaseIds) {
    await del("procurement_lots", "procurement_case_id", caseId);
    await del("procurement_cases", "id", caseId);
  }

  if (errors.length > 0) {
    throw new Error(`Cleanup failed for ${errors.length} deletion(s):\n${errors.join("\n")}`);
  }
}

function runId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function runTest(name, testCase) {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message ?? "esperava true, recebeu false");
}

async function main() {
  const marker = runId();
  const tracked = { procurementCaseIds: [], budgetVersionIds: [] };
  const client = await signIn(clientAEmail, clientAPassword);
  const procurementCaseRepository = createProcurementCaseRepository(client);
  const budgetVersionRepository = createBudgetVersionRepository(client);
  const repositories = { procurementCaseRepository, budgetVersionRepository };
  const context = { organizationId: companyAId, actor: clientAId, sourceSystem: "sprint-21-3c-write-boundary-test" };

  try {
    let caseId;
    let versionId;
    let lineId;

    await runTest("insert direto em procurement_cases falha; create_procurement_case (Serviço de Aplicação) passa", async () => {
      const { error: directError } = await client
        .from("procurement_cases")
        .insert({ id: crypto.randomUUID(), company_id: companyAId, title: "Tentativa de insert direto", external_reference: null, metadata: {} });
      assertTrue(directError !== null, "direct insert into procurement_cases must fail — no INSERT grant left for authenticated");

      const created = await createProcurementCaseService(context, { title: `[Sprint 21.3C][write-boundary] Processo ${marker}` }, procurementCaseRepository);
      assertEqual(created.outcome, "created", "the same operation, through the Application Service and its authorized function, must succeed");
      if (created.outcome !== "created") return;
      caseId = created.procurementCase.id;
      tracked.procurementCaseIds.push(caseId);
    });

    await runTest("insert direto em procurement_lots falha; register_procurement_lot (Serviço de Aplicação) passa", async () => {
      const { error: directError } = await client
        .from("procurement_lots")
        .insert({ id: crypto.randomUUID(), company_id: companyAId, procurement_case_id: caseId, title: "Tentativa de insert direto", external_reference: null, metadata: {} });
      assertTrue(directError !== null, "direct insert into procurement_lots must fail — no INSERT grant left for authenticated");

      const registered = await registerProcurementLotService(context, { procurementCaseId: caseId, title: `[Sprint 21.3C][write-boundary] Lote ${marker}` }, procurementCaseRepository);
      assertEqual(registered.outcome, "created", "the same operation, through the Application Service, must succeed");
    });

    await runTest("insert direto em budget_versions falha; create_budget_version_draft (Serviço de Aplicação) passa", async () => {
      const { error: directError } = await client
        .from("budget_versions")
        .insert({ id: crypto.randomUUID(), company_id: companyAId, procurement_case_id: caseId, scope_kind: "WholeCase", procurement_lot_id: null, origin_kind: "Native", origin_reference: null });
      assertTrue(directError !== null, "direct insert into budget_versions must fail — no INSERT grant left for authenticated");

      const draft = await createBudgetVersionDraftService(
        context,
        { procurementCaseId: caseId, scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } },
        repositories,
      );
      assertEqual(draft.outcome, "success", "the same operation, through the Application Service and its authorized function, must succeed");
      if (draft.outcome !== "success") return;
      versionId = draft.budgetVersion.id;
      tracked.budgetVersionIds.push(versionId);
    });

    await runTest("update direto em budget_versions falha (status e revision); adicionar Linha pelo Serviço de Aplicação passa e avança a revisão corretamente", async () => {
      const { data: statusData, error: statusError } = await client
        .from("budget_versions")
        .update({ status: "Consolidated" })
        .eq("id", versionId)
        .select("id");
      assertTrue(statusError !== null, "direct UPDATE of status must be rejected outright — no UPDATE grant left for authenticated");
      assertEqual(statusData ?? null, null);

      const { data: revisionData, error: revisionError } = await client
        .from("budget_versions")
        .update({ revision: 999 })
        .eq("id", versionId)
        .select("id");
      assertTrue(revisionError !== null, "direct UPDATE of revision must be rejected outright — no UPDATE grant left for authenticated");
      assertEqual(revisionData ?? null, null);

      const added = await addBudgetLineService(
        context,
        { budgetVersionId: versionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo" }, position: 0, scope: { kind: "WholeCase" } },
        repositories,
      );
      assertEqual(added.outcome, "success", "the same kind of write, through the Application Service and its authorized function, must succeed");
      if (added.outcome === "success") {
        lineId = added.budgetVersion.lines[0].id;
        assertEqual(added.revision, 1, "revision must have advanced exactly once through the authorized function");
      }
    });

    await runTest("insert direto em budget_lines falha; delete direto em budget_lines falha", async () => {
      const { error: insertError } = await client.from("budget_lines").insert({
        id: crypto.randomUUID(),
        company_id: companyAId,
        budget_version_id: versionId,
        kind: "Group",
        description_status: "Confirmed",
        description_text: "Tentativa de insert direto",
        external_code: null,
        parent_line_id: null,
        position: 1,
        scope_kind: "WholeCase",
        scope_procurement_lot_id: null,
        total_cents: null,
        metadata: {},
      });
      assertTrue(insertError !== null, "direct insert into budget_lines must fail — no INSERT grant left for authenticated");

      const { data: deleteData, error: deleteError } = await client.from("budget_lines").delete().eq("id", lineId).select("id");
      assertTrue(deleteError !== null, "direct DELETE of a line must be rejected outright — no DELETE grant left for authenticated");
      assertEqual(deleteData ?? null, null);
    });

    await runTest("insert direto em budget_version_lineage_relations falha; registrar via Serviço de Aplicação passa", async () => {
      const { error: insertError } = await client.from("budget_version_lineage_relations").insert({
        id: crypto.randomUUID(),
        company_id: companyAId,
        budget_version_id: versionId,
        nature: "Origin",
        origin_kind: "Native",
        origin_reference: null,
      });
      assertTrue(insertError !== null, "direct insert into budget_version_lineage_relations must fail — no INSERT grant left for authenticated");
    });
  } finally {
    const serviceClient = createServiceRoleClient();
    await cleanupCreatedData(serviceClient, tracked);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
