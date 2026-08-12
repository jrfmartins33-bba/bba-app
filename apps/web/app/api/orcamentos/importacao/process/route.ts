import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { importStructuredBudgetXlsxService } from "@bba/bdos-core/services/budget-official-review";
import {
  getSupabaseRouteHandlerClient,
  getSupabaseServiceRoleClient,
  requireAuthenticatedCompany,
  requireBbaAdmin,
} from "@/lib/supabase/server";
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
  const auth = await requireAuthenticatedCompany(readClient);

  if (!auth) {
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

  const { companyId, userId } = auth;
  const storagePath = body.storagePath.trim();

  // Validate that storagePath starts with companyId
  if (!storagePath.startsWith(`${companyId}/`)) {
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

  // 3. Assemble Repositories
  const procurementCaseRepository = createProcurementCaseRepository(serviceRoleClient);
  const documentRepository = createDocumentRepository(serviceRoleClient);
  const documentVersionRepository = createDocumentVersionRepository(serviceRoleClient);
  const budgetVersionRepository = createBudgetVersionRepository(serviceRoleClient);
  const reviewRepository = createBudgetReviewServerRepository(serviceRoleClient);

  const context = {
    organizationId: companyId,
    actor: userId,
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
    const admin = await requireBbaAdmin(readClient);

    // Fetch human Titles for case and lot
    const procurementCase = await procurementCaseRepository.findProcurementCaseById(companyId, body.procurementCaseId);
    const procurementLot = await procurementCaseRepository.findProcurementLotById(companyId, body.procurementCaseId, body.procurementLotId);

    return NextResponse.json({
      outcome: "success",
      idempotentReuse: result.idempotentReuse ?? false,
      reviewSessionId: result.reviewSessionId,
      canOpenReview: Boolean(admin),
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
