export const BUDGET_TABLE_RECONSTRUCTION_ENGINE_NAME =
  "budget-table-reconstruction-engine" as const;
export const BUDGET_TABLE_RECONSTRUCTION_ENGINE_VERSION =
  "budget-table-reconstruction-engine-v3" as const;

export const BUDGET_TABLE_RECONSTRUCTION_PROFILE = Object.freeze({
  profileId: "generic-budget-table-reconstruction-profile",
  profileVersion: 3,
  headerVocabulary: Object.freeze({
    item_code: Object.freeze(["codigo", "item"]),
    description: Object.freeze(["descricao", "servico"]),
    unit: Object.freeze(["unidade", "unid"]),
    quantity: Object.freeze(["quantidade", "quant", "qtd"]),
    unit_cost: Object.freeze(["custo unitario", "custo"]),
    bdi_rate: Object.freeze(["bdi"]),
    unit_price: Object.freeze(["preco unitario"]),
    total_price: Object.freeze(["preco total", "total"]),
  }),
  presentationRules: Object.freeze([
    "truncate_to_displayed_scale",
    "half_away_from_zero",
  ] as const),
} as const);

export function normalizeBudgetHeaderText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A vocabulary term matches only as a whole word/phrase (word-boundary
 * delimited), never as an arbitrary substring -- a short generic
 * abbreviation like "qtd" must not accidentally match inside an unrelated
 * longer word, and a term like "total" must not match inside "subtotal".
 * `\b` treats letters/digits as word characters and everything else
 * (spaces, punctuation, accented-character remnants after normalization)
 * as boundaries, so multi-word terms ("custo unitario") still match
 * correctly as long as the surrounding text isn't itself part of a larger
 * word.
 */
function matchesVocabularyTerm(normalized: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExpLiteral(term)}\\b`).test(normalized);
}

export function headerVocabularyRoles(
  text: string,
): ReadonlyArray<keyof typeof BUDGET_TABLE_RECONSTRUCTION_PROFILE.headerVocabulary> {
  const normalized = normalizeBudgetHeaderText(text);
  return Object.entries(BUDGET_TABLE_RECONSTRUCTION_PROFILE.headerVocabulary)
    .filter(([, terms]) => terms.some((term) => matchesVocabularyTerm(normalized, term)))
    .map(([role]) => role as keyof typeof BUDGET_TABLE_RECONSTRUCTION_PROFILE.headerVocabulary)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/**
 * Contextual role resolution for a hierarchical header path (ancestor texts,
 * root first, followed by the leaf text -- already normalized). Generic
 * structural/lexical rules only, never tied to a specific document:
 *
 * - a "com/c/ BDI" or "sem/s/ BDI" qualifier on an atom that also carries a
 *   per-unit or total qualifier picks the correct price-family role instead
 *   of falling through to the "bdi" substring match (a bare "BDI" or
 *   "BDI (%)" atom, with neither qualifier, still resolves to bdi_rate);
 * - "unitario"/"unit." is a distinct signal from "unidade"/"unid" (unit of
 *   measurement) and, combined with "custo"/"preco", picks unit_cost or
 *   unit_price;
 * - a bare "BDI" child nested directly under a unit/total price ancestor,
 *   with neither a "com"/"sem" qualifier of its own, is a MONETARY BDI
 *   amount (a "how much BDI adds in currency" column), not the percentage
 *   rate -- there is no BudgetColumnRole for that amount in this version,
 *   so it resolves to no role (kept as evidence, surfaced as "unknown")
 *   rather than being misread as bdi_rate through the flat "bdi" substring
 *   match. This check runs before the unqualified-bdi-rate rule, so a bare
 *   "BDI" with no unit/total ancestor at all still resolves to bdi_rate
 *   exactly as before;
 * - symmetrically, "SEM BDI" under a total-price ancestor is the total
 *   price EXCLUDING BDI, for which this version likewise has no role (only
 *   total_price, which by definition already includes BDI) -- it resolves
 *   to no role rather than being pulled into total_price merely because
 *   "preco"/"total" appear somewhere in the path;
 * - item_code is only confirmed on a nested (non-root) header atom when
 *   every ancestor in its path is itself compatible with the item/service
 *   identity (matches item_code or description); a nested "codigo" under an
 *   unrelated grouping (e.g. a source/reference sub-table) is demoted
 *   instead of colliding with the real item code column.
 */
export function headerPathRoles(
  pathTexts: ReadonlyArray<string>,
): ReadonlyArray<keyof typeof BUDGET_TABLE_RECONSTRUCTION_PROFILE.headerVocabulary> {
  const leaf = pathTexts.at(-1) ?? "";
  const parents = pathTexts.slice(0, -1);
  const fullPath = pathTexts.join(" ");

  const hasBdiToken = /\bbdi\b/.test(fullPath);
  const hasWithBdi = /\bc\/\s*bdi\b|\bcom\s+bdi\b/.test(fullPath);
  const hasWithoutBdi = /\bs\/\s*bdi\b|\bsem\s+bdi\b/.test(fullPath);
  const hasUnitQualifier =
    (/\bunit\.?\b|\bunitario\b/.test(fullPath)) && !/\bunidade\b/.test(fullPath);
  const hasTotalQualifier = /\btotal\b/.test(fullPath);
  const hasCostWord = /\bcusto\b/.test(fullPath);
  const hasPriceWord = /\bpreco\b/.test(fullPath);

  if (hasWithBdi && hasUnitQualifier) return ["unit_price"];
  if (hasWithoutBdi && hasUnitQualifier) return ["unit_cost"];
  if (hasWithBdi && hasTotalQualifier) return ["total_price"];
  if (hasWithoutBdi && hasTotalQualifier) return [];
  if (hasBdiToken && !hasWithBdi && !hasWithoutBdi && (hasUnitQualifier || hasTotalQualifier)) {
    return [];
  }
  if (hasBdiToken && !hasUnitQualifier && !hasTotalQualifier) return ["bdi_rate"];
  if (hasUnitQualifier && hasCostWord) return ["unit_cost"];
  if (hasUnitQualifier && hasPriceWord) return ["unit_price"];
  if (hasTotalQualifier && hasPriceWord) return ["total_price"];

  const flatRoles = headerVocabularyRoles(leaf);
  if (flatRoles.includes("item_code") && parents.length > 0) {
    const parentSupportsItemIdentity = parents.every((parentText) => {
      const parentRoles = headerVocabularyRoles(parentText);
      return parentRoles.includes("item_code") || parentRoles.includes("description");
    });
    if (!parentSupportsItemIdentity) {
      return flatRoles.filter((role) => role !== "item_code");
    }
  }
  return flatRoles;
}
