/**
 * Epic 21, Sprint 21.4B.1 — fonte de demonstração explícita e isolada da
 * área de Orçamento. Não é um contrato de domínio (não deve ser importada
 * por `packages/bdos-core`, nem tratada como leitura real de dado
 * persistido) e não deve ser confundida com `BudgetVersion`/`BudgetLine`
 * (packages/bdos-core/src/domain/budget-version) — esses tipos existem,
 * mas nenhuma rota/Server Action em `apps/web` os expõe ainda (ver
 * `apps/web/lib/bdos/procurement-engineering-server-repository.ts`,
 * cabeçalho: "fluxo de servidor pretendido, a construir em Sprint futura").
 *
 * Todos os valores abaixo são literais fixos, nunca resultado de cálculo
 * em ponto flutuante: correspondem aos totais confirmados do caso de
 * caracterização do Epic 21 (11 grupos, 25 subgrupos, 300 itens,
 * orçamento oficial R$ 9.809.087,18), mais uma proposta e um percentual
 * de redução de demonstração associados, sem expor nome de cliente, órgão
 * ou obra (não usar "Lagoa do Arroz" nesta camada, mesmo onde o Workspace
 * Engenharia já nomeia o projeto ativo em outro contexto).
 */

export type BudgetSourceKind = "demonstration";

/**
 * Sprint 21.4B.2 — vocabulário corrigido: "Disponível" / "Aguardando
 * revisão" / "Próxima etapa". Os nomes técnicos anteriores
 * ("demonstrated"/"requires_confirmation"/"future") continuam só como
 * identificadores internos de estado, nunca renderizados — o rótulo
 * exibido vem sempre do mapa de tradução no componente.
 */
export type BudgetJourneyStepState = "available" | "awaiting_review" | "next_step";

export interface BudgetMoneyFigure {
  /** Centavos inteiros — nunca usado para cálculo aqui, só para auditoria de origem. */
  readonly cents: number;
  /** Texto já formatado em pt-BR, pronto para exibição — o componente nunca formata. */
  readonly displayValue: string;
}

export interface BudgetJourneyStep {
  readonly id: string;
  readonly label: string;
  readonly state: BudgetJourneyStepState;
}

export interface BudgetDemonstrationData {
  readonly sourceKind: BudgetSourceKind;
  readonly officialBudget: BudgetMoneyFigure;
  readonly proposalValue: BudgetMoneyFigure;
  readonly differenceValue: BudgetMoneyFigure;
  readonly reductionPercentDisplay: string;
  readonly groupCount: number;
  readonly subgroupCount: number;
  readonly serviceItemCount: number;
  /** Largura de barra pré-calculada (literal, não derivada em runtime) para a comparação visual. */
  readonly officialBarWidthPercent: number;
  readonly proposalBarWidthPercent: number;
  readonly journey: ReadonlyArray<BudgetJourneyStep>;
  /** Reflete a ausência real de um serviço de simulação/transformação de desconto nesta Sprint. */
  readonly simulationServiceAvailable: boolean;
}

export const BUDGET_DEMONSTRATION_DATA: BudgetDemonstrationData = {
  sourceKind: "demonstration",
  officialBudget: { cents: 980_908_718, displayValue: "R$ 9.809.087,18" },
  proposalValue: { cents: 761_185_165, displayValue: "R$ 7.611.851,65" },
  differenceValue: { cents: 219_723_553, displayValue: "R$ 2.197.235,53" },
  reductionPercentDisplay: "22,40%",
  groupCount: 11,
  subgroupCount: 25,
  serviceItemCount: 300,
  officialBarWidthPercent: 100,
  proposalBarWidthPercent: 77.6,
  journey: [
    { id: "recebido", label: "Orçamento recebido", state: "available" },
    { id: "estrutura", label: "Estrutura organizada", state: "available" },
    { id: "valores", label: "Valores revisados", state: "awaiting_review" },
    { id: "proposta", label: "Proposta comparada", state: "available" },
    { id: "decisao", label: "Pronto para decisão", state: "next_step" }
  ],
  simulationServiceAvailable: false
};
