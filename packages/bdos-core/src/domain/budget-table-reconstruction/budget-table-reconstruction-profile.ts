export const BUDGET_TABLE_RECONSTRUCTION_ENGINE_NAME = "budget-table-reconstruction-engine" as const;
export const BUDGET_TABLE_RECONSTRUCTION_ENGINE_VERSION = "budget-table-reconstruction-engine-v1" as const;

export const BUDGET_TABLE_RECONSTRUCTION_PROFILE = Object.freeze({
  profileId: "generic-budget-table-reconstruction-profile",
  profileVersion: 1,
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
  presentationRules: Object.freeze(["truncate_to_displayed_scale", "half_away_from_zero"]),
} as const);
