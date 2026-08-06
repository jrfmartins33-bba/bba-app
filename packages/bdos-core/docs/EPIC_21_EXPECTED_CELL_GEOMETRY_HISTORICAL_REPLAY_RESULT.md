# Epic 21 — Geometria Esperada das Células: Resultado do Replay Histórico Direto

Registro objetivo da verificação probatória final da PR #82: uma tentativa de resolução direta, por igualdade exata de `lineKey`/`segmentKey`, executada no próprio commit em que a verdade de referência foi congelada, com lockfile congelado, contra o documento exato.

## 1. Objetivo

Determinar se as `lineKey`/`segmentKey` já declaradas em `physicalOriginPt` (e em `ReferenceTruthPhysicalRegion.segmentKeys`) das 1.019 células podem ser reproduzidas diretamente — por igualdade exata de chave, nunca por posição, texto ou proximidade — executando a mesma cadeia física já aprovada exatamente no commit em que essas chaves foram congeladas.

## 2. Commit histórico

```
ccd8f8f1627e4f628f8787c36a2b27517a42e29b
"test(architecture): preregister structured budget reconstruction reference"
```

Confirmado como o commit exato de congelamento: `git show --stat` lista a criação de `discovery-reference-truth-columns.ts`, `discovery-reference-truth-document.ts`, `discovery-reference-truth-page-{46,50,54}.ts`, `discovery-reference-truth.ts`, `discovery-reference-truth.types.ts` e `discovery-reference-truth.test.ts` — nenhum arquivo pré-existente modificado. `cell-1.physicalOriginPt` neste commit é byte-idêntico ao valor hoje publicado (`Segmento(s): 12800b356a27d77b0a714f9a1c4b8c04a3f95cc7f3c6ec13fe281e00feb21347`) — a verdade de referência nunca foi alterada desde então.

Verificado também: `domain/budget-document-location/{signal-observation,page-location,structure-reconstruction}` (a cadeia física completa) são **byte-idênticos** entre este commit histórico e o `HEAD` atual da PR — `git diff` entre os dois não produz nenhuma linha de diferença nesses diretórios. `pnpm-lock.yaml` e `packages/bdos-core/package.json` também são byte-idênticos entre os dois pontos.

## 3. Ambiente

| Item | Valor |
|---|---|
| Worktree isolado | `git worktree add --detach <path> ccd8f8f1627e4f628f8787c36a2b27517a42e29b` |
| Node | `v24.14.1` |
| pnpm | `9.15.0` |
| Instalação | `pnpm install --frozen-lockfile` (sucesso, sem atualização de dependências) |
| `pdfjs-dist` resolvido | `6.1.200` (confirmado em `node_modules/pdfjs-dist/package.json` do worktree) |
| Identidade do adaptador | `pdfjs-physical-document-reader-adapter-v2` |

## 4. Documento e hash

| Item | Valor |
|---|---|
| Documento | `05_Anexo_Tecnico_Termo_Referencia.pdf` |
| SHA-256 exigido | `5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5` |
| SHA-256 verificado no replay | `5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5` (idêntico) |

`_local-documents/` é local-only (`.git/info/exclude`), inexistente dentro de um worktree recém-criado — o replay leu o arquivo físico do repositório principal, apenas por caminho absoluto, nunca copiado nem alterado.

## 5. Comandos executados (resumo)

```
git fetch origin --prune
git worktree add --detach <path> ccd8f8f1627e4f628f8787c36a2b27517a42e29b
cd <path> && pnpm install --frozen-lockfile
cd <path>/packages/bdos-core && npx tsx _historical_replay.ts   # script temporário, nunca commitado no worktree
```

`_historical_replay.ts` executou exatamente: `pdfjsPhysicalDocumentReader.read` → `observeDocumentSignals` → `locateBudgetDocumentPages` → `reconstructBudgetDocumentStructure`, ambos os módulos importados por caminho relativo direto do próprio worktree (nunca do repositório principal). Nenhum Docling, PaddleOCR, OCR, LLM, serviço externo ou motor determinístico foi executado.

## 6. Duas execuções

Duas cópias independentes dos bytes do documento (`new Uint8Array(rawBytes).slice()` × 2), cada uma processada pela cadeia completa de forma independente.

```
resultado 1 (sha256 do resultado serializado): 73dc3acc2f4c8b9d9ad75127938e25e8553c2ad1ae823eea42dbbe0dc4ba84ac
resultado 2 (sha256 do resultado serializado): 73dc3acc2f4c8b9d9ad75127938e25e8553c2ad1ae823eea42dbbe0dc4ba84ac
```

Idênticos. Este mesmo hash já havia sido obtido, de forma independente, ao rodar a cadeia a partir do `HEAD` atual da PR — confirmando que a cadeia física é totalmente determinística e code-invariante entre os dois pontos no tempo.

## 7. Contagens

| Métrica | Valor |
|---|---|
| Regiões físicas congeladas em escopo (páginas 46/50/54) | 186 |
| Linhas físicas frescas produzidas pelo replay (46: 73, 50: 80, 54: 33) | 186 |
| Tentativas de resolução direta de `lineKey` | 186 |
| **Sucessos de resolução direta de `lineKey`** | **0** |
| **Ausências (chave não encontrada)** | **186** |
| Ambiguidades (duas linhas para a mesma `lineKey`) | 0 — todas as 186 ausências são por falta de correspondência, nunca por ambiguidade |
| Tentativas de resolução direta de `segmentKey` | **0** — nunca tentada: depende de uma linha já resolvida, e nenhuma resolveu (`directSegmentKeyResolutionApplicability = "not_applicable_due_to_zero_resolved_lines"`) |
| Ocorrências de segmento bloqueadas por essa dependência | 936 |
| Tentativas de comparação individual de bounding box | **0** — nunca tentada: não existe caixa histórica individual congelada por segmento contra a qual comparar (`individualBoundingBoxComparisonApplicability = "not_applicable_due_to_zero_resolved_segments"`) |
| `individualBoundingBoxMismatchCount` | `null` (não `0` — "zero tentativas" não é o mesmo fato que "zero divergências entre tentativas realizadas") |

## 8. Verificação de que a geometria permanece intacta (controle, não parte da prova de chave)

Pareando as mesmas 186 regiões congeladas às 186 linhas físicas frescas exclusivamente por `verticalOrder` (campo de ordenação, nunca de identidade — usado aqui apenas como controle de sanidade, não como método de resolução da chave):

- **186 / 186** caixas delimitadoras de região idênticas (zero tolerância).
- `reconstructionContextFingerprint` do replay: `c64aa8ef3ea9a6037de7a209452dadd1dc7ece6636bab5b9c06b205eea795aca` — idêntico ao obtido a partir do `HEAD` atual.
- `physicalGeometryContextFingerprint` do replay: `4381c43586c66052d814c58021f769aec7bb63ff3568f27de8bb14478277494f` — idêntico ao obtido a partir do `HEAD` atual.

Isto prova que o documento, o código e a geometria produzida são idênticos entre os dois pontos no tempo — apenas os valores de `lineKey`/`segmentKey` (hashes de linhagem, não de conteúdo) divergem.

## 9. Hashes dos registros da comparação individual

Como a resolução direta produziu 0 linhas resolvidas, nenhuma ocorrência de segmento pôde ser individualmente comparada por chave (a comparação depende de primeiro resolver a linha). Registrado formalmente no manifesto publicado (`discovery-reference-truth-cell-geometry-manifest.ts`, campo `historicalReplayVerification`):

| Campo | Valor |
|---|---|
| `historicalDirectRegistrySha256` (registro A — replay direto, vazio) | `sha256(JSON.stringify([]))` |
| `currentStructuralBridgeRegistrySha256` (registro B — ponte estrutural atual, 936 entradas) | ver manifesto |
| `publishedRegistrySha256` (registro publicado, 850 entradas efetivamente referenciadas pelas células) | ver manifesto |

## 10. Resultado

```
tentativas de resolução direta de lineKey = 186
sucessos = 0
ausências = 186
ambiguidades = 0

tentativas de resolução direta de segmentKey = 0 (not_applicable_due_to_zero_resolved_lines; 936 ocorrências bloqueadas)
tentativas de comparação individual de bounding box = 0 (not_applicable_due_to_zero_resolved_segments; individualBoundingBoxMismatchCount = null)
```

**A resolução direta por chave histórica não é possível — nem no `HEAD` atual, nem no próprio commit de congelamento, com lockfile congelado.**

## 11. Limitações

Não existe evidência versionada ou execução reproduzível capaz de demonstrar como essas chaves foram produzidas. Isto **não é** uma afirmação de que as chaves nunca foram produzidas por qualquer processo possível (pode ter existido uma execução não registrada, uma ferramenta auxiliar não versionada, ou um processo manual) — é apenas o registro objetivo de que, com todas as evidências disponíveis no repositório e reproduzíveis a partir dele, a origem dessas chaves não pôde ser reconstituída.

Este replay não foi reexecutado nesta correção (verificação probatória final da PR #82, parte 2) — o resultado acima, já obtido e aceito, foi apenas registrado no manifesto e nesta documentação.

## 12. Conclusão

As `lineKey`/`segmentKey` já declaradas na verdade de referência congelada permanecem no contrato exclusivamente como **identificadores históricos internos congelados** (`legacyDeclaredSegmentKey`, status `legacy_unreproducible`) — nunca mais como identidade física reproduzível. A identidade canônica de cada segmento, a partir do schemaVersion 2, é o `ReproduciblePhysicalSegmentLocator`: construído deterministicamente a partir de posição estrutural já congelada (página, região física, ordem vertical da região, ordem horizontal do segmento) e da identidade verificada do reconstrutor físico (fingerprints, hashes de adaptador/biblioteca) — nunca da chave histórica.

A correção de proveniência não alterou nenhuma geometria: o hash canônico exclusivamente espacial (`canonicalSpatialGeometrySha256`) permanece idêntico entre os dados publicados antes e depois desta correção — ver `EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md`.
