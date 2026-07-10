# Vocabulário de Produto — Auditoria Operacional (não-CI)

> Documento operacional, mesmo espírito de
> `docs/testing/EXECUTION_ENGINE_E2E_CHECKLIST.md` — cobre uma
> superfície que nenhum teste automatizado consegue garantir. O guard
> estático (`apps/web/architecture/product-vocabulary-boundaries.test.ts`,
> parte de `pnpm test`) protege todo texto **fixo** no repositório —
> componentes, mensagens determinísticas do Copilot, o texto literal
> dos system prompts. Ele **não pode** proteger o que o Claude gera
> livremente em tempo de execução (turnos `answer`/`compare` do
> Decision Copilot, narrativa do BBA Advisor) — isso só se verifica
> lendo respostas reais. Ver PRINCIPLE 007
> (`packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md`) para o
> porquê dessa divisão.

## Quando rodar isto

- Depois de qualquer mudança no `SYSTEM_PROMPT` de
  `packages/bdos-core/src/advisor/claude-narrator.ts` ou
  `packages/bdos-core/src/advisor/copilot/copilot-turn-builder.ts`.
- Depois de qualquer mudança em `EngineeringAdvisorPromptContext`
  (`advisor-prompt-context.types.ts`/`-builder.ts`) que adicione um
  campo novo ao contexto que o Claude recebe — um nome de campo novo é
  a forma mais comum desse tipo de vazamento aparecer (o modelo cita a
  chave do JSON que recebeu).
- Periodicamente (sugestão: 1x por sprint que toque o Copilot/Advisor),
  mesmo sem mudança de prompt — o comportamento do modelo não é 100%
  determinístico entre versões.

## Parte 1 — Revisão do texto do prompt

1. [ ] Ler o `SYSTEM_PROMPT` inteiro de `claude-narrator.ts`. Confirmar
       que a instrução "sem jargão técnico" continua presente
       (linha ~51, dentro de REGRAS INEGOCIÁVEIS).
2. [ ] Ler o `SYSTEM_PROMPT` inteiro de `copilot-turn-builder.ts`.
       Confirmar:
       - [ ] A identidade declarada no início é **"BBA Advisor"**,
             nunca "Decision Copilot" nem qualquer outro nome.
       - [ ] A instrução "sem jargão técnico" e a instrução explícita
             de nunca citar nomes de campo/tipo internos (`Decision`,
             `Recommendation`, `BDOS`) continuam presentes.
3. [ ] Se um campo novo foi adicionado ao contexto (`snapshot`,
       `history`, `decisions`, `recommendations`, `evidence`,
       `comparisonOptions`, ou qualquer extensão futura): confirmar
       que a instrução ao Claude descreve **o que fazer com o dado**,
       nunca instrui a repetir o nome da chave JSON na resposta.

## Parte 2 — Amostragem de respostas reais

Não é um teste automatizado — é leitura humana de output real. Rodar
contra o Advisor Lab (`/admin/advisor-lab`, Admin-visible, já existe
para isto) ou contra conversas reais do Decision Copilot em
`/bba-project`.

1. [ ] Gerar pelo menos 5 respostas reais cobrindo cenários
       diferentes:
       - [ ] Uma pergunta simples ("por que esse projeto está em
             risco?").
       - [ ] Uma pergunta de comparação (`compare`/`comparisonOptions`
             populado).
       - [ ] Uma pergunta sobre evolução temporal ("piorou desde a
             última importação?").
       - [ ] Uma pergunta ambígua (deve cair em `clarify` —
             determinístico, já coberto pelo guard, mas confirmar que
             o Router classificou certo).
       - [ ] Um pedido de ação em texto livre ("aprove isso") — deve
             cair em `unsupported_action`, determinístico, já coberto.
2. [ ] Para cada resposta gerada **pelo Claude** (`answer`/`compare` —
       nunca as determinísticas, essas já são protegidas pelo guard),
       ler o campo `summary`/`title` procurando por:
       - [ ] Qualquer termo da lista "Termos internos absolutos" de
             `packages/bdos-core/docs/PRODUCT_VOCABULARY.md`.
       - [ ] Qualquer nome de campo do JSON de contexto citado
             literalmente (`decisionIds`, `isNew`,
             `openSinceImportCount`, `traceability`, etc.).
       - [ ] O próprio Claude se identificando com um nome diferente
             de "BBA Advisor" (ex.: "como assistente de IA...", "como
             Decision Copilot...").
3. [ ] Registrar o resultado na tabela abaixo — mesmo quando limpo,
       para ter histórico de quando a última amostragem real
       aconteceu.

## Parte 3 — O que fazer se encontrar um vazamento

1. Nunca é motivo para adicionar o termo ao guard estático — o guard
   não pode ver texto gerado pelo modelo (é exatamente por isso que
   esta Parte 2 existe).
2. Reforçar a instrução no `SYSTEM_PROMPT` relevante — geralmente uma
   frase explícita proibindo aquele termo específico, no mesmo padrão
   das regras já existentes ("Nunca cite nomes internos de
   campo/tipo...").
3. Gerar uma nova amostra (Parte 2) depois do ajuste, para confirmar
   que a instrução nova realmente mudou o comportamento — uma
   instrução de prompt não é uma garantia determinística, só reduz a
   probabilidade.
4. Se o vazamento persistir depois de reforçar a instrução mais de uma
   vez, considerar que o campo problemático não deveria estar no
   contexto que o Claude recebe (Prompt Context Optimizer,
   `advisor-prompt-context-builder.ts`) — remover a informação da
   fonte é mais confiável do que instruir o modelo a ignorá-la.

## Histórico de auditorias

| Data | Quem | Prompts revisados (Parte 1) | Amostras lidas (Parte 2) | Achados | Ação |
|---|---|---|---|---|---|
| 2026-07-10 | Claude Code (Epic 17.2) | claude-narrator.ts, copilot-turn-builder.ts | Não aplicável — revisão de texto do prompt, sem sessão autenticada para gerar amostras reais neste ambiente (mesma limitação registrada em EXECUTION_ENGINE_E2E_CHECKLIST.md) | Identidade errada ("BBA Decision Copilot") e cláusula "sem jargão técnico" ausente no prompt do Copilot | Corrigido no mesmo Epic (17.2A) — Parte 2 (amostragem real) fica pendente para quem tiver acesso a um ambiente autenticado |
