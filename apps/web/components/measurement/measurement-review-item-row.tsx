"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MeasurementReviewItemWithEconomics } from "./measurement-review-client";
import { formatFormalBulletinTotalBRL } from "./measurement-bulletin-formal-status-view-model";
import {
  formatDeviationBRL,
  formatGroupSituationBadge,
  formatMeasurementEconomicInterpretationSentence,
  formatMeasurementEconomicPercentage,
  formatMeasurementReviewQuantity,
  formatPercentPoints,
  formatPhysicalFinancialSituation,
  physicalFinancialSituationTone,
  GROUP_SITUATION_ITEM_NOTE,
  PLANNING_COMPARISON_UNAVAILABLE_MESSAGE,
  PLANNING_UNAVAILABLE_COMPACT_LABEL
} from "./measurement-review-view-model";
import { MeasurementCellReference } from "./measurement-cell-reference";

export interface MeasurementReviewItemRowProps {
  readonly item: MeasurementReviewItemWithEconomics;
  /** Contexto do topo da tela -- para distinguir "sem grupo correspondente" de "cronograma indisponível". */
  readonly groupsAvailable: boolean;
  readonly groupsUnavailableReason: string | null;
}

/**
 * "Revisar medição" — uma linha do item medido, human-first (item 3
 * da especificação original: "evitar aparência de ERP"). A tabela
 * principal permanece escaneável; "Ver análise" abre TRÊS blocos —
 * Econômico, Medição, Planejamento físico-financeiro do grupo — e a
 * fonte documental fica discreta no rodapé da expansão ("Ver fonte
 * documental"), não mais como um card grande de "Rastreabilidade".
 */
export function MeasurementReviewItemRow({ item, groupsAvailable, groupsUnavailableReason }: MeasurementReviewItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const hasOrigin = item.evidenceReferences.length > 0;
  const economic = item.economicComparison;
  const group = item.physicalFinancialGroup;

  return (
    <li className="measurement-review-item">
      <div className="measurement-review-item__row">
        <span className="measurement-review-item__code">{item.code}</span>
        <span className="measurement-review-item__description">{item.description}</span>
        <span className="measurement-review-item__unit">{item.unit}</span>
        <span className="measurement-review-item__quantity">{formatMeasurementReviewQuantity(item.quantityDecimal)}</span>
        <span className="measurement-review-item__unit-value">{formatFormalBulletinTotalBRL(item.unitValueDecimal)}</span>
        <span className="measurement-review-item__value">{formatFormalBulletinTotalBRL(item.valueDecimal)}</span>
        {group ? (
          <span
            className={`measurement-review-item__situation measurement-review-item__situation--${physicalFinancialSituationTone(group.situation)}`}
            title={`${GROUP_SITUATION_ITEM_NOTE} (${group.groupCode} — ${group.groupName})`}
          >
            {formatGroupSituationBadge(group.situation)}
          </span>
        ) : (
          <span className="measurement-review-item__situation" title={PLANNING_COMPARISON_UNAVAILABLE_MESSAGE}>
            {PLANNING_UNAVAILABLE_COMPACT_LABEL}
          </span>
        )}
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

              <div className="measurement-review-item__economic-subblock">
                <h5>Contratação</h5>
                <dl>
                  <div>
                    <dt>Orçamento Oficial</dt>
                    <dd>{formatFormalBulletinTotalBRL(economic.officialUnitPriceDecimal)}</dd>
                  </div>
                  <div>
                    <dt>Proposta Vencedora</dt>
                    <dd>{formatFormalBulletinTotalBRL(economic.contractedUnitPriceDecimal)}</dd>
                  </div>
                  <div>
                    <dt>Redução unitária na contratação</dt>
                    <dd>{formatFormalBulletinTotalBRL(economic.unitPriceDifferenceDecimal)}</dd>
                  </div>
                  <div>
                    <dt>Deságio</dt>
                    <dd>{formatMeasurementEconomicPercentage(economic.unitPriceDifferencePercentage) ?? "—"}</dd>
                  </div>
                </dl>
                <p
                  className={`measurement-review-item__economic-interpretation measurement-review-item__economic-interpretation--${economic.interpretation}`}
                >
                  {formatMeasurementEconomicInterpretationSentence(economic.interpretation, economic.unitPriceDifferencePercentage)}
                </p>
              </div>

              <div className="measurement-review-item__economic-subblock measurement-review-item__economic-subblock--muted">
                <h5>Resultado da execução</h5>
                <p>Resultado econômico da execução ainda não disponível.</p>
                <p className="measurement-review-item__analysis-block-note">A apuração de ganho ou perda depende da integração dos custos reais da execução.</p>
              </div>
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

          {group ? (
            <section className="measurement-review-item__analysis-block">
              <h4>Planejamento físico-financeiro</h4>
              <p className="measurement-review-item__group-heading">
                Grupo <strong>{group.groupCode} — {group.groupName}</strong>
              </p>
              <dl>
                <div>
                  <dt>Planejado acumulado</dt>
                  <dd>
                    {formatFormalBulletinTotalBRL(group.plannedAccumulatedValueDecimal)}
                    {group.plannedAccumulatedPercent ? ` · ${formatPercentPoints(group.plannedAccumulatedPercent)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Realizado acumulado</dt>
                  <dd>
                    {formatFormalBulletinTotalBRL(group.actualAccumulatedValueDecimal)}
                    {group.actualAccumulatedPercent ? ` · ${formatPercentPoints(group.actualAccumulatedPercent)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Desvio</dt>
                  <dd>
                    {formatDeviationBRL(group.deviationValueDecimal)}
                    {group.deviationPercentPoints ? ` · ${formatPercentPoints(group.deviationPercentPoints, { asPoints: true })}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Situação do grupo</dt>
                  <dd>
                    <span
                      className={`measurement-review-item__group-situation measurement-review-item__group-situation--${physicalFinancialSituationTone(group.situation)}`}
                    >
                      {formatPhysicalFinancialSituation(group.situation)}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="measurement-review-item__analysis-block-note">{GROUP_SITUATION_ITEM_NOTE}</p>
            </section>
          ) : (
            <section className="measurement-review-item__analysis-block measurement-review-item__analysis-block--muted">
              <h4>Planejamento físico-financeiro</h4>
              <p>
                {groupsAvailable
                  ? "Este item não tem grupo correspondente no cronograma físico-financeiro."
                  : groupsUnavailableReason ?? PLANNING_COMPARISON_UNAVAILABLE_MESSAGE}
              </p>
            </section>
          )}

          {hasOrigin ? (
            <div className="measurement-review-item__source-footer">
              <button
                aria-expanded={sourceExpanded}
                className="measurement-review-item__source-toggle"
                onClick={() => setSourceExpanded((current) => !current)}
                type="button"
              >
                <ChevronDown aria-hidden="true" className="measurement-ver-mais__chevron" size={12} />
                {sourceExpanded ? "Ocultar fonte documental" : "Ver fonte documental"}
              </button>
              {sourceExpanded ? (
                <div className="measurement-review-item__source-detail">
                  <MeasurementCellReference evidenceReferences={item.evidenceReferences} variant="full" />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
