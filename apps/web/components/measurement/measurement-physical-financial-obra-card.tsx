"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card } from "@bba/ui";
import type {
  MeasurementReviewPhysicalFinancial,
  MeasurementReviewPhysicalFinancialGroupImpact
} from "./measurement-review-client";
import { formatFormalBulletinPeriodLabel, formatFormalBulletinTotalBRL } from "./measurement-bulletin-formal-status-view-model";
import {
  formatDeviationBRL,
  formatManagementConcentration,
  formatManagementHeadline,
  formatManagementHeadlineMetrics,
  formatPercentPoints,
  formatPhysicalFinancialSituation,
  physicalFinancialSituationTone
} from "./measurement-review-view-model";

export interface MeasurementPhysicalFinancialObraCardProps {
  readonly physicalFinancial: MeasurementReviewPhysicalFinancial;
  /** rota do Controle Gerencial da Execução -- habilita "Ver itens do grupo" por linha da tabela. */
  readonly managerialControlHref?: string;
}

/**
 * Card de DECISÃO no topo da tela "Revisar medição": responde em
 * segundos "qual é a situação da obra e onde está concentrado o
 * desvio?". A leitura gerancial (headline, principal impacto,
 * concentração, contraponto positivo) vem TODA decidida do servidor
 * (`physicalFinancial.management`) -- este componente nunca soma,
 * subtrai, divide ou reclassifica nada, e nunca fala em causa/
 * responsabilidade: a fonte comprova desvio físico-financeiro, não
 * causalidade operacional.
 *
 * Cores: abaixo do previsto → amber; acima do previsto → azul/
 * informativo (nunca verde -- verde é ganho econômico real); no
 * previsto / sem programação → neutro.
 */
export function MeasurementPhysicalFinancialObraCard({ physicalFinancial, managerialControlHref }: MeasurementPhysicalFinancialObraCardProps) {
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const { obra, obraAvailable, management } = physicalFinancial;

  const periodLabel = physicalFinancial.period
    ? formatFormalBulletinPeriodLabel(physicalFinancial.period.date) ?? physicalFinancial.period.label
    : null;

  const headlineMetrics = management ? formatManagementHeadlineMetrics(management) : null;
  const concentrationText = management ? formatManagementConcentration(management) : null;

  return (
    <Card className="span-12 workspace-card measurement-physical-financial-obra" title="Situação físico-financeira da obra">
      {obraAvailable && obra ? (
        <>
          {periodLabel ? <p className="measurement-physical-financial-obra__period">Período: {periodLabel}</p> : null}

          {management ? (
            <div
              className={`measurement-physical-financial-obra__headline measurement-physical-financial-obra__headline--${
                management.headline.direction === "above" ? "info" : management.headline.direction === "below" ? "caution" : "neutral"
              }`}
            >
              <strong>{formatManagementHeadline(management)}</strong>
              {headlineMetrics ? <span className="measurement-physical-financial-obra__headline-metrics">{headlineMetrics}</span> : null}
            </div>
          ) : null}

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

          {management?.principalNegativeImpact ? (
            <GroupImpactBlock heading="Principal impacto no desvio" impact={management.principalNegativeImpact} />
          ) : null}

          {concentrationText ? <p className="measurement-physical-financial-obra__concentration">{concentrationText}</p> : null}

          {management?.positiveCounterpoint ? (
            <p className="measurement-physical-financial-obra__counterpoint">
              <span className="measurement-physical-financial-obra__counterpoint-tag">Acima do previsto</span>
              Grupo {management.positiveCounterpoint.groupCode} — {management.positiveCounterpoint.groupName}:{" "}
              {formatDeviationBRL(management.positiveCounterpoint.deviationValueDecimal)}
              {management.positiveCounterpoint.deviationPercentPoints
                ? ` · ${formatPercentPoints(management.positiveCounterpoint.deviationPercentPoints, { asPoints: true })}`
                : ""}
              . Execução físico-financeira acima do previsto — não representa ganho, economia ou margem.
            </p>
          ) : null}

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
                    <span>Participação no desvio</span>
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
                      <span>
                        {group.situation === "below_planned" && group.sharePercent
                          ? formatPercentPoints(group.sharePercent) ?? "—"
                          : "—"}
                      </span>
                      <span
                        className={`measurement-physical-financial-groups__situation measurement-physical-financial-groups__situation--${physicalFinancialSituationTone(
                          group.situation
                        )}`}
                      >
                        {formatPhysicalFinancialSituation(group.situation)}
                        {managerialControlHref ? (
                          <Link
                            className="measurement-physical-financial-groups__items-link"
                            href={`${managerialControlHref}?grupo=${encodeURIComponent(group.groupCode)}`}
                          >
                            Ver itens do grupo
                          </Link>
                        ) : null}
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

function GroupImpactBlock({ heading, impact }: { readonly heading: string; readonly impact: MeasurementReviewPhysicalFinancialGroupImpact }) {
  return (
    <section className="measurement-physical-financial-obra__impact">
      <h4>{heading}</h4>
      <p className="measurement-physical-financial-obra__impact-group">
        Grupo <strong>{impact.groupCode} — {impact.groupName}</strong>
      </p>
      <dl>
        <div>
          <dt>Planejado acumulado</dt>
          <dd>{formatFormalBulletinTotalBRL(impact.plannedAccumulatedValueDecimal)}</dd>
        </div>
        <div>
          <dt>Realizado acumulado</dt>
          <dd>{formatFormalBulletinTotalBRL(impact.actualAccumulatedValueDecimal)}</dd>
        </div>
        <div>
          <dt>Desvio</dt>
          <dd>
            {formatDeviationBRL(impact.deviationValueDecimal)}
            {impact.deviationPercentPoints ? ` · ${formatPercentPoints(impact.deviationPercentPoints, { asPoints: true })}` : ""}
          </dd>
        </div>
        <div>
          <dt>Participação no desvio da obra</dt>
          <dd>{impact.sharePercent ? formatPercentPoints(impact.sharePercent) : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
