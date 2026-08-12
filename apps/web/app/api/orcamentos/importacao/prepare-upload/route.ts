import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveBudgetImportAccess, deriveOrganizationFromCase } from "@/lib/bdos/budget-import-access";

const MAX_STANDARD_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB limit

interface PrepareUploadRequestBody {
  readonly procurementCaseId: string;
  readonly procurementLotId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

function isValidRequestBody(body: unknown): body is PrepareUploadRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const c = body as Record<string, unknown>;

  return (
    typeof c.procurementCaseId === "string" &&
    c.procurementCaseId.trim().length > 0 &&
    typeof c.procurementLotId === "string" &&
    c.procurementLotId.trim().length > 0 &&
    typeof c.fileName === "string" &&
    c.fileName.trim().length > 0 &&
    typeof c.contentType === "string" &&
    typeof c.sizeBytes === "number" &&
    Number.isFinite(c.sizeBytes) &&
    c.sizeBytes > 0 &&
    typeof c.sha256 === "string" &&
    /^[a-fA-F0-9]{64}$/.test(c.sha256.trim())
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const access = await resolveBudgetImportAccess(supabase);

  if (!access) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  if (!isValidRequestBody(body)) {
    return NextResponse.json({ error: "invalid_prepare_upload_body" }, { status: 400 });
  }

  if (!body.fileName.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "file_must_be_xlsx" }, { status: 400 });
  }

  if (body.sizeBytes > MAX_STANDARD_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const sha256 = body.sha256.trim().toLowerCase();

  try {
    let resolvedOrganizationId: string;

    if (access.kind === "company_user") {
      // company_user: validate case/lot belong to their authenticated company.
      // Uses their own Supabase client so RLS enforces isolation.
      const companyId = access.organizationId;

      const { data: caseRow, error: caseErr } = await supabase
        .from("procurement_cases")
        .select("id")
        .eq("company_id", companyId)
        .eq("id", body.procurementCaseId)
        .maybeSingle();

      if (caseErr) throw caseErr;
      if (!caseRow) {
        return NextResponse.json({ error: "procurement_case_not_found" }, { status: 404 });
      }

      const { data: lotRow, error: lotErr } = await supabase
        .from("procurement_lots")
        .select("id")
        .eq("company_id", companyId)
        .eq("procurement_case_id", body.procurementCaseId)
        .eq("id", body.procurementLotId)
        .maybeSingle();

      if (lotErr) throw lotErr;
      if (!lotRow) {
        return NextResponse.json({ error: "procurement_lot_not_found" }, { status: 404 });
      }

      resolvedOrganizationId = companyId;
    } else {
      // bba_admin: derive company_id server-side from the ProcurementCase.
      // The browser-supplied procurementCaseId is looked up via service-role —
      // we never use a companyId from the request body.
      const derived = await deriveOrganizationFromCase(
        body.procurementCaseId,
        body.procurementLotId,
      );

      if (!derived) {
        return NextResponse.json({ error: "procurement_case_not_found" }, { status: 404 });
      }

      if (!derived.lotVerified) {
        return NextResponse.json({ error: "procurement_lot_not_found" }, { status: 404 });
      }

      resolvedOrganizationId = derived.organizationId;
    }

    // storagePath is built using the server-derived organizationId — never client-supplied.
    const storagePath = `${resolvedOrganizationId}/orcamentos/${sha256}.xlsx`;

    return NextResponse.json({ storagePath, sha256 });
  } catch (error) {
    console.error("[orcamentos/importacao/prepare-upload] Error:", error);
    return NextResponse.json({ error: "prepare_upload_failed" }, { status: 500 });
  }
}
