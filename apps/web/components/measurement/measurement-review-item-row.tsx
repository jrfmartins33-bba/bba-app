"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MeasurementBulletinReviewItem } from "@/lib/bdos/measurement-bulletin-review-service";
import { formatFormalBulletinTotalBRL } from "./measurement-bulletin-formal-status-view-model";
import { formatMeasurementReviewQuantity } from "./measurement-review-view-model";
import { MeasurementCellReference } from "./measurement-cell-reference";

export interface MeasurementReviewItemRowProps {
  readonly item: MeasurementBulletinReviewItem;
}

/**
 * "Revisar medição" — uma linha do item medido, human-first (item 3
 * da especificação: "evitar aparência de ERP"). Código/Serviço/
 * Unidade/Quantidade/Preço unitário/Valor sempre visíveis; origem
 * (arquivo-fonte/aba/linha) só sob demanda, via "Ver origem" -- nunca
 * IDs técnicos na linha principal. Reaproveita MeasurementCellReference
 * (mesmo componente do Relatório Executivo), nunca uma nova UI de
 * rastreabilidade.
 */
export function MeasurementReviewItemRow({ item }: MeasurementReviewItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOrigin = item.evidenceReferences.length > 0;

  return (
    <li className="measurement-review-item">
      <div className="measurement-review-item__row">
        <span className="measurement-review-item__code">{item.code}</span>
        <span className="measurement-review-item__description">{item.description}</span>
        <span className="measurement-review-item__unit">{item.unit}</span>
        <span className="measurement-review-item__quantity">{formatMeasurementReviewQuantity(item.quantityDecimal)}</span>
        <span className="measurement-review-item__unit-value">{formatFormalBulletinTotalBRL(item.unitValueDecimal)}</span>
        <span className="measurement-review-item__value">{formatFormalBulletinTotalBRL(item.valueDecimal)}</span>
        {hasOrigin ? (
          <button
            aria-expanded={expanded}
            className="measurement-review-item__origin-toggle"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            <ChevronDown aria-hidden="true" className="measurement-ver-mais__chevron" size={14} />
            Ver origem
          </button>
        ) : (
          <span className="measurement-review-item__origin-toggle measurement-review-item__origin-toggle--unavailable">—</span>
        )}
      </div>

      {expanded && hasOrigin ? (
        <div className="measurement-review-item__origin">
          <MeasurementCellReference evidenceReferences={item.evidenceReferences} variant="full" />
        </div>
      ) : null}
    </li>
  );
}
