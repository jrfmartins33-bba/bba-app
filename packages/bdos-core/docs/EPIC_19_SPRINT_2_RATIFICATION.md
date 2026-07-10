# Epic 19 — Sprint 2: Measurement Lifecycle and EAP Identity Ratification

> Decisões arquiteturais formais, sem implementação de schema,
> persistência ou adapter — isso é a Sprint 19.3+. Esta sprint
> converte os achados de mapeamento da 19.1
> (`EPIC_19_SPRINT_1_CONSOLIDATION_MAP.md`) em regras ratificadas.

## 19.2A — Ciclo canônico de medição

### Ciclo ratificado

```
MeasurementWorkspace          (rascunho editável)
        ↓ fechamento (Closed)
MeasurementBulletin            (documento formal, canônico)
        ↓ referenciado por id
MeasurementCycle                (processo de certificação)
        ↓ contrato de leitura
Financial Read Model            (Studio de Finanças)
```

### 1. `MeasurementWorkspace` — aggregate de trabalho

Permanece como está hoje (`domain/measurement-workspace`), sem mudança
de shape. Ciclo: `Draft → InProgress → ReadyForReview → Closed |
Cancelled`.

Responsabilidade: receber lançamentos, permitir correções, calcular
linhas, rodar validações preliminares, preparar o fechamento. **Não é
o documento contratual final** — nunca é o que Finanças ou uma
fiscalização externa enxergam.

Momento em que a reconciliação físico×financeiro roda: **durante o
workspace, antes do fechamento**, não depois. Cada
`MeasurementWorkspaceLine` já carrega `quantity`/`unitValue`/
`totalValue` — a análise de divergência (achado da 19.0: recalcular
financeiro a partir de físico × preço unitário, comparar com o valor
declarado) roda aqui, iterativamente, enquanto o engenheiro ainda pode
corrigir. Fechar o workspace (`Closed`) é o gate que congela esse
resultado.

### 2. `MeasurementBulletin` (bulletin-generator) — documento canônico

`domain/bulletin-generator`'s `MeasurementBulletin` é ratificado como
**o único `MeasurementBulletin`** da plataforma. Ciclo: `Draft →
Validated → Finalized | Cancelled`.

Responsabilidade: representar o boletim fechado, congelar o resultado
da análise (linhas, quantidades, preços unitários, valores calculados,
`validationIssues` com divergências/alertas), servir como documento
formal do ciclo de certificação.

**Regra de imutabilidade**: um `MeasurementBulletin` em `Finalized`
não pode ter `lines`/`totals`/`validationIssues` alterados — qualquer
correção depois da finalização exige um novo ciclo de medição (novo
workspace → novo bulletin), nunca uma edição retroativa do documento
já finalizado. Isso espelha a mesma disciplina de proveniência
imutável do Epic 18 (`planning_imports`).

### 3. Tipo fino de `measurement-workflow` — deixa de se chamar `MeasurementBulletin`

Renomeado conceitualmente para **`MeasurementBulletinReference`**.
`MeasurementCycle.measurementBulletins` passa a guardar referências,
não uma segunda cópia do documento completo:

```ts
interface MeasurementBulletinReference {
  readonly bulletinId: MeasurementBulletinId; // aponta para bulletin-generator.MeasurementBulletin
  readonly bulletinNumber: number;
  readonly period: MeasurementPeriod;
  readonly issueDate: MeasurementDate;
  readonly totalMeasuredValue: number;
  readonly totalMeasuredQuantity: MeasurementQuantity;
}
```

`MeasurementCycle` controla certificação e fechamento; não duplica
linhas nem `validationIssues` do documento formal — só o suficiente
para navegar/resumir sem uma segunda fonte de verdade.

Consequência direta: o alias `BulletinGeneratorMeasurementBulletin` em
`packages/bdos-core/src/index.ts` deixa de ser necessário quando isso
for implementado — `MeasurementBulletin` (nome limpo) volta a
significar só uma coisa. Não removo o alias nesta sprint (é código,
pertence à implementação), só registro que a ratificação o torna
desnecessário.

### 4. Studio de Finanças — contrato de leitura, não o aggregate rico

`domain/revenue-recognition` deixa de depender do tipo fino de
`measurement-workflow` para o shape do bulletin (continua usando
`MeasurementCycleStatus`/`Certification` de lá, que são
legitimamente do ciclo, não do documento). Passa a consumir um
**`MeasurementBulletinFinancialView`** — um contrato de leitura
estável, exposto pelo Studio de Medições, contendo só o que Finanças
precisa (valores certificados, período, referência de bulletin) sem
acoplar Finanças ao shape interno completo do documento (linhas,
validationIssues, trace).

**Ownership confirmado**: Studio de Medições é dono do boletim;
Studio de Finanças consome via visão financeira read-only — mesma
regra já escrita em `PLATFORM_ARCHITECTURE.md` §5, agora com o
mecanismo concreto (`MeasurementBulletinFinancialView`) que faltava.

## 19.2B — Ownership e identidade de WorkPackage

### Decisão ratificada

`domain/work-package-management` é o **owner canônico transversal da
identidade de EAP** — não pertence a nenhum Studio individual. É um
bounded context de plataforma, no mesmo sentido em que o Decision
Engine já não é um Studio em `PLATFORM_ARCHITECTURE.md` §5.

```
Work Package Management          (estrutura canônica de escopo/EAP)
        ↓ consumido por
Project Studio · Studio de Medições · Geo Studio · Execution Engine
```

**Por que não Project Studio**: `WorkPackage` não depende de datas,
duração, dependências, caminho crítico ou cronograma — um contrato
pode ter EAP e itens medíveis antes de qualquer cronograma detalhado
existir.

**Por que não Studio de Medições**: planejamento e georreferenciamento
podem existir antes da primeira medição; Studio de Medições não deve
ser pré-requisito para a identidade da EAP.

### Regra de identidade ratificada

> Um nó de EAP possui um único `workPackageId` canônico dentro de um
> contrato/projeto, independentemente do arquivo ou Studio que
> primeiro o materializou.

Chave natural de correlação em tempo de importação (find-or-create,
nunca duas vezes create):

```
companyId + (engineeringProjectId | contractId) + normalizedWorkPackageCode
```

Depois da correlação, o **id canônico é a referência oficial** — nenhum
consumidor deve depender permanentemente de igualdade textual de
código; o código normalizado é só o mecanismo de localização na
primeira vez.

### Consumers autorizados e regra de criação

Qualquer um dos quatro (Project Studio, Studio de Medições, Geo
Studio, Execution Engine) pode **solicitar** a criação de um nó via a
API de `work-package-management` (find-or-create pela chave natural),
mas nenhum deles persiste sua própria cópia independente. A
implementação concreta disso (quem chama o quê, onde mora a tabela) é
trabalho da Sprint 19.3+, não desta ratificação.

### Atualização de `PLATFORM_ARCHITECTURE.md`

Aplicada nesta sprint (documentação de ownership, não implementação de
schema/adapter) — ver diff em `docs/PLATFORM_ARCHITECTURE.md` §5: nova
linha para `WorkPackage` na tabela de ownership cross-Studio, e
observação atualizada na linha `Medição / Boletim` refletindo o
contrato de leitura ratificado em 19.2A.

### Adiado para quando o código existir (não fica sem dono, só sem prazo ainda)

- Inclusão de um guardrail estrutural equivalente ao
  `studio-boundaries.test.ts` para `work-package-management` — hoje
  inútil de adicionar porque não há pasta de componentes de Studio de
  Medições nem um segundo produtor de `WorkPackage` para violar a
  regra. Vira relevante no primeiro commit que criar o adapter de
  importação do Epic 19.
- Persistência real de `WorkPackage` (nenhuma tabela existe hoje, nem
  no uso atual do Project Studio) — Sprint 19.3+.

## Critério de saída (cumprido por esta sprint)

- [x] Um `MeasurementBulletin` canônico (`bulletin-generator`).
- [x] Novo nome e função da versão fina (`MeasurementBulletinReference`,
      dentro de `MeasurementCycle`).
- [x] Fronteira entre documento (`MeasurementBulletin`) e workflow
      (`MeasurementCycle`).
- [x] Contrato de leitura para Finanças (`MeasurementBulletinFinancialView`).
- [x] Regras de imutabilidade após fechamento (`Finalized` é terminal
      para o conteúdo do documento).
- [x] Momento em que a análise do boletim é executada e congelada
      (durante o `MeasurementWorkspace`, congelada no fechamento).
- [x] `work-package-management` como owner canônico transversal.
- [x] Consumers autorizados (Project, Medições, Geo, Execution).
- [x] Regra de criação (find-or-create via chave natural, id canônico
      depois).
- [x] Chave natural de correlação
      (`companyId + projectId/contractId + normalizedCode`).
- [x] Identidade persistente ratificada como o alvo (implementação
      ainda pendente).
- [x] `PLATFORM_ARCHITECTURE.md` atualizado.
- [ ] Guardrail estrutural (adiado — sem código ainda para guardar).

## Próxima etapa

Sprint 19.3 — Measurement Persistence Architecture: desenho de schema
comparando explicitamente o precedente `planning_imports` →
`planning_datasets` (Epic 18) com um equivalente de medição
(`MeasurementWorkspace` bruto/proveniência → `MeasurementBulletin`
estruturado), agora com as duas ambiguidades estruturais resolvidas.
Só então, adapter de importação do BM_08.
