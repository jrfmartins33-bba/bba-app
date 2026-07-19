import { normalizePageText } from "../physical-document-text-normalization";
import { PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION } from "./budget-document-physical-cell-text-evidence-formation.types";

/**
 * Wrapper fino sobre a regra concreta já pública e testada de
 * `normalizePageText`, aplicada a um único item (`normalizePageText([originalText])`
 * é exatamente a forma normalizada daquele item, sem risco de ambiguidade de
 * alinhamento que uma junção multi-item introduziria — mesmo raciocínio já
 * usado em `signal-observation-rules.ts`). Não reimplementa a regra, apenas
 * centraliza a chamada e expõe a identidade versionada explícita exigida por
 * esta Sprint. `normalizePageText` nunca retorna null, então esta função
 * também nunca retorna null.
 */
export function normalizePhysicalCellTextItem(originalText: string): string {
  return normalizePageText([originalText]);
}

export { PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION };
