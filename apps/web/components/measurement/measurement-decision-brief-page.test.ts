import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Epic 20, Sprint 20.1E.2 (page shell/estados) + 20.1E.3 (Decision
// Hero, Principais Decisões, Ações Recomendadas) + 20.1E.4 (Itens
// Críticos) + 20.1E.5 (Medições, Detalhamento) + 20.1E.6 (padrão
// visual human-first, PRINCIPLE 008 -- protótipo validado com a
// fixture real do BM_08, implementado depois de aprovado). Mesmo
// padrão de checagem estática já usado em
// measurement-imports-page.test.ts -- este repositório não tem
// infraestrutura de render/DOM.

const currentDir = dirname(fileURLToPath(import.meta.url));
const PAGE_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-page.tsx"), "utf8");
const HEADER_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-header.tsx"), "utf8");
const SKELETON_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-skeleton.tsx"), "utf8");
const ERROR_STATE_SOURCE = readFileSync(join(currentDir, "measurement-decision-brief-error-state.tsx"), "utf8");
const HERO_SOURCE = readFileSync(join(currentDir, "measurement-decision-hero.tsx"), "utf8");
const CONFIDENCE_NOTE_SOURCE = readFileSync(join(currentDir, "measurement-confidence-note.tsx"), "utf8");
const FLOW_SOURCE = readFileSync(join(currentDir, "measurement-decision-flow-section.tsx"), "utf8");
const KEY_DECISIONS_SOURCE = readFileSync(join(currentDir, "measurement-key-decisions-section.tsx"), "utf8");
const CRITICAL_ITEMS_SECTION_SOURCE = readFileSync(join(currentDir, "measurement-critical-items-section.tsx"), "utf8");
const CRITICAL_ITEM_SOURCE = readFileSync(join(currentDir, "measurement-critical-item.tsx"), "utf8");
const CRITICAL_ITEM_VM_SOURCE = readFileSync(join(currentDir, "measurement-critical-item-view-model.ts"), "utf8");
const RECOMMENDED_ACTIONS_SOURCE = readFileSync(join(currentDir, "measurement-recommended-actions-section.tsx"), "utf8");
const RECOMMENDED_ACTION_SOURCE = readFileSync(join(currentDir, "measurement-recommended-action.tsx"), "utf8");
const SUMMARY_SOURCE = readFileSync(join(currentDir, "measurement-summary-section.tsx"), "utf8");
const DETAILS_SOURCE = readFileSync(join(currentDir, "measurement-details-section.tsx"), "utf8");
const CELL_REFERENCE_SOURCE = readFileSync(join(currentDir, "measurement-cell-reference.tsx"), "utf8");
const EVIDENCE_VM_SOURCE = readFileSync(join(currentDir, "measurement-evidence-reference-view-model.ts"), "utf8");
const ROUTE_PAGE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "(dashboard)", "medicoes", "[measurementBulletinImportId]", "page.tsx"),
  "utf8"
);
const GLOBALS_CSS_SOURCE = readFileSync(join(currentDir, "..", "..", "app", "bba-globals.css"), "utf8");
const RENDER_SOURCE = `${PAGE_SOURCE}\n${HEADER_SOURCE}\n${SKELETON_SOURCE}\n${ERROR_STATE_SOURCE}\n${HERO_SOURCE}\n${CONFIDENCE_NOTE_SOURCE}\n${FLOW_SOURCE}\n${KEY_DECISIONS_SOURCE}\n${CRITICAL_ITEMS_SECTION_SOURCE}\n${CRITICAL_ITEM_SOURCE}\n${CRITICAL_ITEM_VM_SOURCE}\n${RECOMMENDED_ACTIONS_SOURCE}\n${RECOMMENDED_ACTION_SOURCE}\n${SUMMARY_SOURCE}\n${DETAILS_SOURCE}\n${CELL_REFERENCE_SOURCE}\n${EVIDENCE_VM_SOURCE}\n${ROUTE_PAGE_SOURCE}`;

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

  await runTest("ordem final: Hero, Fluxo, Decisões, Itens Críticos, Ações, Medições, Detalhamento", () => {
    const flowIndex = PAGE_SOURCE.indexOf("MeasurementDecisionFlowSection");
    const decisionsIndex = PAGE_SOURCE.indexOf("MeasurementKeyDecisionsSection");
    const criticalIndex = PAGE_SOURCE.indexOf("MeasurementCriticalItemsSection");
    const actionsIndex = PAGE_SOURCE.indexOf("MeasurementRecommendedActionsSection");
    const summaryIndex = PAGE_SOURCE.indexOf("MeasurementSummarySection");
    const detailsIndex = PAGE_SOURCE.indexOf("MeasurementDetailsSection");
    assertTrue(
      flowIndex !== -1 &&
        decisionsIndex > flowIndex &&
        criticalIndex > decisionsIndex &&
        actionsIndex > criticalIndex &&
        summaryIndex > actionsIndex &&
        detailsIndex > summaryIndex,
      "ordem final aprovada no protótipo: Itens Críticos precede Ações Recomendadas, invertido em relação a Sprints anteriores"
    );
  });

  await runTest("MeasurementEvidenceLineageSection não é mais renderizada -- nenhuma seção final repetindo Ações/Itens", () => {
    assertTrue(!PAGE_SOURCE.includes("MeasurementEvidenceLineageSection"), "a página não deve importar/renderizar a seção final autônoma");
    assertTrue(!RENDER_SOURCE.includes("Origem documental") && !/title="Evidências"/.test(RENDER_SOURCE), "nenhum heading de seção final consolidada deve sobreviver");
  });

  await runTest("Item Crítico apresenta os quatro blocos decisórios com vocabulário humano", () => {
    assertTrue(
      CRITICAL_ITEM_SOURCE.includes("O problema") &&
        CRITICAL_ITEM_SOURCE.includes("Onde está") &&
        CRITICAL_ITEM_SOURCE.includes("Se for ignorado") &&
        CRITICAL_ITEM_SOURCE.includes("Ao corrigir"),
      "os quatro blocos devem usar o vocabulário aprovado no protótipo"
    );
  });

  await runTest("'Onde está' só existe quando o item tem evidenceReferences reais", () => {
    assertTrue(CRITICAL_ITEM_SOURCE.includes("hasLocation") && CRITICAL_ITEM_SOURCE.includes("item.evidenceReferences.length > 0"), "guard explícito antes de mostrar localização");
  });

  await runTest("'Se for ignorado' precede 'Ao corrigir' no código-fonte (ordem aprovada no protótipo)", () => {
    const ignoredIndex = CRITICAL_ITEM_SOURCE.indexOf("Se for ignorado");
    const addressedIndex = CRITICAL_ITEM_SOURCE.indexOf("Ao corrigir");
    assertTrue(ignoredIndex !== -1 && addressedIndex > ignoredIndex, "risco antes do caminho positivo, conforme corrigido pelo usuário");
  });

  await runTest("origem do Item Crítico usa MeasurementCellReference com item.evidenceReferences, nunca outro campo", () => {
    assertTrue(CRITICAL_ITEM_SOURCE.includes("<MeasurementCellReference") && CRITICAL_ITEM_SOURCE.includes("item.evidenceReferences"), "origem deve ser contextual ao item");
  });

  await runTest("origem da Ação Recomendada usa MeasurementCellReference com action.evidenceReferences, nunca outro campo", () => {
    assertTrue(
      RECOMMENDED_ACTION_SOURCE.includes("<MeasurementCellReference") && RECOMMENDED_ACTION_SOURCE.includes("action.evidenceReferences"),
      "origem deve ser contextual à ação"
    );
  });

  await runTest("MeasurementCellReference nunca renderiza nada quando não há referência (sem referência = nenhum crachá)", () => {
    assertTrue(/groups\.length === 0[\s\S]{0,20}return null/.test(CELL_REFERENCE_SOURCE), "componente deve devolver null quando não há referência");
  });

  await runTest("MeasurementCellReference mostra o nome real da planilha por extenso, nunca abreviado", () => {
    assertTrue(CELL_REFERENCE_SOURCE.includes("group.sheetName") && !/BM_08|BM08/.test(CELL_REFERENCE_SOURCE), "sheetName deve aparecer verbatim, sem abreviação inventada pela UI");
  });

  await runTest("origem não é mais uma segunda camada de expansão -- sem toggle próprio, sem 'Ver onde foi encontrado'", () => {
    assertTrue(!/Ver onde foi encontrado|Ocultar origem/.test(RENDER_SOURCE), "a origem virou um bloco sempre visível ao expandir o item/ação, não um segundo clique (protótipo validado)");
  });

  await runTest("nenhuma associação inferida entre Ação Recomendada e Item Crítico", () => {
    assertTrue(!RECOMMENDED_ACTION_SOURCE.includes("criticalItems") && !RECOMMENDED_ACTION_SOURCE.includes("CriticalItem"), "ação não pode referenciar item crítico");
    assertTrue(!CRITICAL_ITEM_SOURCE.includes("nextActions") && !CRITICAL_ITEMS_SECTION_SOURCE.includes("nextActions"), "item crítico não pode referenciar ações");
  });

  await runTest("origem documental nunca ordena, deduplica ou escolhe uma referência principal", () => {
    assertTrue(!/\.sort\(|\.reverse\(/.test(CELL_REFERENCE_SOURCE) && !/\.sort\(|\.reverse\(/.test(EVIDENCE_VM_SOURCE), "ordem das referências deve ser preservada");
    assertTrue(!/new Set|Array\.from\(new Set/.test(CELL_REFERENCE_SOURCE), "nenhuma dedup própria -- o agrupamento adjacente já existente é a única mesclagem permitida");
  });

  await runTest("nenhuma promessa de abrir Excel, navegar até célula, baixar ou usar drawer/modal", () => {
    assertTrue(
      !/Abrir planilha|Abrir Excel|Ver célula|Ir para célula|Ver no documento|Navegar até origem|Abrir arquivo|Baixar evidência/i.test(RENDER_SOURCE),
      "nenhuma promessa de capacidade inexistente"
    );
    assertTrue(!/drawer|modal|download|clipboard/i.test(CELL_REFERENCE_SOURCE), "componente é só apresentação, sem navegação nem I/O");
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

  await runTest("sourceId/sourceType e UUID nunca aparecem", () => {
    assertTrue(!RENDER_SOURCE.includes(".sourceType") && !RENDER_SOURCE.includes("sourceId"), "sourceId/sourceType são metadata técnica, não UI");
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

  await runTest("Itens Críticos não ordena nem filtra o array recebido (slice de exibição é permitido, sort/filter não)", () => {
    assertTrue(!/\.sort\(|\.reverse\(|\.filter\(/.test(CRITICAL_ITEMS_SECTION_SOURCE), "criticalItems deve ser apresentado exatamente como veio, na mesma ordem");
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

  await runTest("Hero conta bloqueantes/pontos de atenção pela mesma distinção de severidade do builder (nunca criticalItems.length bruto)", () => {
    assertTrue(
      HERO_SOURCE.includes('item.severity === "blocking"') && HERO_SOURCE.includes('item.severity === "warning"'),
      "as duas contagens devem usar o mesmo split de severidade que buildKeyMetrics já usa, nunca o total bruto do array"
    );
  });

  await runTest("Hero usa nextActions[0] verbatim como próximo passo, nunca uma frase sintetizada, e omite o bloco quando vazio", () => {
    assertTrue(HERO_SOURCE.includes("nextActions[0]") && HERO_SOURCE.includes("firstAction.title"), "próximo passo deve ser o título real da primeira ação");
    assertTrue(/firstAction !== null/.test(HERO_SOURCE), "bloco deve ser omitido quando não há nextActions");
  });

  await runTest("confidence indisponível nunca produz score/percentual/barra", () => {
    assertTrue(!/\.score\b|\blevel\b|%\s*</.test(CONFIDENCE_NOTE_SOURCE), "nenhuma visualização numérica improvisada nesta Sprint");
  });

  await runTest("Fluxo de decisão (Como chegamos aqui) usa as mesmas contagens reais do Hero e o mesmo translateReadiness, nunca uma etapa inventada", () => {
    assertTrue(FLOW_SOURCE.includes('item.severity === "warning"') && FLOW_SOURCE.includes("nextActions.length"), "contagens devem ser as mesmas do Hero");
    assertTrue(FLOW_SOURCE.includes("translateReadiness"), "passo final deve reaproveitar a mesma tradução de readiness do Hero, não uma nova");
    assertTrue(!/toda a planilha foi lida|cobertura (total|integral)/i.test(FLOW_SOURCE), "nenhuma alegação de cobertura que o contrato não garanta");
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
    assertTrue(!/type="checkbox"|Executar|Criar tarefa/i.test(RECOMMENDED_ACTIONS_SOURCE) && !/type="checkbox"|Executar|Criar tarefa/i.test(RECOMMENDED_ACTION_SOURCE), "nextActions são só descritivas");
  });

  await runTest("Ação Recomendada agora é recolhida por padrão (useState(false), aria-expanded/aria-controls, botão real)", () => {
    assertTrue(RECOMMENDED_ACTION_SOURCE.includes("useState(false)"), "rationale deve começar recolhido, mesmo padrão do Item Crítico");
    assertTrue(RECOMMENDED_ACTION_SOURCE.includes("aria-expanded") && RECOMMENDED_ACTION_SOURCE.includes("aria-controls") && /<button\b/.test(RECOMMENDED_ACTION_SOURCE), "expansão deve ser acessível");
  });

  await runTest("os três blocos do Item Crítico têm ícone e classe visual próprios (nunca a mesma marcação)", () => {
    assertTrue(
      CRITICAL_ITEM_SOURCE.includes("measurement-critical-item__block--positive") && CRITICAL_ITEM_SOURCE.includes("measurement-critical-item__block--negative"),
      "consequências precisam de classe visual distinta"
    );
    assertTrue(
      CRITICAL_ITEM_SOURCE.includes("<SearchCheck") && CRITICAL_ITEM_SOURCE.includes("<MapPin") && CRITICAL_ITEM_SOURCE.includes("<CircleCheck") && CRITICAL_ITEM_SOURCE.includes("<ShieldAlert"),
      "cada bloco precisa de um ícone próprio, não decorativo apenas por cor"
    );
  });

  await runTest("ícones decorativos usam aria-hidden (não competem com o texto na leitura assistiva)", () => {
    assertTrue(
      /<SearchCheck aria-hidden="true"/.test(CRITICAL_ITEM_SOURCE) &&
        /<MapPin aria-hidden="true"/.test(CRITICAL_ITEM_SOURCE) &&
        /<CircleCheck aria-hidden="true"/.test(CRITICAL_ITEM_SOURCE) &&
        /<ShieldAlert aria-hidden="true"/.test(CRITICAL_ITEM_SOURCE),
      "ícone de bloco deve ser aria-hidden"
    );
  });

  await runTest("gatilho do Item Crítico é acessível (aria-expanded/aria-controls em botão real)", () => {
    assertTrue(
      CRITICAL_ITEM_SOURCE.includes("aria-expanded") && CRITICAL_ITEM_SOURCE.includes("aria-controls") && /<button\b/.test(CRITICAL_ITEM_SOURCE),
      "expansão do item precisa continuar acessível"
    );
  });

  await runTest("ícones de Principais Decisões e Ações Recomendadas são decorativos, presos só a campos reais (recommended)", () => {
    assertTrue(KEY_DECISIONS_SOURCE.includes("aria-hidden") && /decision\.recommended/.test(KEY_DECISIONS_SOURCE), "ícone de decisão depende só do booleano real recommended");
    assertTrue(RECOMMENDED_ACTION_SOURCE.includes("aria-hidden"), "ícone de ação é decorativo");
    assertTrue(!/prioridade|urgência|prazo/i.test(RECOMMENDED_ACTION_SOURCE), "nenhum campo inventado para justificar o ícone");
  });

  await runTest("Caminho recomendado usa o rótulo aprovado ('Caminho recomendado'/'Outra possibilidade'), não o antigo 'Recomendação principal'/'Alternativa'", () => {
    assertTrue(KEY_DECISIONS_SOURCE.includes("Caminho recomendado") && KEY_DECISIONS_SOURCE.includes("Outra possibilidade"), "vocabulário do protótipo aprovado");
  });

  await runTest("Medições, Principais Decisões e Ações Recomendadas usam layout de card (grid/borda), não lista densa de texto", () => {
    assertTrue(/\.measurement-summary-list\s*\{[^}]*display:\s*grid/.test(GLOBALS_CSS_SOURCE), "keyMetrics deve ser apresentado como grid de cards");
    assertTrue(/\.measurement-key-decisions-list\s*\{[^}]*display:\s*grid/.test(GLOBALS_CSS_SOURCE), "Principais Decisões deve ser um grid de cards");
    assertTrue(/\.measurement-recommended-actions-list__item\s*\{[^}]*border:/.test(GLOBALS_CSS_SOURCE), "cada Ação Recomendada deve ter borda própria de card");
  });

  await runTest("blocos positivo/negativo do Item Crítico têm tratamento visual distinto além de cor (borda + fundo próprios)", () => {
    assertTrue(
      /\.measurement-critical-item__block--positive\s*\{[^}]*background:/.test(GLOBALS_CSS_SOURCE) &&
        /\.measurement-critical-item__block--negative\s*\{[^}]*background:/.test(GLOBALS_CSS_SOURCE),
      "cada bloco precisa de fundo próprio, não só cor de texto"
    );
  });

  await runTest("nenhuma biblioteca de gráfico foi introduzida (nenhum apoio visual fabricado)", () => {
    assertTrue(!/recharts|chart\.js|d3-|victory-|nivo/i.test(RENDER_SOURCE), "nenhum gráfico deve ser criado a partir de dado narrativo");
  });

  await runTest("'Ver mais' de Itens Críticos revela itens reais adicionais, nunca funde/trunca dado -- o array inteiro é sempre passado ao .map", () => {
    assertTrue(CRITICAL_ITEMS_SECTION_SOURCE.includes("VISIBLE_COUNT"), "deve existir um limite de exibição explícito, não implícito");
    assertTrue(CRITICAL_ITEMS_SECTION_SOURCE.includes("showAll ? criticalItems : criticalItems.slice"), "o array completo continua disponível; slice só controla o que já está visível");
    assertTrue(CRITICAL_ITEMS_SECTION_SOURCE.includes("criticalItems.length - VISIBLE_COUNT"), "contagem de 'ver mais' deve ser derivada do total real, nunca um número fixo");
  });

  await runTest("'Ver mais' de Ações Recomendadas revela ações reais adicionais, nunca funde/trunca dado", () => {
    assertTrue(RECOMMENDED_ACTIONS_SOURCE.includes("VISIBLE_COUNT"), "deve existir um limite de exibição explícito");
    assertTrue(RECOMMENDED_ACTIONS_SOURCE.includes("showAll ? nextActions : nextActions.slice"), "o array completo continua disponível");
  });

  await runTest("controle 'Ver mais'/'Mostrar menos' é um botão real com aria-expanded, nunca um texto de resumo estático", () => {
    assertTrue(CRITICAL_ITEMS_SECTION_SOURCE.includes("aria-expanded={showAll}") && /<button\b/.test(CRITICAL_ITEMS_SECTION_SOURCE), "Itens Críticos: controle real");
    assertTrue(RECOMMENDED_ACTIONS_SOURCE.includes("aria-expanded={showAll}") && /<button\b/.test(RECOMMENDED_ACTIONS_SOURCE), "Ações Recomendadas: controle real");
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
