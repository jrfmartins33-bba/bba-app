import { Card } from "@bba/ui";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";

export interface MeasurementRecommendedActionsSectionProps {
  readonly nextActions: DecisionBrief["nextActions"];
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.3 — apresenta
 * `nextActions[]` na ordem exata entregue pelo builder, como seção
 * própria após Principais Decisões. Puramente descritivo -- nenhum
 * checkbox, nenhum botão que dispare a ação, nem aggregate de
 * execução; a lista de referências de origem de cada ação pertence à
 * Evidence Lineage (20.1E.6), não é lida aqui.
 *
 * Array vazio: seção omitida, mesma decisão de
 * MeasurementKeyDecisionsSection.
 */
export function MeasurementRecommendedActionsSection({ nextActions }: MeasurementRecommendedActionsSectionProps) {
  if (nextActions.length === 0) {
    return null;
  }

  return (
    <Card className="span-12 workspace-card" title="Ações Recomendadas">
      <ul className="measurement-recommended-actions-list">
        {nextActions.map((action, index) => (
          <li className="measurement-recommended-actions-list__item" key={`${index}-${action.title}`}>
            <span aria-hidden="true" className="measurement-recommended-actions-list__index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="measurement-recommended-actions-list__body">
              <p className="measurement-recommended-actions-list__title">{action.title}</p>
              <p className="measurement-recommended-actions-list__rationale">{action.rationale}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
