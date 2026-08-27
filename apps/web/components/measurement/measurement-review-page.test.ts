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

  // 4. Origem de cada item pode ser consultada -- evolução econômica
  // dobrou a origem dentro de "Ver análise" (seção Rastreabilidade),
  // conforme a própria especificação autoriza.
  await runTest("'Ver análise' existe por item e sua seção Rastreabilidade reaproveita MeasurementCellReference (mesmo componente do Relatório Executivo)", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("Ver análise"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("Rastreabilidade"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("MeasurementCellReference"));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes('variant="full"'));
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("item.evidenceReferences"), "origem vem das referências reais do item, nunca inventada");
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

  // Itens 6/7/8: nenhum status físico-financeiro é inventado; a coluna
  // Situação e o bloco Planejamento sempre mostram a mensagem neutra
  // de indisponibilidade nesta rodada -- nenhuma fonte determinística
  // suficiente foi encontrada para calcular Em execução/Concluído/
  // Ainda não iniciado/Adiantado/No ritmo previsto/Abaixo do
  // previsto/Em atraso.
  await runTest("nenhum status físico-financeiro é inventado -- 'Em execução'/'Concluído'/'Adiantado'/'No ritmo previsto'/'Abaixo do previsto'/'Em atraso' não aparecem em nenhum arquivo desta tela", () => {
    const invented = /Em execução|Concluído|Ainda não iniciado|Adiantado|No ritmo previsto|Abaixo do previsto|Em atraso|Work in Progress|\bWIP\b/;
    assertTrue(!invented.test(REVIEW_PAGE_SOURCE), "página não deve inventar nenhum estado de cronograma");
    assertTrue(!invented.test(REVIEW_ITEM_ROW_SOURCE), "linha do item não deve inventar nenhum estado de cronograma");
  });

  await runTest("bloco 'Planejamento físico-financeiro' (Ver análise) e o resumo executivo sempre mostram a mensagem completa de indisponibilidade -- nunca um status calculado sem fonte", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("PLANNING_COMPARISON_UNAVAILABLE_MESSAGE"), "bloco Planejamento (Ver análise) deve usar a mensagem compartilhada, não um texto solto");
    assertTrue(REVIEW_PAGE_SOURCE.includes("PLANNING_COMPARISON_UNAVAILABLE_MESSAGE"), "resumo executivo também deve usar a mesma mensagem compartilhada");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"Comparação com o planejamento ainda não disponível"'), "a mensagem exata deve existir literalmente, uma única fonte");
  });

  // Item 3 da correção cirúrgica: a tabela principal não repete a
  // frase longa em cada linha -- usa um badge compacto; a explicação
  // completa fica só em Ver análise e no title= do badge.
  await runTest("coluna Situação da tabela usa o rótulo compacto 'Planejamento indisponível' -- nunca a frase longa repetida em cada linha", () => {
    assertTrue(REVIEW_ITEM_ROW_SOURCE.includes("PLANNING_UNAVAILABLE_COMPACT_LABEL"), "linha do item deve usar o rótulo compacto compartilhado");
    assertTrue(REVIEW_VIEW_MODEL_SOURCE.includes('"Planejamento indisponível"'), "o rótulo compacto deve existir literalmente, uma única fonte");
    assertTrue(
      /<span className="measurement-review-item__situation" title=\{PLANNING_COMPARISON_UNAVAILABLE_MESSAGE\}>\s*\{PLANNING_UNAVAILABLE_COMPACT_LABEL\}/.test(REVIEW_ITEM_ROW_SOURCE),
      "a frase longa deve estar disponível como title= (acessível sob demanda), nunca como texto visível repetido"
    );
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

  await runTest("card agregado usa o título 'Impacto do deságio contratual nesta medição' -- nunca 'Economia frente ao orçamento oficial' como título/rótulo positivo", () => {
    assertTrue(CONTRACT_DISCOUNT_CARD_SOURCE.includes('title="Impacto do deságio contratual nesta medição"'));
    assertTrue(!/Economia frente ao [Oo]rçamento [Oo]ficial/.test(CONTRACT_DISCOUNT_CARD_SOURCE), "rótulo antigo não deve mais aparecer, nem como título nem como texto");
    // A explicação pode (e deve) citar esses termos só para negá-los
    // explicitamente ("não representa economia...") -- nunca como um
    // rótulo/título positivo.
    assertTrue(/não representa economia operacional/i.test(CONTRACT_DISCOUNT_CARD_SOURCE), "a explicação deve negar explicitamente a leitura de economia operacional, per a especificação");
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
