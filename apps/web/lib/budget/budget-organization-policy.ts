export type BudgetOrganizationAccessKind = "company_user" | "bba_admin";

export interface BudgetOrganizationActor {
  readonly userId: string;
  readonly accessKind: BudgetOrganizationAccessKind;
  readonly organizationId: string | null;
}

export interface BudgetOrganizationOption {
  readonly id: string;
  readonly name: string;
}

export type BudgetActorClassification =
  | { readonly status: "unauthenticated" }
  | { readonly status: "forbidden" }
  | { readonly status: "authenticated"; readonly actor: BudgetOrganizationActor };

export type BudgetOrganizationSelection =
  | { readonly status: "forbidden" }
  | { readonly status: "selection_required"; readonly organizations: ReadonlyArray<BudgetOrganizationOption> }
  | {
      readonly status: "resolved";
      readonly organization: BudgetOrganizationOption;
      readonly organizations: ReadonlyArray<BudgetOrganizationOption>;
    };

export function classifyBudgetOrganizationActor(
  userId: string | null,
  profile: { readonly companyId: string | null; readonly role: string | null } | null,
): BudgetActorClassification {
  if (!userId) return { status: "unauthenticated" };
  if (!profile) return { status: "forbidden" };

  if (profile.companyId) {
    return {
      status: "authenticated",
      actor: { userId, accessKind: "company_user", organizationId: profile.companyId },
    };
  }

  if (profile.role === "bba_admin") {
    return {
      status: "authenticated",
      actor: { userId, accessKind: "bba_admin", organizationId: null },
    };
  }

  return { status: "forbidden" };
}

/**
 * `requestedOrganizationId` is only a resource selector for an actor whose
 * identity and role were already verified server-side. It never grants access.
 */
export function selectBudgetCatalogOrganization(
  actor: BudgetOrganizationActor,
  organizations: ReadonlyArray<BudgetOrganizationOption>,
  requestedOrganizationId: string | null,
): BudgetOrganizationSelection {
  if (actor.accessKind === "company_user") {
    if (requestedOrganizationId && requestedOrganizationId !== actor.organizationId) {
      return { status: "forbidden" };
    }
    const organization = organizations.find((candidate) => candidate.id === actor.organizationId);
    return organization
      ? { status: "resolved", organization, organizations: [organization] }
      : { status: "forbidden" };
  }

  if (requestedOrganizationId) {
    const organization = organizations.find((candidate) => candidate.id === requestedOrganizationId);
    return organization
      ? { status: "resolved", organization, organizations }
      : { status: "forbidden" };
  }

  if (organizations.length === 1) {
    return { status: "resolved", organization: organizations[0], organizations };
  }

  return { status: "selection_required", organizations };
}

export function authorizeBudgetResourceOrganization(
  actor: BudgetOrganizationActor,
  resourceOrganization: BudgetOrganizationOption,
  requestedOrganizationId: string | null,
): "resolved" | "forbidden" {
  if (actor.accessKind === "company_user" && resourceOrganization.id !== actor.organizationId) {
    return "forbidden";
  }
  if (requestedOrganizationId && requestedOrganizationId !== resourceOrganization.id) {
    return "forbidden";
  }
  return "resolved";
}
