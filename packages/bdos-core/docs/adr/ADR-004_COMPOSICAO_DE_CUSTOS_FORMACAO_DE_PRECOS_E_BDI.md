# ADR-004 — Composição de Custos, Formação de Preços e BDI

- **Status**: Aprovado
- **Data da decisão**: 2026-07-13
- **Epic**: 21 — Engenharia de Custos e Licitações
- **Sprint**: 21.2C — Contrato Conceitual da Composição de Custos, Formação de Preços e BDI
- **Decisão principal**: composição de custos e os conceitos relacionados ao BDI são estruturas econômicas conceitualmente distintas, com funções e regras próprias; a mesma parcela econômica não pode ser contabilizada em duplicidade na formação do preço. BDI é decomposto em quatro conceitos relacionados e não intercambiáveis — Metodologia de BDI, Versão da Metodologia de BDI, Aplicação da Metodologia de BDI e BDI Apurado — nunca tratados como sinônimos; a Formação do Preço Unitário é conceito e cadeia de proveniência, com dois eixos independentes (modo de obtenção; contexto econômico ou jurídico); nenhuma afirmação econômica é permitida sem que todos os dados causalmente necessários estejam confirmados, identificados, rastreáveis e compatíveis entre si.

Este ADR documenta a decisão arquitetural para a Sprint 21.2C do Epic 21 ("Engenharia de Custos e Licitações"), com base no ADR-001 (identidade e rastreabilidade), no ADR-002 (limite do Processo de Licitação e Contratação) e no ADR-003 (Versão do Orçamento e Transformações Orçamentárias). É exclusivamente conceitual e arquitetural — nenhum tipo, esquema, repositório, API, interface, teste, migração, banco de dados ou motor de cálculo é criado por esta redação. É autossuficiente.

---

## Contexto

O ADR-003 (Seção J) já registrou explicitamente que "o domínio de composição de custos ainda inexistente na plataforma" reservava, para uma Sprint própria, os assuntos de composição de custos, produtividade, encargos, tributos, riscos, administração central, lucro e cálculo de BDI. Esta Sprint é essa reserva sendo cumprida.

Antes da redação, três etapas de auditoria dirigida (Etapa 1, 1B e 1C) e três etapas de revisão de consistência (Etapa 2, 2B e 2C) foram executadas, confirmando: o domínio permanece ainda não implementado nos termos definidos por este ADR; duas colisões arquiteturais reais foram encontradas e precisam ser conhecidas, não silenciadas (Seção P); e BDI, tratado inicialmente como um único conceito, precisava ser decomposto em quatro conceitos relacionados e não intercambiáveis para evitar afirmações economicamente incorretas.

---

## Problema

Sem fronteiras normativas explícitas, uma implementação futura de composição de custos, formação de preços e BDI corre riscos concretos: duplicar uma mesma parcela econômica entre a composição de custos e a Aplicação da Metodologia de BDI; reacrescentar o BDI Apurado ao preço como se fosse uma parcela econômica independente; apresentar afirmações sobre margem, lucro, custo ou BDI sem dados suficientes para sustentá-las; confundir os caminhos de criação da Versão do Orçamento (já aprovados no ADR-003) com os modos de obtenção de um preço unitário; presumir uma metodologia de BDI, um regime tributário ou um percentual como padrão da plataforma; tratar a estrutura de uma metodologia, seu uso concreto e seu resultado numérico como se fossem a mesma coisa; e perder a capacidade de reproduzir historicamente um cálculo, porque regras, fontes ou classificações mudaram silenciosamente.

Este ADR estabelece o contrato conceitual que impede esses riscos, sem antecipar nenhuma decisão de implementação.

---

## A. Auditoria conceitual e origem da decisão

**Não foi encontrada implementação de domínio que represente composição de custos, Metodologia de BDI, Aplicação da Metodologia de BDI, BDI Apurado, coeficientes, produtividade ou formação detalhada de preços nos termos definidos por este ADR.**

Confirmado no código, como precedente estrutural reaproveitável: `measurement-workspace.ts:506-507` define `computeTotalValue(quantity, unitValue) { return quantity * unitValue }`, sempre calculado, nunca um campo de entrada independente; `bulletin-import.types.ts:48,72-73` distingue explicitamente `declaredUnitPrice`/`declaredUnitValue`/`declaredTotalValue` (valor declarado pela fonte) dos campos calculados de `measurement-workspace.types.ts:58-59,71,79`.

Confirmado no código: `engineering-contract.types.ts:65,87` expõe apenas `contractValue: number | null`, sem itens, sem composição, sem BDI; o mesmo arquivo não expõe `organizationId` (bloqueio já registrado no ADR-002).

Confirmados dois riscos arquiteturais que este ADR carrega para a Seção P, sem tentar resolver: (1) `service-item-management/service-item-management.types.ts:41-59` define `ManagedServiceItem`, **já com `unitPrice` e `contractValue`**, além de `contractQuantity`, `accumulatedQuantity`, `remainingQuantity`, escopado por `contractId` opaco — domínio operacional já classificado em `engineering-boundaries.test.ts:33`, já consumido por adaptadores de fatos do Motor de Decisão (Decision Engine) e por `revenue-recognition.test.ts:291`; (2) `contract-management/contract-management.types.ts:9,42-45` define `Contract`/`ContractValue{amount,currency}`, nunca reconciliado no código com `EngineeringContract`.

Confirmado na documentação: `docs/PLATFORM_ARCHITECTURE.md:111` — o Motor de Execução (Execution Engine) está "em produção" (`domain/execution-management`, `services/execution-management`, Epic 16.1-16.8, persistência real com RLS); `docs/PLATFORM_ARCHITECTURE.md:110,444` — o Studio de Finanças permanece "Planejado"; `packages/bdos-core/docs/BDOS_VISION.md:152-153,176-177` — a visão de longo prazo já cita custos diretos, custos indiretos, BDI, produtividade e margem, sem nenhuma definição normativa; `BDOS_VISION.md:282-290` — nenhuma regra de anonimização/agregação para benchmark entre organizações usuárias está aprovada hoje.

Confirmado no ADR-001 (`ADR-001_COST_ENGINEERING_IDENTITY_AND_LINEAGE.md:167,233`): `Composição` e `insumo` já são registrados como "domínio de referência separado, apontado por um `ServiceItem` através do campo `sourceCode`, com ciclo de vida próprio" — reconciliado nesta Sprint como **Composição de Referência** (Seção G).

---

## B. Vocabulário econômico e fronteiras

### Camada de custo e preço

| Termo | Definição | Fronteira |
|---|---|---|
| Custo direto | Recursos diretamente consumidos na execução de um Item de Serviço | Nunca inclui componentes de BDI |
| Custo indireto | Recurso, custo ou despesa que não pode ser diretamente apropriado a um único Item de Serviço, cuja natureza, base de alocação e participação na formação do preço dependem da metodologia declarada | Nenhum componente é classificado universalmente como direto ou indireto |
| Custo unitário / Custo total | Custo por unidade de medida / custo unitário × quantidade | — |
| Preço unitário | Valor pelo qual um Item de Serviço é apresentado numa Versão do Orçamento | Preço não é custo |
| Preço Total Bruto da Linha | Quantidade × preço unitário (equivalente ao "valor bruto calculado", ADR-003 Seção F) | Sempre preservado, independentemente de existir ou não desconto |
| Preço Total Líquido da Linha | Preço Total Bruto da Linha, ajustado por desconto comercial **somente quando esse desconto tiver sido explicitamente atribuído à linha** por regra declarada | Ver detalhamento em "Desconto comercial e Preço Total Líquido", nesta seção |
| Desconto comercial / diferença de arredondamento / divergência documental | Já definidos no ADR-003, Seção F/I | Reafirmados, não redefinidos |
| Margem | Termo proibido de uso isolado — exige qualificação (sobre preço, sobre custo/contribuição, bruta, operacional) e base de cálculo explícita | Margem não é acréscimo genérico sobre custo |

### Desconto comercial e Preço Total Líquido

Uma Linha do Orçamento **somente possui Preço Total Líquido próprio quando o desconto ou ajuste comercial tiver sido explicitamente atribuído a ela** por uma regra declarada. Quando o desconto existir apenas no nível da Versão do Orçamento, de um lote, ou de outro agrupamento, **o BDOS não distribui esse desconto silenciosamente pelas linhas** — o Preço Total Bruto da Linha permanece preservado, e a distribuição do desconto continua dependente de uma estratégia explicitamente declarada (Seção J). Diferenças de arredondamento permanecem conceito próprio, nunca confundido com desconto comercial ou com divergência entre valor declarado e calculado.

### Camada de lucro

| Termo | Definição | Fronteira |
|---|---|---|
| Parcela de lucro prevista | Componente ou parâmetro de lucro previsto em uma Aplicação da Metodologia de BDI, expresso conforme a metodologia declarada | Não é lucro contábil realizado; não é resultado econômico realizado; não pode ser inferido sem abertura suficiente da Aplicação da Metodologia de BDI |
| Lucro estimado do cenário | Projeção de resultado de uma Simulação Orçamentária | Não é fato contábil |
| Resultado econômico realizado / lucro contábil da organização usuária | Fatos de execução/contábeis | **Fora de escopo deste ADR** — a propriedade conceitual desses resultados será definida em Sprint própria (Seção P) |

### Camada de composição

Insumo; coeficiente; produtividade; unidade da produtividade; encargos sociais; tributos; base de incidência — definidos integralmente na Seção C.

### Camada de BDI — quatro conceitos relacionados e não intercambiáveis

**Metodologia de BDI**, **Versão da Metodologia de BDI**, **Aplicação da Metodologia de BDI** e **BDI Apurado** — definidos integralmente na Seção E. A palavra "BDI", isolada, **não é usada** neste ADR quando houver risco de confundir esses quatro conceitos.

### Camada de fontes e reprodução

Fonte oficial ou pública; fonte externa técnica ou comercial; fonte interna — definidas na Seção F, classificadas por quem produziu a informação, nunca por onde está armazenada. **Cada registro econômico preserva todas as dimensões causalmente necessárias para sua interpretação e reprodução** — que podem incluir, quando aplicáveis: unidade; moeda; localidade; data-base; período; escala; base de incidência; escopo; condições comerciais. A ausência de uma dimensão só constitui lacuna documental quando ela for necessária ao significado, comparação, cálculo ou reprodução do valor (Seção F/N). Índice: **referência temporal utilizada para representar ou aplicar variações de preços ou custos, com fonte, período, versão, localidade e regra de aplicação identificados** — produtividade nunca é incluída nessa definição; produtividade é conceito próprio, com unidade, fonte, período, contexto e versão, que pode alterar o custo calculado, mas não é índice de preço ou custo. Referência de preço: item ou insumo; unidade; moeda; localidade; data-base; fonte; versão da fonte; condições comerciais; tributos incluídos ou excluídos; validade.

### Camada de evidência

Dado confirmado; premissa proposta; lacuna documental; validação humana — definidos na Seção H. Versão da fonte; versão da metodologia — necessárias porque um código (`sourceCode`) só é interpretável junto de sua fonte e da versão dessa fonte (Seção G). Memória de cálculo — definida na Seção M.

### Camada de identidade de item

**Item de Serviço, Item Contratado e `ManagedServiceItem` são representações com identidades e funções atualmente não intercambiáveis. A relação semântica exata entre elas permanece aberta para reconciliação arquitetural futura.** Item de Serviço é um dos três tipos de Linha do Orçamento (`BudgetLineKind` é sua classificação, não sua identidade). Item Contratado é o termo principal (conceito próprio da Base Contratual da Obra; o nome interno `ContractBaselineItem` só aparece em nota técnica quando estritamente necessário). `ManagedServiceItem` é representação operacional já existente no código (Seção P). Nenhuma conversão automática entre os três é presumida; nenhuma identidade compartilhada é presumida.

### Camada de escopo

**Escopo da Licitação**: processo inteiro, lote ou conjunto de lotes (já aprovado no ADR-002). **Escopo de Aplicação da Metodologia de BDI**: elementos econômicos aos quais uma Aplicação da Metodologia de BDI se destina — Versão do Orçamento inteira; conjunto de Linhas do Orçamento; grupo; subgrupo; categoria econômica; serviços; materiais; outra seleção explicitamente identificada. São eixos complementares, nunca substitutos um do outro. **Composição de Referência e Referência de Preço não possuem Escopo da Licitação** — sua aplicabilidade é de outra natureza (fonte, versão da fonte, categoria de insumo).

---

## C. Contrato conceitual da composição de custos

**Estrutura econômica**: uma composição de custos é vinculada a um Item de Serviço; possui unidade de produção própria; custo direto unitário e total; insumos; coeficientes; produtividade; perdas; encargos sociais; critérios de incidência; e, conforme a metodologia declarada, eventuais custos indiretos alocados.

**Categorias mínimas** (lista aberta, nunca fechada em três): mão de obra; materiais; equipamentos; serviços de terceiros e demais categorias previstas pela fonte.

**Coeficiente e produtividade não são sinônimos** — coeficiente é a quantidade de um insumo necessária para produzir uma unidade do Item de Serviço; produtividade é a taxa de execução da qual um coeficiente pode ser derivado, ou pode ser informado independentemente. Cada valor de composição preserva as dimensões causalmente necessárias à sua interpretação (Seção B/F).

**Tratamento e alocação dos custos indiretos**: um custo indireto é "recurso, custo ou despesa que não pode ser diretamente apropriado a um único Item de Serviço, cuja natureza, base de alocação e participação na formação do preço dependem da metodologia declarada" — nunca um componente universal de contrato como um todo. A natureza econômica de um componente é distinta do tratamento que a metodologia declarada lhe dá — linha própria, rateio, agrupamento em linha específica, componente de uma Aplicação da Metodologia de BDI, ou fora do preço analisado. **Nenhum componente — incluindo administração central — é classificado universalmente como direto ou indireto pelo BDOS.**

**Fronteira com os conceitos de BDI**: a Composição de Custos não incorpora economicamente componentes, parâmetros ou resultados pertencentes à Aplicação da Metodologia de BDI. Ela pode manter relações explícitas com a Metodologia de BDI, sua Versão, sua Aplicação e o BDI Apurado na cadeia de Formação do Preço Unitário, sem que essas relações autorizem sobreposição econômica. Composição de custos e os conceitos relacionados ao BDI são estruturas econômicas conceitualmente distintas; podem participar da mesma cadeia de Formação do Preço Unitário; relação e rastreabilidade não significam incorporação; a mesma parcela econômica não pode ser contabilizada duas vezes.

**Regra de não duplicidade**: **a mesma parcela econômica não pode ser contabilizada mais de uma vez na formação do preço.** Em relação aos conceitos de BDI (Seção E): a mesma parcela econômica não pode ser incluída simultaneamente na composição de custos e entre os componentes ou parâmetros econômicos da Aplicação da Metodologia de BDI. O BDI Apurado é resultado derivado dessa aplicação e nunca pode ser acrescentado novamente ao preço como parcela econômica independente. É permitida a divisão explícita e não sobreposta de um componente em parcelas diferentes, desde que as parcelas sejam economicamente separáveis, cada parcela tenha valor ou percentual próprio, as bases de incidência sejam identificadas, o critério de divisão seja preservado, e não exista sobreposição. **Divisão explícita e não sobreposta é permitida. Dupla contagem não é.**

**Aplicabilidade da Composição de Custos**: a utilização de uma Versão da Composição de Custos por uma Linha do Orçamento ou Item de Serviço distingue três relações, que podem coexistir mas não são equivalentes nem substituem umas às outras:

- **Relação de aplicabilidade**: identifica para qual Item de Serviço ou Linha do Orçamento aquela Versão da Composição de Custos pode ser utilizada.
- **Relação econômica**: identifica qual papel aquela composição desempenha na formação do custo ou do preço.
- **Relação de Rastreabilidade**: identifica de qual fonte, Composição de Referência, versão ou transformação aquela composição se originou ou derivou.

Nenhuma representação técnica dessas três relações é escolhida nesta etapa. Não se cria, por simetria com o BDI, um "Escopo de Aplicação da Composição de Custos".

---

## D. Formação do preço unitário e proveniência do preço

**Nesta Sprint, Formação do Preço Unitário é tratada como conceito e cadeia de proveniência. Sua futura representação técnica não é decidida.**

### Eixo A — Modo de obtenção ou derivação do preço

Extraído de documento; informado diretamente; calculado a partir de componentes econômicos; resultante de Transformação Orçamentária.

### Eixo B — Contexto econômico ou jurídico

Orçamento oficial; orçamento interno; proposta; proposta aceita; Base Contratual da Obra; outros contextos que estejam documentalmente sustentados pelo ADR-001, ADR-002 ou ADR-003. **Medição não é incluída como contexto de formação original do preço.**

**O Studio de Medições utiliza a Base Contratual da Obra como referência econômica contratual, mas pode receber preços e valores declarados em boletins ou documentos de medição como evidência documental. Esses valores declarados não formam o preço original nem substituem automaticamente a Base Contratual da Obra.** Uma alteração de preço durante a execução dependerá de evidência contratual própria (aditivo, reajuste, reequilíbrio, ou inclusão de novo Item Contratado), cuja modelagem não é antecipada por este ADR.

**Os dois eixos são independentes entre si e independentes dos três caminhos de criação da Versão do Orçamento** (já aprovados no ADR-003: a partir de documentos; diretamente no BDOS; por Transformação Orçamentária). **"Preço calculado" não é um quarto caminho de criação da Versão do Orçamento** — é um modo de obtenção que pode ocorrer, ao nível da Linha do Orçamento, dentro do caminho "diretamente no BDOS" ou, futuramente, dentro de uma Transformação Orçamentária. Uma única Versão do Orçamento nativa pode ter, simultaneamente, linhas informadas diretamente e linhas calculadas — os dois níveis nunca se confundem.

**Base Contratual da Obra não é modo de obtenção do preço — é contexto.** Um preço utilizado ou incorporado no contexto da Base Contratual da Obra pode ter sido extraído diretamente do contrato, derivado de uma proposta aceita e documentalmente incorporada, produzido por transformação validada, ou confirmado por documento complementar — o contexto não determina, por si só, qual modo de obtenção se aplicou.

---

## E. Contrato conceitual do BDI

BDI é tratado neste ADR como **quatro conceitos relacionados e não intercambiáveis, nunca como sinônimos** — o texto evita usar "BDI" isoladamente sempre que houver risco de confundir Metodologia, Versão da Metodologia, Aplicação e BDI Apurado.

### Metodologia de BDI

Estrutura de regras que define: fórmula; componentes possíveis; relações entre componentes; bases possíveis de incidência; ordem das operações; critérios gerais; regras de arredondamento.

### Versão da Metodologia de BDI

Retrato preservado e versionado de uma Metodologia de BDI específica, em um momento dado. **Uma alteração de fórmula, componentes, relações, significado, critérios gerais, ordem das operações ou regras metodológicas produz nova Versão da Metodologia. Uma alteração de parâmetro ou percentual, isoladamente, não produz necessariamente nova versão** — ela pertence ao nível de Aplicação, a seguir.

### Aplicação da Metodologia de BDI

Uso concreto de uma Versão da Metodologia de BDI, contendo: contexto econômico ou jurídico (Seção D); Escopo da Licitação, quando aplicável; Escopo de Aplicação da Metodologia de BDI (Seção B); parâmetros e percentuais; bases efetivamente utilizadas; fontes; data-base; validações; e o registro econômico ao qual se relaciona. **Uma Aplicação da Metodologia de BDI não se limita à Versão do Orçamento ou à Simulação Orçamentária** — pode relacionar-se, quando documentalmente sustentado, também a uma proposta, a uma proposta aceita, ou à Base Contratual da Obra. Isso **não autoriza promoção automática** entre esses contextos: cada relação depende de evidência e de Relação de Rastreabilidade próprias (Seção O do ADR-003; Seção G deste ADR).

### BDI Apurado

Resultado determinístico de uma Aplicação da Metodologia de BDI, expresso conforme a própria metodologia como: percentual; fator; conjunto de resultados por escopo; ou outra forma explicitamente definida pela metodologia.

### Regras aplicáveis aos quatro conceitos

A expressão "BDI de serviços" ou "BDI de materiais" **sempre identifica**, conforme o caso, se se refere a uma Metodologia de BDI, a uma Versão da Metodologia de BDI, a uma Aplicação da Metodologia de BDI, ou a um BDI Apurado — nunca usada de forma ambígua. Serviços e materiais podem utilizar: aplicações diferentes da mesma Versão da Metodologia; Versões da Metodologia diferentes; ou BDI Apurado diferente — este ADR **não exige** que todo orçamento possua obrigatoriamente uma metodologia para cada categoria.

**BDI (em qualquer um dos quatro conceitos relacionados)**: não é fórmula universal; não é margem; não é lucro; não explica sozinho todo o preço unitário (existe também o desconto comercial, ADR-003 Seção F); não contém necessariamente todos os custos indiretos; nunca é escolhido silenciosamente pelo BDOS.

**Regra de não duplicidade**: a mesma parcela econômica não pode ser incluída simultaneamente na composição de custos e entre os componentes ou parâmetros econômicos da Aplicação da Metodologia de BDI. O BDI Apurado é resultado derivado dessa aplicação e nunca pode ser acrescentado novamente ao preço como parcela econômica independente. Divisão explícita e não sobreposta é permitida. Dupla contagem não é.

---

## F. Fontes, versões, data-base e referências de preços

Três categorias de fonte, classificadas por **quem produziu a informação, nunca por onde está armazenada**:

- **Fonte oficial ou pública**: informação produzida ou publicada por órgão, sistema ou documento oficial.
- **Fonte externa técnica ou comercial**: informação produzida por terceiro — fornecedor; subcontratado; fabricante; locadora; consultoria; publicação técnica privada.
- **Fonte interna**: informação produzida ou consolidada pela própria organização usuária — produtividade observada; custos próprios; histórico de obras; política interna; premissa aprovada internamente.

**Uma cotação de fornecedor não se torna fonte interna por estar guardada no BDOS.**

**Nenhuma categoria de fonte é escolhida automaticamente como superior às demais.** Em divergência entre fontes, o BDOS registra: as fontes conflitantes; a diferença; o impacto; a alternativa escolhida; o responsável pela validação; a justificativa; a data da decisão.

**Cada registro econômico preserva todas as dimensões causalmente necessárias para sua interpretação e reprodução** — não existe uma lista universal e obrigatória de dimensões para todo índice, composição ou aplicação; as dimensões relevantes (unidade, moeda, localidade, data-base, período, escala, base de incidência, escopo, condições comerciais) dependem do que aquele registro específico exige para ser interpretado, comparado, calculado ou reproduzido. A ausência de uma dimensão só constitui lacuna documental quando ela for necessária a esses fins.

---

## G. Versão da Composição de Custos

**Composição de Referência**: retrato proveniente de catálogo, tabela ou fonte externa, com identidade interna própria, fonte e versão da fonte — reconciliação do conceito `Composição`/`insumo` já registrado no ADR-001 (Seção G.4/J).

**Versão da Composição de Custos**: retrato econômico utilizado pela organização usuária em determinado contexto, podendo reproduzir, adaptar, combinar, ou não utilizar nenhuma Composição de Referência.

**`sourceCode` nunca é identidade interna.** Um código só pode ser interpretado com: a fonte; a versão da fonte; o contexto; e a identidade interna correspondente — a mesma fonte pode ser revisada ao longo do tempo, e o mesmo código pode significar coisas diferentes em fontes ou versões diferentes.

**Quando há Relação de Rastreabilidade conhecida desde a criação**: quando o processo que cria uma Versão da Composição de Custos já declara, no momento da criação, que ela reproduz ou deriva de uma Composição de Referência específica — a relação nasce confirmada.

**Quando há Avaliação de Correspondência posterior**: quando duas composições foram criadas de forma independente e a correspondência entre elas precisa ser inferida depois — com resultado de correspondência confirmada, ausência de correspondência, ou correspondência ambígua, acompanhado do Grau de Confiança da Correspondência e, quando necessário, validação humana.

### Decisões normativas sobre a Versão da Composição de Custos

Possui identidade própria; cada versão possui identidade própria; uma versão consolidada é imutável; qualquer alteração de coeficiente, produtividade, insumo, preço, encargo ou premissa cria nova versão; uma nova versão mantém Relação de Rastreabilidade com a anterior; não existe identidade universal de linhas entre versões; uma Versão do Orçamento referencia versões específicas das composições utilizadas; a mesma Versão da Composição de Custos pode ser referenciada por mais de uma Linha do Orçamento somente quando isso for expressamente válido; nenhuma vinculação é criada apenas por igualdade de código ou descrição.

---

## H. Premissas, lacunas documentais e validação humana

Três estados distintos, nunca fundidos: **dado confirmado** (fonte identificada, evidência suficiente); **premissa proposta** (sugerida pelo usuário, pelo BDOS ou pela inteligência artificial, ainda não confirmada); **lacuna documental** (informação necessária não localizada ou insuficiente).

A inteligência artificial pode explicar a lacuna, sugerir onde procurar, apresentar uma premissa proposta, e explicar o impacto da ausência. Ela **não pode**: inventar quantitativos; inventar preços; inventar produtividade; inventar coeficientes; inventar composições; promover uma premissa proposta para dado confirmado; escolher uma Metodologia de BDI ou parâmetros de uma Aplicação silenciosamente.

**A validação humana registra** o que foi avaliado; por quem; quando; com base em qual evidência; para qual escopo; qual decisão foi tomada; e se uma premissa proposta foi aprovada para uso naquele contexto. **A validação humana nunca apaga a proveniência nem converte ausência de evidência em dado documental confirmado.** Uma premissa aprovada para uso permanece identificada como premissa, salvo quando nova evidência suficiente justificar formalmente sua reclassificação.

---

## I. Relação com a Linha do Orçamento e a Versão do Orçamento

Cadeia conceitual recomendada, **não obrigatória em todos os casos**:

```
Versão da Composição de Custos
  → fundamenta, quando disponível, o custo de um Item de Serviço
  → pode participar da formação do preço unitário
  → o preço unitário integra uma Linha do Orçamento
  → a Linha do Orçamento integra uma Versão do Orçamento
```

Uma Linha do Orçamento pode existir: com composição completa; com composição parcial; sem composição; com preço documentado; com preço calculado; com preço transformado; ou com preço utilizado ou incorporado no contexto da Base Contratual da Obra. O ADR distingue: relação econômica; Relação de Rastreabilidade; derivação matemática; e mera correspondência documental — nunca tratadas como equivalentes.

---

## J. Transformação Orçamentária e redução de preços

Este bloco integra o ADR-003 sem redefini-lo. Toda Transformação Orçamentária deve declarar qual estratégia econômica está sendo simulada ou autorizada, entre (lista mínima, não fechada): redução apenas do preço final; redução de custos diretos; alteração de produtividade ou coeficientes; alteração de preços de insumos; alteração de parâmetros de uma Aplicação da Metodologia de BDI; alteração da parcela de lucro prevista; estratégia combinada; redistribuição entre Linhas do Orçamento sem redução uniforme. **Nenhuma estratégia é escolhida silenciosamente.**

**Regra central**: quando houver apenas redução proporcional dos preços, sem composição de custos suficiente para sustentar outra afirmação, o BDOS apresenta: preço anterior; preço resultante; percentual ou valor reduzido; distribuição da redução; e a ausência explícita de evidência sobre custo, margem, lucro e qualquer um dos quatro conceitos relacionados ao BDI.

**Uma redução de preço nunca autoriza concluir, automaticamente, que houve redução de custo, margem ou parcela de lucro prevista, nem lucro estimado alterado. Da mesma forma, uma redução de preço não autoriza concluir automaticamente que houve alteração da Metodologia de BDI, de sua Versão ou dos parâmetros da Aplicação da Metodologia de BDI, nem redução ou alteração do BDI Apurado.**

---

## K. Simulação Orçamentária e comparação de cenários

Cada Simulação Orçamentária (já imutável após o cálculo, ADR-003 Seção G) representa, nesta Sprint, também um cenário econômico identificável. A comparação entre simulações mostra, conforme os dados disponíveis: preço total; custo direto conhecido; custos indiretos conhecidos; componentes de uma Aplicação da Metodologia de BDI; BDI Apurado; parcela de lucro prevista; lacunas; premissas propostas; fontes; diferenças entre os cenários; afirmações permitidas; e afirmações não permitidas (Seção L).

A Visão Consolidada pode apresentar essa comparação de forma visual, mas **nunca cria fatos econômicos novos**.

---

## L. Regra e Matriz de Suficiência de Dados

Regra geradora, normativa:

> **Uma afirmação econômica somente é permitida quando todos os dados causalmente necessários para sustentá-la estiverem confirmados, identificados, rastreáveis e aplicáveis ao mesmo escopo econômico e temporal.**

A simples existência dos dados não basta — é exigida compatibilidade de: Item de Serviço; unidade; quantidade; moeda; localidade; data-base; período; Versão do Orçamento; Versão da Composição de Custos; Versão da Metodologia de BDI; Aplicação da Metodologia de BDI; BDI Apurado; cenário analisado.

**As dimensões, versões, aplicações e resultados listados são exigidos somente quando forem causalmente necessários à afirmação econômica específica. Uma afirmação sobre variação de preços, por exemplo, não exige Versão da Composição de Custos ou Aplicação da Metodologia de BDI quando esses conceitos não participarem causalmente da comparação.**

A matriz a seguir é **ilustrativa, nunca exaustiva**:

| Dados disponíveis | O BDOS pode afirmar | O BDOS não pode afirmar |
|---|---|---|
| Apenas preços comparáveis | Variação absoluta e percentual de preço | Que a variação representa desconto, redução de custo, margem ou lucro, alteração da Metodologia de BDI, de sua Versão ou dos parâmetros da Aplicação da Metodologia de BDI, ou alteração do BDI Apurado, salvo quando a natureza da variação estiver documentalmente confirmada ou explicitamente declarada por uma Transformação Orçamentária |

Diferença de preço, desconto comercial, diferença de arredondamento e divergência documental permanecem conceitos distintos (Seção B/F).

| Dados disponíveis | O BDOS pode afirmar | O BDOS não pode afirmar |
|---|---|---|
| Preço e custo direto completo, mesma data-base e escopo | Diferença entre preço e custo direto, com base explicitada | Lucro realizado ou componentes de uma Aplicação da Metodologia de BDI |
| Custo, preço e BDI Apurado agregado, sem abertura de componentes | Aplicar ou conferir o percentual/fator agregado, se a base estiver confirmada; verificar a reconciliação do resultado agregado; registrar a ausência de abertura | Reconstruir a Metodologia de BDI; afirmar quais componentes produziram o resultado; explicar alterações internas; presumir a fórmula apenas a partir do percentual final |
| Versão da Metodologia de BDI completa, com parâmetros de Aplicação incompletos | A estrutura da metodologia | O resultado numérico da Aplicação |
| Composição completa e Aplicação da Metodologia de BDI completa, compatíveis em escopo e data-base | Efeitos simulados nos componentes declarados | Resultado real da obra |
| Preço e custo direto parcial, com lacunas registradas | O que está confirmado, explicitando a lacuna | Qualquer conclusão sobre a parte não confirmada |
| Preço e custo pertencentes a datas-base ou escopos diferentes | Nada sobre a diferença entre eles | Margem coerente — dados incompatíveis, mesmo existindo |
| Dados realizados de execução, operação ou contabilidade | A existência, cobertura, período, escopo, completude aparente e compatibilidade dos dados disponíveis; e se esses dados estão potencialmente aptos a uma análise futura, conforme critérios de apropriação e tratamento conhecidos | Resultado econômico realizado, margem realizada, lucro da obra, lucro contábil ou causalidade entre eventos, pois a propriedade conceitual e as regras de apuração desses resultados permanecem fora deste ADR |

A disponibilidade ou qualidade dos dados não altera essa fronteira.

---

## M. Rastreabilidade e memória de cálculo

Todo cálculo futuro deve ser capaz de explicar: qual foi a pergunta; quais entradas foram utilizadas; de onde vieram; quais versões foram usadas (Versão do Orçamento, Versão da Composição de Custos, Versão da Metodologia de BDI, Aplicação correspondente); qual BDI Apurado resultou, quando aplicável; quais regras foram aplicadas; quais arredondamentos ocorreram; quais premissas estavam confirmadas; quais eram propostas; quais lacunas permaneceram; e qual foi o resultado.

As obrigações a seguir são **qualificadas, não universais**: quem autorizou, **quando houver Autorização da Transformação**; qual Decisão Interna sobre a Versão foi registrada, **quando aplicável**; qual versão resultante foi produzida, **quando o cálculo produzir uma versão**; qual Simulação Orçamentária foi preservada, **quando o cálculo for apenas simulação**. Nem todo cálculo exige autorização ou produz uma nova Versão do Orçamento.

**A inteligência artificial apenas narra essa memória de cálculo. Ela não é a origem do cálculo** — mesmo princípio já registrado no `BDOS_VISION.md` §13: "O BDOS decide. O LLM explica."

---

## N. Reprodução histórica e reclassificação temporal

A reprodução de um resultado exige **reprodução determinística do resultado econômico e da memória de cálculo**, utilizando: as mesmas entradas; as mesmas fontes e versões; a mesma Versão da Metodologia de BDI e a mesma Aplicação, reproduzindo o mesmo BDI Apurado; as mesmas regras; os mesmos parâmetros; os mesmos critérios de arredondamento; e todas as demais dimensões causalmente necessárias àquele registro específico (moeda, localidade, data-base, unidade, período, escala, base de incidência, escopo, condições comerciais — quando aplicáveis, Seção F). Uma eventual garantia de resultado binário ou de serialização idêntica ("byte a byte") não é exigida por este ADR.

**Reclassificação temporal**: uma mudança posterior na classificação econômica de um componente, ou uma revisão de Metodologia de BDI, **nunca altera silenciosamente uma versão consolidada existente** — produz uma nova Versão da Composição de Custos, uma nova Versão da Metodologia de BDI, ou outra versão economicamente aplicável, mantendo Relação de Rastreabilidade com o contexto anterior. A reprodução histórica sempre utiliza a classificação vigente no momento original.

---

## O. Isolamento entre organizações usuárias

**Todo registro, documento, referência, cotação, composição, produtividade, custo ou premissa incorporado ao ambiente de uma organização usuária permanece isolado naquele ambiente, independentemente de a informação ter sido produzida pela própria organização, por órgão público ou por terceiro.** A autoria da fonte permanece identificada (Seção F) e não altera o isolamento.

**Qualquer utilização futura de informações entre organizações usuárias dependerá de decisão arquitetural, jurídica e de governança específica, ainda não definida neste ADR** — confirmado na documentação: `BDOS_VISION.md:282-290` trata isso como horizonte de longo prazo, não como regra vigente. Parte Envolvida não substitui organização usuária no isolamento dos dados.

---

## P. Fronteiras e riscos arquiteturais conhecidos

Registrados, sem tentativa de resolução nesta Sprint:

- Item de Serviço, Item Contratado e `ManagedServiceItem` não são intercambiáveis; a relação semântica exata entre eles permanece aberta para reconciliação arquitetural futura.
- Contrato de Engenharia (`engineering-contract`) e `Contract` (`contract-management`) ainda não estão reconciliados no código.
- O `contractId` de `ManagedServiceItem` não pode ser presumido como identidade do Contrato de Engenharia.
- Estruturas de reconhecimento de receita (`revenue-recognition`) já consomem preço e quantidade no formato de `ManagedServiceItem` — isso não comprova que o domínio financeiro produza os preços originais.
- O Motor de Execução (Execution Engine) está em produção (`domain/execution-management`, Epic 16.1-16.8).
- O Studio de Finanças permanece planejado.
- **A propriedade conceitual sobre resultado econômico realizado, margem realizada, lucro da obra e lucro contábil será definida em Sprint própria** — não atribuída, por este ADR, genericamente a "Finanças" ou a "Execução".
- A fronteira definitiva entre Engenharia de Custos, Finanças, Execução e Medição depende dessa mesma Sprint própria.

---

## Q. Consequências

**Positivas**: uma futura Sprint de modelagem de tipos parte de vocabulário estável, com fronteiras já testadas contra múltiplas rodadas de revisão; o BDOS pode narrar formação de preço, custo e BDI de forma defensável em auditoria de tribunal de contas, sem confundir Metodologia, Versão da Metodologia, Aplicação e BDI Apurado; a separação entre esses quatro conceitos evita recriar uma nova Metodologia a cada pequena alteração de parâmetro; a regra de não duplicidade elimina uma classe inteira de erro econômico antes mesmo da implementação.

**Custos e riscos aceitos**: o vocabulário é deliberadamente mais rico (cinco camadas econômicas, dois eixos de proveniência, dois escopos, três categorias de fonte, os quatro conceitos relacionados ao BDI) — exige disciplina de implementação e de comunicação de produto; duas colisões arquiteturais (`ManagedServiceItem`; par de "contrato") permanecem sem solução e precisarão de Sprints próprias antes que qualquer integração entre domínios seja construída; a Matriz de Suficiência, sendo ilustrativa e não exaustiva, exige julgamento na aplicação da regra geradora, não apenas consulta a uma tabela fixa.

---

## R. Alternativas rejeitadas

- **BDI definido como "custos indiretos mais lucro e tributos"** — rejeitado; confunde metodologias e esconde a variabilidade real de onde cada componente é alocado (Seção A/E).
- **BDI tratado como um único conceito, sem separar Metodologia, Versão da Metodologia, Aplicação e BDI Apurado** — rejeitado; misturar os níveis produz afirmações economicamente incorretas (por exemplo, tratar um percentual final agregado como se explicasse seus componentes internos) — corrigido na Seção E.
- **Fórmula única e universal de BDI adotada pelo BDOS** — rejeitado; cada Metodologia declara seus próprios componentes, ordem e bases (Seção E).
- **Três categorias fixas e fechadas de insumo (mão de obra/materiais/equipamentos)** — rejeitado; a lista permanece aberta a categorias previstas pela fonte (Seção C).
- **"Contratual" como um modo de obtenção do preço, equivalente a "documentado"/"informado"/"calculado"/"transformado"** — rejeitado; contexto contratual e modo de obtenção são eixos distintos (Seção D/I).
- **Exceção à regra de não duplicidade mediante justificativa** — rejeitado; a regra é absoluta, com divisão não sobreposta como única forma permitida de segmentar um componente (Seção C/E).
- **Duas categorias de fonte (oficial/interna)** — rejeitado; fontes externas técnicas ou comerciais não são nem oficiais nem internas (Seção F).
- **Lista fixa e universal de dimensões obrigatórias (unidade, moeda, localidade, data-base) para todo registro econômico** — rejeitado; adotada a regra de dimensões "causalmente necessárias", específicas a cada registro (Seção F/N).
- **"Reprodução byte a byte" como exigência normativa** — rejeitado; adotada "reprodução determinística do resultado econômico e da memória de cálculo" (Seção N).
- **Distribuição automática de desconto comercial da Versão para as Linhas do Orçamento** — rejeitado; o Preço Total Bruto da Linha permanece preservado até que uma estratégia explícita de distribuição seja declarada (Seção B).
- **Presumir que `Composição` (ADR-001) e `Versão da Composição de Custos` são o mesmo conceito, sem verificação** — rejeitado; a relação foi explicada via a tensão `sourceCode`/identidade (Seção G), não presumida.
- **Atribuir resultado econômico realizado e lucro contábil genericamente a "Finanças/Execução"** — rejeitado; a propriedade conceitual desses resultados é reservada a uma Sprint própria (Seção P).
- **Aplicabilidade da Composição de Custos tratada como "combinação" indiferenciada de relações** — rejeitado; adotadas três relações distintas e coexistentes (relação de aplicabilidade, relação econômica, Relação de Rastreabilidade), nunca intercambiáveis entre si (Seção C).

---

## S. Fora do escopo

Proibidos nesta Sprint: implementação de código de produção; tipos; classes; banco de dados; migrações; políticas de segurança; repositório; API; interface; teste; arquivo de exemplo; importador; leitor de PDF ou planilha; motor de cálculo; fórmula-padrão; percentual-padrão; Metodologia de BDI padrão da plataforma; metodologia nomeada usada como preferência implícita; exemplo editorial que se transforme em padrão por inércia; regime tributário presumido; encargos sociais presumidos; produtividade presumida; composição reconstruída silenciosamente; definição de arquitetura física; modelagem de aditivos contratuais; reconciliação com `ManagedServiceItem`; reconciliação entre os dois conceitos de contrato; apuração de resultado econômico realizado; apuração de lucro contábil; criação de ramificação; commit.

---

## T. Critérios de aceite conceitual

Este ADR só é considerado apto para gravação quando:

1. não contrariar o ADR-001, o ADR-002 ou o ADR-003;
2. separar claramente custo, preço, margem, lucro e BDI;
3. impedir que a mesma parcela econômica seja incluída simultaneamente na composição de custos e nos componentes ou parâmetros da Aplicação da Metodologia de BDI, e impedir que o BDI Apurado seja acrescentado novamente ao preço como parcela econômica independente;
4. permitir Linha do Orçamento sem composição de custos;
5. definir Composição de Referência e Versão da Composição de Custos, com a tensão `sourceCode`/identidade explicada;
6. usar três categorias de fontes, classificadas por autoria;
7. preservar as dimensões causalmente necessárias a cada registro econômico, sem lista universal obrigatória;
8. distinguir dado confirmado, premissa proposta e lacuna documental, com validação humana obrigatória nos pontos de incerteza;
9. definir Metodologia de BDI, Versão da Metodologia de BDI, Aplicação da Metodologia de BDI e BDI Apurado como quatro conceitos relacionados e não intercambiáveis, com serviços e materiais podendo divergir entre eles, sem universalizar sua aplicação;
10. incluir a Regra e a Matriz de Suficiência de Dados, ilustrativa e não exaustiva, incluindo o caso de BDI Apurado agregado sem abertura e a fronteira de dados realizados;
11. impedir afirmações indevidas sobre margem, lucro, custo e qualquer um dos quatro conceitos relacionados ao BDI a partir de uma redução de preço;
12. assegurar Relação de Rastreabilidade completa, distinguindo rastreabilidade confirmada de correspondência inferida, e distinguindo relação de aplicabilidade, relação econômica e Relação de Rastreabilidade na composição de custos;
13. permitir comparação entre Simulações Orçamentárias sem criar fatos econômicos novos;
14. assegurar reprodução histórica determinística e reclassificação temporal sem alteração silenciosa;
15. preservar o isolamento entre organizações usuárias, sem presumir regras de benchmark ainda não aprovadas;
16. registrar, sem resolver, as duas colisões arquiteturais conhecidas, sem atribuir resultado realizado/lucro contábil genericamente a Finanças ou Execução;
17. permanecer integralmente conceitual;
18. não antecipar tipos, banco de dados, API, interface ou motor de cálculo.

---

## Estado final

**Status**: Aprovado. Composição de custos e os conceitos relacionados ao BDI (Metodologia, Versão da Metodologia, Aplicação, BDI Apurado) estão conceitualmente definidos e reconciliados com o ADR-001, o ADR-002 e o ADR-003. As duas colisões arquiteturais conhecidas (`ManagedServiceItem`; par de "contrato") permanecem registradas, não resolvidas. Nenhuma implementação foi realizada. Nenhum tipo, banco de dados, migração, interface, API ou motor de cálculo foi criado por este ADR.
