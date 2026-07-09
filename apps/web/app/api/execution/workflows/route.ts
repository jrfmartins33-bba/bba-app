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
 * ATENÇÃO — POST espera um ActionPlan já pronto no corpo da
 * requisição; quem o constrói é responsabilidade do chamador. Desde o
 * Epic 16.6 (buildPlaybooks/buildActionPlans generalizados,
 * ACTIONPLAN_MATERIALIZATION_BOUNDARY.md), qualquer Recommendation real
 * já produz um ActionPlan real — mas o Workflow Handoff do Decision
 * Copilot (Epic 16.7, COPILOT_WORKFLOW_HANDOFF.md) NÃO chama esta
 * rota: ele usa `POST /api/copilot/message` com
 * `approveRecommendationId` (materializeExecutionWorkflowFromRecommendation,
 * 16.6C, direto), porque a aprovação exige persistir
 * execution_workflows/execution_tasks/copilot_messages numa única
 * transação (approve_copilot_recommendation, migration
 * 20260709130000) — algo que esta rota, de propósito, não faz. Esta
 * rota continua existindo para qualquer outro consumidor que já tenha
 * um ActionPlan pronto e não precise dessa atomicidade cruzando o
 * Copilot.
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
