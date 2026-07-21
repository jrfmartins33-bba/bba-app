# Epic 21 — Sprint 21.4B.3A — Pacote de Evidências

**CORREÇÃO (commit `docs(architecture): correct tabular discovery evidence claims`)**: esta versão substitui afirmações imprecisas da versão original (commit `50bf42a`) — ver §7/§9/§10 abaixo para o texto corrigido, e `EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md` §13 para a correção formal do pré-registro. O veredito (D — inconclusivo) não muda.

Segue o formato de `TEMPLATE_SPRINT_EVIDENCE_PACKAGE.md`, adaptado ao escopo desta Sprint (descoberta arquitetural — não uma reavaliação de maturidade de `f.2a`, que permanece `exercitada_em_caso_real`/`reprovada`/`confirmed`, inalterada).

## 0. Tipo de alvo

Não aplicável no sentido do registro de maturidade — esta Sprint não reavalia `capability` nem `end_to_end_scenario` algum. O "alvo" desta evidência é a pergunta arquitetural do pré-registro (`EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md`).

## 1. Objetivo verificável

Determinar se alguma das hipóteses candidatas — H1/H2/H3/H4 pré-registradas como famílias conceituais, mais H3b (refinamento explicitamente pós-hoc, criado depois da observação real, nunca pré-registrado) — constitui uma invariante segura, determinística e generalizável de pertencimento à grade tabular, testável contra a matriz sintética completa E contra o documento real.

## 2. Hipótese

Formulada no pré-registro (commit `764a62cbf3ebaa51cda98da62c6c832cabfd97ff`) apenas como DIREÇÃO CONCEITUAL: compatibilidade de largura de segmento contra um envelope de coluna derivado de linhas-âncora (família H3) resolveria os casos sintéticos que sobreposição/componente puro (H1/H2) e blocos físicos (H4) não resolvem. O limiar numérico exato (1.6x) e a implementação exata (piscina de âncoras local) foram decididos no segundo commit (avaliação), não congelados no pré-registro — ver correção em `EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_PLAN.md` §13.

## 3. Resultado esperado (definido antes da execução)

Pré-registrado apenas qualitativamente: H1/H2 deveriam falhar em casos onde um elemento largo coincide com uma única borda de coluna; H3 (família conceitual) deveria, em princípio, resolver esses casos; H4 deveria ser testado sem presunção prévia de sucesso ou falha. **Não havia predição numérica pré-registrada** ("H3 passa 20/20") — esse resultado é exploratório da implementação escolhida durante a avaliação, não a confirmação de uma expectativa congelada antes da execução.

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

20 entradas classificadas na matriz (`discovery-case-matrix.ts`): 10 positivas (P1-P10), 10 negativas (N1-N10, incluindo os 3 adversariais obrigatórios N2/N8/N9) — **19 geometrias físicas distintas**, porque N6 e N10 reaproveitam deliberadamente a mesma fixture e a mesma linha-alvo (papel duplo documentado desde o pré-registro). Testes técnicos: 5 arquivos, 27 verificações executáveis (10 integridade + 4 indistinguibilidade local + 10 avaliação de candidatas + 3 invariância/fronteira). Resultado por candidata, contando ENTRADAS (20), não geometrias:

| Candidata | Status no pré-registro | Positivas (10) | Negativas (10) | Adversariais (N2/N8/N9) | Resultado exploratório |
|---|---|---|---|---|---|
| H1 (âncora + sobreposição) | família pré-registrada | 10/10 | 6/10 (falha N1,N2,N7,N8) | 1/3 (falha N2,N8) | reprovada |
| H2 (componente de incidência) | família pré-registrada | 10/10 | 6/10 (falha N1,N2,N7,N8) | 1/3 (falha N2,N8) | reprovada |
| H3 (envelope local + largura, limiar 1.6x) | família pré-registrada; limiar e implementação exatos decididos na avaliação, **não congelados no pré-registro** | 10/10 | 10/10 | 3/3 | resultado exploratório — passa a matriz sintética integralmente, mas isso não constitui confirmação de uma predição numérica pré-registrada |
| H3b (envelope global + largura) | **NUNCA pré-registrada — criada depois da observação de falso negativo real (§10), explicitamente pós-hoc** | 10/10 | 10/10 | 3/3 | resultado exploratório pós-hoc |
| H4 (blocos físicos de f.1) | família pré-registrada (Categoria B) | 10/10 | 0/10 (falha todos) | 0/3 | reprovada |

Testes de permutação, translação e escala (§13/§14 do enunciado): H3 é invariante às três transformações (Casos P2 e N8, verificado por execução — `discovery-candidate-evaluation.test.ts`). Teste de fronteira exata do limiar de largura (1.6x): abaixo inclui, exatamente no limite inclui, acima exclui — comportamento determinístico confirmado nos três pontos. Essas propriedades (invariância, fronteira) são genuinamente verificadas por execução, independente da correção acima sobre o status pré-registrado de H3/H3b.

## 8. Resultado adversarial

Os 3 casos adversariais obrigatórios (N2 = Caso L7 reconstruído, N8 = Caso J reconstruído, N9 = Caso L3 reaproveitado como negativo) são projetados especificamente para explorar a mesma assinatura de alinhamento de positivos legítimos (P2/F) no nível de evidência do helper atual (ver §9 para o escopo exato dessa afirmação). H3/H3b são as únicas candidatas que rejeitam corretamente os três nos casos sintéticos.

## 9. Indistinguibilidade local da linha-alvo (nível helper) e refutação (nível capacidade)

**CORREÇÃO**: a versão original desta seção afirmava que a igualdade observada provava "que nenhuma função determinística limitada a essa evidência pode distingui-los" — uma afirmação sobre o CONTRATO INTEIRO recebido pelo helper. O que foi executado (`discovery-indistinguishability-proof.test.ts`, dois pares F-vs-J e L1-vs-L7) compara apenas o **fingerprint canônico da linha-alvo especificamente** (sua posição relativa e os extents de alinhamento que ela sustenta, relativos a si mesma) — nunca a representação canônica de todas as linhas da janela simultaneamente, módulo renomeação de `lineKey`/`alignmentKey`.

Resultado corrigido: o fingerprint da linha-alvo é **idêntico** entre positivo e negativo em ambos os pares no nível do helper atual — prova de **indistinguibilidade local da linha-alvo**, nunca do contrato completo. É possível (não testado) que uma função que examine a evidência de OUTRAS linhas da janela distinga os dois casos mesmo com o fingerprint da linha-alvo idêntico. Ao ampliar a evidência DA LINHA-ALVO para o nível da capacidade completa (largura de segmento, já calculada por `detectPage`/`buildAlignmentCandidateSegments`, nunca encaminhada ao helper), essa igualdade local se desfaz: a largura do segmento difere significativamente entre positivo e negativo em ambos os pares — refutando a insuficiência local de evidência nesse nível mais amplo e habilitando H1/H2/H3 como candidatas viáveis.

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

### 10.2 Classificação deste manifesto: exploração pós-execução, NUNCA validação real pré-registrada ou cega

**CORREÇÃO**: o script de diagnóstico (`scripts/discover-tabular-membership-real-document.ts`) primeiro avaliou H1-H4/H3b sobre TODAS as linhas excluídas pela regra atual, e só depois a inspeção humana selecionou e rotulou as 14 amostras abaixo — já sabendo o resultado das candidatas para cada uma. **Este manifesto não foi congelado antes da avaliação e não constitui, nem deve ser citado como, validação real pré-registrada ou cega.** Ele é suficiente para REFUTAR a aprovação de H3/H3b como invariante segura para o documento real (um falso negativo real observado já basta para reprovar, independente de quando foi descoberto), mas não satisfaz o padrão de evidência de `EPIC_21_SPRINT_4G_REAL_VALIDATION_GOVERNANCE.md` para uma comparação formal esperado/observado. **Requisito explícito do próximo experimento**: construir e congelar (commit, hash, push) um manifesto real rotulado ANTES de rodar qualquer candidata contra ele — ver `EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_REPORT.md` §15.

### 10.3 Manifesto versionado e totais deterministicamente calculados

Estrutura completa, com identidade única `(realPageNumber, lineKey)` — nunca apenas o texto, que se repete em várias linhas/páginas com decisões diferentes (confirmado ao reexaminar os dados brutos salvos, não commitados) — em `packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/discovery-real-sample-manifest.ts`, validada e com totais calculados (nunca transcritos à mão) em `discovery-real-sample-manifest.test.ts`. Classificação humana feita por inspeção direta do texto extraído de cada linha (permitido — os algoritmos candidatos nunca usam texto, apenas geometria).

| id | Página | lineKey (prefixo) | Texto de localização (truncado) | Rótulo humano | H3 | H3b | Resultado H3 | Resultado H3b |
|---|---|---|---|---|---|---|---|---|
| R1 | 46 | `7ede9ba9…` | "CADEADO" | must_include | must_include | must_include | acerto | acerto |
| R2 | 46 | `a9ac10de…` | "(12 hs/dia)" | must_include | must_include | must_include | acerto | acerto |
| R3 | 47 | `3d8df8bd…` | "_____________________________________" | must_exclude | must_exclude | must_exclude | acerto | acerto |
| R4 | 46 | `b0585027…` | "NERV TRAPEZ FORROC/ ISOL TERMO ACUST..." | must_include | must_exclude | must_exclude | falso_negativo | falso_negativo |
| R5 | 46 | `09e0d3e7…` | "C/ REVESTIMENTO EM MATERIAL APIÇARRADO..." | must_include | must_exclude | must_exclude | falso_negativo | falso_negativo |
| R6 | 51 | `a0ca8fe4…` | "FORNECIMENTO E INSTALAÇÃO. AF_03/2023" | must_include | must_exclude | must_include | falso_negativo | acerto |
| R7 | 51 | `0b7c467c…` | "2 UTILIZAÇÕES. AF_03/2024" | must_include | must_exclude | must_include | falso_negativo | acerto |
| R8 | 53 | `59d921d0…` | "ELÉTRICA - FORNECIMENTO E INSTALAÇÃO..." | must_include | must_exclude | must_include | falso_negativo | acerto |
| R9 | 53 | `a630084e…` | "DIN 50A (NÃO INCLUSO O POSTE...)" | must_include | must_exclude | must_exclude | falso_negativo | falso_negativo |
| R10 | 54 | `28980d01…` | "BAROMÉTRICA, DIREÇÃO E VELOCIDADE..." | must_include | must_exclude | must_exclude | falso_negativo | falso_negativo |
| R11 | 54 | `f115e6ad…` | "PIROMETRO DE SEGUNDA CLASSE..." | must_include | must_exclude | must_exclude | falso_negativo | falso_negativo |
| R12 | 48 | `0f69e3e6…` | "DE 1,10 X 1,10 M COM DOBRADIÇAS..." | must_include | **must_include** | must_exclude | **acerto** | falso_negativo |
| R13 | 46 | `28851b1e…` | "COL. FGV DESCRIÇÃO ITEM FONTE..." (cabeçalho) | must_exclude | insufficient_evidence | insufficient_evidence | evidencia_insuficiente | evidencia_insuficiente |
| R14 | 54 | `a777e1a0…` | "TOTAL GERAL (R$) 9.809.087,18" | uncertain | insufficient_evidence | insufficient_evidence | incerto | incerto |

**Correção do item R12** (identificada em revisão externa): a versão original do relatório afirmava simultaneamente "H3 não avaliou este" e "must_exclude" para esta amostra — inconsistente. O valor real, extraído do JSON de diagnóstico salvo e agora travado por teste (`discovery-real-sample-manifest.test.ts`), é **H3 = must_include (acerto)** e **H3b = must_exclude (falso negativo introduzido por H3b, não por H3)** — o oposto do que constava.

**Totais exatos (calculados por `computeRealSampleOutcomeTotals`, nunca transcritos à mão)**, sobre as 14 amostras (13 com rótulo humano definitivo `must_include`/`must_exclude`, 1 `uncertain`):

| Candidata | acerto | falso_negativo | falso_positivo | evidencia_insuficiente | incerto | total |
|---|---|---|---|---|---|---|
| H3 | 4 | 8 | 0 | 1 | 1 | 14 |
| H3b | 6 | 6 | 0 | 1 | 1 | 14 |

Nenhum falso POSITIVO real foi observado em nenhuma das duas (H3/H3b nunca incluíram incorretamente um elemento genuinamente externo na amostra inspecionada). H3b corrige 3 falsos negativos de H3 (R6/R7/R8) mas introduz 1 novo (R12) que H3 acertava — melhora líquida parcial (6 vs. 4 acertos), nunca generalização completa.

## 11. Divergências

Entre o resultado esperado (H3 generalizaria como no sintético) e o observado (falsos negativos reais em continuações largas): a piscina de âncoras local usada por H3 herda a própria fragmentação da regra de produção atual — quando a janela confirmada mais próxima é pequena ou atipicamente curta, a largura mediana de referência subestima a largura real da coluna. H3b (referência de largura = todos os membros do alinhamento na página) reduz mas não elimina esse efeito.

## 12. Limitações

- **O manifesto real (§10.2/§10.3) é exploração pós-execução, não validação real pré-registrada ou cega** — as candidatas já haviam sido avaliadas antes da seleção/rotulagem humana das 14 amostras. Isso é suficiente para refutar H3/H3b, insuficiente para qualquer alegação de validação formal.
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
