/**
 * Parser estrito de `ReferenceTruthCell.physicalOriginPt`. Trata o campo
 * como referência estrutural, nunca como texto livre: aceita
 * exclusivamente o formato já congelado `"Segmento(s): <chave>[, <chave>]*"`,
 * onde cada `<chave>` é uma chave de segmento sha256 em hexadecimal
 * minúsculo de 64 caracteres (o mesmo formato de
 * `ReferenceTruthPhysicalRegion.segmentKeys`). Nunca corrige, nunca
 * normaliza, nunca infere — uma chave malformada é rejeitada, nunca
 * reparada.
 */
const ORIGIN_PREFIX = "Segmento(s): ";
const SEGMENT_KEY_PATTERN = /^[0-9a-f]{64}$/;

export type ReferenceTruthCellOriginParseResult =
  | { readonly kind: "ok"; readonly segmentKeys: ReadonlyArray<string> }
  | { readonly kind: "malformed"; readonly reason: string };

/**
 * Preserva a ordem declarada. Rejeita: prefixo ausente/diferente, lista
 * vazia com vírgulas soltas, chave vazia, chave com caracteres fora de
 * `[0-9a-f]`, chave com comprimento diferente de 64, chave duplicada
 * dentro do mesmo campo (nunca uma ambiguidade silenciosa dentro da
 * própria declaração da célula).
 */
export function parseReferenceTruthCellPhysicalOrigin(physicalOriginPt: string): ReferenceTruthCellOriginParseResult {
  if (!physicalOriginPt.startsWith(ORIGIN_PREFIX)) {
    return { kind: "malformed", reason: `physicalOriginPt does not start with the expected prefix "${ORIGIN_PREFIX}"` };
  }

  const remainder = physicalOriginPt.slice(ORIGIN_PREFIX.length);
  if (remainder.length === 0) {
    return { kind: "malformed", reason: "physicalOriginPt declares no segment key after the prefix" };
  }

  const rawParts = remainder.split(",").map((part) => part.trim());

  const segmentKeys: string[] = [];
  const seen = new Set<string>();

  for (const rawPart of rawParts) {
    if (rawPart.length === 0) {
      return { kind: "malformed", reason: "physicalOriginPt contains an empty segment key (stray comma, leading/trailing comma, or double comma)" };
    }
    if (!SEGMENT_KEY_PATTERN.test(rawPart)) {
      return { kind: "malformed", reason: `physicalOriginPt contains a malformed segment key "${rawPart}" (expected 64 lowercase hex characters)` };
    }
    if (seen.has(rawPart)) {
      return { kind: "malformed", reason: `physicalOriginPt declares the same segment key "${rawPart}" more than once` };
    }
    seen.add(rawPart);
    segmentKeys.push(rawPart);
  }

  return { kind: "ok", segmentKeys };
}
