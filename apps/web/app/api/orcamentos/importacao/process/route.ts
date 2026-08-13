import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { importStructuredBudgetXlsxService } from "@bba/bdos-core/services/budget-official-review";
import {
  getSupabaseRouteHandlerClient,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { resolveBudgetImportAccess, deriveOrganizationFromCase } from "@/lib/bdos/budget-import-access";
import {
  createProcurementCaseRepository,
  createBudgetVersionRepository,
} from "@/lib/bdos/procurement-engineering-server-repository";
import {
  createDocumentRepository,
  createDocumentVersionRepository,
} from "@/lib/bdos/document-processing-server-repository";
import { createBudgetReviewServerRepository } from "@/lib/bdos/budget-official-review-server-repository";

const BUCKET_NAME = "bdos-imports";

interface ProcessRequestBody {
  readonly procurementCaseId: string;
  readonly procurementLotId: string;
  readonly storagePath: string;
  readonly originalFileName: string;
}

function isValidRequestBody(body: unknown): body is ProcessRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const c = body as Record<string, unknown>;

  return (
    typeof c.procurementCaseId === "string" &&
    c.procurementCaseId.trim().length > 0 &&
    typeof c.procurementLotId === "string" &&
    c.procurementLotId.trim().length > 0 &&
    typeof c.storagePath === "string" &&
    c.storagePath.trim().length > 0 &&
    typeof c.originalFileName === "string" &&
    c.originalFileName.trim().length > 0
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const readClient = getSupabaseRouteHandlerClient();
  const access = await resolveBudgetImportAccess(readClient);

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
    return NextResponse.json({ error: "invalid_process_body" }, { status: 400 });
  }

  const storagePath = body.storagePath.trim();

  // Strict path format validation: <companyId>/orcamentos/<64 hex chars>.xlsx
  // Rejects path traversal, wrong namespaces, non-XLSX extensions, weak filenames.
  const STORAGE_PATH_REGEX = /^([0-9a-f-]{36})\/orcamentos\/([0-9a-f]{64})\.xlsx$/i;
  const pathMatch = STORAGE_PATH_REGEX.exec(storagePath);

  if (!pathMatch) {
    return NextResponse.json({ error: "invalid_storage_path_format" }, { status: 400 });
  }

  const pathCompanyId = pathMatch[1];
  const shaFromPath = pathMatch[2].toLowerCase();

  // Resolve and verify the authoritative organizationId server-side.
  // Neither the storagePath's prefix nor any client-supplied companyId is trusted.
  let resolvedOrganizationId: string;

  if (access.kind === "company_user") {
    resolvedOrganizationId = access.organizationId;
  } else {
    // bba_admin: derive organizationId from the ProcurementCase server-side.
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

  // The storagePath prefix must match the server-derived organizationId.
  // This closes the final cross-contamination vector.
  if (pathCompanyId !== resolvedOrganizationId) {
    return NextResponse.json({ error: "unauthorized_storage_path" }, { status: 403 });
  }

  const serviceRoleClient = getSupabaseServiceRoleClient();

  // 1. Download bytes from Supabase Storage
  const { data: fileBlob, error: downloadError } = await serviceRoleClient.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (downloadError || !fileBlob) {
    console.error("[orcamentos/importacao/process] Download error:", downloadError);
    return NextResponse.json({ error: "storage_object_not_found" }, { status: 404 });
  }

  const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());

  if (fileBytes.length === 0) {
    return NextResponse.json({ error: "empty_file_object" }, { status: 400 });
  }

  // 2. Recalculate SHA-256 server-side from actual downloaded bytes
  const recalculatedSha256 = createHash("sha256").update(fileBytes).digest("hex");

  // 3. INTEGRITY GATE: SHA of the path filename MUST match SHA of the actual bytes.
  // This ensures no one can substitute different bytes under a trusted path,
  // and prevents the Application Service from ingesting a tampered file.
  if (recalculatedSha256 !== shaFromPath) {
    console.error(
      "[orcamentos/importacao/process] SHA integrity failure:",
      { pathSha: shaFromPath, actualSha: recalculatedSha256 },
    );
    return NextResponse.json({ error: "storage_integrity_failure" }, { status: 422 });
  }

  // 4. Assemble Repositories
  const procurementCaseRepository = createProcurementCaseRepository(serviceRoleClient);
  const documentRepository = createDocumentRepository(serviceRoleClient);
  const documentVersionRepository = createDocumentVersionRepository(serviceRoleClient);
  const budgetVersionRepository = createBudgetVersionRepository(serviceRoleClient);
  const reviewRepository = createBudgetReviewServerRepository(readClient, serviceRoleClient);

  // organizationId is always the server-derived value — never from the request body.
  const context = {
    organizationId: resolvedOrganizationId,
    actor: access.userId,
  };

  const command = {
    procurementCaseId: body.procurementCaseId,
    procurementLotId: body.procurementLotId,
    fileBytes,
    originalFileName: body.originalFileName,
    storageReference: storagePath,
    sha256: recalculatedSha256,
  };

  try {
    const result = await importStructuredBudgetXlsxService(context, command, {
      procurementCaseRepository,
      documentRepository,
      documentVersionRepository,
      budgetVersionRepository,
      reviewRepository,
    });

    if (result.outcome !== "success") {
      return NextResponse.json(
        {
          outcome: result.outcome,
          message: result.message ?? "Não foi possível importar a planilha do orçamento.",
          errors: result.errors ?? [],
        },
        { status: 400 },
      );
    }

    // Check if actor is BBA Admin to authorize opening review page
    const isAdmin = access.kind === "bba_admin";

    // Fetch human titles for case and lot
    const procurementCase = await procurementCaseRepository.findProcurementCaseById(
      resolvedOrganizationId,
      body.procurementCaseId,
    );
    const procurementLot = await procurementCaseRepository.findProcurementLotById(
      resolvedOrganizationId,
      body.procurementCaseId,
      body.procurementLotId,
    );

    return NextResponse.json({
      outcome: "success",
      idempotentReuse: result.idempotentReuse ?? false,
      reviewSessionId: result.reviewSessionId,
      canOpenReview: isAdmin,
      procurementCaseTitle: procurementCase?.title ?? "Processo de Licitação",
      procurementLotTitle: procurementLot?.title ?? "Lote",
      originalFileName: body.originalFileName,
      groupCount: result.summary?.groupCount ?? 0,
      subgroupCount: result.summary?.subgroupCount ?? 0,
      serviceItemCount: result.summary?.serviceItemCount ?? 0,
      totalRowCount: result.rowCount ?? 0,
    });
  } catch (error) {
    console.error("[orcamentos/importacao/process] Internal error:", error);
    return NextResponse.json({ error: "internal_processing_error" }, { status: 500 });
  }
}
