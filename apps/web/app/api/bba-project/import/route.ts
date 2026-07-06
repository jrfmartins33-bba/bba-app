import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { buildBbaProjectImportSnapshot } from "@bba/bdos-core/services/bba-project-import";

/**
 * BBA Project — Sprint Zero. Único ponto de contato entre a UI e
 * `@bba/bdos-core/services/bba-project-import`: recebe o XML bruto
 * exportado pelo Microsoft Project, chama a Application Service (que
 * já orquestra a cadeia real — importação → objetos espaciais → fatos
 * → decisões → recomendações → caminho crítico → curva S) e devolve o
 * snapshot pronto. Nenhuma regra de negócio vive aqui.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || typeof (body as { xml?: unknown }).xml !== "string") {
    return NextResponse.json({ error: "missing_xml_field" }, { status: 400 });
  }

  const xml = (body as { xml: string }).xml;
  const now = new Date().toISOString();

  const snapshot = buildBbaProjectImportSnapshot({
    xml,
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
  });

  return NextResponse.json(snapshot);
}
