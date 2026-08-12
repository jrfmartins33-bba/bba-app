import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveBudgetImportAccess } from "@/lib/bdos/budget-import-access";

export interface ProcurementCaseContextDto {
  readonly id: string;
  readonly title: string;
  readonly externalReference: string | null;
  readonly companyId: string | null;
  readonly companyName: string | null;
  readonly lots: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly externalReference: string | null;
  }>;
}

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const access = await resolveBudgetImportAccess(supabase);

  if (!access) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    // bba_admin uses service-role to read across all companies.
    // company_user uses their authenticated client — RLS enforces isolation.
    const queryClient =
      access.kind === "bba_admin" ? getSupabaseServiceRoleClient() : supabase;

    if (access.kind === "company_user") {
      // company_user: list cases/lots for their own company only.
      const companyId = access.organizationId;

      const { data: casesData, error: casesError } = await queryClient
        .from("procurement_cases")
        .select("id, title, external_reference")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (casesError) throw casesError;

      const { data: lotsData, error: lotsError } = await queryClient
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
        companyId: null,
        companyName: null,
        lots: lotsByCase.get(String(c.id)) ?? [],
      }));

      return NextResponse.json({ cases, role: "company_user" });
    }

    // bba_admin: list all cases and lots across all companies.
    // Include companyId/companyName in the DTO for disambiguation in the UI.
    const { data: casesData, error: casesError } = await queryClient
      .from("procurement_cases")
      .select("id, company_id, title, external_reference")
      .order("created_at", { ascending: false });

    if (casesError) throw casesError;

    // Collect unique company IDs to fetch company names
    const companyIds = [...new Set((casesData ?? []).map((c) => String(c.company_id)))];
    const companyNameMap = new Map<string, string>();

    if (companyIds.length > 0) {
      const { data: companiesData } = await queryClient
        .from("companies")
        .select("id, name")
        .in("id", companyIds);

      (companiesData ?? []).forEach((co) => {
        companyNameMap.set(String(co.id), String(co.name));
      });
    }

    const caseIds = (casesData ?? []).map((c) => String(c.id));
    const { data: lotsData, error: lotsError } = caseIds.length > 0
      ? await queryClient
          .from("procurement_lots")
          .select("id, procurement_case_id, title, external_reference")
          .in("procurement_case_id", caseIds)
          .order("title", { ascending: true })
      : { data: [], error: null };

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

    const cases: ProcurementCaseContextDto[] = (casesData ?? []).map((c) => {
      const cId = String(c.company_id);
      return {
        id: String(c.id),
        title: String(c.title),
        externalReference: c.external_reference ? String(c.external_reference) : null,
        companyId: cId,
        companyName: companyNameMap.get(cId) ?? null,
        lots: lotsByCase.get(String(c.id)) ?? [],
      };
    });

    return NextResponse.json({ cases, role: "bba_admin" });
  } catch (error) {
    console.error("[orcamentos/importacao/contexto] Error fetching context:", error);
    return NextResponse.json({ error: "failed_to_fetch_context" }, { status: 500 });
  }
}
