# ADR-001 — Identidade e Lineage de Itens Orçamentários e Documentos de Licitação

- **Status**: Aprovado
- **Data da decisão**: 2026-07-13
- **Epic**: 21 — Engenharia de Custos e Licitações
- **Sprint**: 21.1B — Identidade e Lineage
- **Decisão principal**: Alternativa C — identidades por contexto com mappings persistidos

Este ADR documenta a decisão arquitetural aprovada para o Epic 21 ("Engenharia de Custos e Licitações"), com base nas evidências documentais caracterizadas na Sprint 21.1A ("Caracterização das Fontes Reais", processo real: Pregão Eletrônico 90006/2025 — Barragem Lagoa do Arroz/DNOCS). É autossuficiente e substitui integralmente qualquer rascunho anterior desta decisão.

Este documento é **exclusivamente conceitual e arquitetural**. Nenhum tipo de código, schema, aggregate, repository, API, UI, teste, migration, RLS ou seed foi criado ou é criado por esta gravação. Os nomes de conceitos aqui registrados (`DocumentArtifact`, `BudgetVersion`, `LineageRelation` etc.) são vocabulário de modelagem aprovado para orientar sprints futuras de implementação — não são, eles mesmos, entidades implementadas.

---

## A. Contexto e problema

O Epic 21 precisa de um modelo para representar identidade, versão e proveniência (lineage) de itens de custo/orçamento à medida que atravessam múltiplos documentos e estágios autoritativos de um processo de licitação pública.

Confirmado no código: domínio greenfield — não existe, em `packages/bdos-core/src/domain/*`, nenhuma pasta `cost-engineering`, `budget`, `procurement` ou `licitacao`.

Confirmado na documentação: `packages/bdos-core/docs/BDOS_VISION.md` §7 já descreve uma visão de longo prazo para "Edital, orçamento e licitação", marcada como *"ainda não existe na plataforma hoje"*.

Confirmado no código: não existia, antes desta gravação, nenhuma pasta `adr/` ou `docs/decisions/` — este é o primeiro ADR formal do projeto.

**Precedentes de código — classificação (aplicável em todo o documento)**:

| Referência | Classificação | Nota |
|---|---|---|
| `WorkPackage` | Referência parcial de padrão de identidade escopada e integração — não precedente de lineage cross-stage | Domínio `work-package-management` (confirmado no código), não `schedule-management`. Confirmado no código: possui campos de escopo (`organizationId, clientId, contractId, projectId`) — referência parcial que sustenta, por analogia, que isolamento por tenant/organização já é preocupação de primeira classe em outros pontos do codebase, não um precedente do modelo de lineage em si. |
| `FieldEvidence` | Referência parcial de vocabulário de evidência/confiança — não precedente de identidade | Enum de confiança e trilha (`trace`) inspiram nomenclatura, nada além disso. |
| `PlanningDataset` / versão de schema | Versão de **formato**, não de instâncias de negócio | Não serve de precedente para "uma nova versão não apaga a anterior" (Seção N). |
| `Recommendation` (Decision Engine) | Referência de rastreabilidade, não equivalente semântico | Padrão de apontar para evidência por ID, nada além disso. |

---

## B. Evidências da Lagoa do Arroz

Fatos estabelecidos na Sprint 21.1A, usados como insumo arquitetural — não generalizados como regra universal de licitações:

- Orçamento oficial publicado: **R$9.809.087,18** — confirmado no conteúdo do documento.
- Proposta aceita/homologada: **R$7.611.851,65** — confirmado no conteúdo do documento.
- Desconto global: **22,40%** — confirmado no conteúdo do documento.
- Contrato: **R$7.611.851,65** — confirmado no conteúdo do documento.
- **11 grupos, 25 subgrupos, 299 itens de serviço** com código hierárquico — confirmado por cruzamento documental.
- **100% de correspondência** de código, descrição, unidade e quantidade entre os 299 itens codificados — confirmado por cruzamento documental.
- **Alteração de preço** nos 299 itens codificados — confirmado por cruzamento documental.
- **1 linha adicional (`COT-015`)** sem código na coluna hierárquica, participando dos totais de grupo — confirmado no conteúdo do documento / confirmado por cruzamento documental (verificação matemática).
- Proposta apresentada por **CONJASF/HIDROMEC** conjuntamente — confirmado no conteúdo do documento.
- **Adjudicação registrada em nome da CONJASF** individualmente — confirmado no conteúdo do documento.
- **Consórcio formalizado posteriormente** à homologação — confirmado no conteúdo do documento.
- **Contrato celebrado com o Consórcio CONJASF-HIDROMEC** — confirmado no conteúdo do documento.
- Relação exata entre `PLANILHA.xlsx`, `PLANILHA CORRIGIDA.xlsx` e `PROPOSTA READEQUADA.pdf` **permanece parcialmente incerta** — confirmado por cruzamento documental.
- `PLANILHA CORRIGIDA` foi **nomeada explicitamente** na Análise 51/2025/DI/DOB — confirmado no conteúdo do documento.
- A análise oficial de desconto linear apresenta valores que, em pontos, **correspondem a `PLANILHA.xlsx`/`PROPOSTA READEQUADA.pdf`**, não a `PLANILHA CORRIGIDA.xlsx` — confirmado por cruzamento documental.

**Nota de escopo**: evidência motivadora e banco de teste conceitual. Nenhuma particularidade específica desse processo é generalizada como regra universal de licitações.

---

## C. Conceitos e vocabulário técnico aprovado

O vocabulário abaixo é **aprovado como vocabulário conceitual desta ADR** — orienta a modelagem de domínio de sprints futuras, mas **não é, nesta etapa, implementado como tipo de código**. Três pontos permanecem explicitamente pendentes de definição futura (não bloqueiam esta aprovação):

1. o **nome de produto/UI** exposto ao usuário para a camada de contexto (`ProcurementCase` é o nome técnico aprovado — ver Seção G.1);
2. o **nome final do futuro modelo de leitura** não autoritativo (Seção G.7);
3. o **ownership da camada de ingestão** (Seção O).

**Camada de contexto**
- **`ProcurementCase`** — nome técnico aprovado. Representa o ciclo específico de um processo: edital, orçamento, propostas, resultado, contratação e baseline.

**Camada documental**
- **`DocumentArtifact`**: identidade lógica de um documento ao longo do tempo.
- **`DocumentVersion`**: versão concreta, com ID interno próprio. `contentHash` (SHA-256) é atributo de integridade/deduplicação, não identidade de negócio.

**Camada econômica**
- **`BudgetVersion`**: versão econômica estruturada (orçamento oficial, orçamento interno, proposta de trabalho, proposta submetida, proposta aceita), sustentada por um ou mais `DocumentVersion`, pertencente a um `ProcurementCase`.
- **`BudgetLine`**: linha local de uma `BudgetVersion`, tipada por **`BudgetLineKind`** (`Group | Subgroup | ServiceItem`).

**Camada contratual**
- **`ContractBaseline`** / **`ContractBaselineItem`**: identidade e autoridade documental próprias, pertencentes a um `ProcurementCase` — não uma promoção de `BudgetVersion`/`BudgetLine`.

**Camada de reconciliação e lineage**
- **`ReconciliationAssessment`**: registro de uma tentativa ou decisão de reconciliação, inclusive quando nenhum vínculo é criado.
- **`LineageRelation`**: vínculo persistido entre duas identidades, tipado por **`LineageScope`** (`Document | BudgetVersion | BudgetLine`), normalizado em `RelationKind`, `ChangeSet`, `DecisionStatus`, `MatchConfidence`.

**Camada de partes**
- **`Party`** / **`PartyIdentifier`** / **`PartyRoleAssignment`** / **`ConsortiumMembership`** — modelo separado, nunca reaproveita `LineageRelation`.

**Modelo de leitura futuro (não autoritativo, nome pendente)**: `ResolvedItemTimeline` / `CrossStageItemView` / `ItemLineageView` ou equivalente.

---

## D. Alternativas arquiteturais avaliadas

### Alternativa A — Identidade universal
Uma única identidade atravessa todos os estágios. **Rejeitada**: força unificação prematura; `COT-015` inviável de tratar desde o primeiro documento; acoplamento altíssimo; não suporta 1:N/N:1; reversibilidade baixa; custo de correção futura alto.

### Alternativa B — Identidade contratual central
Identidades soltas pré-contrato; reconciliação única na assinatura produz identidade canônica. **Rejeitada**: o evento de reconciliação único exigiria um algoritmo/validação não definidos; descarta nuance pré-contratual a menos que também persista mapeamento (convergindo para C); reversibilidade e custo de correção apenas moderados.

### Alternativa C — Identidades por contexto com mappings persistidos (**decisão aprovada**)
Cada camada conceitual (`ProcurementCase`, `DocumentArtifact`, `DocumentVersion`, `BudgetVersion`, `BudgetLine`, `ContractBaseline`/`ContractBaselineItem`, `Party`) tem identidade própria, escopada a si mesma. Relações entre identidades de camadas/estágios diferentes são capturadas como `LineageRelation` explícitos, produzidos (quando houver) a partir de um `ReconciliationAssessment`.

- **Vantagens que fundamentam a aprovação**: modelo mínimo capaz de preservar as evidências reais de 21.1A sem perda; não exige política prematura de promoção; não cria identidade preferencial concorrente; suporta 1:1, 1:N, N:1 e "sem correspondência" como resultado registrado (não link a destino nulo); reversibilidade alta; menor custo de correção futura entre as quatro alternativas.
- **Limitação aceita conscientemente**: ergonomia de consulta imediata mais baixa — a ser resolvida futuramente por modelo de leitura reconstruível (Seção G.7), não por promoção de identidade.

### Alternativa D — Modelo híbrido (evolução futura possível — não adotada como modelo inicial)
Identidade persistente ("âncora") promovida quando um item é empiricamente confirmado estável. **Por que não é adotada agora**: exige política de promoção não definida; cria uma segunda identidade preferencial; risco de reintroduzir unificação prematura por atalho. **Quando reconsiderar**: se o modelo de leitura reconstruível (Alternativa C) se mostrar insuficiente em ergonomia/performance, e uma política de promoção puder ser desenhada com disciplina auditável — como evolução da Alternativa C, não como substituição dela.

---

## E. Trade-offs (resumo)

| Dimensão | A | B | C (**decidida**) | D (futuro) |
|---|---|---|---|---|
| Honestidade evidencial | Baixa | Média | Alta | Alta |
| Ergonomia de consulta imediata | Alta | Alta (pós-contrato) | Baixa/média (resolvível por read model) | Média/alta |
| Suporta 1:N, N:1, sem correspondência | Não | Não (só na fronteira) | Sim | Sim |
| Item sem código hierárquico | Não | Parcial | Sim | Sim |
| Exige política de promoção prematura | — | Sim | **Não** | Sim |
| Cria identidade preferencial concorrente | Sim | Sim | **Não** | Sim |
| Reversibilidade | Baixa | Moderada | Alta | Alta |
| Custo de correção futura | Alto | Moderado | Baixo | Baixo |

---

## F. Decisão aprovada

**A Alternativa C é a decisão arquitetural aprovada** para o modelo de identidade e lineage do Epic 21. A Alternativa D é registrada como evolução futura possível, não como modelo inicial, e sua eventual adoção exigirá um ADR próprio revisitando a política de promoção. Esta decisão incorpora: identidades distintas por camada; `ContractBaseline` com identidade própria; ausência de identidade única ("âncora") no modelo inicial; `Party` separada da identidade de itens; hash como atributo de integridade; modelo de leitura futuro não autoritativo; ownership da ingestão como decisão de fronteira futura.

---

## G. Modelo conceitual aprovado

### G.1 Camada de contexto — `ProcurementCase`

Representa o ciclo específico de um processo: edital, orçamento, propostas, resultado, contratação e baseline. `ProcurementCase` é o **nome técnico aprovado** para esta camada de modelagem; o **nome exposto a produto/UI permanece pendente** de definição futura, sem impacto sobre a validade conceitual desta decisão.

Regras aprovadas:

- `DocumentArtifact` **pode** ser associado a um `ProcurementCase` (associação opcional — ex.: tabelas SINAPI/SICRO de referência não pertencem a um processo específico).
- `BudgetVersion` **pertence** a um `ProcurementCase` específico (associação obrigatória).
- `ContractBaseline` **pertence** a um `ProcurementCase` específico (associação obrigatória).
- Lineage de orçamento (`LineageRelation` entre `BudgetVersion`/`BudgetLine`) **não cruza processos silenciosamente** — uma relação entre itens de dois `ProcurementCase` distintos exige justificativa e evidência explícitas.
- **Nenhuma relação pode cruzar tenants** — invariante absoluto, mais forte que a regra de não cruzar `ProcurementCase`.
- `Party` **pode participar de vários processos**.
- **Comparação histórica e benchmark entre processos não constituem continuidade de identidade ou lineage** — preocupação analítica/de relatório, resolvida futuramente por agregações de leitura, nunca por reaproveitar identidade ou criar `LineageRelation` entre processos distintos. **Benchmark não é modelado nesta etapa.**

### G.2 Camada documental
- `DocumentArtifact`: identidade lógica.
- `DocumentVersion`: versão concreta, ID interno próprio; `contentHash` é atributo de integridade/deduplicação (Seção K).

### G.3 Camada econômica
- `BudgetVersion`: versão econômica estruturada, pertencente a um `ProcurementCase`, sustentada por um ou mais `DocumentVersion`.
- `BudgetLine`: linha local, tipada por `BudgetLineKind` (Seção G.4).

### G.4 `BudgetLineKind`

`BudgetLineKind` possui **exatamente três valores**: `Group`, `Subgroup`, `ServiceItem`. Não existe um quarto tipo de negócio para "linha sem código" — a presença de identificadores é **ortogonal** ao tipo:

- `hierarchicalCode` (opcional);
- `sourceCode` (opcional);
- `externalReference` (opcional).

**Caso `COT-015`**: `kind = ServiceItem`; `hierarchicalCode` ausente; `sourceCode = "COT-015"`. Código ausente **não muda a natureza da linha** e **nunca autoriza seu descarte**.

`Composição` e `insumo` **não são variantes de `BudgetLineKind`** — são um domínio de referência separado, apontado por um `ServiceItem` através do campo `sourceCode`, com ciclo de vida próprio (confirmado na documentação: tabelas externamente versionadas).

### G.5 Camada contratual — baseline qualificada

Três situações distintas, que não podem ser confundidas:

1. **Contrato e valor global confirmados** — o `ContractBaseline` existe, com valor global e partes confirmados documentalmente, **mesmo sem** itens contratuais completamente estabelecidos.
2. **Baseline contratual itemizada** — quando existe fonte contratual que discrimina itens, `ContractBaselineItem` pode ser criado a partir dela.
3. **Itens contratuais ainda não estabelecidos** — situação legítima e permitida: um `ContractBaseline` com valor global confirmado, mas sem `ContractBaselineItem` completos.

**Invariante aprovado**: `ContractBaselineItem` **somente** pode ser criado a partir de (a) uma fonte contratual itemizada, ou (b) uma transformação explicitamente validada, auditada e vinculada às evidências contratuais. **Nunca** por cópia automática de `BudgetLine` da proposta apenas porque os valores globais coincidem.

Workflow/estados concretos para essa transformação não são definidos nesta etapa.

### G.6 `ReconciliationAssessment` e `LineageRelation` tipado

`ReconciliationAssessment` representa uma tentativa ou decisão de reconciliação — inclusive quando nenhum vínculo é criado. Campos conceituais: identidade de origem; versão ou universo de destino; método; resultado (`matched` | `no match` | `ambiguous`); `MatchConfidence`; `DecisionStatus`; responsável; validação humana; justificativa; evidências; `LineageRelation` produzidas, quando houver; histórico.

**"Sem correspondência" não é um `LineageRelation` para um destino nulo.** É um `ReconciliationAssessment` com resultado `no match`.

**`LineageRelation` é tipado por `LineageScope`** (`Document | BudgetVersion | BudgetLine`) — não é uma relação irrestrita entre qualquer entidade. Cada escopo restringirá futuramente tipos de endpoint, `RelationKind` permitidos, cardinalidades e evidências necessárias. `ContractBaseline`/`ContractBaselineItem` podem participar de relações economicamente compatíveis sem perder identidade própria. **`Party` nunca participa de `LineageRelation` de orçamento.**

- **`RelationKind`**: `EquivalentTo`, `DerivedFrom`, `SplitInto`, `AggregatedFrom`, `ReplacedBy`, `AddedIn`, `RemovedFrom`.
- **`ChangeSet`** (descritivo, não é `RelationKind`): código; descrição; unidade; quantidade; preço; posição hierárquica.
- **`DecisionStatus`**: `Proposed`, `Confirmed`, `Rejected`, `Superseded`.
- **`MatchConfidence`**: `Low`, `Medium`, `High` (sem "Verified", redundante com `Confirmed`).

`MatchConfidence` mede a força do sinal de matching/evidência; `DecisionStatus` registra a decisão de aceitar, rejeitar ou substituir a relação. Uma decisão humana pode confirmar uma relação mesmo com `MatchConfidence=Low`. A UI futura deverá preservar e apresentar os dois eixos separadamente — decisão de UI não tomada nesta etapa.

### G.7 Modelo de leitura futuro (não autoritativo, nome pendente)
`ResolvedItemTimeline` / `CrossStageItemView` / `ItemLineageView` (nome pendente de definição futura): reconstruível a partir do lineage persistido; nunca fonte autoritativa; não substitui identidades de camada; não altera o lineage persistido.

### G.8 Camada de partes
`Party`, `PartyIdentifier`, `PartyRoleAssignment`, `ConsortiumMembership` — Seção L.

---

## H. Identidades e cardinalidades

- Cada camada (`ProcurementCase`, `DocumentArtifact`, `DocumentVersion`, `BudgetVersion`, `BudgetLine`, `ContractBaseline`, `ContractBaselineItem`, `Party`) possui identidade própria, escopada a si mesma e ao tenant. Não há ID universal.
- Cardinalidade entre identidades não é assumida 1:1; expressa via múltiplos `LineageRelation`, cada um tipado por `LineageScope`.
- `COT-015`: `BudgetLine` de `kind=ServiceItem`, sem `hierarchicalCode`, com `sourceCode="COT-015"` — participa dos totais sem exigir identidade especial.
- `ContractBaselineItem`: identidade própria mesmo quando numericamente idêntico a uma `BudgetLine` — nunca criado por cópia automática.

---

## I. Modelo de mapping e lineage

### Separação de níveis
- **Lineage documental**: `DocumentArtifact`/`DocumentVersion` — escopo `Document`.
- **Lineage entre versões econômicas**: `BudgetVersion` (e `ContractBaseline`, por compatibilidade econômica) — escopo `BudgetVersion`.
- **Lineage entre itens**: `BudgetLine`/`ContractBaselineItem` — escopo `BudgetLine`.
- **Lineage/atribuição de partes**: modelo inteiramente separado (`PartyRoleAssignment`/`ConsortiumMembership`), nunca `LineageRelation`.

### `ReconciliationAssessment` como camada de processo, `LineageRelation` como camada de resultado persistido
Um `ReconciliationAssessment` registra a tentativa; quando o resultado é `matched` e aceito, produz um ou mais `LineageRelation` (com seu próprio `MatchConfidence`/`DecisionStatus`, evoluindo independentemente após a criação).

### Aplicação ao caso `PLANILHA*`
As relações entre `PLANILHA.xlsx`, `PLANILHA CORRIGIDA.xlsx` e `PROPOSTA READEQUADA.pdf` são registradas como `LineageRelation` de escopo `Document`, com `DecisionStatus=Proposed` e `MatchConfidence=Low`/`Medium`. Usado aqui apenas como exemplo conceitual — nenhuma conclusão documental nova é firmada por este ADR.

---

## J. Hierarquias

- **Grupo**, **subgrupo**, **item de serviço** — os três valores de `BudgetLineKind`.
- **Linha de serviço sem código hierárquico** (`COT-015`) — não é um quarto tipo; é um `ServiceItem` com `hierarchicalCode` ausente.
- **Composição**, **insumo** — domínio de referência separado, apontado via `sourceCode`, ciclo de vida próprio.

**`WorkPackage` ↔ `BudgetLine`**: não se afirma que essa relação será necessariamente um `LineageRelation`. Pode ser um **mapping**, uma **alocação**, uma **associação operacional**, ou um **lineage** genuíno — somente quando houver derivação real. A forma concreta é decisão cross-domain futura. `WorkPackage` permanece no domínio `work-package-management`, sem mudança de schema proposta por este ADR.

---

## K. Versionamento documental

- `DocumentArtifact` = identidade lógica; `DocumentVersion` = versão concreta, identidade interna própria.
- `contentHash` (SHA-256) = integridade, detecção de bytes idênticos, auditoria — **não** identidade de negócio.
- Permitido: bytes idênticos em contextos documentais distintos; versões administrativamente distintas com hashes diferentes; republicações preservando identidade/autoridade próprias.

### Arquivos XLSX e PDF equivalentes

Uma mesma `BudgetVersion` pode ser sustentada por múltiplos `DocumentVersion` (ex.: um XLSX e um PDF representando o mesmo conteúdo econômico). A equivalência entre essas representações:

- **não é presumida pelo nome** do arquivo;
- **não transforma automaticamente** os dois arquivos na mesma `DocumentVersion`;
- **deve ser sustentada por evidência** ou relação documental explícita;
- **pode permanecer `Proposed` ou com resultado `ambiguous`** indefinidamente.

O caso `PLANILHA CORRIGIDA.xlsx`/`.pdf` é usado apenas como exemplo conceitual, sem nova conclusão documental.

---

## L. Transformação das partes

- **`Party`**: identidade interna própria, não chaveada por CNPJ.
- **`PartyIdentifier`**: identificadores externos (CNPJ, CPF, registro estrangeiro) associados a uma `Party`.
- **`PartyRoleAssignment`**: papel (proponente; participante da proposta; adjudicatária; consorciada; contratada) com vigência, estágio e evidência.
- **`ConsortiumMembership`**: membro; líder; percentual de participação; vigência; evidência.

### Cardinalidade e composição de consórcios

A composição de um consórcio não possui cardinalidade fixa nem limite máximo definido por este domínio.

Um consórcio é uma `Party` própria e pode possuir dois ou mais membros, sendo cada participante representado por um `ConsortiumMembership` independente.

O caso CONJASF-HIDROMEC, formado por duas empresas com participação de 50% para cada uma, é apenas a evidência do processo Lagoa do Arroz e não estabelece:

- limite de dois membros;
- divisão igualitária de participação;
- liderança determinada pela ordem dos membros;
- estrutura padrão para outros processos.

Cada `ConsortiumMembership` deverá permitir conceitualmente:

- `consortiumPartyId`;
- `memberPartyId`;
- participação, quando confirmada;
- indicação de liderança ou outro papel, quando aplicável;
- vigência;
- evidência documental;
- origem da informação;
- situação de validação.

Percentuais de participação:

- não são presumidos como iguais;
- não são calculados pela quantidade de participantes;
- somente são registrados como confirmados quando sustentados por documento;
- não são ajustados ou normalizados automaticamente pelo sistema;
- quando a composição completa estiver documentalmente confirmada, sua consistência deverá ser validada, sem corrigir silenciosamente eventuais divergências.

A composição pode estar inicialmente incompleta durante a ingestão documental. Membros ainda não identificados ou percentuais ainda não confirmados não devem ser inventados. A informação incompleta deve permanecer explicitamente pendente até nova evidência ou validação humana.

Alterações posteriores de composição, liderança ou participação não sobrescrevem os registros anteriores. Devem preservar vigência, histórico e evidência.

Aplicação ao caso real: CONJASF e HIDROMEC são `Party` distintas; o Consórcio CONJASF-HIDROMEC é, ele mesmo, uma `Party` distinta das duas empresas, ligada a ambas por `ConsortiumMembership`.

`PartyRoleAssignment`/`ConsortiumMembership` não reaproveitam `LineageRelation` — mecanismo estruturalmente separado.

---

## M. Planejamento pré-contratual e contratual

- **Planejamento pré-contratual**: projeção vinculada a uma `BudgetVersion`, mutável, nunca baseline.
- **Planejamento contratual**: deriva do `ContractBaseline` — rastreável a ele, não necessariamente ao nível de `ContractBaselineItem` (que pode ainda não existir).

### Fronteira com Medições

Não se determina, neste ADR, vínculo direto obrigatório entre planejamento/medição e `ContractBaselineItem`. Contratos registrados:

- o planejamento contratual deve ser rastreável ao `ContractBaseline`;
- a medição deve ser rastreável aos itens contratuais aplicáveis, quando existirem;
- a integração deve respeitar os aggregates já existentes no domínio de Medições;
- adapters e cardinalidades específicos serão decididos posteriormente;
- **nenhuma integração operacional definitiva pode depender de uma proposta pré-contratual quando já existir baseline contratual aplicável**.

---

## N. Invariantes aprovados

| Invariante | Justificativa |
|---|---|
| Documento original não é sobrescrito | `DocumentVersion` aponta para o documento-fonte, nunca o substitui |
| Versão nova não apaga anterior | Princípio de desenho (append-only) adotado como decisão própria |
| Relação incerta não aparece como confirmada | Decorre da separação `MatchConfidence`/`DecisionStatus` |
| Código isolado não é identidade | 100% de correspondência de código foi tratado como `MatchConfidence=High` associado a um `LineageRelation`, não fusão automática |
| Item sem código não é descartado | Caso `COT-015` |
| Item de serviço continua item de serviço mesmo sem código hierárquico | `BudgetLineKind` não muda pela ausência de `hierarchicalCode` |
| Baseline não nasce automaticamente da proposta | `ContractBaseline` tem autoridade documental própria; coincidência de valores é registrada, não copiada |
| Baseline itemizada exige evidência itemizada ou transformação validada | `ContractBaselineItem` só nasce de fonte contratual itemizada ou de transformação validada/auditada |
| Planejamento pré-contratual não é baseline | Ver Seção M |
| Integração operacional definitiva parte da baseline | Nunca de uma proposta pré-contratual quando já existir baseline aplicável |
| Associação operacional não é automaticamente lineage | `WorkPackage`↔`BudgetLine` pode ser mapping/alocação/associação operacional sem implicar `LineageRelation` |
| Ausência de correspondência é registrada, não descartada | `ReconciliationAssessment` com resultado `no match` persiste como evidência da busca |
| Read model nunca se torna fonte autoritativa | Sempre reconstruível, nunca substitui identidades de camada |
| Nenhuma relação cruza tenant | Invariante absoluto |
| Nenhum código é interpretado fora do contexto do processo e da versão | Um `hierarchicalCode`/`sourceCode` só tem significado dentro do `ProcurementCase` e `BudgetVersion`/`DocumentVersion` a que pertence |
| Consórcio não possui cardinalidade fixa: cada membro é representado por um `ConsortiumMembership` próprio | Ver Seção L — Cardinalidade e composição de consórcios |
| Participações não são presumidas como iguais nem derivadas da quantidade de membros | Ver Seção L |
| Composição incompleta não é apresentada como composição confirmada | Ver Seção L |
| Alterações na composição do consórcio não apagam a configuração anterior | Ver Seção L |
| O caso de duas empresas em participação 50/50 não é generalizado como regra do domínio | Caso real Lagoa do Arroz (CONJASF-HIDROMEC) é evidência, não regra — ver Seção L |

---

## O. Fronteiras com os demais domínios

**Ownership da ingestão permanece decisão futura.** Registra-se apenas o contrato necessário: documento; versão; origem; autoridade; evidência; resultado extraído; método; confiança. A decisão entre Studio de Documentos, Engenharia de Custos, ou serviço compartilhado é fronteira futura, não resolvida por este ADR.

- **Project Studio**: consumiria `WorkPackage` (sem mudança de schema); a relação com `BudgetLine` é mapping/alocação/associação operacional/lineage conforme o caso, decisão cross-domain futura.
- **Studio de Medições**: contratos descritos na Seção M.
- **Finance**: consumiria `ContractBaseline` + `Party` contratada, quando modeladas — BDI/margem fora de escopo.
- **Decision Engine/Advisor**: poderia narrar `MatchConfidence`/`DecisionStatus`, não conectado por este ADR.

---

## P. Riscos e reversibilidade

- **Risco**: ergonomia de consulta insuficiente na Alternativa C — mitigado por modelo de leitura futuro não autoritativo, não por promoção de identidade.
- **Risco**: `ContractBaseline` ser implementada como atalho que copia `BudgetLine` da proposta — mitigado pelo invariante da Seção G.5/N.
- **Risco**: `WorkPackage`↔`BudgetLine` ser tratado precipitadamente como lineage — mitigado pela distinção mapping/alocação/associação operacional/lineage.
- **Risco**: `ProcurementCase` incentivar cruzamentos implícitos entre processos para fins de benchmark — mitigado por invariante explícito e por não modelar benchmark nesta etapa.
- **Reversibilidade**: alta — `Superseded`/`Rejected` são estados explícitos; `ReconciliationAssessment` preserva histórico mesmo de tentativas sem resultado.

---

## Q. Pendências remanescentes (não bloqueiam esta aprovação)

1. Nome de produto/UI para `ProcurementCase`.
2. Nome final do modelo de leitura futuro (Seção G.7).
3. Ownership da camada de ingestão (Studio de Documentos vs Engenharia de Custos vs serviço compartilhado).
4. Forma concreta da relação `WorkPackage`↔`BudgetLine` (mapping/alocação/associação operacional/lineage).
5. Política de promoção de identidade, caso a Alternativa D seja revisitada no futuro.

Nenhuma dessas pendências reabre a decisão principal (Alternativa C) registrada neste ADR.

---

## R. Consequências para as próximas sprints

- Modelagem de schema/tipos de domínio (ainda sem migration) pode ser iniciada em sprint própria, com base neste ADR.
- Algoritmo de matching automático, parser de xlsx/PDF, tratamento de erros de célula, arredondamento, cálculo de BDI, cenários, UI (incluindo a apresentação dos eixos `MatchConfidence`/`DecisionStatus`), migrations, RLS, política de promoção (Alternativa D), forma concreta de `WorkPackage`↔`BudgetLine`, adapters de Medições, ownership da ingestão e modelagem de benchmark entre processos — todos ficam para sprints futuras específicas.

---

## S. Critérios de aceite do ADR

Cumpridos: a Alternativa C foi aprovada expressamente pelo usuário como decisão arquitetural; o vocabulário conceitual foi aprovado com as três pendências explícitas registradas na Seção Q; a gravação deste arquivo foi expressamente autorizada.

---

## T. Conclusão

Este ADR estabelece a Alternativa C — identidades por contexto com mappings persistidos — como a decisão arquitetural aprovada para identidade e lineage de itens orçamentários e documentos de licitação no Epic 21. A Alternativa D permanece registrada como evolução futura possível. O modelo conceitual aprovado inclui: `ProcurementCase` como camada de contexto com isolamento de tenant e de processo; `BudgetLineKind` com apenas três valores (`Group`/`Subgroup`/`ServiceItem`), tratando itens sem código hierárquico (caso `COT-015`) como `ServiceItem` comum; `ContractBaseline`/`ContractBaselineItem` com identidade e autoridade documental próprias, nunca uma cópia automática da proposta; `LineageRelation` tipado por `LineageScope`, normalizado em `RelationKind`/`ChangeSet`/`DecisionStatus`/`MatchConfidence`; `ReconciliationAssessment` para registrar tentativas de reconciliação, inclusive sem correspondência; e um modelo de partes (`Party`/`PartyIdentifier`/`PartyRoleAssignment`/`ConsortiumMembership`) desacoplado da identidade de itens e do CNPJ como chave primária.

---

## Encerramento das Sprints do Epic 21 (até esta etapa)

- **Sprint 21.1A — Caracterização das Fontes Reais**: concluída.
- **Sprint 21.1B — ADR de Identidade e Lineage**: concluída com a aprovação e gravação deste ADR.
- **Nenhuma implementação de domínio foi iniciada.**
