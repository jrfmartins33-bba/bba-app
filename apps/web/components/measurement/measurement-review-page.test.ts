import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// "Revisar medição" -- teste direcionado (item 14 da especificação),
// não suíte geral. Mesmo padrão estático (sem infraestrutura de
// render/DOM) já usado por measurement-decision-brief-page.test.ts.

const currentDir = dirname(fileURLToPath(import.meta.url));

const FORMAL_STATUS_CARD_SOURCE = readFileSync(join(currentDir, "measurement-bulletin-formal-status-card.tsx"), "utf8");
const REVIEW_PAGE_SOURCE = readFileSync(join(currentDir, "measurement-review-page.tsx"), "utf8");
const REVIEW_ITEM_ROW_SOURCE = readFileSync(join(currentDir, "measurement-review-item-row.tsx"), "utf8");
const REVIEW_CLIENT_SOURCE = readFileSync(join(currentDir, "measurement-review-client.ts"), "utf8");
const CERTIFICATION_DIALOG_SOURCE = readFileSync(join(currentDir, "measurement-certification-confirm-dialog.tsx"), "utf8");
const CERTIFICATION_PREVIEW_CLIENT_SOURCE = readFileSync(join(currentDir, "measurement-certification-preview-client.ts"), "utf8");
const REFUSAL_DIALOG_SOURCE = readFileSync(join(currentDir, "measurement-refusal-dialog.tsx"), "utf8");
const REVIEW_VIEW_MODEL_SOURCE = readFileSync(join(currentDir, "measurement-review-view-model.ts"), "utf8");
const CONTRACT_DISCOUNT_CARD_SOURCE = readFileSync(join(currentDir, "measurement-contract-discount-card.tsx"), "utf8");
const OBRA_CARD_SOURCE = readFileSync(join(currentDir, "measurement-physical-financial-obra-card.tsx"), "utf8");
const PHYSICAL_FINANCIAL_SERVICE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "lib", "bdos", "measurement-physical-financial-analysis-service.ts"),
  "utf8"
);
const GLOBALS_CSS_SOURCE = readFileSync(join(currentDir, "..", "..", "app", "bba-globals.css"), "utf8");
const ECONOMIC_COMPARISON_SERVICE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "lib", "bdos", "measurement-item-economic-comparison-service.ts"),
  "utf8"
);
const ROUTE_PAGE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "(dashboard)", "medicoes", "[measurementBulletinImportId]", "revisar", "page.tsx"),
  "utf8"
);
const REVIEW_ROUTE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "api", "measurement", "imports", "[measurementBulletinImportId]", "review", "route.ts"),
  "utf8"
);
const REVIEW_ROUTE_HANDLER_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "api", "measurement", "imports", "[measurementBulletinImportId]", "review", "measurement-bulletin-review-route-handler.ts"),
  "utf8"
);
const CERTIFY_ROUTE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "api", "measurement", "imports", "[measurementBulletinImportId]", "certify", "route.ts"),
  "utf8"
);
const CERTIFY_ROUTE_HANDLER_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "api", "measurement", "imports", "[measurementBulletinImportId]", "certify", "measurement-certify-route-handler.ts"),
  "utf8"
);
const CERTIFICATION_PREVIEW_ROUTE_SOURCE = readFileSync(
  join(currentDir, "..", "..", "app", "api", "measurement", "imports", "[measurementBulletinImportId]", "certification-preview", "route.ts"),
  "utf8"
);

async function main(): Promise<void> {
  // 1. Relatório Executivo abre Revisar medição.
  await runTest("card do boletim formal (Relatório Executivo) oferece 'Revisar medição', navegando para a tela dedicada", () => {
    assertTrue(FORMAL_STATUS_CARD_SOURCE.includes("Revisar medição"), "ação principal deve existir literalmente no card");
    assertTrue(
      /href=\{`\/medicoes\/\$\{measurementBulletinImportId\}\/revisar`\}/.test(FORMAL_STATUS_CARD_SOURCE),
      "deve navegar para .../medicoes/[id]/revisar, nunca certificar direto no Relatório Executivo"
    );
    assertTrue(!/Certificar medição|\/certify/.test(FORMAL_STATUS_CARD_SOURCE), "o Relatório Executivo não deve oferecer o botão/rota de certificação diretamente");
  });

  await runTest("rota da tela delega a MeasurementReviewPage com o id real do import", () => {
    assertTrue(ROUTE_PAGE_SOURCE.includes("MeasurementReviewPage"), "página deve delegar ao client component dedicado");
    assertTrue(ROUTE_PAGE_SOURCE.includes("params.measurementBulletinImportId"), "id real da URL, nunca um placeholder");
  });

  // 2. Tela mostra os itens reais.
  await runTest("tela mostra os itens reais do boletim, um <li> por item, sem fundir/truncar o array", () => {
    assertTrue(REVIEW_PAGE_SOURCE.includes("state.review.items.map((item) => ("), "cada item do array deve virar sua própria linha");
    assertTrue(REVIEW_PAGE_SOURCE.includes("MeasurementReviewItemRow"), "linha reutiliza o componente dedicado, não markup duplicado");
  });

  await runTest("linha do item mostra código/serviço/unidade/quantidade/preço unitário/valor -- vocabulário humano, não ERP", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("item.code"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("item.description"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("item.unit"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("item.quantityDecimal"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("item.unitValueDecimal"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("item.valueDecimal"));
    assertTrue(!/\bid\b.*<span/.test(REVIEW_ITEM_ROW_SOURCE), "nenhum id técnico despejado na linha principal");
  });

  // 3. Total vem do backend.
  await runTest("total desta medição vem de review.totalValueDecimal (backend) -- nenhuma soma feita no cliente", () => {
    assertTrue(REVIEW_PAGE_SOURCE.includes("Total desta medição"));
    assertTrue(
      REVIEW_PAGE_SOURCE.includes("formatFormalBulletinTotalBRL(state.review.totalValueDecimal)"),
      "total exibido é o campo já persistido, apenas formatado -- nunca reduce/soma no componente"
    );
    assertTrue(!/\.reduce\(/.test(REVIEW_PAGE_SOURCE), "nenhum .reduce() somando itens no cliente");
    assertTrue(!/Number\(/.test(REVIEW_PAGE_SOURCE), "nenhuma conversão para float na página");
  });

  // 4. Origem de cada item continua acessível -- agora como AÇÃO DISCRETA
  // no rodapé da expansão ("Ver fonte documental"), não mais como um
  // card grande de "Rastreabilidade" (item 10 da especificação de UX).
  await runTest("'Ver análise' existe; a fonte documental virou ação discreta no rodapé (nunca mais um card 'Rastreabilidade'), reaproveitando MeasurementCellReference", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("Ver análise"));
    assertTrue(!/<h4>Rastreabilidade<\/h4>/.test(REVIEW_ITEM_ROW_SOURCE), "Rastreabilidade deixou de ser um card com <h4> próprio");
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("Ver fonte documental"), "ação discreta para revelar a fonte");
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("measurement-review-item__source-footer"), "a fonte fica no rodapé da expansão");
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("MeasurementCellReference"), "mesma infraestrutura de origem, sem criar nova");
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes('variant="full"'), "ao expandir mostra boletim/aba/linha/colunas");
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("item.evidenceReferences"), "origem vem das referências reais do item, nunca inventada");
  });

  await runTest("'Ver análise' tem exatamente três blocos: Econômico, Medição, Planejamento físico-financeiro", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<h4>Econômico</h4>"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<h4>Medição</h4>"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<h4>Planejamento físico-financeiro</h4>"));
    assertTrue(!/<h4>Rastreabilidade<\/h4>/.test(REVIEW_ITEM_ROW_SOURCE), "Rastreabilidade não é mais um quarto bloco");
  });

  // Correção cirúrgica: cabeçalho da tabela usava os <span> soltos
  // direto no <li>, sem o <div class="measurement-review-item__row">
  // que a grade CSS aplica -- por isso os títulos apareciam
  // concatenados, sem grade nem alinhamento com as colunas de dado.
  await runTest("cabeçalho da tabela usa o mesmo wrapper de grade (.measurement-review-item__row) das linhas de dado -- nunca <span> soltos sem grade", () => {
    const headerRowMatch = /measurement-review-item--head[^]*?<\/li>/.exec(REVIEW_PAGE_SOURCE);
    assertTrue(headerRowMatch !== null, "deve existir o <li> de cabeçalho");
    const headerMarkup = headerRowMatch?.[0] ?? "";
    assertTrue(headerMarkup.includes('className="measurement-review-item__row"'), "cabeçalho deve usar o mesmo wrapper de grade que as linhas de dado, não spans soltos");
  });

  // Item 1: VALOR virou VALOR MEDIDO; PREÇO UNITÁRIO virou PREÇO
  // UNITÁRIO CONTRATADO -- distinção inequívoca entre as duas colunas.
  await runTest("cabeçalho da tabela usa 'Valor medido' e 'Preço unitário contratado' -- nunca 'Valor'/'Preço unitário' isolados", () => {
    assertTrue(REVIEW_PAGE_SOURCE.includes("Valor medido"), "coluna de valor deve dizer explicitamente 'Valor medido'");
    assertTrue(REVIEW_PAGE_SOURCE.includes("Preço unitário contratado"), "coluna de preço deve dizer explicitamente 'Preço unitário contratado'");
    assertTrue(!/>Valor<\/span>/.test(REVIEW_PAGE_SOURCE), "cabeçalho não deve mais dizer só 'Valor'");
    assertTrue(!/>Preço unitário<\/span>/.test(REVIEW_PAGE_SOURCE), "cabeçalho não deve mais dizer só 'Preço unitário' sem qualificar");
  });

  // Itens 2/3 (evolução) + correção semântica: referência econômica
  // (Orçamento Oficial × Proposta Vencedora) -- as duas referências
  // nunca são confundidas, e a variação é sempre a diferença real já
  // calculada pelo servidor.
  await runTest("bloco Contratação distingue Orçamento Oficial e Proposta Vencedora -- nunca o mesmo campo para os dois", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("economic.officialUnitPriceDecimal"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("economic.contractedUnitPriceDecimal"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<dt>Orçamento Oficial</dt>"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<dt>Proposta Vencedora</dt>"));
    assertTrue(
      REVIEW_ITEM_ROW_SOURCE.indexOf("economic.officialUnitPriceDecimal") !== REVIEW_ITEM_ROW_SOURCE.indexOf("economic.contractedUnitPriceDecimal"),
      "os dois preços devem vir de campos distintos, nunca o mesmo valor duplicado"
    );
  });

  // Item 2 da correção cirúrgica: rótulos passaram para
  // deságio/redução contratual -- nunca "diferença"/"variação"
  // genéricos sem nomear o conceito.
  await runTest("bloco Contratação usa os rótulos 'Redução unitária na contratação' e 'Deságio' -- correção do item 2", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<dt>Redução unitária na contratação</dt>"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<dt>Deságio</dt>"));
  });

  await runTest("a diferença monetária/percentual exibida vem pronta do servidor (economic.*Decimal) -- a UI nunca subtrai ou divide dinheiro", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("economic.unitPriceDifferenceDecimal"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("economic.unitPriceDifferencePercentage"));
    assertTrue(!/economic\.\w+Decimal\s*[-/*]/.test(REVIEW_ITEM_ROW_SOURCE), "nenhuma operação aritmética aplicada a um campo econômico no componente");
  });

  // Item 1 da correção cirúrgica: Orçamento Oficial × Proposta
  // Vencedora é DESÁGIO/REDUÇÃO NA CONTRATAÇÃO -- nunca
  // economia/ganho/margem/lucro (esses termos só cabem em "Resultado
  // da execução", contra custo real -- ver teste específico abaixo).
  await runTest("interpretação da comparação Oficial×Proposta usa 'X% abaixo/acima do orçamento oficial' / 'sem variação' -- nunca economia/ganho/margem/lucro", () => {
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes("abaixo do orçamento oficial"));
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes("acima do orçamento oficial"));
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes("Preço contratado sem variação frente ao orçamento oficial."));
    assertTrue(
      !/\beconomia\b|\bganho\b|\bmargem\b|\blucro\b/i.test(REVIEW_VIEW_MODEL_SOURCE),
      "vocabulário proibido pela especificação para a comparação Oficial×Proposta"
    );
  });

  await runTest("interpretação econômica ('contract_discount'/'contract_premium'/'no_variation') é determinística a partir do sinal real da diferença -- não há limiar percentual hardcoded, e o tipo não usa mais 'economy'/'above_official'", () => {
    assertTrue(ECONOMIC_COMPARISON_SERVICE_SOURCE.includes('differenceCents === 0 ? "no_variation"'));
    assertTrue(ECONOMIC_COMPARISON_SERVICE_SOURCE.includes('differenceCents > 0 ? "contract_discount" : "contract_premium"'));
    assertTrue(!/["']economy["']|["']above_official["']|["']no_relevant_variation["']/.test(ECONOMIC_COMPARISON_SERVICE_SOURCE), "o tipo antigo (economy/above_official) não deve mais existir no código");
    assertTrue(!/0\.0[1-9]|[1-9]\d*\s*%/.test(ECONOMIC_COMPARISON_SERVICE_SOURCE), "nenhum percentual/limiar numérico hardcoded para decidir a interpretação");
  });

  // Item 6 da correção cirúrgica: "Contratação" × "Resultado da
  // execução" nunca se misturam visualmente, e o valor medido nunca é
  // tratado como custo real (que o BDOS não integra hoje).
  await runTest("'Resultado da execução' é um subbloco visualmente separado de 'Contratação', mostra a mensagem de indisponibilidade e nunca usa item.valueDecimal como custo", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<h5>Contratação</h5>"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<h5>Resultado da execução</h5>"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("Resultado econômico da execução ainda não disponível."));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("A apuração de ganho ou perda depende da integração dos custos reais da execução."));
    const executionBlockMatch = /Resultado da execução<\/h5>[^]*?<\/div>/.exec(REVIEW_ITEM_ROW_SOURCE);
    assertTrue(executionBlockMatch !== null, "deve existir o bloco de Resultado da execução");
    assertTrue(!(executionBlockMatch?.[0] ?? "").includes("item.valueDecimal"), "valor medido nunca deve ser usado como custo real dentro do bloco de resultado da execução");
  });

  // Item 12: nenhum cálculo financeiro decisório no frontend.
  await runTest("nenhum cálculo financeiro decisório no frontend -- nenhuma multiplicação/divisão de dinheiro nos componentes React de Revisar medição", () => {
    assertTrue(!/\*\s*item\.|item\.\w+Decimal\s*\*/.test(REVIEW_PAGE_SOURCE), "página nunca multiplica quantidade por preço");
    assertTrue(!/\*\s*item\.|item\.\w+Decimal\s*\*/.test(REVIEW_ITEM_ROW_SOURCE), "linha do item nunca multiplica quantidade por preço");
    assertTrue(!/Number\(/.test(REVIEW_ITEM_ROW_SOURCE), "nenhuma conversão para float na linha do item");
  });

  // Itens 6/7/8 (rodada físico-financeiro por grupo): a situação
  // AGORA é derivada do Cronograma Físico-Financeiro DNOCS já
  // persistido -- Obra (série agregada) e Grupo (séries mensais). O
  // vocabulário é FIXO: "Acima do previsto" / "No previsto" / "Abaixo
  // do previsto". "Atraso"/"atrasado" continua PROIBIDO (a fonte não
  // caracteriza atraso temporal), e nenhum estado inventado
  // (Em execução/Concluído/Adiantado/No ritmo previsto/WIP) aparece.
  await runTest("vocabulário da situação físico-financeira é fixo (Acima/No/Abaixo do previsto + Sem programação até o período) e nunca usa 'atraso'/'atrasado' nem estados inventados", () => {
    const forbidden = /Em execução|Concluíd[ao]|Ainda não iniciad[ao]|Adiantad[ao]|No ritmo previsto|\bEm atraso\b|atrasad[ao]|Work in Progress|\bWIP\b/i;
    for (const [label, source] of [
      ["página", REVIEW_PAGE_SOURCE],
      ["linha do item", REVIEW_ITEM_ROW_SOURCE],
      ["card da obra", OBRA_CARD_SOURCE],
      ["view-model", REVIEW_VIEW_MODEL_SOURCE],
      ["serviço físico-financeiro", PHYSICAL_FINANCIAL_SERVICE_SOURCE]
    ] as const) {
      assertTrue(!forbidden.test(source), `${label} não deve usar 'atraso' nem inventar estado de cronograma`);
    }
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"Acima do previsto"'), "vocabulário fixo declarado no view-model");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"No previsto"'), "vocabulário fixo declarado no view-model");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"Abaixo do previsto"'), "vocabulário fixo declarado no view-model");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"Sem programação até o período"'), "0 planejado + 0 realizado -> 'Sem programação até o período'");
  });

  // Item 1 da especificação de UX: narrativa contratação -> desempenho
  // da obra -> grupos -> itens -> decisão. O card "Redução da proposta
  // frente ao orçamento oficial" vem ANTES do físico-financeiro.
  await runTest("ordem das seções: 'Redução da proposta frente ao orçamento oficial' renderiza ANTES de 'Situação físico-financeira da obra'", () => {
    const discountAt = REVIEW_PAGE_SOURCE.indexOf("<MeasurementContractDiscountCard ");
    const obraCardAt = REVIEW_PAGE_SOURCE.indexOf("<MeasurementPhysicalFinancialObraCard");
    assertTrue(discountAt >= 0 && obraCardAt >= 0, "ambos os cards devem existir na página");
    assertTrue(discountAt < obraCardAt, "o card econômico vem antes do card físico-financeiro");
  });

  // Itens 2-5: o card físico-financeiro virou card de DECISÃO -- leitura
  // gerencial DINÂMICA (headline, principal impacto, concentração,
  // contraponto positivo), tudo derivado no servidor.
  await runTest("card físico-financeiro traz leitura gerencial dinâmica: headline + principal impacto + concentração + contraponto positivo, sempre vindos do servidor", () => {
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes("buildManagementSummary"), "a leitura gerencial é montada no serviço, não na UI");
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes("principalNegativeImpact"), "identifica o maior desvio negativo");
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes("concentration"), "top 3 negativos + participação combinada");
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes("positiveCounterpoint"), "maior desvio positivo");
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes(".slice(0, 3)"), "concentração é o top 3, calculado, nunca fixo");
    assertTrue(OBRA_CARD_SOURCE.includes("management.principalNegativeImpact") || OBRA_CARD_SOURCE.includes("management?.principalNegativeImpact"), "o card lê o principal impacto do payload");
    assertTrue(OBRA_CARD_SOURCE.includes("formatManagementConcentration"), "a frase de concentração vem do view-model");
    assertTrue(OBRA_CARD_SOURCE.includes("Principal impacto no desvio"), "rótulo do bloco de principal impacto");
    assertTrue(!/Number\(/.test(OBRA_CARD_SOURCE), "card da obra nunca converte para float");
    assertTrue(!/\.\w+Decimal\s*[-+*/]\s*\w/.test(OBRA_CARD_SOURCE), "card da obra nunca faz aritmética sobre campos decimais");
  });

  // Item 3: a headline descreve DESVIO, nunca causa/responsabilidade.
  await runTest("nenhum texto trata o desvio como 'causa do atraso' / 'responsável pelo atraso' / 'problema causado por'", () => {
    const causal = /causa do atraso|respons[áa]vel pelo atraso|problema causado por/i;
    for (const [label, source] of [
      ["card da obra", OBRA_CARD_SOURCE],
      ["view-model", REVIEW_VIEW_MODEL_SOURCE],
      ["serviço físico-financeiro", PHYSICAL_FINANCIAL_SERVICE_SOURCE],
      ["página", REVIEW_PAGE_SOURCE]
    ] as const) {
      assertTrue(!causal.test(source), `${label} descreve desvio, nunca causalidade operacional`);
    }
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes("formatManagementHeadline"), "headline executiva existe");
    assertTrue(/abaixo do previsto|acima do previsto/.test(REVIEW_VIEW_MODEL_SOURCE), "headline fala em desvio frente ao previsto");
  });

  // Item 6: contraponto positivo -- execução acima do previsto NÃO é
  // ganho/economia/lucro/margem; o texto nega isso explicitamente.
  await runTest("contraponto positivo: 'Acima do previsto' + maior desvio positivo, negando explicitamente linguagem econômica", () => {
    assertTrue(OBRA_CARD_SOURCE.includes("positiveCounterpoint"), "o card mostra o maior desvio positivo quando existe");
    assertTrue(/não representa ganho, economia ou margem/i.test(OBRA_CARD_SOURCE), "nega explicitamente ganho/economia/margem");
  });

  await runTest("bloco 'Planejamento físico-financeiro' (Ver análise) mostra a SITUAÇÃO DO GRUPO com a ressalva de que não é status do item, e degrada para motivo textual quando não há grupo/cronograma", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("item.physicalFinancialGroup"), "bloco usa o grupo correlacionado vindo do servidor");
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("<dt>Situação do grupo</dt>"), "o rótulo é explicitamente 'Situação do grupo'");
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("GROUP_SITUATION_ITEM_NOTE"), "a ressalva fixa deve acompanhar o bloco por item");
    assertTrue(
      REVIEW_VIEW_MODEL_SOURCE.includes("não ao item individual"),
      "a ressalva deve dizer literalmente que a situação é do grupo, não do item individual"
    );
    assertTrue(
      REVIEW_ITEM_ROW_SOURCE.includes("PLANNING_COMPARISON_UNAVAILABLE_MESSAGE") || REVIEW_ITEM_ROW_SOURCE.includes("groupsUnavailableReason"),
      "sem grupo/cronograma, o bloco cai para um motivo textual, nunca para um status inventado"
    );
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"Comparação com o planejamento ainda não disponível"'), "a mensagem de fallback exata continua existindo, uma única fonte");
  });

  await runTest("topo da tela usa o card dedicado da obra (MeasurementPhysicalFinancialObraCard), alimentado por state.review.physicalFinancial", () => {
    assertTrue(REVIEW_PAGE_SOURCE.includes("MeasurementPhysicalFinancialObraCard"), "topo da tela renderiza o card dedicado da situação da obra");
    assertTrue(REVIEW_PAGE_SOURCE.includes("physicalFinancial={state.review.physicalFinancial}"), "card é alimentado pelo payload do servidor, nunca por cálculo do cliente");
    assertTrue(OBRA_CARD_SOURCE.includes("Situação físico-financeira da obra"), "título humano, responde em segundos");
  });

  // Tabela principal: quando há grupo correlacionado, a coluna
  // Situação passa a mostrar um badge compacto do GRUPO
  // ("Grupo abaixo do previsto"); sem correlação, mantém "Planejamento
  // indisponível". A frase longa continua só em title=.
  await runTest("coluna Situação da tabela mostra badge compacto do grupo quando correlacionado, e 'Planejamento indisponível' caso contrário", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("formatGroupSituationBadge"), "badge compacto do grupo vem do view-model");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"Grupo abaixo do previsto"'), "o badge é 'Grupo <situação>' -- item 9");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"Grupo sem programação"'), "badge compacto também cobre 'sem programação'");
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("PLANNING_UNAVAILABLE_COMPACT_LABEL"), "sem grupo, mantém o rótulo compacto compartilhado");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"Planejamento indisponível"'), "o rótulo compacto continua existindo, uma única fonte");
    assertTrue(
      /title=\{PLANNING_COMPARISON_UNAVAILABLE_MESSAGE\}>\s*\{PLANNING_UNAVAILABLE_COMPACT_LABEL\}/.test(REVIEW_ITEM_ROW_SOURCE),
      "a frase longa continua acessível como title= no caso sem correlação"
    );
  });

  // Item 8 da especificação de UX: abaixo do previsto → amber; acima do
  // previsto → azul/informativo, NUNCA verde (verde = ganho econômico
  // real e comprovado); no previsto / sem programação → neutro; vermelho
  // fora.
  await runTest("tom visual da situação: abaixo -> atenção (amber); acima -> azul/informativo (NUNCA verde); no previsto / sem programação -> neutro; sem vermelho", () => {
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('if (situation === "above_planned") return "info";'), "acima do previsto -> info (azul), nunca 'positive'/verde");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('if (situation === "below_planned") return "caution";'), "abaixo do previsto -> atenção (amber)");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('return "neutral";'), "no previsto / sem programação -> neutro");
    assertTrue(!/return "positive"/.test(REVIEW_VIEW_MODEL_SOURCE), "'positive' (verde) não é mais usado no físico-financeiro");

    const situationCssStart = GLOBALS_CSS_SOURCE.indexOf("Situação físico-financeira da obra (Cronograma DNOCS)");
    assertTrue(situationCssStart >= 0, "bloco CSS da situação físico-financeira deve existir");
    const situationCssEnd = GLOBALS_CSS_SOURCE.indexOf("measurement-review-item__source-detail", situationCssStart);
    const situationCss = GLOBALS_CSS_SOURCE.slice(situationCssStart, situationCssEnd >= 0 ? situationCssEnd : situationCssStart + 6000);
    assertTrue(!/--status-red|rgba\(239, 68, 68/.test(situationCss), "nenhum vermelho aplicado à situação físico-financeira");
    assertTrue(!/--status-green|rgba\(34, 197, 94/.test(situationCss), "nenhum VERDE aplicado à situação físico-financeira (item 8)");
    assertTrue(/--status-blue|--status-amber/.test(situationCss), "usa azul (acima) e amber (abaixo)");
  });

  // Item 4/16: correlação item -> grupo é determinística por prefixo,
  // sem fuzzy, e os ajustes (ARREDONDAMENTO / MANUTENÇÃO DO DESCONTO)
  // nunca viram grupos.
  await runTest("correlação item -> grupo é determinística por prefixo de código no serviço -- sem fuzzy, sem casar por descrição", () => {
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes("resolveGroupCode"), "existe uma função explícita de resolução por código");
    assertTrue(/\/\^\\d\+\\\.0\$\//.test(PHYSICAL_FINANCIAL_SERVICE_SOURCE), "grupo é reconhecido pelo padrão de código N.0");
    assertTrue(!/from ["'](fuse\.js|leven|string-similarity|fastest-levenshtein)["']/i.test(PHYSICAL_FINANCIAL_SERVICE_SOURCE), "nenhuma biblioteca de fuzzy matching");
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes("adjustments"), "linhas de ajuste ficam listadas à parte, nunca como grupo");
  });

  // Item 2/15: toda moeda canonicalizada em centavos; nada de float
  // como fonte de decisão; o cálculo vive no Application Service, não
  // no componente.
  await runTest("análise físico-financeira usa aritmética decimal canônica (measurement-certification) e nunca float como fonte de decisão", () => {
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes('from "@bba/bdos-core/domain/measurement-certification"'), "reaproveita a camada decimal canônica já existente");
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes("canonicalizeMeasurementDecimal"));
    assertTrue(PHYSICAL_FINANCIAL_SERVICE_SOURCE.includes("addMeasurementDecimals"));
    assertTrue(!/parseFloat\(|Number\.parseFloat\(/.test(PHYSICAL_FINANCIAL_SERVICE_SOURCE), "nenhum parseFloat -- float nunca é fonte de decisão monetária");
  });

  await runTest("route-handler compõe a análise físico-financeira no servidor e nunca escreve -- só lê planning_datasets", () => {
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("buildMeasurementPhysicalFinancialAnalysis"), "a análise é montada no servidor");
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("selectConsolidatedPhysicalFinancialDataset"), "a seleção entre importações concorrentes é determinística");
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("listPlanningDatasetsByType"), "leitura da Camada 2 por tipo, somente leitura");
    assertTrue(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(REVIEW_ROUTE_HANDLER_SOURCE), "o route-handler de revisão nunca escreve");
  });

  await runTest("evidenceReferences do item é validado estruturalmente no client fetch (sourceType/locator), nunca aceito sem checagem", () => {
    assertTrue(REVIEW_CLIENT_SOURCE.includes('candidate.sourceType !== "spreadsheet_cell"'));
    assertTrue(REVIEW_CLIENT_SOURCE.includes("locatorCandidate.sheetName"));
    assertTrue(REVIEW_CLIENT_SOURCE.includes("locatorCandidate.row"));
  });

  // 5. Observações técnicas continuam não materiais.
  await runTest("observações técnicas usam item.materiality herdado do DecisionBrief -- nunca reclassificadas nesta tela", () => {
    assertTrue(REVIEW_PAGE_SOURCE.includes("state.review.technicalObservations.map"));
    assertTrue(REVIEW_PAGE_SOURCE.includes("MeasurementCriticalItem"), "reaproveita o mesmo item visual do Relatório Executivo, não um novo componente");
    assertTrue(!/materiality\s*[:=]\s*["']material["']/.test(REVIEW_PAGE_SOURCE), "página nunca atribui materiality -- só lê o que já veio do backend");
  });

  await runTest("resumo de observações técnicas usa contagem, não a lista de itens críticos materiais, para o texto de destaque", () => {
    assertTrue(REVIEW_PAGE_SOURCE.includes("state.review.technicalObservationCount"), "resumo deve usar a contagem real de observações técnicas");
    assertTrue(/sem impacto no valor ou na\s+rastreabilidade/.test(REVIEW_PAGE_SOURCE), "texto de destaque deve afirmar ausência de impacto no valor/rastreabilidade");
  });

  // Correção cirúrgica: a comparação econômica usa PRIMARIAMENTE a
  // identidade persistida (contract_execution_item_links), nunca
  // exclusivamente o código de texto -- causa raiz real, confirmada
  // contra o BM_08 (managed_service_items.code é um espaço de código
  // diferente de budget_lines.external_code).
  await runTest("route-handler resolve a comparação econômica via contract_execution_item_links (managed_service_item_id -> proposal_budget_line_id) -- identidade persistida, não texto", () => {
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("createContractExecutionItemTraceabilityRepository"), "deve reaproveitar o repositório já existente de vínculos, não inventar uma segunda leitura");
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("findExecutionItemLinks"));
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("listByContractBaseline"), "deve reaproveitar a função de leitura já existente, não uma nova query");
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("managed_service_item_id") && REVIEW_ROUTE_HANDLER_SOURCE.includes("proposal_budget_line_id"));
  });

  await runTest("junção item medido -> item comparado prefere a identidade persistida (managedServiceItemId) e só cai para código quando não há vínculo", () => {
    assertTrue(ECONOMIC_COMPARISON_SERVICE_SOURCE.includes("executionItemLinks.get(item.managedServiceItemId)"), "deve consultar o vínculo persistido primeiro");
    assertTrue(
      ECONOMIC_COMPARISON_SERVICE_SOURCE.includes("Reserva: só quando o item não tem vínculo persistido"),
      "o casamento por código deve ser explicitamente uma reserva, não o caminho principal"
    );
    assertTrue(!/from ["'](fuse\.js|leven|string-similarity|fastest-levenshtein)["']/i.test(ECONOMIC_COMPARISON_SERVICE_SOURCE), "nenhuma biblioteca de fuzzy matching importada");
  });

  await runTest("route-handler repassa managedServiceItemId (identidade real do item, vinda do boletim) ao serviço econômico -- nunca omitido", () => {
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("item.managedServiceItemId"), "route-handler deve repassar a identidade real do item ao serviço econômico");
  });

  // Item 3 da correção cirúrgica: o antigo rótulo "Economia frente ao
  // Orçamento Oficial" saiu do cabeçalho -- o conceito agora vive só
  // no card dedicado (MeasurementContractDiscountCard).
  await runTest("cabeçalho da tela não mostra mais 'Economia frente ao Orçamento Oficial' -- o card dedicado assume o conceito corrigido", () => {
    assertTrue(!REVIEW_PAGE_SOURCE.includes("Economia frente ao Orçamento Oficial"), "rótulo antigo removido do cabeçalho");
    assertTrue(REVIEW_PAGE_SOURCE.includes("MeasurementContractDiscountCard"), "página deve renderizar o card dedicado quando economicSummary existir");
    assertTrue(REVIEW_PAGE_SOURCE.includes("state.review.economicSummary ? <MeasurementContractDiscountCard"), "card só aparece quando há comparação econômica disponível");
  });

  // Ajuste cirúrgico (semântica visual): título/subtítulo do card
  // agregado revisados novamente -- "Redução da proposta frente ao
  // orçamento oficial" / "Impacto nas quantidades medidas neste
  // período". Nunca "Impacto do deságio contratual" (título anterior)
  // nem "Economia frente ao orçamento oficial" (título original).
  await runTest("card agregado usa o título 'Redução da proposta frente ao orçamento oficial' e o subtítulo 'Impacto nas quantidades medidas neste período'", () => {
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes('title="Redução da proposta frente ao orçamento oficial"'));
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes("Impacto nas quantidades medidas neste período"));
    assertTrue(!/Economia frente ao [Oo]rçamento [Oo]ficial/.test(CONTRACT_DISCOUNT_CARD_SOURCE), "rótulo original não deve mais aparecer, nem como título nem como texto");
    assertTrue(!CONTRACT_DISCOUNT_CARD_SOURCE.includes('title="Impacto do deságio contratual nesta medição"'), "título anterior (rodada passada) também não deve mais aparecer como title=");
    // A explicação pode (e deve) citar esses termos só para negá-los
    // explicitamente ("não representa economia...") -- nunca como um
    // rótulo/título positivo.
    assertTrue(/não representa economia operacional/i.test(CONTRACT_DISCOUNT_CARD_SOURCE), "a explicação deve negar explicitamente a leitura de economia operacional, per a especificação");
  });

  // Item 1 do ajuste cirúrgico: regra de cores econômicas -- verde só
  // para ganho real e comprovado da execução (que o BDOS não apura
  // hoje); vermelho só para perda real comprovada; a comparação
  // Oficial×Proposta é sempre neutra, documental, independente do
  // sinal da variação.
  await runTest("deságio (contract_discount/contract_premium/no_variation) nunca usa verde/vermelho -- os três estados usam exatamente o mesmo tratamento visual neutro", () => {
    assertTrue(
      /economic-interpretation--contract_discount,\s*\.measurement-review-item__economic-interpretation--contract_premium,\s*\.measurement-review-item__economic-interpretation--no_variation\s*\{/.test(
        GLOBALS_CSS_SOURCE
      ),
      "os três estados devem compartilhar exatamente a mesma regra CSS -- nenhum tratamento diferenciado por sinal"
    );
    const colorBlockMatch = /economic-interpretation--contract_discount[^]*?\n\}/.exec(GLOBALS_CSS_SOURCE);
    assertTrue(colorBlockMatch !== null);
    const block = colorBlockMatch?.[0] ?? "";
    assertTrue(!/--status-green|--status-red|rgba\(34, 197, 94|rgba\(239, 68, 68/.test(block), "nenhuma cor de sucesso/alerta aplicada à comparação documental Oficial×Proposta");
  });

  await runTest("'X% abaixo/acima do orçamento oficial' permanece com o mesmo texto, só o tratamento visual mudou para neutro", () => {
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes("abaixo do orçamento oficial"), "texto do deságio deve continuar existindo, só sem destaque verde");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes("acima do orçamento oficial"));
  });

  await runTest("card agregado mostra contractDiscountImpactDecimal (já pronto do servidor) -- nunca soma/subtrai valores no componente", () => {
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes("summary.contractDiscountImpactDecimal"));
    assertTrue(!/summary\.\w+Decimal\s*[-+*/]/.test(CONTRACT_DISCOUNT_CARD_SOURCE), "nenhuma aritmética sobre campos do resumo no componente");
  });

  // Item 4 da correção cirúrgica: total agregado usa a mesma
  // aritmética decimal exata das linhas (soma dos impactos canônicos
  // por linha), nunca a diferença entre dois totais arredondados
  // separadamente -- ver teste numérico da divergência de centavos no
  // arquivo de teste do serviço.
  await runTest("card agregado (contractDiscountImpactDecimal) usa a mesma política monetária das linhas -- soma de lineImpactDecimal, nunca diferença de dois totais", () => {
    assertTrue(
      ECONOMIC_COMPARISON_SERVICE_SOURCE.includes("addMeasurementDecimals(") &&
        ECONOMIC_COMPARISON_SERVICE_SOURCE.includes("rawMatches.map((match) => match.lineImpactDecimal)"),
      "contractDiscountImpactDecimal deve ser a soma dos lineImpactDecimal já calculados por linha"
    );
    assertTrue(
      ECONOMIC_COMPARISON_SERVICE_SOURCE.includes("policy: MONEY_POLICY") && (ECONOMIC_COMPARISON_SERVICE_SOURCE.match(/MONEY_POLICY/g) ?? []).length >= 2,
      "a mesma política monetária (MONEY_POLICY) deve ser reaproveitada em mais de um cálculo -- linha e agregado nunca usam políticas diferentes"
    );
  });

  // Item 5 da correção cirúrgica: "Ver composição", itens ordenados
  // por contribuição, principal item identificado deterministicamente.
  await runTest("'Ver composição' existe, mostra código/serviço/quantidade/preço oficial/preço contratado/redução/participação, e nunca reordena no cliente", () => {
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes("Ver composição"));
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes("summary.composition.map"));
    for (const field of ["entry.code", "entry.description", "entry.quantityDecimal", "entry.officialUnitPriceDecimal", "entry.contractedUnitPriceDecimal", "entry.lineImpactDecimal", "entry.participationPercentage"]) {
      assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes(field), `composição deve exibir ${field}`);
    }
    assertTrue(!/composition\s*(\]?)\s*\.sort\(/.test(CONTRACT_DISCOUNT_CARD_SOURCE), "o card nunca reordena a composição -- a ordem já vem decidida pelo servidor");
  });

  // Item 4 do ajuste cirúrgico: linguagem da composição revisada --
  // "Impacto do deságio" / "Participação no impacto total", nunca
  // "economia"/"ganho"/"margem"/"lucro" como descrição da comparação.
  await runTest("cabeçalho da tabela de composição usa 'Impacto do deságio' e 'Participação no impacto total' -- vocabulário do ajuste cirúrgico", () => {
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes("<span>Impacto do deságio</span>"));
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes("<span>Participação no impacto total</span>"));
    assertTrue(!/\beconomia\b|\bganho\b|\bmargem\b|\blucro\b/i.test(CONTRACT_DISCOUNT_CARD_SOURCE) || /não representa economia operacional/i.test(CONTRACT_DISCOUNT_CARD_SOURCE), "termos proibidos só podem aparecer dentro da negação explícita já validada acima");
  });

  await runTest("route-handler ordena a composição por maior contribuição (compareMoneyDecimalsDescending) -- decisão do servidor, nunca da UI", () => {
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("compareMoneyDecimalsDescending"));
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes(".sort((a, b) => compareMoneyDecimalsDescending(a.lineImpactDecimal, b.lineImpactDecimal))"));
  });

  await runTest("principal item é identificado deterministicamente (composition[0], já ordenado pelo servidor) -- nunca uma escolha arbitrária no cliente", () => {
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes("summary.composition[0]"));
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes("topContributor.participationPercentage"));
  });

  // 6. Certificação abre confirmação, não executa imediatamente.
  await runTest("clicar em 'Certificar medição' abre o diálogo de confirmação -- não chama a rota de certificar direto no clique", () => {
    assertTrue(REVIEW_PAGE_SOURCE.includes('setDialog({ kind: "certify" })'), "clique só abre o diálogo");
    const certifyButtonMatch = /onClick=\{\(\) => setDialog\(\{ kind: "certify" \}\)\}/.test(REVIEW_PAGE_SOURCE);
    assertTrue(certifyButtonMatch, "botão 'Certificar medição' só abre o diálogo, nunca dispara fetch diretamente");
  });

  await runTest("a chamada real a /certify só acontece dentro de handleConfirmCertification, disparada pelo onConfirm do diálogo -- nunca fora dele", () => {
    assertTrue(REVIEW_PAGE_SOURCE.includes("/certify"), "rota de certificação deve existir");
    const certifyFetchCount = (REVIEW_PAGE_SOURCE.match(/\/certify`/g) ?? []).length;
    assertEqual(certifyFetchCount, 1, "só uma chamada à rota de certificar em toda a página, dentro do handler de confirmação");
    assertTrue(REVIEW_PAGE_SOURCE.includes("onConfirm={() => void handleConfirmCertification()}"), "diálogo é quem decide disparar a certificação, via onConfirm explícito");
  });

  await runTest("diálogo de certificação busca a prévia (antes/desta medição/depois/saldo) antes de qualquer confirmação", () => {
    assertTrue(CERTIFICATION_DIALOG_SOURCE.includes("fetchMeasurementCertificationPreview"));
    assertTrue(CERTIFICATION_DIALOG_SOURCE.includes("Acumulado certificado antes"));
    assertTrue(CERTIFICATION_DIALOG_SOURCE.includes("Valor desta medição"));
    assertTrue(CERTIFICATION_DIALOG_SOURCE.includes("Acumulado certificado depois"));
    assertTrue(CERTIFICATION_DIALOG_SOURCE.includes("Saldo contratual depois"));
    assertTrue(CERTIFICATION_DIALOG_SOURCE.includes("Voltar à revisão"));
    assertTrue(CERTIFICATION_DIALOG_SOURCE.includes("Confirmar certificação"));
    assertTrue(!/window\.confirm/.test(CERTIFICATION_DIALOG_SOURCE), "nunca a confirmação genérica do navegador");
  });

  await runTest("prévia de certificação (client) valida estruturalmente os quatro campos decimais antes de aceitar a resposta", () => {
    assertTrue(CERTIFICATION_PREVIEW_CLIENT_SOURCE.includes("measurementValueDecimal"));
    assertTrue(CERTIFICATION_PREVIEW_CLIENT_SOURCE.includes("accumulatedBeforeDecimal"));
    assertTrue(CERTIFICATION_PREVIEW_CLIENT_SOURCE.includes("accumulatedAfterDecimal"));
    assertTrue(CERTIFICATION_PREVIEW_CLIENT_SOURCE.includes("contractBalanceAfterDecimal"));
  });

  // 7 já coberto (prévia mostra antes/medição/depois/saldo) pelos dois testes acima.

  // 8. Recusa exige justificativa.
  await runTest("diálogo de recusa exige motivo (mínimo de caracteres) antes de aceitar -- nunca confirma vazio/silencioso", () => {
    assertTrue(REFUSAL_DIALOG_SOURCE.includes("MINIMUM_REASON_LENGTH"));
    assertTrue(REFUSAL_DIALOG_SOURCE.includes("reason.trim().length < MINIMUM_REASON_LENGTH"));
    assertTrue(REFUSAL_DIALOG_SOURCE.includes('setValidationError("O motivo da devolução é obrigatório.")'));
    assertTrue(REFUSAL_DIALOG_SOURCE.includes("Cancelar"));
    assertTrue(REFUSAL_DIALOG_SOURCE.includes("Confirmar devolução"));
  });

  await runTest("recusa nunca persiste -- nenhuma chamada fetch/API no diálogo de devolução, e informa objetivamente a lacuna de domínio", () => {
    assertTrue(!/fetch\(/.test(REFUSAL_DIALOG_SOURCE), "não deve existir nenhuma chamada de rede -- não existe transição segura de devolução no domínio hoje");
    assertTrue(/não existe.*transição segura/i.test(REFUSAL_DIALOG_SOURCE), "deve informar objetivamente a lacuna de domínio, nunca fingir sucesso");
  });

  // 9. Usuário normal restrito à própria empresa / admin mantém acesso autorizado cross-company.
  await runTest("rotas de revisão/certificação usam requireAuthenticatedActor (mesmo padrão admin-aware das demais rotas de measurement/imports)", () => {
    assertTrue(REVIEW_ROUTE_SOURCE.includes("requireAuthenticatedActor"));
    assertTrue(CERTIFICATION_PREVIEW_ROUTE_SOURCE.includes("requireAuthenticatedActor"));
    assertTrue(CERTIFY_ROUTE_SOURCE.includes("requireAuthenticatedActor"));
  });

  await runTest("leitura (review) repassa companyId (null para admin) verbatim ao reader -- nunca substitui por um valor sintético", () => {
    assertTrue(REVIEW_ROUTE_HANDLER_SOURCE.includes("companyId: auth.companyId"));
    assertTrue(!/companyId:\s*auth\.companyId\s*\?\?/.test(REVIEW_ROUTE_HANDLER_SOURCE), "leitura não deve forçar um companyId quando é null (admin)");
  });

  await runTest("certificar (escrita) exige companyId real -- admin sem empresa própria é bloqueado explicitamente, nunca escreve em nome de 'nenhuma empresa'", () => {
    assertTrue(CERTIFY_ROUTE_HANDLER_SOURCE.includes("if (!auth.companyId)"));
    assertTrue(CERTIFY_ROUTE_HANDLER_SOURCE.includes('"admin_company_required"'));
  });

  await runTest("certificar usa o service-role client só para as três chamadas SQL de measurement_cycles -- leitura continua no cliente RLS-bound", () => {
    assertTrue(CERTIFY_ROUTE_SOURCE.includes("getSupabaseServiceRoleClient"));
    assertTrue(CERTIFY_ROUTE_SOURCE.includes("getSupabaseRouteHandlerClient"));
    assertTrue(CERTIFY_ROUTE_SOURCE.includes("buildMeasurementCertifyReader(supabase)"), "leituras usam o cliente RLS-bound, não o service-role");
    assertTrue(CERTIFY_ROUTE_SOURCE.includes("buildMeasurementCertifyWriter(getSupabaseServiceRoleClient())"), "só a escrita usa o service-role client");
  });

  await runTest("nenhuma das novas rotas escreve fora de /certify -- review e certification-preview são GET, somente leitura", () => {
    assertTrue(REVIEW_ROUTE_SOURCE.includes("export async function GET("));
    assertTrue(!/export async function POST/.test(REVIEW_ROUTE_SOURCE));
    assertTrue(CERTIFICATION_PREVIEW_ROUTE_SOURCE.includes("export async function GET("));
    assertTrue(!/export async function POST/.test(CERTIFICATION_PREVIEW_ROUTE_SOURCE));
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message ?? "esperava true, recebeu false");
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
