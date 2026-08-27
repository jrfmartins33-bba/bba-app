"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@bba/ui";
import type { MeasurementReviewPhysicalFinancial } from "./measurement-review-client";
import { formatFormalBulletinPeriodLabel, formatFormalBulletinTotalBRL } from "./measurement-bulletin-formal-status-view-model";
import {
  formatDeviationBRL,
  formatPercentPoints,
  formatPhysicalFinancialSituation,
  physicalFinancialSituationTone
} from "./measurement-review-view-model";

export interface MeasurementPhysicalFinancialObraCardProps {
  readonly physicalFinancial: MeasurementReviewPhysicalFinancial;
}

/**
 * Topo da tela "Revisar medição" — responde em segundos: a obra está
 * acima, dentro ou abaixo do previsto? Tudo já vem decidido do
 * servidor (situação determinística, valores canônicos em centavos);
 * este componente nunca soma, subtrai ou reclassifica nada.
 *
 * O realizado exibido é o DECLARADO na Curva S importada — fonte
 * documental daquele arquivo, não o acumulado de medições do BDOS.
 * Fonte insuficiente cai para o motivo textual, nunca para um número
 * inventado.
 */
export function MeasurementPhysicalFinancialObraCard({ physicalFinancial }: MeasurementPhysicalFinancialObraCardProps) {
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const { obra, obraAvailable } = physicalFinancial;

  const periodLabel = physicalFinancial.period
    ? formatFormalBulletinPeriodLabel(physicalFinancial.period.date) ?? physicalFinancial.period.label
    : null;

  return (
    <Card className="span-12 workspace-card measurement-physical-financial-obra" title="Situação físico-financeira da obra">
      {obraAvailable && obra ? (
        <>
          {periodLabel ? <p className="measurement-physical-financial-obra__period">Período: {periodLabel}</p> : null}

          <dl className="workspace-fact-list measurement-physical-financial-obra__facts">
            <div className="workspace-fact">
              <dt>Planejado acumulado</dt>
              <dd>
                {formatFormalBulletinTotalBRL(obra.plannedAccumulatedValueDecimal)}
                {obra.plannedAccumulatedPercent ? ` · ${formatPercentPoints(obra.plannedAccumulatedPercent)}` : ""}
              </dd>
            </div>
            <div className="workspace-fact">
              <dt>Realizado acumulado</dt>
              <dd>
                {formatFormalBulletinTotalBRL(obra.actualAccumulatedValueDecimal)}
                {obra.actualAccumulatedPercent ? ` · ${formatPercentPoints(obra.actualAccumulatedPercent)}` : ""}
              </dd>
            </div>
            <div className="workspace-fact">
              <dt>Desvio (R$)</dt>
              <dd>{formatDeviationBRL(obra.deviationValueDecimal)}</dd>
            </div>
            <div className="workspace-fact">
              <dt>Desvio (p.p.)</dt>
              <dd>{formatPercentPoints(obra.deviationPercentPoints, { asPoints: true }) ?? "—"}</dd>
            </div>
            <div className="workspace-fact">
              <dt>Situação</dt>
              <dd>
                <span
                  className={`measurement-physical-financial-obra__situation measurement-physical-financial-obra__situation--${physicalFinancialSituationTone(
                    obra.situation
                  )}`}
                >
                  {formatPhysicalFinancialSituation(obra.situation)}
                </span>
              </dd>
            </div>
          </dl>

          {physicalFinancial.sourceFileName ? (
            <p className="measurement-physical-financial-obra__source">
              Fonte: {physicalFinancial.sourceFileName}
              {physicalFinancial.sourceSheetName ? ` · aba ${physicalFinancial.sourceSheetName}` : ""}
            </p>
          ) : null}

          {physicalFinancial.groupsAvailable && physicalFinancial.groups.length > 0 ? (
            <>
              <button
                aria-expanded={groupsExpanded}
                className="measurement-ver-mais"
                onClick={() => setGroupsExpanded((current) => !current)}
                type="button"
              >
                <ChevronDown aria-hidden="true" className="measurement-ver-mais__chevron" size={14} />
                {groupsExpanded ? "Ocultar situação por grupo" : "Ver situação por grupo"}
              </button>

              {groupsExpanded ? (
                <ul className="measurement-physical-financial-groups">
                  <li
                    className="measurement-physical-financial-groups__row measurement-physical-financial-groups__row--head"
                    aria-hidden="true"
                  >
                    <span>Grupo</span>
                    <span>Planejado acumulado</span>
                    <span>Realizado acumulado</span>
                    <span>Desvio</span>
                    <span>Situação</span>
                  </li>
                  {physicalFinancial.groups.map((group) => (
                    <li className="measurement-physical-financial-groups__row" key={group.groupCode}>
                      <span>
                        {group.groupCode} — {group.groupName}
                      </span>
                      <span>
                        {formatFormalBulletinTotalBRL(group.plannedAccumulatedValueDecimal)}
                        {group.plannedAccumulatedPercent ? ` · ${formatPercentPoints(group.plannedAccumulatedPercent)}` : ""}
                      </span>
                      <span>
                        {formatFormalBulletinTotalBRL(group.actualAccumulatedValueDecimal)}
                        {group.actualAccumulatedPercent ? ` · ${formatPercentPoints(group.actualAccumulatedPercent)}` : ""}
                      </span>
                      <span>
                        {formatDeviationBRL(group.deviationValueDecimal)}
                        {group.deviationPercentPoints ? ` · ${formatPercentPoints(group.deviationPercentPoints, { asPoints: true })}` : ""}
                      </span>
                      <span
                        className={`measurement-physical-financial-groups__situation measurement-physical-financial-groups__situation--${physicalFinancialSituationTone(
                          group.situation
                        )}`}
                      >
                        {formatPhysicalFinancialSituation(group.situation)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : physicalFinancial.groupsUnavailableReason ? (
            <p className="measurement-physical-financial-obra__groups-note">{physicalFinancial.groupsUnavailableReason}</p>
          ) : null}

          {physicalFinancial.adjustments.length > 0 ? (
            <p className="measurement-physical-financial-obra__adjustments">
              Linhas de ajuste financeiro/documental (fora dos grupos físicos):{" "}
              {physicalFinancial.adjustments.map((row) => row.name).join("; ")}.
            </p>
          ) : null}
        </>
      ) : (
        <p className="workspace-card__description">
          {physicalFinancial.obraUnavailableReason ?? "Comparação com o cronograma físico-financeiro ainda não disponível."}
        </p>
      )}
    </Card>
  );
}
