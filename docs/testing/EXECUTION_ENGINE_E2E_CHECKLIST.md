# Execution Engine — Checklist de E2E manual (Epic 16, encerramento 16.9)

> Documento operacional, não arquitetural — para alguém com credenciais
> reais do Supabase (projeto `BBA_app`, `pbzszmpzvwlchbugrsao`) validar
> o fluxo completo do Epic 16 em produção. Nasce porque nenhum passo
> deste checklist pôde ser exercitado por Claude Code durante o 16.7/
> 16.8/16.9 — o ambiente de desenvolvimento não tem sessão autenticada
> real. `pnpm test` cobre a lógica pura (bdos-core); este checklist
> cobre o que só existe integrado: RLS, Postgres, sessão HTTP real.
>
> Referências de arquitetura: `packages/bdos-core/docs/EXECUTION_ENGINE.md`
> (seção "Arquitetura final") e `packages/bdos-core/docs/
> COPILOT_WORKFLOW_HANDOFF.md`. Este documento não repete o *porquê* de
> cada decisão — só o *como verificar* que ela se comporta como
> desenhado.

## Pré-requisitos

- [ ] Uma empresa (`companies`) com pelo menos um `engineering_project`.
- [ ] Pelo menos um `decision_snapshot` com `recommendations` não vazio
      para esse projeto (importar um cronograma via `/bba-project` já
      dispara o pipeline `buildDecisions → buildRecommendations`).
- [ ] Acesso ao SQL editor do Supabase (ou `psql`) para inspecionar
      linhas diretamente — vários passos abaixo pedem confirmação no
      banco, não só na UI.
- [ ] Duas sessões de navegador (ou uma aba anônima) se for testar
      isolamento entre empresas (passo 6).

## 1. Handoff feliz — aprovação simples

1. [ ] Abrir `/bba-project`, localizar o card "Decision Copilot".
2. [ ] Perguntar algo que produza uma resposta citando uma
       Recommendation real (ex.: "por que esse projeto está em
       risco?"). Confirmar que o turno de resposta mostra pelo menos 1
       linha em "Recommendations" com um botão **Aprovar**.
3. [ ] Clicar **Aprovar**.
4. [ ] Confirmar na UI: o botão vira o badge verde "Aprovado"; uma
       nova mensagem assistant aparece no fim da conversa (texto
       "Aprovado. Criei um workflow de execução...").
5. [ ] No Supabase, confirmar:
       - [ ] 1 linha nova em `execution_workflows`, com
             `engineering_project_id`/`decision_snapshot_id` corretos
             e `action_plan_ref_id` no formato
             `action-plan:playbook:<recommendationId>:...`.
       - [ ] N linhas em `execution_tasks` (`workflow_id` apontando
             para a linha acima), uma por opção da Recommendation
             aprovada (`RecommendationOption`), todas com
             `status = 'NotStarted'`.
       - [ ] N linhas em `execution_task_status_history`
             (`to_status = 'NotStarted'`, `from_status IS NULL`).
       - [ ] 1 linha nova em `copilot_messages` com `role = 'assistant'`,
             `model = 'copilot-rule-based-v1'` (nunca `claude-sonnet-5`
             — confirma que a aprovação nunca chamou o Claude) e
             `decision_snapshot_id` preenchido.

## 2. Idempotência — dupla aprovação

1. [ ] Na mesma conversa do passo 1, recarregar a página (nova
       montagem do componente — `conversationId` se perde, Fase 1 não
       tem retomada de sessão) e repetir os passos 1-3 pedindo a
       **mesma** pergunta, chegando na **mesma** Recommendation.
   - Alternativa mais direta: reenviar a mesma requisição
     `POST /api/copilot/message` com o mesmo `approveRecommendationId`
     via `curl`/Postman, reaproveitando `conversationId`,
     `sourceDecisionSnapshotId`, `engineeringProjectId` da primeira
     resposta.
2. [ ] Confirmar na resposta HTTP: `alreadyApproved: true`,
       `executionWorkflowId` **igual** ao da primeira chamada.
3. [ ] No Supabase, confirmar que **nenhuma linha nova** foi criada em
       `execution_workflows`/`execution_tasks`/
       `execution_task_status_history` (mesma contagem de antes) e que
       `copilot_messages` ganhou **no máximo** 1 linha nova referente a
       esta segunda tentativa (o turno de confirmação — nunca um
       segundo workflow).
4. [ ] (Opcional, mais rigoroso) Disparar as duas requisições de
       aprovação quase simultaneamente (duas abas, clique quase
       junto) para exercitar de fato a corrida que o índice único
       `execution_workflows_project_action_plan_unique` existe para
       fechar — confirmar que ainda assim só 1 workflow foi criado.

## 3. Contexto desatualizado — `sourceDecisionSnapshotId`/`engineeringProjectId`

1. [ ] Obter uma resposta do Copilot citando uma Recommendation (como
       no passo 1), mas **sem clicar Aprovar ainda**.
2. [ ] Gerar um novo `decision_snapshot` para o mesmo projeto (ex.:
       reimportar o cronograma), para que
       `getEngineeringAdvisorBriefing` passe a resolver um
       `decisionSnapshotId` diferente do que a resposta antiga tinha.
3. [ ] Só então clicar **Aprovar** na resposta antiga (que carrega o
       `sourceDecisionSnapshotId` velho).
4. [ ] Confirmar: resposta HTTP `409 decision_snapshot_mismatch`; UI
       mostra "O projeto foi atualizado desde esta resposta — atualize
       a conversa antes de aprovar" (nunca "tente novamente").
5. [ ] Confirmar no Supabase que **nada** foi inserido em
       `execution_workflows`/`copilot_messages` por essa tentativa —
       rejeição limpa, sem efeito colateral.

## 4. Recommendation não resolve — 0 ou 2+ no contexto

1. [ ] Forjar uma requisição de aprovação com um
       `approveRecommendationId` que não existe no contexto atual
       (id inventado). Confirmar `404 recommendation_not_found_in_context`.
2. [ ] (Se houver uma forma real de duplicar `Recommendation.id` no
       mesmo contexto — cenário defensivo, não deveria ocorrer em
       produção) confirmar `409 duplicate_recommendation_in_context`.
       Se não for reproduzível com dado real, deixar como coberto só
       pelos testes automatizados (`copilot-approval-orchestrator.test.ts`)
       e marcar este item como não aplicável no ambiente testado.

## 5. Texto livre continua recusado — Intent Router intocado

1. [ ] Digitar, como mensagem normal (não clicar no botão), algo como
       "aprove essa recomendação" ou "aprova a recomendação X".
2. [ ] Confirmar: a resposta é a recusa determinística padrão ("Ainda
       não consigo executar ações..."), **nunca** uma aprovação real —
       nenhuma linha nova em `execution_workflows` por essa mensagem.
3. [ ] Confirmar no Supabase que o turno de recusa tem
       `model = 'copilot-rule-based-v1'` (não gastou chamada à
       Anthropic).

## 6. Isolamento entre empresas (RLS)

1. [ ] Com uma sessão da Empresa A, aprovar uma Recommendation (passo
       1) e anotar o `executionWorkflowId` retornado.
2. [ ] Autenticar como um usuário da Empresa B (sem relação com a
       Empresa A) e chamar `GET /api/execution/workflows` — confirmar
       que o workflow da Empresa A **não aparece**.
3. [ ] (Mais direto, via SQL editor autenticado como `service_role`,
       só para auditoria — nunca como parte do fluxo de produto)
       confirmar que a policy `execution_workflows_select_company_or_admin`
       realmente filtra por `company_id = get_my_company_id()`.

## 7. Repository/API (16.5) reflete o handoff (16.7)

1. [ ] Depois do passo 1, chamar `GET /api/execution/workflows` —
       confirmar que o workflow criado pelo handoff do Copilot aparece
       na lista, com os mesmos campos gravados no Supabase.
2. [ ] Chamar `GET /api/execution/tasks?workflowId=<id>` (ou o
       equivalente exposto) — confirmar que as tasks aparecem com
       `status: "NotStarted"` e `sourceActionRefId` preenchido.

## Resultado esperado

Se os 7 blocos acima passarem sem achado, o Epic 16 está
funcionalmente fechado ponta a ponta em produção — a lacuna que só um
ambiente autenticado real podia fechar (não coberta por
`pnpm test`, que roda contra fixtures em memória, nunca contra Postgres/RLS
reais) fica registrada como resolvida aqui, com data e quem validou.

| Bloco | Validado em | Por quem |
|---|---|---|
| 1. Handoff feliz | | |
| 2. Idempotência | | |
| 3. Contexto desatualizado | | |
| 4. Recommendation não resolve | | |
| 5. Texto livre recusado | | |
| 6. Isolamento entre empresas | | |
| 7. Repository/API | | |
