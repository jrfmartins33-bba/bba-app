/**
 * Contrato puro da leitura física de um documento PDF (Sprint 21.4A.2.c).
 *
 * Responde apenas: "o que foi fisicamente observado em cada página do
 * documento?" — nunca "quais páginas contêm o orçamento?". Este arquivo
 * não importa nenhuma biblioteca concreta de extração de PDF; a
 * fronteira pública é `Uint8Array` de entrada e este contrato de saída.
 * Ver `packages/bdos-core/docs/EPIC_21_SPRINT_4A2C_DOCUMENT_READER_AND_PDF_ADAPTER.md`.
 */

export const PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION = 1 as const;

export const PHYSICAL_DOCUMENT_READER_NAME = "physical-document-reader" as const;

export const PHYSICAL_DOCUMENT_READER_VERSION = "physical-document-reader-v1" as const;

/**
 * Porta de leitura física de documento. Um adaptador concreto (o baseado
 * em biblioteca de extração de PDF já implementado sob `infrastructure/`,
 * ou qualquer outro no futuro) recebe os bytes imutáveis do arquivo e
 * devolve apenas observações físicas — nunca uma decisão sobre
 * localização de orçamento.
 */
export interface PhysicalDocumentReader {
  read(bytes: Uint8Array): Promise<PhysicalDocumentReadResult>;
}

/**
 * Estado técnico global da leitura. Representa exclusivamente o resultado
 * técnico da leitura física — nunca qualidade documental, confiança,
 * candidatura de páginas ou composição econômica.
 *
 * - `completed`: todas as páginas físicas foram processadas sem problema
 *   técnico registrado.
 * - `completed_with_page_failures`: o documento foi aberto e todas as
 *   páginas físicas foram percorridas, mas uma ou mais páginas têm ao
 *   menos um problema técnico registrado.
 * - `failed`: falha documental impediu a obtenção segura da estrutura de
 *   páginas; nenhuma página foi processada.
 */
export type PhysicalDocumentReadStatus = "completed" | "completed_with_page_failures" | "failed";

/**
 * Orientação física da página, derivada objetivamente da geometria
 * efetivamente apresentada (após rotação, quando aplicável pela biblioteca
 * concreta) — nunca de conteúdo, cabeçalho ou tabela.
 *
 * `indeterminate` cobre dois casos objetivos, nunca um limiar arbitrário:
 * (a) largura ou altura ausente/inválida (não finita ou <= 0); (b) largura
 * e altura exatamente iguais (página quadrada — não há proporção que
 * distinga retrato de paisagem).
 */
export type PhysicalDocumentPageOrientation = "portrait" | "landscape" | "indeterminate";

/**
 * Disponibilidade técnica da extração textual da página. Semanticamente
 * distinta de qualidade e de composição documental — nunca usada para
 * decidir relevância, candidatura ou presença de tabela orçamentária.
 *
 * - `text_available`: a página foi processada e produziu um ou mais itens
 *   textuais.
 * - `no_extractable_text`: a página foi processada com sucesso e produziu
 *   zero itens textuais. Não é falha.
 * - `extraction_failed`: a tentativa de extração da página lançou um erro
 *   técnico. Não deve ser confundida com ausência de texto.
 */
export type PhysicalDocumentTextExtractionAvailability = "text_available" | "no_extractable_text" | "extraction_failed";

/** Nível a que um problema técnico se refere: o documento inteiro, ou uma página física específica. */
export type PhysicalDocumentTechnicalProblemLevel = "document" | "page";

/**
 * Código técnico estável do BDOS para um problema observado durante a
 * leitura física. Nunca deriva de mensagens, nomes de exceção ou stack
 * traces da biblioteca concreta — apenas do fato técnico observado, para
 * permanecer estável entre versões/ambientes/empacotamento da biblioteca
 * e para permitir tradução futura para mensagem apresentável ao usuário
 * (ex.: "Página 12: o texto não pôde ser extraído."), sem acoplar o
 * domínio a essa redação final.
 */
export type PhysicalDocumentTechnicalProblemCode =
  | "document_bytes_empty"
  | "document_invalid_structure"
  | "document_protected"
  | "document_open_failed"
  | "page_load_failed"
  | "page_geometry_unavailable"
  | "page_text_extraction_failed"
  | "page_processing_failed";

/**
 * Representação técnica normalizada de um problema — nunca a mensagem
 * bruta da biblioteca concreta, nunca stack trace, nunca caminho absoluto
 * ou dado de ambiente.
 */
export interface PhysicalDocumentTechnicalProblem {
  readonly code: PhysicalDocumentTechnicalProblemCode;
  readonly level: PhysicalDocumentTechnicalProblemLevel;
  /** Número físico da página (1-based), ou `null` para um problema de nível `document`. */
  readonly pageNumber: number | null;
  /** Mensagem técnica controlada, em português, escrita pelo BDOS — nunca repassada da biblioteca. */
  readonly message: string;
}

/**
 * Um item textual extraído, na ordem estável fornecida pelo processo de
 * extração adotado. `index` começa em 0, é determinístico e permanece
 * estável entre duas leituras dos mesmos bytes com a mesma versão do
 * leitor/adaptador/biblioteca concreta.
 *
 * Esta ordem é técnica, não é ordem humana de leitura: não garante fluxo
 * esquerda-direita ou cima-baixo, e não representa linhas, colunas ou
 * células de uma tabela. Nenhuma reordenação por coordenada, proximidade,
 * alinhamento, posição ou tamanho de fonte é aplicada nesta Sprint.
 */
export interface PhysicalDocumentTextItem {
  readonly index: number;
  readonly text: string;
}

/**
 * Métricas técnicas objetivas e reproduzíveis de uma página, calculadas a
 * partir do texto originalmente extraído (antes da normalização). Ver
 * `physical-document-page-metrics.ts` para a regra exata e testada de
 * cada contagem.
 */
export interface PhysicalDocumentPageMetrics {
  readonly textItemCount: number;
  readonly nonEmptyCharacterCount: number;
  readonly replacementCharacterCount: number;
  readonly unexpectedControlCharacterCount: number;
}

/**
 * Observação física de uma página, sem qualquer decisão documental,
 * econômica ou de localização. Não contém — e não deve nunca conter —
 * campos como candidata, contextual, ambígua, descartada, orçamento
 * encontrado, continuidade, fechamento, confiança ou score.
 */
export interface PhysicalDocumentPage {
  /** Número físico da página, começando em 1, independente de qualquer numeração impressa no documento. */
  readonly pageNumber: number;
  /** Largura efetiva em pontos, já refletindo a rotação aplicada pela biblioteca concreta, ou `null` se indisponível. */
  readonly widthPoints: number | null;
  /** Altura efetiva em pontos, já refletindo a rotação aplicada pela biblioteca concreta, ou `null` se indisponível. */
  readonly heightPoints: number | null;
  /** Rotação efetiva em graus (0, 90, 180 ou 270 tipicamente), ou `null` se indisponível. */
  readonly rotationDegrees: number | null;
  readonly orientation: PhysicalDocumentPageOrientation;
  readonly textItems: ReadonlyArray<PhysicalDocumentTextItem>;
  /** Texto normalizado da página. Ver `physical-document-text-normalization.ts` para a regra exata. */
  readonly normalizedText: string;
  readonly metrics: PhysicalDocumentPageMetrics;
  readonly extractionAvailability: PhysicalDocumentTextExtractionAvailability;
  /** Problemas técnicos desta página especificamente (nível `page`, `pageNumber` igual a esta página). */
  readonly technicalProblems: ReadonlyArray<PhysicalDocumentTechnicalProblem>;
}

/**
 * Resultado determinístico, versionado e auditável da leitura física de um
 * documento. Para os mesmos bytes e a mesma versão de schema, leitor,
 * adaptador e biblioteca concreta, o resultado estável (todos os campos
 * exceto os explicitamente documentados como não determinísticos, dos
 * quais não há nenhum neste contrato) deve ser equivalente entre leituras.
 */
export interface PhysicalDocumentReadResult {
  readonly schemaVersion: typeof PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION;
  readonly readerName: typeof PHYSICAL_DOCUMENT_READER_NAME;
  readonly readerVersion: typeof PHYSICAL_DOCUMENT_READER_VERSION;
  /** Identificador e versão do adaptador concreto que produziu este resultado, definidos pelo próprio adaptador. */
  readonly adapterVersion: string;
  /**
   * Metadado técnico de proveniência da biblioteca concreta de extração
   * de PDF usada pelo adaptador (nome e versão resolvida), sem acoplar o
   * nome deste campo a uma biblioteca específica — apenas um identificador
   * auxiliar, não um critério de decisão nem parte da chave de
   * repetibilidade funcional.
   */
  readonly underlyingLibraryVersion: string | null;
  /** SHA-256, em hexadecimal, dos bytes originais recebidos, sem qualquer alteração, normalização ou reserialização. */
  readonly sourceByteHash: string;
  readonly totalPageCount: number;
  /** Páginas em ordem física exata, começando em 1. Vazio quando `status` for `failed`. */
  readonly pages: ReadonlyArray<PhysicalDocumentPage>;
  readonly status: PhysicalDocumentReadStatus;
  /** Problemas técnicos de nível `document` (não específicos de uma página). */
  readonly technicalProblems: ReadonlyArray<PhysicalDocumentTechnicalProblem>;
}
