import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { listExecutionTasks } from "@/lib/bdos/execution-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const workflowId = new URL(request.url).searchParams.get("workflowId");

  if (!workflowId) {
    return NextResponse.json({ error: "missing_workflow_id" }, { status: 400 });
  }

  try {
    const tasks = await listExecutionTasks(supabase, workflowId);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("[execution-tasks] Falha ao listar tasks.", error);
    return NextResponse.json({ error: "execution_tasks_list_failed" }, { status: 500 });
  }
}
