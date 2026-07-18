/**
 * Epic 21, Sprint 21.4B.2 — amostra sintética e isolada da Planilha
 * orçamentária, discriminada por `sourceKind: "synthetic_visual_example"`
 * (deliberadamente diferente de `sourceKind: "demonstration"` em
 * budget-demonstration-data.ts — nunca a mesma fonte, para que nenhum
 * consumidor confunda os dois conjuntos ou os some sem querer).
 *
 * Nenhum item aqui pertence à estrutura real dos 300 itens do caso de
 * caracterização do Epic 21 — grupos e itens são genéricos de construção
 * civil, sem nome de cliente, órgão ou obra. Todos os valores (código,
 * unidade, quantidade, preço unitário, total, subtotal) são literais
 * fixos, com quantidade sempre inteira e preço unitário sempre em
 * centavos inteiros, de modo que `quantity * unitPriceCents ===
 * totalCents` e a soma dos totais de cada grupo bate exatamente com seu
 * `subtotalCents` — conferido em teste com aritmética inteira, nunca
 * recalculado na interface.
 */

export type BudgetWorksheetSourceKind = "synthetic_visual_example";

export interface BudgetWorksheetItem {
  readonly code: string;
  readonly description: string;
  readonly unit: string;
  /** Quantidade inteira, sem casas decimais -- texto pronto para exibição em pt-BR. */
  readonly quantityDisplay: string;
  readonly unitPriceCents: number;
  readonly unitPriceDisplay: string;
  readonly totalCents: number;
  readonly totalDisplay: string;
  readonly sourceKind: BudgetWorksheetSourceKind;
}

export interface BudgetWorksheetGroup {
  readonly code: string;
  readonly label: string;
  readonly items: ReadonlyArray<BudgetWorksheetItem>;
  readonly subtotalCents: number;
  readonly subtotalDisplay: string;
}

export interface BudgetWorksheetSample {
  readonly sourceKind: BudgetWorksheetSourceKind;
  readonly groups: ReadonlyArray<BudgetWorksheetGroup>;
}

function item(
  code: string,
  description: string,
  unit: string,
  quantityDisplay: string,
  unitPriceCents: number,
  unitPriceDisplay: string,
  totalCents: number,
  totalDisplay: string
): BudgetWorksheetItem {
  return {
    code,
    description,
    unit,
    quantityDisplay,
    unitPriceCents,
    unitPriceDisplay,
    totalCents,
    totalDisplay,
    sourceKind: "synthetic_visual_example"
  };
}

export const BUDGET_WORKSHEET_SAMPLE: BudgetWorksheetSample = {
  sourceKind: "synthetic_visual_example",
  groups: [
    {
      code: "1",
      label: "Serviços preliminares",
      items: [
        item("1.1", "Mobilização de equipe", "verba", "1", 1_500_000, "R$ 15.000,00", 1_500_000, "R$ 15.000,00"),
        item("1.2", "Instalação do canteiro", "verba", "1", 2_800_000, "R$ 28.000,00", 2_800_000, "R$ 28.000,00")
      ],
      subtotalCents: 4_300_000,
      subtotalDisplay: "R$ 43.000,00"
    },
    {
      code: "2",
      label: "Movimento de terra",
      items: [
        item("2.1", "Escavação mecanizada", "m³", "500", 4_250, "R$ 42,50", 2_125_000, "R$ 21.250,00"),
        item("2.2", "Carga e transporte", "m³", "500", 1_890, "R$ 18,90", 945_000, "R$ 9.450,00"),
        item("2.3", "Compactação", "m³", "500", 2_310, "R$ 23,10", 1_155_000, "R$ 11.550,00")
      ],
      subtotalCents: 4_225_000,
      subtotalDisplay: "R$ 42.250,00"
    },
    {
      code: "3",
      label: "Estruturas de concreto",
      items: [
        item("3.1", "Concreto magro", "m³", "12", 45_000, "R$ 450,00", 540_000, "R$ 5.400,00"),
        item("3.2", "Concreto estrutural", "m³", "40", 68_000, "R$ 680,00", 2_720_000, "R$ 27.200,00"),
        item("3.3", "Aço CA-50", "kg", "3.200", 950, "R$ 9,50", 3_040_000, "R$ 30.400,00"),
        item("3.4", "Forma para estruturas", "m²", "850", 8_200, "R$ 82,00", 6_970_000, "R$ 69.700,00")
      ],
      subtotalCents: 13_270_000,
      subtotalDisplay: "R$ 132.700,00"
    }
  ]
};
