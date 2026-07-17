/**
 * Contrato puro da leitura física de um documento PDF (Sprint 21.4A.2.c,
 * evoluído para schema v2 pela Sprint 21.4A.2.f.0 — geometria normalizada
 * por item textual).
 *
 * Responde apenas: "o que foi fisicamente observado em cada página do
 * documento, e onde cada item textual foi fisicamente observado, em qual
 * espaço de coordenadas?" — nunca "quais páginas contêm o orçamento?" nem
 * "a qual linha, segmento, bloco, coluna ou célula esse texto pertence?".
 * Este arquivo não importa nenhuma biblioteca concreta de extração de
 * PDF; a fronteira pública é `Uint8Array` de entrada e este contrato de
 * saída. Ver
 * `packages/bdos-core/docs/EPIC_21_SPRINT_4A2C_DOCUMENT_READER_AND_PDF_ADAPTER.md`
 * (contrato v1) e
 * `packages/bdos-core/docs/EPIC_21_SPRINT_4A2F0_NORMALIZED_TEXT_ITEM_GEOMETRY.md`
 * (evolução para v2).
 */

export const PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION = 2 as const;

export const PHYSICAL_DOCUMENT_READER_NAME = "physical-document-reader" as const;

export const PHYSICAL_DOCUMENT_READER_VERSION = "physical-document-reader-v2" as const;

/**
 * Identidade do espaço de coordenadas em que toda geometria de layout por
 * item textual é expressa (Sprint 21.4A.2.f.0, seção 11): origem no canto
 * superior esquerdo da página apresentada (após rotação), x crescente
 * para a direita, y crescente para baixo, unidade em pontos no viewport
 * com `scale = 1`, dimensões já refletindo a rotação efetiva. O domínio
 * nunca conhece `PageViewport`, `TextItem`, `TextStyle` ou qualquer
 * matriz concreta da biblioteca de extração — apenas estes valores já
 * normalizados.
 */
export const PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION =
  "physical-document-text-item-coordinate-space-v1" as const;

/**
 * Identidade do algoritmo de derivação geométrica por item textual
 * (composição afim viewport×item, métricas tipográficas de
 * ascent/descent, canonicalização) — versionada separadamente do espaço
 * de coordenadas, do leitor, do adaptador e da biblioteca concreta (Sprint
 * 21.4A.2.f.0, seção 9).
 */
export const PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION =
  "physical-document-text-item-geometry-profile-v1" as const;

/**
 * Identidade do algoritmo de fingerprint do contexto geométrico de
 * repetibilidade (Sprint 21.4A.2.f.0, seção 19) — versionada
 * separadamente de tudo o que ela resume.
 */
export const PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION =
  "physical-document-geometry-context-fingerprint-v1" as const;

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
  /**
   * A biblioteca concreta de extração de PDF efetivamente carregada em
   * runtime não corresponde à identidade fixada pelo adaptador (Sprint
   * 21.4A.2.f.0, seção 20 e 6): a partir do schema v2 a geometria e as
   * métricas tipográficas dependem materialmente da implementação
   * concreta da biblioteca, então divergência de versão nunca é aceita
   * silenciosamente — a leitura para antes de produzir qualquer página,
   * em vez de continuar com um contexto de repetibilidade falso.
   */
  | "document_underlying_library_version_mismatch"
  | "page_load_failed"
  | "page_geometry_unavailable"
  | "page_text_extraction_failed"
  | "page_processing_failed"
  /**
   * Falha inesperada (não uma limitação previsível como orientação não
   * suportada ou geometria ausente/inválida) durante a normalização
   * geométrica de um ou mais itens textuais da página. No máximo um
   * problema deste código por página, mesmo que vários itens tenham
   * falhado (Sprint 21.4A.2.f.0, seção 30) — os itens afetados
   * individualmente carregam `unresolved_normalization_failed` em seu
   * próprio `placement`, sem duplicar este problema agregado por item.
   */
  | "page_text_item_geometry_normalization_failed";

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
 * Relação objetiva entre os limites de layout de um item textual
 * `placed` e o retângulo da página apresentada (`[0, 0, widthPoints,
 * heightPoints]` no mesmo espaço de coordenadas). Nunca decide
 * relevância, visibilidade econômica ou candidatura — apenas descreve a
 * observação física (Sprint 21.4A.2.f.0, seção 25). Nenhum `clamp` é
 * aplicado: um item fora da página permanece `placed`.
 *
 * - `inside`: todos os quatro limites estão dentro do retângulo da página.
 * - `partially_outside`: existe interseção com a página, mas parte dos
 *   limites está fora.
 * - `outside`: não existe interseção com o retângulo da página.
 */
export type PhysicalDocumentTextItemPageBoundsRelation = "inside" | "partially_outside" | "outside";

/**
 * Bounding box axis-aligned de **layout textual** de um item posicionado,
 * no espaço de coordenadas `PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION`.
 * "Layout", não "glyph"/"pixel": os limites derivam da matriz de
 * transformação do item composta com o viewport, do avanço horizontal
 * (`TextItem.width`) e das métricas tipográficas de ascent/descent —
 * nunca do contorno visual exato dos caracteres (Sprint 21.4A.2.f.0,
 * seção 12 e 21).
 *
 * Todo valor em pontos é canonicalizado (seis casas decimais,
 * arredondamento simétrico — ver
 * `physical-document-text-item-geometry-canonicalization.ts`, não
 * exportado pelo barrel público). `widthPoints`/`heightPoints`/
 * `centerXPoints`/`centerYPoints` são derivados dos limites já
 * canonicalizados e re-canonicalizados.
 */
export interface PhysicalDocumentTextItemLayoutGeometry {
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
  readonly pageBoundsRelation: PhysicalDocumentTextItemPageBoundsRelation;
  readonly coordinateSpaceVersion: typeof PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION;
  readonly geometryProfileVersion: typeof PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION;
}

/**
 * Código técnico estável por item textual não resolvido
 * geometricamente — mesma disciplina de `PhysicalDocumentTechnicalProblemCode`:
 * nunca deriva de mensagem, exceção ou stack trace da biblioteca concreta.
 *
 * - `text_item_geometry_missing`: dado necessário ausente (viewport
 *   indisponível, `transform` ausente, estilo tipográfico ausente).
 * - `text_item_geometry_invalid`: dado presente, mas geometricamente
 *   incoerente (não finito, negativo onde não permitido, incoerência após
 *   quantização).
 * - `text_item_orientation_unsupported`: orientação/matriz do item fora do
 *   subconjunto comprovado nesta versão (texto vertical/`ttb`, `rtl` não
 *   comprovado, matriz inclinada ou cisalhada).
 * - `text_item_geometry_normalization_failed`: exceção inesperada isolada
 *   durante a normalização deste item específico.
 */
export type PhysicalDocumentTextItemGeometryProblemCode =
  | "text_item_geometry_missing"
  | "text_item_geometry_invalid"
  | "text_item_orientation_unsupported"
  | "text_item_geometry_normalization_failed";

/**
 * Disposição de um item textual: ou foi posicionado (`placed`, com
 * geometria de layout completa e `reasonCode: null`), ou não foi
 * resolvido geometricamente (um dos quatro estados previsíveis, com
 * `geometry: null` e o código correspondente). União discriminada —
 * nunca campos opcionais soltos (`x?`, `y?`, `width?`) que permitiriam
 * estado ambíguo entre "ausente" e "não resolvido" (Sprint 21.4A.2.f.0,
 * seção 13).
 *
 * Cada estado não resolvido é sua própria variante, com `status` e
 * `reasonCode` amarrados 1:1 por tipo literal — não um `status` agrupado
 * combinado com um `reasonCode: PhysicalDocumentTextItemGeometryProblemCode`
 * genérico. Isso torna combinações contraditórias (ex.: `status:
 * "unresolved_missing_geometry"` com `reasonCode:
 * "text_item_geometry_invalid"`) um erro de tipo, não apenas uma
 * invariante documentada (auditoria pós-PR #68).
 */
export type PhysicalDocumentTextItemPlacement =
  | {
      readonly status: "placed";
      readonly geometry: PhysicalDocumentTextItemLayoutGeometry;
      readonly reasonCode: null;
    }
  | {
      readonly status: "unresolved_missing_geometry";
      readonly geometry: null;
      readonly reasonCode: "text_item_geometry_missing";
    }
  | {
      readonly status: "unresolved_invalid_geometry";
      readonly geometry: null;
      readonly reasonCode: "text_item_geometry_invalid";
    }
  | {
      readonly status: "unresolved_unsupported_orientation";
      readonly geometry: null;
      readonly reasonCode: "text_item_orientation_unsupported";
    }
  | {
      readonly status: "unresolved_normalization_failed";
      readonly geometry: null;
      readonly reasonCode: "text_item_geometry_normalization_failed";
    };

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
 *
 * `placement` descreve onde (e se) o item foi fisicamente observado
 * geometricamente — nunca a qual linha, segmento, bloco, coluna ou célula
 * ele pertence (Sprint 21.4A.2.f.0, seção 4). Todo item admitido (que
 * possui `str` na extração concreta) é preservado; nenhum desaparece após
 * a admissão, mesmo quando `placement.status` não é `placed`.
 */
export interface PhysicalDocumentTextItem {
  readonly index: number;
  readonly text: string;
  readonly placement: PhysicalDocumentTextItemPlacement;
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
 * Contagens objetivas da disposição geométrica dos itens textuais
 * admitidos de uma página (Sprint 21.4A.2.f.0, seção 17). A invariante
 * testada é: `totalAdmittedTextItemCount === placedTextItemCount +
 * unresolvedMissingGeometryCount + unresolvedInvalidGeometryCount +
 * unresolvedUnsupportedOrientationCount + unresolvedNormalizationFailedCount`.
 * `totalAdmittedTextItemCount` é sempre igual a `metrics.textItemCount`
 * (mesma população de itens, duas visões diferentes — textual e
 * geométrica).
 */
export interface PhysicalDocumentTextItemPlacementMetrics {
  readonly totalAdmittedTextItemCount: number;
  readonly placedTextItemCount: number;
  readonly unresolvedMissingGeometryCount: number;
  readonly unresolvedInvalidGeometryCount: number;
  readonly unresolvedUnsupportedOrientationCount: number;
  readonly unresolvedNormalizationFailedCount: number;
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
  /** Disposição geométrica dos itens textuais desta página (Sprint 21.4A.2.f.0). */
  readonly textItemPlacementMetrics: PhysicalDocumentTextItemPlacementMetrics;
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
   * nome deste campo a uma biblioteca específica.
   *
   * Histórico (schema v1, Sprint 21.4A.2.c): este campo era documentado
   * como "não um critério de decisão nem parte da chave de repetibilidade
   * funcional" — verdadeiro no v1, onde o contrato preservava apenas
   * texto e índice, indiferentes à implementação concreta da biblioteca.
   *
   * A partir do schema v2 (Sprint 21.4A.2.f.0), a geometria de layout por
   * item textual e as métricas tipográficas (ascent/descent) dependem
   * materialmente da implementação concreta da biblioteca — por isso a
   * versão da biblioteca concreta passa a participar obrigatoriamente do
   * contexto de repetibilidade geométrica (`geometryContextFingerprint`)
   * e a biblioteca concreta de extração de PDF usada pelo adaptador passa
   * a ser fixada em versão exata (sem faixa/`^`) no manifesto de
   * dependências do pacote. Este campo continua sendo o único
   * identificador — nunca substituído pelo fingerprint.
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
  /** Espaço de coordenadas usado por toda geometria de layout por item textual deste resultado. */
  readonly textItemCoordinateSpaceVersion: typeof PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION;
  /** Algoritmo de derivação geométrica usado por toda geometria de layout por item textual deste resultado. */
  readonly textItemGeometryProfileVersion: typeof PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION;
  readonly geometryContextFingerprintVersion: typeof PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION;
  /**
   * SHA-256, em hexadecimal, do contexto técnico de repetibilidade
   * geométrica (bytes, schema, leitor, adaptador, biblioteca concreta,
   * espaço de coordenadas, perfil geométrico, canonicalização — ver
   * `physical-document-geometry-context-fingerprint.ts`). Presente mesmo
   * quando `status` for `failed`, pois identifica o contrato técnico
   * utilizado independentemente do sucesso da leitura.
   */
  readonly geometryContextFingerprint: string;
}
