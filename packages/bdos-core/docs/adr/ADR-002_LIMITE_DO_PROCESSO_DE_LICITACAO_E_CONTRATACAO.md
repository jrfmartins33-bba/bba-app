# ADR-002 — Limite do Processo de Licitação e Contratação

- **Status**: Aprovado
- **Data da decisão**: 2026-07-13
- **Epic**: 21 — Engenharia de Custos e Licitações
- **Sprint**: 21.2A — Contrato Conceitual do Processo de Licitação e Contratação
- **Decisão principal**: Processo de Licitação e Contratação como núcleo coordenador enxuto do domínio

Este ADR documenta a decisão arquitetural aprovada para a Sprint 21.2A do Epic 21 ("Engenharia de Custos e Licitações"), com base no ADR-001 (identidade e rastreabilidade de itens orçamentários e documentos de licitação). É exclusivamente conceitual e arquitetural — nenhum tipo de código, schema, repository, API, UI, teste, migration, RLS ou seed foi criado ou é criado por esta gravação. É autossuficiente e substitui integralmente qualquer rascunho anterior desta decisão.

---

## A. Definição do Processo de Licitação e Contratação

O Processo de Licitação e Contratação representa o ciclo completo de uma licitação ou contratação de engenharia: o edital, o orçamento, as propostas, as decisões administrativas, a contratação e a Base Contratual da Obra resultante. Ele existe para que documentos, versões de orçamento, decisões e partes produzidos em momentos diferentes, por pessoas ou empresas diferentes, sejam reconhecidos como pertencentes ao mesmo processo — e para que nenhuma informação de um processo seja confundida com a de outro, nem misturada entre organizações usuárias diferentes.

**Identidade**: cada Processo de Licitação e Contratação possui um identificador próprio, interno à plataforma. O número do edital, do processo administrativo ou do contrato **nunca** são usados como essa identidade interna — eles são apenas identificadores externos, e podem ser vários ao mesmo tempo (ver Seção G).

**Diferenças em relação a conceitos vizinhos**:
- **Projeto de engenharia**: o planejamento e a execução de uma obra não seguem, obrigatoriamente, a contratação — um projeto pode existir antes da assinatura do contrato, durante o julgamento da licitação, ou só depois da homologação. O Processo de Licitação e Contratação pode existir com ou sem um projeto de engenharia associado, em qualquer ordem no tempo.
- **Contrato de Engenharia**: já existe hoje na plataforma como um registro próprio (com dono da obra, número do contrato, processo administrativo, contratada, consórcio, cidade, estado, valor e situação do contrato). Ele é sempre referenciado pelo seu identificador interno — nunca pelo número do contrato — e a relação entre um Processo de Licitação e Contratação e um Contrato de Engenharia é registrada por um Vínculo entre Licitação e Contrato (Seção M).
- **Edital**: é um documento associado ao Processo de Licitação e Contratação, não o processo em si.
- **Área de trabalho**: é apenas um conceito de navegação da interface, sem relação estrutural com o modelo de negócio.

### Quando dois documentos pertencem ao mesmo Processo de Licitação e Contratação

Dois documentos, versões de orçamento ou decisões pertencem ao mesmo processo quando se referem ao mesmo ciclo específico de uma licitação ou contratação, para a mesma entidade contratante — o edital, seus adendos, o orçamento oficial, as propostas, as decisões de julgamento, a homologação e o contrato de um único processo administrativo.

### Quando pertencem a processos diferentes

- **Retificação**: a correção de um identificador externo, de um valor ou de um documento **não cria** um novo processo — continua sendo o mesmo processo, com a correção registrada como um novo fato, preservando o que existia antes, sem apagar nada.
- **Republicação**: quando um edital é republicado mantendo o mesmo ciclo administrativo (a mesma disputa, apenas adiada ou corrigida), é o **mesmo** processo. Quando a republicação representa uma **nova disputa** de fato — por exemplo, um processo anterior cancelado, revogado, fracassado ou deserto, reaberto sob um novo edital — trata-se de um processo **diferente**, que pode ser relacionado ao anterior por uma Relação de Rastreabilidade entre documentos, nunca por fusão de identidade.
- **Contratação direta, sem disputa competitiva**: cabe integralmente como um Processo de Licitação e Contratação — apenas as decisões e identificadores ligados à disputa (classificação, desclassificação, adjudicação) podem não existir; a homologação e a contratação continuam existindo normalmente.
- **Processos privados**, sem número de PNCP ou UASG: cabem sem qualquer alteração — todos os identificadores externos são opcionais (Seção G).
- **Vários lotes**: continuam sendo o **mesmo** processo, com cada lote representado por um Lote da Licitação (Seção H).
- **Vários contratos**: também continuam sendo o **mesmo** processo, com cada contrato registrado por um Vínculo entre Licitação e Contrato distinto (Seção M) — vários contratos nunca significam vários processos.

---

## B. Organização Usuária, Parte Envolvida e Papel no Processo

Três ideias diferentes, que nunca devem ser confundidas, organizam quem participa e quem controla o acesso a um Processo de Licitação e Contratação:

- **Organização usuária**: é a empresa, o escritório de engenharia ou a consultoria responsável por operar e proteger os dados dentro do BDOS. É a fronteira de acesso e segurança — determina quem pode ver e alterar a informação.
- **Parte Envolvida**: é a identidade jurídica ou pessoal de um ator do processo — determina quem é esse ator, independentemente de qual organização usuária hospeda o dado dentro da plataforma.
- **Papel da Parte no Processo**: define o que aquela Parte Envolvida faz dentro de um Processo de Licitação e Contratação específico — proponente, licitante, consorciada, adjudicatária, contratada, órgão contratante, responsável técnico, representante legal. A mesma Parte Envolvida pode ter papéis diferentes em processos diferentes, ou papéis diferentes em lotes diferentes do mesmo processo.

Essas três ideias nunca se fundem: uma organização usuária do BDOS **pode também ser** uma Parte Envolvida — inclusive licitante, proponente, adjudicatária, consorciada ou contratada — dentro de um processo que ela mesma opera na plataforma. Quando a BBA, ou uma consultoria, opera o BDOS em nome de um cliente atendido, a organização usuária (quem opera os dados) e a Parte Envolvida (quem efetivamente disputa ou contrata a licitação) podem ser entidades diferentes. **Nenhuma Parte Envolvida é classificada automaticamente como "de fora"** apenas por ocupar o papel de licitante — essa classificação depende só do papel exercido no processo, nunca de uma característica fixa da própria Parte Envolvida.

### Proteção distribuída da organização usuária

A regra de que nenhuma informação pode cruzar de uma organização usuária para outra é protegida em várias camadas ao mesmo tempo, nunca por um único ponto de controle:

- cada núcleo do domínio (o processo, o lote, a versão do orçamento, a decisão, a base contratual, o vínculo contratual, o papel da parte) reconhece e valida a sua própria organização usuária;
- as consultas ao banco de dados nunca retornam informação cruzando organizações usuárias, independentemente do que estiver momentaneamente em memória;
- os Serviços de Aplicação validam a organização usuária na entrada de qualquer operação, antes de acionar qualquer regra de negócio;
- os contratos de integração entre domínios (as futuras camadas de integração com Ambiente de Projetos, Ambiente de Medições, Ambiente de Finanças) validam a organização usuária na própria fronteira;
- a segurança em nível de banco de dados (a ser implementada futuramente) é a última camada de defesa, não a única.

O Processo de Licitação e Contratação coordena essa intenção arquitetural, mas não é o único ponto responsável por garanti-la.

---

## C. Alternativas para o Núcleo do Domínio

Três formas de organizar o núcleo do domínio foram comparadas:

| Critério | Alternativa A — núcleo único e amplo | Alternativa B — núcleo coordenador | Alternativa C — sem núcleo central |
|---|---|---|---|
| Consistência imediata | Forte em tudo, inclusive em cada linha do orçamento | Forte apenas na identidade e no estado próprio do processo; as demais partes se ajustam com o tempo | Nenhuma consistência garantida entre as partes |
| Tamanho de cada operação | Grande — uma única operação poderia tocar centenas de linhas de orçamento e decisões ao mesmo tempo | Pequeno — cada operação toca só a identidade, o estado próprio ou uma referência | Mínimo — cada parte opera sozinha |
| Concorrência entre usuários | Alto risco de travamento — qualquer alteração no processo trava tudo | Baixo risco — as partes evoluem em paralelo | Nenhum ponto de travamento, mas também nenhuma coordenação |
| Capacidade de auditoria | Alta dentro do núcleo, mas a cadeia de causa e efeito entre tipos diferentes de informação fica implícita | Alta — existe um único lugar que sabe o que pertence a cada processo | Baixa, exige reunir informação espalhada |
| Independência das partes | Baixa — tudo depende do núcleo único | Alta — cada parte evolui como seu próprio registro | Máxima |
| Risco de um núcleo gigante e difícil de manter | Alto | Baixo | Nenhum |
| Facilidade de evolução futura | Baixa | Alta | Alta, mas sem lugar natural para novas regras que envolvam várias partes ao mesmo tempo |
| Impacto na importação de documentos, propostas, contratação, planejamento e medições | Alto acoplamento em todas as frentes | Baixo em todas as frentes | Baixo, mas sem verificação centralizada |
| Facilidade de reverter uma decisão de modelagem | Baixa | Alta | Alta, mas o custo de introduzir coordenação depois é maior |
| Custo de corrigir o modelo mais adiante | Alto | Baixo | Médio |

---

## D. Decisão sobre o Núcleo do Domínio

O Processo de Licitação e Contratação é o **núcleo coordenador enxuto** do domínio. Ele **não guarda dentro de si** listas sem limite de documentos, versões de documento, versões de orçamento, partes envolvidas, decisões, vínculos contratuais ou bases contratuais. Cada uma dessas informações é registrada em seu próprio núcleo, sempre identificando a qual processo e a qual organização usuária pertence — e é localizada por consulta, nunca por uma lista guardada dentro do processo.

**O que fica realmente dentro do núcleo do Processo de Licitação e Contratação** — pequeno, estável, raramente mudando:
- a identidade do processo;
- a organização usuária responsável;
- informações pequenas e estáveis (uma descrição resumida do objeto, a data de abertura);
- os identificadores externos (um conjunto pequeno e limitado — Seção G);
- os fatos próprios e definitivos do processo: aberto; cancelado por completo; revogado por completo; encerrado administrativamente (Seção N);
- as regras de coordenação (organização usuária correta, nenhuma mistura entre processos).

**O que é sempre obtido por consulta, nunca guardado dentro do processo**: documentos, versões do orçamento, papéis das partes envolvidas, decisões da licitação, lotes, vínculos com contratos, bases contratuais.

---

## E. Responsabilidades do Processo de Licitação e Contratação

| Responsabilidade | O que significa |
|---|---|
| Abrir o processo | Fato próprio do processo |
| Cancelar ou revogar por completo, encerrar administrativamente | Fato próprio, sempre indicando a decisão da licitação que originou esse encerramento, quando ela existir (Seção N) |
| Registrar identificadores externos | Fato próprio |
| Relacionar o órgão contratante e os demais participantes | Feito por consulta aos papéis das partes envolvidas — nunca uma lista guardada dentro do processo |
| Associar um documento | A associação é permitida assim que a identidade, a organização usuária e a origem mínima do documento estiverem registradas (Seção J) |
| Saber quais versões de orçamento, decisões e vínculos contratuais pertencem ao processo | Feito por consulta |
| Apresentar situações como "publicado", "em julgamento", "parcialmente homologado", "parcialmente contratado", "com lotes fracassados" | **Não é um fato próprio do processo** — é um resumo derivado, calculado a partir das demais informações associadas, apresentado por uma Visão Consolidada (Seção N) |
| Impedir que informação cruze de uma organização usuária para outra | Coordenação, responsabilidade compartilhada com as demais camadas (Seção B) |
| Impedir que documentos ou decisões de processos diferentes sejam misturados | Fato próprio, reforçado por verificação em cada parte consumidora |
| Leitura de arquivos, reconhecimento óptico de texto, cálculos | Fora do processo — é responsabilidade de uma camada de integração de documentos, ainda não decidida |

---

## F. O que Não Pertence ao Processo de Licitação e Contratação

- Listas sem limite de documentos, versões de documento, versões de orçamento, partes envolvidas, decisões, vínculos contratuais ou bases contratuais — cada uma pertence ao seu próprio registro, localizado por consulta (Seção D).
- Um resumo do andamento do processo quando esse resumo não for um fato próprio — guardar isso dentro do processo criaria o risco de o resumo ficar desatualizado ou divergente em relação às informações reais que o originam (Seção N).
- O conteúdo binário dos arquivos em si — um documento guarda ou referencia sua identidade, seus metadados, sua origem, sua autoridade, sua assinatura criptográfica de conteúdo e a localização segura do conteúdo, nunca o conteúdo binário do arquivo por definição estrutural própria; onde e como o conteúdo é fisicamente armazenado, e quem é responsável por esse armazenamento, permanece uma decisão pendente da futura camada de integração documental.
- A leitura de arquivos em PDF ou planilha; as fórmulas de orçamento, o BDI, a composição de custos; os cenários financeiros; a execução da obra, as tarefas, o cronograma detalhado; as medições; o faturamento e os fatos contábeis; a narrativa produzida pelo BBA Advisor.

---

## G. Identidade e Identificadores Externos

A identidade interna do processo nunca se confunde com seus identificadores externos. Estes são vários, opcionais, e seus nomes exatos de campo ainda não foram aprovados: número do processo administrativo; número da licitação; modalidade; número do edital; número do contrato; identificador do PNCP; UASG; identificadores de portais externos.

- **Unicidade por órgão**: não pode ser considerada garantida de forma geral — o mesmo número de processo pode se repetir em órgãos diferentes; se for exigida unicidade, ela dependeria da combinação órgão + número, o que ainda não foi decidido.
- **Retificação**: um identificador externo pode ser corrigido pelo próprio órgão emissor sem apagar o valor anterior — a correção é um novo fato registrado, preservando o histórico.
- **Processos republicados**: quando mantêm o mesmo ciclo administrativo, o identificador é apenas atualizado dentro do mesmo processo; quando representam uma nova disputa, geram um processo diferente (Seção A).
- **Licitações com vários lotes**: um único identificador externo (o número do edital) cobre todos os lotes, cada um com sua própria identidade através do Lote da Licitação (Seção H).
- **Um processo com mais de um contrato, ou um contrato originado de vários lotes**: ambos são suportados — cada relação entre contrato, processo e lote é registrada por um Vínculo entre Licitação e Contrato (Seção M), nunca supondo que exista sempre um único contrato por processo.
- **Contratação direta, sem disputa**: cabe integralmente — os identificadores ligados à disputa competitiva simplesmente ficam ausentes.
- **Processos privados**, sem PNCP ou UASG: cabem — nenhum identificador externo é obrigatório para que o processo exista.

---

## H. Lote da Licitação e Escopo da Licitação

O **Lote da Licitação** é um registro próprio, pertencente a um Processo de Licitação e Contratação. Um lote possui um andamento genuinamente independente dos demais lotes do mesmo processo: proposta própria, decisões próprias, recursos próprios, adjudicação própria, possibilidade de cancelamento próprio, contrato próprio, e potencialmente sua própria Base Contratual da Obra. Guardar isso apenas como um atributo do processo reintroduziria o risco de um núcleo gigante e difícil de manter, já descartado na Seção C/D.

**Processos sem lote não recebem um lote artificial**: quando o processo real não possui lotes, o Processo de Licitação e Contratação opera diretamente no nível do processo inteiro — nenhum Lote da Licitação é criado apenas para uniformizar o modelo.

O **Escopo da Licitação** é o conceito que indica a que parte do processo uma informação se aplica: ao processo inteiro; a um único lote; ou a um conjunto de lotes. Não é, nesta etapa, um formato de dado definido nem uma escolha de como será guardado no banco de dados — é apenas o vocabulário conceitual necessário para que nenhuma informação fique presa a "todo o processo" ou a um único lote quando a realidade exigir mais flexibilidade. O Escopo da Licitação se aplica conceitualmente a:

- Versão do Orçamento (Seção K) — uma versão de orçamento pode cobrir vários lotes;
- Decisão da Licitação (Seção L);
- Vínculo entre Licitação e Contrato — um contrato pode cobrir vários lotes, e vários lotes podem estar reunidos em um único contrato;
- Base Contratual da Obra (Seção M) — pode cobrir vários lotes;
- Papel da Parte no Processo (Seção I) — um papel pode ser específico de um lote;
- documentos, quando necessário (Seção J).

Os lotes nunca devem ser deduzidos apenas pela presença ou ausência de um único identificador — o Escopo da Licitação é a forma correta de expressar "processo inteiro", "somente o lote X" ou "os lotes X e Y juntos".

---

## I. Partes Envolvidas, Papéis e Consórcios

- **Parte Envolvida**: possui identidade própria dentro da plataforma, que não é definida pelo CNPJ ou CPF.
- **Identificador da Parte**: são os identificadores externos (CNPJ, CPF, registro estrangeiro) associados a uma Parte Envolvida.
- **Tipo de Parte** — uma distinção conceitual necessária entre:
  - **Organização**: o órgão contratante, a empresa (incluindo a própria organização usuária do BDOS, quando ela mesma é Parte Envolvida no processo) e o consórcio;
  - **Pessoa Física**: o responsável técnico e o representante legal.
- O **consórcio** é, ele próprio, uma Parte Envolvida distinta das empresas que o compõem, com uma **Participação no Consórcio** de quantidade variável de membros (dois ou mais, nunca presumida em exatamente dois, nem com participações presumidas iguais), composição que pode estar incompleta durante o recebimento dos documentos (nunca inventada, permanecendo pendente até haver evidência ou validação humana), e mudanças que preservam a vigência, o histórico e a evidência anteriores, sem nunca apagar um registro anterior.
  - A composição **formal** de um consórcio possui, por definição, dois ou mais membros. Durante a ingestão documental, porém, o sistema pode ter identificado, em um determinado momento, apenas parte desses membros — por exemplo, quando um documento cita apenas uma das empresas consorciadas, ou quando a formalização do consórcio ainda não foi totalmente documentada.
  - Uma composição **parcialmente identificada nunca é apresentada como composição completa** — o sistema deve deixar explícito que a composição registrada até aquele momento é parcial, até que novos documentos ou validação humana confirmem os demais membros.
  - **Nenhum membro ou percentual é inventado** para alcançar artificialmente o mínimo formal de dois membros — se apenas um membro foi identificado até o momento, o registro permanece explicitamente incompleto, nunca completado por suposição.
- O **Papel da Parte no Processo** é uma associação própria, exclusivamente processual — não pertence à Parte Envolvida (que não guarda uma lista de todos os seus papéis em todos os processos) nem ao Processo de Licitação e Contratação (que também não guarda essa lista). Ele pertence à organização usuária e ao Processo de Licitação e Contratação/Escopo da Licitação, sendo localizado por consulta. Pode ser específico de um lote, por meio do Escopo da Licitação.
- A **Participação no Consórcio** permanece uma associação própria **entre Partes Envolvidas**, com vigência e evidência — um mecanismo estruturalmente separado do Papel da Parte no Processo (que associa uma Parte Envolvida a um processo) e da Relação de Rastreabilidade (que nunca envolve Partes Envolvidas).

Papéis processuais possíveis: órgão contratante; empresa usuária do BDOS quando também é Parte Envolvida; licitante; participante da proposta; líder do consórcio; consorciada; adjudicatária; contratada; responsável técnico; representante legal.

---

## J. Documentos

Um documento e suas versões guardam ou referenciam sua identidade, seus metadados, sua origem, sua autoridade, sua assinatura criptográfica de conteúdo e a localização segura do conteúdo — nunca o conteúdo binário do arquivo em si, por definição estrutural própria. Onde o conteúdo é fisicamente armazenado, e quem é responsável por esse armazenamento, permanece uma decisão pendente da futura camada de integração documental.

Uma Versão do Documento pode ser associada ao Processo de Licitação e Contratação assim que sua identidade, a organização usuária responsável e sua origem mínima estiverem registradas — **não é necessário** que a classificação, a extração de informação ou a validação já tenham ocorrido para que essa associação exista. Somente a criação ou o reconhecimento de uma Versão do Orçamento a partir de documentos exige que a classificação econômica, a extração e a validação já tenham sido suficientemente concluídas (ver o primeiro caminho da Seção K).

Fluxo conceitual pela via documental:
```
Versão do Documento criada
  → associada ao Processo de Licitação e Contratação
  → classificada
  → tem sua informação extraída
  → validada
  → eventualmente passa a sustentar uma Versão do Orçamento
```
Cada etapa é opcional e posterior à anterior — uma Versão do Documento pode permanecer associada ao processo indefinidamente sem nunca chegar a sustentar uma Versão do Orçamento (por exemplo, um parecer, uma correspondência, um documento de apoio).

Documentos também podem carregar um Escopo da Licitação quando fizer sentido (por exemplo, um documento específico de um lote).

---

## K. Versão do Orçamento

Uma Versão do Orçamento é um retrato estruturado de um orçamento, pertencente a um Processo de Licitação e Contratação (e, por meio do Escopo da Licitação, possivelmente a um ou mais lotes). Ela pode nascer por três caminhos conceituais diferentes — nenhum deles é obrigatório nem exclusivo:

### Criada a partir de documentos
```
Versão do Documento
  → classificação
  → extração
  → validação
  → Versão do Orçamento reconhecida
```
O comando conceitual correspondente é "Reconhecer Versão do Orçamento a partir de Documentos". A versão resultante é sustentada por uma ou mais Versões do Documento.

### Criada diretamente no BDOS
Um orçamento ou cenário criado diretamente pelo usuário dentro do sistema produz uma Versão do Orçamento sem exigir nenhuma Versão do Documento de origem. O comando conceitual correspondente é "Criar Versão do Orçamento diretamente no BDOS".

### Criada por transformação
```
Versão do Orçamento existente
  → transformação explícita e auditável
  → nova Versão do Orçamento
```
O comando conceitual correspondente é "Criar Versão do Orçamento por Transformação". Exemplos de transformação (sem detalhar as fórmulas em si): redução percentual global; desconto por grupo; revisão de preços; cenário alternativo; proposta criada a partir do orçamento oficial. A transformação preserva conceitualmente: a versão de origem; a regra aplicada; os parâmetros usados; o responsável pela transformação; a data; o resultado; a Relação de Rastreabilidade correspondente; e a validação humana, quando aplicável.

### Situação, escopo e origem econômica

- Cada Versão do Orçamento possui uma **situação própria** (ainda sem nome final aprovado, nem lista fechada de valores): em elaboração; aprovada internamente; submetida; em diligência; aceita; rejeitada; substituída; retirada. Essa situação é **diferente** da situação de aceitação de uma Relação de Rastreabilidade e do Grau de Confiança da Correspondência de uma reconciliação — os três nunca devem se confundir.
- O **escopo** de uma Versão do Orçamento é definido pelo Escopo da Licitação — ela pode cobrir o processo inteiro, um lote, ou um conjunto de lotes.
- Toda Versão do Orçamento deve ter uma **origem econômica identificável**, entre (lista não fechada): orçamento oficial do contratante; orçamento interno da organização usuária; cenário interno; proposta de uma Parte Envolvida; proposta conjunta de várias Partes Envolvidas; proposta de compromisso de um consórcio; proposta do consórcio já formalizado. Devem ser preservados conceitualmente: a Parte Envolvida autora ou apresentante; o papel dessa parte no processo; a origem documental; se a origem é interna ou externa à organização usuária; a confidencialidade; e o responsável pela aprovação interna, quando aplicável. Uma Versão do Orçamento não pode permanecer ambígua quanto a quem a produziu ou apresentou, quando essa informação estiver disponível na fonte.
- A **assinatura criptográfica do conteúdo** de um documento é apenas um sinal de integridade — de que o conteúdo binário dos arquivos é idêntico, ou de uma possível duplicidade — nunca uma forma isolada de evitar repetição de uma importação. A forma real de evitar repetição considera, em conjunto: a organização usuária; a operação de importação; a origem; o protocolo; o contexto documental; os identificadores externos; e a confirmação humana, quando necessária. Duas Versões do Documento podem ter a mesma assinatura criptográfica de conteúdo e continuar sendo identidades distintas.
- Várias propostas submetidas são suportadas ao mesmo tempo; versões rejeitadas permanecem no histórico; uma versão substitui outra por meio de uma Relação de Rastreabilidade, nunca apagando a anterior.

---

## L. Decisão da Licitação

A **Decisão da Licitação** é o nome técnico aprovado para as decisões administrativas do processo: classificação; desclassificação; adjudicação; homologação; decisão de recurso; anulação; revogação.

Cada Decisão da Licitação possui conceitualmente:
- **o tipo** da decisão (um dos listados acima);
- **o escopo** — se ela se aplica ao processo inteiro, a um lote, ou a um conjunto de lotes;
- **o objeto ou os objetos afetados** (por exemplo, uma proposta, um item, um lote, o processo inteiro);
- **a Parte Envolvida afetada**, quando fizer sentido (por exemplo, o licitante desclassificado, o adjudicatário);
- **a Versão do Orçamento afetada**, quando fizer sentido;
- **a decisão anterior que ela substitui, reforma ou anula** — uma referência opcional a outra Decisão da Licitação, formando uma cadeia histórica que nunca é apagada;
- **a data em que passou a valer**;
- **a autoridade responsável** (quem, ou qual órgão, decidiu);
- **a evidência** (o documento correspondente);
- **a justificativa**;
- **a situação de validade** (um eixo próprio — por exemplo, vigente, reformada, anulada, substituída — diferente da situação da Versão do Orçamento e da situação de aceitação de uma Relação de Rastreabilidade).

**Nem toda Decisão da Licitação possui vencedor, valor ou desconto** — esses atributos existem apenas quando fizer sentido (tipicamente em adjudicação e homologação), nunca como campos obrigatórios de toda e qualquer decisão.

A Decisão da Licitação é um registro próprio, localizado por consulta ao processo, ao lote ou ao escopo correspondente — nunca uma lista guardada dentro do Processo de Licitação e Contratação (Seção D).

**A decisão da licitação é separada da contratação**: a assinatura de um contrato, a substituição da Parte Envolvida adjudicatária pela Parte Envolvida consórcio já formalizado, ou qualquer fato de contratação **não são** uma nova Decisão da Licitação — são registrados por um Vínculo entre Licitação e Contrato (Seção M), que pode referenciar a Decisão da Licitação de homologação que o originou, sem reabri-la nem duplicá-la.

**Aplicação a um caso real de adjudicação seguida de formalização de consórcio**: representa-se por uma Decisão da Licitação de adjudicação em nome do licitante individual; um Papel da Parte no Processo (adjudicatária); uma Participação no Consórcio registrada posteriormente (a formalização do consórcio); e um Vínculo entre Licitação e Contrato que referencia essa sequência, com a Parte Envolvida Consórcio como contratada — uma única cadeia de fatos relacionados, nunca duas decisões de licitação equivalentes.

---

## M. Base Contratual da Obra e Vínculo entre Licitação e Contrato

### Vocabulário apresentado ao usuário (decisão já aprovada)

| Contexto | Termo |
|---|---|
| Nome técnico interno (código e documentação técnica) | *(ver Apêndice)* |
| Interface, relatórios, notificações, mensagens do BBA Advisor | **Base Contratual da Obra** |
| Título preferencial voltado ao usuário | **O que ficou contratado** |
| Cada item individual, na interface | **Item Contratado** |

**A palavra técnica interna nunca aparece para o usuário final** — isso é obrigatório para todo trabalho futuro de interface, experiência do usuário e mensagens do BBA Advisor.

### Modelo conceitual da Base Contratual da Obra

- Possui identidade própria; pode existir com o valor global já confirmado, mesmo que os itens contratuais ainda não estejam completamente estabelecidos.
- Um Item Contratado só pode ser criado a partir de uma fonte contratual que já discrimina os itens, ou de uma transformação explicitamente validada, auditada e vinculada às evidências do contrato — nunca por cópia automática de uma linha da proposta apenas porque os valores totais coincidem.
- Seu escopo é definido pelo Escopo da Licitação — pode cobrir o processo inteiro, um lote, ou um conjunto de lotes.
- O modelo de aditivos contratuais ainda não foi decidido — duas alternativas estão registradas, sem escolha entre elas: (a) o aditivo atualiza a mesma Base Contratual da Obra, guardando as versões anteriores; ou (b) o aditivo gera uma nova Base Contratual da Obra, ligada à anterior por uma Relação de Rastreabilidade.

### Vínculo entre Licitação e Contrato

O **Vínculo entre Licitação e Contrato** é um conceito técnico ainda provisório que registra a relação entre o Processo de Licitação e Contratação e o Contrato de Engenharia. Ele reúne conceitualmente:
- a organização usuária responsável;
- o Processo de Licitação e Contratação;
- o Escopo da Licitação (a que parte do processo o contrato se aplica);
- o Contrato de Engenharia, referenciado pelo seu **identificador interno** — nunca pelo número do contrato;
- a Parte Envolvida contratada;
- a evidência documental;
- a vigência;
- a situação do vínculo — um eixo próprio, diferente da situação da Versão do Orçamento e da situação de validade de uma Decisão da Licitação.

Ele suporta: um Processo de Licitação e Contratação com vários contratos; um contrato cobrindo vários lotes; vários lotes reunidos em um único contrato; um contrato substituído, rescindido ou recontratado (representado por um novo registro de vínculo, ligado ao anterior, nunca apagando o que existia); nenhuma dependência do número do contrato como identidade; consulta direta, sem qualquer lista guardada dentro do Processo de Licitação e Contratação.

**Bloqueio registrado**: o Contrato de Engenharia, hoje, não identifica explicitamente a qual organização usuária pertence em seu registro atual — por isso, a integração segura entre o Processo de Licitação e Contratação/Vínculo entre Licitação e Contrato e o Contrato de Engenharia ainda exige uma decisão específica de fronteira, antes de qualquer modelagem detalhada que relacione os dois.

**Ainda não decidido nesta etapa**: se o Vínculo entre Licitação e Contrato será um registro totalmente independente, uma informação interna de outro registro, ou outra forma de organização de dados. O nome permanece técnico e provisório.

---

## N. Situações, Ciclo de Vida e Encerramento

O Processo de Licitação e Contratação distingue duas camadas diferentes de informação:

**Fatos próprios e definitivos** (guardados diretamente no processo, porque só o próprio processo, como registro administrativo, pode declará-los): aberto; cancelado por completo; revogado por completo; encerrado administrativamente.

**Situações de resumo derivado** (nunca guardadas como fato próprio — sempre calculadas por uma Visão Consolidada a partir das informações associadas): publicado; em julgamento; parcialmente homologado; parcialmente contratado; com lotes fracassados. Essas situações dependem do andamento dos lotes, das versões de orçamento, das decisões da licitação e dos vínculos com contratos — guardar um resumo próprio dentro do processo criaria o risco desse resumo ficar desatualizado assim que qualquer uma dessas informações mudasse.

**Encerramento do processo**: um encerramento (cancelamento total, revogação total, encerramento administrativo) deve sempre indicar a Decisão da Licitação que o originou, quando ela existir (por exemplo, uma revogação do processo se origina de uma decisão do tipo revogação); indicar a evidência documental correspondente; e registrar sua própria data de vigência. O encerramento do processo é a **aplicação coordenada** dessa decisão — nunca uma afirmação independente e sem origem, evitando que existam duas fontes de verdade concorrentes sobre o mesmo fato de encerramento.

Nenhuma lista fechada de situações é criada para o processo, para o lote, para a versão do orçamento ou para a decisão da licitação. As situações do lote, da versão do orçamento e da validade da decisão permanecem eixos distintos, podendo coexistir em estados diferentes ao mesmo tempo, dentro do mesmo processo.

---

## O. Comandos Conceituais

| Operação | Responsável | Observação |
|---|---|---|
| Abrir Processo de Licitação e Contratação | O processo | Fato próprio |
| Encerrar Processo (cancelamento, revogação ou encerramento administrativo) | O processo | Sempre indicando a decisão de origem, quando existir (Seção N) |
| Abrir Lote da Licitação | O lote | Nunca criado artificialmente (Seção H) |
| Adicionar identificador externo | O processo | — |
| Associar Documento | Coordenação | Permitido antes da classificação, extração ou validação (Seção J) |
| Classificar Documento / Validar Documento | Camada futura de integração documental | Pré-condição apenas para o primeiro caminho da Versão do Orçamento |
| Registrar participante e seu papel | O papel da parte no processo | Associação própria, com escopo definido (Seção I) |
| Reconhecer Versão do Orçamento a partir de Documentos | A versão do orçamento | Primeiro caminho de criação (Seção K) |
| Criar Versão do Orçamento diretamente no BDOS | A versão do orçamento | Segundo caminho, sem documento de origem |
| Criar Versão do Orçamento por Transformação | A versão do orçamento | Terceiro caminho, preservando origem, regra, parâmetros e rastreabilidade |
| Registrar Decisão da Licitação | A decisão | Classificação, desclassificação, adjudicação, homologação, recurso, anulação, revogação (Seção L) |
| Estabelecer Vínculo entre Licitação e Contrato | O vínculo (forma ainda em decisão) | Referência pelo identificador interno do contrato, distinta da decisão da licitação (Seção M) |
| Estabelecer Base Contratual da Obra | A base contratual | Vocabulário de interface já aprovado (Seção M) |

---

## P. Eventos Conceituais

Os nomes técnicos definitivos dos eventos não estão sendo aprovados nesta etapa — apenas o vocabulário conceitual:

- Processo de Licitação e Contratação Aberto;
- Processo Cancelado;
- Processo Revogado;
- Lote Aberto;
- Documento Associado;
- Documento Classificado;
- Versão do Orçamento Reconhecida (a partir de documentos);
- Versão do Orçamento Criada (diretamente no BDOS);
- Versão do Orçamento Derivada (por transformação);
- Decisão da Licitação Registrada;
- Vínculo Contratual Estabelecido;
- Base Contratual da Obra Estabelecida.

---

## Q. Consistência e Coordenação entre Núcleos

Cada núcleo do domínio protege imediatamente suas próprias regras — o processo, o lote, a versão do orçamento, a decisão da licitação, a base contratual, o vínculo entre licitação e contrato, e o papel da parte no processo cada um garante, por si só e no momento da alteração, que suas próprias regras internas sejam respeitadas.

Mudanças que envolvem núcleos diferentes são coordenadas por Serviços de Aplicação, por eventos e por vínculos persistidos — nunca por uma única operação que tente garantir tudo ao mesmo tempo.

**Nenhuma operação deve carregar simultaneamente todo o processo, todos os seus lotes, todas as linhas do orçamento, todas as decisões e todos os contratos** — isso reintroduziria o risco de um núcleo gigante e difícil de manter, já descartado (Seção C/D).

A assinatura criptográfica de conteúdo de um documento é apenas um sinal de integridade — nunca uma forma isolada de evitar repetição de uma importação. A forma real de evitar repetição considera a organização usuária, a operação, a origem, o protocolo, o contexto documental, os identificadores externos e a confirmação humana quando necessária.

**Documentos chegando em paralelo**: dois arquivos recebidos ao mesmo tempo são, inicialmente, **duas Versões do Documento** distintas — nunca classificadas automaticamente como Versões do Orçamento. Somente depois de classificados, terem sua informação extraída e serem validados, esses dois documentos podem: sustentar Versões do Orçamento diferentes; sustentar a mesma Versão do Orçamento; um deles não sustentar nenhuma Versão do Orçamento; ou permanecer em uma relação documental ambígua, registrada como tal.

---

## R. Fronteiras com Outros Domínios

| Fronteira | Classificação |
|---|---|
| Camada de ingestão documental | Domínio responsável ainda pendente de decisão |
| Engenharia de Custos (este domínio) | Domínio responsável pelo Processo de Licitação e Contratação, pelo Lote da Licitação, pelo Escopo da Licitação, pela Versão do Orçamento, pela Linha do Orçamento, pela Decisão da Licitação, pela Base Contratual da Obra, pelo Vínculo entre Licitação e Contrato, pela Avaliação de Correspondência e pela Relação de Rastreabilidade |
| Contrato de Engenharia | Consultado somente leitura, sempre pelo identificador interno, por meio do Vínculo entre Licitação e Contrato; bloqueio registrado quanto à ausência da organização usuária em seu registro atual |
| Ambiente de Projetos | Sem ordem temporal fixa em relação ao Projeto de engenharia; camada futura de integração, sem que um domínio seja dono do outro em nenhuma direção |
| Pacote de Trabalho | Consultado somente leitura; sua relação com a Linha do Orçamento não é automaticamente uma Relação de Rastreabilidade |
| Ambiente de Medições | Consultado somente leitura para a Base Contratual da Obra; sem vínculo obrigatório com o Item Contratado |
| Ambiente de Finanças | Domínio consumidor futuro da Base Contratual da Obra e da Parte Envolvida contratada — ainda planejado, não construído |
| Motor de Decisão / BBA Advisor | Domínio consumidor, somente leitura; o vocabulário de interface usa "Base Contratual da Obra"/"O que ficou contratado", nunca o nome técnico interno |

---

## S. Regras Invioláveis (Invariantes)

| Regra | Por que existe |
|---|---|
| O Processo de Licitação e Contratação pertence a exatamente uma organização usuária | Já confirmado no comportamento de registros semelhantes existentes na plataforma |
| Nenhuma informação cruza de uma organização usuária para outra | Regra absoluta, protegida de forma distribuída (Seção B) |
| O processo não guarda dentro de si listas sem limite das informações associadas | Seção D |
| Nenhuma Parte Envolvida é classificada automaticamente como "de fora" por ser licitante | Seção B/I |
| Um identificador externo nunca substitui a identidade interna | Seção A/G |
| A referência ao Contrato de Engenharia usa sempre o identificador interno, nunca o número do contrato | Seção M |
| Um Lote da Licitação nunca é criado artificialmente quando o processo real não possui lotes | Seção H |
| Nenhuma informação fica limitada a "processo inteiro" ou a um único lote — usa-se o Escopo da Licitação | Seção H |
| Uma Versão do Documento pode ser associada ao processo antes de ser classificada, ter sua informação extraída ou validada; apenas o reconhecimento de uma Versão do Orçamento a partir de documentos exige isso | Seção J/K |
| Uma Versão do Orçamento pode nascer por via documental, diretamente no sistema, ou por transformação — nenhum caminho é obrigatório nem exclusivo | Seção K |
| A situação da Versão do Orçamento é diferente da situação de aceitação de uma Relação de Rastreabilidade e do Grau de Confiança da Correspondência | Seção K |
| Toda Versão do Orçamento possui origem econômica identificável, quando disponível | Seção K |
| A assinatura criptográfica de conteúdo não é, sozinha, uma forma de evitar repetição de importação; duas Versões do Documento podem compartilhar essa assinatura e continuar distintas | Seção K/Q |
| O Papel da Parte no Processo não é uma lista guardada dentro da Parte Envolvida nem dentro do processo | Seção I |
| Documentos recebidos em paralelo são Versões do Documento antes de qualquer Versão do Orçamento, nunca classificados automaticamente | Seção Q |
| Nem toda Decisão da Licitação possui vencedor, valor ou desconto — só quando fizer sentido | Seção L |
| A assinatura de um contrato ou a troca da Parte Envolvida contratada não é uma nova decisão de licitação | Seção L/M |
| O encerramento do processo sempre indica a decisão de origem, a evidência e a data de vigência — nunca é uma afirmação concorrente sem origem | Seção N |
| Um resultado agregado não cria linhas de orçamento ou itens contratados artificiais | Seção L |
| Documentos não são sobrescritos; versões não são apagadas; um processo encerrado não perde seu histórico | Princípio de preservação da origem dos dados |
| A composição formal de um consórcio possui dois ou mais membros; composição parcialmente identificada nunca é apresentada como completa; nenhum membro ou percentual é inventado para alcançar artificialmente o mínimo formal | Seção I |
| O vocabulário apresentado ao usuário (Base Contratual da Obra / Item Contratado / O que ficou contratado; o nome técnico interno nunca exposto) é obrigatório em toda interface, relatório e mensagem do BBA Advisor | Seção M |

---

## T. Questões para Aprovação

1. Nome de produto e de interface para o Processo de Licitação e Contratação.
2. Nome da futura Visão Consolidada que apresentará o resumo derivado do processo (Seção N).
3. Se o Vínculo entre Licitação e Contrato será um registro totalmente independente, uma informação interna de outro registro, ou outra forma de organização.
4. Modelo final de aditivos da Base Contratual da Obra (atualizar a mesma base vs. criar uma nova ligada à anterior).
5. Resolução do bloqueio: o Contrato de Engenharia ainda não identifica a qual organização usuária pertence.
6. Nomes finais dos campos que registram a origem econômica da Versão do Orçamento.
7. Nomes finais para o Tipo de Parte, o Escopo da Licitação, a situação da Versão do Orçamento, a situação de validade da Decisão da Licitação e a situação do Vínculo entre Licitação e Contrato.
8. Responsável definitivo pela camada de ingestão documental.
9. Fronteiras restantes com outros domínios (Ambiente de Projetos, Ambiente de Medições, Ambiente de Finanças, Motor de Execução) em nível de integração concreta.
10. Nome e localização do futuro documento arquitetural que formalizará este modelo.

---

## Apêndice — Correspondência com Nomes Internos do Código

Os nomes internos existem para implementação técnica. Eles não definem o vocabulário apresentado ao usuário e não devem aparecer na interface, nos relatórios, nas mensagens do BBA Advisor ou na documentação de produto.

| Conceito em português | Nome interno atual ou candidato |
|---|---|
| Processo de Licitação e Contratação | `ProcurementCase` |
| Lote da Licitação | `ProcurementLot` |
| Escopo da Licitação | `ProcurementScope` |
| Decisão da Licitação | `ProcurementDecision` |
| Vínculo entre Licitação e Contrato | `ProcurementContractAssociation` |
| Organização usuária | `tenant` / `tenantId` |
| Parte Envolvida | `Party` |
| Identificador da Parte | `PartyIdentifier` |
| Tipo de Parte | `PartyKind` |
| Organização (tipo de parte) | `Organization` |
| Pessoa Física (tipo de parte) | `Individual` |
| Papel da Parte no Processo | `PartyRoleAssignment` |
| Participação no Consórcio | `ConsortiumMembership` |
| Documento | `DocumentArtifact` |
| Versão do Documento | `DocumentVersion` |
| Versão do Orçamento | `BudgetVersion` |
| Linha do Orçamento | `BudgetLine` |
| Contrato de Engenharia | `EngineeringContract` |
| Base Contratual da Obra | `ContractBaseline` |
| Item Contratado | `ContractBaselineItem` |
| Avaliação de Correspondência | `ReconciliationAssessment` |
| Relação de Rastreabilidade | `LineageRelation` |
| Grau de Confiança da Correspondência | `MatchConfidence` |
| Situação da Relação de Rastreabilidade | `DecisionStatus` |
| Tipo da Relação de Rastreabilidade | `RelationKind` |
| Conjunto de Alterações (descritivo) | `ChangeSet` |
| Assinatura criptográfica do conteúdo | `contentHash` |
| Núcleo coordenador enxuto | *(padrão arquitetural — aggregate coordenador, sem nome de tipo próprio)* |
| Ambiente de Projetos | `Project Studio` |
| Ambiente de Medições | `Measurement Studio` |
| Ambiente de Finanças | `Finance Studio` |

---

## Verificação de Vocabulário

Revisão textual realizada antes da apresentação final, conforme exigido:

| Verificação | Resultado |
|---|---|
| Documento principal integralmente em português | Confirmado |
| Termos técnicos em inglês restritos ao Apêndice | Confirmado |
| "Baseline" ausente da linguagem de produto | Confirmado |
| "Workspace", "bytes" e "Studio" ausentes do documento principal | Confirmado |
| Decisões arquiteturais preservadas | Confirmado |
| Nenhuma implementação realizada | Confirmado |
| Nenhum arquivo alterado | Confirmado |

---

## Status

Status: Aprovado — vocabulário integralmente em português no documento principal, nomes técnicos internos restritos ao Apêndice.

Nenhuma implementação realizada.
Nenhum arquivo alterado além desta gravação.
Nenhum commit realizado.
