# Epic 21 — Sprint 21.4B.3A — Pacote de Evidências

Segue o formato de `TEMPLATE_SPRINT_EVIDENCE_PACKAGE.md`, adaptado ao escopo desta Sprint (descoberta arquitetural — não uma reavaliação de maturidade de `f.2a`, que permanece `exercitada_em_caso_real`/`reprovada`/`confirmed`, inalterada).

## 0. Tipo de alvo

Não aplicável no sentido do registro de maturidade — esta Sprint não reavalia `capability` nem `end_to_end_scenario` algum. O "alvo" desta evidência é a pergunta arquitetural do pré-registro (`EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md`).

## 1. Objetivo verificável

Determinar se alguma das hipóteses candidatas pré-registradas (H1-H4, mais o refinamento H3b) constitui uma invariante segura, determinística e generalizável de pertencimento à grade tabular — testável contra a matriz sintética completa E contra o documento real.

## 2. Hipótese

Formulada no pré-registro (commit `764a62cbf3ebaa51cda98da62c6c832cabfd97ff`): compatibilidade de largura de segmento contra um envelope de coluna derivado de linhas-âncora (H3) resolveria os casos sintéticos que sobreposição/componente puro (H1/H2) e blocos físicos (H4) não resolvem.

## 3. Resultado esperado (definido antes da execução)

Pré-registrado: H3 deveria passar os 20 casos obrigatórios sintéticos sem exceção; H1/H2 deveriam falhar em casos onde um elemento largo coincide com uma única borda de coluna (N1/N2/N7/N8); H4 deveria ser testado sem presunção prévia de sucesso ou falha.

## 4. Fonte real

Anexo Técnico do Termo de Referência, Pregão Eletrônico 90006/2025 — DNOCS — Recuperação e Modernização da Barragem Lagoa do Arroz. Páginas orçamentárias reais 46-54 (9 páginas).

## 5. Fingerprint da fonte

```
5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5
```

Confirmado por `sha256sum` diretamente sobre o arquivo local (`_local-documents/epic-21/lagoa-do-arroz/01_Origem_Edital/05_Anexo_Tecnico_Termo_Referencia.pdf`) e por comparação byte a byte com `MANIFESTO_SHA256.csv` — idêntico ao fingerprint exigido no enunciado da Sprint. Documento NÃO commitado (fora de `src/`, fora do controle de versão, apenas lido localmente por `scripts/discover-tabular-membership-real-document.ts`).

## 5b. Proveniência da expectativa

`expectationDefinedAt`: 2026-07-20 (data do pré-registro, commit `764a62c`). `expectationReference`: `EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md` §4/§12, verificado por inspeção direta (o próprio commit deste pré-registro). `executionObservedAt`: 2026-07-20 (mesmo dia — a Sprint inteira ocorreu num único dia corrido; não há separação de dias entre pré-registro e execução, apenas separação de COMMITS, auditável pela ordem de push).

## 6. Páginas ou intervalos

Páginas reais 46-54 (9 páginas), conforme exigido no enunciado.

## 7. Resultado sintético

20 casos obrigatórios (`discovery-case-matrix.ts`): 10 positivos (P1-P10), 10 negativos (N1-N10, incluindo os 3 adversariais obrigatórios N2/N8/N9). Testes técnicos: 4 arquivos, 24 verificações executáveis (10 integridade + 4 indistinguibilidade + 10 avaliação de candidatas). Resultado por candidata:

| Candidata | Positivos (10) | Negativos (10) | Adversariais (N2/N8/N9) | Total obrigatório |
|---|---|---|---|---|
| H1 (âncora + sobreposição) | 10/10 | 6/10 (falha N1,N2,N7,N8) | 1/3 (falha N2,N8) | REPROVADA |
| H2 (componente de incidência) | 10/10 | 6/10 (falha N1,N2,N7,N8) | 1/3 (falha N2,N8) | REPROVADA |
| H3 (envelope local + largura) | 10/10 | 10/10 | 3/3 | **APROVADA (sintético)** |
| H3b (envelope global + largura) | 10/10 | 10/10 | 3/3 | **APROVADA (sintético)** |
| H4 (blocos físicos de f.1) | 10/10 | 0/10 (falha todos) | 0/3 | REPROVADA |

Testes de permutação, translação e escala (§13/§14 do enunciado): H3 é invariante às três transformações (Casos P2 e N8, verificado por execução — `discovery-candidate-evaluation.test.ts`). Teste de fronteira exata do limiar de largura (1.6x): abaixo inclui, exatamente no limite inclui, acima exclui — comportamento determinístico confirmado nos três pontos.

## 8. Resultado adversarial

Os 3 casos adversariais obrigatórios (N2 = Caso L7 reconstruído, N8 = Caso J reconstruído, N9 = Caso L3 reaproveitado como negativo) são projetados especificamente para serem indistinguíveis de positivos legítimos (P2/F) no nível de evidência do helper atual — confirmado pela prova de indistinguibilidade executável (§9 abaixo). H3/H3b são as únicas candidatas que rejeitam corretamente os três.

## 9. Prova de indistinguibilidade (nível helper) e refutação (nível capacidade)

Executada em `discovery-indistinguishability-proof.test.ts`, dois pares (F-vs-J, L1-vs-L7): a representação canônica da linha-alvo no NÍVEL DO HELPER ATUAL (apenas `lineKey`+`verticalOrder`+pertencimento a `alignmentKey`) é **idêntica** entre o caso positivo e o negativo em ambos os pares — prova formal de que nenhuma função determinística limitada a essa evidência pode distingui-los. Ao ampliar para o nível da capacidade completa (largura de segmento, já calculada por `detectPage`/`buildAlignmentCandidateSegments`, nunca encaminhada ao helper), a igualdade se desfaz: a largura do segmento difere significativamente entre positivo e negativo em ambos os pares — refutando a insuficiência de evidência no nível mais amplo e habilitando H3/H1/H2 como candidatas viáveis nesse nível.

## 10. Resultado real (documento real — achado central desta Sprint)

### 10.1 Estrutura observada (regra de produção atual, `f.2a`, inalterada)

| Página real | Linhas | Regiões formadas | Incluídas | Excluídas |
|---|---|---|---|---|
| 46 | 73 | 7 | 25 | 48 |
| 47 | 80 | 7 | 30 | 50 |
| 48 | 77 | 6 | 30 | 47 |
| 49 | 79 | 4 | 18 | 61 |
| 50 | 80 | 3 | 24 | 56 |
| 51 | 83 | 1 | 5 | 78 |
| 52 | 84 | 2 | 6 | 78 |
| 53 | 81 | 6 | 30 | 51 |
| 54 | 33 | 2 | 11 | 22 |

Confirma, com números concretos e piores em algumas páginas (51/52: quase toda a página excluída), a reprovação já registrada de `f.2a` — nunca alterada por esta Sprint.

### 10.2 Manifesto de amostras reais rotuladas (identidade preservada como texto de origem, nunca coordenada/índice interno instável entre execuções)

Classificação humana feita por inspeção direta do texto extraído de cada linha (permitido — os algoritmos candidatos nunca usam texto, apenas geometria). Amostra da avaliação completa de H1-H4/H3b salva em `private/tabular-membership-discovery/lagoa-do-arroz-discovery-*.json` (não commitado).

| # | Página | Texto de origem (truncado) | Rótulo humano | Justificativa | H3 | H3b |
|---|---|---|---|---|---|---|
| 1 | 46 | "CADEADO" | `must_include` | Palavra isolada, largura estreita — claramente continuação de item de portão/cadeado da linha anterior | must_include ✓ | must_include ✓ |
| 2 | 46 | "(12 hs/dia)" | `must_include` | Fragmento de especificação de locação de gerador, mesma linha lógica do item anterior | must_include ✓ | must_include ✓ |
| 3 | 46 | "_____________________________________" | `must_exclude` | Linha de assinatura (traço horizontal) antes de "Orçamento elaborado por" — nunca parte da tabela | must_exclude ✓ | must_exclude ✓ |
| 4 | 46 | "NERV TRAPEZ FORROC/ ISOL TERMO ACUST CHASSIS REFORC PISO COMPENS NAVAL INCL INST ELETR/HIDRO-" | `must_include` | Continuação de descrição técnica extensa (telhado/estrutura), mesma coluna DESCRIÇÃO | **must_exclude ✗** | **must_exclude ✗** |
| 5 | 46 | "C/ REVESTIMENTO EM MATERIAL APIÇARRADO ATÉ DMT DE 4000m" | `must_include` | Continuação de descrição de serviço de terraplenagem/revestimento | **must_exclude ✗** | **must_exclude ✗** |
| 6 | 51 | "FORNECIMENTO E INSTALAÇÃO. AF_03/2023" | `must_include` | Fecho padrão de descrição de item SINAPI, recorrente em várias linhas do documento | **must_exclude ✗ (H3)** | must_include ✓ (H3b corrige) |
| 7 | 51 | "2 UTILIZAÇÕES. AF_03/2024" | `must_include` | Mesmo padrão de fecho de descrição SINAPI | **must_exclude ✗ (H3)** | must_include ✓ (H3b corrige) |
| 8 | 53 | "ELÉTRICA - FORNECIMENTO E INSTALAÇÃO. AF_12/2021" | `must_include` | Mesmo padrão de fecho de descrição | **must_exclude ✗ (H3)** | must_include ✓ (H3b corrige) |
| 9 | 53 | "DIN 50A (NÃO INCLUSO O POSTE DE CONCRETO). AF_07/2020_PS" | `must_include` | Continuação de descrição de item elétrico (poste/luminária) | **must_exclude ✗** | **must_exclude ✗ (H3b também falha)** |
| 10 | 54 | "BAROMÉTRICA, DIREÇÃO E VELOCIDADE DO VENTO ULTRASSÔNICO, PLUVIOMETRIA E PONTO DE ORVALHO. E" | `must_include` | Continuação de descrição de estação meteorológica | **must_exclude ✗** | **must_exclude ✗ (H3b também falha)** |
| 11 | 54 | "PIROMETRO DE SEGUNDA CLASSE COM 5 METROS DE CABO. COM SAÍDA RS485 E PROTOCOLO MODBUS." | `must_include` | Continuação da mesma descrição de instrumentação | **must_exclude ✗** | **must_exclude ✗ (H3b também falha)** |
| 12 | 48 | "DE 1,10 X 1,10 M COM DOBRADIÇAS QUE PERMITAM SUA ABERTURA PARA ACESSO E RETIRADA DO STOP LOG." | `must_include` | Continuação de descrição de comporta/stop-log | must_exclude (H3 não avaliou este — âncora local diferente) | **must_exclude ✗ (H3b introduz esta falha nova)** |
| 13 | 46 | "COL. FGV DESCRIÇÃO ITEM FONTE DE PESQUISA TIPO UNID QUANT. CUSTO PREÇO FINAL" | `must_exclude` | Cabeçalho de página, repetido a cada página, fora da grade de dados | `insufficient_evidence` (nenhuma âncora adjacente confirmada — resultado conservador correto) | idem |
| 14 | 54 | "TOTAL GERAL (R$) 9.809.087,18" | `uncertain` | Linha de total geral do orçamento — pertence à MESMA área física da tabela, mas semanticamente é um total, não uma linha de item; nenhuma capacidade desta Sprint distingue "total" fisicamente de "item" | `insufficient_evidence` | idem |

**Resumo do manifesto**: dos 11 casos com rótulo humano definitivo (`must_include`/`must_exclude`, excluindo os 2 `uncertain`/estruturais), H3 acerta 3 e erra 6 (falso negativo); H3b acerta 6 e erra 5 (falso negativo) — nenhuma das duas variantes zera os falsos negativos reais. Nenhum falso POSITIVO real foi observado em nenhuma das duas (H3/H3b nunca incluíram incorretamente um elemento genuinamente externo na amostra inspecionada).

## 11. Divergências

Entre o resultado esperado (H3 generalizaria como no sintético) e o observado (falsos negativos reais em continuações largas): a piscina de âncoras local usada por H3 herda a própria fragmentação da regra de produção atual — quando a janela confirmada mais próxima é pequena ou atipicamente curta, a largura mediana de referência subestima a largura real da coluna. H3b (referência de largura = todos os membros do alinhamento na página) reduz mas não elimina esse efeito.

## 12. Limitações

- A amostra rotulada (14 linhas) é pequena diante das 9 páginas/~670 linhas físicas totais — suficiente para refutar a generalização plena, insuficiente para caracterizar exaustivamente a taxa de falso negativo real.
- Nenhum limiar foi recalibrado a partir do documento real (permaneceria uma violação direta do enunciado, §13) — a Sprint para aqui, sem ajustar `H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO` para "fazer o caso passar".
- `f.2a` permanece `exercitada_em_caso_real`/`reprovada`/`confirmed` — nenhuma mudança de maturidade é reivindicada.

## 13. Nível de evidência anterior e resultado anterior

`f2a-tabular-region-detection`: `currentLevel: exercitada_em_caso_real`, `currentResult: reprovada` (inalterado por esta Sprint).

## 14. Nível de evidência solicitado e resultado solicitado

Não aplicável — esta Sprint não solicita mudança de nível/resultado de maturidade de nenhuma capacidade. O registro de maturidade (`capability-maturity-registry.ts`) permanece intocado.

## 15. Portões afetados

Nenhum — esta Sprint não abre nem fecha nenhum portão (`downstreamGates`).

## 16. Arquivos alterados

Ver relatório final (`EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_REPORT.md`, §17) para a lista exata. Nenhum algoritmo de execução de `f.0` a `g.3` foi alterado. Foram adicionados apenas: documentos de descoberta, testes/candidatas exclusivamente diagnósticos em `testing/discovery/`, e um script de diagnóstico local fora de `src/`.

## 17. Decisão humana necessária

Nenhuma decisão de aprovação é solicitada nesta Sprint — apenas registro de descoberta concluída, com veredito **D (inconclusivo)** e recomendação do próximo experimento mínimo (ver relatório).
