"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MeasurementReviewItemWithEconomics } from "./measurement-review-client";
import { formatFormalBulletinTotalBRL } from "./measurement-bulletin-formal-status-view-model";
import {
  formatMeasurementEconomicInterpretation,
  formatMeasurementEconomicPercentage,
  formatMeasurementReviewQuantity,
  PLANNING_COMPARISON_UNAVAILABLE_MESSAGE,
  PLANNING_UNAVAILABLE_COMPACT_LABEL
} from "./measurement-review-view-model";
import { MeasurementCellReference } from "./measurement-cell-reference";

export interface MeasurementReviewItemRowProps {
  readonly item: MeasurementReviewItemWithEconomics;
}

/**
 * "Revisar medição" — uma linha do item medido, human-first (item 3
 * da especificação original: "evitar aparência de ERP"). A tabela
 * principal permanece escaneável (Código/Serviço/Unidade/Quantidade
 * medida/Preço unitário contratado/Valor medido/Situação); toda
 * análise adicional (econômico, medição, planejamento,
 * rastreabilidade) fica atrás de um único "Ver análise" -- a origem
 * documental (antes uma ação própria) foi incorporada como a seção
 * "Rastreabilidade" dentro da mesma expansão, por sugestão explícita
 * da especificação de evolução econômica.
 */
export function MeasurementReviewItemRow({ item }: MeasurementReviewItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOrigin = item.evidenceReferences.length > 0;
  const economic = item.economicComparison;

  return (
    <li className="measurement-review-item">
      <div className="measurement-review-item__row">
        <span className="measurement-review-item__code">{item.code}</span>
        <span className="measurement-review-item__description">{item.description}</span>
        <span className="measurement-review-item__unit">{item.unit}</span>
        <span className="measurement-review-item__quantity">{formatMeasurementReviewQuantity(item.quantityDecimal)}</span>
        <span className="measurement-review-item__unit-value">{formatFormalBulletinTotalBRL(item.unitValueDecimal)}</span>
        <span className="measurement-review-item__value">{formatFormalBulletinTotalBRL(item.valueDecimal)}</span>
        <span className="measurement-review-item__situation" title={PLANNING_COMPARISON_UNAVAILABLE_MESSAGE}>
          {PLANNING_UNAVAILABLE_COMPACT_LABEL}
        </span>
        <button aria-expanded={expanded} className="measurement-review-item__analysis-toggle" onClick={() => setExpanded((current) => !current)} type="button">
          <ChevronDown aria-hidden="true" className="measurement-ver-mais__chevron" size={14} />
          Ver análise
        </button>
      </div>

      {expanded ? (
        <div className="measurement-review-item__analysis">
          {economic ? (
            <section className="measurement-review-item__analysis-block">
              <h4>Econômico</h4>
              <dl>
                <div>
                  <dt>Preço no Orçamento Oficial</dt>
                  <dd>{formatFormalBulletinTotalBRL(economic.officialUnitPriceDecimal)}</dd>
                </div>
                <div>
                  <dt>Preço contratado (Proposta Vencedora)</dt>
                  <dd>{formatFormalBulletinTotalBRL(economic.contractedUnitPriceDecimal)}</dd>
                </div>
                <div>
                  <dt>Diferença por unidade</dt>
                  <dd>{formatFormalBulletinTotalBRL(economic.unitPriceDifferenceDecimal)}</dd>
                </div>
                <div>
                  <dt>Variação %</dt>
                  <dd>{formatMeasurementEconomicPercentage(economic.unitPriceDifferencePercentage) ?? "—"}</dd>
                </div>
              </dl>
              <p className={`measurement-review-item__economic-interpretation measurement-review-item__economic-interpretation--${economic.interpretation}`}>
                {formatMeasurementEconomicInterpretation(economic.interpretation)}
              </p>
            </section>
          ) : (
            <section className="measurement-review-item__analysis-block measurement-review-item__analysis-block--muted">
              <h4>Econômico</h4>
              <p>Sem correspondência documental confiável com o Orçamento Oficial para este item.</p>
            </section>
          )}

          <section className="measurement-review-item__analysis-block">
            <h4>Medição</h4>
            <dl>
              <div>
                <dt>Quantidade medida neste período</dt>
                <dd>{formatMeasurementReviewQuantity(item.quantityDecimal)} {item.unit}</dd>
              </div>
              <div>
                <dt>Valor medido neste período</dt>
                <dd>{formatFormalBulletinTotalBRL(item.valueDecimal)}</dd>
              </div>
            </dl>
          </section>

          <section className="measurement-review-item__analysis-block measurement-review-item__analysis-block--muted">
            <h4>Planejamento físico-financeiro</h4>
            <p>{PLANNING_COMPARISON_UNAVAILABLE_MESSAGE}</p>
          </section>

          {hasOrigin ? (
            <section className="measurement-review-item__analysis-block">
              <h4>Rastreabilidade</h4>
              <MeasurementCellReference evidenceReferences={item.evidenceReferences} variant="full" />
            </section>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
