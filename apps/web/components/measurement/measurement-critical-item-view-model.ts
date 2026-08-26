import type { DecisionBriefCriticalItem } from "@bba/bdos-core/decision-brief";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.4 — apresentação pura do
 * item crítico. Traduz `severity`; nunca recalcula, prioriza ou
 * inventa uma relação com outro campo do Brief.
 *
 * Agrupamento/formatação de `evidenceReferences` foi extraído para
 * `measurement-evidence-reference-view-model.ts` no Sprint 20.1E.6
 * (reuso pela seção de Evidências) -- mesmo comportamento, nenhuma
 * mudança visual.
 */

export interface SeverityPresentation {
  readonly label: string;
}

// Só os dois valores reais do contrato -- nenhuma severidade
// especulativa (ex.: um terceiro nível informativo não existe hoje).
const SEVERITY_PRESENTATION: Record<DecisionBriefCriticalItem["severity"], SeverityPresentation> = {
  blocking: { label: "Bloqueante" },
  warning: { label: "Ponto de atenção" }
};

export function translateSeverity(severity: DecisionBriefCriticalItem["severity"]): SeverityPresentation {
  return SEVERITY_PRESENTATION[severity];
}

/**
 * Refinamento pós-3C.2 -- rótulo do badge depende de `materiality`,
 * não só de `severity`: uma ocorrência `warning` classificada como
 * `technical_observation` nunca mostra "Ponto de atenção" (linguagem
 * de alerta que este refinamento existe para corrigir). `blocking`
 * sempre é `material` (ver classifyIssueMateriality no builder), então
 * nunca cai no ramo "Observação técnica" aqui.
 */
export function translateItemPresentation(item: Pick<DecisionBriefCriticalItem, "severity" | "materiality">): SeverityPresentation {
  if (item.materiality === "technical_observation") {
    return { label: "Observação técnica" };
  }
  return translateSeverity(item.severity);
}
