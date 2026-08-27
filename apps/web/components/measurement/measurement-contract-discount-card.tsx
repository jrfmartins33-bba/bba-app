"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@bba/ui";
import type { MeasurementEconomicSummaryWithComposition } from "./measurement-review-client";
import { formatFormalBulletinTotalBRL } from "./measurement-bulletin-formal-status-view-model";
import { formatMeasurementEconomicPercentage, formatMeasurementReviewQuantity } from "./measurement-review-view-model";

export interface MeasurementContractDiscountCardProps {
  readonly summary: MeasurementEconomicSummaryWithComposition;
}

/**
 * Correção semântica pós-Preview (itens 3/4/5, e ajuste visual
 * seguinte): o conceito é DESÁGIO/REDUÇÃO NA CONTRATAÇÃO (quanto o
 * valor desta medição seria maior se precificado pelo Orçamento
 * Oficial), nunca um resultado de execução da contratada. O total
 * (`contractDiscountImpactDecimal`) já vem pronto do servidor, soma
 * dos impactos canônicos por linha -- este componente nunca soma nem
 * subtrai nada.
 *
 * Regra de cores econômicas: esta comparação (Orçamento Oficial ×
 * Proposta Vencedora) é sempre informação documental, nunca ganho ou
 * perda comprovados -- por isso o card inteiro é neutro (sem verde,
 * sem vermelho); verde/vermelho ficam reservados para quando o BDOS
 * apurar resultado real de execução (ver "Resultado da execução").
 *
 * "Ver composição" mostra os itens que compõem o total, na ordem que
 * o servidor já decidiu (maior contribuição primeiro) -- nunca
 * reordenado aqui.
 */
export function MeasurementContractDiscountCard({ summary }: MeasurementContractDiscountCardProps) {
  const [expanded, setExpanded] = useState(false);
  const topContributor = summary.composition[0] ?? null;

  return (
    <Card className="span-12 workspace-card measurement-contract-discount-card" title="Redução da proposta frente ao orçamento oficial">
      <p className="measurement-contract-discount-card__subtitle">Impacto nas quantidades medidas neste período</p>

      <div className="measurement-contract-discount-card__headline">
        <strong>{formatFormalBulletinTotalBRL(summary.contractDiscountImpactDecimal)}</strong>
        <span className="measurement-review-header__economic-coverage">
          Comparação disponível para {summary.matchedItemCount} de {summary.totalItemCount} itens
        </span>
      </div>

      <p className="measurement-contract-discount-card__explanation">
        Para as quantidades efetivamente medidas neste período, o valor desta medição seria{" "}
        {formatFormalBulletinTotalBRL(summary.contractDiscountImpactDecimal)} maior se precificado pelo Orçamento Oficial. Isto reflete o deságio obtido
        na contratação (Orçamento Oficial × Proposta Vencedora) -- não representa economia operacional, ganho ou margem da contratada.
      </p>

      {topContributor ? (
        <p className="measurement-contract-discount-card__top-contributor">
          {formatMeasurementEconomicPercentage(topContributor.participationPercentage) ?? "—"} do impacto do deságio nesta medição está concentrado no
          item {topContributor.code}
          {topContributor.description ? ` — ${topContributor.description}` : ""}.
        </p>
      ) : null}

      {summary.composition.length > 0 ? (
        <button
          aria-expanded={expanded}
          className="measurement-ver-mais"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <ChevronDown aria-hidden="true" className="measurement-ver-mais__chevron" size={14} />
          {expanded ? "Ocultar composição" : "Ver composição"}
        </button>
      ) : null}

      {expanded ? (
        <ul className="measurement-contract-discount-composition">
          <li className="measurement-contract-discount-composition__row measurement-contract-discount-composition__row--head" aria-hidden="true">
            <span>Código</span>
            <span>Serviço</span>
            <span>Quantidade medida</span>
            <span>Preço oficial</span>
            <span>Preço contratado</span>
            <span>Impacto do deságio</span>
            <span>Participação no impacto total</span>
          </li>
          {summary.composition.map((entry) => (
            <li className="measurement-contract-discount-composition__row" key={entry.itemId}>
              <span>{entry.code}</span>
              <span>{entry.description}</span>
              <span>{formatMeasurementReviewQuantity(entry.quantityDecimal)}</span>
              <span>{formatFormalBulletinTotalBRL(entry.officialUnitPriceDecimal)}</span>
              <span>{formatFormalBulletinTotalBRL(entry.contractedUnitPriceDecimal)}</span>
              <span>{formatFormalBulletinTotalBRL(entry.lineImpactDecimal)}</span>
              <span>{formatMeasurementEconomicPercentage(entry.participationPercentage) ?? "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
