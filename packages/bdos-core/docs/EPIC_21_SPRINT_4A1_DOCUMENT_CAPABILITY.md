# Epic 21 - Sprint 21.4A.1 - Capacidade Documental Minima

**Status:** implementada como fatia 21.4A.1.
**A Sprint 21.4A continua em andamento.** Esta entrega nao conclui a ingestao documental completa nem inicia materializacao de Orcamento.

## O que foi implementado

- Documento (`DocumentArtifact`): identidade logica do documento ao longo do tempo.
- Versao do Documento (`DocumentVersion`): versao concreta e imutavel de um arquivo.
- Tentativa de Processamento Documental (`DocumentProcessingAttempt`): execucao operacional sobre uma Versao.
- Contratos de repositorio para os tres conceitos.
- Servicos de Aplicacao pequenos e explicitos.
- Persistencia real em tres tabelas separadas.
- Isolamento por organizacao usuaria.
- Idempotencia de versao por `(organizationId, documentId, sha256)`.
- Idempotencia de tentativa por `(organizationId, documentVersionId, requestIdempotencyKey)`.
- Reprocessamento explicito sem sobrescrita.
- Concorrencia otimista por `revision` da tentativa.
- Guardas arquiteturais contra PDF/OCR/IA e contra dependencia do dominio economico.

## Localizacao fisica

- Dominio puro minimo: `packages/bdos-core/src/domain/document-processing`.
- Servicos e contratos: `packages/bdos-core/src/services/document-processing`.
- Adaptador Supabase server-side: `apps/web/lib/bdos/document-processing-server-repository.ts`.
- Mapeadores banco <-> dominio: `apps/web/lib/bdos/document-processing-mappers.ts`.
- Persistencia: `supabase/migrations/20260715000000_bdos_document_processing_capability.sql`.

Alternativas rejeitadas:

- `domain/budget-version`: rejeitado porque Documento e Versao do Documento sao evidencia documental, nao identidade economica.
- `domain/document-reconstruction`: rejeitado porque Reconstrucao Documental estrutura reconstrucao logica, mas nao deve virar dona universal de upload, armazenamento ou processamento fisico.
- Um repositorio generico universal de documentos: rejeitado por generalizacao prematura.
- Colocar processamento fisico dentro de dominio puro: rejeitado; dominio so valida invariantes e transicoes.

## Fronteira

Esta fatia nao interpreta conteudo economicamente e nao decide Grupo, Subgrupo, Item de Servico, quantidade, preco, BDI, composicao, total, correspondencia, materializacao ou consolidacao.

Tambem nao implementa:

- leitura de PDF;
- OCR;
- localizacao de paginas;
- Evidencia Estruturada Neutra;
- caracterizacao economica;
- Linha Candidata;
- Proposta de Importacao do Orcamento;
- API publica;
- interface;
- Versao do Orcamento;
- Simulacao;
- comparacao lado a lado.

## Idempotencia e reprocessamento

Versao do Documento:

- Mesma organizacao, mesmo Documento e mesmo SHA-256 retornam a versao existente.
- Mesmo Documento com SHA-256 diferente cria nova versao.
- Documentos logicos diferentes podem conter bytes identicos sem virarem o mesmo Documento.

Tentativa:

- Mesma organizacao, mesma Versao e mesma chave de solicitacao retornam a tentativa existente.
- Nova chave de solicitacao para a mesma Versao cria nova tentativa.
- Reprocessamento nunca cria nova Versao do Documento e nunca sobrescreve tentativa anterior.

## Persistencia e seguranca

As tabelas sao:

- `document_artifacts`;
- `document_versions`;
- `document_processing_attempts`.

`document_versions` e imutavel por trigger. A referencia de armazenamento precisa comecar por `company_id/` e nao pode ser caminho local. Escritas diretas por `authenticated` sao bloqueadas por RLS e por ausencia de privilegio de escrita. Mutacoes passam por funcoes com `EXECUTE` concedido somente a `service_role`, recebendo `p_actor_id` ja resolvido pela fronteira confiavel do servidor.

## Proximo incremento

O proximo incremento esperado e a localizacao das paginas orcamentarias do documento oficial, ainda sem materializar Versao do Orcamento automaticamente.
