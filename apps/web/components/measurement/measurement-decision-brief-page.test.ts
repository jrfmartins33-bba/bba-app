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
const CRITICAL_ITEMS_SECTION_SOURCE = readFileSync(join(currentDir, "measurement-critical-items-section.tsx"), "utf8");
const CRITICAL_ITEM_SOURCE = readFileSync(join(currentDir, "measurement-critical-item.tsx"), "utf8");
const CRITICAL_ITEM_VM_SOURCE = readFileSync(join(currentDir, "measurement-critical-item-view-model.ts"), "utf8");
const SUMMARY_SOURCE = readFileSync(join(currentDir, "measurement-summary-section.tsx"), "utf8");
const DETAILS_SOURCE = readFileSync(join(currentDir, "measurement-details-section.tsx"), "utf8");
const ROUTE_PAGE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "(dashboard)", "medicoes", "[measurementBulletinImportId]", "page.tsx"),
  "utf8"
);
const RENDER_SOURCE = `${PAGE_SOURCE}\n${HEADER_SOURCE}\n${SKELETON_SOURCE}\n${ERROR_STATE_SOURCE}\n${HERO_SOURCE}\n${CONFIDENCE_NOTE_SOURCE}\n${KEY_DECISIONS_SOURCE}\n${RECOMMENDED_ACTIONS_SOURCE}\n${CRITICAL_ITEMS_SECTION_SOURCE}\n${CRITICAL_ITEM_SOURCE}\n${CRITICAL_ITEM_VM_SOURCE}\n${SUMMARY_SOURCE}\n${DETAILS_SOURCE}\n${ROUTE_PAGE_SOURCE}`;

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

  await runTest("Itens Críticos vem depois de Ações Recomendadas, Medições depois de Itens Críticos, Detalhamento depois de Medições", () => {
    const recommendedIndex = PAGE_SOURCE.indexOf("MeasurementRecommendedActionsSection");
    const criticalIndex = PAGE_SOURCE.indexOf("MeasurementCriticalItemsSection");
    const summaryIndex = PAGE_SOURCE.indexOf("MeasurementSummarySection");
    const detailsIndex = PAGE_SOURCE.indexOf("MeasurementDetailsSection");
    assertTrue(
      recommendedIndex !== -1 && criticalIndex > recommendedIndex && summaryIndex > criticalIndex && detailsIndex > summaryIndex,
      "ordem final: Hero, Decisões, Ações, Itens Críticos, Medições, Detalhamento"
    );
  });

  await runTest("Medições (keyMetrics) preserva a ordem, sem sort/reverse/filter baseado em conteúdo", () => {
    assertTrue(!/\.sort\(|\.reverse\(|\.filter\(/.test(SUMMARY_SOURCE), "keyMetrics deve ser apresentado exatamente como veio");
  });

  await runTest("Medições nunca calcula, soma, converte para número ou formata moeda na UI", () => {
    assertTrue(
      !/Number\(|parseFloat\(|parseInt\(|Intl\.NumberFormat|toLocaleString\(|\+\s*metric|metric\.value\s*\*|metric\.value\s*-/.test(SUMMARY_SOURCE),
      "value já vem formatado do builder -- a UI só exibe"
    );
  });

  await runTest("label e value de cada métrica vêm diretamente do Brief", () => {
    assertTrue(SUMMARY_SOURCE.includes("metric.label") && SUMMARY_SOURCE.includes("metric.value"), "sem recomposição de texto");
  });

  await runTest("Medições nunca fica vazia silenciosamente -- estado vazio explícito, sem linguagem de erro", () => {
    assertTrue(SUMMARY_SOURCE.includes("Nenhuma métrica executiva disponível para esta análise."), "texto aprovado deve estar presente");
    assertTrue(!/Sem dados|Erro|Análise incompleta/i.test(SUMMARY_SOURCE), "nenhuma linguagem de erro no estado vazio");
  });

  await runTest("Medições não usa gráfico, KPI card ou vocabulário técnico em inglês", () => {
    assertTrue(!/chart|kpi|dashboard/i.test(SUMMARY_SOURCE), "seção deve parecer resumo executivo, não painel de BI");
  });

  await runTest("Detalhamento (details) não expõe JSON, chaves técnicas ou Object.entries genérico", () => {
    assertTrue(!/JSON\.stringify|Object\.entries|Object\.keys/.test(DETAILS_SOURCE), "details é {title, body} -- nenhum renderer genérico de objeto");
  });

  await runTest("Detalhamento vem diretamente de details.body, sem resumo/truncamento em JavaScript", () => {
    assertTrue(DETAILS_SOURCE.includes("details.body"), "conteúdo deve vir direto do Brief");
    assertTrue(!/details\.body\.(slice|substring|split)\(/.test(DETAILS_SOURCE), "nenhum truncamento/resumo do texto do builder");
  });

  await runTest("Detalhamento começa recolhido (useState(false)) e usa botão real com aria-expanded/aria-controls", () => {
    assertTrue(DETAILS_SOURCE.includes("useState(false)"), "deve começar recolhido");
    assertTrue(DETAILS_SOURCE.includes("aria-expanded") && DETAILS_SOURCE.includes("aria-controls"), "expansão deve ser acessível");
  });

  await runTest("Detalhamento não inventa tabela nem reproduz a planilha", () => {
    assertTrue(!/<table|<thead|<tbody/i.test(DETAILS_SOURCE), "details não é dado tabular -- nenhuma tabela inventada");
  });

  await runTest("Detalhamento tem estado vazio explícito, sem linguagem de erro", () => {
    assertTrue(DETAILS_SOURCE.includes("Nenhum detalhamento adicional disponível."), "texto aprovado deve estar presente");
    assertTrue(!/Erro ao carregar|Sem análise|Não processado|Dados insuficientes/i.test(DETAILS_SOURCE), "nenhuma linguagem de erro no estado vazio");
  });

  await runTest("itens críticos começam recolhidos (useState(false))", () => {
    assertTrue(CRITICAL_ITEM_SOURCE.includes("useState(false)"), "cada item deve começar recolhido");
  });

  await runTest("cada item crítico tem estado próprio -- nenhum isOpen/onToggle recebido do pai (accordion compartilhado não foi pedido)", () => {
    assertTrue(!/isOpen|onToggle/.test(CRITICAL_ITEM_SOURCE), "estado deve ser local a cada item, não elevado/compartilhado");
    assertTrue(!/isOpen|onToggle/.test(CRITICAL_ITEMS_SECTION_SOURCE), "a seção não deve controlar qual item está aberto");
  });

  await runTest("título e fato técnico vêm diretamente do Brief, sem transformação de texto", () => {
    assertTrue(CRITICAL_ITEM_SOURCE.includes("item.title") && CRITICAL_ITEM_SOURCE.includes("item.body"), "title/body devem vir direto do item");
    assertTrue(!/item\.(title|body)\.(toLowerCase|toUpperCase|slice|substring|replace|trim)\(/.test(CRITICAL_ITEM_SOURCE), "nenhuma transformação de texto -- nem correção de gramática/plural/moeda");
  });

  await runTest("consequências vêm diretamente do Brief, sem fallback textual quando ausentes", () => {
    assertTrue(
      CRITICAL_ITEM_SOURCE.includes("item.consequenceIfAddressed") && CRITICAL_ITEM_SOURCE.includes("item.consequenceIfIgnored"),
      "consequências devem vir direto do item"
    );
    assertTrue(!/N\/A|Sem consequência|Nenhuma consequência/i.test(CRITICAL_ITEM_SOURCE), "nenhum fallback textual inventado para consequência ausente");
  });

  await runTest("ambas as consequências ausentes omitem toda a área (nenhum bloco vazio)", () => {
    assertTrue(CRITICAL_ITEM_SOURCE.includes("hasConsequences"), "deve existir um guard explícito antes de renderizar a área de consequências");
  });

  await runTest("referência vazia omite a área de origem; sourceId/sourceType nunca aparecem", () => {
    assertTrue(CRITICAL_ITEM_SOURCE.includes("referenceGroups.length > 0"), "área de origem só aparece quando há referência");
    assertTrue(!RENDER_SOURCE.includes(".sourceType") && !RENDER_SOURCE.includes("sourceId"), "sourceId/sourceType são metadata técnica, não UI");
  });

  await runTest("nenhuma navegação, drawer, download ou botão de abrir planilha/célula nesta Sprint", () => {
    assertTrue(!/drawer|modal|download/i.test(RENDER_SOURCE), "origem é só leitura nesta Sprint -- interação pertence ao 20.1E.6");
    assertTrue(!/Abrir planilha|Ver célula/i.test(RENDER_SOURCE), "nenhum botão de navegação para a planilha ainda");
  });

  await runTest("nenhum vínculo inferido entre item crítico e nextActions (sem campo estrutural no contrato)", () => {
    assertTrue(!CRITICAL_ITEM_SOURCE.includes("nextActions") && !CRITICAL_ITEMS_SECTION_SOURCE.includes("nextActions"), "sem criticalItemId no contrato, a UI não pode inventar essa relação");
  });

  await runTest("nenhum botão de aprovação/execução nos itens críticos", () => {
    assertTrue(!/Aprovar|Executar|Criar tarefa|type="checkbox"/i.test(CRITICAL_ITEM_SOURCE), "itens críticos são só leitura");
  });

  await runTest("estado vazio explícito quando criticalItems está vazio, sem linguagem de aprovação", () => {
    assertTrue(CRITICAL_ITEMS_SECTION_SOURCE.includes("Nenhum item crítico identificado."), "deve existir estado vazio explícito e positivo");
    assertTrue(!/Aprovad|Certificad|100% conforme|Sem riscos/i.test(CRITICAL_ITEMS_SECTION_SOURCE), "estado vazio não pode soar como aprovação formal");
  });

  await runTest("Itens Críticos não ordena nem filtra o array recebido", () => {
    assertTrue(!/\.sort\(|\.reverse\(|\.filter\(/.test(CRITICAL_ITEMS_SECTION_SOURCE), "criticalItems deve ser apresentado exatamente como veio");
    assertTrue(!/\.sort\(|\.reverse\(/.test(CRITICAL_ITEM_SOURCE), "evidenceReferences não pode ser reordenado");
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
