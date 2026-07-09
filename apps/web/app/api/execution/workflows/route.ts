import { NextResponse } from "next/server";
import type { ActionPlan } from "@bba/bdos-core/services/execution-management";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { getEngineeringAdvisorBriefing } from "@/lib/bdos/advisor";
import { createExecutionWorkflowAndTasks, listExecutionWorkflows } from "@/lib/bdos/execution-repository";

/**
 * Execution Engine (Epic 16, Fase 16.5) — repository/API mínima para
 * expor ExecutionWorkflow/ExecutionTask, sem contaminar o domínio:
 * toda regra de negócio continua em bdos-core
 * (createExecutionWorkflowFromActionPlan, 16.4); esta rota só resolve
 * a empresa/projeto autenticados e delega ao repository.
 *
 * Fase 1 assume uma única engineering_project ativa por empresa (mesma
 * limitação já documentada em /api/copilot/message) — por isso GET
 * não recebe engineeringProjectId como parâmetro, resolve via
 * getEngineeringAdvisorBriefing.
 *
 * ATENÇÃO — POST depende de um ActionPlan REAL, que hoje o BDOS não
 * persiste nem expõe de forma geral: `decision_snapshots` só grava
 * `decisions`/`recommendations` (JSONB); `buildActionPlans`
 * (engines/decision/action-plan-builder.ts) só está de fato ligado ao
 * caso "Cash Protection Playbook", não ao fluxo geral de
 * Recommendation que o Advisor/Copilot usam. Até essa lacuna ser
 * resolvida (Epic 16.6 — "ActionPlan Materialization Boundary"), esta
 * rota só pode ser exercitada com um ActionPlan sintético/de teste —
 * não é uma rota pronta para o Workflow Handoff real do Copilot (16.7)
 * ainda chamar.
 */
export const dynamic = "force-dynamic";

interface CreateExecutionWorkflowRequestBody {
  readonly actionPlan: ActionPlan;
  readonly scheduleActivityIdByActionId?: Readonly<Record<string, string>>;
}

function isValidRequestBody(body: unknown): body is CreateExecutionWorkflowRequestBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Record<string, unknown>;
  const actionPlan = candidate.actionPlan as Record<string, unknown> | undefined;

  return (
    typeof actionPlan === "object" &&
    actionPlan !== null &&
    typeof actionPlan.id === "string" &&
    typeof actionPlan.name === "string" &&
    Array.isArray(actionPlan.actions)
  );
}

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const briefing = await getEngineeringAdvisorBriefing(supabase, auth.companyId);

  if (!briefing.engineeringProjectId) {
    return NextResponse.json({ workflows: [] });
  }

  try {
    const workflows = await listExecutionWorkflows(supabase, briefing.engineeringProjectId);
    return NextResponse.json({ workflows });
  } catch (error) {
    console.error("[execution-workflows] Falha ao listar workflows.", error);
    return NextResponse.json({ error: "execution_workflows_list_failed" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  if (!isValidRequestBody(body)) {
    return NextResponse.json({ error: "invalid_execution_workflow_body" }, { status: 400 });
  }

  const briefing = await getEngineeringAdvisorBriefing(supabase, auth.companyId);

  if (!briefing.hasData || !briefing.engineeringProjectId || !briefing.decisionSnapshotId) {
    return NextResponse.json({ error: "no_advisor_context_available" }, { status: 409 });
  }

  try {
    const { workflow, tasks } = await createExecutionWorkflowAndTasks(supabase, {
      companyId: auth.companyId,
      engineeringProjectId: briefing.engineeringProjectId,
      decisionSnapshotId: briefing.decisionSnapshotId,
      actionPlan: body.actionPlan,
      scheduleActivityIdByActionId: body.scheduleActivityIdByActionId,
      createdBy: auth.userId
    });

    return NextResponse.json({ workflow, tasks });
  } catch (error) {
    console.error("[execution-workflows] Falha ao criar workflow a partir do ActionPlan.", error);
    return NextResponse.json({ error: "execution_workflow_creation_failed" }, { status: 500 });
  }
}
