import {
  BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  BudgetDocumentSignalCatalog,
  BudgetDocumentSignalCatalogIssue,
  BudgetDocumentSignalDefinition,
  BudgetDocumentSignalFamily,
} from "./budget-document-signal-catalog.types";

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
    return Object.freeze(value);
  }
  return value;
}

/**
 * Versioned catalog of documentary signal families relevant to locating
 * budget spreadsheet pages inside a larger PDF. This is not a decision
 * engine: it only names what can be observed and why, on its own, it is
 * never enough. The mechanism that decides candidate pages belongs to a
 * later Sprint (21.4A.2.e) and must consult this catalog, not duplicate it.
 * Frozen at module load so it is immutable at runtime, not only at the
 * type level.
 */
const MUTABLE_BUDGET_DOCUMENT_SIGNAL_CATALOG: BudgetDocumentSignalCatalog = [
  // ---- Referential -------------------------------------------------------
  {
    id: "referential-budget-spreadsheet-mention",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Referential,
    humanName: "Menção a planilha orçamentária",
    description:
      "Ocorrência textual de expressões como \"planilha orçamentária\", \"orçamento\" ou \"quadro orçamentário\" em título, sumário, índice remissivo ou texto corrido.",
    documentaryMeaning:
      "Indica uma remissão documental a uma possível estrutura orçamentária em outro lugar do documento — não indica onde, nem se a estrutura de fato existe naquele local.",
    observableForms: [
      "Título de seção ou de página contendo a expressão",
      "Entrada de sumário ou índice remissivo apontando para outra página",
      "Menção em texto corrido descrevendo o conteúdo de um anexo",
    ],
    limitations: [
      "Não distingue, por si só, entre a página que introduz o anexo e a página que efetivamente contém a estrutura",
      "Pode ocorrer em editais, termos de referência e atas sem qualquer estrutura de linhas de serviço",
    ],
    permittedUses: [
      "Registrar que uma remissão documental existe",
      "Orientar buscas humanas ou futuras por proximidade documental",
    ],
    prohibitedUses: [
      "Concluir presença estrutural de orçamento na própria página",
      "Iniciar um grupo de continuidade estrutural",
      "Contar como evidência de estrutura ao lado de outros sinais referenciais apenas",
    ],
    sufficientAlone: false,
    insufficiencyRationale:
      "Sinal referencial nunca é suficiente para indicar presença estrutural — um índice que menciona \"Planilha Orçamentária\" não é uma planilha orçamentária.",
    relatedSignalIds: ["referential-annex-listing"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "referential-annex-listing",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Referential,
    humanName: "Listagem de anexos com anexo de preços",
    description:
      "Lista de anexos do documento que nomeia um anexo de preços, custos ou orçamento, sem reproduzir seu conteúdo.",
    documentaryMeaning:
      "Registra que o documento declara a existência de um anexo econômico em algum lugar, sem confirmar seu conteúdo ou localização.",
    observableForms: [
      "Tabela ou lista numerada de anexos com uma entrada referente a preços/orçamento",
      "Sumário estrutural do documento com uma seção nomeada como anexo de preços",
    ],
    limitations: [
      "Não indica a extensão do anexo nem sua posição exata",
      "Pode listar um anexo que, na prática, não foi de fato incluído no arquivo",
    ],
    permittedUses: ["Registrar a existência declarada do anexo"],
    prohibitedUses: [
      "Concluir presença estrutural na página da listagem",
      "Assumir que o anexo está imediatamente após a listagem",
    ],
    sufficientAlone: false,
    insufficiencyRationale:
      "É uma declaração de existência, não uma observação de estrutura — a mesma regra de insuficiência dos sinais referenciais se aplica.",
    relatedSignalIds: ["referential-budget-spreadsheet-mention"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },

  // ---- Structural ----------------------------------------------------------
  {
    id: "structural-service-item-identification",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Structural,
    humanName: "Identificação de item ou serviço",
    description:
      "Presença de um identificador de linha (código, numeração sequencial ou rótulo de item) associado a uma descrição de serviço.",
    documentaryMeaning:
      "Compatível com o início de uma linha de orçamento, mas comum também em listas de atividades, riscos ou cronogramas.",
    observableForms: [
      "Código alfanumérico curto no início de uma linha",
      "Numeração sequencial de itens (1, 2, 3, ... ou 1.1, 1.2, ...)",
    ],
    limitations: [
      "Numeração sequencial isolada aparece em quase qualquer lista documental",
      "Não confirma associação com unidade, quantidade ou valor",
    ],
    permittedUses: ["Compor, junto com outros sinais estruturais, uma observação de estrutura tabular"],
    prohibitedUses: ["Decidir presença estrutural isoladamente", "Interpretar o código como identidade econômica"],
    sufficientAlone: false,
    insufficiencyRationale:
      "Precisa coexistir com outros sinais estruturais (unidade, quantidade, valor) na mesma página para sustentar uma observação de estrutura tabular.",
    relatedSignalIds: [
      "structural-unit-quantity-price-block",
      "structural-total-value-column",
      "structural-tabular-row-repetition",
    ],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "structural-unit-quantity-price-block",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Structural,
    humanName: "Bloco de unidade, quantidade e valor unitário",
    description:
      "Coexistência, na mesma linha ou bloco tabular, de uma unidade de medida, uma quantidade e um valor unitário — em qualquer ordem ou rótulo.",
    documentaryMeaning: "Representa uma combinação compatível com uma linha de orçamento de serviços — compatibilidade estrutural, não prova de que a linha seja orçamentária.",
    observableForms: [
      "Três valores lado a lado com rótulos compatíveis com unidade/quantidade/valor",
      "Bloco tabular com colunas correspondentes, independentemente da ordem ou da grafia exata dos rótulos",
    ],
    limitations: [
      "Também ocorre em listas de compras, cronogramas de suprimento e memórias de cálculo não orçamentárias",
      "Não deve ser reconhecida por uma ordem fixa de colunas nem por grafia exclusiva de rótulo",
    ],
    permittedUses: ["Compor observação de estrutura tabular junto com identificação de item"],
    prohibitedUses: ["Interpretar os valores numéricos economicamente", "Exigir uma ordem específica de colunas"],
    sufficientAlone: false,
    insufficiencyRationale:
      "Sozinho, não distingue uma tabela de orçamento de uma tabela de suprimentos ou de uma memória de cálculo qualquer — depende de coexistir com identificação de item e, idealmente, repetição tabular.",
    relatedSignalIds: ["structural-service-item-identification", "structural-tabular-row-repetition"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "structural-total-value-column",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Structural,
    humanName: "Coluna de valor total por linha",
    description: "Presença de um valor que aparenta ser o produto ou resultado de quantidade × valor unitário por linha.",
    documentaryMeaning: "Reforça, junto com outros sinais estruturais, a hipótese de linha de orçamento.",
    observableForms: ["Valor numérico ao final de uma linha tabular, distinto do valor unitário"],
    limitations: ["Também aparece em faturas, notas fiscais e relatórios financeiros não orçamentários"],
    permittedUses: ["Compor observação de estrutura tabular"],
    prohibitedUses: ["Recalcular, validar ou conferir o valor", "Interpretá-lo como total econômico confiável"],
    sufficientAlone: false,
    insufficiencyRationale: "É reforço estrutural, não prova — precisa coexistir com identificação de item e bloco de unidade/quantidade/valor.",
    relatedSignalIds: ["structural-unit-quantity-price-block"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "structural-bdi-documentary-mention",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Structural,
    humanName: "Menção documental a BDI",
    description:
      "Ocorrência textual de \"BDI\", \"bonificação e despesas indiretas\" ou expressão equivalente, como rótulo documental — nunca como valor interpretado.",
    documentaryMeaning: "Reforça a hipótese de formação de preço compatível com orçamento de obra.",
    observableForms: ["Rótulo de coluna ou de bloco contendo a expressão ou sua forma por extenso"],
    limitations: [
      "A ausência do rótulo não descarta a página — nem toda estrutura orçamentária documenta BDI em todas as páginas",
      "Não deve ser lido como percentual ou efeito econômico nesta capacidade",
    ],
    permittedUses: ["Registrar a ocorrência lexical do rótulo"],
    prohibitedUses: ["Interpretar percentual", "Calcular efeito sobre preço", "Exigir presença em toda página estrutural"],
    sufficientAlone: false,
    insufficiencyRationale: "É um reforço lexical opcional — sua ausência não invalida, nem sua presença isolada confirma, estrutura orçamentária.",
    relatedSignalIds: ["structural-unit-quantity-price-block"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "structural-tabular-row-repetition",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Structural,
    humanName: "Repetição de estrutura de linha",
    description: "Repetição do mesmo padrão de campos (identificação, descrição, unidade, quantidade, valor) ao longo de várias linhas na mesma página.",
    documentaryMeaning: "É a assinatura mais forte, dentro desta família, de uma tabela de linhas de serviço — mas ainda não confirma que é orçamentária.",
    observableForms: ["Sequência de blocos semelhantes repetidos verticalmente na página"],
    limitations: ["Cronogramas, listas de risco e memórias de cálculo também repetem estrutura de linha"],
    permittedUses: ["Elevar a confiança documental de que a página é tabular, junto com os demais sinais estruturais"],
    prohibitedUses: ["Contar repetições como pontuação", "Decidir presença estrutural sem os demais sinais desta família"],
    sufficientAlone: false,
    insufficiencyRationale: "Precisa coexistir com identificação de item e bloco de unidade/quantidade/valor para não ser confundida com qualquer outra tabela repetitiva do documento.",
    relatedSignalIds: ["structural-service-item-identification", "structural-unit-quantity-price-block"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },

  // ---- Continuity ------------------------------------------------------
  {
    id: "continuity-repeated-header",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Continuity,
    humanName: "Cabeçalho semanticamente repetido",
    description: "O mesmo conjunto semântico de rótulos de coluna aparece, na mesma posição relativa, em páginas consecutivas.",
    documentaryMeaning: "Sugere que páginas consecutivas pertencem ao mesmo bloco tabular.",
    observableForms: ["Bloco de rótulos de coluna reaparecendo no topo de páginas consecutivas"],
    limitations: ["Cabeçalhos de rodapé/cabeçalho institucional (nome do órgão, título do documento) também se repetem sem relação com orçamento"],
    permittedUses: ["Sustentar a formação de um grupo de continuidade quando combinado com sinais estruturais nas páginas envolvidas"],
    prohibitedUses: ["Formar continuidade isoladamente, sem sinais estruturais nas páginas envolvidas"],
    sufficientAlone: false,
    insufficiencyRationale: "Um cabeçalho institucional genérico também se repete por todo o documento sem indicar bloco orçamentário — precisa coexistir com sinais estruturais.",
    relatedSignalIds: ["continuity-stable-geometry", "continuity-repeated-row-pattern"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "continuity-stable-geometry",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Continuity,
    humanName: "Geometria de página estável",
    description: "Largura, altura e orientação da página permanecem constantes ao longo de um intervalo de páginas consecutivas.",
    documentaryMeaning: "Observação técnica não-lexical: uma mudança sustentada de geometria costuma marcar fronteira de seção; geometria estável costuma marcar continuidade de um mesmo bloco.",
    observableForms: ["Mesma largura/altura/orientação relatada pelo leitor de PDF em páginas consecutivas"],
    limitations: [
      "Desenhos técnicos, mapas, cronogramas e plantas frequentemente usam a mesma orientação paisagem por muitas páginas seguidas, sem relação com orçamento",
      "Geometria idêntica não implica mesmo conteúdo documental",
    ],
    permittedUses: ["Reforçar um grupo de continuidade já sustentado por sinais estruturais e/ou cabeçalho repetido"],
    prohibitedUses: ["Formar ou estender continuidade sozinha", "Ser usada como prova de conteúdo orçamentário"],
    sufficientAlone: false,
    insufficiencyRationale:
      "Geometria é sinal auxiliar, nunca suficiente isoladamente — duas ou mais páginas com a mesma geometria, inclusive em paisagem, podem pertencer a um desenho, mapa ou cronograma, não a uma planilha orçamentária.",
    relatedSignalIds: ["continuity-repeated-header"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "continuity-repeated-row-pattern",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Continuity,
    humanName: "Padrão de linhas repetido entre páginas",
    description: "O mesmo padrão de repetição de linha observado em `structural-tabular-row-repetition` persiste através de páginas consecutivas.",
    documentaryMeaning: "Reforça que um bloco tabular estrutural se estende por mais de uma página.",
    observableForms: ["Sequência de blocos de linha semelhantes continuando através da quebra de página"],
    limitations: ["Não distingue, sozinho, um bloco orçamentário de qualquer outra tabela longa"],
    permittedUses: ["Sustentar grupo de continuidade junto com cabeçalho repetido e/ou geometria estável"],
    prohibitedUses: ["Formar continuidade sem sinais estruturais correspondentes nas páginas envolvidas"],
    sufficientAlone: false,
    insufficiencyRationale: "É a extensão através da quebra de página do sinal estrutural de repetição de linha — herda a mesma insuficiência isolada.",
    relatedSignalIds: ["structural-tabular-row-repetition", "continuity-repeated-header"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },

  // ---- Closure -----------------------------------------------------------
  {
    id: "closure-general-total-mention",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Closure,
    humanName: "Menção a total geral",
    description: "Ocorrência de expressões como \"total geral\", \"valor global\" ou \"total da proposta\" associada a um valor.",
    documentaryMeaning: "Compatível com o encerramento de um bloco orçamentário, mas não prova, sozinha, que o bloco encerrado era um orçamento de serviços.",
    observableForms: ["Rótulo de total/valor global próximo ao final de uma sequência tabular ou isolado na página"],
    limitations: ["Também encerra tabelas financeiras, cronogramas e demonstrativos não orçamentários"],
    permittedUses: ["Sinalizar possível fim de bloco quando há sequência estrutural imediatamente anterior"],
    prohibitedUses: ["Confirmar, sozinha, que houve uma planilha orçamentária antes dela", "Validar o valor numérico"],
    sufficientAlone: false,
    insufficiencyRationale: "Sinal de fechamento isolado nunca comprova que houve uma planilha orçamentária antes dele — depende de sequência estrutural imediatamente anterior.",
    relatedSignalIds: ["closure-density-drop", "closure-structural-break"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "closure-density-drop",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Closure,
    humanName: "Queda de densidade de linhas",
    description: "Redução perceptível na quantidade de linhas/itens tabulares em relação às páginas estruturais imediatamente anteriores do mesmo bloco.",
    documentaryMeaning: "Compatível com a página de fechamento de um bloco antes tabular e denso.",
    observableForms: ["Contagem de itens/linhas tabulares muito menor que a média das páginas anteriores do mesmo grupo de continuidade"],
    limitations: ["Uma página com pouco conteúdo pode simplesmente ser uma página de transição ou capa de outra seção, sem relação com fechamento orçamentário"],
    permittedUses: ["Reforçar hipótese de fechamento quando há sinal de total geral e sequência estrutural anterior"],
    prohibitedUses: ["Concluir fechamento apenas pela queda de densidade"],
    sufficientAlone: false,
    insufficiencyRationale: "Precisa coexistir com menção a total geral e com sequência estrutural anterior para sustentar hipótese de fechamento.",
    relatedSignalIds: ["closure-general-total-mention"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "closure-structural-break",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.Closure,
    humanName: "Quebra da estrutura tabular repetida",
    description: "A página seguinte a uma sequência estrutural interrompe o padrão de repetição de linha e retorna a outro formato documental (texto corrido, nova capa, orientação distinta).",
    documentaryMeaning: "Compatível com o fim de um bloco orçamentário, junto com os demais sinais de fechamento.",
    observableForms: ["Ausência do padrão de repetição de linha na página seguinte a um grupo de continuidade estrutural"],
    limitations: ["Toda tabela, orçamentária ou não, eventualmente termina — a quebra por si só não distingue o tipo de tabela que terminou"],
    permittedUses: ["Delimitar o fim candidato de um grupo de continuidade já formado por sinais estruturais"],
    prohibitedUses: ["Ser usada isoladamente para declarar fechamento orçamentário"],
    sufficientAlone: false,
    insufficiencyRationale: "É consequência observável do fim de qualquer bloco tabular — só ganha sentido de fechamento orçamentário junto com os demais sinais desta família.",
    relatedSignalIds: ["closure-general-total-mention", "closure-density-drop"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },

  // ---- Extraction condition — availability ----------------------------------
  {
    id: "extraction-text-available",
    definitionVersion: 2,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Texto disponível",
    description: "O extrator retornou pelo menos um item textual útil.",
    documentaryMeaning: "Condição técnica de disponibilidade — não avalia se o texto retornado é confiável ou de boa qualidade.",
    observableForms: ["Presença de ao menos um item textual não vazio retornado pelo extrator"],
    limitations: [
      "Não implica qualidade aceitável — texto disponível pode ainda ser degradado ou indeterminado",
      "Não é evidência de conteúdo orçamentário",
    ],
    permittedUses: ["Habilitar a leitura dos demais sinais lexicais/estruturais nesta página, sujeita à dimensão de qualidade"],
    prohibitedUses: ["Ser usada como sinal de presença ou ausência de orçamento", "Ser confundida com qualidade aceitável"],
    sufficientAlone: false,
    insufficiencyRationale: "Descreve apenas disponibilidade técnica, nunca conteúdo documental nem qualidade — texto disponível não significa texto aceitável.",
    relatedSignalIds: ["extraction-no-extractable-text", "extraction-error", "extraction-acceptable-quality"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "extraction-no-extractable-text",
    definitionVersion: 2,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Ausência de texto extraível",
    description: "O extrator não retornou nenhum item textual útil para a página, sem indicação de erro técnico.",
    documentaryMeaning: "Página tecnicamente sem texto — pode ser uma página de imagem, um separador ou uma limitação do extrator, sem que isso configure uma falha técnica explícita.",
    observableForms: ["Zero itens textuais úteis retornados pelo extrator para a página"],
    limitations: [
      "Não permite concluir, sozinha, que a página é digitalizada — pode ser página em branco, separador, ou limitação do extrator",
      "Não deve gerar conteúdo inventado para a página",
      "Distinta de extraction-error, que representa falha técnica explícita",
    ],
    permittedUses: ["Registrar lacuna documental na página", "Acionar processamento parcial quando dentro de um grupo de continuidade"],
    prohibitedUses: [
      "Inferir conteúdo ausente",
      "Classificar automaticamente como página digitalizada sem evidência técnica adicional",
      "Ser confundida com extraction-error",
    ],
    sufficientAlone: false,
    insufficiencyRationale: "É uma condição técnica de disponibilidade, não uma classificação de conteúdo — nunca decide, sozinha, o papel documental da página.",
    relatedSignalIds: ["extraction-text-available", "extraction-error"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "extraction-error",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Erro de extração",
    description: "O processo de extração falhou tecnicamente ao processar a página, de forma explícita e distinta da simples ausência de conteúdo textual.",
    documentaryMeaning: "Falha técnica do mecanismo de extração — não descreve o conteúdo da página, apenas a incapacidade de processá-la nesta tentativa.",
    observableForms: ["Exceção ou condição de falha explícita relatada pelo extrator para a página"],
    limitations: ["Não equivale a ausência de texto", "Não equivale a página em branco", "Não equivale a página digitalizada"],
    permittedUses: ["Registrar falha técnica explícita da tentativa de extração", "Acionar processamento parcial ou reprocessamento"],
    prohibitedUses: [
      "Ser tratada como sinônimo de ausência de texto, página em branco ou página digitalizada",
      "Inferir conteúdo para substituir a falha",
    ],
    sufficientAlone: false,
    insufficiencyRationale: "Descreve uma falha técnica do processo de extração, não o conteúdo documental da página — nunca decide, sozinha, o papel documental da página.",
    relatedSignalIds: ["extraction-text-available", "extraction-no-extractable-text"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },

  // ---- Extraction condition — quality ----------------------------------------
  {
    id: "extraction-acceptable-quality",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Qualidade de extração aceitável",
    description: "A qualidade do texto extraído é considerada aceitável segundo um perfil de avaliação futuro e versionado.",
    documentaryMeaning: "Condição técnica de qualidade — não avalia se o conteúdo textual é relevante para localização orçamentária.",
    observableForms: ["Métricas de qualidade dentro de faixa considerada aceitável por um perfil de extração versionado, a definir com evidência empírica em Sprint futura"],
    limitations: [
      "Nenhum limiar numérico é fixado nesta Sprint",
      "Não implica relevância documental — uma página de texto corrido comum também pode qualificar",
    ],
    permittedUses: ["Habilitar leitura confiável dos demais sinais lexicais/estruturais nesta página"],
    prohibitedUses: ["Ser usada como sinal de presença ou ausência de orçamento", "Fixar limiar numérico sem evidência empírica"],
    sufficientAlone: false,
    insufficiencyRationale: "Descreve apenas qualidade técnica da extração, nunca conteúdo documental — qualidade aceitável não implica presença de orçamento.",
    relatedSignalIds: ["extraction-text-available", "extraction-degraded-quality", "extraction-indeterminate-quality"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "extraction-degraded-quality",
    definitionVersion: 2,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Qualidade de extração degradada",
    description: "O extrator retornou texto, mas com proporção elevada de caracteres de substituição, caracteres de controle inesperados ou fragmentação anômala.",
    documentaryMeaning: "A página tem texto disponível, mas a qualidade não é confiável para leitura de sinais lexicais ou estruturais.",
    observableForms: ["Proporção de caracteres de substituição/controle acima de um limiar — limiar ainda não fixado nesta Sprint, pendente de evidência empírica"],
    limitations: ["Não deve ser confundida com ausência de texto (extraction-no-extractable-text)", "Não autoriza preenchimento ou correção de conteúdo"],
    permittedUses: ["Registrar lacuna de qualidade", "Reduzir a confiabilidade dos sinais lexicais/estruturais lidos nesta página, sem descartar sinais não-lexicais (ex.: geometria)"],
    prohibitedUses: ["Corrigir ou completar o texto degradado", "Fixar limiar de degradação sem fixture sintética deliberadamente degradada e evidência empírica"],
    sufficientAlone: false,
    insufficiencyRationale: "É uma condição de qualidade da extração, não uma classificação de conteúdo — nunca decide, sozinha, o papel documental da página.",
    relatedSignalIds: ["extraction-text-available", "extraction-acceptable-quality", "extraction-indeterminate-quality"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "extraction-indeterminate-quality",
    definitionVersion: 2,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Qualidade de extração indeterminada",
    description: "As métricas disponíveis não permitem classificar a qualidade da página como aceitável ou degradada com confiança.",
    documentaryMeaning: "Reconhece honestamente o limite do que o extrator consegue informar, em vez de forçar uma classificação binária de qualidade.",
    observableForms: ["Métricas de qualidade ausentes, inconclusivas ou contraditórias"],
    limitations: ["Não deve ser tratada como equivalente a \"aceitável\" nem a \"degradada\""],
    permittedUses: ["Registrar incerteza explícita sobre a qualidade da página"],
    prohibitedUses: ["Ser silenciosamente promovida a \"aceitável\" para simplificar o processamento"],
    sufficientAlone: false,
    insufficiencyRationale: "É uma admissão de incerteza técnica sobre qualidade, não uma classificação de conteúdo — nunca decide, sozinha, o papel documental da página.",
    relatedSignalIds: ["extraction-acceptable-quality", "extraction-degraded-quality"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },

  // ---- Extraction condition — composition ------------------------------------
  {
    id: "extraction-composition-predominantly-textual",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Composição predominantemente textual",
    description: "O conteúdo observável da página é predominantemente composto por texto.",
    documentaryMeaning: "Descreve o tipo predominante de conteúdo observável — não indica presença ou ausência de orçamento.",
    observableForms: ["Predomínio de itens textuais sobre elementos gráficos observáveis pelo extrator"],
    limitations: ["Não distingue o assunto do texto", "Não é evidência de conteúdo orçamentário"],
    permittedUses: ["Registrar a composição observável da página"],
    prohibitedUses: ["Ser usada como sinal de presença ou ausência de orçamento"],
    sufficientAlone: false,
    insufficiencyRationale: "Descreve apenas o tipo predominante de conteúdo, nunca o assunto documental — nunca indica, por si só, presença ou ausência de orçamento.",
    relatedSignalIds: ["extraction-composition-mixed", "extraction-composition-graphic-or-image", "extraction-composition-not-determinable"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "extraction-composition-mixed",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Composição mista",
    description: "O conteúdo observável da página combina elementos textuais e gráficos/imagéticos, sem predomínio claro de um sobre o outro.",
    documentaryMeaning: "Descreve uma composição heterogênea — não indica presença ou ausência de orçamento.",
    observableForms: ["Presença combinada e comparável de itens textuais e elementos gráficos observáveis"],
    limitations: ["Não distingue o assunto do conteúdo textual presente", "Não é evidência de conteúdo orçamentário"],
    permittedUses: ["Registrar a composição observável da página"],
    prohibitedUses: ["Ser usada como sinal de presença ou ausência de orçamento"],
    sufficientAlone: false,
    insufficiencyRationale: "Descreve apenas o tipo de conteúdo observável, nunca o assunto documental.",
    relatedSignalIds: ["extraction-composition-predominantly-textual", "extraction-composition-graphic-or-image"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "extraction-composition-graphic-or-image",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Composição gráfica ou de imagem",
    description: "O conteúdo observável da página é predominantemente gráfico ou de imagem, com pouco ou nenhum texto útil.",
    documentaryMeaning: "Compatível com desenhos técnicos, mapas, plantas ou páginas digitalizadas sem camada textual confiável — não indica, por si só, presença ou ausência de orçamento.",
    observableForms: ["Predomínio de elementos gráficos/imagéticos sobre itens textuais observáveis pelo extrator"],
    limitations: ["Não distingue um desenho técnico de uma página digitalizada de uma tabela", "Não é evidência de conteúdo orçamentário"],
    permittedUses: ["Registrar a composição observável da página", "Compor, junto com sinais de continuidade, a caracterização de um bloco não-textual"],
    prohibitedUses: ["Ser usada como sinal de presença ou ausência de orçamento", "Concluir, sozinha, que a página pertence a um desenho técnico específico"],
    sufficientAlone: false,
    insufficiencyRationale: "Descreve apenas o tipo de conteúdo observável — mesmo repetida em várias páginas, nunca prova ausência ou presença de orçamento sozinha.",
    relatedSignalIds: ["extraction-composition-predominantly-textual", "extraction-composition-mixed", "continuity-stable-geometry"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
  {
    id: "extraction-composition-not-determinable",
    definitionVersion: 1,
    family: BudgetDocumentSignalFamily.ExtractionCondition,
    humanName: "Composição não determinável",
    description: "Não é possível determinar, com as métricas disponíveis, o tipo predominante de conteúdo observável da página.",
    documentaryMeaning: "Reconhece honestamente o limite do que o extrator consegue informar, em vez de forçar uma classificação entre textual, mista ou gráfica.",
    observableForms: ["Métricas de composição ausentes, inconclusivas ou contraditórias"],
    limitations: ["Não deve ser tratada como equivalente a nenhuma das demais categorias de composição"],
    permittedUses: ["Registrar incerteza explícita sobre a composição da página"],
    prohibitedUses: ["Ser silenciosamente promovida a uma categoria determinada para simplificar o processamento"],
    sufficientAlone: false,
    insufficiencyRationale: "É uma admissão de incerteza técnica sobre composição, não uma classificação de conteúdo.",
    relatedSignalIds: ["extraction-composition-predominantly-textual", "extraction-composition-mixed", "extraction-composition-graphic-or-image"],
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  },
];

export const BUDGET_DOCUMENT_SIGNAL_CATALOG: BudgetDocumentSignalCatalog = deepFreeze(
  MUTABLE_BUDGET_DOCUMENT_SIGNAL_CATALOG,
);

function isNonEmptyStringArray(value: ReadonlyArray<string>): boolean {
  return value.length > 0 && value.every((item) => item.trim().length > 0);
}

/**
 * Structural validation of the catalog itself — never a decision about
 * pages. Enforces the architectural invariant that no signal in this
 * catalog is documented as sufficient on its own.
 */
export function validateBudgetDocumentSignalCatalog(
  catalog: BudgetDocumentSignalCatalog,
): ReadonlyArray<BudgetDocumentSignalCatalogIssue> {
  const issues: BudgetDocumentSignalCatalogIssue[] = [];
  const seenIds = new Set<string>();
  const knownIds = new Set(catalog.map((definition) => definition.id));

  catalog.forEach((definition) => {
    if (seenIds.has(definition.id)) {
      issues.push({ code: "duplicate_id", signalId: definition.id, message: `Identificador duplicado: ${definition.id}` });
    }
    seenIds.add(definition.id);

    if (definition.humanName.trim().length === 0) {
      issues.push({ code: "missing_human_name", signalId: definition.id, message: "Nome humano ausente" });
    }
    if (definition.description.trim().length === 0) {
      issues.push({ code: "missing_description", signalId: definition.id, message: "Descrição ausente" });
    }
    if (definition.documentaryMeaning.trim().length === 0) {
      issues.push({ code: "missing_documentary_meaning", signalId: definition.id, message: "Significado documental ausente" });
    }
    if (!isNonEmptyStringArray(definition.observableForms)) {
      issues.push({ code: "empty_observable_forms", signalId: definition.id, message: "Formas observáveis vazias" });
    }
    if (!isNonEmptyStringArray(definition.limitations)) {
      issues.push({ code: "empty_limitations", signalId: definition.id, message: "Limitações vazias" });
    }
    if (!isNonEmptyStringArray(definition.permittedUses)) {
      issues.push({ code: "empty_permitted_uses", signalId: definition.id, message: "Usos permitidos vazios" });
    }
    if (!isNonEmptyStringArray(definition.prohibitedUses)) {
      issues.push({ code: "empty_prohibited_uses", signalId: definition.id, message: "Usos proibidos vazios" });
    }

    if (definition.sufficientAlone) {
      issues.push({
        code: "sufficient_alone_without_architectural_authorization",
        signalId: definition.id,
        message: "Nenhum sinal deste catálogo pode ser marcado como suficiente isoladamente sem decisão arquitetural explícita registrada.",
      });
    }
    if (!definition.sufficientAlone && (definition.insufficiencyRationale === null || definition.insufficiencyRationale.trim().length === 0)) {
      issues.push({ code: "missing_insufficiency_rationale", signalId: definition.id, message: "Justificativa de insuficiência ausente" });
    }
    if (definition.sufficientAlone && definition.insufficiencyRationale !== null) {
      issues.push({ code: "unexpected_insufficiency_rationale", signalId: definition.id, message: "Justificativa de insuficiência presente para sinal marcado como suficiente" });
    }

    definition.relatedSignalIds.forEach((relatedId) => {
      if (!knownIds.has(relatedId)) {
        issues.push({ code: "dangling_related_signal_id", signalId: definition.id, message: `Referência a sinal inexistente: ${relatedId}` });
      }
    });

    if (definition.catalogVersion !== BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION) {
      issues.push({ code: "catalog_version_mismatch", signalId: definition.id, message: "Versão do catálogo divergente da versão vigente" });
    }
  });

  return issues;
}

export function getBudgetDocumentSignalDefinition(
  catalog: BudgetDocumentSignalCatalog,
  id: string,
): BudgetDocumentSignalDefinition | null {
  return catalog.find((definition) => definition.id === id) ?? null;
}

export function listBudgetDocumentSignalDefinitionsByFamily(
  catalog: BudgetDocumentSignalCatalog,
  family: BudgetDocumentSignalFamily,
): ReadonlyArray<BudgetDocumentSignalDefinition> {
  return catalog.filter((definition) => definition.family === family);
}
