/**
 * Classificador de diferenças de repetição congelado (§11 do
 * protocolo, Momento 3A). Classifica cada diferença observada entre
 * duas execuções independentes da mesma ferramenta sobre a mesma
 * imagem em ruído conhecido ou diferença semântica. A normalização
 * canônica (módulos de texto/coordenadas) é a única removedora
 * legítima de ruído — este classificador nunca corrige um valor, apenas
 * rotula a diferença bruta já observada.
 */

import type { LocalReaderRepetitionDifference, LocalReaderRepetitionDifferenceCategory, LocalReaderRepetitionRawDifference } from "./discovery-local-reader-evaluation.types";

const TIMESTAMP_PATTERN = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?\b/;
const TEMP_DIRECTORY_PATTERN = /(\\Temp\\|\/tmp\/|AppData\\Local\\Temp)/i;
const RANDOM_IDENTIFIER_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

/**
 * Marcador de caminho reservado para diferenças de ordem de propriedade
 * não semântica (§11, último parágrafo). Só existe no nível de
 * comparação de saída BRUTA serializada (antes do parse estruturado) —
 * uma diferença estruturada por `path` (pós-parse) nunca é, por
 * construção, apenas ordem de chave, porque o acesso por caminho é
 * indiferente à ordem. O chamador (Momento 3B) marca explicitamente
 * este caminho quando a única diferença bruta é a ordem de serialização
 * de um objeto, nunca inferido por heurística de conteúdo.
 */
export const NONSEMANTIC_PROPERTY_ORDER_DIFFERENCE_PATH = "$__raw_property_order_only__";

export function classifyLocalReaderRepetitionDifference(diff: LocalReaderRepetitionRawDifference): LocalReaderRepetitionDifference {
  const combined = `${diff.valueRun1}\n${diff.valueRun2}`;

  let category: LocalReaderRepetitionDifferenceCategory;
  if (diff.path === NONSEMANTIC_PROPERTY_ORDER_DIFFERENCE_PATH) {
    category = "known_noise_nonsemantic_property_order";
  } else if (TIMESTAMP_PATTERN.test(combined)) {
    category = "known_noise_timestamp";
  } else if (TEMP_DIRECTORY_PATTERN.test(combined)) {
    category = "known_noise_temp_directory";
  } else if (RANDOM_IDENTIFIER_PATTERN.test(combined)) {
    category = "known_noise_random_identifier";
  } else {
    category = "semantic_difference";
  }

  return { path: diff.path, category };
}

export function classifyLocalReaderRepetitionDifferences(diffs: ReadonlyArray<LocalReaderRepetitionRawDifference>): ReadonlyArray<LocalReaderRepetitionDifference> {
  return diffs.map(classifyLocalReaderRepetitionDifference);
}
