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

## 2. Decisão

A alternativa selecionada é a responsabilidade dividida por fronteira explícita.

A capacidade de aplicação e infraestrutura documental será responsável por preservar Documento e Versão do Documento, executar Tentativas de Processamento Documental e produzir evidência estruturada neutra.

A Reconstrução Documental poderá ser reutilizada para reconstrução lógica a partir da evidência técnica disponível, quando aplicável.

A Engenharia de Custos e Licitações será responsável por interpretar economicamente a evidência, aplicar regras determinísticas, distinguir dados confirmados, premissas propostas e lacunas econômicas, e criar a Versão do Orçamento em rascunho somente após comando humano explícito.

Os Serviços de Aplicação coordenarão o acesso à Versão do Documento, a solicitação do processamento, a obtenção da evidência, a aplicação das regras econômicas, a criação da Proposta de Importação do Orçamento, a revisão humana, a materialização e a preservação da rastreabilidade.

A inteligência artificial poderá sugerir, explicar e apoiar a revisão, mas não poderá confirmar sozinha fato econômico, correspondência econômica, materialização ou consolidação.

## 3. Conceitos

### Documento

Documento é o registro lógico de um documento ao longo do tempo.

O nome interno previsto pelos ADRs anteriores é `DocumentArtifact`, mas o conceito principal neste ADR é Documento.

O Documento não é uma Versão do Orçamento e não representa, por si só, uma verdade econômica.

### Versão do Documento

Versão do Documento é uma versão concreta e imutável de um arquivo.

Ela preserva conceitualmente:

- identidade;
- organização usuária;
- arquivo correspondente;
- resumo criptográfico;
- nome;
- tipo MIME;
- tamanho;
- referência segura de armazenamento;
- data;
- autor do envio.

Uma mudança nos bytes ou no conteúdo do arquivo produz nova Versão do Documento.

A Versão do Documento não deve receber estados operacionais de processamento. Ela é a evidência preservada.

O nome interno previsto pelos ADRs anteriores é `DocumentVersion`, mas o conceito principal neste ADR é Versão do Documento.

### Tentativa de Processamento Documental

Tentativa de Processamento Documental é uma execução específica realizada sobre determinada Versão do Documento.

Ela pode possuir estados conceituais como:

- solicitada;
- processando;
- concluída;
- concluída parcialmente;
- falhou;
- abandonada.

O reprocessamento da mesma Versão do Documento cria nova tentativa, não nova Versão do Documento.

Cada tentativa deve preservar:

- Versão do Documento processada;
- mecanismo e versão do extrator;
- início;
- término;
- resultado;
- falhas;
- lacunas técnicas;
- referências à evidência produzida.

Este ADR não fecha a representação física da tentativa.

### Evidência Estruturada Neutra

Evidência Estruturada Neutra é o resultado técnico produzido a partir de uma Tentativa de Processamento Documental.

Ela pode conter:

- páginas;
- abas;
- tabelas;
- linhas;
- colunas;
- células;
- coordenadas;
- posições;
- fórmulas;
- valores brutos;
- valores exibidos;
- texto reconhecido;
- confiança técnica;
- lacunas técnicas.

A evidência estruturada neutra não classifica economicamente uma linha como Grupo, Subgrupo ou Item de Serviço.

### Caracterização Econômica

Caracterização Econômica é a atividade ou resultado intermediário pelo qual a Engenharia de Custos e Licitações interpreta a evidência estruturada neutra.

Ela pode identificar candidatos a:

- Grupo;
- Subgrupo;
- Item de Serviço;
- subtotal;
- total;
- nota;
- cabeçalho;
- separador;
- resíduo;
- elemento ambíguo.

Caracterização Econômica não é sinônimo de Proposta de Importação do Orçamento.

### Estados da informação e confirmação

Dado confirmado somente pode designar um valor ou significado diretamente sustentado pela fonte documental ou por regra determinística formalmente aprovada para aquele contexto. Confiança técnica da extração, reconhecimento óptico de texto ou leitura da célula não confirma, por si só, o significado econômico do dado.

Presença técnica na fonte não equivale automaticamente a confirmação econômica.

Uma classificação econômica pode permanecer proposta mesmo quando o texto ou valor foi extraído exatamente.

Premissa proposta continua premissa até reclassificação explícita.

Lacuna documental não pode ser convertida em dado confirmado pela inteligência artificial.

Validação humana deve preservar a fonte, a decisão, o ator e a data.

Validação humana não pode apagar proveniência.

Quando aplicável, a Proposta de Importação do Orçamento deve preservar separadamente:

- estado da evidência documental;
- estado da interpretação econômica;
- decisão da revisão humana.

Este ADR não cria enumerações técnicas nem representação física para esses estados.

### Proposta de Importação do Orçamento

Proposta de Importação do Orçamento é o registro revisável que reúne os resultados da ingestão documental e da caracterização econômica.

Ela não é uma Versão do Orçamento.

Ela não é fonte definitiva da verdade econômica.

Ela não é um segundo núcleo de orçamento.

Ela não é consolidável.

Ela não substitui as invariantes da Versão do Orçamento.

Ela não deve duplicar o motor definitivo de totalização.

Ela não deve duplicar todas as operações do domínio econômico.

Ela deve preservar:

- Versão do Documento de origem;
- Tentativa de Processamento utilizada;
- candidatos extraídos;
- classificações propostas;
- hierarquia proposta;
- referências documentais;
- dados confirmados;
- premissas propostas;
- lacunas documentais;
- lacunas econômicas;
- divergências;
- decisões humanas;
- estado da revisão;
- resultado da materialização, quando ocorrer.

Estados conceituais mínimos podem incluir:

- criada;
- precisa de revisão;
- pronta para materialização;
- rejeitada;
- abandonada;
- materializada.

Este ADR não fecha nomes técnicos, tabelas ou formato físico da Proposta de Importação do Orçamento.

## 4. Responsabilidades

### Capacidade de Aplicação e Infraestrutura Documental

É responsável por:

- receber a referência do arquivo;
- preservar Documento;
- preservar Versão do Documento;
- realizar armazenamento seguro;
- registrar resumo criptográfico;
- registrar tipo MIME;
- registrar tamanho;
- realizar leitura física de XLSX e PDF;
- realizar reconhecimento óptico de texto, quando aplicável;
- identificar de forma neutra páginas, abas, tabelas, linhas, colunas e células;
- preservar fórmulas, valores brutos e valores exibidos;
- preservar coordenadas e posições;
- registrar lacunas técnicas;
- registrar Tentativas de Processamento Documental;
- produzir evidência estruturada neutra.

Não classifica economicamente a evidência.

Não decide Grupo, Subgrupo ou Item de Serviço.

Não decide suficiência econômica.

Não cria Versão do Orçamento.

Não consolida orçamento.

### Reconstrução Documental

A Reconstrução Documental pode ser reutilizada para reconstruir estrutura lógica a partir da evidência técnica disponível, quando aplicável.

Ela não lê armazenamento diretamente dentro do domínio puro.

Ela não é responsável, atualmente, por envio de arquivo, armazenamento ou leitura física de arquivos.

Ela não deve receber responsabilidade econômica.

Ela não deve ser declarada dona universal da ingestão documental.

Ela não decide Grupo, Subgrupo, Item de Serviço, preço, quantidade, BDI, composição ou consolidação.

### Engenharia de Custos e Licitações

É responsável por:

- regras determinísticas de caracterização econômica;
- candidatos a Grupo, Subgrupo e Item de Serviço;
- identificação de subtotal, total, nota, cabeçalho, separador e resíduo;
- hierarquia econômica proposta;
- valores econômicos candidatos;
- dados confirmados;
- premissas propostas;
- lacunas econômicas;
- divergências;
- suficiência para materialização;
- criação da Versão do Orçamento em rascunho;
- edição econômica posterior;
- consolidação explícita.

A Engenharia de Custos e Licitações não deve colocar detalhes de planilha ou PDF diretamente dentro da Versão do Orçamento.

### Serviços de Aplicação

São responsáveis por coordenar:

- acesso à Versão do Documento;
- solicitação do processamento;
- obtenção da evidência estruturada;
- aplicação das regras econômicas;
- criação da Proposta de Importação do Orçamento;
- revisão humana;
- materialização da proposta;
- preservação da rastreabilidade.

Os Serviços de Aplicação não substituem as invariantes do domínio econômico.

### Usuário Autorizado

É responsável por:

- revisar;
- corrigir;
- incluir;
- excluir;
- resolver lacunas;
- aceitar classificações propostas;
- rejeitar classificações propostas;
- comandar a materialização;
- comandar a consolidação.

### Inteligência Artificial

A inteligência artificial apenas sugere, explica e apoia a revisão.

Ela pode:

- sugerir candidatos;
- ordenar candidatos;
- explicar diferenças;
- resumir lacunas;
- apontar divergências;
- apoiar a revisão humana.

Ela não pode:

- inventar código, descrição, unidade, quantidade, preço ou total;
- confirmar fato econômico;
- confirmar correspondência econômica sozinha;
- materializar proposta;
- consolidar orçamento;
- transformar evidência insuficiente em dado confirmado.

## 5. Fluxo Conceitual

```text
Documento
  -> Versão do Documento
    -> nova Versão do Documento quando o arquivo mudar
    -> Tentativa de Processamento Documental 1
      -> falha técnica
      -> processamento parcial
      -> evidência estruturada neutra
        -> ausência de tabela
        -> múltiplas tabelas
        -> múltiplos orçamentos candidatos
        -> caracterização econômica
          -> Proposta de Importação do Orçamento
            -> revisão humana
              -> rejeição
              -> abandono
              -> pronta para materialização
                -> comando humano explícito
                  -> Versão do Orçamento em rascunho
                    -> edição econômica
                    -> consolidação explícita
    -> Tentativa de Processamento Documental 2
      -> reprocessamento da mesma Versão do Documento
      -> nova evidência estruturada neutra
```

Nenhuma etapa promove automaticamente evidência documental a Versão do Orçamento.

Nenhuma etapa consolida automaticamente orçamento.

Nenhuma decisão da inteligência artificial materializa ou consolida orçamento.

## 6. Materialização

A materialização deve seguir o fluxo:

1. A Proposta de Importação do Orçamento é criada.
2. O usuário revisa e resolve as pendências necessárias.
3. O usuário executa comando explícito para materializar.
4. O Serviço de Aplicação transforma a proposta revisada em entradas para o domínio.
5. O domínio cria a Versão do Orçamento em rascunho.
6. A Proposta de Importação do Orçamento preserva a identidade da versão materializada.
7. A proposta utilizada na materialização fica preservada como fotografia auditável.
8. Alterações econômicas posteriores utilizam os Serviços de Aplicação e o domínio de Versão do Orçamento.
9. A consolidação permanece uma ação humana posterior e independente.

Não é permitido:

- materialização automática pelo processamento;
- materialização automática pela inteligência artificial;
- consolidação automática;
- alteração silenciosa da proposta já materializada;
- alteração da Versão do Orçamento por meio da proposta depois da materialização.

Caso seja necessário corrigir a importação após a materialização, a correção deve ocorrer na Versão do Orçamento em rascunho ou em nova proposta/reprocessamento com registro explícito, sem sobrescrever o histórico.

## 7. Proveniência

A evidência mínima poderá ser associada:

- à proposta inteira;
- a um candidato de linha;
- a um campo específico do candidato.

Campos que podem exigir proveniência independente:

- código externo;
- descrição;
- unidade;
- quantidade;
- preço unitário;
- valor total;
- classificação;
- pai ou hierarquia;
- posição;
- Escopo da Licitação.

Uma linha poderá combinar evidências de múltiplas células.

A referência deverá poder preservar, quando disponível:

- Documento;
- Versão do Documento;
- Tentativa de Processamento Documental;
- página;
- aba;
- tabela;
- linha;
- coluna;
- célula;
- coordenada;
- valor bruto;
- valor exibido;
- fórmula;
- regra de extração;
- regra de caracterização econômica;
- decisão humana.

Essas referências pertencem à Proposta de Importação do Orçamento e às Relações de Rastreabilidade.

Detalhes de planilha ou PDF não devem ser colocados diretamente dentro do domínio de Versão do Orçamento.

## 8. Relação de Rastreabilidade e Avaliação de Correspondência

### Relação de Rastreabilidade

Relação de Rastreabilidade é o vínculo conhecido de origem, derivação, incorporação ou continuidade.

Exemplos:

- candidato extraído de determinada célula;
- Linha do Orçamento materializada a partir de determinado candidato;
- Versão do Orçamento criada a partir de determinada proposta.

A Relação de Rastreabilidade preserva origem e derivação. Ela não resolve, por si só, identidade entre registros independentes.

### Avaliação de Correspondência

Avaliação de Correspondência é o julgamento sobre possível identidade entre registros criados independentemente.

Este ADR não define regra universal de correspondência automática.

A Avaliação de Correspondência somente pode ser confirmada automaticamente quando existir uma regra determinística formalmente aprovada para aquele contexto.

Na ausência dessa regra, diante de múltiplos candidatos, divergências ou evidência insuficiente, o resultado permanece proposto e depende de validação humana.

A inteligência artificial pode sugerir candidatos, ordenar candidatos e explicar diferenças.

A inteligência artificial não confirma sozinha correspondência econômica.

## 9. Segurança e Organização Usuária

Toda ingestão documental deve respeitar a organização usuária.

A organização usuária deve ser resolvida no servidor quando houver operação sensível.

O navegador não deve ser autoridade final para informar a organização usuária.

Referências documentais não podem atravessar organizações usuárias.

Uma Versão do Documento só pode sustentar Proposta de Importação do Orçamento e Versão do Orçamento compatíveis com a mesma organização usuária e com o Escopo da Licitação aplicável.

Escritas sensíveis devem permanecer protegidas por serviços no servidor.

## 10. Impacto na Sprint 21.4A

A Sprint 21.4A deve ser Ingestão documental e Proposta de Importação do Orçamento.

Ela deve entregar, no máximo:

- registro de Documento e Versão do Documento, no nível necessário;
- Tentativa de Processamento Documental;
- leitura técnica do primeiro formato aprovado;
- evidência estruturada neutra;
- caracterização econômica determinística inicial;
- Proposta de Importação do Orçamento persistida;
- dados confirmados, premissas propostas e lacunas distinguíveis;
- proveniência;
- falhas e processamento parcial;
- nenhuma Versão do Orçamento criada automaticamente;
- nenhuma consolidação.

Este ADR não promete suporte completo simultâneo a XLSX, PDF textual e PDF digitalizado.

A Sprint deverá escolher a primeira fatia real conforme o documento oficial disponível e a capacidade existente.

Decisões futuras da própria Sprint 21.4A incluem, quando aplicável:

- primeiro formato documental;
- contrato físico mínimo da evidência;
- representação física mínima da proposta;
- política mínima de reprocessamento.

## 11. Impacto na Sprint 21.4B

A Sprint 21.4B deve ser revisão visual orientada à decisão e materialização.

Ela deve entregar:

- espaço visual de revisão;
- correção de classificações;
- inclusão de item ausente;
- alteração de descrição, código, valor e posição;
- criação de Grupo ou Subgrupo quando necessário;
- exclusão de linha não econômica;
- resolução de lacunas;
- origem documental sob demanda;
- confronto entre total declarado e calculado;
- comando explícito de materialização;
- criação da Versão do Orçamento em rascunho;
- edição posterior usando os Serviços de Aplicação já existentes;
- comando separado de consolidação.

A interface deve comunicar:

- status;
- problema;
- impacto;
- próxima ação;
- detalhes sob demanda.

A interface não deve ter aparência de ERP.

## 12. Decisões Físicas Mantidas Abertas

Este ADR não decide:

- nomes finais de tabelas;
- módulos físicos;
- pastas;
- fornecedor de reconhecimento óptico de texto;
- biblioteca de leitura;
- formato final do contrato de evidência;
- banco ou formato da Proposta de Importação do Orçamento;
- política final de reprocessamento;
- suporte simultâneo a todos os formatos;
- mecanismo universal de documentos para todo o BDOS.

A decomposição física deverá seguir generalização tardia.

A primeira implementação deve resolver a fatia concreta da Sprint sem congelar uma arquitetura universal antes da necessidade real.

## 13. Alternativas Rejeitadas

### Reconstrução Documental como responsável por tudo

Rejeitada porque colocaria interpretação econômica em uma capacidade que deve permanecer documental e lógica.

Essa alternativa faria a reconstrução decidir Grupo, Subgrupo, Item de Serviço, suficiência econômica e materialização, o que viola a separação definida pelos ADRs anteriores.

### Engenharia de Custos e Licitações como responsável por tudo

Rejeitada porque colocaria leitura física de arquivos, reconhecimento óptico de texto, armazenamento, resumo criptográfico e detalhes de planilha/PDF dentro do domínio econômico.

Essa alternativa dificultaria reutilização, rastreabilidade e evolução futura.

### Proposta de Importação como segunda Versão do Orçamento

Rejeitada porque duplicaria o domínio econômico, criaria dois lugares para editar orçamento e enfraqueceria as invariantes da Versão do Orçamento.

A Proposta de Importação do Orçamento é revisável e auditável, mas não é consolidável e não substitui a Versão do Orçamento.

## 14. Consequências

A ingestão documental fica separada da interpretação econômica.

A Versão do Documento permanece imutável e livre de estados operacionais de processamento.

O reprocessamento passa a ser registrado como nova tentativa.

A Proposta de Importação do Orçamento cria uma área segura de revisão antes da Versão do Orçamento.

A materialização passa a ser explícita, auditável e humana.

A consolidação continua explícita e posterior.

A inteligência artificial permanece auxiliar.

A decomposição física permanece aberta para generalização tardia.

## 15. Critérios de Aceite Arquitetural

Esta decisão será respeitada quando:

- Documento, Versão do Documento e Tentativa de Processamento Documental estiverem conceitualmente separados;
- a Versão do Documento não carregar estados de processamento;
- a ingestão produzir evidência estruturada neutra;
- a Engenharia de Custos e Licitações fizer a interpretação econômica;
- a Proposta de Importação do Orçamento for revisável e não consolidável;
- a Versão do Orçamento nascer somente por materialização explícita;
- a proposta materializada ficar preservada como fotografia auditável;
- alterações posteriores ocorrerem na Versão do Orçamento em rascunho ou em nova proposta/reprocessamento;
- a rastreabilidade puder chegar ao campo específico quando houver evidência;
- a Avaliação de Correspondência não for automática sem regra determinística formalmente aprovada;
- a inteligência artificial não confirmar sozinha fatos econômicos;
- a decomposição física permanecer aberta até necessidade real.
