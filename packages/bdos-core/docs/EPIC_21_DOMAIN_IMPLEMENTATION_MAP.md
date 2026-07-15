# Mapa de Domínio e Plano de Implementação — Engenharia de Custos e Licitações

**Status: Aprovado como mapa de planejamento da Sprint 21.3A.**

Este status aprova o planejamento e a sequência recomendada. Não aprova antecipadamente as decisões técnicas mantidas como abertas no próprio documento.

## A. Estado e finalidade

- **Epic**: 21 — Engenharia de Custos e Licitações.
- **Sprint de origem**: 21.3A.
- **Natureza do documento**: mapa de implementação e planejamento — não é um ADR. Consolida e organiza para implementação as decisões já aprovadas em ADR-001, ADR-002, ADR-003, ADR-004 e ADR-005.
- **Fundamentação**: ADR-001 (Identidade e Rastreabilidade), ADR-002 (Limite do Processo de Licitação e Contratação), ADR-003 (Versão do Orçamento e Transformações Orçamentárias), ADR-004 (Composição de Custos, Formação de Preços e BDI), ADR-005 (Responsabilidade pela Ingestão Documental na Engenharia de Custos e Licitações).
- **Este documento não substitui os ADRs.** Em conflito aparente, os ADRs prevalecem.
- **Hipóteses físicas continuam abertas.**

## B. Princípios que governam a implementação

- O BDOS decide e calcula; a inteligência artificial explica.
- Identidade interna nunca é código externo.
- Documentos são evidências, não identidades do domínio econômico.
- Versões consolidadas não são editadas silenciosamente.
- Promoção entre contextos nunca é automática.
- Isolamento por organização usuária.
- Proveniência e memória de cálculo preservadas.
- Generalização tardia.
- Relações de negócio não autorizam dependências circulares de código.
- Visão Consolidada nunca é fonte de verdade.
- Precedentes técnicos não são escolhas físicas automáticas.

## C. Três agrupamentos de planejamento

1. Licitação e Contratação
2. Orçamento e Transformações Orçamentárias
3. Formação Econômica

Agrupamentos de planejamento — não determinam pastas, módulos, unidades transacionais ou serviços físicos. Formação Econômica possui áreas conceitualmente separadas; decomposição física aberta, decidida por generalização tardia.

## D. Responsabilidades conceituais

| Conceito | Agrupamento responsável | Papel | Pode existir fora de licitação? | Observação |
|---|---|---|---|---|
| Processo de Licitação e Contratação | Licitação e Contratação | Contexto processual | **Não** — inerentemente processual | — |
| Lote da Licitação | Licitação e Contratação | Subdivisão opcional | **Não** — inerentemente processual | — |
| Escopo da Licitação | Licitação e Contratação | Delimitação de aplicabilidade | **Não** — inerentemente processual | Referenciado, nunca duplicado |
| Parte Envolvida | Licitação e Contratação | Pessoa/organização identificada no processo | **Sim ou aberto, conforme o contexto** — reutilização como cadastro fora de um processo é tecnicamente aberta, não aprovada | Não classificada como cadastro global já aprovado |
| Papel da Parte no Processo | Licitação e Contratação | Relação contextual entre Parte e Processo/Escopo | **Não** — inerentemente processual | Não é atributo da Parte |
| Submissão | Licitação e Contratação | Registro de envio processual | **Não** — inerentemente processual | — |
| Decisão da Licitação | Licitação e Contratação | Ato administrativo processual | **Não** — inerentemente processual | — |
| Vínculo entre Licitação e Contrato | Licitação e Contratação | Relação processo↔contrato | **Não** — inerentemente processual | Nome técnico provisório |
| Base Contratual da Obra | Licitação e Contratação | Retrato contratual consolidado | **Sim ou aberto, conforme o contexto** | Origem condicionada a evidência contratual ou transformação validada |
| Item Contratado | Licitação e Contratação | Linha do retrato contratual | **Sim ou aberto, conforme o contexto** | Distinto de Item de Serviço |
| Versão do Orçamento | Orçamento | Retrato econômico versionado | **Sim ou aberto, conforme o contexto** — obrigatoriedade universal de Processo não aprovada fora da 1ª fatia | Na 1ª fatia, sempre pertence a um Processo |
| Grupo | Orçamento | Classificação de Linha do Orçamento | **Sim ou aberto, conforme o contexto** | Herda o regime da Versão |
| Subgrupo | Orçamento | Classificação de Linha do Orçamento | **Sim ou aberto, conforme o contexto** | Herda o regime da Versão |
| Item de Serviço | Orçamento | Classificação de Linha do Orçamento | **Sim ou aberto, conforme o contexto** | O caso `COT-015` confirma que um Item de Serviço pode existir sem código hierárquico externo e participar dos totais. Nenhum código externo é identidade interna. A obrigatoriedade documental de código para outros tipos permanece aberta. Colisão conhecida com `ManagedServiceItem`. |
| Transformação Orçamentária | Orçamento | Definição de operação destinada a produzir nova Versão do Orçamento quando autorizada e executada com sucesso | **Sim ou aberto, conforme o contexto** | Distinta de Simulação e de Autorização; pode ser preparada, possuir nenhuma/uma/várias Simulações, ser abandonada, não ser autorizada, falhar na execução, ou produzir versão resultante somente quando concluída |
| Simulação Orçamentária | Orçamento | Cenário calculado imutável | **Sim ou aberto, conforme o contexto** | Distinta da Transformação |
| Autorização da Transformação | Orçamento | Congelamento de parâmetros | **Sim ou aberto, conforme o contexto** | Identidade própria, não absorvida pela Transformação |
| Decisão Interna sobre a Versão | Orçamento | Ato humano sobre a versão | **Sim ou aberto, conforme o contexto** | — |
| Composição de Referência | Formação Econômica | Retrato de catálogo/fonte externa | **Sim** — reutilizável, independe de processo | — |
| Versão da Composição de Custos | Formação Econômica | Retrato econômico próprio | **Sim ou aberto, conforme o contexto** | Pode ser relacionada explicitamente a um Item de Serviço quando aplicável. A associação não é automática nem obrigatória no momento de criação da versão. |
| Referência de preço | Formação Econômica | Referência de valor | **Sim** — reutilizável | Mesma cautela de Composição de Referência |
| Formação do Preço Unitário | Formação Econômica | Conceito e cadeia de proveniência | **Sim ou aberto, conforme o contexto** | Representação técnica aberta |
| Metodologia de BDI | Formação Econômica | Estrutura de regras | **Sim** — reutilizável | Origem pública, externa técnica/comercial ou interna |
| Versão da Metodologia de BDI | Formação Econômica | Retrato versionado da Metodologia | **Sim** — reutilizável | Distinta da Metodologia |
| Aplicação da Metodologia de BDI | Formação Econômica | Uso concreto, calculado ou documentado | **Sim ou aberto, conforme o contexto** | Nó independente |
| BDI Apurado | Formação Econômica | Resultado derivado | **Sim ou aberto, conforme o contexto** | Nunca reincluído como parcela |

Processo de Licitação e Contratação **não** é declarado origem universal dos conceitos econômicos.

## E. Grafo de caminhos permitidos

```
Versão do Documento
  │
  ├──[opcional]──► Versão do Orçamento — criação documental
  │
Usuário / BDOS
  ├──[caminho alternativo]──► Versão do Orçamento — criação nativa
  │
Processo de Licitação e Contratação ──[obrigatória na primeira fatia;
  aberta fora dela]──► Versão do Orçamento
  │
Versão do Orçamento de origem (consolidada, imutável)
  │
  ├──[opcional]──► Transformação Orçamentária
  │       ├── nenhuma, uma ou várias Simulações Orçamentárias
  │       ├── abandono, quando ocorrer
  │       └── Autorização da Transformação, quando aprovada
  │             └── execução autorizada
  │                   ├── falha preservada
  │                   └── Versão do Orçamento resultante, quando concluída
  │
  ├──[opcional]──► Linha do Orçamento sem composição
  │
  ├──[opcional, quando aplicável, nunca automática]──► Linha do
  │     Orçamento com Versão da Composição de Custos
  │             │
  │             ├──[Relação de Rastreabilidade, registrada na criação
  │             │    ou posteriormente com evidência suficiente]──►
  │             │    Composição de Referência
  │             └──[Avaliação de Correspondência, inferida depois]──►
  │                   Composição de Referência
  │
  └──[opcional, quando aplicável]──► Formação do Preço Unitário
           (representação técnica aberta)

Versão da Metodologia de BDI ──► Aplicação da Metodologia de BDI
  (nó independente) ──[apuração determinística, quando aplicável]──►
  BDI Apurado

Documento/contexto econômico ──[resultado agregado documentado,
  quando aplicável]──► BDI Apurado agregado documentado ──►
  lacunas explicitadas (nunca reconstrói metodologia ausente)

Aplicação da Metodologia de BDI, quando aplicável e documentalmente
  sustentada, relaciona-se opcionalmente com: Versão do Orçamento ·
  Formação do Preço Unitário calculada · Simulação Orçamentária ·
  proposta · proposta aceita · Base Contratual da Obra

Processo de Licitação e Contratação
  ├──[condicionada a evidência + Relação de Rastreabilidade,
  │    quando aplicável]──► Submissão ──► Decisão da Licitação
  │        (nunca automática)
  │             └──[condicionada a evidência, quando aplicável,
  │                  nunca promoção automática]──► Vínculo entre
  │                  Licitação e Contrato ──[condicionada a fonte
  │                  contratual itemizada ou transformação validada]──►
  │                  Base Contratual da Obra ──► Item Contratado
  │
  └──[leitura derivada, opcional, uma ou mais por agrupamento,
       nunca fonte de verdade]──► Visão Consolidada
```

Nenhuma etapa posterior é obrigatória; a Versão de origem nunca é alterada silenciosamente por nenhum ramo do grafo.

## F. Relações de negócio e direção técnica

| Relação de negócio | Dono de cada conceito | Referência permitida | Direção técnica preliminar | Coordenação necessária | Restrição |
|---|---|---|---|---|---|
| Versão do Orçamento × Processo/Lote/Escopo | Orçamento / Licitação | Referência por identidade | Orçamento → identidades processuais (1ª fatia) | Nenhuma além da referência | Sem duplicação do Escopo |
| Item de Serviço × Versão da Composição de Custos | Orçamento / Formação Econômica | Referência por identidade | Formação Econômica → Item de Serviço, quando aplicável | Serviço de Aplicação, se cruzar agrupamentos | Orçamento não importa Formação Econômica para descobrir composições |
| Aplicação da Metodologia de BDI × Versão do Orçamento/Simulação/proposta/Base Contratual | Formação Econômica | Relação documentalmente sustentada | Formação Econômica → Orçamento/Licitação, quando aplicável | Serviço de Aplicação | Nunca posse, sempre referência |
| Submissão/Decisão × Versão do Orçamento | Licitação | Referência por identidade, sem assumir propriedade | Licitação → Versão do Orçamento submetida | Nenhuma além da referência | — |
| Visão combinada | Nenhum agrupamento isolado | Leitura derivada | Montada fora dos núcleos de domínio | Camada de leitura/aplicação | Nunca escreve nos fatos de origem |

## G. Invariantes

**Licitação e Contratação**: identidade nunca é código externo; processo pode existir sem lote, lote nunca é artificial; Escopo pertence a este agrupamento, apenas referenciado pelos demais; Parte Envolvida e Papel da Parte são conceitos distintos; decisões preservam evidência/autoria/data; proposta não vira Base Contratual automaticamente, Item Contratado não nasce automaticamente de Item de Serviço; nenhum histórico contratual apagado silenciosamente; integração com contratos existentes bloqueada até o gatilho 2.

**Orçamento e Transformações**: Versão consolidada é imutável, alteração gera nova versão com novas identidades de Linha; sem identidade universal entre linhas de versões diferentes; Grupo/Subgrupo/Item de Serviço são classificações da Linha; código externo nunca é identidade, Item de Serviço pode existir sem código (`COT-015`); hierarquia sem ciclos; totalizações sem dupla contagem; origem só documental/nativa/por Transformação; Transformação não altera a versão de origem silenciosamente; Simulação não cria fato definitivo; parâmetros congelados na Autorização; redução de preço não comprova redução de custo/margem/lucro/BDI Apurado.

**Formação Econômica**: composição e BDI são estruturas conceitualmente distintas; Composição de Referência ≠ Versão da Composição de Custos; versão da fonte ≠ versionamento interno; `sourceCode` nunca é identidade; uso de composição por Item de Serviço é explícito; relação de aplicabilidade, relação econômica e Relação de Rastreabilidade não são equivalentes; Metodologia/Versão da Metodologia/Aplicação/BDI Apurado não são intercambiáveis; resultado agregado documentado não autoriza reconstruir metodologia ausente; nenhuma afirmação econômica excede os dados causalmente suficientes; premissa aprovada continua premissa até reclassificação; IA não inventa fato econômico.

**Regra de não duplicidade** (formulação normativa completa, vinculante): *"A mesma parcela econômica não pode ser incluída simultaneamente na composição de custos e nos componentes ou parâmetros econômicos da Aplicação da Metodologia de BDI. O BDI Apurado é resultado derivado e nunca pode ser acrescentado novamente ao preço como parcela econômica independente. Divisão explícita e não sobreposta é permitida. Dupla contagem não é."*

**Transversais**: isolamento por organização usuária; proveniência preservada; identidade interna nunca é código externo; imutabilidade após consolidação apenas onde aprovada; preservação histórica; validação humana nunca substitui fonte; três estados de evidência nunca fundidos; Relação de Rastreabilidade distinta de Avaliação de Correspondência; idempotência, correlação, correspondência e rastreabilidade nunca sinônimos; temporalidade; referência documental opaca não substitui Documento, Versão do Documento, Tentativa de Processamento Documental nem Proposta de Importação do Orçamento; nenhuma promoção automática entre contextos.

## H. Ciclos de vida conceituais

| Conceito | Marcos conceituais (opcionais) | Ponto de imutabilidade | Decisões ainda abertas |
|---|---|---|---|
| Processo de Licitação e Contratação | criação; publicação/identificação documental; participação ou ausência; submissões; decisões; encerramento sem contrato; vínculo contratual, quando ocorrer | Decisões/vínculos individuais, uma vez registrados | Nome de produto/UI |
| Versão do Orçamento | rascunho → consolidação | Na consolidação | Representação física |
| Linha do Orçamento | criada ou adicionada enquanto a Versão do Orçamento estiver em rascunho; consolidada juntamente com a versão | Na consolidação da Versão do Orçamento | Representação física |
| Transformação Orçamentária | preparação; nenhuma/uma/várias Simulações; abandono; Autorização, quando aprovada; execução; falha; versão resultante, quando concluída | Na autorização (parâmetros) | Lista definitiva de estados |
| Simulação Orçamentária | cálculo (várias simulações podem partir da mesma origem) | No cálculo | Representação física |
| Versão da Composição de Custos | criação → consolidação | Na consolidação | Representação física |
| Versão da Metodologia de BDI | criação → consolidação | Na consolidação | Representação física |
| Aplicação da Metodologia de BDI | criação interna ou incorporação documental; identificação da Versão da Metodologia e dos parâmetros quando conhecidos; congelamento quando houver Aplicação completa; uso calculado, documental ou analítico; lacunas explicitadas quando a estrutura completa não estiver disponível | No congelamento, quando houver Aplicação completa | Necessidade de identidade própria |
| Base Contratual da Obra | origem condicionada → consolidação | Ainda aberto | Modelo de versões, vigência e aditivos ainda abertos |
| Relação de Rastreabilidade | registrada na criação ou posteriormente com evidência suficiente | No registro | Representação técnica |
| Avaliação de Correspondência | comparação → resultado → nova evidência pode produzir nova Avaliação que confirma, substitui ou conteste a anterior, preservando integralmente o registro histórico precedente | No registro de cada resultado (nunca in-place) | Representação técnica |

Os marcos da Aplicação da Metodologia de BDI não são uma sequência obrigatória: preservam-se como possibilidades distintas a aplicação completa e calculável, a aplicação documentada e a aplicação analisada com lacunas — nunca reconstruindo uma metodologia ausente.

## I. Estratégia conceitual de persistência

| Conceito | O que precisa ser preservado | Recalculável/reconstruível | Histórico necessário | Decisão física aberta |
|---|---|---|---|---|
| Processo de Licitação e Contratação | Fato processual e decisões | Não | Sim | Representação técnica |
| Lote da Licitação | Fato, quando existir | Não | Sim | Representação técnica |
| Escopo da Licitação | Delimitação, referenciada por outros agrupamentos | Parcialmente | Sim | Representação técnica |
| Parte Envolvida | Identidade e dados de registro | Não | Sim | Representação técnica |
| Papel da Parte no Processo | Relação Parte × Processo/Escopo | Não | Sim | Representação técnica |
| Decisão da Licitação | Ato administrativo, evidência, autoria, data | Não | Sim (cadeia histórica) | Representação técnica |
| Vínculo entre Licitação e Contrato | Relação processo↔contrato | Não | Sim | Representação técnica (nome ainda provisório) |
| Versão do Orçamento | Retrato econômico consolidado | Parcialmente (a partir da origem) | Sim | Representação técnica |
| Grupo | Classificação e posição na hierarquia | Parcialmente | Sim (por herança da Versão) | Representação técnica |
| Subgrupo | Classificação e posição na hierarquia | Parcialmente | Sim (por herança da Versão) | Representação técnica |
| Item de Serviço | Classificação, código quando existir, participação nos totais | Parcialmente | Sim (por herança da Versão) | Representação técnica |
| Transformação Orçamentária | Definição, parâmetros, resultado | Reproduzível somente quando forem preservados Versão do Orçamento de origem, Autorização da Transformação, parâmetros, regras, versão do algoritmo, critérios de arredondamento e memória de cálculo. Idempotência evita duplicidade, mas não garante reprodução histórica. | Sim | Mecanismo de idempotência |
| Simulação Orçamentária | Resultado original, entradas, regras, versões, arredondamentos e contexto temporal | Sim, a partir dos parâmetros — mas resultado original sempre preservado | Sim | Representação física |
| Autorização da Transformação | Congelamento de parâmetros | Não | Sim | Representação técnica |
| Decisão Interna sobre a Versão | Ato humano sobre a versão | Não | Sim | Representação técnica |
| Composição de Referência | Identidade interna e proveniência; versão da fonte obrigatoriamente preservada | Não | Sim | Modelo interno de versionamento |
| Versão da Composição de Custos | Retrato econômico próprio | Parcialmente | Sim | Representação física |
| Referência de preço | Fonte e versão da fonte | Não | Sim | Modelo interno de versionamento |
| Formação do Preço Unitário | Cadeia de proveniência | Possivelmente | Aberto | Representação técnica (natureza do registro) |
| Metodologia de BDI | Estrutura de regras, fonte | Não | Sim | Forma de incorporação, isolamento e preservação conforme origem pública, externa técnica ou comercial, ou interna |
| Versão da Metodologia de BDI | Retrato versionado | Não | Sim | Representação técnica |
| Aplicação da Metodologia de BDI | Parâmetros congelados em contexto | Parcialmente | Sim | Necessidade de identidade própria |
| BDI Apurado | Resultado derivado; pode ser calculado ou persistido para auditoria | O caminho determinístico pode ser reproduzido quando a Aplicação completa, a Versão da Metodologia, os parâmetros, as bases, as regras e os critérios de cálculo forem preservados. Um resultado agregado documentado não é reconstruível por ausência da estrutura completa; seu valor original, sua fonte e suas lacunas devem ser preservados. | Aberto | Necessidade de identidade própria |
| Base Contratual da Obra | Fato contratual auditável | Não | Obrigatório | Versionamento, vigência, aditivos |
| Item Contratado | Fato contratual itemizado auditável | Não | Obrigatório | Relação com alterações contratuais |
| Relação de Rastreabilidade | Origem, destino, natureza da relação, evidência | Não | Sim | Representação técnica |
| Avaliação de Correspondência | Registros comparados, resultado, Grau de Confiança, justificativa | Não | Sim | Representação técnica |
| Visão Consolidada | Não é fonte de verdade. Quando houver cache ou materialização, poderão ser preservados metadados da projeção conforme futura decisão física. | Reconstruível quando fatos de origem, regras de projeção e versões necessárias estiverem disponíveis. | Não aplicável | Cache ou materialização |

## J. Organização usuária e segurança

`organizationId` é vocabulário conceitual; `company_id` é o mecanismo físico atual do repositório; mapeamento futuro explícito, nunca presumido; isolamento do registro incorporado; autoria de fontes públicas/externas preserva proveniência; nenhum catálogo compartilhado presumido; nenhuma política de compartilhamento entre organizações usuárias aprovada. Nenhuma política de segurança física ou SQL definida aqui.

## K. Idempotência, correlação, rastreabilidade, correspondência e concorrência

- **Idempotência**: reexecutar a mesma execução autorizada não duplica seu efeito; identidade conceitual preservada é a da execução. Operações diferentes sobre a mesma Versão de origem (cenários, lotes, estratégias distintas) podem ser legítimas. Idempotência não é sinônimo de reprodução histórica: evita duplicidade de efeito, mas não garante, por si só, reconstituir o resultado original.
- **Correlação**: liga execuções técnicas entre si para rastreamento técnico.
- **Relação de Rastreabilidade**: relação conhecida e declarada entre origem e destino — origem documental, derivação, transformação, incorporação ou continuidade — registrada na criação ou posteriormente com evidência suficiente; não exige que origem e destino representem o mesmo objeto de negócio; não é determinada apenas por igualdade de código ou descrição.
- **Avaliação de Correspondência**: julgamento sobre identidade de negócio entre registros criados independentemente, com resultado, Grau de Confiança e eventual validação humana.
- **Concorrência**: conflitos reais a evitar — duas execuções da mesma Autorização; duas consolidações do mesmo rascunho; alteração concorrente de parâmetros antes da autorização; dois registros do mesmo efeito lógico com a mesma identidade de execução; sobrescrita silenciosa. Mecanismos físicos permanecem abertos.

## L. Serviços de Aplicação futuros

Serviços de Aplicação não pertencem ao domínio puro. Pertencem à camada de aplicação e coordenação. Na Sprint 21.3C, serão implementados juntamente com contratos de repositório, persistência e adaptadores, mantendo essas responsabilidades em camadas separadas. Na Sprint 21.3B, os comportamentos correspondentes existem apenas como operações do modelo de domínio puro, validadas por testes unitários, sem orquestração nem persistência.

| Serviço de Aplicação conceitual | Agrupamento | Objetivo | Natureza | Coordena outros agrupamentos? | Sprint provável |
|---|---|---|---|---|---|
| Criar Processo de Licitação e Contratação | Licitação | Iniciar o contexto processual | Criação controlada de contexto processual | Não | 21.3C |
| Registrar Lote da Licitação | Licitação | Subdividir o processo, quando existir | Criação controlada condicionada à evidência | Não | 21.3C |
| Criar Versão do Orçamento em rascunho | Orçamento | Iniciar o retrato econômico | Criação controlada de retrato econômico, referenciando identidades processuais na 1ª fatia | Referencia Processo/Escopo | 21.3C |
| Adicionar/organizar Linhas do Orçamento | Orçamento | Compor a hierarquia | Alteração controlada de rascunho | Não | 21.3C |
| Validar hierarquia | Orçamento | Garantir ausência de ciclos | Validação determinística | Não | 21.3C |
| Calcular totalizações | Orçamento | Somar sem dupla contagem | Cálculo determinístico | Não | 21.3C |
| Consolidar Versão | Orçamento | Tornar imutável | Operação de domínio iniciada por decisão humana | Não | 21.3C |
| Consultar estrutura consolidada | Orçamento | Leitura | Consulta ou leitura derivada | Não | 21.3C |
| Registrar origem nativa/referência documental opaca | Orçamento | Rastreabilidade mínima | Registro de evidência | Não | 21.3C |
| Criar versão a partir de ingestão documental validada | Orçamento | Caminho documental | Materialização explícita da Proposta de Importação do Orçamento revisada | Coordena Documento, Versão do Documento, Tentativa de Processamento e evidência neutra conforme ADR-005 | 21.4A/21.4B |
| Registrar Avaliação de Correspondência | Transversal | Reconciliar registros independentes | Avaliação sobre registros independentes, com resultado e Grau de Confiança; validação humana quando necessária. A inteligência artificial pode explicar, mas não cria o fato confirmado | Pode coordenar qualquer agrupamento | 21.4B |
| Criar Simulação Orçamentária | Orçamento | Testar cenário | Cálculo determinístico | Não | 21.5A |
| Autorizar Transformação Orçamentária | Orçamento | Congelar parâmetros | Decisão humana | Não | 21.5B |
| Executar Transformação autorizada | Orçamento | Produzir versão resultante | Cálculo determinístico + idempotência | Não | 21.5B |
| Registrar Decisão Interna sobre a Versão | Orçamento | Ato humano sobre a versão | Registro auditável de decisão humana interna sobre a Versão do Orçamento | Não | 21.5B |
| Associar Versão da Composição de Custos a Item de Serviço | Formação Econômica | Vincular economia à linha | Coordenação entre agrupamentos | Referencia Item de Serviço (Orçamento) | 21.6A |
| Aplicar Metodologia de BDI | Formação Econômica | Criar Aplicação | Distingue: aplicação construída internamente; aplicação registrada documentalmente; aplicação analisada com lacunas | Pode referenciar Orçamento/Licitação | 21.6B |
| Apurar BDI | Formação Econômica | Calcular BDI Apurado | Cálculo determinístico | Não | 21.6B |
| Preservar memória de cálculo | Transversal | Auditoria | Registro de evidência | Não | 21.6A/21.6B |
| Registrar Submissão | Licitação | Vincular Versão a envio processual | Registro de evidência | Referencia Orçamento | Fora da 1ª implementação |
| Registrar Decisão da Licitação | Licitação | Ato administrativo | Registro de decisão processual tomada por autoridade ou Parte Envolvida, preservando evidência, autoria, data e proveniência — não se presume que o BDOS toma a decisão | Não | Fora da 1ª implementação |
| Criar Vínculo entre Licitação e Contrato | Licitação | Ligar processo e contrato | Coordenação entre agrupamentos | Bloqueado pelo gatilho 2 | Fora da 1ª implementação |
| Constituir Base Contratual da Obra | Licitação | Consolidar retrato contratual | Criação controlada condicionada à evidência | Referencia proposta aceita/evidência | Fora da 1ª implementação |
| Registrar validação humana | Transversal | Documentar avaliação | Registro auditável de decisão humana relacionada a conceito específico | Não | Todas |
| Registrar lacuna documental | Transversal | Documentar ausência de dado | Registro de evidência | Não | Todas |

`correlationId`, `createdBy` e `sourceSystem` são precedentes técnicos a avaliar, não contrato obrigatório já aprovado.

## M. Primeira fatia de domínio testável

**Conceitos**: Processo de Licitação e Contratação; Lote da Licitação (opcional); Escopo da Licitação; Versão do Orçamento; origem documental opaca ou nativa; rascunho; consolidação; Grupo; Subgrupo; Item de Serviço; hierarquia; ordenação; totalizações; organização usuária; Relação de Rastreabilidade mínima.

**Caso real (Lagoa do Arroz, Sprint 21.1A)**: 11 grupos; 25 subgrupos; 299 Itens de Serviço codificados; `COT-015` como Item de Serviço adicional sem código hierárquico; 300 Itens de Serviço no total; orçamento oficial R$ 9.809.087,18; `COT-015` participando dos totais.

**Cenário sintético (complementar)**: processo sem lote artificial; processo com dois ou mais lotes; orçamento aplicável ao processo inteiro; orçamento aplicável a lote; linhas aplicáveis a Escopos diferentes. Presença/ausência de lotes no caso real não é presumida.

**Fora da primeira fatia**: Serviços de Aplicação; repositórios; persistência; políticas de segurança; API; interface; ingestão automática; Transformação Orçamentária; Simulação Orçamentária; Formação Econômica; proposta; Base Contratual da Obra.

## N. Sequência final recomendada das Sprints

| Sprint | Objetivo | Entrega observável | Dependências | Decisões que precisam estar fechadas antes | Fora do escopo |
|---|---|---|---|---|---|
| 21.3B — Primeira fatia de domínio puro | Modelo de domínio puro: identidades conceituais, invariantes, comportamentos determinísticos, rascunho/consolidação, hierarquia, totalizações | Testes unitários passando com a fixture Lagoa do Arroz + cenário sintético multi-lote | Nenhuma | Forma técnica mínima do Escopo da Licitação | Serviços de Aplicação, repositórios, persistência, políticas de segurança, API, interface |
| 21.3C — Serviços de Aplicação, persistência e isolamento | Serviços de Aplicação, contratos de repositório, coordenação entre Licitação e Orçamento, persistência, isolamento por organização usuária, políticas de segurança, adaptadores | Mesma fatia funcionando de ponta a ponta com persistência real | 21.3B | Mecanismo de concorrência mínimo | Transformação, Simulação, Formação Econômica |
| 21.4A — Ingestão documental e Proposta de Importação do Orçamento | Ingestão documental e Proposta de Importação do Orçamento | Documento e Versão do Documento no nível necessário; Tentativa de Processamento Documental; leitura técnica do primeiro formato aprovado; evidência estruturada neutra; caracterização econômica determinística inicial; Proposta de Importação do Orçamento persistida; dados confirmados, premissas propostas e lacunas distinguíveis; proveniência; falhas e processamento parcial; nenhuma Versão do Orçamento criada automaticamente; nenhuma consolidação | 21.3C | Nenhuma decisão arquitetural pendente; a própria Sprint decidirá primeiro formato documental, contrato físico mínimo da evidência, representação física mínima da proposta e política mínima de reprocessamento | Criação automática de Versão do Orçamento; consolidação; suporte simultâneo obrigatório a todos os formatos |
| 21.4B — Revisão visual orientada à decisão e materialização | Revisão visual orientada à decisão e materialização | Revisão visual; correção das classificações; inclusão de item ausente; alteração de descrição, código, valor e posição; criação de Grupo ou Subgrupo; exclusão de linha não econômica; resolução de lacunas; origem documental sob demanda; confronto entre total declarado e calculado; comando explícito de materialização; criação da Versão do Orçamento em rascunho; edição econômica pelos Serviços de Aplicação existentes; comando separado de consolidação; comunicação de status, problema, impacto, próxima ação e detalhes sob demanda, sem aparência de ERP | 21.4A | — | Transformação, Simulação |
| 21.5A — Simulação Orçamentária | Redução de preços e comparação de cenários | Simulações calculadas e comparáveis | 21.3C | Precisão/arredondamento (ADR-003 §T) | Inferência sobre custo/BDI |
| 21.5B — Transformação Orçamentária autorizada | Autorização, execução idempotente, versão resultante, memória de cálculo | Nova Versão do Orçamento rastreável a partir de uma Transformação | 21.5A | Formato do identificador de execução idempotente | Formação Econômica |
| 21.6A — Composição de custos e referências | Composição de Referência, Versão da Composição de Custos, insumos, coeficientes, produtividade, referências de preço | Item de Serviço com composição associada e validada | 21.3C | Gatilho 5 | Metodologia/Aplicação/BDI Apurado |
| 21.6B — Metodologia, Aplicação e BDI Apurado | Quatro conceitos de BDI, suficiência de dados, memória de cálculo | BDI Apurado calculado deterministicamente quando os dados forem suficientes; Aplicação documentada ou resultado agregado preservados com lacunas quando a estrutura completa não estiver disponível | 21.6A como ordem recomendada para o primeiro cenário estruturado; não constitui dependência conceitual universal | Gatilho 6 | — |

**Justificativa de 21.6A/21.6B separadas**: reduz o tamanho de cada entrega; permite validação econômica incremental; estrutura a composição antes de aplicar o BDI no primeiro cenário de teste; reduz risco de dupla contagem. A sequência não transforma composição de custos em requisito universal para toda Aplicação da Metodologia de BDI — uma Aplicação pode existir documentada em orçamento, identificada em proposta, aplicada diretamente a um escopo econômico, ou registrada de forma agregada com lacunas, mesmo sem composição estruturada prévia. Esta separação **não** é tratada como decisão de dois módulos ou domínios técnicos independentes — ambas permanecem dentro do mesmo agrupamento de planejamento (Formação Econômica), cuja decomposição física segue aberta.

## O. Registro Consolidado de Decisões Pendentes

| Decisão pendente | Estado | Impacto | Bloqueia | Gatilho | Observação |
|---|---|---|---|---|---|
| Nome de produto/UI do Processo de Licitação e Contratação | Aberta | Baixo | UI futura | Antes da primeira tela | — |
| Nome futuro da Visão Consolidada | Aberta | Baixo | Leitura derivada futura | Antes de implementar leitura derivada | Padrão por agrupamento, opcional |
| Responsabilidade pela camada de ingestão documental | Resolvida — ADR-005 | Médio | Não bloqueia mais o planejamento da Sprint 21.4A | Encerrado | Responsabilidade dividida por fronteira explícita entre capacidade documental, Reconstrução Documental, Engenharia de Custos, Serviços de Aplicação e revisão humana. |
| Vínculo entre Licitação e Contrato — representação técnica | Conceito resolvido; forma técnica aberta | Médio | Modelagem técnica | Antes de 21.3B, se envolver este conceito | Nome ainda provisório |
| Modelo de aditivos da Base Contratual da Obra | Aberta | Baixo | Fora da 1ª implementação | Ver gatilho 4 | — |
| Formato técnico do identificador de execução idempotente | Aberta | Alto | 21.5B | Antes de 21.5B | Índice único parcial é hipótese |
| Lista definitiva de estados do ciclo da Transformação Orçamentária | Aberta | Médio | 21.5B | Antes de 21.5B | — |
| Precisão/casas decimais e arredondamento | Aberta | Médio | 21.5A | Antes de 21.5A | — |
| Modelo de distribuição do desconto comercial | Aberta | Baixo | Fora da 1ª implementação | Quando um caso real exigir | — |
| Nomes técnicos definitivos de `PartyKind` | Aberta | Baixo | Não bloqueia 21.3B, pois Parte Envolvida não faz parte da primeira fatia | — | — |
| Separação Versão×Aplicação para encargos sociais e tributos | Aberta | Médio | 21.6A | Antes de 21.6A | — |
| Necessidade de identidade própria do BDI Apurado | Aberta | Médio | 21.6B | Ver gatilho 6 | Resultado derivado ≠ ausência de identidade |
| Modelo próprio de versionamento da Composição de Referência | Aberta | Médio | 21.6A | Ver gatilho 5 | Distinto da versão da fonte |
| Representação técnica da Formação do Preço Unitário | Aberta | Médio | 21.6A/21.6B | Ver gatilho 6 | — |
| Identidade e representação mínima da Relação de Rastreabilidade | Aberta | Médio | 21.3B, somente no nível mínimo necessário à origem do orçamento | Antes de 21.3B | A representação completa permanece aberta além dessa fatia |
| Identidade e representação técnica de Avaliação de Correspondência | Aberta | Médio | Transversal | — | — |
| Colisão `ManagedServiceItem` | Aberta | Alto | Integração com Medições/Execução | Ver gatilho 1 | — |
| Colisão `EngineeringContract`/`contract-management` | Aberta | Alto | Vínculo persistido com execução | Ver gatilho 2 | `EngineeringContract` sem `organizationId` |
| Fronteira Engenharia de Custos × Finanças × Execução × Medição | Aberta | Alto | Cálculo de resultado realizado | Ver gatilho 3 | — |
| Confirmação de lotes no caso Lagoa do Arroz | Confirmação pendente | Não bloqueia o cenário sintético; bloqueia apenas afirmação específica sobre lotes no caso real | Afirmações sobre o caso real | Antes de afirmar presença/ausência de lotes reais | — |
| Catálogo compartilhado entre organizações usuárias | Não bloqueante | — | Horizonte de longo prazo | — | — |
| Fronteira preço/custo/margem/lucro/BDI | **Resolvida** (ADR-004) | — | — | — | — |
| Reconciliação Composição/Composição de Referência | **Resolvida** (ADR-004) | — | — | — | — |
| Fechamento dos Eixos A e B da Formação do Preço Unitário | **Resolvida** (ADR-004) | — | — | — | — |

## P. Gatilhos de reavaliação

| # | Tema | Evento que dispara | Decisão a tomar | Sprint provável | Risco de antecipar | Risco de adiar além do gatilho |
|---|---|---|---|---|---|---|
| 1 | Item de Serviço / Item Contratado / `ManagedServiceItem` | Primeira conversão/associação a uso operacional | Relação semântica exata entre os três | Fora da 1ª implementação | Modelagem prematura sem caso real | Retrabalho ao integrar Medições |
| 2 | Contrato de Engenharia × operacional | Primeiro vínculo persistido entre Base Contratual e execução operacional | Resolver bloqueio de `organizationId` em `EngineeringContract` | Fora da 1ª implementação | Reconciliação sem necessidade real | Vínculo inseguro entre organizações usuárias |
| 3 | Finanças | Antes de implementar margem/resultado/lucro realizado | Fronteira Engenharia de Custos × Finanças | 21.6B+ | Cálculo sem composição suficiente | Afirmação econômica sem suficiência de dados |
| 4 | Aditivos | Antes de permitir alteração da Base Contratual consolidada | Modelo de aditivos e vigência | Fora da 1ª implementação | Modelo prematuro sem caso real | Histórico contratual corrompido |
| 5 | Composição de Referência | Primeiro import de catálogo oficial (SINAPI/SICRO) | Modelo de versionamento interno | 21.6A | Import sem modelo definido | Composição sem proveniência confiável |
| 6 | Conceitos relacionados ao BDI (Formação do Preço Unitário, Metodologia, Versão da Metodologia, Aplicação, BDI Apurado, memória de cálculo) | Primeiro motor determinístico de Aplicação/BDI Apurado | Representação técnica da Formação do Preço Unitário; representação de Metodologia/Versão/Aplicação/BDI Apurado; identidade persistida necessária para auditoria | 21.6B | Motor sem definição de auditoria | Resultado não auditável |
| 7 | Documento / Versão do Documento | Primeira integração real com ingestão documental ou Reconstrução Documental | Encerrado pelo ADR-005: preservação documental e evidência neutra fora do domínio econômico; interpretação econômica pela Engenharia de Custos; coordenação pelos Serviços de Aplicação; Proposta de Importação do Orçamento antes da Versão do Orçamento; materialização por comando humano; consolidação separada; decisões físicas ainda abertas | 21.4A | Decidido conceitualmente; não autoriza generalização física antecipada | Decisão encerrada; risco remanescente é escolher prematuramente formato, OCR, tabelas, contrato físico de evidência ou política final de reprocessamento |

## Q. Critérios de aceite do mapa

O documento estará apto para gravação quando: não contrariar os cinco ADRs; não transformar fluxo opcional em pipeline obrigatório; não transformar agrupamento em fronteira física; não escolher persistência física; não confundir autoria com isolamento; não confundir idempotência com reprodução; não confundir correlação com correspondência; não impor Processo de Licitação a todo orçamento futuro; preservar decisões abertas; definir a primeira fatia testável; definir sequência recomendada; registrar pendências e gatilhos; permanecer sem implementação.

---

### Consolidações de planejamento aprovadas

- Três agrupamentos como estrutura de planejamento.
- Formação Econômica como agrupamento único de planejamento, com áreas internas conceitualmente separadas — decomposição física aberta.
- Escopo da Licitação pertencente conceitualmente a Licitação e Contratação, apenas referenciado pelos demais.
- Visão Consolidada como padrão opcional de leitura derivada.
- Grafo de caminhos não linear e opcional, incluindo o grafo detalhado da Transformação Orçamentária.
- Separação entre Sprint 21.3B (domínio puro) e Sprint 21.3C (Serviços de Aplicação e persistência).
- Primeira fatia de domínio testável e Opção B.
- Regra de não duplicidade: "A mesma parcela econômica não pode ser incluída simultaneamente na composição de custos e nos componentes ou parâmetros econômicos da Aplicação da Metodologia de BDI. O BDI Apurado é resultado derivado e nunca pode ser acrescentado novamente ao preço como parcela econômica independente. Divisão explícita e não sobreposta é permitida. Dupla contagem não é."
- Registro Consolidado de Decisões Pendentes (Seção O).
- Sete gatilhos de reavaliação (Seção P), com o Gatilho 7 encerrado pelo ADR-005.
- Cardinalidade do caso Lagoa do Arroz.
- Distinção entre Transformação Orçamentária, Simulação Orçamentária e Autorização da Transformação.
- Responsabilidade pela ingestão documental dividida por fronteira explícita, com Proposta de Importação do Orçamento antes da Versão do Orçamento.
- 21.6A como ordem recomendada de implementação para o primeiro cenário estruturado de BDI, não como dependência conceitual universal.

### Hipóteses ou decisões técnicas ainda abertas

Todas as linhas "Aberta" da Seção O; representação física de qualquer conceito (Seção I); decomposição física de Formação Econômica; forma técnica do Escopo da Licitação; mecanismo físico de idempotência e concorrência; primeiro formato documental da Sprint 21.4A; contrato físico mínimo da evidência; representação física mínima da Proposta de Importação do Orçamento; política mínima de reprocessamento; confirmação de lotes no caso real; catálogo compartilhado entre organizações usuárias.
