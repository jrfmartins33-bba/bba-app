import { CircleCheck } from "lucide-react";
import { Card } from "@bba/ui";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";
import { MeasurementCriticalItem } from "./measurement-critical-item";

export interface MeasurementCriticalItemsSectionProps {
  readonly criticalItems: DecisionBrief["criticalItems"];
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.4 — apresenta
 * `criticalItems[]` na ordem exata entregue pelo builder. Diferente de
 * Principais Decisões/Ações Recomendadas, um array vazio aqui tem
 * significado positivo e por isso a seção nunca é omitida -- mostra um
 * estado vazio explícito em vez de desaparecer.
 */
export function MeasurementCriticalItemsSection({ criticalItems }: MeasurementCriticalItemsSectionProps) {
  const hasItems = criticalItems.length > 0;

  return (
    <Card
      action={hasItems ? <span className="measurement-critical-items-count">{criticalItems.length} {criticalItems.length === 1 ? "item" : "itens"}</span> : undefined}
      className="span-12 workspace-card"
      title="Itens Críticos"
    >
      {hasItems ? (
        <ul className="measurement-critical-items-list">
          {criticalItems.map((item, index) => (
            <MeasurementCriticalItem index={index} item={item} key={item.id} />
          ))}
        </ul>
      ) : (
        <div className="measurement-critical-items-empty">
          <CircleCheck aria-hidden="true" size={20} />
          <p>Nenhum item crítico identificado.</p>
        </div>
      )}
    </Card>
  );
}
