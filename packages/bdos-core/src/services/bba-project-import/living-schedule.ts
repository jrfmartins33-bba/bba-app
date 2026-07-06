import { buildScheduleSCurve, calculateCriticalPath, simulateActivityDelay } from "../../domain/schedule-management";
import type { SimulateScheduleDelayInput, SimulateScheduleDelayResult } from "./living-schedule.types";

/**
 * BBA Project Studio — Sprint 1, Living Schedule (PARTE 11). Recebe de
 * volta as mesmas `ScheduleActivity[]` que a UI já tem em memória (sem
 * persistência — nada é salvo em nenhum lugar), simula um atraso e
 * recalcula caminho crítico e curva S a partir das mesmas funções
 * reais do Sprint Zero. Nenhuma Decision, Recommendation ou regra
 * nova nasce aqui — a cadeia de decisão depende de confiança
 * espacial, não de tempo, então propositalmente não muda com esta
 * simulação.
 */
export function simulateScheduleDelay(input: SimulateScheduleDelayInput): SimulateScheduleDelayResult {
  const activities = simulateActivityDelay(input.activities, input.activityId, input.delayDays);

  return {
    activities,
    criticalPath: calculateCriticalPath(activities),
    sCurve: buildScheduleSCurve(activities, input.asOfDate),
    hasDependencies: activities.some((activity) => activity.dependencies.length > 0),
  };
}
