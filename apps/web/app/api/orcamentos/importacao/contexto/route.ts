import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";

export interface ProcurementCaseContextDto {
  readonly id: string;
  readonly title: string;
  readonly externalReference: string | null;
  readonly lots: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly externalReference: string | null;
  }>;
}

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { companyId } = auth;

  try {
    const { data: casesData, error: casesError } = await supabase
      .from("procurement_cases")
      .select("id, title, external_reference")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (casesError) throw casesError;

    const { data: lotsData, error: lotsError } = await supabase
      .from("procurement_lots")
      .select("id, procurement_case_id, title, external_reference")
      .eq("company_id", companyId)
      .order("title", { ascending: true });

    if (lotsError) throw lotsError;

    const lotsByCase = new Map<string, Array<{ id: string; title: string; externalReference: string | null }>>();
    (lotsData ?? []).forEach((lot) => {
      const caseId = String(lot.procurement_case_id);
      const list = lotsByCase.get(caseId) ?? [];
      list.push({
        id: String(lot.id),
        title: String(lot.title),
        externalReference: lot.external_reference ? String(lot.external_reference) : null,
      });
      lotsByCase.set(caseId, list);
    });

    const cases: ProcurementCaseContextDto[] = (casesData ?? []).map((c) => ({
      id: String(c.id),
      title: String(c.title),
      externalReference: c.external_reference ? String(c.external_reference) : null,
      lots: lotsByCase.get(String(c.id)) ?? [],
    }));

    return NextResponse.json({ cases });
  } catch (error) {
    console.error("[orcamentos/importacao/contexto] Error fetching context:", error);
    return NextResponse.json({ error: "failed_to_fetch_context" }, { status: 500 });
  }
}
