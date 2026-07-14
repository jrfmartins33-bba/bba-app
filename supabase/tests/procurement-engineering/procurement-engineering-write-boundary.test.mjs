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
    "Refusing to run: set BDOS_ALLOW_DESTRUCTIVE_INTEGRATION_TESTS=true to confirm explicit authorization to run these destructive tests, aware that they write and clean up real data against the shared controlled environment described in supabase/tests/procurement-engineering/README.md. This variable proves authorization and awareness, never physical isolation from the app's normal environment — it does not, by itself, guarantee a dedicated project.",
  );
}

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. These tests require an explicitly authorized environment (see supabase/tests/procurement-engineering/README.md) — the current approved state is a shared controlled environment, not a dedicated one; a separate project remains the preferred option. This never falls back to a default or to apps/web/.env.local.`,
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

function createAnonClient() {
  // Sem login algum — a mesma credencial pública que um visitante não
  // autenticado teria. Usada só para provar que os dois auxiliares
  // (get_company_id_for_actor/is_bba_admin_actor) negam EXECUTE mesmo sem
  // nenhuma sessão, não só para usuários autenticados de outra organização.
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
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

    await runTest("última verificação de privilégios dos auxiliares: nem anon nem authenticated executam get_company_id_for_actor/is_bba_admin_actor — a migração 20260714000004 restringiu as 4 funções de mutação, mas nunca havia restringido os dois auxiliares que elas chamam (achado desta correção), corrigido em 20260714000005", async () => {
      const anonClient = createAnonClient();

      const { error: anonCompanyError } = await anonClient.rpc("get_company_id_for_actor", { p_actor_id: clientAId });
      assertPermissionDenied(anonCompanyError, "get_company_id_for_actor via anon (sem sessão nenhuma)");

      const { error: anonAdminError } = await anonClient.rpc("is_bba_admin_actor", { p_actor_id: clientAId });
      assertPermissionDenied(anonAdminError, "is_bba_admin_actor via anon (sem sessão nenhuma)");

      const { error: authCompanyError } = await authenticatedClient.rpc("get_company_id_for_actor", { p_actor_id: clientAId });
      assertPermissionDenied(authCompanyError, "get_company_id_for_actor via authenticated");

      const { error: authAdminError } = await authenticatedClient.rpc("is_bba_admin_actor", { p_actor_id: clientAId });
      assertPermissionDenied(authAdminError, "is_bba_admin_actor via authenticated");

      // A negação de EXECUTE em si é a prova de que não há enumeração
      // possível: sem nenhum caminho de chamada disponível para
      // `authenticated`/`anon`, não existe forma de usar estes auxiliares
      // para descobrir a organização ou o papel de outro usuário — não é
      // um filtro de resultado, é a ausência total de acesso à função.
    });

    await runTest("última verificação de privilégios dos auxiliares: service_role obtém o resultado correto — ator conhecido, ator sem organização, administrador BBA, ator inexistente", async () => {
      const { data: ownCompany, error: ownCompanyError } = await serviceRoleClient.rpc("get_company_id_for_actor", { p_actor_id: clientAId });
      assertEqual(ownCompanyError, null, ownCompanyError?.message);
      assertEqual(ownCompany, companyAId, "get_company_id_for_actor must return the actor's real company_id");

      const { data: notAdmin, error: notAdminError } = await serviceRoleClient.rpc("is_bba_admin_actor", { p_actor_id: clientAId });
      assertEqual(notAdminError, null, notAdminError?.message);
      assertEqual(notAdmin, false, "a regular client actor must not be reported as bba_admin");

      const nonExistentActorId = crypto.randomUUID();
      const { data: missingCompany, error: missingCompanyError } = await serviceRoleClient.rpc("get_company_id_for_actor", { p_actor_id: nonExistentActorId });
      assertEqual(missingCompanyError, null, missingCompanyError?.message);
      assertEqual(missingCompany, null, "a non-existent actor must resolve to no organization, never an error masking as authorization");

      const { data: missingIsAdmin, error: missingIsAdminError } = await serviceRoleClient.rpc("is_bba_admin_actor", { p_actor_id: nonExistentActorId });
      assertEqual(missingIsAdminError, null, missingIsAdminError?.message);
      assertEqual(missingIsAdmin, false, "a non-existent actor must never be reported as bba_admin — absence of a row must never grant authorization");

      if (adminId === undefined) {
        console.log("  (skipped: RLS_TEST_ADMIN_ID not set — admin/no-organization scenario not exercised)");
        return;
      }

      // O administrador BBA de teste (profiles.role = 'bba_admin') não tem
      // company_id própria — serve também como o caso real de "ator sem
      // organização", sem precisar de um terceiro perfil de teste.
      const { data: adminCompany, error: adminCompanyError } = await serviceRoleClient.rpc("get_company_id_for_actor", { p_actor_id: adminId });
      assertEqual(adminCompanyError, null, adminCompanyError?.message);
      assertEqual(adminCompany, null, "the approved behavior for an actor with no organization is a null company_id, never an error");

      const { data: isAdmin, error: isAdminError } = await serviceRoleClient.rpc("is_bba_admin_actor", { p_actor_id: adminId });
      assertEqual(isAdminError, null, isAdminError?.message);
      assertEqual(isAdmin, true, "is_bba_admin_actor must report true for the real bba_admin actor");
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
