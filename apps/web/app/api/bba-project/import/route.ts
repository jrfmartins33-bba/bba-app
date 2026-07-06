import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { importPlanningSource, type PlanningImportSourceType } from "@bba/bdos-core/services/bba-project-import";

/**
 * BBA Project Studio — Sprint 1 (PARTE 9). Único ponto de contato
 * entre a UI e `@bba/bdos-core/services/bba-project-import`: recebe o
 * arquivo bruto (XML do Microsoft Project ou Excel .xlsx), detecta a
 * fonte por extensão/MIME/conteúdo, chama `importPlanningSource` (que
 * já orquestra a cadeia real) e devolve o snapshot uniforme pronto.
 * Nenhuma regra de negócio vive aqui.
 *
 * REGRA CRÍTICA: o caminho XML delega inteiramente para a mesma
 * `buildBbaProjectImportSnapshot` do Sprint Zero, através de
 * `importPlanningSource` — os números de produção
 * (12/9/9/9/41) continuam exatamente os mesmos.
 */
export async function POST(request: Request): Promise<NextResponse> {
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

  const now = new Date().toISOString();
  const baseInput = {
    fileName: file.name,
    organizationId: "organization-alpha-engenharia",
    contractId: "contract-lagoa-do-arroz-001",
    projectId: "project-lagoa-do-arroz",
    tenantId: "tenant-alpha-engenharia",
    capability: "geospatial-intelligence",
    generatedAt: now,
    correlationId: `bba-project-import:${randomUUID()}`,
    actor: "bba-project-import",
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
