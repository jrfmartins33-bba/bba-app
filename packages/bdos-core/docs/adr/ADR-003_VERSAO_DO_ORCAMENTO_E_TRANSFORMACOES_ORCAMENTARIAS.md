# ADR-003 — Versão do Orçamento e Transformações Orçamentárias

- **Status**: Aprovado
- **Data da decisão**: 2026-07-13
- **Epic**: 21 — Engenharia de Custos e Licitações
- **Sprint**: 21.2B — Contrato Conceitual da Versão do Orçamento e das Transformações Orçamentárias
- **Decisão principal**: toda transformação autorizada parte de uma versão consolidada, utiliza uma simulação imutável e produz uma única nova Versão do Orçamento consolidada e rastreável

Este ADR documenta a decisão arquitetural aprovada para a Sprint 21.2B do Epic 21 ("Engenharia de Custos e Licitações"), com base no ADR-001 (identidade e rastreabilidade de itens orçamentários e documentos de licitação) e no ADR-002 (limite do Processo de Licitação e Contratação). É exclusivamente conceitual e arquitetural — nenhum tipo de código, schema, repository, API, UI, teste, migration, RLS ou seed foi criado ou é criado por esta gravação. É autossuficiente.

---

## A. Definição da Versão do Orçamento

A Versão do Orçamento representa um retrato econômico de um orçamento — o conjunto de linhas, quantidades, preços e valores totais — preservado em um momento específico, dentro de um Processo de Licitação e Contratação. Possui identidade própria porque o mesmo processo produz, ao longo do tempo, vários retratos econômicos distintos (o orçamento oficial do edital, uma análise interna, um cenário de redução, uma proposta), e cada um precisa ser localizável, comparável e auditável separadamente, sem que um apague o outro.

Não é apenas uma planilha, porque uma planilha é um arquivo — a Versão do Orçamento é o conteúdo econômico interpretado e estruturado a partir de uma ou mais fontes, com autoria, origem e regras de preservação próprias, independentes de qualquer arquivo específico que a tenha sustentado.

Representa um retrato preservado porque, uma vez consolidada, uma Versão do Orçamento não muda — qualquer novo cálculo, correção ou cenário gera uma nova versão, nunca uma alteração direta da mesma versão.

**Relação com o Processo de Licitação e Contratação**: toda Versão do Orçamento pertence a exatamente um processo.

**Relação com o Escopo da Licitação**: uma Versão do Orçamento pode se referir ao processo inteiro, a um lote específico, ou a um conjunto de lotes (Seção L).

**Diferença em relação à Base Contratual da Obra**: a Base Contratual da Obra tem autoridade documental própria, ligada ao contrato assinado — nunca é criada automaticamente a partir de uma Versão do Orçamento, mesmo quando os valores coincidem.

**Diferença em relação a um rascunho ainda em elaboração**: um rascunho é uma Versão do Orçamento em condição de edição aberta (Seção B/D), que pode estar incompleta e conter alertas e bloqueios (Seção N).

---

## B. Informações próprias e registros relacionados

Uma Versão do Orçamento é descrita por duas camadas distintas: as **informações próprias** da versão, e os **registros relacionados**, que são fatos separados, apenas referenciados por ela.

### Informações próprias da Versão do Orçamento

- identidade;
- organização usuária;
- Processo de Licitação e Contratação;
- Escopo da Licitação;
- **finalidade econômica** — o papel que este retrato representa: orçamento oficial; orçamento interno; cenário de estudo; cenário para decisão; proposta comercial; referência para preparação contratual. "Proposta submetida", "proposta aceita" e "versão substituída" nunca são finalidades econômicas — são fatos registrados em registros relacionados, não o papel econômico da versão;
- **condição de edição** — rascunho ou consolidada (Seção D);
- origem econômica (Seção K);
- caminho de criação (Seção C);
- data de criação;
- data de consolidação, quando aplicável;
- responsável pela criação;
- evidências de origem.

### Registros relacionados

Fatos e decisões que não são armazenados dentro da Versão do Orçamento como coleções ilimitadas, mas sim como registros próprios:

- Decisão Interna sobre a Versão (Seção D/M);
- Submissão, Retirada, Substituição no Processo, Diligência (Seção M);
- Decisão da Licitação (conceito do ADR-002, apenas referenciado);
- Transformação Orçamentária, com sua Simulação Orçamentária, sua Autorização e sua Execução (Seção G);
- Relação de Rastreabilidade (Seção E/G/O);
- Avaliação de Correspondência (Seção O).

**Direção da associação**: cada um desses registros identifica a Versão do Orçamento a que pertence — nunca o contrário. A versão não incorpora listas de decisões, submissões, diligências, simulações ou transformações; esses registros são localizados por consulta, a partir da identidade da versão, não armazenados dentro dela. Uma **Visão Consolidada** pode reunir essas informações para apresentar ao usuário uma situação atual (por exemplo, "aprovada e submetida no lote 2"), mas essa visão nunca se torna a fonte oficial dos fatos — ela é sempre reconstruível a partir dos registros próprios, que continuam sendo a única autoridade sobre o que de fato ocorreu.

---

## C. Três caminhos de criação

### Criada a partir de documentos
```
Versão do Documento → classificação → extração → validação → Versão do Orçamento reconhecida
```
É sustentada por uma ou mais Versões do Documento. A confirmação de que os dados foram extraídos corretamente é um passo de validação distinto da extração em si. Lacunas e ambiguidades permanecem explicitamente sinalizadas. O documento original nunca é apagado nem substituído — continua existindo como Versão do Documento própria, apenas referenciada.

### Criada diretamente no BDOS
Um orçamento construído ou editado pelo usuário dentro da plataforma produz uma Versão do Orçamento **sem exigir nenhuma Versão do Documento de origem**. Deve ser possível identificar: quem criou; o responsável; a data; a origem dos preços informados; a origem das quantidades; e quaisquer evidências ou referências usadas como apoio.

### Criada por transformação
```
Versão do Orçamento existente → Transformação Orçamentária → nova Versão do Orçamento
```
A versão anterior é sempre preservada. A nova versão mantém uma Relação de Rastreabilidade explícita com a origem, produzida diretamente pela própria Transformação Orçamentária (Seção O). O ciclo completo — preparação, simulação, autorização, congelamento e execução — está detalhado na Seção G.

---

## D. Identidade e imutabilidade

Atributos conceituais de toda Versão do Orçamento: os listados como informações próprias na Seção B.

### Rascunho editável
Pode receber alterações; pode estar incompleto; pode conter bloqueios e alertas (Seção N); nunca deve ser tratado como retrato oficial.

### Versão consolidada
Representa um retrato econômico fechado; não pode sofrer alteração direta da mesma versão; qualquer alteração posterior cria uma nova versão; preserva data, responsável e evidências do momento da consolidação.

### Nova versão derivada
Nasce da versão anterior por transformação; preserva a origem; registra a transformação aplicada (Seção G); nunca modifica a versão de origem.

**Uma versão em condição de edição aberta (rascunho) nunca pode receber uma Decisão Interna sobre a Versão.** Essa decisão é tratada como um registro próprio, separado (Seção M), nunca um campo mutável da própria versão.

---

## E. Estrutura da Linha do Orçamento

### Linha encontrada na fonte versus Linha do Orçamento reconhecida

Uma fonte pode conter linhas de naturezas muito diferentes: Grupo; Subgrupo; Item de Serviço; subtotal; total; cabeçalho; observação; percentual; linha auxiliar.

A **Linha do Orçamento reconhecida** possui **somente três tipos possíveis**: Grupo, Subgrupo ou Item de Serviço — e nada além disso. Ela não carrega indicação de linha informativa, de subtotal, de total, de cabeçalho, nem de linha auxiliar como atributo próprio; essas classificações pertencem exclusivamente à linha encontrada na fonte, ou à evidência documental que a acompanha.

Um item sem código hierárquico (o caso real `COT-015`) continua sendo um Item de Serviço comum; a ausência de código nunca é um quarto tipo, nem justifica descarte.

Subtotais e totais declarados pela fonte permanecem preservados como evidência para conferência, mas não são Linhas do Orçamento econômicas e não entram novamente na soma (Seção F).

### Atributos conceituais da Linha do Orçamento

Sem aprovação de nomes de campo: identidade interna; código hierárquico, quando existir; código da fonte; descrição; unidade; quantidade; preço unitário; valor total; posição e ordenação; linha superior; origem; observações; situação de validação; Escopo da Licitação, quando aplicável.

**Código nunca é identidade universal.**

### Identidade das linhas entre versões

Cada Linha do Orçamento pertence a exatamente uma Versão do Orçamento. Uma nova versão sempre recebe **novas identidades de linha** — nenhuma identidade de linha é reutilizada entre versões, mesmo quando o conteúdo é idêntico.

Correspondências entre linhas de versões diferentes são registradas por Relações de Rastreabilidade — que podem nascer diretamente de uma Transformação Orçamentária conhecida (correspondência confirmada) ou de uma Avaliação de Correspondência inferida entre versões independentes (Seção O). Uma linha pode corresponder a nenhuma, uma, ou várias linhas da outra versão. **Comparação ou derivação nunca funde identidades.**

---

## F. Hierarquia, totalização e desconto comercial

Grupos e subgrupos organizam a estrutura; itens de serviço carregam os valores econômicos.

### Coerência econômica por tipo de linha

**Item de Serviço**: quando quantidade e preço unitário forem aplicáveis, vale a relação **quantidade × preço unitário = valor bruto calculado**. A partir desse valor bruto, quando houver desconto comercial explícito, permitido pelo processo:

```
valor bruto calculado
  − desconto comercial
  = valor líquido resultante
```

Essa segunda relação **não substitui** a primeira — o valor bruto calculado continua sendo sempre o produto de quantidade por preço unitário; o desconto comercial é uma camada adicional, aplicada sobre esse valor bruto, nunca uma alteração dele.

Podem existir, separadamente e sem se confundir entre si: o valor bruto calculado; o desconto comercial aplicado, quando existir; o valor líquido resultante; o valor declarado pela fonte, quando existir; a diferença de arredondamento (Seção I); e a divergência de conferência documental (entre valor declarado e valor calculado), quando existir. O desconto comercial nunca altera silenciosamente a quantidade nem o preço unitário; nunca é confundido com diferença de arredondamento; nunca é confundido com divergência entre valor declarado e calculado; possui regra, responsável, justificativa e Escopo da Licitação identificáveis; e somente pode ser utilizado quando permitido pelas regras e documentos do próprio processo.

A fórmula definitiva de distribuição do desconto comercial não é definida nesta etapa, nem se ele será registrado por item, por grupo, por lote, ou pelo processo inteiro — essa decisão permanece pendente, respeitando sempre o Escopo da Licitação (Seção T).

**Grupo e Subgrupo**: seu valor é sempre calculado pela soma dos itens descendentes — nunca possuem valor econômico próprio concorrente com os itens que os compõem. Um subtotal declarado pela fonte é evidência para conferência, não é valor adicional a ser somado.

### Evitar dupla contagem

A totalização soma apenas as linhas classificadas como Item de Serviço — nunca itens e, simultaneamente, os subtotais/totais que já os agregam. Qualquer divergência entre o subtotal declarado e o subtotal calculado permanece visível, nunca escondida ou substituída silenciosamente. Nenhum total pode ser alterado isoladamente de forma a criar uma conta inconsistente.

---

## G. Transformação Orçamentária, Simulação Orçamentária e Execução

### Transformação Orçamentária

A **Transformação Orçamentária** é um registro relacionado próprio, com identidade e histórico, que documenta a passagem de uma Versão do Orçamento para outra.

Ciclo conceitual (sem constituir lista definitiva de banco de dados): em preparação; com simulações calculadas; aguardando autorização; autorizada; em processamento; concluída; cancelada. A falha de processamento é tratada separadamente, como ocorrência técnica, nunca como uma dessas situações de negócio.

### Origem imutável da transformação

Uma simulação pode ser calculada sobre um rascunho apenas para fins de estudo — mas **uma simulação baseada em rascunho nunca pode ser autorizada para execução**. A autorização e a execução de uma Transformação Orçamentária exigem, sempre, uma Versão do Orçamento de origem **consolidada e imutável** — a transformação aponta exatamente para essa versão consolidada, nunca para um rascunho.

**Regra inviolável: nenhuma transformação autorizada pode depender de uma versão de origem que ainda possa ser alterada.**

### Simulação calculada sobre rascunho e revisão do conteúdo utilizada

Quando uma Simulação Orçamentária é calculada sobre um rascunho (apenas para fins de estudo, nunca para autorização), ela deve registrar exatamente o conteúdo usado no cálculo, por meio de uma **referência conceitual à revisão do rascunho**. Essa referência permite identificar: o rascunho utilizado; a revisão do conteúdo efetivamente usada no cálculo; a data do cálculo; se o rascunho foi modificado posteriormente; e se a simulação permanece atual ou foi marcada como desatualizada.

Nenhum formato de banco de dados é definido para essa referência nesta etapa, e nenhuma escolha é feita entre número de revisão, assinatura criptográfica de conteúdo, ou outro mecanismo técnico — registra-se apenas a necessidade conceitual de identificar inequivocamente o conteúdo do rascunho usado em cada simulação.

**Regra inviolável: uma simulação calculada sobre um rascunho identifica exatamente a revisão do conteúdo utilizada; qualquer mudança posterior no rascunho torna a simulação desatualizada.**

### Simulação Orçamentária e sua imutabilidade

A **Simulação Orçamentária** é, ela própria, um registro do domínio, relacionado à Transformação Orçamentária que a originou. Preserva: identidade; versão de origem (consolidada, ou rascunho com sua revisão identificada, quando calculada apenas para estudo); parâmetros utilizados (percentual; valor final desejado; valor-alvo; estratégia; grupos elegíveis; lotes elegíveis; itens elegíveis; exclusões; regra de distribuição; política de precisão; política de arredondamento; tratamento da diferença residual); resultado total; impactos por grupo, por lote e por item, quando necessário; diferença residual; alertas; bloqueios; data; responsável pelo cálculo; situação da simulação; e indicação de qual simulação foi escolhida.

**Cada Simulação Orçamentária preservada é um retrato imutável.** Depois de calculada, nenhum dos elementos acima pode ser alterado na mesma simulação — qualquer alteração exige uma **nova** Simulação Orçamentária, com identidade própria. Simulações diferentes podem ser comparadas entre si. A simulação escolhida para autorização permanece imutável e claramente identificada.

Uma simulação: nunca altera a versão de origem; não é uma Versão do Orçamento; pode ser descartada; pode ser preservada; pode ser comparada; pode ser escolhida para autorização; nunca produz, por si só, uma versão resultante sem que sua aplicação seja autorizada.

### Autorização da Transformação

A **Autorização da Transformação** representa a decisão de executar a Simulação Orçamentária escolhida. É um conceito distinto da **Decisão Interna sobre a Versão** resultante (Seção M) — autorizar a transformação e decidir internamente sobre a versão que ela produzirá são fatos diferentes, cada um com seu próprio registro.

A Autorização da Transformação congela: a versão de origem consolidada; a simulação escolhida; os parâmetros; a estratégia; a elegibilidade de grupos, lotes e itens; as exclusões; a regra de distribuição; a política de precisão; a política de arredondamento; o tratamento da diferença residual; o responsável; e a data.

**A versão resultante não fica automaticamente aprovada internamente apenas porque sua transformação foi autorizada.**

### Execução da Transformação Autorizada

A operação **Executar Transformação Autorizada** substitui qualquer ideia de "criar a versão resultante" como comando independente — a criação da versão resultante é sempre uma consequência direta desta execução.

Esta operação: utiliza somente os parâmetros congelados na autorização; cria ou retorna a única Versão do Orçamento resultante; produz uma versão já consolidada e imutável; cria novas identidades para todas as suas linhas; registra as Relações de Rastreabilidade correspondentes; referencia a simulação autorizada; **não** aprova internamente a versão resultante; **não** registra submissão; **não** cria Base Contratual da Obra.

Inclui-se conceitualmente um **identificador único da execução autorizada** (sem definição de formato técnico nesta etapa), que garante a idempotência: **uma repetição da mesma execução autorizada deve localizar ou retornar a mesma versão resultante — nunca criar outra silenciosamente.**

### Reprodução do resultado

A Transformação e a Simulação preservam, quando aplicável: a versão da regra de cálculo utilizada; a versão da política de precisão; a versão da política de arredondamento; referências de preços; a data-base; os índices utilizados; as tabelas utilizadas; os parâmetros originais; a Versão do Orçamento de origem; a Simulação Orçamentária escolhida; e a identificação da execução autorizada.

**A reprodução futura de um resultado utiliza as regras e referências vigentes no momento em que a transformação foi executada — nunca as regras atualmente configuradas no sistema.**

### Cancelamento e falha técnica

**Transformação cancelada**: decisão de negócio, que preserva o responsável, a data, a justificativa, e a etapa do ciclo em que ocorreu.

**Falha de processamento**: ocorrência técnica, que preserva a etapa, o momento, a mensagem técnica, a possibilidade de nova tentativa, e a identificação da execução.

Uma falha de processamento: **não** cancela automaticamente a transformação; **não** libera a alteração dos parâmetros já autorizados; **não** permite gerar outra versão resultante; pode ser seguida por uma nova tentativa da mesma execução autorizada.

---

## H. Redução percentual ou valor final definidos pelo usuário

O percentual de redução (ou o valor final desejado) é sempre informado pelo usuário — nunca fixo, nunca presumido pelo sistema. Percentuais inteiros ou com casas decimais (5%; 14%; 22,5%; 7,35%; 0,5%, entre infinitos outros) devem ser conceitualmente aceitos, sem que os exemplos citados constituam lista de valores permitidos. A quantidade máxima de casas decimais e os limites válidos permanecem decisão pendente.

O caminho inverso também é suportado: dado um valor original e um valor final desejado, o BDOS calcula e apresenta o percentual equivalente.

### Valor final menor, igual ou maior

Valor final menor que o original: redução. Valor final igual: nenhuma variação. Valor final maior: aumento ou revisão. Um valor final maior só é bloqueio quando a operação escolhida for especificamente uma redução — em qualquer outra transformação, um aumento pode ser válido e deve ser classificado corretamente.

O sistema sempre apresenta: valor original; valor final desejado; diferença monetária; variação percentual; e a natureza da transformação (redução, sem alteração, ou aumento).

### Estratégias disponíveis agora e estratégias futuras

Apresentadas como executáveis apenas as estratégias sustentadas pelos dados já disponíveis: reduzir preços unitários proporcionalmente; ajustar grupos selecionados; ajustar lotes selecionados; ajustar itens selecionados; aplicar desconto comercial explícito, quando permitido pelo processo (Seção F); distribuir um valor-alvo segundo regra aprovada.

Não apresentadas como opção executável atual: preservar custos e reduzir margem; reduzir lucro; revisar custos diretos; revisar custos indiretos; alterar componentes do BDI; recalcular BDI.

Nenhuma estratégia é escolhida silenciosamente pelo sistema.

### Recomendação de experiência do usuário

A interação começa perguntando "Como você deseja definir o valor da proposta?", seguida de "Como você deseja alcançar essa redução?", em linguagem acessível. O BDOS apresenta cenários e impactos (via Simulação Orçamentária) antes de qualquer autorização. Nenhuma transformação é autorizada sem escolha explícita do usuário.

---

## I. Precisão, arredondamento e diferença residual

Ao aplicar um percentual (ou um valor-alvo) linha a linha, a soma final normalmente diverge do valor-alvo matemático por centavos ou reais.

Alternativas avaliadas, nenhuma escolhida: aceitar a diferença e apresentá-la claramente; distribuir o resíduo entre itens elegíveis; ajustar uma linha definida pelo usuário; ajustar o último item elegível; trabalhar com precisão interna maior e arredondar somente na apresentação; impedir a consolidação até uma decisão humana; permitir que a organização usuária escolha, previamente, uma política já aprovada.

A política de precisão e a política de arredondamento aplicadas são preservadas com sua própria versão (Seção G), garantindo que uma reprodução futura use exatamente a regra vigente no momento da transformação. Nenhuma diferença é ocultada; nenhum valor é ajustado silenciosamente; o resultado é reproduzível.

A diferença de arredondamento é conceitualmente distinta do desconto comercial (Seção F) e da diferença entre valor calculado e valor declarado pela fonte — as três nunca se confundem.

A regra matemática definitiva de arredondamento e os limites de tolerância permanecem decisão pendente.

---

## J. Custos, preços, margem e BDI

Conceitos distintos: custo direto; custo indireto; preço de venda; margem; lucro; tributos; BDI; preço unitário apresentado na proposta; valor total do item; valor total da proposta.

Uma redução percentual no preço da proposta não significa automaticamente a mesma redução no custo direto, no custo indireto, no BDI, na margem, no lucro, em cada linha, grupo ou lote — depende exclusivamente da estratégia escolhida.

**O BDOS não afirma impacto em custo, margem, lucro ou BDI sem possuir os componentes necessários para demonstrá-lo** — hoje, o domínio de composição de custos ainda inexistente na plataforma impede qualquer cálculo ou afirmação desse tipo. Até que essa composição exista, qualquer transformação que mexa apenas no preço de venda é descrita como isso mesmo — alteração de preço — nunca como alteração de margem, lucro, custo ou BDI.

Decisões reservadas para uma Sprint própria: composição de custos; produtividade; encargos; tributos; riscos; administração central; lucro; cálculo de BDI; limites legais ou documentais aplicáveis ao BDI.

---

## K. Autoria e origem econômica

Toda Versão do Orçamento deve permitir identificar, quando disponível: quem produziu; quem apresentou; para qual organização usuária; qual Parte Envolvida; qual Papel da Parte no Processo; qual dos três caminhos de criação a originou; qual versão anterior a originou; quais Versões do Documento a sustentam; e, através dos registros relacionados, quem tomou a Decisão Interna sobre a versão, quem autorizou a transformação, quem escolheu a estratégia de redução e quem executou a transformação autorizada.

Quando a fonte não permitir identificar a autoria, a ambiguidade permanece explicitamente sinalizada — o sistema nunca inventa autor, apresentante, responsável, decisor, Parte Envolvida ou origem econômica.

---

## L. Escopo da Licitação

Uma Versão do Orçamento pode abranger o processo inteiro, um lote, ou vários lotes — nunca limitada a um único identificador de lote opcional.

Modelos avaliados, sem escolha definitiva: uma versão global com linhas separadas por lote; versões independentes por lote; uma proposta que reúne vários lotes; lotes com percentuais de redução diferentes; lotes com valores-alvo diferentes; lotes excluídos de uma transformação; lotes parcialmente incluídos; versão parcialmente submetida; proposta submetida apenas para alguns lotes; transformação global com exceções por lote.

Um percentual informado para o processo inteiro nunca é aplicado automaticamente da mesma forma a todos os lotes sem confirmação explícita do usuário. Quando um valor final desejado abranger vários lotes, o sistema indica explicitamente como esse valor será distribuído entre eles.

---

## M. Registros de Utilização no Processo e Decisão da Licitação

### Decisão Interna sobre a Versão

Registro relacionado próprio e imutável. Preserva: organização usuária; a Versão do Orçamento consolidada a que se refere; o Escopo da Licitação; a decisão tomada (aprovada ou rejeitada internamente); o responsável; a data; a justificativa; a evidência, quando existir; e a decisão anterior substituída ou reformada, quando aplicável.

Regras: uma versão editável nunca recebe uma Decisão Interna sobre a Versão; a decisão identifica exatamente o conteúdo consolidado a que se refere; uma nova decisão nunca apaga a anterior — soma-se ao histórico; a situação atual é apresentada por uma Visão Consolidada, sem substituir os registros oficiais. Na interface, quando o resultado da decisão for positivo, pode ser usada a expressão "Aprovação interna registrada" como rótulo de apresentação, sem que isso mude o nome do conceito arquitetural.

### Rastreabilidade econômica versus Substituição no Processo

**Relação de Rastreabilidade**: explica origem, derivação e transformação econômica entre versões e linhas.

**Registro de Substituição no Processo**: explica que uma versão, formalmente apresentada ao processo de licitação, substituiu outra. Preserva: versão anterior; nova versão; Escopo da Licitação; protocolo; data; Parte Envolvida apresentante; evidência; justificativa, quando disponível.

Uma versão pode derivar de outra sem substituí-la formalmente no processo. Uma versão pode também substituir outra no processo e possuir uma Relação de Rastreabilidade com ela — são dois fatos diferentes, cada um com seu próprio registro.

### Submissão, Retirada e Diligência

Cada um desses fatos é um registro próprio, nunca um simples campo mutável da Versão do Orçamento:

- **Submissão**: versão submetida; Escopo da Licitação da submissão; data; protocolo; Parte Envolvida apresentante; evidência documental; eventual versão que essa submissão substitui.
- **Retirada**: mesma estrutura de registro próprio, com data, responsável e justificativa.
- **Diligência**: versão afetada; escopo afetado; itens ou linhas afetados; documento de solicitação; prazo; versão resultante, quando já existir.

### Decisão da Licitação

Aceitação, rejeição, desclassificação, adjudicação e homologação pertencem à Decisão da Licitação (conceito do ADR-002) — nunca são atributos próprios da Versão do Orçamento.

### Combinações legítimas

Uma versão consolidada mas ainda sem Decisão Interna; uma versão com Decisão Interna favorável mas ainda não submetida; uma versão submetida e posteriormente substituída; uma versão relacionada a uma Decisão da Licitação de aceitação, mas ainda não utilizada como Base Contratual da Obra.

---

## N. Validações, bloqueios e alertas

### Bloqueios
Total inconsistente; quantidade inválida; preço obrigatório ausente; linha duplicada não resolvida; organização usuária incompatível; Escopo da Licitação inválido; transformação sem versão de origem consolidada; sem responsável; sem parâmetros registrados; tentativa de autorizar uma transformação baseada em rascunho ou em simulação marcada como desatualizada; percentual informado inválido segundo regras futuras; valor final desejado incompatível com o valor original quando a operação for especificamente uma redução; origem econômica desconhecida quando deveria estar disponível; estratégia de redução não escolhida; diferença residual sem tratamento aprovado; tentativa de alteração direta de uma versão consolidada; tentativa de registrar Decisão Interna sobre versão ainda editável; tentativa de executar transformação com parâmetros diferentes dos congelados na autorização; tentativa de aplicar redução a linha não elegível; tentativa de cruzar organizações usuárias; total de Item de Serviço inconsistente com quantidade × preço unitário sem desconto comercial registrado; desconto comercial aplicado sem permissão do processo.

### Alertas
Pequena diferença de arredondamento; código ausente; unidade incomum; preço muito diferente da versão anterior; linha nova; linha removida; autoria documental ainda incompleta; itens excluídos da redução; percentuais diferentes entre grupos; percentuais diferentes entre lotes; margem significativamente reduzida, quando já houver composição de custos disponível; valor-alvo ainda não atingido; diferença entre percentual informado e percentual efetivamente obtido após arredondamento; valor final maior que o original em transformações que não são reduções; simulação marcada como desatualizada após alteração do rascunho de origem; desconto comercial presente sem regra de distribuição ainda definida.

Nenhum limite numérico é aprovado nesta etapa; nem todo alerta se torna bloqueio.

---

## O. Comparação entre versões, rastreabilidade confirmada e correspondência inferida

Quando uma versão é criada por Transformação Orçamentária, a própria transformação conhece exatamente a origem e o destino de cada linha, produzindo diretamente Relações de Rastreabilidade confirmadas. Quando duas versões foram criadas separadamente, a correspondência pode não ser conhecida de antemão — nesse caso, uma Avaliação de Correspondência registra: correspondência confirmada; ausência de correspondência; correspondência ambígua; o Grau de Confiança da Correspondência; e a decisão humana, quando aplicável. Nem toda Relação de Rastreabilidade nasce de uma Avaliação de Correspondência.

A comparação entre versões apresenta: linhas correspondentes; linhas incluídas; linhas removidas; linhas não encontradas; quantidade, preço unitário e valor alterados; impacto total, percentual, por grupo e por lote; margem e BDI alterados, quando realmente disponíveis; valor bruto, desconto comercial e valor líquido, quando aplicável; valor-alvo, valor calculado e diferença residual; Grau de Confiança da Correspondência; estratégia aplicada; itens excluídos.

Simulações também podem ser comparadas entre si, antes de qualquer autorização.

**Comparação nunca significa fusão de identidade.**

---

## P. Comandos conceituais

| Operação | Responsável | Observação |
|---|---|---|
| Criar Versão do Orçamento diretamente no BDOS | A versão | Caminho nativo |
| Reconhecer Versão do Orçamento a partir de Documentos | A versão | Caminho documental |
| Adicionar Linha do Orçamento | A linha | Aplicável apenas a rascunho |
| Alterar Rascunho | A versão, em condição de edição aberta | Nunca aplicável a versão consolidada |
| Consolidar Versão do Orçamento | A versão | Torna o conteúdo imutável |
| Registrar Decisão Interna sobre a Versão | Decisão Interna | Exige versão já consolidada |
| Preparar Transformação Orçamentária | A Transformação Orçamentária | Editável apenas nesta fase |
| Calcular Simulação Orçamentária | A Simulação Orçamentária | Imutável assim que calculada; registra a revisão do rascunho, quando aplicável |
| Escolher Simulação | A Transformação Orçamentária | Seleciona qual simulação segue para autorização |
| Autorizar Transformação | A Transformação Orçamentária | Congela versão de origem consolidada, simulação e parâmetros |
| Executar Transformação Autorizada | A Transformação Orçamentária | Produz a única versão resultante; idempotente por execução |
| Cancelar Transformação | A Transformação Orçamentária | Decisão de negócio, distinta de falha técnica |
| Registrar Submissão / Retirada / Substituição no Processo / Diligência | Registro próprio | Cada um com Escopo da Licitação, data, responsável e evidência |
| Comparar Versões | Consulta | Nunca altera as versões comparadas |
| Comparar Simulações | Consulta | Antes de qualquer autorização |

---

## Q. Eventos conceituais

### Fatos do domínio
Versão do Orçamento Criada; Versão Consolidada; Decisão Interna sobre a Versão Registrada; Transformação Orçamentária Preparada; Simulação Orçamentária Calculada, quando preservada; Simulação Marcada como Desatualizada; Simulação Escolhida; Transformação Autorizada; Parâmetros Congelados; Transformação Executada; Versão Resultante Criada; Transformação Cancelada; Submissão Registrada; Retirada Registrada; Substituição no Processo Registrada; Diligência Registrada.

### Registros técnicos
Falha de Processamento da Transformação; Nova Tentativa de Processamento; Solicitação Repetida Identificada; tentativa inválida de alteração; acesso; detalhes técnicos que não modificam fatos econômicos.

### Mensagens futuras entre domínios
Decisão Interna Comunicada; Proposta Submetida; Versão Relacionada a uma Decisão da Licitação; Base Contratual da Obra Estabelecida.

Nenhum nome técnico final é aprovado. O registro de eventos não se torna a fonte principal dos dados.

---

## R. Consistência, concorrência e desempenho

Cada Versão do Orçamento protege imediatamente suas próprias regras; cada Transformação Orçamentária protege seus próprios parâmetros e sua própria Relação de Rastreabilidade. As linhas de uma versão podem ser numerosas — nenhuma alteração deve exigir carregar todas as Versões do Orçamento do processo de uma só vez.

Transformações longas podem exigir processamento em segundo plano. A execução de uma transformação autorizada é idempotente por meio do identificador único da execução (Seção G): reprocessar a mesma execução localiza ou retorna a mesma versão resultante, nunca cria outra silenciosamente.

Edição concorrente de um rascunho exige controle; uma versão consolidada nunca sofre alteração direta da mesma versão originada de edição anterior à consolidação. Simulações concorrentes não interferem entre si. O percentual e o valor-alvo informados são preservados exatamente como parâmetros de entrada, independentemente da precisão interna dos cálculos.

Comparações avaliadas, sem decisão de implementação: núcleo contendo todas as linhas versus identificação central com linhas separadas; processamento por grupos, por lotes, ou em segundo plano; consolidação por etapas; controle de versão para rascunho; bloqueio otimista; geração da versão resultante somente após autorização explícita. Nenhuma tecnologia ou banco de dados é escolhido nesta etapa.

---

## S. Regras invioláveis

| Regra | Justificativa |
|---|---|
| Cada Versão do Orçamento pertence a exatamente uma organização usuária | Isolamento entre organizações |
| Cada versão pertence a um Processo de Licitação e Contratação | Seção A |
| O Escopo da Licitação é sempre explícito | Seção L |
| Finalidade econômica e condição de edição são informações próprias; decisão interna, utilização e decisão da licitação são registros relacionados, identificados a partir da versão, nunca embutidos nela | Seção B |
| Uma versão em condição de edição aberta nunca recebe Decisão Interna sobre a Versão | Seção D/M |
| Uma nova Decisão Interna nunca apaga a anterior | Seção M |
| A Linha do Orçamento reconhecida possui somente três tipos, sem indicações de subtotal, total, cabeçalho ou linha auxiliar | Seção E |
| Nenhuma identidade de linha é reutilizada entre versões | Seção E |
| Comparação ou derivação nunca funde identidades | Seção E/O |
| Versões consolidadas não são sobrescritas | Seção D |
| Uma transformação autorizada sempre usa uma versão de origem consolidada | Seção G |
| Uma simulação calculada sobre um rascunho identifica exatamente a revisão do conteúdo utilizada; qualquer mudança posterior torna a simulação desatualizada | Seção G |
| Uma simulação preservada nunca é alterada | Seção G |
| Mudança de qualquer parâmetro sempre cria uma nova simulação | Seção G |
| Uma simulação marcada como desatualizada não pode ser autorizada | Seção G |
| A execução usa exatamente a simulação autorizada | Seção G |
| A versão da regra de cálculo utilizada é preservada | Seção G |
| A versão resultante só pode ser criada pela execução da transformação autorizada | Seção G |
| Uma execução autorizada produz no máximo uma versão resultante | Seção G/R |
| Cancelamento de negócio e falha técnica não são o mesmo fato | Seção G |
| A Autorização da Transformação não equivale à Decisão Interna sobre a versão resultante | Seção G/M |
| O valor bruto calculado (quantidade × preço unitário) nunca é substituído pela relação de desconto comercial — as duas coexistem | Seção F |
| O desconto comercial nunca altera silenciosamente quantidade ou preço unitário, e nunca se confunde com arredondamento ou divergência documental | Seção F |
| O percentual e o valor final desejado informados não são substituídos silenciosamente | Seção H/I |
| Um valor final maior só é bloqueio quando a operação for especificamente uma redução | Seção H |
| O BDOS não afirma impacto em custo, margem, lucro ou BDI sem os componentes necessários | Seção J |
| Submissão, Retirada e Diligência são registros próprios, com Escopo da Licitação próprio | Seção M |
| A proposta não vira Base Contratual da Obra automaticamente | ADR-001 |
| Nenhuma informação cruza organizações usuárias | ADR-002 |
| O resultado é reproduzível a partir da versão de origem, da regra e dos parâmetros vigentes no momento da transformação | Seção G/I/R |

---

## T. Decisões para aprovação

1. Nomes finais dos registros (Decisão Interna sobre a Versão, Submissão, Retirada, Substituição no Processo, Diligência, Simulação Orçamentária, Transformação Orçamentária, Autorização da Transformação, Execução da Transformação).
2. Formato técnico do identificador único da execução autorizada.
3. Formato técnico da referência à revisão do rascunho usada em uma simulação.
4. Lista definitiva de estados do ciclo da Transformação Orçamentária.
5. Estratégias permitidas para redução percentual e para valor final desejado.
6. Precisão permitida para percentuais e tratamento de casas decimais.
7. Regra matemática definitiva de arredondamento e limites de tolerância.
8. **Modelo definitivo do desconto comercial, incluindo aplicação por item, grupo, lote ou processo inteiro e sua relação com o valor líquido.**
9. Fronteira entre preço, custo, margem, lucro e BDI, e a futura Sprint de composição de custos.
10. Escopo por lote e por conjunto de lotes.
11. Validações, bloqueios e alertas definitivos, incluindo seus limites numéricos.
12. Modelo de concorrência e processamento em segundo plano para transformações extensas.
13. Nome e localização do futuro documento arquitetural.

---

## Apêndice Técnico — Correspondência com Nomes Internos de Código

| Termo em português | Nome interno possível |
|---|---|
| Processo de Licitação e Contratação | `ProcurementCase` |
| Versão do Orçamento | `BudgetVersion` |
| Linha do Orçamento | `BudgetLine` |
| Transformação Orçamentária | `BudgetTransformation` |
| Simulação Orçamentária | `BudgetSimulation` |
| Decisão Interna sobre a Versão | `BudgetVersionInternalDecision` |
| Autorização da Transformação | `BudgetTransformationAuthorization` |
| Execução da Transformação | `BudgetTransformationExecution` |
| Versão da regra de cálculo | `CalculationRuleVersion` |
| Revisão do rascunho usada na simulação | `DraftContentRevisionReference` |
| Desconto comercial | `CommercialDiscount` |
| Submissão | `ProposalSubmission` |
| Retirada | `ProposalWithdrawal` |
| Registro de Substituição no Processo | `ProcurementSubstitutionRecord` |
| Diligência | `ProcurementDiligenceRequest` |
| Escopo da Licitação | `ProcurementScope` |
| Versão do Documento | `DocumentVersion` |
| Parte Envolvida | `Party` |
| Papel da Parte no Processo | `PartyRoleAssignment` |
| Relação de Rastreabilidade | `LineageRelation` |
| Avaliação de Correspondência | `ReconciliationAssessment` |
| Grau de Confiança da Correspondência | `MatchConfidence` |
| Base Contratual da Obra | `ContractBaseline` |
| Item Contratado | `ContractBaselineItem` |

Os nomes internos existem exclusivamente para implementação técnica. Eles não definem o vocabulário apresentado ao usuário e não devem aparecer nas interfaces, nos relatórios, nas mensagens do BBA Advisor ou na documentação de produto.

---

## Verificação de Vocabulário

- Documento principal integralmente em português: confirmado.
- Nomes internos restritos ao Apêndice Técnico: confirmado.

---

## Estado final do ADR

### Decisões aprovadas

Os três caminhos de criação da Versão do Orçamento; qualquer percentual informado pelo usuário, inclusive com casas decimais; entrada por percentual ou valor final desejado; nenhum percentual fixo ou presumido; nenhuma estratégia escolhida silenciosamente; versão consolidada imutável; linha encontrada na fonte distinta da Linha do Orçamento reconhecida; Linha do Orçamento limitada a Grupo, Subgrupo ou Item de Serviço; novas identidades de linha em cada versão; Transformação Orçamentária como registro próprio; Simulação Orçamentária imutável; simulação feita sobre rascunho somente para estudo, com identificação exata da revisão do conteúdo utilizada; transformação autorizada somente sobre versão consolidada; Autorização da Transformação distinta da Decisão Interna sobre a Versão; parâmetros congelados na autorização; execução idempotente; uma execução autorizada produz no máximo uma versão resultante; versão resultante consolidada e imutável; versão resultante não aprovada nem submetida automaticamente; submissão, retirada, substituição e diligência como registros próprios; Decisão da Licitação separada da Versão do Orçamento; proposta nunca convertida automaticamente em Base Contratual da Obra; cancelamento de negócio distinto de falha de processamento; nenhuma afirmação sobre custo, margem, lucro ou BDI sem composição de custos; reprodução baseada nas regras e referências vigentes no momento da transformação; valor bruto calculado, desconto comercial e valor líquido resultante como conceitos distintos e coexistentes; direção da associação dos registros relacionados sempre a partir da versão, nunca embutida nela.

### Decisões ainda pendentes

As 13 listadas na Seção T, incluindo o modelo definitivo do desconto comercial (aplicação por item, grupo, lote ou processo inteiro, e sua relação com o valor líquido).

### Assuntos reservados para composição de custos e BDI

Composição de custos; produtividade; encargos; tributos; riscos; administração central; lucro; cálculo de BDI; limites legais ou documentais aplicáveis.

### Assuntos reservados para precisão e arredondamento

Regra matemática definitiva; limites de tolerância; quantidade máxima de casas decimais; limites válidos dos percentuais.

Status: aprovado — contrato conceitual registrado, nenhuma implementação iniciada.
