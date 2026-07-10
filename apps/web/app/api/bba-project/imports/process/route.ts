import { NextResponse } from "next/server";
import { importPlanningSource, ENGINE_VERSION, PLANNING_DATASET_SCHEMA_VERSION } from "@bba/bdos-core/services/bba-project-import";
import { narrateEngineeringBriefing, renderEngineeringAdvisorSummaryToText } from "@bba/bdos-core/advisor/claude-narrator";
import { validateEngineeringAdvisorSummary } from "@bba/bdos-core/advisor/advisor-response-validator";
import { computeHealthScore } from "@/components/bba-project/bba-project-insights";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { getEngineeringAdvisorBriefing } from "@/lib/bdos/advisor";
import { getEngineeringAdvisorHistoricalFacts } from "@/lib/bdos/advisor-historical-facts-repository";
import {
  ensureEngenhariaWorkspace,
  getPlanningImportById,
  insertAdvisorNarrative,
  insertDecisionSnapshot,
  insertPlanningDataset,
  persistRecommendation,
  updatePlanningImportStatus
} from "@/lib/bdos/repository";
import { sniffPlanningImportSourceTypeFromBytes } from "@/lib/bdos/planning-import-source-type";

const BUCKET_NAME = "bdos-imports";

/**
 * Resilient Planning Import (Epic 18), Etapa C — ver
 * packages/bdos-core/docs/RESILIENT_PLANNING_IMPORT.md. Processa por
 * referência: recebe só `planningImportId`, nunca um storagePath do
 * cliente — sempre lê o que `prepare-upload` já persistiu
 * (`getPlanningImportById`, escopado a `company_id` via RLS + filtro
 * explícito). Pipeline idêntico ao de `/api/bba-project/import`
 * (mesmo `importPlanningSource`, mesma sequência de persistência) —
 * nenhuma lógica de negócio duplicada, só a origem do arquivo muda
 * (download por referência em vez de multipart no corpo).
 *
 * Ajuste 2 da revisão do CPO: `detectPlanningImportSourceType` roda de
 * novo aqui, agora com os bytes reais — recupera o sniffing que
 * `prepare-upload` não podia fazer. Nunca reescreve
 * `planning_imports.source_type` (proveniência, imutável) — uma
 * divergência entre o declarado e o sniffado é tratada como falha,
 * nunca corrigida silenciosamente.
 */
interface ProcessRequestBody {
  readonly planningImportId: string;
}

function isValidRequestBody(body: unknown): body is ProcessRequestBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const candidate = body as Record<string, unknown>;
  return typeof candidate.planningImportId === "string" && candidate.planningImportId.trim().length > 0;
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const auth = await requireAuthenticatedCompany(supabase);

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

  const planningImport = await getPlanningImportById(supabase, { id: body.planningImportId, companyId }).catch((error) => {
    console.error("[bba-project-imports] Falha ao carregar planning_import.", error);
    return null;
  });

  if (!planningImport) {
    return NextResponse.json({ error: "planning_import_not_found" }, { status: 404 });
  }

  if (planningImport.status === "completed") {
    return NextResponse.json({ error: "already_completed" }, { status: 409 });
  }

  if (planningImport.status === "processing") {
    return NextResponse.json({ error: "already_processing" }, { status: 409 });
  }

  if (planningImport.status === "pending_upload") {
    return NextResponse.json({ error: "upload_not_confirmed" }, { status: 409 });
  }

  // status === "uploaded" | "failed" (nova tentativa) daqui em diante.

  const { data: downloadData, error: downloadError } = await supabase.storage
    .from(BUCKET_NAME)
    .download(planningImport.storagePath);

  if (downloadError || !downloadData) {
    console.error("[bba-project-imports] Falha ao baixar arquivo do Storage.", downloadError);
    return NextResponse.json({ error: "download_failed" }, { status: 500 });
  }

  const buffer = new Uint8Array(await downloadData.arrayBuffer());
  // Nunca detectPlanningImportSourceType(fileName, ...) aqui: essa
  // função dá prioridade à extensão do nome, o que sempre "ganharia"
  // antes mesmo de olhar os bytes — inútil para detectar um mismatch.
  // Só o conteúdo real decide (Ajuste 2, RESILIENT_PLANNING_IMPORT.md).
  const sniffedType = sniffPlanningImportSourceTypeFromBytes(buffer);

  if (sniffedType === null || sniffedType !== planningImport.sourceType) {
    await updatePlanningImportStatus(supabase, { id: planningImport.id, companyId, status: "failed" });
    console.error(
      "[bba-project-imports] source_type declarado não bate com o conteúdo real do arquivo.",
      { declared: planningImport.sourceType, sniffed: sniffedType }
    );
    return NextResponse.json({ error: "source_type_mismatch" }, { status: 422 });
  }

  await updatePlanningImportStatus(supabase, { id: planningImport.id, companyId, status: "processing" });

  const now = new Date().toISOString();
  const baseInput = {
    fileName: planningImport.fileName,
    organizationId: companyId,
    contractId: planningImport.engineeringProjectId,
    projectId: planningImport.engineeringProjectId,
    tenantId: companyId,
    capability: "geospatial-intelligence",
    generatedAt: now,
    correlationId: `bba-project-import:${planningImport.engineeringProjectId}`,
    actor: userId,
    occurredAt: now,
    asOfDate: now.slice(0, 10)
  };

  const snapshot =
    planningImport.sourceType === "ms-project-xml"
      ? importPlanningSource({ ...baseInput, sourceType: "ms-project-xml", xml: new TextDecoder("utf-8").decode(buffer) })
      : importPlanningSource({ ...baseInput, sourceType: "excel", excelBytes: buffer });

  let decisionSnapshotId: string;

  try {
    const workspace = await ensureEngenhariaWorkspace(supabase, companyId);

    const planningDataset = await insertPlanningDataset(supabase, {
      companyId,
      engineeringProjectId: planningImport.engineeringProjectId,
      planningImportId: planningImport.id,
      datasetSchemaVersion: PLANNING_DATASET_SCHEMA_VERSION,
      detectedType: snapshot.detectedPlanningType,
      dataset: snapshot.planningDataset
    });

    const healthScore = computeHealthScore(snapshot);

    const decisionSnapshot = await insertDecisionSnapshot(supabase, {
      companyId,
      engineeringProjectId: planningImport.engineeringProjectId,
      planningDatasetId: planningDataset.id,
      engineVersion: ENGINE_VERSION,
      triggerReason: "import",
      computedBy: userId,
      decisions: snapshot.decisions,
      recommendations: snapshot.recommendations,
      healthScore: healthScore.score,
      healthScoreLevel: healthScore.level
    });
    decisionSnapshotId = decisionSnapshot.id;

    for (const recommendation of snapshot.recommendations) {
      await persistRecommendation(supabase, {
        companyId,
        workspaceId: workspace.id,
        engineeringProjectId: planningImport.engineeringProjectId,
        decisionSnapshotId: decisionSnapshot.id,
        recommendationRefId: recommendation.id,
        title: recommendation.title,
        severity: getRecommendationSeverity(recommendation)
      });
    }
  } catch (error) {
    console.error("[bba-project-imports] Falha ao persistir planning dataset/decision snapshot/recommendations.", error);
    await updatePlanningImportStatus(supabase, { id: planningImport.id, companyId, status: "failed" });
    return NextResponse.json({ error: "persistence_failed" }, { status: 500 });
  }

  await updatePlanningImportStatus(supabase, { id: planningImport.id, companyId, status: "completed" });

  // BBA Advisor — narrativa via Claude. Deliberadamente FORA do
  // try/catch acima e depois de marcar 'completed': mesma disciplina
  // de /api/bba-project/import — uma falha aqui nunca pode reverter um
  // import que já persistiu com sucesso.
  try {
    const briefing = await getEngineeringAdvisorBriefing(supabase, companyId);

    if (!briefing.context) {
      throw new Error("Advisor sem contexto rico (nenhum decision snapshot disponível ainda).");
    }

    const historicalFacts = await getEngineeringAdvisorHistoricalFacts(supabase, briefing.context);
    const narration = await narrateEngineeringBriefing(briefing.context, historicalFacts);
    const validation = validateEngineeringAdvisorSummary(narration.raw, briefing.context);

    if (!validation.valid) {
      throw new Error(`Resposta do Claude reprovada na validação: ${validation.reason}`);
    }

    await insertAdvisorNarrative(supabase, {
      companyId,
      engineeringProjectId: planningImport.engineeringProjectId,
      decisionSnapshotId,
      model: narration.model,
      narrative: renderEngineeringAdvisorSummaryToText(validation.summary)
    });
  } catch (error) {
    console.error("[bba-project-imports] Falha ao gerar narrativa do Advisor (fallback: itens template).", error);
  }

  return NextResponse.json(snapshot);
}

const DEFAULT_RECOMMENDATION_SEVERITY = "medium";

function getRecommendationSeverity(recommendation: { metadata: Readonly<Record<string, unknown>> }): string {
  const value = recommendation.metadata.decisionPriority;
  return typeof value === "string" && value.trim().length > 0 ? value : DEFAULT_RECOMMENDATION_SEVERITY;
}
