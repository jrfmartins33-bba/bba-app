import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireBbaAdmin } from "@/lib/supabase/server";
import { listEngineeringProjectsForLab } from "@/lib/bdos/advisor-lab-repository";

// Advisor Lab (Sprint 14.2A) — read-only, admin-only. Ver route.ts de
// /api/admin/advisor-lab/run para o fluxo completo.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const admin = await requireBbaAdmin(supabase);

  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const projects = await listEngineeringProjectsForLab(supabase);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[advisor-lab] Falha ao listar projetos.", error);
    return NextResponse.json({ error: "projects_failed" }, { status: 500 });
  }
}
