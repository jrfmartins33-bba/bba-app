# Resilient Planning Import — Checklist de E2E manual (Epic 18)

> Mesmo espírito de `EXECUTION_ENGINE_E2E_CHECKLIST.md`: cobre o que
> `pnpm test` não pode — sessão autenticada real, Supabase Storage
> real, upload direto do browser. `planning-import-source-type.test.ts`
> já cobre, via `npx tsx`, a parte pura (detecção de tipo por
> extensão/MIME/bytes) — este checklist cobre o resto do requisito F
> do desenho (`RESILIENT_PLANNING_IMPORT.md`).

## Pré-requisitos

- [ ] Uma empresa com sessão autenticada válida.
- [ ] Um arquivo `.xlsx` real pequeno (< 1 MB) para o caminho feliz.
- [ ] Um arquivo `.xlsx` real de ~5,2 MB (o mesmo caso de produção que
      abriu este Epic) — para confirmar que o caminho novo o aceita
      onde a rota antiga retornava 413.
- [ ] Acesso a uma segunda empresa (ou um usuário de outra empresa)
      para o teste de isolamento.
- [ ] Acesso ao SQL editor do Supabase para inspecionar
      `planning_imports.status` diretamente.

## 1. Caminho feliz completo

1. [ ] Importar o arquivo pequeno via `/bba-project`.
2. [ ] Confirmar na UI a sequência visual: "Enviando arquivo..." →
       "Processando planejamento..." (com os 4 sub-passos cosmético) →
       tela pronta com Hero/Executive Cards/Advisor.
3. [ ] No Supabase, confirmar `planning_imports.status = 'completed'`
       para a linha criada, e que `updated_at > uploaded_at`.
4. [ ] Confirmar que `planning_datasets`/`decision_snapshots`/
       `recommendations` foram criados normalmente (mesmo resultado
       que a rota antiga produzia).

## 2. Arquivo acima de 4,5 MB (o caso real que abriu o Epic)

1. [ ] Importar o arquivo de ~5,2 MB.
2. [ ] Confirmar que **não** aparece a mensagem "Falha de comunicação
       ao importar o arquivo." — o upload deve ir direto ao Storage,
       nunca pela Vercel Function, então o teto de 4,5 MB nunca deveria
       ser alcançado.
3. [ ] Confirmar o caminho feliz completo (mesmos passos do item 1).

## 3. Extensão inválida

1. [ ] Tentar importar um arquivo `.pdf` ou `.docx`.
2. [ ] Confirmar `400 unsupported_file_type` de `prepare-upload` —
       nunca chega a reservar um `planning_imports` nem a tentar upload.

## 4. MIME inválido, extensão ambígua

1. [ ] Forjar uma requisição a `prepare-upload` com `fileName` sem
       extensão reconhecida e `contentType` genérico
       (`application/octet-stream`).
2. [ ] Confirmar `400 unsupported_file_type` — o modo leve de
       `detectPlanningImportSourceType` não tem bytes para tentar o
       sniffing, então corretamente recusa em vez de adivinhar.

## 5. `source_type` declarado não bate com o conteúdo real

1. [ ] Chamar `prepare-upload` com `fileName: "relatorio.xlsx"` (declara
       `excel`).
2. [ ] Fazer upload de um arquivo que na verdade é um XML válido
       (conteúdo começando com `<`) para o `storagePath` devolvido.
3. [ ] Chamar `upload-complete`, depois `process`.
4. [ ] Confirmar `422 source_type_mismatch` e
       `planning_imports.status = 'failed'` — nunca processa o arquivo
       como se o nome estivesse certo.

## 6. Import de outra empresa

1. [ ] Com uma sessão da Empresa A, rodar `prepare-upload` e anotar o
       `planningImportId` retornado.
2. [ ] Autenticar como usuário da Empresa B e chamar `upload-complete`
       e `process` com esse mesmo `planningImportId`.
3. [ ] Confirmar `404 planning_import_not_found` nos dois — nunca um
       "403 forbidden" que confirmaria a existência do recurso de
       outra empresa (RLS + filtro explícito por `company_id` já
       garantem isso, mas vale confirmar em produção).

## 7. `planningImportId` inexistente

1. [ ] Chamar `upload-complete` e `process` com um UUID aleatório, não
       associado a nenhum `planning_imports`.
2. [ ] Confirmar `404 planning_import_not_found` nos dois.

## 8. Upload ausente (`process` chamado antes do upload de verdade)

1. [ ] Chamar `prepare-upload` normalmente.
2. [ ] Pular a Etapa B (nunca fazer upload de fato).
3. [ ] Chamar `process` direto com o `planningImportId`.
4. [ ] Confirmar `409 upload_not_confirmed` (o `status` continua
       `pending_upload`, `process` recusa antes de tentar baixar).
5. [ ] Separadamente, chamar `upload-complete` sem upload real feito —
       confirmar `409 upload_not_found` (a checagem via `storage.list()`
       não encontra o objeto).

## 9. Falha do parser

1. [ ] Fazer upload de um `.xlsx` real, porém corrompido/vazio (0
       atividades reconhecíveis).
2. [ ] Confirmar que `process` retorna erro (mesma checagem de
       `planningDataset.activities.length === 0` que a rota antiga já
       fazia) e que a UI mostra a mensagem específica de "não foi
       possível reconhecer nenhum item de planejamento".
3. [ ] Confirmar `planning_imports.status` — **atenção**: neste caso
       específico, o pipeline não lança exceção (o snapshot é
       retornado com 0 atividades, não é um `throw`), então o status
       pode ficar `completed` mesmo com resultado vazio — validar se
       esse comportamento é aceitável ou se merece um ajuste futuro
       (não corrigido neste Epic, registrado aqui como achado).

## Resultado esperado

| # | Cenário | Validado em | Por quem |
|---|---|---|---|
| 1 | Caminho feliz completo | | |
| 2 | Arquivo > 4,5 MB | | |
| 3 | Extensão inválida | | |
| 4 | MIME inválido/ambíguo | | |
| 5 | source_type mismatch | | |
| 6 | Import de outra empresa | | |
| 7 | planningImportId inexistente | | |
| 8 | Upload ausente | | |
| 9 | Falha do parser | | |
