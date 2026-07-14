import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { calculateBudgetVersionTotal, consolidateBudgetVersion, updateBudgetLine } from "../../../packages/bdos-core/src/domain/budget-version/budget-version.ts";
import { centsFromDecimalString } from "../../../packages/bdos-core/src/domain/budget-version/budget-version-money.ts";
import {
  LAGOA_DO_ARROZ_DECLARED_TOTAL_DECIMAL,
  LAGOA_DO_ARROZ_OFFICIAL_LINES,
} from "../../../packages/bdos-core/src/domain/budget-version/lagoa-do-arroz.official-fixture.ts";
import { buildLagoaDoArrozOfficialScenario } from "../../../packages/bdos-core/src/domain/budget-version/lagoa-do-arroz.official-fixture-loader.ts";
import { BudgetLineKind, BudgetVersionStatus } from "../../../packages/bdos-core/src/services/procurement-engineering/index.ts";
import {
  createBudgetVersionRepository,
  createProcurementCaseRepository,
} from "../../../apps/web/lib/bdos/procurement-engineering-server-repository.ts";

// Sprint 21.3C — teste de persistência da fixture oficial Lagoa do Arroz.
// Monta o agregado inteiro pelo domínio puro da Sprint 21.3B
// (buildLagoaDoArrozOfficialScenario, já testado em
// lagoa-do-arroz.official-fixture.test.ts) e persiste pelo adaptador desta
// Sprint — nenhum Serviço de Aplicação de importação em massa é criado só
// para este teste. Exige um ambiente explicitamente autorizado — ver
// README.md nesta pasta ("Ambiente: compartilhado controlado, não
// dedicado"; o estado atual é compartilhado controlado, um projeto
// separado continua sendo a opção preferencial).
//
// Desde a correção de fechamento da fronteira de confiança, as 4 funções
// de mutação só são executáveis por `service_role`
// (20260714000004_..._server_only_functions.sql) — os repositórios de
// escrita usados aqui são construídos com `serviceRoleClient`, nunca com o
// cliente autenticado por senha; `clientAId` entra como `actor` em cada
// chamada de escrita, exatamente como o caminho confiável real (Serviço de
// Aplicação + adaptador de servidor) faria depois de já ter revalidado o
// usuário via sessão.
//
// A fixture usa identidades de Processo/Versão/Relação fixas e não-UUID —
// apropriadas para o domínio puro (Sprint 21.3B, onde identidade é só
// `string`), mas incompatíveis com as colunas UUID desta Sprint. As 336
// identidades de Linha (`fixtureLineId`) já são UUIDs reais e são
// preservadas exatamente; identidade de Processo/Versão/Relação/demais
// Linhas recebe um UUID novo só nesta fronteira de persistência — a mesma
// atribuição de identidade interna que create_budget_version_draft já faz
// para qualquer Versão nova.
//
// Não reextrai a planilha, não altera os dados originais da fixture, não
// grava o arquivo original, e não trata este registro como seed de
// demonstração — limpo ao final via o cliente de service role (bloco
// finally), nunca deixado como dado de produto.

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
const companyAId = requireEnv("RLS_TEST_COMPANY_A_ID");
const clientAId = requireEnv("RLS_TEST_CLIENT_A_ID");

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

async function runTest(name, testCase) {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** Remapeia as identidades não-UUID da fixture (Processo/Versão/Relação/Linhas) para UUIDs reais — ver nota de topo. */
function remapToPersistableIdentities(scenario, organizationId) {
  const realCaseId = crypto.randomUUID();
  const realVersionId = crypto.randomUUID();
  const realLineageId = crypto.randomUUID();

  const procurementCase = { ...scenario.procurementCase, id: realCaseId, organizationId };
  const scope = { ...scenario.scope, procurementCaseId: realCaseId };

  // `budget_lines.id` é chave primária global — e ADR-001 §E já exige que
  // nenhuma identidade de linha seja reutilizada entre versões, mesmo com
  // conteúdo idêntico. Cada execução deste teste contra o banco real
  // precisa de identidades de linha novas.
  const lineIdRemap = new Map(scenario.consolidatedBudgetVersion.lines.map((line) => [line.id, crypto.randomUUID()]));

  const lines = scenario.consolidatedBudgetVersion.lines.map((line) => ({
    ...line,
    id: lineIdRemap.get(line.id),
    budgetVersionId: realVersionId,
    parentLineId: line.parentLineId === null ? null : lineIdRemap.get(line.parentLineId),
    scope: { ...line.scope, procurementCaseId: realCaseId },
  }));

  const originLineage = scenario.consolidatedBudgetVersion.originLineage === null
    ? null
    : {
        ...scenario.consolidatedBudgetVersion.originLineage,
        id: realLineageId,
        organizationId,
        destinationBudgetVersionId: realVersionId,
      };

  // Persistido ainda em rascunho — a consolidação acontece explicitamente
  // depois do ciclo recarregar → alterar → salvar novamente, mais abaixo.
  const budgetVersion = {
    ...scenario.consolidatedBudgetVersion,
    id: realVersionId,
    organizationId,
    procurementCaseId: realCaseId,
    scope,
    status: BudgetVersionStatus.Draft,
    originLineage,
    lines,
  };

  return { procurementCase, budgetVersion };
}

async function main() {
  await signIn(clientAEmail, clientAPassword);
  const serviceRoleClient = createServiceRoleClient();
  const procurementCaseRepository = createProcurementCaseRepository(serviceRoleClient);
  const budgetVersionRepository = createBudgetVersionRepository(serviceRoleClient);

  const scenario = buildLagoaDoArrozOfficialScenario();
  const { procurementCase, budgetVersion: draftBudgetVersion } = remapToPersistableIdentities(scenario, companyAId);

  const tracked = { procurementCaseIds: [procurementCase.id], budgetVersionIds: [draftBudgetVersion.id] };
  const shared = { persistedVersionId: null, finalRevision: null, reloaded: null };
  const cot015RevisedText = "Cotação — item sem código hierárquico (revisado no ciclo recarregar → alterar → salvar)";

  try {
    await runTest("persiste o Processo e a Versão em rascunho com os 336 registros e a Relação de Rastreabilidade declarada na criação", async () => {
      await procurementCaseRepository.createProcurementCase(companyAId, clientAId, procurementCase);

      const draft = await budgetVersionRepository.createDraftBudgetVersion(companyAId, clientAId, { ...draftBudgetVersion, lines: [] });
      assertEqual(draft.revision, 0);
      shared.persistedVersionId = draft.entity.id;

      const saved = await budgetVersionRepository.saveBudgetVersion(companyAId, clientAId, draftBudgetVersion, draft.revision);
      assertEqual(saved.outcome, "saved");
      if (saved.outcome === "saved") {
        shared.finalRevision = saved.revision;
      }

      const reloaded = await budgetVersionRepository.loadBudgetVersion(companyAId, shared.persistedVersionId);
      assertEqual(reloaded.entity.status, BudgetVersionStatus.Draft, "must still be a draft — consolidation happens later in this test");
      assertEqual(reloaded.entity.lines.length, 336);
    });

    await runTest("recarrega → altera a descrição de COT-015 (permitido em rascunho) → salva novamente → hierarquia e total permanecem íntegros", async () => {
      const reloaded = await budgetVersionRepository.loadBudgetVersion(companyAId, shared.persistedVersionId);
      const cot015Before = reloaded.entity.lines.find((line) => line.externalCode === "COT-015");
      assertEqual(cot015Before !== undefined, true, "COT-015 must be present before the update");

      const updated = updateBudgetLine({
        budgetVersion: reloaded.entity,
        lineId: cot015Before.id,
        description: { status: "Confirmed", text: cot015RevisedText },
      });
      assertEqual(updated.success, true, JSON.stringify(updated.errors));

      const saved = await budgetVersionRepository.saveBudgetVersion(companyAId, clientAId, updated.budgetVersion, reloaded.revision);
      assertEqual(saved.outcome, "saved");
      if (saved.outcome === "saved") {
        shared.finalRevision = saved.revision;
      }

      const reloadedAfterUpdate = await budgetVersionRepository.loadBudgetVersion(companyAId, shared.persistedVersionId);
      assertEqual(reloadedAfterUpdate.entity.lines.length, 336, "no line lost across the update round trip");
      const cot015After = reloadedAfterUpdate.entity.lines.find((line) => line.externalCode === "COT-015");
      assertEqual(cot015After?.description.status === "Confirmed" ? cot015After.description.text : null, cot015RevisedText);
      assertEqual(cot015After?.totalCents, centsFromDecimalString("227913"), "COT-015's value must be untouched by a description-only update");

      const calculatedCents = calculateBudgetVersionTotal(reloadedAfterUpdate.entity);
      const declaredCents = centsFromDecimalString(LAGOA_DO_ARROZ_DECLARED_TOTAL_DECIMAL);
      assertEqual(calculatedCents, declaredCents, "total must remain exact after a description-only update and a second save");
    });

    await runTest("consolida a Versão", async () => {
      const reloaded = await budgetVersionRepository.loadBudgetVersion(companyAId, shared.persistedVersionId);
      const consolidated = consolidateBudgetVersion({ budgetVersion: reloaded.entity });
      assertEqual(consolidated.success, true);

      const saved = await budgetVersionRepository.saveBudgetVersion(companyAId, clientAId, consolidated.budgetVersion, reloaded.revision);
      assertEqual(saved.outcome, "saved");
      if (saved.outcome === "saved") {
        shared.finalRevision = saved.revision;
      }
    });

    await runTest("recarrega do banco e confirma as cardinalidades: 11 Grupos, 25 Subgrupos, 300 Itens de Serviço, 336 Linhas no total", async () => {
      const reloaded = await budgetVersionRepository.loadBudgetVersion(companyAId, shared.persistedVersionId);
      assertEqual(reloaded !== null, true, "the persisted version must be reloadable");

      const lines = reloaded.entity.lines;
      assertEqual(lines.length, 336, "336 total lines");
      assertEqual(lines.filter((l) => l.kind === BudgetLineKind.Group).length, 11, "11 Grupos");
      assertEqual(lines.filter((l) => l.kind === BudgetLineKind.Subgroup).length, 25, "25 Subgrupos");

      const serviceItems = lines.filter((l) => l.kind === BudgetLineKind.ServiceItem);
      assertEqual(serviceItems.length, 300, "300 Itens de Serviço");
      // "299 codificados / 1 sem código hierárquico" é uma distinção do
      // `hierarchicalCode` da fixture bruta (já provada em
      // lagoa-do-arroz.official-fixture.test.ts) — o domínio da Sprint
      // 21.3B não carrega `hierarchicalCode` como campo próprio de
      // `BudgetLine` (só `externalCode`), logo não é um campo persistido
      // nesta Sprint; confirmado aqui diretamente na fixture bruta,
      // restrita aos Itens de Serviço (Grupos e Subgrupos sempre têm
      // hierarchicalCode, por serem estruturais).
      const codedServiceItemsInFixture = LAGOA_DO_ARROZ_OFFICIAL_LINES.filter(
        (l) => l.classification === "ServiceItem" && l.hierarchicalCode !== null,
      );
      assertEqual(codedServiceItemsInFixture.length, 299, "299 Itens de Serviço carry a hierarchicalCode in the source fixture");

      shared.reloaded = reloaded;
    });

    await runTest("COT-015 preservado: sem código hierárquico, participando dos totais, com o valor declarado exato e a descrição revisada", async () => {
      const reloaded = shared.reloaded;
      const cot015 = reloaded.entity.lines.find((l) => l.kind === BudgetLineKind.ServiceItem && l.externalCode === "COT-015");
      assertEqual(cot015 !== undefined, true, "COT-015 must exist among the reloaded lines, identified by its own externalCode");
      assertEqual(cot015.totalCents, centsFromDecimalString("227913"), "COT-015 declared value must survive the round trip exactly");
      assertEqual(cot015.description.status === "Confirmed" ? cot015.description.text : null, cot015RevisedText, "the description update from the reload→alter→save cycle must persist through consolidation");
    });

    await runTest("oito descrições ausentes preservadas (COT-015 já tinha descrição confirmada na fonte — o ciclo recarregar → alterar → salvar apenas revisou seu texto) — nenhum rótulo de apresentação inventado", async () => {
      const reloaded = shared.reloaded;
      const absent = reloaded.entity.lines.filter((l) => l.description.status === "AbsentFromSource");
      assertEqual(absent.length, 8, "the 8 original AbsentFromSource lines are untouched by the COT-015 update");
      absent.forEach((line) => {
        assertEqual("text" in line.description, false, `line ${line.id}: AbsentFromSource must never carry text`);
      });
    });

    await runTest("hierarquia e ordenação idênticas às do domínio original — zero linha órfã, zero ciclo", async () => {
      const reloaded = shared.reloaded;
      const originalLines = scenario.consolidatedBudgetVersion.lines;

      // A identidade física de cada Linha foi remapeada nesta fronteira de
      // persistência (ver remapToPersistableIdentities) — a comparação usa
      // `metadata.sourceRowNumber`, preservado verbatim em ambos os lados,
      // como chave estável e independente de identidade física.
      const reloadedByRow = new Map(reloaded.entity.lines.map((l) => [l.metadata.sourceRowNumber, l]));
      const originalByRow = new Map(originalLines.map((l) => [l.metadata.sourceRowNumber, l]));

      assertEqual(reloadedByRow.size, originalByRow.size, "same number of distinct source rows represented");

      originalLines.forEach((original) => {
        const row = original.metadata.sourceRowNumber;
        const match = reloadedByRow.get(row);
        assertEqual(match !== undefined, true, `source row ${row} must exist after reload`);
        assertEqual(match.position, original.position, `row ${row}: position must match`);
        assertEqual(match.kind, original.kind, `row ${row}: kind must match`);

        const originalParentRow = original.parentLineId === null ? null : originalLines.find((l) => l.id === original.parentLineId)?.metadata.sourceRowNumber ?? null;
        const reloadedParentRow = match.parentLineId === null ? null : reloaded.entity.lines.find((l) => l.id === match.parentLineId)?.metadata.sourceRowNumber ?? null;
        assertEqual(reloadedParentRow, originalParentRow, `row ${row}: parent's source row must match (hierarchy shape preserved, identities remapped consistently)`);
      });

      const reloadedById = new Map(reloaded.entity.lines.map((l) => [l.id, l]));
      reloaded.entity.lines.forEach((line) => {
        if (line.parentLineId !== null) {
          assertEqual(reloadedById.has(line.parentLineId), true, `line ${line.id} references a parent that does not exist after reload`);
        }
      });
    });

    await runTest("total R$ 9.809.087,18 exato — zero dupla contagem, zero perda de precisão", async () => {
      const reloaded = shared.reloaded;
      const calculatedCents = calculateBudgetVersionTotal(reloaded.entity);
      const declaredCents = centsFromDecimalString(LAGOA_DO_ARROZ_DECLARED_TOTAL_DECIMAL);
      assertEqual(calculatedCents, declaredCents, `reloaded total (${calculatedCents} cents) must match the declared official total (${declaredCents} cents)`);
    });

    await runTest("origem documental e Relação de Rastreabilidade preservadas; estado consolidado imutável após a recarga", async () => {
      const reloaded = shared.reloaded;
      assertEqual(reloaded.entity.status, BudgetVersionStatus.Consolidated, "the reloaded version must be Consolidated");
      assertEqual(reloaded.entity.origin.kind, "DocumentaryOpaqueReference");
      assertEqual(reloaded.entity.origin.reference, draftBudgetVersion.origin.reference);
      assertEqual(reloaded.entity.originLineage !== null, true, "the origin Relação de Rastreabilidade must be present after reload");
      assertEqual(reloaded.entity.originLineage.destinationBudgetVersionId, shared.persistedVersionId);
      assertEqual(reloaded.revision, shared.finalRevision, "revision must match what the last save call returned");
    });
  } finally {
    await cleanupCreatedData(serviceRoleClient, tracked);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
