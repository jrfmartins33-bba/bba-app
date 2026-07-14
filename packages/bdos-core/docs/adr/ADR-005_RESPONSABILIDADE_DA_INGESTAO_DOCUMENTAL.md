# ADR-005: Responsabilidade pela Ingestão Documental na Engenharia de Custos e Licitações

Status: Aprovado

Esta decisão encerra o Gatilho 7 do Mapa de Domínio e autoriza o planejamento detalhado da Sprint 21.4A. Não autoriza antecipadamente decisões físicas mantidas como abertas nem a implementação de formatos documentais não selecionados.

## 1. Contexto

A Engenharia de Custos e Licitações precisa receber documentos orçamentários, preservar sua evidência original e permitir que dados extraídos desses documentos sustentem, após revisão adequada, uma Versão do Orçamento.

Os ADRs anteriores estabeleceram que documentos são evidências, não identidades econômicas. Também estabeleceram que a inteligência artificial explica e apoia, enquanto o BDOS decide, calcula e preserva rastreabilidade.

A implementação atual de Engenharia de Custos e Licitações já possui Processo de Licitação e Contratação, lote, Versão do Orçamento, linhas orçamentárias, estado de rascunho, estado consolidado, totalização e persistência protegida por organização usuária.

A origem documental atualmente existente é uma referência documental opaca. Ela permite apontar para evidências já existentes, mas não resolve, por si só, a responsabilidade pela ingestão documental.

Também existe a Reconstrução Documental, que pode organizar estrutura lógica, seções, campos, fontes, completude e prontidão. Ela não é, atualmente, responsável por envio de arquivo, armazenamento, leitura física de arquivos, reconhecimento óptico de texto ou interpretação econômica.

Portanto, antes da Sprint 21.4A, era necessário decidir quem é responsável por preservar o documento, processar sua versão concreta, produzir evidência estruturada neutra e entregar essa evidência para a Engenharia de Custos e Licitações.

## 2. Decisao

A alternativa selecionada e a responsabilidade dividida por fronteira explicita.

A capacidade de aplicacao e infraestrutura documental sera responsavel por preservar Documento e Versao do Documento, executar Tentativas de Processamento Documental e produzir evidencia estruturada neutra.

A Reconstrucao Documental podera ser reutilizada para reconstrucao logica a partir da evidencia tecnica disponivel, quando aplicavel.

A Engenharia de Custos e Licitacoes sera responsavel por interpretar economicamente a evidencia, aplicar regras deterministicas, distinguir dados confirmados, premissas propostas e lacunas economicas, e criar a Versao do Orcamento em rascunho somente apos comando humano explicito.

Os Servicos de Aplicacao coordenarao o acesso a Versao do Documento, a solicitacao do processamento, a obtencao da evidencia, a aplicacao das regras economicas, a criacao da Proposta de Importacao do Orcamento, a revisao humana, a materializacao e a preservacao da rastreabilidade.

A inteligencia artificial podera sugerir, explicar e apoiar a revisao, mas nao podera confirmar sozinha fato economico, correspondencia economica, materializacao ou consolidacao.

## 3. Conceitos

### Documento

Documento e o registro logico de um documento ao longo do tempo.

O nome interno previsto pelos ADRs anteriores e `DocumentArtifact`, mas o conceito principal neste ADR e Documento.

O Documento nao e uma Versao do Orcamento e nao representa, por si so, uma verdade economica.

### Versao do Documento

Versao do Documento e uma versao concreta e imutavel de um arquivo.

Ela preserva conceitualmente:

- identidade;
- organizacao usuaria;
- arquivo correspondente;
- resumo criptografico;
- nome;
- tipo MIME;
- tamanho;
- referencia segura de armazenamento;
- data;
- autor do envio.

Uma mudanca nos bytes ou no conteudo do arquivo produz nova Versao do Documento.

A Versao do Documento nao deve receber estados operacionais de processamento. Ela e a evidencia preservada.

O nome interno previsto pelos ADRs anteriores e `DocumentVersion`, mas o conceito principal neste ADR e Versao do Documento.

### Tentativa de Processamento Documental

Tentativa de Processamento Documental e uma execucao especifica realizada sobre determinada Versao do Documento.

Ela pode possuir estados conceituais como:

- solicitada;
- processando;
- concluida;
- concluida parcialmente;
- falhou;
- abandonada.

O reprocessamento da mesma Versao do Documento cria nova tentativa, nao nova Versao do Documento.

Cada tentativa deve preservar:

- Versao do Documento processada;
- mecanismo e versao do extrator;
- inicio;
- termino;
- resultado;
- falhas;
- lacunas tecnicas;
- referencias a evidencia produzida.

Este ADR nao fecha a representacao fisica da tentativa.

### Evidencia Estruturada Neutra

Evidencia Estruturada Neutra e o resultado tecnico produzido a partir de uma Tentativa de Processamento Documental.

Ela pode conter:

- paginas;
- abas;
- tabelas;
- linhas;
- colunas;
- celulas;
- coordenadas;
- posicoes;
- formulas;
- valores brutos;
- valores exibidos;
- texto reconhecido;
- confianca tecnica;
- lacunas tecnicas.

A evidencia estruturada neutra nao classifica economicamente uma linha como Grupo, Subgrupo ou Item de Servico.

### Caracterizacao Economica

Caracterizacao Economica e a atividade ou resultado intermediario pelo qual a Engenharia de Custos e Licitacoes interpreta a evidencia estruturada neutra.

Ela pode identificar candidatos a:

- Grupo;
- Subgrupo;
- Item de Servico;
- subtotal;
- total;
- nota;
- cabecalho;
- separador;
- residuo;
- elemento ambiguo.

Caracterizacao Economica nao e sinonimo de Proposta de Importacao do Orcamento.

### Estados da informacao e confirmacao

Dado confirmado somente pode designar um valor ou significado diretamente sustentado pela fonte documental ou por regra deterministica formalmente aprovada para aquele contexto. Confianca tecnica da extracao, reconhecimento optico de texto ou leitura da celula nao confirma, por si so, o significado economico do dado.

Presenca tecnica na fonte nao equivale automaticamente a confirmacao economica.

Uma classificacao economica pode permanecer proposta mesmo quando o texto ou valor foi extraido exatamente.

Premissa proposta continua premissa ate reclassificacao explicita.

Lacuna documental nao pode ser convertida em dado confirmado pela inteligencia artificial.

Validacao humana deve preservar a fonte, a decisao, o ator e a data.

Validacao humana nao pode apagar proveniencia.

Quando aplicavel, a Proposta de Importacao do Orcamento deve preservar separadamente:

- estado da evidencia documental;
- estado da interpretacao economica;
- decisao da revisao humana.

Este ADR nao cria enumeracoes tecnicas nem representacao fisica para esses estados.

### Proposta de Importacao do Orcamento

Proposta de Importacao do Orcamento e o registro revisavel que reune os resultados da ingestao documental e da caracterizacao economica.

Ela nao e uma Versao do Orcamento.

Ela nao e fonte definitiva da verdade economica.

Ela nao e um segundo nucleo de orcamento.

Ela nao e consolidavel.

Ela nao substitui as invariantes da Versao do Orcamento.

Ela nao deve duplicar o motor definitivo de totalizacao.

Ela nao deve duplicar todas as operacoes do dominio economico.

Ela deve preservar:

- Versao do Documento de origem;
- Tentativa de Processamento utilizada;
- candidatos extraidos;
- classificacoes propostas;
- hierarquia proposta;
- referencias documentais;
- dados confirmados;
- premissas propostas;
- lacunas documentais;
- lacunas economicas;
- divergencias;
- decisoes humanas;
- estado da revisao;
- resultado da materializacao, quando ocorrer.

Estados conceituais minimos podem incluir:

- criada;
- precisa de revisao;
- pronta para materializacao;
- rejeitada;
- abandonada;
- materializada.

Este ADR nao fecha nomes tecnicos, tabelas ou formato fisico da Proposta de Importacao do Orcamento.

## 4. Responsabilidades

### Capacidade de Aplicacao e Infraestrutura Documental

E responsavel por:

- receber a referencia do arquivo;
- preservar Documento;
- preservar Versao do Documento;
- realizar armazenamento seguro;
- registrar resumo criptografico;
- registrar tipo MIME;
- registrar tamanho;
- realizar leitura fisica de XLSX e PDF;
- realizar reconhecimento optico de texto, quando aplicavel;
- identificar de forma neutra paginas, abas, tabelas, linhas, colunas e celulas;
- preservar formulas, valores brutos e valores exibidos;
- preservar coordenadas e posicoes;
- registrar lacunas tecnicas;
- registrar Tentativas de Processamento Documental;
- produzir evidencia estruturada neutra.

Nao classifica economicamente a evidencia.

Nao decide Grupo, Subgrupo ou Item de Servico.

Nao decide suficiencia economica.

Nao cria Versao do Orcamento.

Nao consolida orcamento.

### Reconstrucao Documental

A Reconstrucao Documental pode ser reutilizada para reconstruir estrutura logica a partir da evidencia tecnica disponivel, quando aplicavel.

Ela nao le armazenamento diretamente dentro do dominio puro.

Ela nao e responsavel, atualmente, por envio de arquivo, armazenamento ou leitura fisica de arquivos.

Ela nao deve receber responsabilidade economica.

Ela nao deve ser declarada dona universal da ingestao documental.

Ela nao decide Grupo, Subgrupo, Item de Servico, preco, quantidade, BDI, composicao ou consolidacao.

### Engenharia de Custos e Licitacoes

E responsavel por:

- regras deterministicas de caracterizacao economica;
- candidatos a Grupo, Subgrupo e Item de Servico;
- identificacao de subtotal, total, nota, cabecalho, separador e residuo;
- hierarquia economica proposta;
- valores economicos candidatos;
- dados confirmados;
- premissas propostas;
- lacunas economicas;
- divergencias;
- suficiencia para materializacao;
- criacao da Versao do Orcamento em rascunho;
- edicao economica posterior;
- consolidacao explicita.

A Engenharia de Custos e Licitacoes nao deve colocar detalhes de planilha ou PDF diretamente dentro da Versao do Orcamento.

### Servicos de Aplicacao

Sao responsaveis por coordenar:

- acesso a Versao do Documento;
- solicitacao do processamento;
- obtencao da evidencia estruturada;
- aplicacao das regras economicas;
- criacao da Proposta de Importacao do Orcamento;
- revisao humana;
- materializacao da proposta;
- preservacao da rastreabilidade.

Os Servicos de Aplicacao nao substituem as invariantes do dominio economico.

### Usuario Autorizado

E responsavel por:

- revisar;
- corrigir;
- incluir;
- excluir;
- resolver lacunas;
- aceitar classificacoes propostas;
- rejeitar classificacoes propostas;
- comandar a materializacao;
- comandar a consolidacao.

### Inteligencia Artificial

A inteligencia artificial apenas sugere, explica e apoia a revisao.

Ela pode:

- sugerir candidatos;
- ordenar candidatos;
- explicar diferencas;
- resumir lacunas;
- apontar divergencias;
- apoiar a revisao humana.

Ela nao pode:

- inventar codigo, descricao, unidade, quantidade, preco ou total;
- confirmar fato economico;
- confirmar correspondencia economica sozinha;
- materializar proposta;
- consolidar orcamento;
- transformar evidencia insuficiente em dado confirmado.

## 5. Fluxo Conceitual

```text
Documento
  -> Versao do Documento
    -> nova Versao do Documento quando o arquivo mudar
    -> Tentativa de Processamento Documental 1
      -> falha tecnica
      -> processamento parcial
      -> evidencia estruturada neutra
        -> ausencia de tabela
        -> multiplas tabelas
        -> multiplos orcamentos candidatos
        -> caracterizacao economica
          -> Proposta de Importacao do Orcamento
            -> revisao humana
              -> rejeicao
              -> abandono
              -> pronta para materializacao
                -> comando humano explicito
                  -> Versao do Orcamento em rascunho
                    -> edicao economica
                    -> consolidacao explicita
    -> Tentativa de Processamento Documental 2
      -> reprocessamento da mesma Versao do Documento
      -> nova evidencia estruturada neutra
```

Nenhuma etapa promove automaticamente evidencia documental a Versao do Orcamento.

Nenhuma etapa consolida automaticamente orcamento.

Nenhuma decisao da inteligencia artificial materializa ou consolida orcamento.

## 6. Materializacao

A materializacao deve seguir o fluxo:

1. A Proposta de Importacao do Orcamento e criada.
2. O usuario revisa e resolve as pendencias necessarias.
3. O usuario executa comando explicito para materializar.
4. O Servico de Aplicacao transforma a proposta revisada em entradas para o dominio.
5. O dominio cria a Versao do Orcamento em rascunho.
6. A Proposta de Importacao do Orcamento preserva a identidade da versao materializada.
7. A proposta utilizada na materializacao fica preservada como fotografia auditavel.
8. Alteracoes economicas posteriores utilizam os Servicos de Aplicacao e o dominio de Versao do Orcamento.
9. A consolidacao permanece uma acao humana posterior e independente.

Nao e permitido:

- materializacao automatica pelo processamento;
- materializacao automatica pela inteligencia artificial;
- consolidacao automatica;
- alteracao silenciosa da proposta ja materializada;
- alteracao da Versao do Orcamento por meio da proposta depois da materializacao.

Caso seja necessario corrigir a importacao apos a materializacao, a correcao deve ocorrer na Versao do Orcamento em rascunho ou em nova proposta/reprocessamento explicitamente registrado, sem sobrescrever o historico.

## 7. Proveniencia

A evidencia minima podera ser associada:

- a proposta inteira;
- a um candidato de linha;
- a um campo especifico do candidato.

Campos que podem exigir proveniencia independente:

- codigo externo;
- descricao;
- unidade;
- quantidade;
- preco unitario;
- valor total;
- classificacao;
- pai ou hierarquia;
- posicao;
- Escopo da Licitacao.

Uma linha podera combinar evidencias de multiplas celulas.

A referencia devera poder preservar, quando disponivel:

- Documento;
- Versao do Documento;
- Tentativa de Processamento Documental;
- pagina;
- aba;
- tabela;
- linha;
- coluna;
- celula;
- coordenada;
- valor bruto;
- valor exibido;
- formula;
- regra de extracao;
- regra de caracterizacao economica;
- decisao humana.

Essas referencias pertencem a Proposta de Importacao do Orcamento e as Relacoes de Rastreabilidade.

Detalhes de planilha ou PDF nao devem ser colocados diretamente dentro do dominio de Versao do Orcamento.

## 8. Relacao de Rastreabilidade e Avaliacao de Correspondencia

### Relacao de Rastreabilidade

Relacao de Rastreabilidade e o vinculo conhecido de origem, derivacao, incorporacao ou continuidade.

Exemplos:

- candidato extraido de determinada celula;
- Linha do Orcamento materializada a partir de determinado candidato;
- Versao do Orcamento criada a partir de determinada proposta.

A Relacao de Rastreabilidade preserva origem e derivacao. Ela nao resolve, por si so, identidade entre registros independentes.

### Avaliacao de Correspondencia

Avaliacao de Correspondencia e o julgamento sobre possivel identidade entre registros criados independentemente.

Este ADR nao define regra universal de correspondencia automatica.

A Avaliacao de Correspondencia somente pode ser confirmada automaticamente quando existir uma regra deterministica formalmente aprovada para aquele contexto.

Na ausencia dessa regra, diante de multiplos candidatos, divergencias ou evidencia insuficiente, o resultado permanece proposto e depende de validacao humana.

A inteligencia artificial pode sugerir candidatos, ordenar candidatos e explicar diferencas.

A inteligencia artificial nao confirma sozinha correspondencia economica.

## 9. Seguranca e Organizacao Usuaria

Toda ingestao documental deve respeitar a organizacao usuaria.

A organizacao usuaria deve ser resolvida no servidor quando houver operacao sensivel.

O navegador nao deve ser autoridade final para informar a organizacao usuaria.

Referencias documentais nao podem atravessar organizacoes usuarias.

Uma Versao do Documento so pode sustentar Proposta de Importacao do Orcamento e Versao do Orcamento compativeis com a mesma organizacao usuaria e com o Escopo da Licitacao aplicavel.

Escritas sensiveis devem permanecer protegidas por servicos no servidor.

## 10. Impacto na Sprint 21.4A

A Sprint 21.4A deve ser Ingestao documental e Proposta de Importacao do Orcamento.

Ela deve entregar, no maximo:

- registro de Documento e Versao do Documento, no nivel necessario;
- Tentativa de Processamento Documental;
- leitura tecnica do primeiro formato aprovado;
- evidencia estruturada neutra;
- caracterizacao economica deterministica inicial;
- Proposta de Importacao do Orcamento persistida;
- dados confirmados, premissas propostas e lacunas distinguiveis;
- proveniencia;
- falhas e processamento parcial;
- nenhuma Versao do Orcamento criada automaticamente;
- nenhuma consolidacao.

Este ADR nao promete suporte completo simultaneo a XLSX, PDF textual e PDF digitalizado.

A Sprint devera escolher a primeira fatia real conforme o documento oficial disponivel e a capacidade existente.

Decisoes futuras da propria Sprint 21.4A incluem, quando aplicavel:

- primeiro formato documental;
- contrato fisico minimo da evidencia;
- representacao fisica minima da proposta;
- politica minima de reprocessamento.

## 11. Impacto na Sprint 21.4B

A Sprint 21.4B deve ser revisao visual orientada a decisao e materializacao.

Ela deve entregar:

- espaco visual de revisao;
- correcao de classificacoes;
- inclusao de item ausente;
- alteracao de descricao, codigo, valor e posicao;
- criacao de Grupo ou Subgrupo quando necessario;
- exclusao de linha nao economica;
- resolucao de lacunas;
- origem documental sob demanda;
- confronto entre total declarado e calculado;
- comando explicito de materializacao;
- criacao da Versao do Orcamento em rascunho;
- edicao posterior usando os Servicos de Aplicacao ja existentes;
- comando separado de consolidacao.

A interface deve comunicar:

- status;
- problema;
- impacto;
- proxima acao;
- detalhes sob demanda.

A interface nao deve ter aparencia de ERP.

## 12. Decisoes Fisicas Mantidas Abertas

Este ADR nao decide:

- nomes finais de tabelas;
- modulos fisicos;
- pastas;
- fornecedor de reconhecimento optico de texto;
- biblioteca de leitura;
- formato final do contrato de evidencia;
- banco ou formato da Proposta de Importacao do Orcamento;
- politica final de reprocessamento;
- suporte simultaneo a todos os formatos;
- mecanismo universal de documentos para todo o BDOS.

A decomposicao fisica devera seguir generalizacao tardia.

A primeira implementacao deve resolver a fatia concreta da Sprint sem congelar uma arquitetura universal antes da necessidade real.

## 13. Alternativas Rejeitadas

### Reconstrucao Documental como responsavel por tudo

Rejeitada porque colocaria interpretacao economica em uma capacidade que deve permanecer documental e logica.

Essa alternativa faria a reconstrucao decidir Grupo, Subgrupo, Item de Servico, suficiencia economica e materializacao, o que viola a separacao definida pelos ADRs anteriores.

### Engenharia de Custos e Licitacoes como responsavel por tudo

Rejeitada porque colocaria leitura fisica de arquivos, reconhecimento optico de texto, armazenamento, resumo criptografico e detalhes de planilha/PDF dentro do dominio economico.

Essa alternativa dificultaria reutilizacao, rastreabilidade e evolucao futura.

### Proposta de Importacao como segunda Versao do Orcamento

Rejeitada porque duplicaria o dominio economico, criaria dois lugares para editar orcamento e enfraqueceria as invariantes da Versao do Orcamento.

A Proposta de Importacao do Orcamento e revisavel e auditavel, mas nao e consolidavel e nao substitui a Versao do Orcamento.

## 14. Consequencias

A ingestao documental fica separada da interpretacao economica.

A Versao do Documento permanece imutavel e livre de estados operacionais de processamento.

O reprocessamento passa a ser registrado como nova tentativa.

A Proposta de Importacao do Orcamento cria uma area segura de revisao antes da Versao do Orcamento.

A materializacao passa a ser explicita, auditavel e humana.

A consolidacao continua explicita e posterior.

A inteligencia artificial permanece auxiliar.

A decomposicao fisica permanece aberta para generalizacao tardia.

## 15. Criterios de Aceite Arquitetural

Esta decisao sera respeitada quando:

- Documento, Versao do Documento e Tentativa de Processamento Documental estiverem conceitualmente separados;
- a Versao do Documento nao carregar estados de processamento;
- a ingestao produzir evidencia estruturada neutra;
- a Engenharia de Custos e Licitacoes fizer a interpretacao economica;
- a Proposta de Importacao do Orcamento for revisavel e nao consolidavel;
- a Versao do Orcamento nascer somente por materializacao explicita;
- a proposta materializada ficar preservada como fotografia auditavel;
- alteracoes posteriores ocorrerem na Versao do Orcamento em rascunho ou em nova proposta/reprocessamento;
- a rastreabilidade puder chegar ao campo especifico quando houver evidencia;
- a Avaliacao de Correspondencia nao for automatica sem regra deterministica formalmente aprovada;
- a inteligencia artificial nao confirmar sozinha fatos economicos;
- a decomposicao fisica permanecer aberta ate necessidade real.
