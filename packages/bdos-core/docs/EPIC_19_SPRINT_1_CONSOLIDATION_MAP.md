# Epic 19 — Sprint 1: Measurement Domain Consolidation (mapa de uso)

> Insumo para 19.1A (Canonical Measurement Bulletin) e 19.1B
> (WorkPackage Ownership). Só leitura — mapeia declarações, imports,
> produtores e consumidores reais no código. Nenhuma decisão é
> ratificada aqui; onde a evidência aponta claramente para uma
> direção, registro como leitura preliminar, não como conclusão.

## 19.1A — Canonical Measurement Bulletin

### Achado que muda o enquadramento original

A pergunta não era "duas versões concorrentes de `MeasurementBulletin`"
— são **três peças relacionadas, com papéis diferentes no ciclo de
vida**, não três cópias do mesmo conceito:

| Peça | Módulo | Papel aparente | Status próprio |
|---|---|---|---|
| `MeasurementWorkspace` | `domain/measurement-workspace` | Área de trabalho editável — engenheiro monta linhas incrementalmente | `Draft → InProgress → ReadyForReview → Closed/Cancelled` |
| `MeasurementBulletin` (rico) | `domain/bulletin-generator` | Documento formal, gerado a partir de um workspace fechado, validável e finalizável | `Draft → Validated → Finalized → Cancelled` |
| `MeasurementBulletin` (fino) | `domain/measurement-workflow` | Referência/registro dentro do ciclo de certificação contratual | Não tem status próprio — vive dentro de `MeasurementCycleStatus` (`Draft → Measured → BulletinGenerated → Certified → Closed`) |

`MeasurementWorkspaceLine` e `MeasurementBulletinLine` (bulletin-generator)
têm **exatamente o mesmo shape** (`serviceItemId`, `serviceItemCode`,
`description`, `unit`, `quantity`, `unitValue`, `totalValue`,
metadata) — isso não parece coincidência, parece um par
rascunho→documento-final deliberado (o workspace edita, o bulletin
congela). Já o tipo fino de `measurement-workflow` **nunca tem função
própria de criação** (`measurement-workflow.ts` só exporta
`createMeasurementCycle`/`advanceMeasurementCycle` — nenhum
`createMeasurementBulletin`); ele só aparece como
`measurementBulletins: ReadonlyArray<MeasurementBulletin>` dentro de
`MeasurementCycle`, ou seja, é preenchido de fora, nunca fabricado
localmente.

### Prova concreta da colisão (não é só teórica)

`packages/bdos-core/src/index.ts` **já precisou resolver esta colisão
na prática**: os dois tipos disputam o nome `MeasurementBulletin` na
API pública do pacote. A versão fina (`measurement-workflow`) ficou
com o nome limpo (linha 178); a versão rica (`bulletin-generator`) foi
**renomeada no export** para `BulletinGeneratorMeasurementBulletin`
(linha 321), e `MeasurementBulletinId` também precisou de alias
(`BulletinGeneratorMeasurementBulletinId`, linha 329). Alguém já
encontrou este problema e contornou com alias, sem resolver a causa.

### Produtores e consumidores reais (não testes)

**`MeasurementWorkspace`** (`domain/measurement-workspace`):
- Produtor: `createMeasurementWorkspace`/`addMeasurementWorkspaceLine`/etc., só dentro do próprio módulo.
- Consumidor de produção: **nenhum**. Só aparece em testes e no
  re-export do `index.ts`. Domínio completo, testado, **dormant**
  (mesmo status que `service-item-management`, achado da Sprint 19.0).

**`MeasurementBulletin` rico** (`domain/bulletin-generator`):
- Produtor: `createMeasurementBulletin` (calcula `totalValue = quantity × unitValue` por linha — a reconciliação nativa já confirmada na 19.0).
- Consumidor de produção real: `domain/business-facts-generator/adapters/engineering-application/` (`engineering-application-snapshot.ts` lê `bulletin.id`/campos para montar um Business Fact — ou seja, **já alimenta o pipeline de Executive Intelligence/Decision Engine**, mesmo sem nunca ter sido importado de um Excel real).

**`MeasurementBulletin` fino** (`domain/measurement-workflow`):
- Produtor: nenhum (só recebido como parâmetro).
- Consumidor de produção real: `domain/revenue-recognition/revenue-recognition.ts` — usa `bulletin: MeasurementBulletin`, junto de `Certification`/`MeasurementCycleStatus`, para reconhecer receita. Isto bate exatamente com `PLATFORM_ARCHITECTURE.md` §5 ("Medição/Boletim... consumido por Studio de Finanças"): `revenue-recognition` é o consumidor documentado, e é o tipo fino que ele usa hoje.

### Leitura preliminar (não ratificada)

A cadeia mais coerente com o que o código já faz, não com o que
"parece mais limpo":

```
MeasurementWorkspace (rascunho, editável)
        ↓ ao fechar (ReadyForReview → Closed)
MeasurementBulletin — bulletin-generator (documento formal, rico)
        ↓ referenciado por id dentro do ciclo
MeasurementCycle.measurementBulletins — measurement-workflow
        ↓ consumido por
revenue-recognition (reconhecimento de receita, Studio de Finanças)
```

Se esta leitura for confirmada, a consolidação não é "apagar um
tipo" — é: (1) `measurement-workflow.MeasurementBulletin` deixa de ser
uma interface própria e passa a **importar e reusar** o tipo rico de
`bulletin-generator` (ou uma referência mínima `{bulletinId,
bulletinNumber, status}` se `MeasurementCycle` só precisa apontar,
nunca embutir a linha completa); (2) `revenue-recognition.ts` passa a
depender de `bulletin-generator` em vez de `measurement-workflow` para
o tipo do bulletin (só o `MeasurementCycleStatus`/`Certification`
continuam vindo de `measurement-workflow`); (3) o alias
`BulletinGeneratorMeasurementBulletin` em `index.ts` desaparece,
porque só um `MeasurementBulletin` existe.

Isto **não está ratificado** — só a Sprint 19.0/19.1 confirmou os
fatos; a decisão de qual direção tomar (e o que fazer com
`MeasurementWorkspace`, que pode continuar sendo o rascunho de onde um
BM_08 importado entraria antes de virar bulletin formal) é sua.

## 19.1B — WorkPackage Ownership

### Declaração

Única: `domain/work-package-management/work-package-management.types.ts`.
Campos: `id`, `organizationId`, `clientId`, `contractId`, `projectId`,
`code`, `name`, `description`, `type` (`ScopeGroup | ExecutionFront |
CostGroup | Administration | Mobilization | Demobilization | Other`),
`parentWorkPackageId`, `sequence`, `status`, `metadata`.

### Produtores reais (produção, não teste)

Só o **Project Studio** cria `WorkPackage` hoje, em dois pontos:
- `domain/schedule-management/adapters/ms-project-xml-import/ms-project-xml-import.ts` — cada atividade do MS Project XML gera um `WorkPackage` com o **mesmo id da atividade** (`ExecutionFront` para tarefa-folha, `ScopeGroup` para linha de agrupamento).
- `domain/schedule-management/planning-dataset.ts` (`toWorkPackageInputsFromPlanningDataset`) — mesmo padrão para o caminho Excel (`services/bba-project-import/planning-source-import.ts` chama `createWorkPackage` para cada `PlanningWorkPackageInput`).

Nenhum outro domínio cria `WorkPackage` em produção hoje.

### Consumidores reais

- `domain/spatial-object/adapters/work-package-management/work-package-spatial-object-adapter.ts` (Geo Studio) — único adapter existente. Filtra só `WorkPackageType.ExecutionFront` (`ScopeGroup` é pulado com `skipReason: "not_execution_front"`) para gerar `SpatialObject`.
- `domain/service-item-management/service-item-management.types.ts` — `ManagedServiceItem.workPackageId` **já existe como campo declarado**, mas `service-item-management` não tem nenhum produtor/consumidor de produção (dormant, confirmado na 19.0). É uma dependência desenhada, nunca exercitada.

### Não referenciado por

- `execution-management`/`ExecutionTask` — busquei explicitamente, zero menções. A Execution Engine não lê `WorkPackage`; opera só sobre `Action`/`ActionPlan`/`Recommendation` (PRINCIPLE 006, já documentado).
- `PLATFORM_ARCHITECTURE.md` — busquei o termo no documento inteiro: **zero ocorrências**. Confirma objetivamente o achado da 19.0: `WorkPackage` nunca foi declarado na tabela de ownership cross-Studio, apesar de já ser produzido e consumido por dois domínios diferentes (`schedule-management` produz, `spatial-object` consome).

### Identidade hoje

Não existe id compartilhado persistido — a "correlação" entre uma
`ScheduleActivity` e seu `WorkPackage` é só a **convenção de reusar o
mesmo id na hora da criação** (comentário explícito em
`ms-project-xml-import.ts`: "Cada atividade nasce conectada a um
`WorkPackage` com o MESMO id"), válida apenas durante aquele processo
de import em memória — nunca persistida (nenhuma tabela `work_package`
existe, confirmado na 19.0). Se dois processos diferentes (um import
de cronograma, um futuro import de boletim) gerarem `WorkPackage` para
o "mesmo" item de EAP em momentos diferentes, não há mecanismo hoje
que garanta o mesmo id — cada um geraria o seu.

### As três alternativas, à luz do mapa

- **Alternativa A (Project Studio dono)**: é o que já acontece de fato hoje (único produtor real), mas o próprio Project Studio nunca persiste `WorkPackage` — ele existe só durante a janela de um import. "Dono" hoje significa "único criador transitório", não "guardião de um registro durável". Adotar A formalmente exigiria o Project Studio passar a persistir `WorkPackage` de forma durável — um trabalho novo, não uma formalização do que já existe.
- **Alternativa B (Measurement Studio dono)**: nenhuma base no código atual — Measurement Studio nunca criou um `WorkPackage`. Adotá-la significaria inverter quem cria primeiro, plausível apenas se a maioria dos casos reais tiver medição sem cronograma prévio (plausible para o BM_08: o boletim existe, o cronograma real desse contrato talvez nunca tenha sido importado na plataforma).
- **Alternativa C (contexto canônico de escopo/EAP)**: nenhuma base no código atual, mas é a única que não obrigaria escolher um "vencedor" entre dois Studios que hoje têm o mesmo direito de criar o primeiro `WorkPackage` de um contrato.

Não ratifico nenhuma das três aqui — o mapa mostra que a escolha real
não é "onde WorkPackage já mora" (ele não mora persistido em lugar
nenhum), é "qual Studio deve ganhar a responsabilidade de ser o
primeiro a persistir, e como o outro se correlaciona depois".

## Itens não respondidos por este mapa (ficam para a ratificação)

- Se `MeasurementWorkspace` deve continuar existindo como estágio de
  rascunho do BM_08 importado, ou se o adapter de importação deveria
  materializar direto um `MeasurementBulletin` (bulletin-generator) já
  formal, pulando o rascunho.
- Se a consolidação de G.1 deve remover fisicamente o tipo fino de
  `measurement-workflow` ou só parar de duplicar campos (ex.: manter
  `measurementBulletins` como referências, não como array do tipo
  completo).
- A escolha final entre Alternativas A/B/C de G.2.
