import { NextResponse } from "next/server";
import { simulateScheduleDelay } from "@bba/bdos-core/services/bba-project-import";
import type { SimulateScheduleDelayInput } from "@bba/bdos-core/services/bba-project-import";

/**
 * BBA Project Studio — Sprint 1, Living Schedule (PARTE 11). Recebe de
 * volta as atividades que o cliente já tem em memória (a resposta da
 * importação), simula um atraso e devolve o cronograma/caminho
 * crítico/curva S recalculados — sem persistência, sem nenhuma
 * Decision/Recommendation nova.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { activities?: unknown }).activities) ||
    typeof (body as { activityId?: unknown }).activityId !== "string" ||
    typeof (body as { delayDays?: unknown }).delayDays !== "number" ||
    typeof (body as { asOfDate?: unknown }).asOfDate !== "string"
  ) {
    return NextResponse.json({ error: "invalid_simulate_delay_body" }, { status: 400 });
  }

  const input = body as SimulateScheduleDelayInput;

  const result = simulateScheduleDelay({
    activities: input.activities,
    activityId: input.activityId,
    delayDays: input.delayDays,
    asOfDate: input.asOfDate,
  });

  return NextResponse.json(result);
}
