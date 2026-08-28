"use client";

import { useState } from "react";
import { ChevronDown, ClipboardCheck, Gauge, Layers } from "lucide-react";
import type { ManagerialControlItem } from "@/lib/bdos/measurement-managerial-control-service";
import {
  formatManagerialBRL,
  formatManagerialPercent,
  formatManagerialQuantity,
  formatManagerialStatus,
  formatManagerialStatusShort,
  managerialBarWidthPercent,
  managerialStatusTone
} from "./measurement-managerial-control-view-model";
import { formatPhysicalFinancialSituation, physicalFinancialSituationTone } from "./measurement-review-view-model";

export interface MeasurementManagerialControlItemRowProps {
  readonly item: ManagerialControlItem;
}

const GROUP_NOTE = "Esta situação refere-se ao grupo do cronograma físico-financeiro, não ao item individual.";

export function MeasurementManagerialControlItemRow({ item }: MeasurementManagerialControlItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const tone = managerialStatusTone(item.status);
  const barTone = tone === "caution" ? "caution" : tone === "info" ? "info" : "neutral";
  const barWidth = managerialBarWidthPercent(item.executedPercent);
  const groupTone = item.groupContext ? physicalFinancialSituationTone(item.groupContext.situation) : "neutral";
  const bulletinNumber = item.traceability?.bulletinNumber ?? null;

  return (
    <li className="managerial-control-item">
      <div className="managerial-control-item__row">
        <span className="managerial-control-item__code">{item.code}</span>
        <span className="managerial-control-item__description" title={item.description}>
          {item.description}
        </span>
        <span className="managerial-control-item__group">{item.groupCode ?? "—"}</span>
        <span className="managerial-control-item__exec">
          <span className="managerial-control-item__exec-top">{formatManagerialPercent(item.executedPercent) ?? "—"}</span>
          <span className={`managerial-control-item__bar managerial-control-item__bar--${barTone}`} aria-hidden="true">
            <span style={{ width: `${barWidth}%` }} />
          </span>
        </span>
        <span className="managerial-control-item__value">{formatManagerialBRL(item.bdosRegisteredValueDecimal)}</span>
        <span
          className={`managerial-control-item__status managerial-control-item__status--${tone}`}
          title={formatManagerialStatus(item.status)}
        >
          {formatManagerialStatusShort(item.status)}
        </span>
        <button
          aria-expanded={expanded}
          className="managerial-control-item__toggle"
          onClick={() => setExpanded((c) => !c)}
          type="button"
        >
          <ChevronDown aria-hidden="true" className="measurement-ver-mais__chevron" size={14} />
          Ver análise
        </button>
      </div>

      {expanded ? (
        <div className="managerial-control-item__expanded">
          <div className="managerial-control-item__analysis">
            <section className="managerial-control-item__block">
              <div className="managerial-control-item__block-head">
                <ClipboardCheck aria-hidden="true" size={14} />
                <h4>Contrato</h4>
              </div>
              <dl className="managerial-control-item__primary">
                <dt>Valor contratual do item</dt>
                <dd>{formatManagerialBRL(item.contractedValueDecimal)}</dd>
              </dl>
              <dl className="managerial-control-item__kv">
                <div>
                  <dt>Quantidade contratada</dt>
                  <dd>
                    {formatManagerialQuantity(item.contractQuantityDecimal)} {item.unit ?? ""}
                  </dd>
                </div>
                <div>
                  <dt>Preço unitário</dt>
                  <dd>{formatManagerialBRL(item.unitPriceDecimal)}</dd>
                </div>
                <div>
                  <dt>Grupo do cronograma</dt>
                  <dd>
                    {item.groupCode ?? "—"}
                    {item.groupName ? ` · ${item.groupName}` : ""}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="managerial-control-item__block managerial-control-item__block--exec">
              <div className="managerial-control-item__block-head">
                <Gauge aria-hidden="true" size={14} />
                <h4>Execução</h4>
              </div>
              <dl className="managerial-control-item__primary">
                <dt>Acumulado registrado no sistema</dt>
                <dd>{formatManagerialBRL(item.bdosRegisteredValueDecimal)}</dd>
              </dl>
              <dl className="managerial-control-item__kv">
                <div>
                  <dt>Medido no período (BM {bulletinNumber ?? "atual"})</dt>
                  <dd>
                    {item.periodQuantityDecimal !== null
                      ? `${formatManagerialQuantity(item.periodQuantityDecimal)} ${item.unit ?? ""} · ${formatManagerialBRL(
                          item.periodValueDecimal ?? "0.00"
                        )}`
                      : "Sem medição neste período"}
                  </dd>
                </div>
                <div>
                  <dt>Quantidade registrada</dt>
                  <dd>
                    {formatManagerialQuantity(item.bdosRegisteredQuantityDecimal)} {item.unit ?? ""}
                  </dd>
                </div>
                <div>
                  <dt>% da quantidade contratada</dt>
                  <dd>
                    {formatManagerialPercent(item.executedPercent) ?? "—"}
                    {item.status === "above_contract_quantity" ? (
                      <span className="managerial-control-item__muted"> · acima da base contratual atual</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Saldo de quantidade</dt>
                  <dd>
                    {formatManagerialQuantity(item.quantityBalanceDecimal)} {item.unit ?? ""}
                  </dd>
                </div>
                <div>
                  <dt>Saldo financeiro contratual</dt>
                  <dd>{formatManagerialBRL(item.financialBalanceDecimal)}</dd>
                </div>
                <div>
                  <dt>Certificado (posição registrada)</dt>
                  <dd>
                    {formatManagerialBRL(item.certifiedAccumulatedValueDecimal)}{" "}
                    <span className="managerial-control-item__muted">· nenhuma certificação histórica registrada</span>
                  </dd>
                </div>
                <div>
                  <dt>Situação</dt>
                  <dd>
                    <span className={`managerial-control-item__status managerial-control-item__status--${tone}`}>
                      {formatManagerialStatus(item.status)}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="managerial-control-item__note">
                Histórico acumulado item a item ainda não importado — o sistema registra até aqui apenas o BM{" "}
                {bulletinNumber ?? "atual"}.
              </p>
            </section>

            {item.groupContext ? (
              <section
                className={`managerial-control-item__block managerial-control-item__block--group-${groupTone}`}
              >
                <div className="managerial-control-item__block-head">
                  <Layers aria-hidden="true" size={14} />
                  <h4>Contexto do grupo</h4>
                </div>
                <dl className="managerial-control-item__primary">
                  <dt>Situação do grupo</dt>
                  <dd>{formatPhysicalFinancialSituation(item.groupContext.situation)}</dd>
                </dl>
                <p className="managerial-control-item__group-heading">
                  Grupo{" "}
                  <strong>
                    {item.groupContext.groupCode} — {item.groupContext.groupName}
                  </strong>
                </p>
                <dl className="managerial-control-item__kv">
                  <div>
                    <dt>Planejado acumulado do grupo</dt>
                    <dd>{formatManagerialBRL(item.groupContext.plannedAccumulatedValueDecimal)}</dd>
                  </div>
                  <div>
                    <dt>Realizado acumulado do grupo</dt>
                    <dd>{formatManagerialBRL(item.groupContext.actualAccumulatedValueDecimal)}</dd>
                  </div>
                </dl>
                <p className="managerial-control-item__note">{GROUP_NOTE}</p>
              </section>
            ) : (
              <section className="managerial-control-item__block managerial-control-item__block--muted">
                <div className="managerial-control-item__block-head">
                  <Layers aria-hidden="true" size={14} />
                  <h4>Contexto do grupo</h4>
                </div>
                <p>Sem grupo físico-financeiro identificado para este item.</p>
              </section>
            )}
          </div>

          {item.traceability ? (
            <div className="managerial-control-item__source-footer">
              <button
                aria-expanded={sourceExpanded}
                className="managerial-control-item__source-toggle"
                onClick={() => setSourceExpanded((c) => !c)}
                type="button"
              >
                <ChevronDown aria-hidden="true" className="measurement-ver-mais__chevron" size={12} />
                {sourceExpanded ? "Ocultar fonte documental" : "Ver fonte documental"}
              </button>
              {sourceExpanded ? (
                <p className="managerial-control-item__source-detail">
                  BM nº {item.traceability.bulletinNumber ?? "—"}
                  {item.traceability.periodLabel ? ` · ${item.traceability.periodLabel}` : ""} · aba{" "}
                  {item.traceability.sheetName} · linha {item.traceability.row}
                  {item.traceability.columns.length > 0
                    ? ` · ${item.traceability.columns.length === 1 ? "coluna" : "colunas"} ${item.traceability.columns.join(", ")}`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
