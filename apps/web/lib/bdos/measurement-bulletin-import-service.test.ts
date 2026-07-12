import { randomUUID } from "node:crypto";
import { insertMeasurementBulletinImport, listMeasurementWorkspaceLines } from "./measurement-repository";
import { processMeasurementBulletinImport } from "./measurement-bulletin-import-service";
import { createFakeSupabaseClient, type FakeSupabaseClient } from "./test-helpers/fake-supabase-client";
import { buildSimpleBulletinFixture } from "./test-helpers/bulletin-fixture";

// Testa processMeasurementBulletinImport de ponta a ponta -- parser
// REAL (importBulletinExcel, sem stub) contra fixtures .xlsx
// sintéticos + fake in-memory de SupabaseClient (sem rede/credenciais,
// roda dentro de pnpm test/CI). Cobre os 14 cenários obrigatórios da
// revisão de arquitetura da Sprint 4D.2 -- ver comentário em cada
// runTest para qual cenário cobre. Dois cenários (3 e 13) têm sua
// mecânica central coberta em measurement-repository.test.ts
// (claim/finalize testados em isolamento); aqui cobrimos a
// consequência observável no nível do serviço.
//
// Números de referência (validados contra o BM_08 real, fora desta
// suíte, via script one-off -- arquivo não commitado, ~5,2MB de dados
// comerciais reais do cliente): officialPeriodTotal = recalculatedTotal
// = R$ 252.654,78 (diferença R$ 0,00, com truncateToCents -- antes da
// correção pós-E2E, a diferença era R$ 0,02, ver teste "TRUNC" abaixo),
// 15 linhas, 336 work packages (300 folha + 36 agregadores, confirmado
// como o padrão correto -- mesmo usado por ms-project-xml-import.ts),
// 300 service items, zero issues blocking, status esperado
// 'needs_review' (não 'reconciled' -- ver nota abaixo). Como o arquivo
// real não pode ser commitado, os fixtures aqui são sintéticos,
// dimensionados para exercitar exatamente os mesmos caminhos de
// código.
//
// Achado estrutural desta implementação, não previsto no desenho:
// TODA linha "TOTAL GERAL" capturada pelo parser gera um
// MeasurementImportIssue warning (unrecognized_line/missing_work_package_code,
// porque a linha de total tem código mas nunca um nome de item real)
// -- e sem essa linha capturada, official_period_total_mismatch
// (blocking) dispara por falta de declaredOfficialTotal. Ou seja: todo
// arquivo válido tem pelo menos 1 warning estrutural, tornando
// 'reconciled' (nesta implementação: nenhum warning E nenhum blocking
// E diferença dentro da tolerância) uma condição rara/quase
// inalcançável na prática -- exatamente por isso o BM_08 real também
// resulta em 'needs_review', não 'reconciled', mesmo com diferença
// R$ 0,00. Os testes abaixo refletem isso.

const COMPANY_ID = "company-1";
const ENGINEERING_PROJECT_ID = "project-1";
const BUCKET_PATH_PREFIX = `${COMPANY_ID}/measurement/${ENGINEERING_PROJECT_ID}`;

function newClient(): FakeSupabaseClient {
  return createFakeSupabaseClient({
    tables: {
      measurement_bulletin_imports: { defaults: { status: "pending_upload" } },
      measurement_workspaces: {
        uniqueConstraints: [{ columns: ["measurement_bulletin_import_id"], partial: (row) => row.measurement_bulletin_import_id !== null }],
        defaults: { status: "Draft" }
      },
      work_packages: {
        uniqueConstraints: [{ columns: ["engineering_project_id", "normalized_code"] }]
      },
      managed_service_items: {},
      measurement_workspace_lines: {
        uniqueConstraints: [{ columns: ["measurement_workspace_id", "managed_service_item_id"] }]
      }
    }
  });
}

async function seedImport(
  supabase: FakeSupabaseClient,
  params: { id: string; status: "pending_upload" | "uploaded" | "processing" | "completed" | "failed"; storagePath: string }
): Promise<void> {
  await insertMeasurementBulletinImport(supabase as any, {
    id: params.id,
    companyId: COMPANY_ID,
    engineeringProjectId: ENGINEERING_PROJECT_ID,
    fileName: "boletim-teste.xlsx",
    storagePath: params.storagePath,
    uploadedBy: "user-1",
    status: params.status
  });
}

const HAPPY_PATH_LINE = {
  code: "01.01.01",
  name: "CAPINA MANUAL",
  unit: "M2",
  contractQuantity: 100,
  contractUnitPrice: 10,
  officialQuantity: 5,
  officialValue: 50
};

function happyPathFixtureBytes(): Uint8Array {
  return buildSimpleBulletinFixture({
    parentAggregatorCode: "01.01.00",
    parentAggregatorName: "SERVIÇOS PRELIMINARES",
    lines: [HAPPY_PATH_LINE]
  });
}

async function main(): Promise<void> {
  // Cenário 1 (caminho feliz -- proxy sintético do BM_08 real) +
  // cenário 14 (sourceLocation persistida integralmente).
  await runTest("caminho feliz: cria workspace, materializa catálogo e linha, reconcilia com diferença zero, status needs_review", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const storagePath = `${BUCKET_PATH_PREFIX}/${importId}/boletim.xlsx`;
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath });
    supabase.__files = { [storagePath]: happyPathFixtureBytes() };

    const result = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(result.success, "deveria ter sucesso");
    if (!result.success) return;

    assertEqual(result.outcome.kind, "completed", "primeira execução, modo fresco");
    const analysis = result.outcome.analysisResult;
    assertTrue(analysis !== null && analysis.status !== "failed", "deveria ter um resultado não-falho");
    if (!analysis || analysis.status === "failed") return;

    assertEqual(analysis.status, "needs_review", "TOTAL GERAL sempre gera >=1 warning estrutural -- reconciled é praticamente inalcançável (ver nota no topo do arquivo)");
    assertEqual(analysis.officialPeriodTotal, 50);
    assertEqual(analysis.recalculatedTotal, 50, "quantity(5) * unitPrice do catálogo(10) = 50, igual ao oficial");
    assertEqual(analysis.totalDifference, 0);
    assertEqual(analysis.workPackages.created, 2, "1 agregador + 1 folha");
    assertEqual(analysis.serviceItems.created, 1);
    assertEqual(analysis.lines.imported, 1);
    assertEqual(analysis.schemaVersion, 1);
    assertEqual(analysis.parserKey, "dnocs-measurement-bulletin-v1");

    // Cenário 14 -- rastreabilidade até a célula.
    const persistedLines = await listMeasurementWorkspaceLines(supabase as any, { measurementWorkspaceId: analysis.measurementWorkspaceId });
    assertEqual(persistedLines.length, 1);
    assertEqual(persistedLines[0]?.sourceSheetName, "BOLETIM DE MEDIÇÃO 03");
    assertEqual(persistedLines[0]?.sourceRowNumber, 6);
    assertEqual(persistedLines[0]?.sourcePhysicalColumn, "G");
    assertEqual(persistedLines[0]?.sourceFinancialColumn, "H");

    // status do import e do workspace avançaram corretamente.
    const importRow = supabase.__tables.measurement_bulletin_imports[0];
    assertEqual(importRow?.status, "completed");
    assertEqual(importRow?.analysis_result !== null && importRow?.analysis_result !== undefined, true, "analysis_result deveria estar persistido");
    const workspaceRow = supabase.__tables.measurement_workspaces[0];
    assertEqual(workspaceRow?.status, "InProgress", "Draft -> InProgress após materialização (passo 12)");
  });

  // Cenário 2: already_completed devolve o resultado persistido sem
  // download/parser.
  await runTest("already_completed devolve o analysisResult persistido, sem tentar baixar/parsear de novo", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const persistedAnalysis = {
      schemaVersion: 1,
      parserKey: "dnocs-measurement-bulletin-v1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      measurementBulletinImportId: importId,
      engineeringProjectId: ENGINEERING_PROJECT_ID,
      declaredBulletinNumber: 3,
      declaredPeriod: null,
      structuralIssues: [],
      skippedSheets: [],
      status: "needs_review",
      measurementWorkspaceId: "workspace-already-completed",
      officialPeriodTotal: 50,
      recalculatedTotal: 50,
      totalDifference: 0,
      workPackages: { created: 2, matched: 0 },
      serviceItems: { created: 1, matched: 0 },
      lines: { imported: 1, alreadyPresent: 0, updated: 0, skippedZeroValue: 0 }
    };
    await seedImport(supabase, { id: importId, status: "completed", storagePath: "nunca-deveria-ser-lido" });
    supabase.__tables.measurement_bulletin_imports[0]!.analysis_result = persistedAnalysis;
    // Nenhum arquivo registrado no storage fake -- se o serviço tentar
    // baixar mesmo assim, o teste falha (download_failed em vez de
    // already_completed).

    const result = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(result.success, "deveria ter sucesso");
    if (!result.success) return;
    assertEqual(result.outcome.kind, "already_completed");
    assertEqual(result.outcome.measurementWorkspaceId, "workspace-already-completed");
    assertEqual(JSON.stringify(result.outcome.analysisResult), JSON.stringify(persistedAnalysis));
  });

  // Cenário 3 (consequência observável -- mecânica coberta a fundo em
  // measurement-repository.test.ts): um import já 'processing' nunca é
  // processado de novo.
  await runTest("already_processing quando o import já está 'processing' -- nunca reprocessa", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    await seedImport(supabase, { id: importId, status: "processing", storagePath: "path" });

    const result = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(result.success, "deveria ter sucesso (already_processing não é um erro top-level)");
    if (!result.success) return;
    assertEqual(result.outcome.kind, "already_processing");
    assertEqual(result.outcome.analysisResult, null);
  });

  // Cenário 4: falha bloqueante ANTES da criação do workspace ->
  // measurementWorkspaceId null. Usa official_measurement_block_not_found
  // (bloco financeiro oficial ausente).
  await runTest("issue blocking do parser (bloco oficial ausente) antes da criação do workspace: failed com measurementWorkspaceId null", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const storagePath = `${BUCKET_PATH_PREFIX}/${importId}/boletim.xlsx`;
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath });
    supabase.__files = {
      [storagePath]: buildSimpleBulletinFixture({ parentAggregatorCode: "01.01.00", lines: [HAPPY_PATH_LINE], omitOfficialBlock: true })
    };

    const result = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(result.success, "deveria ser um outcome de negócio (failed), não um erro top-level");
    if (!result.success) return;
    assertEqual(result.outcome.kind, "failed");
    assertEqual(result.outcome.measurementWorkspaceId, null, "gate recusou antes de qualquer workspace existir");
    assertTrue(
      result.outcome.issues.some((issue) => issue.code === "official_measurement_block_not_found" && issue.severity === "blocking"),
      "deveria conter a issue blocking do bloco oficial ausente"
    );
    assertEqual(result.outcome.analysisResult?.status, "failed");
    assertEqual((result.outcome.analysisResult as any)?.measurementWorkspaceId, null);

    // Nenhum work_package/managed_service_item foi criado -- Gate A
    // (issues do próprio parser) acontece antes de qualquer
    // materialização de catálogo.
    assertEqual(supabase.__tables.work_packages.length, 0);
    assertEqual(supabase.__tables.measurement_workspaces.length, 0);

    const importRow = supabase.__tables.measurement_bulletin_imports[0];
    assertEqual(importRow?.status, "failed");
  });

  // Cenário 5: falha bloqueante em modo RETOMADA preserva o id do
  // workspace já existente. Usa official_period_total_mismatch (total
  // declarado não bate com a soma extraída) para simular um retry que
  // encontra o arquivo agora inconsistente.
  await runTest("falha bloqueante em modo retomada preserva o measurementWorkspaceId do workspace já existente", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const storagePath = `${BUCKET_PATH_PREFIX}/${importId}/boletim.xlsx`;

    // Primeira execução: sucesso, cria workspace.
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath });
    supabase.__files = { [storagePath]: happyPathFixtureBytes() };
    const first = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });
    assertTrue(first.success && first.outcome.kind === "completed", "primeira execução deveria completar normalmente");
    const workspaceId = first.success ? first.outcome.measurementWorkspaceId : null;
    assertTrue(workspaceId !== null, "deveria ter criado um workspace");

    // Simula: import falhou por outro motivo depois (ex.: infra), e o
    // arquivo agora tem um total declarado que não bate mais com a
    // soma extraída -- retry em modo retomada.
    const importRow = supabase.__tables.measurement_bulletin_imports[0]!;
    importRow.status = "failed";
    supabase.__files = {
      [storagePath]: buildSimpleBulletinFixture({
        parentAggregatorCode: "01.01.00",
        lines: [HAPPY_PATH_LINE],
        declaredOfficialTotalOverride: 999 // não bate com a soma real (50) -> official_period_total_mismatch blocking
      })
    };

    const second = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(second.success, "deveria ser outcome de negócio");
    if (!second.success) return;
    assertEqual(second.outcome.kind, "failed");
    assertEqual(second.outcome.measurementWorkspaceId, workspaceId, "workspace já existente (modo retomada) deveria ser preservado no outcome de falha, não descartado");
    assertTrue(
      second.outcome.issues.some((issue) => issue.code === "official_period_total_mismatch" && issue.severity === "blocking"),
      "deveria conter a issue blocking de reconciliação"
    );
  });

  // Cenários 6/7: retomada de workspace parcial não duplica linhas
  // (linha idêntica -> alreadyPresent); linha diferente em
  // Draft/InProgress é atualizada (updated).
  await runTest("retomada com linha idêntica incrementa alreadyPresent, nunca duplica", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const storagePath = `${BUCKET_PATH_PREFIX}/${importId}/boletim.xlsx`;
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath });
    supabase.__files = { [storagePath]: happyPathFixtureBytes() };

    const first = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });
    assertTrue(first.success && first.outcome.kind === "completed");

    // Simula um retry depois de um problema não relacionado, com o
    // MESMO arquivo -- nada deveria ter mudado.
    supabase.__tables.measurement_bulletin_imports[0]!.status = "failed";

    const second = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(second.success, "deveria ter sucesso");
    if (!second.success) return;
    assertEqual(second.outcome.kind, "resumed");
    const analysis = second.outcome.analysisResult;
    assertTrue(analysis !== null && analysis.status !== "failed");
    if (!analysis || analysis.status === "failed") return;
    assertEqual(analysis.lines.alreadyPresent, 1);
    assertEqual(analysis.lines.imported, 0, "nunca duplica -- não é um segundo insert");
    assertEqual(analysis.lines.updated, 0);
    assertEqual(supabase.__tables.measurement_workspace_lines.length, 1, "continua existindo só 1 linha no banco");
  });

  await runTest("retomada com linha divergente em Draft/InProgress é atualizada explicitamente (updated), não pulada", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const storagePath = `${BUCKET_PATH_PREFIX}/${importId}/boletim.xlsx`;
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath });
    supabase.__files = { [storagePath]: happyPathFixtureBytes() };

    const first = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });
    assertTrue(first.success && first.outcome.kind === "completed");

    // Simula uma correção de preço unitário no catálogo entre as duas
    // execuções (cenário real do desenho: "parser ou dados de
    // catálogo mudam") -- muda o total recalculado da linha já
    // persistida, sem tocar o arquivo.
    const serviceItemRow = supabase.__tables.managed_service_items[0]!;
    serviceItemRow.unit_price = 20; // era 10

    supabase.__tables.measurement_bulletin_imports[0]!.status = "failed";

    const second = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(second.success);
    if (!second.success) return;
    const analysis = second.outcome.analysisResult;
    assertTrue(analysis !== null && analysis.status !== "failed");
    if (!analysis || analysis.status === "failed") return;
    assertEqual(analysis.lines.updated, 1, "quantidade igual, mas unitValue/totalValue divergem do que estava persistido -> update explícito");
    assertEqual(analysis.lines.alreadyPresent, 0);
    assertEqual(analysis.lines.imported, 0);
    assertEqual(analysis.recalculatedTotal, 100, "quantity(5) * novo unitPrice(20) = 100");

    const persistedLines = await listMeasurementWorkspaceLines(supabase as any, { measurementWorkspaceId: analysis.measurementWorkspaceId });
    assertEqual(persistedLines.length, 1, "update, não um segundo insert");
    assertEqual(persistedLines[0]?.totalValue, 100);
  });

  // Cenário 9 (numerado 9 na lista do usuário: "ReadyForReview não é
  // alterado").
  await runTest("workspace em ReadyForReview nunca é retomado automaticamente -- import não é reivindicado", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const storagePath = `${BUCKET_PATH_PREFIX}/${importId}/boletim.xlsx`;
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath });
    supabase.__files = { [storagePath]: happyPathFixtureBytes() };

    const first = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });
    assertTrue(first.success && first.outcome.kind === "completed");

    // Workspace entrou em revisão humana; um novo arquivo (ou retry)
    // chega para o mesmo import.
    supabase.__tables.measurement_workspaces[0]!.status = "ReadyForReview";
    supabase.__tables.measurement_bulletin_imports[0]!.status = "failed";

    const second = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(second.success);
    if (!second.success) return;
    assertEqual(second.outcome.kind, "workspace_ready_for_review");
    assertEqual(second.outcome.analysisResult, null);

    // Nunca reivindicado -- status do import continua 'failed', nunca
    // virou 'processing'/'completed'.
    assertEqual(supabase.__tables.measurement_bulletin_imports[0]?.status, "failed");
  });

  // Cenário 10: divergência de descrição gera warning, linha ainda é
  // materializada.
  await runTest("descrição divergente do catálogo gera warning (service_item_description_mismatch), linha é materializada normalmente", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const storagePath = `${BUCKET_PATH_PREFIX}/${importId}/boletim.xlsx`;
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath });
    supabase.__files = { [storagePath]: happyPathFixtureBytes() };

    // Pré-existe um ManagedServiceItem com o mesmo código, mesma
    // unidade, descrição DIFERENTE.
    supabase.__tables.work_packages.push({
      id: "wp-existing",
      company_id: COMPANY_ID,
      engineering_project_id: ENGINEERING_PROJECT_ID,
      code: "01.01.01",
      normalized_code: "01.01.01",
      name: "CAPINA MANUAL",
      type: "execution_front",
      parent_work_package_id: null
    });
    supabase.__tables.managed_service_items.push({
      id: "item-existing",
      company_id: COMPANY_ID,
      engineering_project_id: ENGINEERING_PROJECT_ID,
      work_package_id: "wp-existing",
      code: "01.01.01",
      description: "ROÇAGEM MECANIZADA", // diferente de "CAPINA MANUAL"
      unit: "M2", // igual
      contract_quantity: 100,
      unit_price: 10
    });

    const result = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(result.success);
    if (!result.success) return;
    assertEqual(result.outcome.kind, "completed", "warning não bloqueia -- fluxo completa normalmente");
    assertTrue(
      result.outcome.issues.some((issue) => issue.code === "service_item_description_mismatch" && issue.severity === "warning"),
      "deveria sinalizar a divergência de descrição como warning"
    );
    const analysis = result.outcome.analysisResult;
    assertTrue(analysis !== null && analysis.status !== "failed");
    if (!analysis || analysis.status === "failed") return;
    assertEqual(analysis.lines.imported, 1, "linha É materializada mesmo com descrição divergente");
    assertEqual(analysis.serviceItems.matched, 1, "encontrou o item existente, não criou um novo");
  });

  // Cenário 11: divergência de unidade gera blocking e NÃO materializa
  // nenhuma linha (nem cria o workspace, em modo fresco).
  await runTest("unidade divergente do catálogo gera blocking (service_item_unit_mismatch) e recusa materializar a medição", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const storagePath = `${BUCKET_PATH_PREFIX}/${importId}/boletim.xlsx`;
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath });
    supabase.__files = { [storagePath]: happyPathFixtureBytes() };

    supabase.__tables.work_packages.push({
      id: "wp-existing",
      company_id: COMPANY_ID,
      engineering_project_id: ENGINEERING_PROJECT_ID,
      code: "01.01.01",
      normalized_code: "01.01.01",
      name: "CAPINA MANUAL",
      type: "execution_front",
      parent_work_package_id: null
    });
    supabase.__tables.managed_service_items.push({
      id: "item-existing",
      company_id: COMPANY_ID,
      engineering_project_id: ENGINEERING_PROJECT_ID,
      work_package_id: "wp-existing",
      code: "01.01.01",
      description: "CAPINA MANUAL",
      unit: "M3", // diferente de "M2" -- unidade incompatível
      contract_quantity: 100,
      unit_price: 10
    });

    const result = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(result.success);
    if (!result.success) return;
    assertEqual(result.outcome.kind, "failed");
    assertTrue(
      result.outcome.issues.some((issue) => issue.code === "service_item_unit_mismatch" && issue.severity === "blocking"),
      "deveria bloquear por divergência de unidade"
    );
    assertEqual(result.outcome.measurementWorkspaceId, null, "workspace nunca chega a ser criado -- gate B recusa antes do passo 10");
    assertEqual(supabase.__tables.measurement_workspace_lines.length, 0, "nenhuma linha materializada");
    assertEqual(supabase.__tables.measurement_workspaces.length, 0);
  });

  // Correção pós-E2E (achado real no BM_08): totalValue trunca a 2
  // casas em vez de arredondar/manter a multiplicação crua -- replica
  // =TRUNC(F*I,2) da fórmula real do arquivo. Números exatos do item
  // 01.04.01 do BM_08 (qty=3,32, preço=8170,05 -> produto bruto
  // 27124,566, TRUNC = 27124,56, que é o valor que o próprio arquivo
  // declara).
  await runTest("totalValue trunca a 2 casas (TRUNC), não arredonda nem mantém a multiplicação crua", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    const storagePath = `${BUCKET_PATH_PREFIX}/${importId}/boletim.xlsx`;
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath });
    supabase.__files = {
      [storagePath]: buildSimpleBulletinFixture({
        parentAggregatorCode: "01.04.00",
        lines: [
          {
            code: "01.04.01",
            name: "ADMINISTRAÇÃO LOCAL",
            unit: "UNID",
            contractQuantity: 100,
            contractUnitPrice: 8170.05,
            officialQuantity: 3.32,
            officialValue: 27124.56
          }
        ]
      })
    };

    const result = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertTrue(result.success);
    if (!result.success) return;
    const analysis = result.outcome.analysisResult;
    assertTrue(analysis !== null && analysis.status !== "failed");
    if (!analysis || analysis.status === "failed") return;

    assertEqual(analysis.recalculatedTotal, 27124.56, "3.32 * 8170.05 = 27124.566 sem truncar -- TRUNC(...,2) precisa dar 27124.56, batendo com o oficial");
    assertEqual(analysis.officialPeriodTotal, 27124.56);
    assertEqual(analysis.totalDifference, 0, "sem TRUNC, a diferença seria 0.006 -- pequena, mas caminha para os R$0,02 observados no BM_08 real com 4 linhas assim");

    const persistedLines = await listMeasurementWorkspaceLines(supabase as any, { measurementWorkspaceId: analysis.measurementWorkspaceId });
    assertEqual(persistedLines[0]?.totalValue, 27124.56);
  });

  // period_number_conflict (Parte IX do desenho, exigida pela revisão
  // pós-E2E): dois imports DIFERENTES no mesmo projeto reivindicando o
  // mesmo período geram warning, nunca bloqueiam -- remedição pode ser
  // legítima.
  await runTest("period_number_conflict: dois imports diferentes com o mesmo período no mesmo projeto geram warning, nunca bloqueiam", async () => {
    const supabase = newClient();

    // Primeiro import, período 3, completa normalmente.
    const firstImportId = randomUUID();
    const firstStoragePath = `${BUCKET_PATH_PREFIX}/${firstImportId}/boletim.xlsx`;
    await seedImport(supabase, { id: firstImportId, status: "uploaded", storagePath: firstStoragePath });
    supabase.__files = { [firstStoragePath]: happyPathFixtureBytes() };
    const first = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: firstImportId });
    assertTrue(first.success && first.outcome.kind === "completed");

    // Segundo import, DIFERENTE, mesmo projeto, mesmo período
    // declarado (3) -- ex.: remedição, ou erro de numeração do
    // arquivo de origem.
    const secondImportId = randomUUID();
    const secondStoragePath = `${BUCKET_PATH_PREFIX}/${secondImportId}/boletim.xlsx`;
    await seedImport(supabase, { id: secondImportId, status: "uploaded", storagePath: secondStoragePath });
    supabase.__files = { [secondStoragePath]: happyPathFixtureBytes() };

    const second = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: secondImportId });

    assertTrue(second.success);
    if (!second.success) return;
    assertEqual(second.outcome.kind, "completed", "warning não bloqueia -- um segundo workspace é criado normalmente");
    assertTrue(
      second.outcome.issues.some((issue) => issue.code === "period_number_conflict" && issue.severity === "warning"),
      "deveria sinalizar a colisão de período como warning"
    );
    assertEqual(supabase.__tables.measurement_workspaces.length, 2, "dois workspaces distintos -- não bloqueado, não mesclado");
  });

  // Cenário 12: falha no download persiste failed + analysis_result
  // juntos, e devolve o snapshot no próprio resultado top-level.
  await runTest("falha no download persiste status=failed + analysis_result juntos, devolvidos no próprio erro", async () => {
    const supabase = newClient();
    const importId = randomUUID();
    await seedImport(supabase, { id: importId, status: "uploaded", storagePath: "caminho/que/nao/existe.xlsx" });
    // Nenhum arquivo registrado -- download deveria falhar.

    const result = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: importId });

    assertEqual(result.success, false, "download_failed é um erro top-level (contrato congelado da Sprint 4.0)");
    if (result.success) return;
    assertEqual(result.error, "download_failed");
    assertTrue(result.analysisResult !== undefined, "deveria devolver o FailedMeasurementAnalysisResult persistido, sem precisar de uma segunda consulta");
    assertEqual(result.analysisResult?.status, "failed");
    assertEqual((result.analysisResult as any)?.measurementWorkspaceId, null);

    const importRow = supabase.__tables.measurement_bulletin_imports[0];
    assertEqual(importRow?.status, "failed", "persistido no banco, não só devolvido na resposta");
    assertEqual(importRow?.analysis_result !== null && importRow?.analysis_result !== undefined, true, "analysis_result deveria estar persistido junto do status, na mesma atualização");
  });

  // import_not_found -- fronteira básica, sem analysisResult (nada foi
  // persistido).
  await runTest("import_not_found quando o id não existe (ou não pertence à company) -- sem analysisResult", async () => {
    const supabase = newClient();

    const result = await processMeasurementBulletinImport(supabase as any, { companyId: COMPANY_ID, measurementBulletinImportId: "id-inexistente" });

    assertEqual(result.success, false);
    if (result.success) return;
    assertEqual(result.error, "import_not_found");
    assertEqual(result.analysisResult, undefined, "nada foi persistido -- o import nem foi encontrado");
  });
}

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message ?? "esperava true, recebeu false");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
