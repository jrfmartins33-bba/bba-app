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
} from "../../../apps/web/lib/bdos/procurement-engineering-server-repository.ts";

// Sprint 21.3C — correção de fechamento da fronteira de confiança
// (revisão final): as 4 funções de mutação (create_procurement_case,
// register_procurement_lot, create_budget_version_draft,
// persist_budget_version_snapshot) tiveram EXECUTE revogado de
// `authenticated`/`anon`/PUBLIC e concedido só a `service_role`
// (20260714000004_..._server_only_functions.sql). Este arquivo confirma:
//
// 1. Toda tentativa de um usuário `authenticated` chamar qualquer das 4
//    funções diretamente falha por falta de permissão de EXECUTE — mesmo
//    com payload sintaticamente válido da própria organização (seção 8/9
//    da correção).
// 2. O caminho confiável (cliente de `service_role`, ator já resolvido)
//    continua funcionando (seção 10).
// 3. A validação ator-organização dentro das funções funciona: mesmo
//    usando `service_role`, um ator só pode operar a própria organização,
//    exceto administrador BBA (seção 4/11).
// 4. `created_by` persistido é sempre o ator validado, nunca um valor
//    independente (seção 5).

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
const companyBId = requireEnv("RLS_TEST_COMPANY_B_ID");
// Opcional: quando presente, exercita o comportamento real de administrador
// BBA (seção 4/11 — "conforme a regra real já existente"). Sem essa
// variável, os cenários de admin são pulados explicitamente, nunca
// simulados.
const adminId = process.env.RLS_TEST_ADMIN_ID;

async function signIn(email, password) {
  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Authentication failed for ${email}: ${error.message}`);
  return client;
}

function createServiceRoleClient() {
  // A camada de servidor confiável (Sprint futura, Route Handler ainda não
  // implementada nesta Sprint) usaria exatamente este tipo de cliente —
  // autenticado com a chave de service_role, nunca a chave pública — para
  // chamar os Serviços de Aplicação, depois de já ter resolvido e
  // revalidado o ator via apps/web/lib/supabase/server.ts
  // (getSupabaseRouteHandlerClient + requireAuthenticatedCompany).
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

function assertPermissionDenied(error, label) {
  assertTrue(error !== null, `${label}: expected an error, got success`);
  assertEqual(error.code, "42501", `${label}: expected a permission-denied error (42501), got ${JSON.stringify(error)}`);
}

async function main() {
  const marker = runId();
  const tracked = { procurementCaseIds: [], budgetVersionIds: [] };
  const authenticatedClient = await signIn(clientAEmail, clientAPassword);
  const serviceRoleClient = createServiceRoleClient();

  try {
    await runTest("seção 8: authenticated não executa nenhuma das 4 funções de mutação, mesmo com payload sintaticamente válido da própria organização", async () => {
      const { error: caseError } = await authenticatedClient.rpc("create_procurement_case", {
        p_actor_id: clientAId,
        p_company_id: companyAId,
        p_id: crypto.randomUUID(),
        p_title: "Tentativa direta",
        p_external_reference: null,
        p_metadata: {},
        p_correlation_id: null,
        p_source_system: null,
      });
      assertPermissionDenied(caseError, "create_procurement_case");

      const { error: lotError } = await authenticatedClient.rpc("register_procurement_lot", {
        p_actor_id: clientAId,
        p_company_id: companyAId,
        p_id: crypto.randomUUID(),
        p_procurement_case_id: crypto.randomUUID(),
        p_title: "Tentativa direta",
        p_external_reference: null,
        p_metadata: {},
        p_correlation_id: null,
        p_source_system: null,
      });
      assertPermissionDenied(lotError, "register_procurement_lot");

      const { error: draftError } = await authenticatedClient.rpc("create_budget_version_draft", {
        p_actor_id: clientAId,
        p_company_id: companyAId,
        p_id: crypto.randomUUID(),
        p_procurement_case_id: crypto.randomUUID(),
        p_scope_kind: "WholeCase",
        p_procurement_lot_id: null,
        p_origin_kind: "Native",
        p_origin_reference: null,
        p_metadata: {},
        p_correlation_id: null,
        p_source_system: null,
        p_lineage_id: null,
        p_lineage_origin_kind: null,
        p_lineage_origin_reference: null,
      });
      assertPermissionDenied(draftError, "create_budget_version_draft");

      const { error: snapshotError } = await authenticatedClient.rpc("persist_budget_version_snapshot", {
        p_actor_id: clientAId,
        p_company_id: companyAId,
        p_budget_version_id: crypto.randomUUID(),
        p_expected_revision: 0,
        p_status: "Draft",
        p_lines: [],
        p_lineage_id: null,
        p_lineage_origin_kind: null,
        p_lineage_origin_reference: null,
      });
      assertPermissionDenied(snapshotError, "persist_budget_version_snapshot");
    });

    let realCaseId;
    let realLotId;
    let realVersionId;

    await runTest("seção 10: caminho confiável (service_role, ator já resolvido) cria Processo, Lote, Versão e Linha normalmente", async () => {
      const procurementCaseRepository = createProcurementCaseRepository(serviceRoleClient);
      const budgetVersionRepository = createBudgetVersionRepository(serviceRoleClient);
      const repositories = { procurementCaseRepository, budgetVersionRepository };
      const context = { organizationId: companyAId, actor: clientAId, sourceSystem: "sprint-21-3c-write-boundary-test" };

      const createdCase = await createProcurementCaseService(context, { title: `[Sprint 21.3C][write-boundary] Processo ${marker}` }, procurementCaseRepository);
      assertEqual(createdCase.outcome, "created");
      if (createdCase.outcome !== "created") return;
      realCaseId = createdCase.procurementCase.id;
      tracked.procurementCaseIds.push(realCaseId);

      const createdLot = await registerProcurementLotService(context, { procurementCaseId: realCaseId, title: `[Sprint 21.3C][write-boundary] Lote ${marker}` }, procurementCaseRepository);
      assertEqual(createdLot.outcome, "created");
      if (createdLot.outcome === "created") realLotId = createdLot.procurementLot.id;

      const draft = await createBudgetVersionDraftService(context, { procurementCaseId: realCaseId, scope: { kind: "WholeCase" }, origin: { kind: BudgetVersionOriginKind.Native } }, repositories);
      assertEqual(draft.outcome, "success");
      if (draft.outcome !== "success") return;
      realVersionId = draft.budgetVersion.id;
      tracked.budgetVersionIds.push(realVersionId);

      const added = await addBudgetLineService(
        context,
        { budgetVersionId: realVersionId, kind: BudgetLineKind.Group, description: { status: "Confirmed", text: "Grupo" }, position: 0, scope: { kind: "WholeCase" } },
        repositories,
      );
      assertEqual(added.outcome, "success");
      if (added.outcome === "success") {
        assertEqual(added.revision, 1);
      }

      // created_by persistido é exatamente o ator validado — nunca um
      // valor independente (não existe mais p_created_by como parâmetro).
      const { data: caseRow, error: caseRowError } = await serviceRoleClient.from("procurement_cases").select("created_by").eq("id", realCaseId).single();
      assertEqual(caseRowError, null, caseRowError?.message);
      assertEqual(caseRow.created_by, clientAId, "created_by must be exactly the validated actor");
    });

    await runTest("seção 9: authenticated não contorna o domínio chamando persist_budget_version_snapshot diretamente, mesmo com dados válidos da própria organização — todas as tentativas falham antes de qualquer escrita, e a Versão persistida permanece intacta", async () => {
      assertTrue(typeof realVersionId === "string", "the trusted-path test must have run first");

      const { data: beforeRow, error: beforeError } = await serviceRoleClient.from("budget_versions").select("revision, status").eq("id", realVersionId).single();
      assertEqual(beforeError, null, beforeError?.message);

      const malformedAttempts = [
        {
          label: "1. versão consolidada retornando para rascunho",
          payload: { p_status: "Draft", p_lines: [], p_expected_revision: beforeRow.revision },
        },
        {
          label: "2. nova Linha em versão consolidada",
          payload: {
            p_status: beforeRow.status,
            p_lines: [{ id: crypto.randomUUID(), kind: "Group", descriptionStatus: "Confirmed", descriptionText: "x", externalCode: null, parentLineId: null, position: 99, scopeKind: "WholeCase", scopeProcurementLotId: null, totalCents: null, metadata: {} }],
            p_expected_revision: beforeRow.revision,
          },
        },
        {
          label: "3. Subgrupo sem Grupo",
          payload: {
            p_status: beforeRow.status,
            p_lines: [{ id: crypto.randomUUID(), kind: "Subgroup", descriptionStatus: "Confirmed", descriptionText: "x", externalCode: null, parentLineId: null, position: 0, scopeKind: "WholeCase", scopeProcurementLotId: null, totalCents: null, metadata: {} }],
            p_expected_revision: beforeRow.revision,
          },
        },
        {
          label: "4. Grupo com pai",
          payload: {
            p_status: beforeRow.status,
            p_lines: [
              { id: crypto.randomUUID(), kind: "Group", descriptionStatus: "Confirmed", descriptionText: "pai", externalCode: null, parentLineId: null, position: 0, scopeKind: "WholeCase", scopeProcurementLotId: null, totalCents: null, metadata: {} },
              { id: crypto.randomUUID(), kind: "Group", descriptionStatus: "Confirmed", descriptionText: "filho ilegítimo", externalCode: null, parentLineId: null, position: 1, scopeKind: "WholeCase", scopeProcurementLotId: null, totalCents: null, metadata: {} },
            ],
            p_expected_revision: beforeRow.revision,
          },
        },
        {
          label: "5. Linha de lote diferente do Escopo restrito da Versão",
          payload: {
            p_status: beforeRow.status,
            p_lines: [{ id: crypto.randomUUID(), kind: "Group", descriptionStatus: "Confirmed", descriptionText: "x", externalCode: null, parentLineId: null, position: 0, scopeKind: "Lot", scopeProcurementLotId: crypto.randomUUID(), totalCents: null, metadata: {} }],
            p_expected_revision: beforeRow.revision,
          },
        },
        {
          label: "6. posições duplicadas",
          payload: {
            p_status: beforeRow.status,
            p_lines: [
              { id: crypto.randomUUID(), kind: "Group", descriptionStatus: "Confirmed", descriptionText: "a", externalCode: null, parentLineId: null, position: 0, scopeKind: "WholeCase", scopeProcurementLotId: null, totalCents: null, metadata: {} },
              { id: crypto.randomUUID(), kind: "Group", descriptionStatus: "Confirmed", descriptionText: "b", externalCode: null, parentLineId: null, position: 0, scopeKind: "WholeCase", scopeProcurementLotId: null, totalCents: null, metadata: {} },
            ],
            p_expected_revision: beforeRow.revision,
          },
        },
        {
          label: "7. Relação de Rastreabilidade divergente da origem",
          payload: {
            p_status: beforeRow.status,
            p_lines: [],
            p_expected_revision: beforeRow.revision,
            p_lineage_id: crypto.randomUUID(),
            p_lineage_origin_kind: "DocumentaryOpaqueReference",
            p_lineage_origin_reference: "arquivo-nao-relacionado.xlsx",
          },
        },
      ];

      for (const attempt of malformedAttempts) {
        const { error } = await authenticatedClient.rpc("persist_budget_version_snapshot", {
          p_actor_id: clientAId,
          p_company_id: companyAId,
          p_budget_version_id: realVersionId,
          p_lineage_id: null,
          p_lineage_origin_kind: null,
          p_lineage_origin_reference: null,
          ...attempt.payload,
        });
        assertPermissionDenied(error, attempt.label);
      }

      const { data: afterRow, error: afterError } = await serviceRoleClient.from("budget_versions").select("revision, status").eq("id", realVersionId).single();
      assertEqual(afterError, null, afterError?.message);
      assertEqual(afterRow.revision, beforeRow.revision, "revision must be untouched by every rejected attempt");
      assertEqual(afterRow.status, beforeRow.status, "status must be untouched by every rejected attempt");
    });

    await runTest("seção 4/11: ator só opera a própria organização — mesma organização permitido, organização alheia rejeitado, ator inexistente rejeitado", async () => {
      const procurementCaseRepository = createProcurementCaseRepository(serviceRoleClient);

      const ownOrg = await procurementCaseRepository.createProcurementCase(companyAId, clientAId, {
        id: crypto.randomUUID(),
        organizationId: companyAId,
        title: `[Sprint 21.3C][write-boundary] ator na própria organização ${marker}`,
        externalReference: null,
        metadata: {},
      });
      tracked.procurementCaseIds.push(ownOrg.id);

      const foreignAttemptId = crypto.randomUUID();
      let foreignError = null;
      try {
        await procurementCaseRepository.createProcurementCase(companyBId, clientAId, {
          id: foreignAttemptId,
          organizationId: companyBId,
          title: "Tentativa de ator A operando organização B",
          externalReference: null,
          metadata: {},
        });
      } catch (error) {
        foreignError = error;
      }
      assertTrue(foreignError !== null, "an actor from organization A must not be able to operate organization B, even via the trusted service_role path");

      const nonExistentActorId = crypto.randomUUID();
      let missingActorError = null;
      try {
        await procurementCaseRepository.createProcurementCase(companyAId, nonExistentActorId, {
          id: crypto.randomUUID(),
          organizationId: companyAId,
          title: "Tentativa de ator inexistente",
          externalReference: null,
          metadata: {},
        });
      } catch (error) {
        missingActorError = error;
      }
      assertTrue(missingActorError !== null, "a non-existent actor id must be rejected");
    });

    await runTest("seção 4/11: administrador BBA pode operar organização diferente da própria (comportamento real já existente)", async () => {
      if (adminId === undefined) {
        console.log("  (skipped: RLS_TEST_ADMIN_ID not set — admin scenario not exercised)");
        return;
      }

      const procurementCaseRepository = createProcurementCaseRepository(serviceRoleClient);
      const created = await procurementCaseRepository.createProcurementCase(companyAId, adminId, {
        id: crypto.randomUUID(),
        organizationId: companyAId,
        title: `[Sprint 21.3C][write-boundary] criado por admin ${marker}`,
        externalReference: null,
        metadata: {},
      });
      tracked.procurementCaseIds.push(created.id);

      const { data: row, error: rowError } = await serviceRoleClient.from("procurement_cases").select("created_by").eq("id", created.id).single();
      assertEqual(rowError, null, rowError?.message);
      assertEqual(row.created_by, adminId, "created_by must be the admin actor, exactly as validated");
    });
  } finally {
    await cleanupCreatedData(serviceRoleClient, tracked);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
