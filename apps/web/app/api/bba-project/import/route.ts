import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  ENGINE_VERSION,
  importPlanningSource,
  PLANNING_DATASET_SCHEMA_VERSION,
  type PlanningImportSourceType
} from "@bba/bdos-core/services/bba-project-import";
import { narrateEngineeringBriefing, renderEngineeringAdvisorSummaryToText } from "@bba/bdos-core/advisor/claude-narrator";
import { validateEngineeringAdvisorSummary } from "@bba/bdos-core/advisor/advisor-response-validator";
import { computeHealthScore } from "@/components/bba-project/bba-project-insights";
import { getSupabaseRouteHandlerClient, requireAuthenticatedCompany } from "@/lib/supabase/server";
import { getEngineeringAdvisorBriefing } from "@/lib/bdos/advisor";
import {
  ensureDefaultEngineeringProject,
  ensureEngenhariaWorkspace,
  insertAdvisorNarrative,
  insertDecisionSnapshot,
  insertPlanningDataset,
  insertPlanningImport,
  persistRecommendation,
  uploadPlanningImportFile
} from "@/lib/bdos/repository";

/**
 * BBA Project Studio — Sprint 1 (PARTE 9), com persistência real desde
 * a Sprint 13.6/13.7/13.8/13.9. Único ponto de contato entre a UI e
 * `@bba/bdos-core/services/bba-project-import`: resolve a empresa do
 * usuário autenticado (via cookie de sessão, Sprint 13.6), garante a
 * Workspace/Projeto de Engenharia da empresa, grava o arquivo em
 * Storage e o registro de proveniência em `planning_imports`
 * (Sprint 13.5), chama `importPlanningSource` (que já orquestra a
 * cadeia real), grava o `PlanningDataset` normalizado em
 * `planning_datasets` (Camada 2, Sprint 13.7), grava o Decision
 * Snapshot resultante em `decision_snapshots` (Camada 3, Sprint 13.8,
 * `trigger_reason='import'`, incluindo o Health Score congelado no
 * momento do cálculo — Sprint 13.10, ver `computeHealthScore`) e
 * sincroniza `recommendations` (Advisor persistente, Sprint 13.9) e só
 * então devolve o snapshot uniforme pronto. Nenhuma regra de negócio
 * vive aqui.
 *
 * REGRA CRÍTICA: o caminho XML delega inteiramente para a mesma
 * `buildBbaProjectImportSnapshot` do Sprint Zero, através de
 * `importPlanningSource` — os números de produção
 * (12/9/9/9/41) continuam exatamente os mesmos.
 *
 * IDEMPOTÊNCIA (Sprint 13.9): `correlationId` é fixo por
 * `engineeringProjectId` (não mais por upload/planningImportId) —
 * isso é o que faz `Decision.id`/`Recommendation.id` saírem idênticos
 * quando o mesmo risco (mesma atividade, mesma regra) reaparece em
 * reimports do mesmo projeto. `persistRecommendation` depende
 * exatamente disso: sem correlationId estável, cada reimport geraria
 * um `recommendation_ref_id` novo e o índice único parcial em
 * `recommendations` nunca pegaria a duplicata.
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
  let workspaceId: string;
  let engineeringProjectId: string;

  try {
    const workspace = await ensureEngenhariaWorkspace(supabase, companyId);
    workspaceId = workspace.id;
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
    correlationId: `bba-project-import:${engineeringProjectId}`,
    actor: userId,
    occurredAt: now,
    asOfDate: now.slice(0, 10),
  };

  const snapshot =
    sourceType === "ms-project-xml"
      ? importPlanningSource({ ...baseInput, sourceType, xml: new TextDecoder("utf-8").decode(buffer) })
      : importPlanningSource({ ...baseInput, sourceType, excelBytes: buffer });

  let decisionSnapshotId: string;

  try {
    const planningDataset = await insertPlanningDataset(supabase, {
      companyId,
      engineeringProjectId,
      planningImportId,
      datasetSchemaVersion: PLANNING_DATASET_SCHEMA_VERSION,
      detectedType: snapshot.detectedPlanningType,
      dataset: snapshot.planningDataset
    });

    const healthScore = computeHealthScore(snapshot);

    const decisionSnapshot = await insertDecisionSnapshot(supabase, {
      companyId,
      engineeringProjectId,
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
        workspaceId,
        engineeringProjectId,
        decisionSnapshotId: decisionSnapshot.id,
        recommendationRefId: recommendation.id,
        title: recommendation.title,
        severity: getRecommendationSeverity(recommendation)
      });
    }
  } catch (error) {
    console.error("[bba-project-import] Falha ao persistir planning dataset/decision snapshot/recommendations.", error);
    return NextResponse.json({ error: "persistence_failed" }, { status: 500 });
  }

  // BBA Advisor — narrativa via Claude (Sprint 13.12). Deliberadamente FORA
  // do try/catch acima: uma falha aqui (rede, quota, ANTHROPIC_API_KEY
  // ausente) nunca pode derrubar um import que já persistiu com sucesso.
  // Sem narrativa gravada, getEngineeringAdvisorBriefing() simplesmente
  // devolve narrative: null e a Home usa os itens template determinísticos.
  try {
    const briefing = await getEngineeringAdvisorBriefing(supabase, companyId);

    if (!briefing.context) {
      throw new Error("Advisor sem contexto rico (nenhum decision snapshot disponível ainda).");
    }

    const narration = await narrateEngineeringBriefing(briefing.context);
    const validation = validateEngineeringAdvisorSummary(narration.raw, briefing.context);

    if (!validation.valid) {
      throw new Error(`Resposta do Claude reprovada na validação: ${validation.reason}`);
    }

    await insertAdvisorNarrative(supabase, {
      companyId,
      engineeringProjectId,
      decisionSnapshotId,
      model: narration.model,
      narrative: renderEngineeringAdvisorSummaryToText(validation.summary)
    });
  } catch (error) {
    console.error("[bba-project-import] Falha ao gerar narrativa do Advisor (fallback: itens template).", error);
  }

  return NextResponse.json(snapshot);
}

const DEFAULT_RECOMMENDATION_SEVERITY = "medium";

/**
 * `Recommendation.metadata.decisionPriority` guarda o valor do enum
 * `DecisionPriority` ("low"/"medium"/"high"/"critical") como
 * `unknown` — este helper só faz a leitura seguro dele para
 * `recommendations.severity` (TEXT, copiado no momento da criação
 * para listagem rápida, nunca ressincronizado depois).
 */
function getRecommendationSeverity(recommendation: { metadata: Readonly<Record<string, unknown>> }): string {
  const value = recommendation.metadata.decisionPriority;
  return typeof value === "string" && value.trim().length > 0 ? value : DEFAULT_RECOMMENDATION_SEVERITY;
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
