# Modelo — Pacote Padrão de Evidências de Sprint

Copie este arquivo para o relatório final de qualquer Sprint que reivindique validação (sintética, adversarial ou real) de uma capacidade documental. Preencha todas as 17 seções — nenhuma pode ficar implícita. Este modelo nunca substitui o veredito da Sprint; ele organiza a evidência que sustenta o veredito.

**Antes de preencher, releia `EPIC_21_SPRINT_4G_REAL_VALIDATION_GOVERNANCE.md`** — em particular o padrão de maturidade e a distinção entre teste de caracterização, teste de aceitação, teste adversarial e validação em documento real (seção "Regra sobre testes").

## 1. Objetivo verificável

Uma frase, testável — nunca "melhorar X" ou "investigar Y" sem um critério de sucesso explícito.

## 2. Hipótese

O que se espera que seja verdade, formulada ANTES de qualquer execução.

## 3. Resultado esperado (definido antes da implementação)

Congelado antes de rodar qualquer coisa. Nunca editado depois para combinar com o que saiu — se o resultado esperado precisar mudar, documente por quê e quando, nunca silenciosamente.

## 4. Fonte real

Nome genérico da fonte (nunca o caminho local) — ex.: "Anexo Técnico do Termo de Referência, Pregão Eletrônico XXXXX/AAAA".

## 5. Fingerprint da fonte

SHA-256 (ou a forma já registrada em um relatório anterior, mesmo que truncada) — nunca reconstruído de memória.

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

O nível que este pacote de evidências reivindica (deve satisfazer precisamente `REAL_VALIDATION_MATURITY_LEVEL_REQUIREMENTS_PT` para esse nível) **e**, separadamente, o resultado que a evidência sustenta (`aprovada`/`reprovada`/`inconclusiva`/`não avaliada`). Confirme que a combinação (nível, resultado) está entre as permitidas em `PERMITTED_LEVEL_RESULT_COMBINATIONS` — em particular, `validada_em_caso_real`/`validada_adversarialmente` só combinam com `aprovada`; um resultado negativo mantém o nível em `caracterizada_em_caso_real`. Se o resultado solicitado for `inconclusiva`, preencha também a causa da inconclusão.

## 14. Portões afetados (específicos, nunca genéricos)

Liste cada `DownstreamGate` afetado por esta Sprint como `{ consumidor, finalidade, status, justificativa, evidência faltante, comportamento quando bloqueado }` — nunca um único status genérico para a capacidade inteira. Uma mesma capacidade pode ter portões diferentes abertos para diagnóstico e bloqueados para consumo produtivo/econômico simultaneamente.

## 15. Arquivos de produção alterados

Lista exata, ou "nenhum".

## 16. Rollback realizado, quando aplicável

Se uma hipótese foi revertida, documente exatamente o quê e confirme `git diff` vazio no(s) arquivo(s) de produção envolvido(s).

## 17. Decisão humana necessária

O que especificamente está sendo pedido ao Aprovador: promoção de nível, mudança de resultado, autorização para prosseguir, autorização para escalonamento arquitetural, ou apenas registro de investigação concluída sem correção. Nunca presuma a aprovação — registre o campo `approver` do histórico como `ROLE_NOT_FORMALIZED` até que o responsável humano pelo produto se manifeste.

---

**Papéis** (ver seção "Separação de responsabilidades" da governança): identifique quem preencheu como Implementador, quem (se houver) atuou como Revisor adversarial, e que a aprovação final cabe ao Aprovador — nunca ao próprio relatório do Implementador.
