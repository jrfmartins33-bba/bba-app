import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { importPlanningSource, type PlanningImportSourceType } from "@bba/bdos-core/services/bba-project-import";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import {
  ensureDefaultEngineeringProject,
  ensureEngenhariaWorkspace,
  insertPlanningImport,
  uploadPlanningImportFile
} from "@/lib/bdos/repository";

/**
 * BBA Project Studio — Sprint 1 (PARTE 9), com persistência real desde
 * a Sprint 13.6. Único ponto de contato entre a UI e
 * `@bba/bdos-core/services/bba-project-import`: resolve a empresa do
 * usuário autenticado (via cookie de sessão, Sprint 13.6), garante a
 * Workspace/Projeto de Engenharia da empresa, grava o arquivo em
 * Storage e o registro de proveniência em `planning_imports`
 * (Sprint 13.5), então chama `importPlanningSource` (que já orquestra
 * a cadeia real) e devolve o snapshot uniforme pronto. Nenhuma regra
 * de negócio vive aqui.
 *
 * REGRA CRÍTICA: o caminho XML delega inteiramente para a mesma
 * `buildBbaProjectImportSnapshot` do Sprint Zero, através de
 * `importPlanningSource` — os números de produção
 * (12/9/9/9/41) continuam exatamente os mesmos.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

  if (!auth) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file_field" }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const sourceType = detectSourceType(file.name, file.type, buffer);

  if (sourceType === null) {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
  }

  const { companyId, userId } = auth;
  const planningImportId = randomUUID();
  let engineeringProjectId: string;

  try {
    const workspace = await ensureEngenhariaWorkspace(supabase, companyId);
    const engineeringProject = await ensureDefaultEngineeringProject(supabase, companyId, workspace.id);
    engineeringProjectId = engineeringProject.id;

    const storagePath = await uploadPlanningImportFile(supabase, {
      companyId,
      engineeringProjectId,
      planningImportId,
      fileName: file.name,
      bytes: buffer,
      contentType: file.type || "application/octet-stream"
    });

    await insertPlanningImport(supabase, {
      id: planningImportId,
      companyId,
      engineeringProjectId,
      sourceType,
      fileName: file.name,
      storagePath,
      uploadedBy: userId
    });
  } catch (error) {
    console.error("[bba-project-import] Falha ao persistir import.", error);
    return NextResponse.json({ error: "persistence_failed" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const baseInput = {
    fileName: file.name,
    organizationId: companyId,
    contractId: engineeringProjectId,
    projectId: engineeringProjectId,
    tenantId: companyId,
    capability: "geospatial-intelligence",
    generatedAt: now,
    correlationId: `bba-project-import:${planningImportId}`,
    actor: userId,
    occurredAt: now,
    asOfDate: now.slice(0, 10),
  };

  const snapshot =
    sourceType === "ms-project-xml"
      ? importPlanningSource({ ...baseInput, sourceType, xml: new TextDecoder("utf-8").decode(buffer) })
      : importPlanningSource({ ...baseInput, sourceType, excelBytes: buffer });

  return NextResponse.json(snapshot);
}

function detectSourceType(fileName: string, mimeType: string, bytes: Uint8Array): PlanningImportSourceType | null {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".xml") || mimeType === "text/xml" || mimeType === "application/xml") {
    return "ms-project-xml";
  }

  if (lowerName.endsWith(".xlsx") || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "excel";
  }

  // Extensão/MIME ambíguos — verifica o conteúdo: .xlsx é sempre um ZIP
  // ("PK" nos dois primeiros bytes); um XML sempre começa com "<".
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return "excel";
  }

  if (bytes[0] === 0x3c) {
    return "ms-project-xml";
  }

  return null;
}
