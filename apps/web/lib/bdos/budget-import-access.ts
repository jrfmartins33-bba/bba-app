/**
 * Budget Import Access Resolver
 *
 * Central authentication/authorization helper for the BDOS budget import flow.
 * Resolves the caller's role and, when applicable, their organizationId without
 * ever trusting a value sent by the browser.
 *
 * Two valid actor kinds:
 *
 *   company_user — authenticated user with profiles.company_id set.
 *                  organizationId is derived from the profile, never from the
 *                  request body.
 *
 *   bba_admin    — authenticated user with profiles.role = 'bba_admin' and
 *                  NO profiles.company_id. organizationId must be derived
 *                  server-side from the selected ProcurementCase.
 *
 * Multi-tenant isolation guarantee:
 *   company_user access is NEVER weakened — they only see their own company.
 *   Cross-company access is exclusively granted to bba_admin.
 *
 * *** SERVER-ONLY — NEVER IMPORT FROM CLIENT CODE ***
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type BudgetImportActorKind = "company_user" | "bba_admin";

export interface BudgetImportAccessCompanyUser {
  readonly kind: "company_user";
  readonly userId: string;
  /** organizationId is authoritative — comes from the authenticated profile */
  readonly organizationId: string;
}

export interface BudgetImportAccessBbaAdmin {
  readonly kind: "bba_admin";
  readonly userId: string;
  /**
   * organizationId is null until derived from a specific ProcurementCase.
   * Routes must call deriveOrganizationFromCase() to populate it.
   */
  readonly organizationId: null;
}

export type BudgetImportAccess = BudgetImportAccessCompanyUser | BudgetImportAccessBbaAdmin;

/**
 * Resolves who is making the request and their role.
 * Returns null when the user is not authenticated or is not authorized
 * to use the import flow (e.g., a regular user with no company_id).
 */
export async function resolveBudgetImportAccess(
  supabase: SupabaseClient,
): Promise<BudgetImportAccess | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Case A: company_user — has a company_id. organizationId is authoritative.
  if (profile.company_id) {
    return {
      kind: "company_user",
      userId: user.id,
      organizationId: String(profile.company_id),
    };
  }

  // Case B: bba_admin — no company_id, but has the admin role.
  if (profile.role === "bba_admin") {
    return {
      kind: "bba_admin",
      userId: user.id,
      organizationId: null,
    };
  }

  // All other profiles (no company_id, not bba_admin) are rejected.
  return null;
}

export interface DerivedOrganizationContext {
  /** The company_id derived server-side from the ProcurementCase. */
  readonly organizationId: string;
  /** Confirms the lot belongs to the same case and company. */
  readonly lotVerified: boolean;
}

/**
 * For bba_admin: fetches the ProcurementCase using service-role and derives
 * the organizationId (company_id) from it. Optionally validates that a given
 * procurementLotId belongs to the same case/company.
 *
 * Security: uses service-role client, bypasses RLS intentionally —
 * the caller has already been verified as bba_admin by resolveBudgetImportAccess().
 */
export async function deriveOrganizationFromCase(
  procurementCaseId: string,
  procurementLotId?: string,
): Promise<DerivedOrganizationContext | null> {
  const serviceClient = getSupabaseServiceRoleClient();

  const { data: caseRow, error: caseErr } = await serviceClient
    .from("procurement_cases")
    .select("id, company_id")
    .eq("id", procurementCaseId)
    .maybeSingle();

  if (caseErr || !caseRow) {
    return null;
  }

  const organizationId = String(caseRow.company_id);

  if (!procurementLotId) {
    return { organizationId, lotVerified: false };
  }

  // Validate that the lot belongs to the SAME case AND company.
  const { data: lotRow, error: lotErr } = await serviceClient
    .from("procurement_lots")
    .select("id")
    .eq("id", procurementLotId)
    .eq("procurement_case_id", procurementCaseId)
    .eq("company_id", organizationId)
    .maybeSingle();

  if (lotErr || !lotRow) {
    return { organizationId, lotVerified: false };
  }

  return { organizationId, lotVerified: true };
}
