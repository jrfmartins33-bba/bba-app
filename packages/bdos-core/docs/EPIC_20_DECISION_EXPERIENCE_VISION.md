# Epic 20 — Decision Experience — Visão de Produto

> Documento de visão, não de implementação. Nenhum código, migration,
> rota ou componente é definido aqui. Objetivo: aprovar a tese de
> produto e a arquitetura da informação da primeira experiência
> (`20.1 — Análise do Boletim de Medição`) antes de qualquer Sprint
> técnico. Segue a mesma disciplina de `BDOS_VISION.md` e
> `BDS_ARCHITECTURE_PRINCIPLES.md`: nada aqui inventa capacidade,
> dado ou inteligência que o código de hoje não sustente.

## 0. Inspeção realizada

Lidos, nesta ordem, antes de qualquer proposta: `BDOS_VISION.md`,
`BDS_ARCHITECTURE_PRINCIPLES.md` (PRINCIPLES 001–007),
`PRODUCT_VOCABULARY.md`, `MEASUREMENT_STUDIO_AUDIT.md`,
`BOLETIM_DE_MEDICAO_IMPORT_ARCHITECTURE.md`, `docs/PLATFORM_ARCHITECTURE.md`
(seções de ownership, Advisor, maturidade do Studio de Medições), o
contrato completo de `MeasurementAnalysisResult` e
`MeasurementImportIssueCode` (`measurement-bulletin-import.types.ts`,
`bulletin-import.types.ts`, `bulletin-import.ts`), o motor real do
BBA Advisor (`advisor-response-validator.ts`,
`advisor-confidence-builder.ts`, `advisor-explanation-builder.ts`) e o
único precedente de UI de decisão já em produção
(`bba-project-insights.ts`, `bba-project-workspace-experience.tsx`).

**Achado que muda a proposta**: o Epic 20 não parte de uma folha em
branco. Ele parte de três coisas já construídas e validadas que a
proposta original não menciona, e que mudam onde o esforço real deve
ir.

---

## Achado 1 — O "Decision Brief" já existe, embrionário, e já funciona em produção

`apps/web/components/bba-project/bba-project-insights.ts` (Golden
Journey, EPIC 02) já implementa, hoje, em produção:

- `computeHealthScore` — índice 0–100, determinístico, com fatores
  transparentes descontados de 100 (nunca um peso arbitrário
  escondido) — é exatamente o "Índice de Confiabilidade" pedido na
  seção 11 do seu brief, só que já resolvido para outro Studio.
- `buildHeroNarrative` — a mesma ideia do "First 10 Seconds", já
  escrita, já em tela.
- `buildAdvisorNarrative` — **Situação / Motivo / Impacto /
  Recomendação**, quatro das sete perguntas de `PRINCIPLE 001`, em
  prosa corrida, não em accordion técnico. É o protótipo real do seu
  `Decision Brief`.
- `buildReasoningChain` — "como cheguei nesta conclusão", a cadeia
  real (Planejamento → Objeto Espacial → Confiança → Diagnóstico →
  Decisão → Recomendação) com contagens reais. É o seu drill-down
  conceitual (seção J), já implementado.

Nenhum desses quatro nomes de função deve vazar para você como
"arquitetura" — cito-os porque **o Epic 20 não deveria reinventar o
Decision Brief. Deveria generalizá-lo.** Hoje ele existe só para o
Project Studio, escrito ad-hoc dentro de um arquivo de componente. A
proposta certa de Epic 20 (ver seção N) é: extrair esse padrão para
algo reutilizável pela primeira vez, com o Studio de Medições como
segundo consumidor — exatamente a frase do seu brief, "estabelecer um
padrão reutilizável para futuras experiências", só que a ferramenta
para isso já tem um primeiro rascunho testado em produção, não
precisa nascer do zero.

## Achado 2 — "BDOS decide, LLM explica" já tem um mecanismo real, não é só um princípio de parede

`advisor-response-validator.ts` implementa o que chamo de **Candidate
Set Pattern**: o Claude só pode citar `decisionId`/`recommendationId`/
`evidenceId` que já existem no contexto determinístico que o BDOS
construiu antes de chamar o modelo. Se o Claude citar um id
inexistente, ou fora do conjunto elegível, a resposta inteira é
rejeitada (`valid: false`) antes de chegar à tela. `evidenceDecisionIds`
vazio é rejeição automática — nenhum insight sem prova.

`advisor-confidence-builder.ts` calcula confiança **sem nenhuma
chamada ao modelo**: `overall = "low"` se o validador reprovou,
`"high"` se aprovou sem nenhuma referência ausente, `"medium"` caso
contrário — uma razão de cobertura (`traceabilityCoverage`,
`evidenceCoverage`), não uma opinião.

Isto é exatamente o mecanismo que a seção 6 do seu brief pede
("Toda conclusão deverá ser derivada de fatos... A LLM não poderá
inventar risco, impacto, probabilidade, valor ou recomendação") — só
que já implementado, testado, e battle-tested pelo Decision Copilot.
**A recomendação arquitetural central deste documento**: o Epic 20
não deve criar um segundo mecanismo de validação de saída de LLM. Deve
estender este, com um Candidate Set próprio do domínio de Medição
(`structuralIssues[]`, `lines`, `workPackages`, `serviceItems` já
persistidos em `analysis_result`).

## Achado 3 — O contrato de backend do Epic 19 já antecipou quase todos os estados de UX que você pediu

A seção K do seu brief pede pelo menos 8 estados de experiência. O
`ProcessMeasurementBulletinImportOutcomeKind`, congelado desde a
Sprint 4.0 por razões puramente operacionais (idempotência, retomada),
já tem 8 valores. O mapeamento é quase 1:1 — ver seção K abaixo. Isso
não foi desenhado pensando em UX; é uma coincidência favorável que
comprova que o domínio foi modelado com disciplina suficiente para já
sustentar a experiência que você está pedindo, sem precisar de um novo
enum paralelo.

---

Com essa base, seguem as seções A–N pedidas.

## A. Tese da experiência

**A Análise do Boletim de Medição não confirma que um Excel foi lido
corretamente. Ela responde, com posição e evidência, se o boletim pode
ser enviado — e o que precisa acontecer antes, se não puder.**

A promessa central não é "seus dados foram importados". É: *"eu
verifiquei este boletim com o mesmo rigor que um engenheiro sênior
levaria horas para fazer manualmente, e aqui está minha posição, com
prova."* Isso só é uma promessa honesta porque, hoje, ela já é
tecnicamente verdadeira para a parte financeira: o BM_08 real foi
recalculado célula a célula, reconciliado ao centavo, e cada
divergência foi capturada como estrutura, não como texto solto.

## B. Jornada completa do usuário

```
Upload concluído (Epic 19, já existe)
        ↓
Processamento concluído (measurement_bulletin_imports.status = completed)
        ↓
Análise do Boletim de Medição abre — NÃO a tabela, o Decision Brief
        ↓
Usuário lê a Conclusão (3 segundos) e as Evidências que a sustentam
        ↓
Se "pronto para envio": usuário confirma → boletim segue para
  geração formal (generateMeasurementBulletin, já existe como
  Application Service, ainda sem UI)
        ↓
Se "requer revisão": usuário abre os pontos de atenção priorizados,
  um a um — cada um leva à linha/célula de origem exata
        ↓
Usuário resolve (edita quantidade, aceita divergência, marca como
  revisado) ou decide que não pode enviar ainda
        ↓
Decisão registrada (Linha da Decisão — visão futura, seção 10) — hoje,
  registrada apenas como avanço de status do workspace (Draft →
  InProgress → ReadyForReview → Closed)
```

Nenhuma etapa desta jornada exige que o usuário abra a tabela bruta
primeiro — a tabela é alcançável a partir de qualquer ponto de atenção
específico, nunca é o ponto de entrada.

## C. Arquitetura da informação

Ordem e motivo — cada nível responde a uma pergunta que só pode ser
respondida depois que a anterior já foi:

1. **Conclusão executiva** — "posso enviar?" precisa vir primeiro
   porque é a única pergunta que 3 dos seus 3 públicos (seção 13)
   fazem simultaneamente, antes de qualquer coisa específica do seu
   papel.
2. **Decisões e prioridades** — depois de saber a resposta, o próximo
   instinto humano é "o que eu faço agora" — não "por quê", ainda.
3. **Riscos e consequências** — o "por quê" e o "e se eu não agir"
   vêm juntos, porque risco sem consequência é uma lista de avisos
   ignorável; risco com consequência é uma decisão.
4. **Indicadores objetivos** — os números que sustentam a conclusão
   (valor oficial, recalculado, diferença) — depois do risco, porque
   um número sem contexto de risco já apresentado é só um dado, não
   uma resposta.
5. **Visualizações explicativas** — cada uma responde a uma das
   perguntas objetivas acima (seção I), nunca decorativa.
6. **Evidências e detalhamento** — a lista completa de
   `structuralIssues`, com severidade e localização — o material que
   sustenta tudo acima, mas que ninguém deveria precisar ler por
   inteiro para confiar na conclusão.
7. **Tabelas e dados brutos** — a MeasurementWorkspaceLine linha a
   linha, com origem (aba/linha/coluna). Último nível, sempre
   alcançável, nunca o ponto de partida.

Esta ordem já é `PRINCIPLE 003` (Progressive Disclosure) aplicado —
não uma invenção nova deste Epic. A regra "nunca via modal, drawer ou
nova página" já está ratificada e deve valer aqui também: o
aprofundamento acontece dentro do mesmo painel.

## D. First 10 Seconds Experience

Com os dados reais do BM_08 já validados em produção, isto é hoje
literalmente possível sem nenhuma nova capacidade de backend:

```
Boletim 08 · Período 01/06 a 30/06/2026

R$ 252.654,78                    Diferença: R$ 0,00
valor recalculado bate com o oficial

8 pontos de atenção · nenhum bloqueante

"Este boletim está matematicamente consistente. Recomendo revisão de
8 itens estruturais antes do envio — nenhum deles afeta o valor
medido."
```

Nenhum número acima exige LLM. O texto entre aspas é o único elemento
que se beneficia de narração — e mesmo esse texto é uma função
determinística do `status` + contagem de issues por severidade, com o
LLM (se usado) apenas fraseando, nunca decidindo o conteúdo.

## E. Decision Brief — estrutura completa

> **Nota de Produto (nomenclatura provisória)**: "Relatório Executivo"
> é o nome de superfície (Camada 3, `PRODUCT_VOCABULARY.md`) usado na
> UI a partir desta revisão — decisão deliberada de **não otimizar
> nomes cedo demais**: primeiro validar que o conceito gera valor
> percebido real, depois refinar a linguagem. `DecisionBrief` continua
> sendo o nome técnico interno (Camada 1), nunca exposto ao usuário.
> Quando os módulos de Planejamento, Financeiro, Contratos e Riscos
> também estiverem implementados, uma revisão completa da taxonomia e
> da nomenclatura do BDOS deve consolidar uma linguagem proprietária e
> consistente em toda a plataforma — não antes.

| Campo (UI) | Campo (tipo) | Fonte real hoje | Determinístico ou narrado |
|---|---|---|---|
| **Situação** | `situacao` | `declaredBulletinNumber`, `declaredPeriod`, `status` | Determinístico |
| **Conclusão** | `conclusao` | Função de `status` (`reconciled`/`needs_review`/`failed`) × contagem de issues `blocking` | Determinístico; frase natural pode ser narrada, nunca a posição em si |
| **O que mudou** | `oQueMudou` | Comparação com boletim anterior do mesmo projeto | **Não disponível hoje** — só existe um período real importado (BM_08); sem 2º período real, não há base para comparar (ver seção M) — declarado explicitamente, nunca omitido |
| **O que merece atenção** | `preocupacoes[]` (cada item já carrega `ifAddressed`/`ifIgnored` — a consequência de agir/não agir, seção 8 do brief original) | `structuralIssues[]`, ordenado por severidade (`blocking` primeiro) | Determinístico — a ordenação e a lista; a frase de cada item pode ser narrada a partir do `message` já existente |
| **Evidências** | `evidencias[]` | `structuralIssues[].sourceLocation` (aba/linha/coluna), `officialPeriodTotal`/`recalculatedTotal` | Determinístico, já persistido |
| **Impacto Financeiro** | `impacto` | `totalDifference`, `workPackages.created/matched`, `serviceItems.created/matched`, `lines.skippedZeroValue` | Determinístico |
| **Alternativas** | `alternativas[]` | Hoje: enviar / revisar antes de enviar. Não há terceira via real ainda (ex.: "enviar com ressalva formal" não existe como estado do domínio) | Determinístico, mas o cardápio de alternativas é hoje binário — não inventar um terceiro caminho que o domínio não sustenta |
| **Recomendação** | `recomendacao` (inclui `nextActions[]` — itens acionáveis derivados diretamente das issues abertas, ex.: "revisar item X342") | Mapeamento direto de `status` + severidade das issues abertas | Determinístico |
| **Confiança da Análise** | `confianca` | Reaproveita o padrão de `advisor-confidence-builder.ts`: cobertura de rastreabilidade (toda issue tem `sourceLocation`? toda linha tem origem?), não uma opinião do modelo | Determinístico, mesmo mecanismo já validado |

**O que deliberadamente não entra neste objeto** (proposta inicial de
enriquecimento revisada): `Trend`, `DecisionHistory`, `DecisionTimeline`
não viram campos deste tipo. Um objeto gerado a cada processamento não
deveria carregar campos estruturalmente vazios para 100% dos casos
reais de hoje — isso violaria "lacunas não são preenchidas
silenciosamente" na direção oposta (fingir estrutura que não existe).
Eles nascem como **agregados irmãos**, referenciando o mesmo caso por
id, quando tiverem dado real para sustentá-los — ver nota de
Accountability abaixo.

## F. Tipos de conclusão possíveis (reais, com os dados de hoje)

1. **"Recomendo o envio."** — `status = reconciled`, zero issues
   `blocking`, zero (ou poucas) `warning`.
2. **"O boletim está matematicamente consistente, mas requer revisão
   operacional antes do envio."** — `status = reconciled`, zero
   `blocking`, uma ou mais `warning` — **é exatamente o caso real do
   BM_08 validado** (`needs_review` por 8 warnings, diff R$ 0,00).
3. **"Não recomendo o envio neste momento."** — `status =
   needs_review` com ao menos uma issue `blocking` (ex.:
   `official_period_total_mismatch`, `service_item_unit_mismatch`).
4. **"Não foi possível concluir a análise."** — `status = failed`
   (gate de reconciliação recusou, ex.:
   `official_measurement_block_not_found`) — diferente de um erro de
   sistema (`download_failed`/`parse_failed`), que é uma falha técnica,
   não uma conclusão de negócio, e deve ser apresentada de forma
   honestamente diferente (seção K).

Não existe hoje um quinto tipo de conclusão com nuance adicional (ex.:
"aprovar com ressalva formal registrada") — o domínio não modela esse
estado ainda. Não prometer isso na v1.

## G. Tipos de risco — taxonomia real, extraída do código, não inventada

| Categoria | Códigos reais (`MeasurementImportIssueCode`) | Severidade hoje |
|---|---|---|
| **Financeiro** | `official_period_total_mismatch`, `service_item_unit_mismatch` (unidade divergente pode invalidar o cálculo financeiro) | `blocking` |
| **Físico** | `historical_grid_not_authoritative` (grade física histórica diverge da fonte oficial) | `warning` |
| **Integridade documental** | `unrecognized_line`, `missing_work_package_code`, `orphan_legacy_column_detected`, `ambiguous_period_label`, `official_measurement_block_not_found`, `duplicate_service_item_in_sheet` | `blocking` (casos catastróficos: nenhuma aba reconhecida, fonte oficial ausente, período ambíguo) ou `warning` (linha parcial, coluna residual, duplicidade) — depende do caso |
| **Contratual/Catálogo** | `service_item_description_mismatch` (descrição diverge do catálogo, não afeta cálculo), `service_item_unit_mismatch` (afeta) | `warning` / `blocking`, respectivamente |
| **Operacional/Processo** | `period_number_conflict` (duas medições reivindicando o mesmo período — pode ser remedição legítima) | `warning`, deliberadamente nunca `blocking` — decisão de arquitetura já registrada no código |

Dois códigos (`missing_service_item_code`, `missing_quantity_and_value`)
existem no contrato de tipos mas **nunca foram observados em produção**
— reservados para casos que o BM_08 real não continha. Não prometer
exemplos reais desses dois até que apareçam num boletim real.

**Risco de glosa** (pergunta 8 do seu brief) — hoje **não é uma
categoria própria do domínio**, é uma leitura de produto sobre a
taxonomia acima: qualquer issue `blocking` não resolvida antes do
envio é, por definição, risco alto de questionamento por fiscalização;
qualquer `warning` não revisada é risco a avaliar. Isto pode ser
apresentado já na v1 como uma **reformulação de vocabulário sobre dado
já existente** — não como uma nova regra de negócio a inventar.

## H. Consequências e recomendações

O par "se agir / se não agir" só pode ser escrito para categorias onde
já existe uma consequência real e não hipotética. Mapeamento honesto:

| Issue | Se agir | Se não agir |
|---|---|---|
| `official_period_total_mismatch` | Corrigir a divergência antes do envio garante que o valor certificado bate com o que a fiscalização vai recalcular | O boletim pode ser questionado e retido até nova análise, exatamente como o parser já identificou preventivamente |
| `service_item_unit_mismatch` | Validar a unidade evita que um item seja pago com preço unitário incompatível | O item pode ser pago errado — a favor ou contra a empresa — sem que ninguém tenha percebido |
| `historical_grid_not_authoritative` | Nenhuma ação obrigatória — a fonte oficial já prevaleceu no cálculo | Nenhum risco financeiro — mas a grade histórica da planilha continuará divergente para quem a consultar manualmente depois |
| `duplicate_service_item_in_sheet` | Corrigir a duplicidade na origem evita ambiguidade em medições futuras do mesmo item | O item pode ser medido duas vezes por engano em um boletim futuro, se a duplicidade não for percebida |

Para os demais códigos (estruturais/integridade), a consequência real
hoje é mais modesta e deve ser apresentada como tal: "reduz risco de
retrabalho na conferência", não uma ameaça financeira inventada.

## I. Visualizações — cada uma responde uma pergunta real

| Visualização | Pergunta que responde | Dado real disponível hoje |
|---|---|---|
| Barra física vs. financeira (oficial × recalculado) | "O valor bate?" | `officialPeriodTotal`, `recalculatedTotal` — sim, hoje |
| Distribuição de issues por severidade | "Onde está a atenção?" | `structuralIssues[]` agrupado por `severity`/`code` — sim, hoje |
| Composição do valor por WorkPackage/frente | "Onde está concentrado o valor desta medição?" | `measurement_workspace_lines` join `work_packages` — sim, hoje (schema já suporta) |
| Evolução do faturamento entre boletins | "O faturamento está acelerando ou desacelerando?" | **Não disponível** — exige ≥2 boletins reais do mesmo projeto |
| Avanço físico × financeiro no tempo | "O realizado acompanha o planejado?" | **Não disponível** — exige correlação com cronograma (Project Studio), hoje não implementada |

Duas das cinco visualizações mais óbvias de uma "tela de medição" são
**hoje impossíveis de fazer honestamente** — não por limitação de UI,
por ausência real de dado histórico ou de correlação cross-Studio.
Isso deve ficar explícito na v1 (seção M), não escondido atrás de um
gráfico vazio.

## J. Drill-down

Caminho real, ponta a ponta, com dado que já existe:

```
Decision Brief (Conclusão)
        ↓
Ponto de atenção específico (structuralIssues[i])
        ↓
Linha ou item afetado (ManagedServiceItem / MeasurementWorkspaceLine)
        ↓
Célula de origem exata: source_sheet_name + source_row_number +
  source_physical_column / source_financial_column
        (já persistido, Sprint 19.4D.0 — validado no E2E real: aba
        "BOLETIM DE MEDIÇÃO 08", colunas H/I)
```

Isto é, hoje, um drill-down **até a célula**, não até o arquivo. A
visão de longo prazo de reabrir o Excel original na célula exata **não
existe** — o que existe é a referência estruturada à célula, que já é
mais forte do que a maioria das ferramentas do mercado oferece (a
maioria não rastreia além do nome do arquivo).

## K. Estados da experiência — mapeados ao contrato real

| Estado pedido | `ProcessMeasurementBulletinImportOutcomeKind` real | Observação |
|---|---|---|
| Análise concluída sem riscos relevantes | `completed`/`already_completed`, `status: reconciled`, zero issues | |
| Análise concluída com pontos de atenção | `completed`/`already_completed`, `status: reconciled` ou `needs_review`, issues só `warning` | **Caso real validado (BM_08)** |
| Análise com risco crítico | `completed`, `status: needs_review`, ao menos uma issue `blocking` | |
| Análise incompleta | `already_processing` | Processamento em andamento — outro processo já reivindicou o import |
| Dados insuficientes / análise bloqueada | `failed`, `measurementWorkspaceId: null` | Gate de reconciliação recusou antes de criar o workspace (ex.: fonte oficial não localizada) |
| Erro de processamento | `ProcessMeasurementBulletinImportFailure` com `error: download_failed \| parse_failed` | Falha técnica, não de negócio — deve ter apresentação visualmente distinta de "análise bloqueada" |
| Ausência de comparação histórica | Não é um outcome — é uma condição sempre verdadeira hoje | Todo Decision Brief da v1 deve declarar isso explicitamente, nunca omitir |
| *(adicionais que o contrato já cobre, não pedidos explicitamente)* | `resumed`, `workspace_ready_for_review`, `workspace_closed`, `workspace_cancelled` | Re-entradas administrativas — states de guarda, não de análise; merecem texto próprio ("este boletim já foi enviado para revisão humana — nenhuma ação automática aqui") |

## L. Diferenciais difíceis de copiar

1. **Determinismo estrutural sobre o que a IA pode dizer.** A maioria
   dos "AI insights" do mercado deixa o modelo decidir o que é
   relevante. Aqui, o Candidate Set Pattern (Achado 2) torna
   estruturalmente impossível o modelo inventar um risco, um valor ou
   uma severidade — um concorrente não replica isso adicionando um
   prompt melhor, precisa da mesma disciplina de validação de
   contrato ponta a ponta.
2. **Proveniência até a célula, como dado durável, não como log de
   importação.** `source_sheet_name`/`source_row_number`/
   `source_*_column` não são um registro de auditoria que expira — são
   colunas persistidas, consultáveis anos depois. Poucos produtos do
   setor de engenharia oferecem isso além do primeiro dia após o
   upload.
3. **Reconciliação físico-financeira validada contra um arquivo real
   de cliente real**, incluindo a descoberta e correção do
   `TRUNC()` exato usado pela planilha original — não um caso de teste
   sintético. `BDOS_VISION.md` já registra este princípio
   ("Artefatos reais validam a arquitetura"); o Epic 20 herda essa
   credibilidade, não precisa reconquistá-la.
4. **Identidade de EAP unificada (`WorkPackage`) entre Studios.** A
   correlação futura entre medição e cronograma (seção I, "avanço
   físico × financeiro no tempo") não vai exigir uma nova migração de
   dados quando for construída — a identidade já foi desenhada
   compartilhada desde o Epic 19, Sprint 19.2. Concorrentes que tratam
   medição e planejamento como sistemas separados pagam esse preço de
   integração depois; o BDOS já pagou antes.
5. **Explicabilidade como requisito de auditoria pública, não como
   funcionalidade de UX.** Para o público-alvo real (contratos DNOCS e
   similares), a defesa perante um tribunal de contas anos depois é o
   critério mais alto valor — mais do que qualquer gráfico bonito. Um
   concorrente genérico de BI não foi desenhado para essa barra.

## M. Limitações honestas da primeira versão

- **"O que mudou" (comparação com medição anterior) não pode ser
  prometido ainda** — só um período real (BM_08) foi importado até
  hoje. Só se torna real quando um segundo boletim real do mesmo
  projeto existir.
- **"O cronograma continua coerente" não pode ser respondido** — a
  correlação Medição × Planejamento por código normalizado é descrita
  como capacidade aditiva futura em
  `BOLETIM_DE_MEDICAO_IMPORT_ARCHITECTURE.md` §7, e não está
  implementada.
- **"O que pode gerar glosa" só pode ser respondido no nível que a
  taxonomia de issues já sustenta** (blocking → risco alto; warning →
  a avaliar) — não existe um modelo de risco de auditoria mais
  sofisticado (histórico de glosas por tipo de item, por órgão, por
  região) hoje. Prometer isso na v1 seria inventar inteligência que
  não existe.
- **Nenhuma ligação com o Studio de Evidências.** "Anexar evidência
  antes do envio" não pode virar uma ação real na tela — o Studio de
  Evidências não está integrado ao Studio de Medições ainda
  (`PLATFORM_ARCHITECTURE.md` já lista essa integração como
  transversal, não construída para Medição).
- **Índice de Confiabilidade da Medição, se lançado na v1, deve usar
  só os fatores hoje demonstráveis**: contagem/severidade de issues,
  diferença de reconciliação, taxa de correspondência
  WorkPackage/ManagedServiceItem (criado vs. localizado), taxa de
  linhas com valor zero ignoradas. **Não incluir** "aderência ao
  cronograma" ou "compatibilidade com histórico" até que essas
  capacidades existam de fato — o índice deve declarar essa lacuna
  abertamente, nunca preenchê-la com um valor neutro disfarçado.
- **Linha da Decisão (seção 10 do seu brief) não tem persistência
  hoje.** O único rastro de decisão real que existe é a transição de
  `MeasurementWorkspaceStatus` (`Draft → InProgress → ReadyForReview →
  Closed`/`Cancelled`) — um evento por transição de status, não uma
  timeline rica de "risco identificado", "evidência anexada" etc. Uma
  v1 honesta pode narrar a timeline **a partir** dessas transições,
  mas não pode fingir granularidade que não existe até que um novo
  schema de eventos seja desenhado (Sprint própria, ver seção N).
- **Memória de Decisões (seção 9) é 100% visão futura** — nenhum dado
  histórico estruturado de decisões passadas existe hoje, em nenhum
  Studio.
- **"Medido vs. contratado" (comparação do valor acumulado da obra
  contra o valor total do contrato) não pode ser prometido ainda,
  mesmo que parte do dado já exista.** `EngineeringContract.
  contractValue` é um campo real
  (`domain/engineering-contract/engineering-contract.types.ts:65`),
  mas o Decision Brief de Medições não está ligado a ele (só conhece
  `engineeringProjectId`, nunca consulta o contrato), e não existe
  hoje nenhum cálculo de valor acumulado medido somando todos os
  boletins de um mesmo projeto — o Brief é sempre escopado a um único
  boletim. Mostrar esse gráfico agora exigiria fabricar um dos dois
  números. Fica como candidato de Sprint futura (seção N), não como
  lacuna a preencher na v1.
- **Decision Accountability — refinamento adicionado nesta revisão,
  ainda 100% visão futura.** Além de "o que aconteceu" (Linha da
  Decisão) e "o que já aconteceu antes" (Memória de Decisões), a
  Memória de Decisões deve registrar dois campos que hoje não têm
  nenhum lugar para existir: **quem decidiu** (usuário, diretor, ou a
  posição do BDOS aceita sem alteração humana) e **qual foi o
  resultado real**, preenchido não no momento da análise, mas
  **meses depois** (ex.: "a decisão foi correta" / "gerou glosa").
  Isto não é uma sétima seção do Decision Brief — é um agregado
  próprio (`DecisionAccountability`/`DecisionOutcome`), que nasce em
  aberto e é fechado por um evento futuro, fora do ciclo de vida de
  qualquer processamento único. É, de longe, o diferencial mais difícil
  de copiar deste Epic: nenhum concorrente acumula "quais das minhas
  recomendações realmente deram certo" — e só se torna real depois de
  meses de uso real da plataforma, nunca simulável.

## N. Roadmap do Epic 20 (produto, sem código)

**Correção de rota (registrada aqui deliberadamente)**: a primeira
versão deste roadmap fatiava a entrega em quatro sub-sprints
(20.1a–20.1d) e usava a ausência de um segundo boletim real para
adiar parte do trabalho. Está corrigido — a ausência de um segundo
boletim real não bloqueia nada: ela apenas define que "O que mudou"
nasce, dentro da própria v1, como uma limitação honestamente
declarada ("sem base de comparação ainda"), nunca como motivo para
fatiar ou atrasar o restante da experiência. O cliente pode levar
meses para compartilhar um segundo boletim — o produto não espera por
isso.

### Sprint 20.1 — Análise do Boletim de Medição (primeira versão completa)

Entrega, de uma vez, a experiência inteira descrita nas seções B–J
deste documento, com os dados reais já disponíveis hoje (o BM_08
validado em produção prova que os dados existem):

- Decision Brief completo (seção E): Situação, Conclusão, O que
  preocupa, Evidências, Impacto, Alternativas, Recomendação,
  Confiança — todos determinísticos, derivados do
  `MeasurementAnalysisResult` já persistido. "O que mudou" entra desde
  já como campo declarado, com o texto honesto de ausência de base
  quando não houver período anterior — nunca omitido, nunca fingido.
- Narração via BBA Advisor, reaproveitando o Candidate Set Pattern
  (Achado 2) — o LLM fraseia o que já foi decidido, nunca decide
  severidade, valor ou prioridade.
- Hierarquia completa da seção C (Conclusão → Decisões e prioridades →
  Riscos e consequências → Indicadores → Visualizações → Evidências →
  Tabela), com Progressive Disclosure (`PRINCIPLE 003`) dentro do
  mesmo painel.
- Visualizações que já têm dado real hoje (seção I): reconciliação
  oficial × recalculado, distribuição de issues por severidade,
  composição do valor por WorkPackage/frente. As duas visualizações
  que dependem de histórico ou cronograma (seção I) aparecem como
  estado "indisponível ainda" explícito, nunca como gráfico vazio sem
  explicação.
- Índice de Confiabilidade da Medição v1, só com os fatores
  demonstráveis hoje (seção M) — mesmo padrão de `computeHealthScore`
  (fatores documentados, sem ML, recalibráveis sem tocar domínio) —
  e com os fatores ainda não suportados listados explicitamente como
  evolução futura, nunca preenchidos com um valor neutro disfarçado.
- Drill-down completo até a célula de origem (seção J) — o dado já
  existe (`source_sheet_name`/`source_row_number`/`source_*_column`),
  é só o caminho de navegação que falta.
- Todos os estados da seção K mapeados e com texto próprio — inclusive
  os de guarda (`resumed`, `workspace_closed`, etc.) e o de erro
  técnico, visualmente distinto de uma conclusão de negócio.

Este é o Sprint que estabelece o padrão reutilizável (generalizando o
protótipo já existente em `bba-project-insights.ts`, Achado 1) — as
próximas experiências (Planejamento, Financeiro, Contratos, Riscos)
o consomem, não o reconstroem.

### Sprints subsequentes (fora de 20.1, sem bloquear seu início)

- **Linha da Decisão** — requer desenho de schema próprio (novo Sprint
  de arquitetura). Pode nascer narrando as transições de status já
  existentes (`Draft → InProgress → ReadyForReview → Closed`) antes de
  evoluir para granularidade maior — não precisa esperar o desenho
  completo da seção 10 para entregar um primeiro corte útil.
- **Correlação com cronograma (read-only)** — depende de decisão
  arquitetural própria, já anunciada como pendência em
  `BOLETIM_DE_MEDICAO_IMPORT_ARCHITECTURE.md` §7 — merece seu próprio
  documento de desenho, mesma disciplina do Epic 19, mas não impede o
  lançamento de 20.1.
- **"O que mudou" com dado real** — quando um segundo boletim real do
  mesmo projeto existir, o campo já declarado em 20.1 passa a ter
  conteúdo real, sem exigir retrabalho de UI — só a comparação em si
  precisa ser implementada.
- **"Medido vs. contratado" (valor acumulado da obra × valor total do
  contrato)** — ideia levantada na validação visual do 20.1E.6
  (Relatório Executivo de Medições). Trabalho necessário: (1) ligar
  `engineeringProjectId` → `EngineeringContract` para ler
  `contractValue`; (2) um serviço novo que some o valor recalculado de
  todos os boletins já processados do mesmo projeto (hoje o Brief só
  enxerga um boletim por vez); (3) expor os dois números como campo
  novo do contrato do Decision Brief. Só depois disso a UI pode
  desenhar o gráfico (a área hoje vazia ao lado da Conclusão
  Executiva), com os dois valores 100% reais — nunca antes.

**Fora de escopo deste Epic, explicitamente**: Memória de Decisões
entre obras (seção 9), Studio de Evidências integrado, modelo de risco
de glosa mais sofisticado que a taxonomia de issues atual,
"Análise do Planejamento"/"Análise Financeira"/"Análise de
Contratos"/"Análise de Riscos" como telas — todas ficam como
consumidoras futuras do padrão generalizado a partir do Achado 1,
nunca construídas em paralelo agora.
