export const BUDGET_TABLE_RECONSTRUCTION_ENGINE_NAME =
  "budget-table-reconstruction-engine" as const;
export const BUDGET_TABLE_RECONSTRUCTION_ENGINE_VERSION =
  "budget-table-reconstruction-engine-v2" as const;

export const BUDGET_TABLE_RECONSTRUCTION_PROFILE = Object.freeze({
  profileId: "generic-budget-table-reconstruction-profile",
  profileVersion: 2,
  headerVocabulary: Object.freeze({
    item_code: Object.freeze(["codigo", "item"]),
    description: Object.freeze(["descricao", "servico"]),
    unit: Object.freeze(["unidade", "unid"]),
    quantity: Object.freeze(["quantidade", "quant"]),
    unit_cost: Object.freeze(["custo unitario", "custo"]),
    bdi_rate: Object.freeze(["bdi"]),
    unit_price: Object.freeze(["preco unitario"]),
    total_price: Object.freeze(["preco total", "total"]),
  }),
  presentationRules: Object.freeze([
    "truncate_to_displayed_scale",
    "half_away_from_zero",
  ]),
} as const);

export function normalizeBudgetHeaderText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function headerVocabularyRoles(
  text: string,
): ReadonlyArray<keyof typeof BUDGET_TABLE_RECONSTRUCTION_PROFILE.headerVocabulary> {
  const normalized = normalizeBudgetHeaderText(text);
  return Object.entries(BUDGET_TABLE_RECONSTRUCTION_PROFILE.headerVocabulary)
    .filter(([, terms]) =>
      terms.some((term) => normalized === term || normalized.includes(term)),
    )
    .map(([role]) => role as keyof typeof BUDGET_TABLE_RECONSTRUCTION_PROFILE.headerVocabulary)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}
