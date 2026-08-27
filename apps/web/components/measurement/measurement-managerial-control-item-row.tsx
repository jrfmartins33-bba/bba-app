"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ManagerialControlItem } from "@/lib/bdos/measurement-managerial-control-service";
import {
  formatManagerialBRL,
  formatManagerialPercent,
  formatManagerialQuantity,
  formatManagerialStatus,
  formatManagerialStatusShort,
  managerialStatusTone
} from "./measurement-managerial-control-view-model";
import { formatPhysicalFinancialSituation } from "./measurement-review-view-model";

export interface MeasurementManagerialControlItemRowProps {
  readonly item: ManagerialControlItem;
}

const GROUP_NOTE = "Esta situação refere-se ao grupo do cronograma físico-financeiro, não ao item individual.";

export function MeasurementManagerialControlItemRow({ item }: MeasurementManagerialControlItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const tone = managerialStatusTone(item.status);

  return (
    <li className="managerial-control-item">
      <div className="managerial-control-item__row">
        <span className="managerial-control-item__code">{item.code}</span>
        <span className="managerial-control-item__description">{item.description}</span>
        <span className="managerial-control-item__group">{item.groupCode ?? "—"}</span>
        <span className="managerial-control-item__unit">{item.unit ?? "—"}</span>
        <span className="managerial-control-item__qty">{formatManagerialQuantity(item.contractQuantityDecimal)}</span>
        <span className="managerial-control-item__qty">{formatManagerialQuantity(item.bdosRegisteredQuantityDecimal)}</span>
        <span className="managerial-control-item__pct">{formatManagerialPercent(item.executedPercent) ?? "—"}</span>
        <span className="managerial-control-item__qty">{formatManagerialQuantity(item.quantityBalanceDecimal)}</span>
        <span className="managerial-control-item__value">{formatManagerialBRL(item.bdosRegisteredValueDecimal)}</span>
        <span className={`managerial-control-item__status managerial-control-item__status--${tone}`} title={formatManagerialStatus(item.status)}>
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
        <div className="managerial-control-item__analysis">
          <section className="managerial-control-item__block">
            <h4>Contrato</h4>
            <dl>
              <div>
                <dt>Quantidade contratada</dt>
                <dd>{formatManagerialQuantity(item.contractQuantityDecimal)} {item.unit ?? ""}</dd>
              </div>
              <div>
                <dt>Preço unitário contratado</dt>
                <dd>{formatManagerialBRL(item.unitPriceDecimal)}</dd>
              </div>
              <div>
                <dt>Valor contratual do item</dt>
                <dd>{formatManagerialBRL(item.contractedValueDecimal)}</dd>
              </div>
            </dl>
          </section>

          <section className="managerial-control-item__block">
            <h4>Execução</h4>
            <dl>
              <div>
                <dt>Medido no período (BM atual)</dt>
                <dd>
                  {item.periodQuantityDecimal !== null
                    ? `${formatManagerialQuantity(item.periodQuantityDecimal)} ${item.unit ?? ""} · ${formatManagerialBRL(item.periodValueDecimal ?? "0.00")}`
                    : "Sem medição neste período"}
                </dd>
              </div>
              <div>
                <dt>Acumulado registrado no sistema</dt>
                <dd>
                  {formatManagerialQuantity(item.bdosRegisteredQuantityDecimal)} {item.unit ?? ""} ·{" "}
                  {formatManagerialBRL(item.bdosRegisteredValueDecimal)}
                </dd>
              </div>
              <div>
                <dt>Certificado (posição registrada)</dt>
                <dd>
                  {formatManagerialBRL(item.certifiedAccumulatedValueDecimal)}
                  {" — "}
                  <span className="managerial-control-item__muted">nenhuma certificação histórica registrada</span>
                </dd>
              </div>
              <div>
                <dt>Saldo de quantidade</dt>
                <dd>{formatManagerialQuantity(item.quantityBalanceDecimal)} {item.unit ?? ""}</dd>
              </div>
              <div>
                <dt>Saldo financeiro contratual</dt>
                <dd>{formatManagerialBRL(item.financialBalanceDecimal)}</dd>
              </div>
              <div>
                <dt>% da quantidade contratada (registrado)</dt>
                <dd>
                  {formatManagerialPercent(item.executedPercent) ?? "—"}
                  {item.status === "above_contract_quantity" ? (
                    <span className="managerial-control-item__muted"> — quantidade acumulada acima da base contratual atual.</span>
                  ) : null}
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
              Histórico acumulado item a item (MED-01…MED-07) ainda não importado — o sistema registra até aqui apenas o BM{" "}
              {item.traceability?.bulletinNumber ?? ""}.
            </p>
          </section>

          {item.groupContext ? (
            <section className="managerial-control-item__block">
              <h4>Contexto do grupo</h4>
              <p className="managerial-control-item__group-heading">
                Grupo <strong>{item.groupContext.groupCode} — {item.groupContext.groupName}</strong>
              </p>
              <dl>
                <div>
                  <dt>Planejado acumulado do grupo</dt>
                  <dd>{formatManagerialBRL(item.groupContext.plannedAccumulatedValueDecimal)}</dd>
                </div>
                <div>
                  <dt>Realizado acumulado do grupo</dt>
                  <dd>{formatManagerialBRL(item.groupContext.actualAccumulatedValueDecimal)}</dd>
                </div>
                <div>
                  <dt>Situação do grupo</dt>
                  <dd>{formatPhysicalFinancialSituation(item.groupContext.situation)}</dd>
                </div>
              </dl>
              <p className="managerial-control-item__note">{GROUP_NOTE}</p>
            </section>
          ) : (
            <section className="managerial-control-item__block managerial-control-item__block--muted">
              <h4>Contexto do grupo</h4>
              <p>Sem grupo físico-financeiro identificado para este item.</p>
            </section>
          )}

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
                  {item.traceability.periodLabel ? ` · ${item.traceability.periodLabel}` : ""} · aba {item.traceability.sheetName} · linha{" "}
                  {item.traceability.row}
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
