# Epic 21 - Sprint 21.4A.1 - Capacidade Documental Mínima

**Status:** Sprint 21.4A.1 concluída, com validação real em ambiente Supabase de teste. **A Sprint 21.4A permanece em andamento** — esta entrega não conclui a ingestão documental completa nem inicia materialização de Orçamento. Próximo incremento: 21.4A.2 — localização das páginas orçamentárias do documento oficial.

## O que foi implementado

- Documento (`DocumentArtifact`): identidade lógica do documento ao longo do tempo.
- Versão do Documento (`DocumentVersion`): versão concreta e imutável de um arquivo.
- Tentativa de Processamento Documental (`DocumentProcessingAttempt`): execução operacional sobre uma Versão.
- Contratos de repositório para os três conceitos.
- Serviços de Aplicação pequenos e explícitos.
- Persistência real em três tabelas separadas.
- Isolamento por organização usuária.
- Idempotência atômica de versão por `(organizationId, documentId, sha256)`.
- Idempotência atômica de tentativa por `(organizationId, documentVersionId, requestIdempotencyKey)`.
- Reprocessamento explícito sem sobrescrita.
- Concorrência otimista por `revision` da tentativa.
- Proteção persistente da máquina de estados da tentativa.
- Guardas arquiteturais contra PDF/OCR/IA e contra dependência do domínio econômico.

## Localização física

- Domínio puro mínimo: `packages/bdos-core/src/domain/document-processing`.
- Serviços e contratos: `packages/bdos-core/src/services/document-processing`.
- Adaptador Supabase server-side: `apps/web/lib/bdos/document-processing-server-repository.ts`.
- Mapeadores banco <-> domínio: `apps/web/lib/bdos/document-processing-mappers.ts`.
- Persistência: `supabase/migrations/20260715000000_bdos_document_processing_capability.sql`.

Alternativas rejeitadas:

- `domain/budget-version`: rejeitado porque Documento e Versão do Documento são evidência documental, não identidade econômica.
- `domain/document-reconstruction`: rejeitado porque Reconstrução Documental estrutura reconstrução lógica, mas não deve virar dona universal de upload, armazenamento ou processamento físico.
- Um repositório genérico universal de documentos: rejeitado por generalização prematura.
- Colocar processamento físico dentro de domínio puro: rejeitado; o domínio só valida invariantes e transições.

## Fronteira

Esta fatia não interpreta conteúdo economicamente e não decide Grupo, Subgrupo, Item de Serviço, quantidade, preço, BDI, composição, total, correspondência, materialização ou consolidação.

Também não implementa:

- leitura de PDF;
- OCR;
- localização de páginas;
- Evidência Estruturada Neutra;
- caracterização econômica;
- Linha Candidata;
- Proposta de Importação do Orçamento;
- API pública;
- interface;
- Versão do Orçamento;
- Simulação;
- comparação lado a lado.

## Idempotência e reprocessamento

Versão do Documento:

- Mesma organização, mesmo Documento e mesmo SHA-256 retornam a versão existente.
- Mesmo Documento com SHA-256 diferente cria nova versão.
- Documentos lógicos diferentes podem conter bytes idênticos sem virarem o mesmo Documento.
- A criação ou reutilização é resolvida de forma atômica na persistência; duas solicitações concorrentes não produzem falha por colisão idempotente e retornam a identidade efetivamente persistida.

Tentativa:

- Mesma organização, mesma Versão e mesma chave de solicitação retornam a tentativa existente.
- Nova chave de solicitação para a mesma Versão cria nova tentativa.
- Reprocessamento nunca cria nova Versão do Documento e nunca sobrescreve tentativa anterior.
- A criação ou reutilização é resolvida de forma atômica na persistência; duas solicitações concorrentes retornam a mesma tentativa e a mesma revisão inicial.

## Máquina de estados

A função persistente de transição valida as mesmas regras do domínio antes de gravar:

- solicitada -> processando;
- solicitada -> abandonada;
- processando -> concluída;
- processando -> concluída parcialmente;
- processando -> falhou;
- processando -> abandonada.

Transições a partir de estados terminais, transições incompatíveis com o estado atual e estados desconhecidos são rejeitados no banco. Conflito de revisão continua sendo devolvido como conflito de concorrência, sem sobrescrever a tentativa mais recente.

## Persistência e segurança

As tabelas são:

- `document_artifacts`;
- `document_versions`;
- `document_processing_attempts`.

`document_versions` é imutável por trigger. A referência de armazenamento precisa começar por `company_id/` e não pode ser caminho local. Escritas diretas por `authenticated` são bloqueadas por RLS e por ausência de privilégio de escrita. Mutações passam por funções com `EXECUTE` concedido somente a `service_role`, recebendo `p_actor_id` já resolvido pela fronteira confiável do servidor.

## Achado de infraestrutura — validação em projeto Supabase novo

A validação real desta Sprint contra um projeto Supabase genuinamente novo (nunca contra o projeto real) revelou que nenhuma migração até `20260715000000` concede `SELECT` em `public.profiles` para `service_role`. A migração `20260714000005` tornou `get_company_id_for_actor`/`is_bba_admin_actor` `SECURITY INVOKER`, presumindo que `service_role` já possuía esse privilégio — o que é verdade no projeto real, mas nunca foi representado em nenhuma migração rastreada. Um projeto novo, recebendo só as migrações versionadas, não herda esse privilégio, e qualquer função server-only que dependa desses dois auxiliares falha com `permission denied for table profiles` (42501).

**Causa raiz:** lacuna pré-existente de infraestrutura, anterior a esta Sprint — descoberta, não introduzida, pela exigência desta Sprint de validar persistência real em ambiente limpo.

**Correção:** `supabase/migrations/20260715010000_bdos_service_role_profiles_access.sql`, formalizando `GRANT SELECT ON TABLE public.profiles TO service_role;`. Não amplia acesso no projeto real (o privilégio já existia lá); torna o bootstrap a partir do repositório reproduzível em qualquer projeto novo. Nenhum privilégio novo foi concedido a `anon` ou `authenticated`.

Depois de corrigir `profiles`, a mesma validação avançou e revelou uma segunda lacuna idêntica em `public.companies` (`permission denied for table companies`, 42501 — inicialmente mascarada por uma mensagem de erro vazia, artefato de uma consulta `head: true` sem corpo de resposta). Corrigida por `supabase/migrations/20260715020000_bdos_service_role_companies_access.sql`, mesma justificativa e mesmas garantias (não amplia acesso real, não concede nada a `anon`/`authenticated`).

### Validação real concluída

Executada contra um projeto Supabase exclusivamente de teste, nunca contra o projeto real. Resultado:

- **49/49 migrações** locais e remotas confirmadas (`supabase migration list`), incluindo `20260715000000` (capacidade documental), `20260715010000` (acesso de `service_role` a `profiles`) e `20260715020000` (acesso de `service_role` a `companies`).
- **Nove cenários reais aprovados**, todos em `supabase/tests/document-processing/document-processing-capability.test.mjs`:
  1. Caminho confiável cria Documento, primeira Versão e Tentativa de Processamento.
  2. Idempotência de Versão do Documento (mesmo hash reutiliza, hash novo cria).
  3. Idempotência concorrente de Versão do Documento.
  4. Idempotência concorrente de Tentativa de Processamento.
  5. Concorrência otimista da Tentativa, com resultado terminal preservado.
  6. Máquina de estados persistente: transições válidas aceitas, inválidas rejeitadas no banco.
  7. Versão do Documento imutável na persistência.
  8. Escrita direta e chamada de função server-only bloqueadas para `authenticated`.
  9. Caminho confiável rejeita ator operando organização alheia.
- **Idempotência concorrente** confirmada (cenários 3 e 4).
- **Máquina de estados persistente** confirmada (cenário 6).
- **Imutabilidade** da Versão do Documento confirmada (cenário 7).
- **Isolamento entre organizações** confirmado (cenário 9).
- **Escrita direta de `authenticated`** bloqueada (cenário 8).
- **Limpeza** confirmada: todos os registros criados pelo teste foram removidos (`documents=1 documentVersions=3`), verificado pelo próprio script.
- **Produção não foi utilizada** em nenhum momento desta validação.

## Próximo incremento

O próximo incremento esperado é a localização das páginas orçamentárias do documento oficial, ainda sem materializar Versão do Orçamento automaticamente.
