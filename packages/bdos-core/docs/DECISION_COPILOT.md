# Decision Copilot — Epic 15, Fase 1 (design, pré-sprint)

> Este documento descreve o desenho da Fase 1 antes da implementação —
> segue a mesma disciplina de `docs/PLATFORM_ARCHITECTURE.md` §15: schema
> e contrato primeiro, código depois. Nenhuma migration, rota ou
> componente deste Epic existe ainda; este arquivo é a especificação a
> partir da qual eles serão construídos.

## Por que Copilot, não chat

Um chat responde pergunta. Um Copilot conduz: faz pergunta de
esclarecimento quando falta contexto, explica o racional, mostra
evidência, recupera histórico, compara alternativas e — depois que o
Execution Engine existir — poderá acionar workflows reais. Ver decisão
do CPO de 2026-07-09: a diferença não é estética, é o que separa BDOS de
"ERP com IA".

A boa notícia é que a maior parte da matéria-prima já existe do Epic 14
e de sprints anteriores — este Epic é majoritariamente composição, não
invenção:

| Peça necessária | Já existe hoje |
|---|---|
| Explicar o racional | `advisor-explanation-builder.ts`, Explainability Drawer |
| Mostrar confiança | `advisor-confidence-builder.ts`, Confidence Indicator |
| Recuperar histórico | `buildEngineeringAdvisorPromptContext` (Sprint 14.3 — sinais temporais) |
| Comparar alternativas | `domain/business-reality-simulator`, `/api/bba-project/simulate-delay` |
| Narrar com LLM | `claude-narrator.ts` |
| Validar resposta estruturada | `advisor-response-validator.ts` |

O que **não** existe ainda e é o objeto real da Fase 1: um jeito de
persistir uma conversa multi-turn, com auditoria, em vez de uma
narrativa single-shot recalculada a cada leitura.

## Fronteira arquitetural: Advisor ainda não grava dado de negócio

`docs/PLATFORM_ARCHITECTURE.md` §1: o Advisor "nunca possui dados
próprios, nunca grava informação, nunca cria regra de negócio". Uma
conversa persistida parece contradizer isso — mas já existe precedente
direto: `advisor_narratives` (Sprint 13.12) já é o Advisor persistindo
sua **própria interpretação**, não dado de domínio. `copilot_conversations`
e `copilot_messages` seguem exatamente esse precedente: é memória do que
o Advisor disse e por quê, não memória de negócio nova.

A parte que exige disciplina explícita é o item futuro "acionar
workflows do Execution Engine" (Fase 3, fora deste documento): quando
chegar, o Copilot só pode chamar `services/*` (Application Services) que
já existem — nunca escrever lógica de negócio nova por conta própria.
Registrado aqui para não virar decisão implícita quando a Fase 3
chegar.

## Escopo da Fase 1

**Dentro:**
- Schema de conversa (persistência + auditoria)
- Um turno de conversa completo: pergunta → contexto montado → resposta
  do Claude → resposta persistida com reasoning chain/confidence/
  explainability **congelados** (não referenciados ao vivo)
- API route + service layer
- UI mínima por Studio (Project Studio e Geo Studio, os dois já em
  produção)
- Testes de fronteira (imutabilidade, RLS, boundary guards existentes)

**Fora (fica para Fase 2+):**
- Perguntas de esclarecimento como comportamento ativo do modelo
- Comparação de alternativas plugada no `business-reality-simulator`
- Acionamento de workflows (depende do Execution Engine)
- Modelagem de "tipo de turno" no schema (`clarifying_question`,
  `comparison`, etc.) — schema da Fase 1 fica deliberadamente genérico
  (`role` + `content` + refs de contexto) até um comportamento real
  provar que precisa de mais forma. Ver nota de "abstração prematura"
  na decisão do CPO.

## Schema

Segue o padrão verificado em
`supabase/migrations/20260708000000_bdos_advisor_narratives.sql`
(`company_id` denormalizado, imutabilidade via políticas `UPDATE`/
`DELETE` bloqueadas com `USING (false)`, grants explícitos só de
`SELECT, INSERT`, coluna `model` para auditoria), **com dois reforços
que `advisor_narratives` não tem**: nem `copilot_conversations` nem
`copilot_messages` ganham `UPDATE` na Fase 1 (nenhuma das duas tem campo
mutável hoje — abrir a política seria superfície sem uso; ver
`title`/`last_message_at`/`archived_at` como gatilho futuro explícito
para reabrir isso com um trigger estreito), e as duas tabelas ganham
trigger de consistência de `company_id` contra o pai — fechando, para
este Epic, a mesma lacuna que `advisor_narratives` deixou em aberto
(ali `company_id`, `engineering_project_id` e `decision_snapshot_id` são
FKs independentes sem checagem cruzada entre si).

```sql
-- copilot_conversations: uma linha por thread. Append-only, mesma
-- imutabilidade de copilot_messages — nenhum campo mutável existe
-- ainda (ver nota acima).
CREATE TABLE IF NOT EXISTS copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  studio_id TEXT NOT NULL CHECK (studio_id IN (
    'bba-project', 'geoespacial', 'evidencias', 'memorias'
    -- estende conforme novos Studios entram em produção (ver
    -- PLATFORM_ARCHITECTURE.md §9.1 para os slugs de rota reais)
  )),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- copilot_messages: append-only. Cada linha assistant congela o
-- contexto que a gerou — nunca um FK "vivo" para o estado atual de
-- decision_snapshots/recommendations, exatamente pelo motivo já provado
-- em decision_snapshots.health_score (Sprint 13.10): sem isso, a trilha
-- de auditoria some assim que o dado subjacente for recalculado.
CREATE TABLE IF NOT EXISTS copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  -- Só preenchido para role = 'assistant'. Cópia congelada no momento
  -- da resposta, não referência.
  context_snapshot JSONB,      -- EngineeringAdvisorPromptContext usado
  context_hash TEXT,           -- hash canônico de context_snapshot, calculado em TS (ver Service layer) — nunca no banco, ordenação de chaves em JSONB não é garantida na serialização de texto
  reasoning_chain JSONB,       -- mesma forma que alimenta o componente Reasoning Chain hoje
  confidence JSONB,            -- output de advisor-confidence-builder
  explainability JSONB,        -- output de advisor-explanation-builder

  -- Referência (não congelada) para rastreabilidade — aponta pro
  -- decision_snapshot real que existia no momento do turno, quando
  -- houver um. Nula em turnos que não geraram novo cálculo (ex.: uma
  -- resposta que só reformula algo já dito).
  decision_snapshot_id UUID REFERENCES decision_snapshots(id) ON DELETE SET NULL,

  model TEXT,                  -- só para role = 'assistant', ex. "claude-sonnet-5"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Um turno assistant sem trilha nunca chega a existir no banco:
  -- reforça em SQL a mesma garantia que copilot-turn-builder.ts já
  -- deveria dar em TypeScript.
  CONSTRAINT copilot_messages_assistant_has_full_trail CHECK (
    role = 'user'
    OR (
      role = 'assistant'
      AND context_snapshot IS NOT NULL
      AND confidence IS NOT NULL
      AND explainability IS NOT NULL
      AND model IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS copilot_messages_conversation_id_idx
  ON copilot_messages (conversation_id, created_at);

ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;

-- copilot_conversations: SELECT/INSERT company-or-admin. UPDATE e
-- DELETE explicitamente bloqueados (não apenas ausência de GRANT —
-- mesma disciplina de defesa em profundidade de advisor_narratives).
CREATE POLICY copilot_conversations_select_company_or_admin
  ON copilot_conversations FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_bba_admin());
CREATE POLICY copilot_conversations_insert_company_or_admin
  ON copilot_conversations FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());
CREATE POLICY copilot_conversations_update_blocked
  ON copilot_conversations FOR UPDATE TO authenticated USING (false);
CREATE POLICY copilot_conversations_delete_blocked
  ON copilot_conversations FOR DELETE TO authenticated USING (false);

-- copilot_messages: imutável, mesmo padrão de advisor_narratives.
CREATE POLICY copilot_messages_select_company_or_admin
  ON copilot_messages FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() OR is_bba_admin());
CREATE POLICY copilot_messages_insert_company_or_admin
  ON copilot_messages FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());
CREATE POLICY copilot_messages_update_blocked
  ON copilot_messages FOR UPDATE TO authenticated USING (false);
CREATE POLICY copilot_messages_delete_blocked
  ON copilot_messages FOR DELETE TO authenticated USING (false);

-- Grants explícitos desde a primeira migration — as duas lacunas
-- retroativas de Sprint 13.6 e do hardening de 13.11 não se repetem.
-- Sem UPDATE em nenhuma das duas tabelas (ver nota no topo da seção).
GRANT SELECT, INSERT ON copilot_conversations TO authenticated;
GRANT SELECT, INSERT ON copilot_messages TO authenticated;

-- Trigger 1: copilot_conversations.company_id precisa bater com
-- engineering_projects.company_id do projeto referenciado. Fecha, um
-- nível acima, a mesma classe de lacuna do Ajuste 2.
CREATE OR REPLACE FUNCTION enforce_copilot_conversation_company_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id <> (
    SELECT company_id FROM engineering_projects WHERE id = NEW.engineering_project_id
  ) THEN
    RAISE EXCEPTION 'copilot_conversations.company_id must match engineering_projects.company_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS copilot_conversations_company_consistency ON copilot_conversations;
CREATE TRIGGER copilot_conversations_company_consistency
BEFORE INSERT ON copilot_conversations
FOR EACH ROW EXECUTE FUNCTION enforce_copilot_conversation_company_consistency();

-- Trigger 2: copilot_messages.company_id precisa bater com
-- copilot_conversations.company_id da conversa referenciada (Ajuste 2
-- como pedido).
CREATE OR REPLACE FUNCTION enforce_copilot_message_company_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id <> (
    SELECT company_id FROM copilot_conversations WHERE id = NEW.conversation_id
  ) THEN
    RAISE EXCEPTION 'copilot_messages.company_id must match copilot_conversations.company_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS copilot_messages_company_consistency ON copilot_messages;
CREATE TRIGGER copilot_messages_company_consistency
BEFORE INSERT ON copilot_messages
FOR EACH ROW EXECUTE FUNCTION enforce_copilot_message_company_consistency();
```

Como as duas tabelas são append-only (sem `UPDATE`), os triggers só
precisam cobrir `BEFORE INSERT` — não existe caminho de `UPDATE` para
introduzir a inconsistência depois de criada a linha.

## Service layer

Mesma separação já usada em `advisor/*`: `packages/bdos-core` fica puro
(monta contexto, decide o que congelar, valida forma da resposta — zero
I/O), `apps/web/lib/bdos/*` é quem fala com o Supabase.

- `packages/bdos-core/src/advisor/copilot/` (novo, mesmo nível de
  `advisor-context-builder.ts` etc.)
  - `copilot-turn.types.ts` — forma de um turno (`role`, `content`,
    `contextSnapshot?`, `reasoningChain?`, `confidence?`,
    `explainability?`, `decisionSnapshotId?`)
  - `copilot-turn-builder.ts` — monta o contexto de um novo turno
    reaproveitando `buildEngineeringAdvisorPromptContext`, decide o que
    vai congelado na resposta, e calcula `context_hash` (hash canônico —
    `JSON.stringify` com chaves ordenadas antes do hash — nunca gerado
    no banco; ver Ajuste 3 da revisão do CPO). Testado por unidade:
    mesmo `context_snapshot` lógico produz o mesmo hash independente da
    ordem de inserção das chaves no objeto de origem.
  - `copilot-response-validator.ts` — mesmo papel que
    `advisor-response-validator.ts`, mas para a forma de um turno —
    inclui a mesma checagem de completude que o `CHECK` do banco
    reforça (nunca confiar só na constraint do banco como única linha
    de defesa)
  - Exportado via subpath próprio no `package.json` (`./advisor/copilot`),
    mesmo padrão das outras entradas de `advisor/*`
- `apps/web/lib/bdos/copilot-repository.ts` (novo) — `createConversation`,
  `appendMessage`, `listMessages(conversationId)`, mesmo estilo de
  `advisor-lab-repository.ts`

## API route

Uma rota compartilhada entre Studios (a lógica é studio-agnostic; o que
muda é qual context builder cada Studio já usa) — evita duplicar rota
por Studio como `/api/bba-project/*` faria:

- `POST /api/copilot/message` — body `{ conversationId?: string,
  studioId: string, projectId: string, message: string }`. Sem
  `conversationId`, cria uma conversa nova. Resposta: a mensagem
  `assistant` persistida completa (mesma forma da tabela).
- `GET /api/copilot/conversations?projectId=&studioId=` — histórico para
  a UI carregar ao abrir.

## UI por Studio

Vai direto para `packages/ui/src/studio-shared/` em vez de nascer
acoplado a um Studio: diferente do Health Score/Executive Hero (que
nasceram no Project Studio e só seriam extraídos "no dia em que um
segundo Studio precisar", per §7), o Copilot já nasce com pelo menos
dois consumidores (Project Studio e Geo Studio) — a regra de
generalização tardia já está satisfeita no primeiro commit, não é
extração prematura.

## Auditoria

Não é um mecanismo à parte — é a própria imutabilidade de
`copilot_messages` combinada com os campos congelados. "O que o Copilot
viu e disse, quando" é reconstruível por `SELECT * FROM copilot_messages
WHERE conversation_id = ...`, sem depender do estado atual de nenhuma
outra tabela.

## Testes de fronteira

- RLS/imutabilidade de `copilot_conversations` e `copilot_messages` —
  mesmo estilo de teste que já cobre `audit_log`/`user_consents`
  (`supabase/tests/audit/`): tentar `UPDATE`/`DELETE` como usuário
  autenticado nas duas tabelas e confirmar que a política bloqueia
  ambas (não só `copilot_messages`, agora que `copilot_conversations`
  também é append-only).
- Trigger de consistência `copilot_conversations` ↔ `engineering_projects`:
  tentar inserir uma conversa com `company_id` diferente do
  `company_id` do `engineering_project_id` referenciado e confirmar que
  a inserção é rejeitada.
- Trigger de consistência `copilot_messages` ↔ `copilot_conversations`:
  mesmo teste, um nível abaixo — `company_id` da mensagem divergente do
  `company_id` da conversa.
- `CHECK copilot_messages_assistant_has_full_trail`: tentar inserir uma
  mensagem `role = 'assistant'` faltando `context_snapshot`,
  `confidence`, `explainability` ou `model` (um teste por campo) e
  confirmar rejeição; confirmar que `role = 'user'` sem nenhum desses
  campos é aceito normalmente.
- `packages/bdos-core/src/architecture/engineering-boundaries.test.ts` —
  confirmar que `advisor/copilot` não precisa entrar em
  `OPERATIONAL_DOMAINS` nem em `FORBIDDEN_SEGMENTS_FOR_OPERATIONAL` (é
  advisor-layer, mesmo tier do resto de `advisor/*`, já fora dessas
  listas).
- `apps/web/architecture/studio-boundaries.test.ts` — como o componente
  de chat vive em `packages/ui/src/studio-shared/`, não em
  `apps/web/components/<studio>/`, confirmar que isso não cria um novo
  falso-positivo no guard.
- Teste unitário no `copilot-turn-builder.ts`: confirmar que o output
  embute os *valores* de `reasoningChain`/`confidence`/`explainability`,
  não apenas um id de referência — é o teste que garante que a decisão
  de "congelar, não referenciar" não regride silenciosamente depois.
- Teste unitário de `context_hash`: dois objetos `context_snapshot`
  logicamente iguais mas com chaves inseridas em ordem diferente devem
  produzir o mesmo hash — é o teste que garante que a canonicalização
  funciona de verdade, não só "por acaso" na ordem de inserção atual.

## O que isso prepara para a Fase 2

Com o turno persistido e auditável funcionando, a Fase 2 (perguntas de
esclarecimento, comparação de alternativas via
`business-reality-simulator`) é comportamento novo sobre uma fundação já
testada — não schema novo. É a mesma sequência que já funcionou no
Epic 14: infraestrutura primeiro, inteligência depois.
