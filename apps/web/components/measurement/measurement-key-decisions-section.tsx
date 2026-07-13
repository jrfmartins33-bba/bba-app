import { Card } from "@bba/ui";
import type { DecisionBriefKeyDecision } from "@bba/bdos-core/decision-brief";

export interface MeasurementKeyDecisionsSectionProps {
  readonly keyDecisions: ReadonlyArray<DecisionBriefKeyDecision>;
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.3 — apresenta
 * `keyDecisions[]` na ordem exata entregue pelo builder (nunca
 * reordena; o contrato não documenta nenhuma ordenação própria).
 * `recommended` só marca visualmente qual decisão é a recomendação
 * principal -- nunca vira botão, checkbox ou ação executável.
 *
 * Array vazio: a seção inteira é omitida (não um card vazio nem uma
 * decisão genérica) -- diferente da lista de `/medicoes`, que tem
 * estado vazio próprio porque é o conteúdo principal daquela página;
 * aqui, uma seção executiva vazia ao lado do Hero pareceria quebrada,
 * não intencional.
 */
export function MeasurementKeyDecisionsSection({ keyDecisions }: MeasurementKeyDecisionsSectionProps) {
  if (keyDecisions.length === 0) {
    return null;
  }

  return (
    <Card className="span-12 workspace-card" title="Principais Decisões">
      <ol className="measurement-key-decisions-list">
        {keyDecisions.map((decision, index) => (
          <li className="measurement-key-decisions-list__item" key={`${index}-${decision.label}`}>
            <span
              className={
                decision.recommended
                  ? "measurement-key-decisions-list__tag"
                  : "measurement-key-decisions-list__tag measurement-key-decisions-list__tag--alt"
              }
            >
              {decision.recommended ? "Recomendação principal" : "Alternativa"}
            </span>
            <p className="measurement-key-decisions-list__label">{decision.label}</p>
            <p className="measurement-key-decisions-list__rationale">{decision.rationale}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
