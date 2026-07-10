# BDOS Vision

> North Star do produto. Orienta arquitetura, roadmap, priorização de
> Epics, decisões de produto, limites entre Studios e linguagem de
> produto. Não é especificação técnica, não é material comercial, não
> é roadmap detalhado — é a visão de longo prazo à qual toda decisão
> tática deve poder ser referida.

## 1. Manifesto

O BDOS — Business Decision Operating System — acompanha todo o ciclo
de vida de um contrato de engenharia, desde a análise de um edital até
a última medição, o encerramento financeiro e o aprendizado aplicado à
próxima licitação. Em cada etapa, o objetivo não é apenas registrar
informações, mas transformar documentos, dados e evidências em
decisões auditáveis, explicáveis e continuamente melhores.

## 2. O problema que o BDOS resolve

Uma empresa de engenharia que executa contratos públicos ou privados
vive cercada de documentos: editais, planilhas orçamentárias, memoriais
descritivos, cronogramas, boletins de medição, notas fiscais,
pareceres de fiscalização. Cada um desses documentos existe para
sustentar uma decisão — participar de uma licitação, precificar uma
proposta, priorizar uma frente de obra, aceitar ou contestar uma
medição, reconhecer uma receita.

Hoje, essas decisões são tomadas com ferramentas fragmentadas —
planilhas isoladas, softwares de orçamento sem ligação com o
planejamento, planejamento sem ligação com a execução, execução sem
ligação com a medição, medição sem ligação com o financeiro. Cada
transição entre etapas perde contexto: por que aquele preço foi
proposto, por que aquele prazo foi definido, por que aquela quantidade
foi aceita. Quando um órgão de controle pergunta "por que isto foi
decidido assim", a resposta frequentemente não existe mais — ou existe
espalhada em e-mails, memórias de quem participou, ou não existe.

O BDOS resolve isto conectando as etapas: cada decisão nasce de dados
e documentos rastreáveis, e cada decisão vira, por sua vez, insumo
confiável para a próxima.

## 3. O que é o BDOS

O BDOS é o sistema operacional de decisão de uma empresa de
engenharia ao longo da vida de um contrato. Não é um único aplicativo
com uma tela — é uma cadeia contínua de capacidades especializadas
(Engines e Studios) que compartilham um mesmo princípio: todo dado tem
um dono declarado, toda decisão tem uma origem rastreável, e nenhuma
etapa do contrato existe isolada das demais.

O BDOS não substitui o julgamento técnico e comercial de quem dirige a
empresa. Ele existe para que esse julgamento seja exercido com mais
informação, mais rapidamente, com menos risco de erro silencioso, e
com registro de por que cada decisão foi tomada.

## 4. O ciclo completo do contrato de engenharia

A visão do BDOS é organizada em torno de um único ciclo de vida, não
de módulos independentes:

```
Edital
  ↓
Orçamento
  ↓
Licitação
  ↓
Contrato
  ↓
Planejamento
  ↓
Execução
  ↓
Medição
  ↓
Financeiro
  ↓
Conhecimento
  ↓
Próxima Licitação
```

Cada etapa consome o que a anterior produziu e produz o que a próxima
vai precisar. O ciclo se fecha sobre si mesmo: o conhecimento
acumulado ao longo de uma obra torna a decisão de participar da
próxima licitação — e de precificá-la — melhor do que seria sem esse
histórico.

## 5. As decisões que organizam a plataforma

O BDOS não organiza telas em torno de módulos técnicos. Organiza-as em
torno das perguntas de negócio que uma empresa de engenharia precisa
responder em cada etapa:

| Etapa | Decisão principal |
|---|---|
| Edital | Vale a pena participar? |
| Orçamento | Qual deve ser o preço da proposta? |
| Licitação | Qual desconto máximo ainda preserva a margem? |
| Contrato | Quais riscos e obrigações precisam ser controlados? |
| Planejamento | Como executar o contrato? |
| Execução | Estamos no caminho certo? |
| Medição | Posso confiar e certificar este boletim? |
| Financeiro | Qual será o resultado econômico e o fluxo de caixa da obra? |
| Conhecimento | O que aprendemos para a próxima licitação? |

Os Engines e Studios existem para preparar e sustentar essas decisões.
Eles não são o produto em si — o produto é a decisão bem informada, no
momento certo, com a origem registrada.

## 6. O BDOS como produtor de artefatos

O BDOS não é um repositório passivo de documentos. Cada etapa recebe
entradas — muitas vezes documentos externos, produzidos fora da
plataforma — e produz artefatos de maior valor, prontos para sustentar
a etapa seguinte.

| Etapa | Entradas | Artefatos produzidos pelo BDOS |
|---|---|---|
| Edital | Edital, anexos, memoriais, tabelas de referência | Análise do edital, Planilha Orçamentária, BDI, cenários, proposta |
| Planejamento | Contrato, orçamento aprovado | Cronograma, Curva S, plano de execução |
| Execução | Planejamento, fatos de campo | Tarefas, recomendações, planos de ação, alertas |
| Medição | Lançamentos internos ou boletim externo | Análise do Boletim de Medição, boletim formal, memória de cálculo |
| Financeiro | Medições certificadas, pagamentos, custos | Fluxo de caixa, margem, forecast, reconhecimento de receita |
| Conhecimento | Histórico completo dos contratos | Base reutilizável para futuras licitações |

O princípio por trás desta tabela é simples de enunciar e difícil de
executar bem: **o documento externo é uma fonte de evidência. O BDOS
interpreta, calcula, reconcilia, decide e produz novos artefatos
auditáveis** — nunca apenas armazena o que recebeu.

## 7. Edital, orçamento e licitação

*Visão de longo prazo — esta capacidade ainda não existe na
plataforma hoje.*

O BDOS não deve depender de uma planilha orçamentária já pronta como
principal porta de entrada. A visão correta começa antes disso, no
próprio edital:

```
Publicação do Edital
        ↓
Upload do Edital e anexos
        ↓
BDOS interpreta objeto da obra, quantitativos, serviços,
composições, memoriais, exigências técnicas, critérios de
medição, cronograma de referência, riscos e requisitos contratuais
        ↓
BDOS elabora a Planilha Orçamentária
        ↓
BDOS calcula custos diretos, custos indiretos, BDI,
produtividade, mobilização, margem, cenários e fluxo de caixa
        ↓
BBA Advisor apoia a decisão de participar, de qual preço ofertar,
de qual desconto máximo e de quais riscos exigem contingência
```

A Planilha Orçamentária, nesta visão, é um artefato **produzido** pelo
BDOS — não apenas um documento importado de outro sistema. Quando
existirem planilhas de referência do órgão contratante, tabelas
SINAPI, SICRO ou equivalentes, elas entram como fontes de dados e
evidência para esse cálculo, não como o orçamento em si. O orçamento
final é construído pelo sistema, com o histórico da empresa e a
análise do edital como insumos.

Nem todo edital trará informação suficiente para produzir um
orçamento completo e confiável. O BDOS não deverá fabricar
quantitativos, composições, produtividades ou premissas ausentes para
produzir artificialmente um orçamento completo. Quando os documentos
do edital forem insuficientes, inconsistentes ou ambíguos, o sistema
deverá identificar as lacunas, separar dados confirmados de premissas
propostas e exigir validação humana antes da consolidação da Planilha
Orçamentária.

As saídas esperadas desta fase — Planilha Orçamentária, BDI, cenários
de preço, análise de margem, cronograma físico-financeiro inicial,
Curva S inicial, fluxo de caixa previsto, recomendação de participação
e de preço — alimentam diretamente a fase de Planejamento assim que o
contrato é assinado.

## 8. Planejamento e execução

*Planejamento (Project Studio) e Execução (Execution Engine) já estão
em produção, com maturidade real, não apenas conceitual.*

O planejamento traduz o contrato assinado (ou, na visão de longo
prazo, o orçamento já aprovado) em um cronograma executável — a
estrutura analítica do projeto, prazos, dependências, curva S. A
execução acompanha essa estrutura contra a realidade de campo,
produzindo tarefas, recomendações e planos de ação sempre que a
realidade diverge do planejado. Nenhuma tarefa de execução existe
isolada de uma recomendação que a originou — essa cadeia causal
completa é auditável do início ao fim, e é hoje o exemplo mais maduro
de como o restante da plataforma deve se comportar.

## 9. Medição e Análise do Boletim de Medição

*O Studio de Medições existe hoje como domínio conceitual amplamente
construído; a persistência, o adapter de importação e a experiência
completa descrita abaixo estão em desenho, não em produção.*

O Studio de Medições não existe apenas para importar boletins de
medição em Excel. Ele existe para administrar toda a jornada da
medição ao longo da obra — do primeiro lançamento de quantidade até a
certificação formal que alimenta o financeiro.

A visão do Studio de Medições contempla dois caminhos complementares:

**Caminho A — obra nascida dentro do BDOS.** O usuário lança
quantidades diretamente na plataforma, período a período, com
memórias de cálculo e evidências vinculadas. O sistema calcula os
valores, controla o saldo contratual, identifica divergências, conduz
a certificação e alimenta o financeiro automaticamente — sem que um
Boletim de Medição em Excel precise existir em algum momento do
processo.

**Caminho B — migração de quem hoje trabalha em planilha.** A empresa
sobe um boletim já pronto, produzido fora da plataforma. O BDOS lê as
quantidades, recalcula o valor financeiro a partir do físico e do
preço unitário contratado, reconcilia contra o que a planilha
declarava, aponta divergências e alertas, e entrega o resultado numa
área de revisão controlada antes de se tornar um documento formal
dentro da plataforma.

O nome de produto aprovado para essa funcionalidade é **Análise do
Boletim de Medição** — termo a preservar na UI e em toda documentação
de produto voltada ao usuário.

É importante que este ponto fique inequívoco: **a importação de
boletins não é a essência do Studio de Medições. É uma estratégia de
migração e adoção**, pensada para empresas que hoje vivem em
planilhas e precisam de um caminho de entrada de baixo atrito. A visão
de longo prazo é que obras e medições futuras sejam conduzidas
integralmente dentro do BDOS, com o upload de boletim se tornando cada
vez mais raro — uma porta de entrada, não o destino final do produto.

## 10. Financeiro e resultado econômico

*Visão de longo prazo — o Studio de Finanças ainda está planejado, não
construído.*

Uma medição certificada não é o fim da jornada — é o gatilho para o
reconhecimento de receita, para a atualização do fluxo de caixa e para
o cálculo do resultado econômico real da obra contra o que foi
orçado. O financeiro do BDOS não deve recalcular ou reinterpretar a
medição — deve consumi-la como já certificada, e produzir a visão que
importa para quem dirige a empresa: qual é a margem real desta obra,
comparada à margem que foi orçada, e o que isso significa para o
fluxo de caixa da empresa como um todo.

## 11. Conhecimento acumulado e próxima licitação

O maior ativo futuro do BDOS não será apenas o software. Será o
conhecimento acumulado por cada empresa que o utiliza ao longo de
dezenas de contratos:

```
Obra 1 → Obra 2 → Obra 3 → ... → dezenas de contratos
        ↓
histórico real de produtividade, desvios, margens, atrasos,
medições, custos, riscos e decisões
        ↓
melhor decisão na próxima licitação
```

A visão de longo prazo é que o BDOS reutilize esse histórico
ativamente, não apenas o arquive. Um exemplo do tipo de apoio que essa
capacidade deve viabilizar: "esta licitação é semelhante a outras sete
obras executadas pela empresa; nessas obras, o item de escavação
ficou em média 18% acima do orçamento, e a margem final caiu abaixo
da meta quando o desconto superou 7,5%". Esta é, hoje, uma visão
futura — nenhuma capacidade de comparação histórica automatizada
existe ainda na plataforma —, mas é a capacidade que dá sentido a
todo o resto: cada contrato bem registrado torna o próximo mais
seguro de precificar e executar.

Uma extensão de longo prazo desta ideia, ainda mais distante da
implementação atual, mas coerente com o modelo de negócio de uma
empresa que atende múltiplos clientes (não apenas uma obra de uma
única construtora): à medida que mais empresas usam o BDOS com a
mesma estrutura de dados, torna-se possível produzir **referências de
mercado agregadas e anonimizadas** — por exemplo, a faixa típica de
produtividade de um serviço de terraplenagem em determinada região,
sem nunca expor os dados de uma empresa específica a outra.

Essa capacidade somente poderá existir sob governança específica,
segregação rigorosa dos dados de cada cliente, critérios mínimos de
agregação, proteção contra reidentificação e autorizações contratuais
compatíveis. O dado individual de uma empresa nunca deverá ser
exposto, inferido ou utilizado para beneficiar outra de maneira
identificável. Não é uma consequência automática da adoção, nem uma
vantagem já existente hoje — **poderá se tornar uma vantagem
competitiva defensável**, caso a plataforma alcance escala,
consistência de dados e governança suficientes. Não é uma
funcionalidade a construir agora — é um horizonte que justifica manter
a disciplina de modelagem de dados consistente desde já.

## 12. O papel dos Studios

Os Studios e Engines são ambientes especializados dentro de uma única
jornada — não produtos independentes que por acaso compartilham um
login. A relação entre eles, em linguagem de produto:

```
Edital / Orçamento
        ↓
Decision Engine
        ↓
capacidades de Contrato / Orçamento
        ↓
Project Studio
        ↓
Execution Engine
        ↓
Studio de Medições
        ↓
Studio de Finanças
        ↓
Memória Histórica
        ↓
próxima decisão

Studio de Evidências (transversal)
        ↕
alimenta Planejamento, Execução e Medição
```

O Studio de Evidências é transversal: produz e governa comprovações
consumidas por planejamento, execução e medição; sua posição no
diagrama não representa uma etapa estritamente posterior à medição.

Nem todas as peças deste diagrama existem hoje como implementação
confirmada — a seção 14 do documento de arquitetura da plataforma
mantém o retrato real e atualizado de maturidade de cada Studio; este
documento descreve a intenção de produto, não substitui aquele
inventário técnico. Quando uma capacidade ainda não existe, ela deve
ser lida aqui como visão, nunca como funcionalidade disponível.

## 13. Princípios permanentes do produto

Estes princípios não mudam Epic a Epic — são o que faz o BDOS
continuar sendo o mesmo produto à medida que cresce:

- **O BDOS decide. O LLM explica.** Nenhuma regra crítica de negócio
  depende de um modelo de linguagem para ser calculada — o LLM narra e
  contextualiza o que o sistema já decidiu de forma determinística.
- **O sistema calcula; documentos são evidência.** Um valor financeiro
  declarado num documento externo nunca é aceito como verdade — é
  comparado contra o que o domínio recalcula, e a divergência vira
  informação, nunca um dado silenciosamente sobrescrito.
- **Proveniência imutável.** O registro de onde um dado veio não é
  editável — o que pode mudar é o estado operacional do processamento
  daquele dado, nunca a evidência de origem.
- **Contexto congelado e auditável.** Uma decisão tomada com um
  determinado conjunto de dados permanece rastreável àquele conjunto,
  mesmo que os dados mudem depois.
- **Ownership explícito.** Toda entidade de dado compartilhada entre
  Studios tem exatamente um dono declarado; os demais a consomem
  somente leitura.
- **Nenhum Studio duplica o dado de outro.** Quando dois Studios
  precisam do mesmo dado, um o possui e o outro o referencia — nunca
  os dois mantêm cópias independentes que podem divergir.
- **Explicabilidade como infraestrutura, não decoração.** Numa obra
  contratada com órgão público, uma decisão pode ser auditada por um
  tribunal de contas anos depois do fato. A cadeia causal completa —
  por que este preço, por que este prazo, por que esta medição foi
  aceita — não é uma conveniência de UX: é a defesa da empresa numa
  auditoria futura. O BDOS trata isso como requisito de produto, não
  como funcionalidade opcional.
- **Linguagem de produto consistente.** O mesmo conceito de negócio
  usa o mesmo nome em toda a plataforma, independentemente de qual
  Engine o calculou por baixo.
- **Cada Studio existe para apoiar uma decisão da jornada** — nenhum
  Studio é construído porque "seria bom ter", só porque uma decisão
  real do ciclo de vida do contrato depende dele.
- **Importação é porta de entrada, não objetivo final.** Toda
  capacidade de "subir um arquivo" existe para reduzir o atrito de
  adoção de quem ainda trabalha fora do BDOS — nunca é o destino
  pretendido da experiência madura do produto.
- **Conhecimento histórico deve ser reutilizado**, não apenas
  arquivado — ver seção 11.
- **Artefatos reais validam a arquitetura.** Um desenho só é
  considerado maduro depois de comprovado contra um documento real de
  um contrato real, não apenas contra um caso de teste sintético.
- **Lacunas não são preenchidas silenciosamente.** Quando a evidência
  disponível for insuficiente, o BDOS explicita a ausência, registra
  qualquer premissa necessária e exige validação compatível com o
  risco da decisão. Este princípio não se limita ao orçamento (seção
  7) — vale também para planejamento, medição, projeção financeira,
  comparação histórica e qualquer análise produzida pelo Advisor.

## 14. O que o BDOS não é

- Não é um ERP tradicional.
- Não é apenas um importador de arquivos.
- Não é apenas um chatbot com acesso a dados da empresa.
- Não é apenas um sistema de planejamento de obra.
- Não é apenas um sistema de medição.
- Não é um data lake passivo.
- Não substitui o julgamento de engenharia por um modelo de
  linguagem.
- Não aceita documentos externos como verdade sem validação.

## 15. Diferenciação estratégica

O mercado de ferramentas para engenharia e construção é fragmentado:
existem soluções especializadas em orçamento, em planejamento, em
acompanhamento de obra, em ERP financeiro, em gestão documental, em
medição — cada uma resolvendo bem uma fatia isolada do ciclo. A
proposta do BDOS é integrar essas capacidades mantendo uma cadeia
contínua de decisão, execução, medição, resultado financeiro e
aprendizado — não apenas reunir mais módulos sob um único login.

O diferencial não está em ter mais funcionalidades do que qualquer
ferramenta isolada. Está em:

- **Continuidade da decisão** — o contexto de uma etapa não se perde
  na transição para a próxima.
- **Cadeia causal completa** — toda recomendação, tarefa ou valor
  financeiro é rastreável até o dado ou documento que o originou.
- **Auditabilidade como propriedade estrutural**, não como relatório
  gerado à parte — particularmente relevante no contexto de contratos
  públicos brasileiros, onde a fiscalização e o controle externo podem
  revisitar uma decisão anos depois de tomada.
- **Integração real entre planejamento, execução, medição, evidência e
  finanças**, com ownership de dado explícito em vez de sincronizações
  frágeis entre sistemas separados.
- **Reaproveitamento do conhecimento acumulado** de uma empresa ao
  longo de seus contratos — e, no horizonte de longo prazo, entre
  empresas, de forma agregada e anonimizada (seção 11).

## 16. Critério para novos Epics

Todo novo Epic deve responder, antes de qualquer linha de código:

1. Qual decisão da jornada (seção 5) ele melhora?
2. Qual Studio ou Engine é responsável por ele?
3. Qual artefato entra?
4. Qual artefato o BDOS produz?
5. Qual cadeia causal precisa ser preservada?
6. Como a decisão resultante será auditada?
7. Como essa capacidade reutiliza ou produz conhecimento (seção 11)?
8. A funcionalidade aproxima ou afasta o produto desta visão?

## 17. North Star

O BDOS transforma a experiência acumulada da empresa em um ativo
reutilizável para a próxima decisão.

Do edital à última medição, cada contrato torna a próxima decisão
melhor.
