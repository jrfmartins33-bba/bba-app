# BDS Architecture Principles

Princípios arquiteturais permanentes do Business Decision System (BDS)
da BBA Platform. A partir da UI Sprint M2, todo indicador exposto pela
plataforma deve ser projetado em conformidade com os princípios abaixo
— eles não são uma sugestão de estilo, são um requisito estrutural
permanente do projeto.

Esta é uma sprint **exclusivamente arquitetural**: nenhuma regra de
negócio, cálculo, integração, backend ou lógica foi implementada aqui.
Os princípios descrevem a estrutura que todo indicador deverá
satisfazer; os componentes de UI correspondentes
(`packages/ui/src/decision/`) e a primeira aplicação visual (mock, sem
dados reais) em `/workspaces/engenharia/planejamento` preparam o
terreno para quando cada Engine do BDS começar a alimentá-los com dados
reais.

---

## PRINCIPLE 001 — Full Traceability

Nenhum indicador poderá existir sem rastreabilidade.

Todo indicador — de qualquer Engine, em qualquer tela da plataforma —
deve possuir estrutura preparada para responder:

- **O que aconteceu?**
- **Onde aconteceu?**
- **Quando aconteceu?**
- **Por que aconteceu?**
- **Qual o impacto?**
- **Quais evidências suportam a conclusão?**
- **Qual ação recomendada?**

Um indicador que não consiga, em princípio, responder a essas sete
perguntas não está pronto para ser exposto na BBA Platform — mesmo que,
hoje, a resposta disponível seja apenas um placeholder ("Aguardando
dados do Planning Engine.").

## PRINCIPLE 002 — Mandatory Drill-down

Todo indicador deverá permitir navegação do Dashboard Executivo até sua
origem, seguindo o fluxo padrão:

```
Dashboard Executivo
      ↓
Engine responsável
      ↓
Projeto
      ↓
Macroetapa
      ↓
Frente
      ↓
Serviço
      ↓
Atividade
      ↓
Documento
      ↓
Foto
      ↓
Latitude
      ↓
Drone
      ↓
Diário
      ↓
Memória
```

Este fluxo é a espinha dorsal de navegação da plataforma: um usuário
parte de um número agregado no Dashboard Executivo e, sem sair do
produto, consegue descer até a evidência de campo específica (uma
foto, uma coordenada, um diário de obra) que sustenta aquele número.

---

## Estado de implementação (UI Sprint M2)

- ✅ Princípios documentados (este arquivo).
- ✅ Componentes visuais de suporte criados em
  `packages/ui/src/decision/` (`DecisionInsightCard`, `DecisionSection`,
  `DecisionPlaceholder`) — sem lógica, sem estado, sem integração.
- ✅ Primeira aplicação mock em `/workspaces/engenharia/planejamento`
  (card "Análise da Situação", todos os campos como placeholder; botão
  "Entender" inativo, sem modal/drawer/navegação).
- ⏳ Nenhum Engine ainda alimenta esses componentes com dados reais e
  nenhuma navegação de drill-down (Principle 002) foi implementada —
  isso é trabalho de sprints futuras, uma por Engine.

## Engines que deverão adotar estes princípios

Planning Engine, Execution Engine, Finance Engine, Measurement Engine,
Evidence Engine, Geospatial Engine, Approval Engine, Dashboard
Executivo e BBA Advisor.
