import { Card } from "@bba/ui";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";

export interface MeasurementSummarySectionProps {
  readonly keyMetrics: DecisionBrief["keyMetrics"];
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.5 — apresenta
 * `keyMetrics[]` na ordem exata entregue pelo builder. Sem view model
 * próprio: o contrato só tem `label`/`value`, ambos string, sem enum a
 * traduzir e sem ícone a escolher -- nenhuma abstração extra foi
 * criada para uma passagem direta de dado. Nunca soma, calcula
 * percentual ou reformata valor -- `value` já vem pronto do builder
 * (moeda, contagem ou texto, indistintos no tipo).
 *
 * Diferente de Principais Decisões/Ações Recomendadas, a seção nunca
 * é omitida quando vazia -- faz parte da hierarquia estrutural fixa do
 * Relatório Executivo.
 */
export function MeasurementSummarySection({ keyMetrics }: MeasurementSummarySectionProps) {
  return (
    <Card className="span-12 workspace-card" title="Medições">
      <p className="workspace-card__description">Principais informações quantitativas consideradas na análise.</p>

      {keyMetrics.length === 0 ? (
        <p className="measurement-summary-empty">Nenhuma métrica executiva disponível para esta análise.</p>
      ) : (
        <dl className="measurement-summary-list">
          {keyMetrics.map((metric, index) => (
            <div className="measurement-summary-list__row" key={`${index}-${metric.label}`}>
              <dt className="measurement-summary-list__label">{metric.label}</dt>
              <dd className="measurement-summary-list__value">{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
