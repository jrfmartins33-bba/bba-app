# Human-First Visual UX

Documento operacional de PRINCIPLE 008 (`BDS_ARCHITECTURE_PRINCIPLES.md`).
Enquanto o princípio fixa a regra permanente, este documento traduz
essa regra em algo diretamente utilizável na implementação e na
revisão de Sprints — só com o que já está sustentado por evidência
real (o caso do Sprint 20.1E.6, Relatório Executivo de Medições).
Deliberadamente não contém regras específicas para módulos ainda não
construídos (Financeiro, Aprovações, Documentos, histórico) — esses
padrões entram aqui quando forem comprovados numa implementação real,
nunca antecipados.

## Objetivo

O BDOS é feito para quem administra um negócio, não para quem conhece
a arquitetura por trás dele. Toda tela que apresenta análise,
recomendação ou decisão precisa ser entendida em segundos, não
interpretada como um documento técnico.

## Público-alvo que orienta a interface

MEIs, PMEs, gestores, responsáveis financeiros, engenheiros e
gestores de obra, profissionais administrativos — pessoas com pouco
tempo, que usam o sistema entre outras tarefas, e que podem não
conhecer termos técnicos de desenvolvimento.

## As quatro perguntas obrigatórias

Toda tela importante precisa responder visualmente:

1. **O que está acontecendo?** — status, situação ou conclusão principal.
2. **Isso exige atenção?** — prioridade, risco ou urgência.
3. **O que devo fazer?** — próxima ação clara e objetiva.
4. **Onde está o problema, o contexto ou a origem relevante?** — item, documento ou contexto relacionado.

Uma tela que não responde a essas quatro perguntas sem leitura longa
ainda não está pronta.

## As quatro camadas

```
Camada 1 — Entendimento instantâneo
    status, conclusão, prioridade, ação principal — sem interação
Camada 2 — Contexto rápido
    o que foi identificado, por que importa, qual o impacto
Camada 3 — Orientação
    ação recomendada, próximos passos, condição para prosseguir
Camada 4 — Detalhe sob demanda
    explicação técnica, origem documental, rastreabilidade completa
```

Uma tela nunca deve começar pela Camada 4.

## Guardrail central

> Todo apoio visual deve representar um dado, estado, relação ou
> decisão real fornecida pelo sistema. A UI pode apresentar e
> organizar; nunca pode calcular, completar, inferir ou fabricar
> significado para preencher espaço.

Exemplos proibidos, encontrados ou hipotéticos:

- barra de progresso sem percentual real;
- score calculado no frontend;
- gráfico derivado de texto narrativo;
- célula fictícia de planilha;
- prioridade inferida pela cor;
- relação entre ação e item baseada em título;
- confiança presumida;
- status criado apenas para tornar a tela mais visual.

O visual reorganiza e apresenta o que o BDOS já decidiu. Nunca decide
nem completa lacunas por conta própria — mesma disciplina já aplicada
em todo o Epic 20 (nenhuma UI calcula, soma ou infere o que o builder
não calculou).

**Honestidade de estado é diferenciação, não limitação.** Quando o
backend expõe explicitamente que algo ainda não foi calculado (ex.:
`confidence: { status: "unavailable" }`), a UI apresenta isso como
uma afirmação honesta ("índice ainda não calculado"), nunca como 0%,
falha ou baixa confiança disfarçada. A UI só pode apresentar um
estado como "auditado" ou "calculado" quando o backend fornecer esse
dado explicitamente — nunca deduzir isso da ausência de warnings ou
da presença de uma referência.

## Regras anti-ERP

Ficam fora do padrão principal de qualquer tela decisória:

1. Paredes de texto.
2. Tabelas extensas como primeira experiência.
3. Cards com muitos parágrafos e o mesmo peso visual.
4. Seções repetindo a mesma informação em lugares diferentes.
5. Status sem ação correspondente.
6. Detalhes técnicos abertos por padrão.
7. Termos internos da arquitetura vazando para a UI (PRINCIPLE 007).
8. Accordions de texto como única linguagem de organização.

## Mobile

Mobile não é uma versão reduzida posterior — é condição de aceitação
da experiência. A hierarquia decisória (o que está acontecendo, o que
fazer) precisa permanecer compreensível em tela pequena, mesmo quando
a disposição visual muda (empilhamento em vez de colunas, por
exemplo). Isso não significa mobile-first para toda tela
administrativa complexa; significa paridade de compreensão.

## Padrões comprovados

Só o que já existe ou foi validado em produção — nada especulativo.

- **Decision Hero** (Medições, Sprint 20.1E.3): marcador de estado
  (ícone + rótulo curto) + conclusão dominante + contexto secundário
  + nota de confiança honesta. Padrão candidato — aplicado hoje só em
  Medições; antes de virar componente compartilhado em `packages/ui`,
  precisa ser aplicado a um segundo módulo real e comparado, para
  evitar abstração genérica baseada numa única implementação.
- **Itens recolhidos com resumo escaneável** (Itens Críticos, Sprint
  20.1E.4): número, severidade, título visíveis sem expandir;
  detalhe completo só sob demanda, com estado próprio por item.
- **Origem contextual, não consolidada** (Sprint 20.1E.6): a origem
  documental aparece dentro do contexto que ela sustenta (item
  crítico, ação recomendada), nunca numa seção final separada que
  repete a mesma informação organizada de outro jeito.
- **Vocabulário humano nos blocos decisórios**: "O que foi
  encontrado" / "Ao corrigir" / "Se for ignorado" / "Ver onde foi
  encontrado" — nunca nomes de campo do contrato ("Fato identificado"
  como rótulo técnico, `sourceType`, `locator`).

## Aplicação em Sprints

Todo brief de Sprint que envolva interface deve responder, antes da
implementação, a seção **Human-First Visual UX**:

1. Qual é a pergunta principal do usuário nesta tela?
2. O que ele precisa entender em cinco segundos?
3. Qual é o elemento visual principal?
4. O que fica recolhido por padrão?
5. Qual é a ação principal?
6. Como a tela evita aparência de ERP?
7. Como texto e visual se complementam?
8. Como a experiência funciona no mobile?
9. Quais dados reais sustentam o visual?
10. O que a UI explicitamente não pode inventar?

## Limite do enforcement

Pode ser automatizado (guard estático, mesmo padrão de
`product-vocabulary-boundaries.test.ts`/`studio-boundaries.test.ts`):
ausência de termo proibido, componente recolhido por padrão, ausência
de cálculo/formatação no frontend, ausência de acesso direto a
Supabase/Storage, uso de campos explícitos do contrato.

Não pode ser automatizado, e continua exigindo revisão humana com
dados reais a cada Sprint: entendimento em cinco segundos, sensação
de complexidade, equilíbrio entre texto e visual, aparência de ERP,
adequação ao público MEI/PME. Nenhum teste substitui essa validação —
mesma honestidade de PRINCIPLE 007 sobre seus próprios limites.

## Checklist de revisão

Antes de considerar pronta qualquer Sprint de UI relevante:

```text
[ ] A conclusão principal é compreensível em cinco segundos.
[ ] A tela responde o que está acontecendo.
[ ] A prioridade ou risco está evidente.
[ ] Existe uma próxima ação clara.
[ ] Há apoio visual real, sustentado por dado do backend.
[ ] Não há paredes de texto.
[ ] Os detalhes técnicos estão subordinados (Camada 4).
[ ] Não existe informação repetida entre seções.
[ ] O vocabulário é humano (PRINCIPLE 007).
[ ] Não aparecem conceitos internos da arquitetura.
[ ] O visual não é decorativo -- representa dado real.
[ ] A tela funciona em desktop.
[ ] A tela mantém a hierarquia decisória em mobile.
[ ] A tela foi validada visualmente com dados reais.
```
