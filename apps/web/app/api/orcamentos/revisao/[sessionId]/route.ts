import { NextResponse } from "next/server";
import {
  bulkConfirmBudgetReviewRowsService,
  confirmBudgetReviewRowService,
  correctBudgetReviewRowService,
  consolidateBudgetReviewSessionService,
  excludeBudgetReviewRowService,
  insertManualBudgetReviewRowService,
  restoreBudgetReviewRowService,
  budgetReviewConsolidationReadiness,
  reconcileGroupRow,
  reconcileServiceItemRow,
  BudgetLineKind,
} from "@bba/bdos-core/services/budget-official-review";
import type { BudgetReviewServiceResult } from "@bba/bdos-core/services/budget-official-review";
import { getSupabaseRouteHandlerClient, getSupabaseServiceRoleClient, requireBbaAdmin } from "@/lib/supabase/server";
import { createBudgetReviewServerRepository } from "@/lib/bdos/budget-official-review-server-repository";

// Revisão do Orçamento Oficial (Epic 21.5A) — Admin BBA exclusivo
// (enunciado §47). GET carrega a sessão completa (linhas + reconciliação
// calculada em memória, nunca persistida — puramente derivada do domínio
// puro a cada leitura). POST despacha por `action` no corpo — um único
// agregado por requisição do domínio (budget-official-review), evitando
// espalhar 7 arquivos de rota quase idênticos para uma única Sessão.
//
// `organizationId` NUNCA é aceito do corpo da requisição (enunciado §20):
// toda rota resolve-o primeiro via findOrganizationIdForSession, a partir
// só do sessionId da própria URL — o mesmo princípio já usado em
// requireAuthenticatedCompany/requireBbaAdmin (nunca confiar em um fato
// de autorização vindo do navegador quando o banco pode derivá-lo).

interface RouteParams {
  readonly params: { readonly sessionId: string };
}

async function resolveOrganizationId(
  repository: ReturnType<typeof createBudgetReviewServerRepository>,
  sessionId: string,
): Promise<string | null> {
  return repository.findOrganizationIdForSession(sessionId);
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const readClient = getSupabaseRouteHandlerClient();
  const admin = await requireBbaAdmin(readClient);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const repository = createBudgetReviewServerRepository(getSupabaseServiceRoleClient());
  const organizationId = await resolveOrganizationId(repository, params.sessionId);
  if (organizationId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await repository.loadSession(organizationId, params.sessionId);
  if (session === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const reconciliation = {
    serviceItems: session.rows
      .filter((row) => row.kind === BudgetLineKind.ServiceItem)
      .map((row) => reconcileServiceItemRow(row)),
    groups: session.rows
      .filter((row) => row.kind !== BudgetLineKind.ServiceItem)
      .map((row) => reconcileGroupRow(session, row.id)),
    readiness: budgetReviewConsolidationReadiness(session),
  };

  return NextResponse.json({ session, reconciliation });
}

interface ActionBody {
  readonly action: string;
  readonly rowId?: string;
  readonly rowIds?: ReadonlyArray<string>;
  readonly fields?: Record<string, string | null>;
  readonly justification?: string;
  readonly id?: string;
  readonly kind?: string;
  readonly lotReference?: string;
  readonly parentRowId?: string | null;
  readonly position?: number;
  readonly page?: number;
}

export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const readClient = getSupabaseRouteHandlerClient();
  const admin = await requireBbaAdmin(readClient);
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  const repository = createBudgetReviewServerRepository(getSupabaseServiceRoleClient());
  const sessionId = params.sessionId;
  const organizationId = await resolveOrganizationId(repository, sessionId);
  if (organizationId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const context = { organizationId, actor: admin.userId };
  let result: BudgetReviewServiceResult;

  switch (body.action) {
    case "confirm": {
      if (!body.rowId) return NextResponse.json({ error: "missing_row_id" }, { status: 400 });
      result = await confirmBudgetReviewRowService(context, { sessionId, rowId: body.rowId }, repository);
      break;
    }
    case "correct": {
      if (!body.rowId || !body.fields || !body.justification) {
        return NextResponse.json({ error: "missing_fields" }, { status: 400 });
      }
      result = await correctBudgetReviewRowService(
        context,
        { sessionId, rowId: body.rowId, fields: body.fields, justification: body.justification },
        repository,
      );
      break;
    }
    case "exclude": {
      if (!body.rowId || !body.justification) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
      result = await excludeBudgetReviewRowService(context, { sessionId, rowId: body.rowId, justification: body.justification }, repository);
      break;
    }
    case "restore": {
      if (!body.rowId) return NextResponse.json({ error: "missing_row_id" }, { status: 400 });
      result = await restoreBudgetReviewRowService(context, { sessionId, rowId: body.rowId }, repository);
      break;
    }
    case "insertManual": {
      if (!body.id || !body.kind || !body.lotReference || body.position === undefined || !body.page || !body.justification || !body.fields) {
        return NextResponse.json({ error: "missing_fields" }, { status: 400 });
      }
      result = await insertManualBudgetReviewRowService(
        context,
        {
          sessionId,
          id: body.id,
          kind: body.kind as never,
          lotReference: body.lotReference,
          parentRowId: body.parentRowId ?? null,
          position: body.position,
          fields: body.fields as never,
          page: body.page,
          justification: body.justification,
        },
        repository,
      );
      break;
    }
    case "bulkConfirm": {
      if (!body.rowIds || body.rowIds.length === 0) return NextResponse.json({ error: "missing_row_ids" }, { status: 400 });
      result = await bulkConfirmBudgetReviewRowsService(context, { sessionId, rowIds: body.rowIds }, repository);
      break;
    }
    case "consolidate": {
      result = await consolidateBudgetReviewSessionService(context, { sessionId }, repository);
      break;
    }
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  if (result.outcome === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.outcome === "domain_error") {
    return NextResponse.json({ error: "domain_error", details: result.errors }, { status: 422 });
  }
  if (result.outcome === "persistence_failure") {
    console.error("[orcamentos/revisao] persistence_failure", result.message);
    return NextResponse.json({ error: "persistence_failure" }, { status: 500 });
  }

  return NextResponse.json({ session: result.session });
}
