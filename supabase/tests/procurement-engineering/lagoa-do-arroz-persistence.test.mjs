import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { calculateBudgetVersionTotal } from "../../../packages/bdos-core/src/domain/budget-version/budget-version.ts";
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
} from "../../../apps/web/lib/bdos/procurement-engineering-repository.ts";

// Sprint 21.3C — teste de persistência da fixture oficial Lagoa do Arroz
// (seção 21 da instrução). Monta o agregado inteiro pelo domínio puro da
// Sprint 21.3B (buildLagoaDoArrozOfficialScenario, já testado em
// lagoa-do-arroz.official-fixture.test.ts) e persiste pelo adaptador desta
// Sprint — nenhum Serviço de Aplicação de importação em massa é criado só
// para este teste, exatamente como a instrução permite.
//
// A fixture usa identidades de Processo/Versão/Relação fixas e não-UUID
// ("case-lagoa-do-arroz-dnocs-90006-2025" etc.) — apropriadas para o
// domínio puro (Sprint 21.3B, onde identidade é só `string`), mas
// incompatíveis com as colunas UUID desta Sprint. As 336 identidades de
// Linha (`fixtureLineId`) já são UUIDs reais e são preservadas
// exatamente; identidade de Processo/Versão/Relação recebe um UUID novo
// só nesta fronteira de persistência — a mesma atribuição de identidade
// interna que create_budget_version_draft já faz para qualquer Versão
// nova (nunca derivada de um identificador externo).
//
// Não reextrai a planilha, não altera os dados da fixture, não grava o
// arquivo original, e não trata este teste como seed de demonstração —
// ver o relatório final da Sprint quanto à política de retenção deste
// registro no projeto de teste compartilhado.

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const clientAEmail = process.env.RLS_TEST_CLIENT_A_EMAIL || "carlos@carlosmendes.com.br";
const clientAPassword = process.env.RLS_TEST_CLIENT_A_PASSWORD || "Teste123!";
const companyAId = process.env.RLS_TEST_COMPANY_A_ID || "eeeeeeee-0000-0000-0000-000000000001";
const clientAId = process.env.RLS_TEST_CLIENT_A_ID || "d9e849b1-cd4a-4855-888c-857d8a7a6050";

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY before running this test.");
  }
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email, password) {
  const client = createSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Authentication failed for ${email}: ${error.message}`);
  if (!data.session) throw new Error(`No session returned for ${email}`);
  return client;
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

/** Remapeia as identidades não-UUID da fixture (Processo/Versão/Relação) para UUIDs reais — nunca as 336 identidades de Linha, já UUIDs válidos. */
function remapToPersistableIdentities(scenario, organizationId) {
  const realCaseId = crypto.randomUUID();
  const realVersionId = crypto.randomUUID();
  const realLineageId = crypto.randomUUID();

  const procurementCase = { ...scenario.procurementCase, id: realCaseId, organizationId };
  const scope = { ...scenario.scope, procurementCaseId: realCaseId };

  // `budget_lines.id` é chave primária global (não escopada por versão) —
  // e ADR-001 §E já exige que "nenhuma identidade de linha é reutilizada
  // entre versões" mesmo quando o conteúdo é idêntico. Cada execução deste
  // teste contra o banco real precisa, portanto, de identidades de linha
  // novas — nunca o `fixtureLineId` literal reutilizado de execução em
  // execução (que colidiria com a chave primária de uma execução
  // anterior). O remapeamento preserva a forma da hierarquia (pai/filho)
  // exatamente, apenas trocando os valores de identidade.
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

  const budgetVersion = {
    ...scenario.consolidatedBudgetVersion,
    id: realVersionId,
    organizationId,
    procurementCaseId: realCaseId,
    scope,
    originLineage,
    lines,
  };

  return { procurementCase, budgetVersion };
}

async function main() {
  const client = await signIn(clientAEmail, clientAPassword);
  const procurementCaseRepository = createProcurementCaseRepository(client);
  const budgetVersionRepository = createBudgetVersionRepository(client);

  const scenario = buildLagoaDoArrozOfficialScenario();
  const { procurementCase, budgetVersion } = remapToPersistableIdentities(scenario, companyAId);

  const shared = { persistedVersionId: null, finalRevision: null, reloaded: null };

  await runTest("persiste o Processo, a Versão em rascunho com a Relação de Rastreabilidade declarada na criação, e os 336 registros consolidados", async () => {
    await procurementCaseRepository.createProcurementCase(companyAId, procurementCase);

    const draft = await budgetVersionRepository.createDraftBudgetVersion(companyAId, { ...budgetVersion, status: BudgetVersionStatus.Draft, lines: [] });
    assertEqual(draft.revision, 0);
    shared.persistedVersionId = draft.entity.id;

    const saved = await budgetVersionRepository.saveBudgetVersion(companyAId, budgetVersion, draft.revision);
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
    // `BudgetLine` (só `externalCode`, mapeado de `externalSourceCode`),
    // logo não é um campo persistido nesta Sprint; confirmado aqui
    // diretamente na fixture bruta, restrita aos Itens de Serviço (Grupos
    // e Subgrupos sempre têm hierarchicalCode, por serem estruturais).
    const codedServiceItemsInFixture = LAGOA_DO_ARROZ_OFFICIAL_LINES.filter(
      (l) => l.classification === "ServiceItem" && l.hierarchicalCode !== null,
    );
    assertEqual(codedServiceItemsInFixture.length, 299, "299 Itens de Serviço carry a hierarchicalCode in the source fixture");

    shared.reloaded = reloaded;
  });

  await runTest("COT-015 preservado: sem código hierárquico, participando dos totais, com o valor declarado exato", async () => {
    const reloaded = shared.reloaded;
    const cot015 = reloaded.entity.lines.find((l) => l.kind === BudgetLineKind.ServiceItem && l.externalCode === "COT-015");
    assertEqual(cot015 !== undefined, true, "COT-015 must exist among the reloaded lines, identified by its own externalCode");
    assertEqual(cot015.totalCents, centsFromDecimalString("227913"), "COT-015 declared value must survive the round trip exactly");
  });

  await runTest("oito descrições ausentes preservadas — nenhum rótulo de apresentação inventado", async () => {
    const reloaded = shared.reloaded;
    const absent = reloaded.entity.lines.filter((l) => l.description.status === "AbsentFromSource");
    assertEqual(absent.length, 8, "exactly 8 lines with AbsentFromSource description");
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
    assertEqual(reloaded.entity.origin.reference, budgetVersion.origin.reference);
    assertEqual(reloaded.entity.originLineage !== null, true, "the origin Relação de Rastreabilidade must be present after reload");
    assertEqual(reloaded.entity.originLineage.destinationBudgetVersionId, shared.persistedVersionId);
    assertEqual(reloaded.revision, shared.finalRevision, "revision must match what the save call returned");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
