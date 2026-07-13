import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Epic 20, Sprint 20.1E.2. Mesmo padrão de checagem estática já usado
// em measurement-imports-page.test.ts -- este repositório não tem
// infraestrutura de render/DOM.

const currentDir = dirname(fileURLToPath(import.meta.url));
const PAGE_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-page.tsx"), "utf8");
const HEADER_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-header.tsx"), "utf8");
const SKELETON_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-skeleton.tsx"), "utf8");
const ERROR_STATE_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-error-state.tsx"), "utf8");
const ROUTE_PAGE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "(dashboard)", "medicoes", "[measurementBulletinImportId]", "page.tsx"),
  "utf8"
);
const RENDER_SOURCE = `${PAGE_SOURCE}\n${HEADER_SOURCE}\n${SKELETON_SOURCE}\n${ERROR_STATE_SOURCE}\n${ROUTE_PAGE_SOURCE}`;

async function main(): Promise<void> {
  await runTest("cabeçalho exibe generatedAt com o rótulo correto", () => {
    assertTrue(HEADER_SOURCE.includes("Relatório gerado em"), "cabeçalho deve rotular generatedAt como 'Relatório gerado em...'");
    assertTrue(HEADER_SOURCE.includes("generatedAt"), "cabeçalho deve efetivamente usar generatedAt");
  });

  await runTest("sourceImportId nunca é exibido", () => {
    assertTrue(!RENDER_SOURCE.includes("sourceImportId"), "sourceImportId pertence a metadata técnica, não à UI");
  });

  await runTest("schemaVersion/builderVersion nunca são exibidos", () => {
    assertTrue(!/schemaVersion|builderVersion/.test(RENDER_SOURCE), "versões internas do contrato não pertencem à UI");
  });

  await runTest("nenhum acesso a Supabase nos componentes do Relatório Executivo", () => {
    assertTrue(
      !/from\s+["'][^"']*supabase[^"']*["']|createServerClient|createBrowserClient|getSupabaseBrowserClient|getSupabaseRouteHandlerClient|@supabase\//i.test(
        RENDER_SOURCE
      ),
      "não deve importar/chamar Supabase -- só GET .../decision-brief"
    );
  });

  await runTest("nenhuma chamada direta ao builder do Decision Brief", () => {
    assertTrue(!/buildMeasurementDecisionBrief\(/.test(RENDER_SOURCE), "builder é responsabilidade do Application Service (20.1C), não da UI");
  });

  await runTest("nenhuma importação de outro Studio (bba-project/geospatial)", () => {
    assertTrue(!/bba-project|geospatial/i.test(RENDER_SOURCE), "Studio de Medições não pode importar internos de outro Studio");
  });

  await runTest("nenhum LLM (Claude/Anthropic)", () => {
    assertTrue(!/claude|anthropic/i.test(RENDER_SOURCE), "esta Sprint é só o shell -- nenhuma narrativa de LLM ainda");
  });

  await runTest("nenhum aggregate de execução criado/referenciado", () => {
    assertTrue(!/ActionPlan|ExecutionTask|ExecutionWorkflow/.test(RENDER_SOURCE), "nextActions é só descritivo -- nenhum aggregate nesta Sprint");
  });

  await runTest("seções executivas futuras ainda não são renderizadas (readiness/confidence/decisões/itens/métricas)", () => {
    assertTrue(
      !/\breadiness\b|\bconfidence\b|keyDecisions|criticalItems|keyMetrics|nextActions|evidenceReferences/.test(PAGE_SOURCE),
      "só metadata.generatedAt deve ser lido do Brief carregado nesta Sprint"
    );
  });

  await runTest("placeholder 'em construção' do 20.1E.1B foi removido", () => {
    assertTrue(!/em construção|Construction/.test(ROUTE_PAGE_SOURCE), "a rota real substituiu o placeholder, não o estendeu");
  });

  await runTest("page.tsx da rota delega a MeasurementDecisionBriefPage com o id real (não measurementWorkspaceId)", () => {
    assertTrue(ROUTE_PAGE_SOURCE.includes("params.measurementBulletinImportId"), "deve usar o parâmetro real da rota");
    assertTrue(!ROUTE_PAGE_SOURCE.includes("measurementWorkspaceId"), "nunca confundir com measurementWorkspaceId");
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
