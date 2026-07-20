# Modelo — Pacote Padrão de Evidências de Sprint

Copie este arquivo para o relatório final de qualquer Sprint que reivindique validação (sintética, adversarial ou real) de uma capacidade documental. Preencha todas as 17 seções — nenhuma pode ficar implícita. Este modelo nunca substitui o veredito da Sprint; ele organiza a evidência que sustenta o veredito.

**Antes de preencher, releia `EPIC_21_SPRINT_4G_REAL_VALIDATION_GOVERNANCE.md`** — em particular o padrão de maturidade e a distinção entre teste de caracterização, teste de aceitação, teste adversarial e validação em documento real (seção "Regra sobre testes").

## 0. Tipo de alvo (`targetKind`)

`capability` ou `end_to_end_scenario` — nunca ambíguo. Uma capacidade isolada nunca carrega o veredito de um cenário ponta a ponta do qual ela é apenas uma das dependências: se a evidência demonstra apenas que a capacidade recebeu entrada inválida de uma dependência upstream reprovada, o resultado próprio da capacidade é `inconclusiva` (com a causa registrada), nunca `reprovada` — o veredito `reprovada` pertence à dependência upstream defeituosa e/ou ao registro `end_to_end_scenario` que descreve o cenário completo.

## 1. Objetivo verificável

Uma frase, testável — nunca "melhorar X" ou "investigar Y" sem um critério de sucesso explícito.

## 2. Hipótese

O que se espera que seja verdade, formulada ANTES de qualquer execução.

## 3. Resultado esperado (definido antes da implementação)

Congelado antes de rodar qualquer coisa. Nunca editado depois para combinar com o que saiu — se o resultado esperado precisar mudar, documente por quê e quando, nunca silenciosamente.

## 4. Fonte real

Nome genérico da fonte (nunca o caminho local) — ex.: "Anexo Técnico do Termo de Referência, Pregão Eletrônico XXXXX/AAAA".

## 5. Fingerprint da fonte

SHA-256 **completo** (64 caracteres hexadecimais, `[0-9a-f]{64}`) — nunca truncado, nunca reconstruído de memória. Fingerprint truncado não é mais aceito quando a governança reivindicar evidência real.

## 6. Páginas ou intervalos

Intervalo de páginas ou traço estrutural referenciado.

## 7. Resultado sintético

Resumo dos testes sintéticos (nominal, fronteira, adversarial conhecido) — nunca "todos os testes passaram" isolado (ver seção "Regra sobre testes" da governança). Separe:
- quantidade de testes técnicos;
- testes de caracterização (documentam comportamento atual, podem incluir defeito conhecido);
- testes de aceitação (afirmam o comportamento correto exigido);
- testes adversariais (tentam quebrar a hipótese deliberadamente).

## 8. Resultado adversarial

Resultado específico dos casos adversariais — nunca misturado com o resultado sintético nominal.

## 9. Resultado real

Resultado observado ao processar a fonte real — nunca confundido com sintético.

## 10. Divergências

Lista explícita entre esperado (seção 3) e observado (seção 9). Vazia apenas quando genuinamente não há nenhuma.

## 11. Limitações

Sempre preenchida — ao menos a declaração explícita de ausência de limitações conhecidas, nunca omitida silenciosamente.

## 12. Nível de evidência anterior e resultado anterior (separados)

Conforme `CAPABILITY_MATURITY_REGISTRY` antes desta Sprint — nível (`currentLevel`) e resultado (`currentResult`) são eixos independentes, preencha os dois separadamente. Nunca escreva "reprovada" no campo de nível — reprovada é sempre um resultado, nunca um nível de evidência.

## 13. Nível de evidência solicitado e resultado solicitado (separados)

O nível que este pacote de evidências reivindica (deve satisfazer precisamente `REAL_VALIDATION_MATURITY_LEVEL_REQUIREMENTS_PT` para esse nível) **e**, separadamente, o resultado que a evidência sustenta (`aprovada`/`reprovada`/`inconclusiva`/`não avaliada`). O nível de evidência NUNCA implica o resultado — um nível profundo (`comparada_formalmente_em_caso_real`, `submetida_a_teste_adversarial`) permite legitimamente resultado `reprovada` ou `inconclusiva`. Confirme que a combinação está entre as permitidas em `PERMITTED_LEVEL_RESULT_COMBINATIONS`. Se o resultado solicitado for `inconclusiva`, preencha também a causa da inconclusão. Liste também `dependsOnTargetIds` afetados por esta Sprint, e se alguma dependência upstream está `reprovada`/`inconclusiva`/`não avaliada` (o que, pelo grafo de dependências, impede portões `real_validation`/`productive_use` de ficarem `aberto`).

## 14. Portões afetados (específicos, com `purposeKind` estruturado)

Liste cada `DownstreamGate` afetado por esta Sprint como `{ consumidor, finalidade em português, purposeKind (diagnostic | development | technical_chaining | real_validation | productive_use), status, justificativa, evidência faltante, comportamento quando bloqueado }` — nunca um único status genérico para o alvo inteiro. Um mesmo alvo pode ter portões diferentes abertos para diagnóstico (`purposeKind: "diagnostic"`/`"development"`) e bloqueados para uso produtivo/validação real (`purposeKind: "productive_use"`/`"real_validation"`) simultaneamente. O bloqueio por dependência reprovada/inconclusiva é decidido pelo grafo (`dependsOnTargetIds`) e por `purposeKind` — nunca por palavras em `purposePt`.

## 15. Arquivos de produção alterados

Lista exata, ou "nenhum".

## 16. Rollback realizado, quando aplicável

Se uma hipótese foi revertida, documente exatamente o quê e confirme `git diff` vazio no(s) arquivo(s) de produção envolvido(s).

## 17. Decisão humana necessária

O que especificamente está sendo pedido ao Aprovador: promoção de nível, mudança de resultado, autorização para prosseguir, autorização para escalonamento arquitetural, ou apenas registro de investigação concluída sem correção. Nunca presuma a aprovação — registre o campo `approver` do histórico como `ROLE_NOT_FORMALIZED` até que o responsável humano pelo produto se manifeste.

---

**Papéis** (ver seção "Separação de responsabilidades" da governança): identifique quem preencheu como Implementador, quem (se houver) atuou como Revisor adversarial, e que a aprovação final cabe ao Aprovador — nunca ao próprio relatório do Implementador.
