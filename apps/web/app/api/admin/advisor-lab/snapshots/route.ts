import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireBbaAdmin } from "@/lib/supabase/server";
import { listDecisionSnapshotsForProject } from "@/lib/bdos/advisor-lab-repository";

// Advisor Lab (Sprint 14.2A) — read-only, admin-only.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const admin = await requireBbaAdmin(supabase);

  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const engineeringProjectId = new URL(request.url).searchParams.get("engineeringProjectId");

  if (!engineeringProjectId) {
    return NextResponse.json({ error: "missing_engineering_project_id" }, { status: 400 });
  }

  try {
    const snapshots = await listDecisionSnapshotsForProject(supabase, engineeringProjectId);
    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("[advisor-lab] Falha ao listar snapshots.", error);
    return NextResponse.json({ error: "snapshots_failed" }, { status: 500 });
  }
}
