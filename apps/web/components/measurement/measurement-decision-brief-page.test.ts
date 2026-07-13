import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Epic 20, Sprint 20.1E.2 (page shell/estados) + 20.1E.3 (Decision
// Hero, Principais Decisões, Ações Recomendadas). Mesmo padrão de
// checagem estática já usado em measurement-imports-page.test.ts --
// este repositório não tem infraestrutura de render/DOM.

const currentDir = dirname(fileURLToPath(import.meta.url));
const PAGE_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-page.tsx"), "utf8");
const HEADER_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-header.tsx"), "utf8");
const SKELETON_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-skeleton.tsx"), "utf8");
const ERROR_STATE_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-error-state.tsx"), "utf8");
const HERO_SOURCE = readFileSync(join(currentDir, "measurement-decision-hero.tsx"), "utf8");
const CONFIDENCE_NOTE_SOURCE = readFileSync(join(currentDir, "measurement-confidence-note.tsx"), "utf8");
const KEY_DECISIONS_SOURCE = readFileSync(join(currentDir, "measurement-key-decisions-section.tsx"), "utf8");
const RECOMMENDED_ACTIONS_SOURCE = readFileSync(join(currentDir, "measurement-recommended-actions-section.tsx"), "utf8");
const ROUTE_PAGE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "(dashboard)", "medicoes", "[measurementBulletinImportId]", "page.tsx"),
  "utf8"
);
const RENDER_SOURCE = `${PAGE_SOURCE}\n${HEADER_SOURCE}\n${SKELETON_SOURCE}\n${ERROR_STATE_SOURCE}\n${HERO_SOURCE}\n${CONFIDENCE_NOTE_SOURCE}\n${KEY_DECISIONS_SOURCE}\n${RECOMMENDED_ACTIONS_SOURCE}\n${ROUTE_PAGE_SOURCE}`;

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
    assertTrue(!/claude|anthropic/i.test(RENDER_SOURCE), "nenhuma narrativa de LLM nesta Sprint -- só apresentação direta do Brief");
  });

  await runTest("nenhum aggregate de execução criado/referenciado", () => {
    assertTrue(!/ActionPlan|ExecutionTask|ExecutionWorkflow/.test(RENDER_SOURCE), "nextActions é só descritivo -- nenhum aggregate nesta Sprint");
  });

  await runTest("itens críticos, métricas, detalhamento e evidências ainda não são renderizados", () => {
    assertTrue(
      !/criticalItems|keyMetrics|\bdetails\b|evidenceReferences/.test(RENDER_SOURCE),
      "esses campos pertencem às Sprints 20.1E.4 e 20.1E.6, não a esta"
    );
  });

  await runTest("placeholder 'em construção' do 20.1E.1B foi removido", () => {
    assertTrue(!/em construção|Construction/.test(ROUTE_PAGE_SOURCE), "a rota real substituiu o placeholder, não o estendeu");
  });

  await runTest("shell temporário 'Relatório carregado com sucesso' do 20.1E.2 foi removido", () => {
    assertTrue(!PAGE_SOURCE.includes("Relatório carregado com sucesso"), "o shell temporário deve ter sido substituído pelo conteúdo real");
  });

  await runTest("page.tsx da rota delega a MeasurementDecisionBriefPage com o id real (não measurementWorkspaceId)", () => {
    assertTrue(ROUTE_PAGE_SOURCE.includes("params.measurementBulletinImportId"), "deve usar o parâmetro real da rota");
    assertTrue(!ROUTE_PAGE_SOURCE.includes("measurementWorkspaceId"), "nunca confundir com measurementWorkspaceId");
  });

  await runTest("Hero traduz readiness sem vocabulário de aprovação formal", () => {
    assertTrue(!/Aprovada|Reprovada|Certificada|Homologada|\bAceita\b|Rejeitada/.test(HERO_SOURCE), "readiness é prontidão técnica, não decisão humana consumada");
  });

  await runTest("Hero lê headline/body/situation diretamente do Brief, sem recompor texto", () => {
    assertTrue(HERO_SOURCE.includes("executiveConclusion.headline"), "headline deve vir direto do Brief");
    assertTrue(HERO_SOURCE.includes("executiveConclusion.body"), "body deve vir direto do Brief");
    assertTrue(HERO_SOURCE.includes("situation.title") && HERO_SOURCE.includes("situation.body"), "situation deve vir direto do Brief");
  });

  await runTest("confidence indisponível nunca produz score/percentual/barra", () => {
    assertTrue(!/\.score\b|\blevel\b|%\s*</.test(CONFIDENCE_NOTE_SOURCE), "nenhuma visualização numérica improvisada nesta Sprint");
  });

  await runTest("Principais Decisões e Ações Recomendadas nunca ordenam o array (preserva ordem do builder)", () => {
    assertTrue(!/\.sort\(|\.reverse\(/.test(KEY_DECISIONS_SOURCE), "keyDecisions não pode ser reordenado");
    assertTrue(!/\.sort\(|\.reverse\(/.test(RECOMMENDED_ACTIONS_SOURCE), "nextActions não pode ser reordenado");
  });

  await runTest("Principais Decisões e Ações Recomendadas omitem a seção quando o array está vazio", () => {
    assertTrue(/length === 0[\s\S]{0,20}return null/.test(KEY_DECISIONS_SOURCE), "keyDecisions vazio deve omitir a seção, não criar decisão genérica");
    assertTrue(/length === 0[\s\S]{0,20}return null/.test(RECOMMENDED_ACTIONS_SOURCE), "nextActions vazio deve omitir a seção, não criar ação genérica");
  });

  await runTest("recommended nunca vira botão de aprovação/execução/checkbox", () => {
    assertTrue(!/Aprovar|Executar|Criar tarefa|type="checkbox"/i.test(KEY_DECISIONS_SOURCE), "recommended só marca visualmente, nunca aciona algo");
    assertTrue(!/type="checkbox"|Executar|Criar tarefa/i.test(RECOMMENDED_ACTIONS_SOURCE), "nextActions são só descritivas");
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
