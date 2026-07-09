import { NextResponse } from "next/server";
import { ExecutionTaskBlockReason } from "@bba/bdos-core/services/execution-management";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import {
  attachExecutionTaskEvidence,
  blockExecutionTaskById,
  cancelExecutionTaskById,
  completeExecutionTaskById,
  startExecutionTaskById,
  unblockExecutionTaskById
} from "@/lib/bdos/execution-repository";

/**
 * Transições de ciclo de vida de uma ExecutionTask — cada uma delega
 * para a função pura correspondente em domain/execution-management
 * (via o repository); esta rota nunca decide se uma transição é
 * válida, só repassa o resultado ou o erro que bdos-core já decidiu
 * (ex.: completion_requires_evidence). RLS de execution_tasks
 * (company_id = get_my_company_id()) já garante que uma taskId de
 * outra empresa nunca é encontrada — sem checagem de posse duplicada
 * aqui.
 */
const BLOCK_REASONS = Object.values(ExecutionTaskBlockReason) as ReadonlyArray<string>;

type ExecutionTaskAction = "start" | "block" | "unblock" | "complete" | "cancel" | "attach-evidence";

interface PatchRequestBody {
  readonly action: ExecutionTaskAction;
  readonly reason?: string;
  readonly description?: string;
  readonly fieldEvidenceId?: string;
}

function isValidBody(body: unknown): body is PatchRequestBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Record<string, unknown>;
  const validActions: ReadonlyArray<string> = ["start", "block", "unblock", "complete", "cancel", "attach-evidence"];

  return typeof candidate.action === "string" && validActions.includes(candidate.action);
}

export async function PATCH(request: Request, context: { params: { taskId: string } }): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { taskId } = context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid_execution_task_action" }, { status: 400 });
  }

  try {
    const task = await runAction(supabase, taskId, body, auth.userId);
    return NextResponse.json({ task });
  } catch (error) {
    console.error(`[execution-tasks] Falha ao executar a ação "${body.action}" na task ${taskId}.`, error);
    const message = error instanceof Error ? error.message : "execution_task_action_failed";
    return NextResponse.json({ error: "execution_task_action_failed", message }, { status: 422 });
  }
}

async function runAction(
  supabase: ReturnType<typeof getSupabaseRouteHandlerClient>,
  taskId: string,
  body: PatchRequestBody,
  userId: string
) {
  switch (body.action) {
    case "start":
      return startExecutionTaskById(supabase, taskId, userId);
    case "unblock":
      return unblockExecutionTaskById(supabase, taskId, userId);
    case "complete":
      return completeExecutionTaskById(supabase, taskId, userId);
    case "cancel":
      return cancelExecutionTaskById(supabase, taskId, userId);
    case "block": {
      const reason = body.reason;
      const description = body.description;
      if (!reason || !BLOCK_REASONS.includes(reason) || !description) {
        throw new Error("Bloqueio exige reason (valor fechado) e description.");
      }
      return blockExecutionTaskById(supabase, taskId, { reason: reason as ExecutionTaskBlockReason, description }, userId);
    }
    case "attach-evidence": {
      const fieldEvidenceId = body.fieldEvidenceId;
      const description = body.description ?? "";
      if (!fieldEvidenceId) {
        throw new Error("attach-evidence exige fieldEvidenceId.");
      }
      return attachExecutionTaskEvidence(supabase, taskId, { fieldEvidenceId, description }, userId);
    }
  }
}
