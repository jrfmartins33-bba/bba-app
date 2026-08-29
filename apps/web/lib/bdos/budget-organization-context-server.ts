import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authorizeBudgetResourceOrganization,
  classifyBudgetOrganizationActor,
  selectBudgetCatalogOrganization,
  type BudgetActorClassification,
  type BudgetOrganizationActor,
  type BudgetOrganizationOption,
} from "@/lib/budget/budget-organization-policy";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export interface ResolvedBudgetOrganizationContext {
  readonly actor: BudgetOrganizationActor;
  readonly organization: BudgetOrganizationOption;
  readonly organizations: ReadonlyArray<BudgetOrganizationOption>;
  readonly queryClient: SupabaseClient;
}

export type BudgetCatalogContextResolution =
  | { readonly status: "unauthenticated" }
  | { readonly status: "forbidden" }
  | {
      readonly status: "selection_required";
      readonly actor: BudgetOrganizationActor;
      readonly organizations: ReadonlyArray<BudgetOrganizationOption>;
    }
  | ({ readonly status: "resolved" } & ResolvedBudgetOrganizationContext);

export type BudgetResourceContextResolution =
  | { readonly status: "unauthenticated" }
  | { readonly status: "forbidden" }
  | { readonly status: "not_found" }
  | ({ readonly status: "resolved" } & ResolvedBudgetOrganizationContext);

export async function authenticateBudgetOrganizationActor(
  readClient: SupabaseClient,
): Promise<BudgetActorClassification> {
  const {
    data: { user },
    error: userError,
  } = await readClient.auth.getUser();

  if (userError || !user) return { status: "unauthenticated" };

  const { data: profile, error: profileError } = await readClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return { status: "forbidden" };
  return classifyBudgetOrganizationActor(
    user.id,
    profile
      ? {
          companyId: profile.company_id ? String(profile.company_id) : null,
          role: profile.role ? String(profile.role) : null,
        }
      : null,
  );
}

export async function resolveBudgetCatalogContext(
  readClient: SupabaseClient,
  requestedOrganizationId: string | null,
): Promise<BudgetCatalogContextResolution> {
  const authentication = await authenticateBudgetOrganizationActor(readClient);
  if (authentication.status !== "authenticated") return authentication;

  return resolveBudgetCatalogContextForActor(
    readClient,
    authentication.actor,
    requestedOrganizationId,
  );
}

export async function resolveBudgetCatalogContextForActor(
  readClient: SupabaseClient,
  actor: BudgetOrganizationActor,
  requestedOrganizationId: string | null,
): Promise<BudgetCatalogContextResolution> {

  const { organizations, queryClient } = await loadEligibleBudgetOrganizations(readClient, actor);
  const selection = selectBudgetCatalogOrganization(actor, organizations, requestedOrganizationId);

  if (selection.status === "forbidden") return { status: "forbidden" };
  if (selection.status === "selection_required") {
    return { status: "selection_required", actor, organizations: selection.organizations };
  }
  return {
    status: "resolved",
    actor,
    organization: selection.organization,
    organizations: selection.organizations,
    queryClient,
  };
}

export async function resolveBudgetVersionContext(
  readClient: SupabaseClient,
  actor: BudgetOrganizationActor,
  budgetVersionId: string,
  requestedOrganizationId: string | null,
): Promise<BudgetResourceContextResolution> {
  const queryClient = actor.accessKind === "bba_admin" ? getSupabaseServiceRoleClient() : readClient;
  let query = queryClient
    .from("budget_versions")
    .select("id, company_id")
    .eq("id", budgetVersionId)
    .eq("status", "Consolidated");
  if (actor.accessKind === "company_user") query = query.eq("company_id", actor.organizationId);

  const { data: version, error } = await query.maybeSingle();
  if (error) throw error;
  if (!version) return { status: "not_found" };

  return resolveKnownResourceOrganization(
    queryClient,
    actor,
    String(version.company_id),
    requestedOrganizationId,
  );
}

export async function resolveScenarioContext(
  readClient: SupabaseClient,
  actor: BudgetOrganizationActor,
  scenarioId: string,
  requestedOrganizationId: string | null,
): Promise<BudgetResourceContextResolution> {
  const queryClient = actor.accessKind === "bba_admin" ? getSupabaseServiceRoleClient() : readClient;
  let query = queryClient
    .from("proposal_scenarios")
    .select("id, company_id, source_budget_version_id")
    .eq("id", scenarioId);
  if (actor.accessKind === "company_user") query = query.eq("company_id", actor.organizationId);

  const { data: scenario, error } = await query.maybeSingle();
  if (error) throw error;
  if (!scenario) return { status: "not_found" };

  const organizationId = String(scenario.company_id);
  const { data: sourceBudget, error: sourceError } = await queryClient
    .from("budget_versions")
    .select("id")
    .eq("id", String(scenario.source_budget_version_id))
    .eq("company_id", organizationId)
    .eq("status", "Consolidated")
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!sourceBudget) return { status: "not_found" };

  return resolveKnownResourceOrganization(
    queryClient,
    actor,
    organizationId,
    requestedOrganizationId,
  );
}

async function loadEligibleBudgetOrganizations(
  readClient: SupabaseClient,
  actor: BudgetOrganizationActor,
): Promise<{ readonly organizations: ReadonlyArray<BudgetOrganizationOption>; readonly queryClient: SupabaseClient }> {
  if (actor.accessKind === "company_user") {
    // Authorization comes exclusively from profiles.company_id. The company
    // name is intentionally not required here because a member is not always
    // companies.owner_id and therefore may not see that descriptive row by RLS.
    const organization = { id: actor.organizationId!, name: "Sua empresa" };
    return { organizations: [organization], queryClient: readClient };
  }

  // Service role is constructed only after getUser() + server-side profile role
  // validation above. Every subsequent read is still explicitly organization-scoped.
  const queryClient = getSupabaseServiceRoleClient();
  const { data: versions, error: versionsError } = await queryClient
    .from("budget_versions")
    .select("company_id")
    .eq("status", "Consolidated");
  if (versionsError) throw versionsError;

  const organizationIds = Array.from(new Set((versions ?? []).map((row) => String(row.company_id))));
  if (organizationIds.length === 0) return { organizations: [], queryClient };

  const { data: companies, error: companiesError } = await queryClient
    .from("companies")
    .select("id, name")
    .in("id", organizationIds)
    .order("name", { ascending: true });
  if (companiesError) throw companiesError;

  return {
    organizations: (companies ?? []).map((company) => ({ id: String(company.id), name: String(company.name) })),
    queryClient,
  };
}

async function resolveKnownResourceOrganization(
  queryClient: SupabaseClient,
  actor: BudgetOrganizationActor,
  organizationId: string,
  requestedOrganizationId: string | null,
): Promise<BudgetResourceContextResolution> {
  const organization = actor.accessKind === "company_user"
    ? { id: organizationId, name: "Sua empresa" }
    : await loadOrganization(queryClient, organizationId);
  if (!organization) return { status: "not_found" };
  if (authorizeBudgetResourceOrganization(actor, organization, requestedOrganizationId) === "forbidden") {
    return { status: "forbidden" };
  }
  return { status: "resolved", actor, organization, organizations: [organization], queryClient };
}

async function loadOrganization(
  client: SupabaseClient,
  organizationId: string,
): Promise<BudgetOrganizationOption | null> {
  const { data, error } = await client
    .from("companies")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: String(data.id), name: String(data.name) } : null;
}
