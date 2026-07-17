/**
 * Política de canonicalização geométrica única e versionada (Sprint
 * 21.4A.2.f.0, seção 26). Todo valor geométrico de layout que entra no
 * contrato público (`PhysicalDocumentTextItemLayoutGeometry`) passa por
 * esta função — nunca por `toFixed`, `Math.round` ou um fator ad hoc
 * espalhado pelo código do adaptador.
 *
 * Não exportada pelo barrel do domínio (`index.ts`): é um detalhe de
 * implementação da fronteira do contrato, consumida diretamente pelos
 * outros arquivos do domínio que produzem valores geométricos e pelo
 * adaptador de infraestrutura via caminho relativo direto — nunca pelo
 * consumidor público do pacote (ver seção 41, "Não exporte: ... quantizador").
 */

/** Seis casas decimais em pontos — precisão fixa, testada nas bordas positivas e negativas. */
export const PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_CANONICALIZATION_DECIMAL_PLACES = 6 as const;

const QUANTIZATION_FACTOR = 10 ** PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_CANONICALIZATION_DECIMAL_PLACES;

/**
 * Quantiza um valor geométrico finito para exatamente seis casas decimais,
 * com arredondamento simétrico em torno de zero (round-half-away-from-zero
 * — `Math.round` sozinho não é simétrico para negativos: `Math.round(-2.5)`
 * é `-2`, não `-3`). `-0` e qualquer subnormal que quantize para zero são
 * normalizados para `0`.
 *
 * Precondição: `value` deve ser finito (`Number.isFinite`). A validação de
 * entrada é responsabilidade do chamador, antes da quantização (seção 26,
 * regra 2) — esta função nunca decide invalidade geométrica, apenas
 * quantiza.
 */
export function canonicalizeGeometryPoints(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("canonicalizeGeometryPoints: value must be finite; caller must validate before quantizing.");
  }

  const scaled = value * QUANTIZATION_FACTOR;
  const roundedMagnitude = Math.round(Math.abs(scaled));
  const rounded = Math.sign(scaled) * roundedMagnitude;
  const result = rounded / QUANTIZATION_FACTOR;

  return Object.is(result, -0) ? 0 : result;
}
