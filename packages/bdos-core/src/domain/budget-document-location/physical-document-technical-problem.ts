import type {
  PhysicalDocumentTechnicalProblem,
  PhysicalDocumentTechnicalProblemCode,
  PhysicalDocumentTechnicalProblemLevel,
} from "./physical-document-read.types";

/**
 * Mensagem técnica controlada, em português, por código estável. Central e
 * única fonte de redação: um adaptador nunca escreve sua própria mensagem
 * nem repassa texto bruto de uma biblioteca concreta. Mantém o contrato
 * estável entre versões/ambientes da biblioteca concreta e permite que uma
 * camada de apresentação futura traduza o código para uma mensagem
 * apresentável ao usuário sem depender desta redação interna.
 */
const TECHNICAL_PROBLEM_MESSAGE_BY_CODE: Readonly<Record<PhysicalDocumentTechnicalProblemCode, string>> = {
  document_bytes_empty: "Os bytes recebidos estão vazios; nenhuma leitura foi possível.",
  document_invalid_structure: "A estrutura do documento não pôde ser reconhecida como um PDF válido.",
  document_protected: "O documento está protegido e não pôde ser aberto sem credencial.",
  document_open_failed: "Falha técnica não classificada ao abrir o documento.",
  page_load_failed: "A página não pôde ser carregada a partir da estrutura do documento.",
  page_geometry_unavailable: "A geometria física da página não pôde ser obtida.",
  page_text_extraction_failed: "Falha técnica ao extrair o conteúdo textual da página.",
  page_processing_failed: "Falha técnica não classificada ao processar a página.",
  page_text_item_geometry_normalization_failed:
    "Falha técnica inesperada ao normalizar a geometria de um ou mais itens textuais da página.",
};

/**
 * Constrói um problema técnico normalizado. Único ponto de criação usado
 * pelo(s) adaptador(es) concreto(s), garantindo que a mensagem seja sempre
 * a mensagem controlada correspondente ao código — nunca texto bruto da
 * biblioteca concreta, nunca stack trace.
 */
export function createTechnicalProblem(
  code: PhysicalDocumentTechnicalProblemCode,
  level: PhysicalDocumentTechnicalProblemLevel,
  pageNumber: number | null,
): PhysicalDocumentTechnicalProblem {
  return {
    code,
    level,
    pageNumber,
    message: TECHNICAL_PROBLEM_MESSAGE_BY_CODE[code],
  };
}
