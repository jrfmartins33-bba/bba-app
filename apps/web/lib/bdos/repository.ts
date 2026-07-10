import type { SupabaseClient } from "@supabase/supabase-js";

// Repository do BDOS (Sprint 13.6) — escreve nas tabelas desenhadas em
// docs/BDOS_PERSISTENCE_ARCHITECTURE.md (Sprint 13.4) e no bucket
// bdos-imports (Sprint 13.5). Vive em apps/web, não em @bba/lib ou
// @bba/bdos-core, porque depende do SupabaseClient autenticado
// server-side (cookie de sessão via Route Handler), não do cliente
// browser genérico usado pelos outros domínios.

const WORKSPACE_TYPE_ENGENHARIA = "engenharia";
const DEFAULT_ENGINEERING_PROJECT_NAME = "Projeto de Engenharia";

export type EnsuredWorkspace = { id: string };
export type EnsuredEngineeringProject = { id: string };

export const ensureEngenhariaWorkspace = async (
  supabase: SupabaseClient,
  companyId: string
): Promise<EnsuredWorkspace> => {
  const { data: existing, error: selectError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("company_id", companyId)
    .eq("workspace_type", WORKSPACE_TYPE_ENGENHARIA)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: insertError } = await supabase
    .from("workspaces")
    .insert({ company_id: companyId, workspace_type: WORKSPACE_TYPE_ENGENHARIA })
    .select("id")
    .single();

  if (insertError || !created) {
    throw insertError ?? new Error("Nao foi possivel criar a Workspace de Engenharia.");
  }

  return created;
};

export const ensureDefaultEngineeringProject = async (
  supabase: SupabaseClient,
  companyId: string,
  workspaceId: string
): Promise<EnsuredEngineeringProject> => {
  const { data: existing, error: selectError } = await supabase
    .from("engineering_projects")
    .select("id")
    .eq("company_id", companyId)
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: insertError } = await supabase
    .from("engineering_projects")
    .insert({
      company_id: companyId,
      workspace_id: workspaceId,
      name: DEFAULT_ENGINEERING_PROJECT_NAME
    })
    .select("id")
    .single();

  if (insertError || !created) {
    throw insertError ?? new Error("Nao foi possivel criar o Projeto de Engenharia padrao.");
  }

  return created;
};

export const uploadPlanningImportFile = async (
  supabase: SupabaseClient,
  params: {
    companyId: string;
    engineeringProjectId: string;
    planningImportId: string;
    fileName: string;
    bytes: Uint8Array;
    contentType: string;
  }
): Promise<string> => {
  const storagePath = `${params.companyId}/${params.engineeringProjectId}/${params.planningImportId}/${params.fileName}`;

  const { error } = await supabase.storage.from("bdos-imports").upload(storagePath, params.bytes, {
    contentType: params.contentType,
    upsert: false
  });

  if (error) {
    throw error;
  }

  return storagePath;
};

export type PlanningImportStatus = "pending_upload" | "uploaded" | "processing" | "completed" | "failed";

export interface PlanningImportRecord {
  readonly id: string;
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly sourceType: "ms-project-xml" | "excel";
  readonly fileName: string;
  readonly storagePath: string;
  readonly status: PlanningImportStatus;
}

// `status` é opcional de propósito: a rota nova (Epic 18,
// prepare-upload) omite o campo e deixa o DEFAULT 'pending_upload' do
// schema decidir (o upload ainda não aconteceu nesse ponto). A rota
// antiga (/api/bba-project/import) passa 'uploaded' explicitamente,
// porque nesse fluxo o upload já terminou antes deste INSERT rodar —
// sem isso, toda linha da rota antiga ficaria mentindo
// "pending_upload" para sempre (ver RESILIENT_PLANNING_IMPORT.md).
export const insertPlanningImport = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    companyId: string;
    engineeringProjectId: string;
    sourceType: "ms-project-xml" | "excel";
    fileName: string;
    storagePath: string;
    uploadedBy: string;
    status?: PlanningImportStatus;
  }
): Promise<void> => {
  const { error } = await supabase.from("planning_imports").insert({
    id: params.id,
    company_id: params.companyId,
    engineering_project_id: params.engineeringProjectId,
    source_type: params.sourceType,
    file_name: params.fileName,
    storage_path: params.storagePath,
    uploaded_by: params.uploadedBy,
    ...(params.status ? { status: params.status } : {})
  });

  if (error) {
    throw error;
  }
};

// Epic 18 — resolve o planning_import pelo id, sempre escopado à
// empresa autenticada (RLS já garante isso na query, mas o filtro
// explícito documenta a intenção e evita depender só do RLS para
// legibilidade). Nunca confia num storagePath vindo do cliente — quem
// chama esta função sempre usa o storage_path que o PRÓPRIO servidor
// persistiu no prepare-upload.
export const getPlanningImportById = async (
  supabase: SupabaseClient,
  params: { id: string; companyId: string }
): Promise<PlanningImportRecord | null> => {
  const { data, error } = await supabase
    .from("planning_imports")
    .select("id, company_id, engineering_project_id, source_type, file_name, storage_path, status")
    .eq("id", params.id)
    .eq("company_id", params.companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    companyId: data.company_id as string,
    engineeringProjectId: data.engineering_project_id as string,
    sourceType: data.source_type as "ms-project-xml" | "excel",
    fileName: data.file_name as string,
    storagePath: data.storage_path as string,
    status: data.status as PlanningImportStatus
  };
};

// Epic 18 — única forma de mudar o ciclo operacional de um
// planning_import (nunca reescreve source_type/file_name/storage_path
// — esses continuam proveniência imutável, ver RESILIENT_PLANNING_IMPORT.md).
export const updatePlanningImportStatus = async (
  supabase: SupabaseClient,
  params: { id: string; companyId: string; status: PlanningImportStatus }
): Promise<void> => {
  const { error } = await supabase
    .from("planning_imports")
    .update({ status: params.status })
    .eq("id", params.id)
    .eq("company_id", params.companyId);

  if (error) {
    throw error;
  }
};

// Camada 2 do pipeline BDOS (Sprint 13.7) — Planning Dataset
// normalizado, guardado verbatim como JSONB (ver
// docs/BDOS_PERSISTENCE_ARCHITECTURE.md, seção 5.2). `dataset` é o
// `PlanningDataset` completo vindo de `importPlanningSource`; este
// repository não conhece sua forma interna, só o grava. Retorna o id
// porque a Camada 3 (decision_snapshots) referencia esta linha.
export const insertPlanningDataset = async (
  supabase: SupabaseClient,
  params: {
    companyId: string;
    engineeringProjectId: string;
    planningImportId: string;
    datasetSchemaVersion: number;
    detectedType: string;
    dataset: unknown;
  }
): Promise<{ id: string }> => {
  const { data, error } = await supabase
    .from("planning_datasets")
    .insert({
      company_id: params.companyId,
      engineering_project_id: params.engineeringProjectId,
      planning_import_id: params.planningImportId,
      dataset_schema_version: params.datasetSchemaVersion,
      detected_type: params.detectedType,
      dataset: params.dataset
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Nao foi possivel gravar o Planning Dataset.");
  }

  return data;
};

// Camada 3 do pipeline BDOS (Sprint 13.8) — Decision Snapshot, memória
// técnica imutável (ver docs/BDOS_PERSISTENCE_ARCHITECTURE.md, seção
// 5.3). `decisions`/`recommendations` são os arrays completos vindos
// do Decision Engine, gravados verbatim; este repository não conhece
// sua forma interna.
export const insertDecisionSnapshot = async (
  supabase: SupabaseClient,
  params: {
    companyId: string;
    engineeringProjectId: string;
    planningDatasetId: string;
    engineVersion: string;
    triggerReason: "import" | "manual_recalculation" | "scheduled";
    computedBy: string | null;
    decisions: unknown;
    recommendations: unknown;
    healthScore: number;
    healthScoreLevel: string;
  }
): Promise<{ id: string }> => {
  const { data, error } = await supabase
    .from("decision_snapshots")
    .insert({
      company_id: params.companyId,
      engineering_project_id: params.engineeringProjectId,
      planning_dataset_id: params.planningDatasetId,
      engine_version: params.engineVersion,
      trigger_reason: params.triggerReason,
      computed_by: params.computedBy,
      decisions: params.decisions,
      recommendations: params.recommendations,
      health_score: params.healthScore,
      health_score_level: params.healthScoreLevel
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Nao foi possivel gravar o Decision Snapshot.");
  }

  return data;
};

const POSTGRES_UNIQUE_VIOLATION = "23505";

export type PersistRecommendationOutcome = "created" | "already_active";

// Advisor persistente (Sprint 13.9) — memória operacional. A
// idempotência é garantida pelo índice único parcial
// `recommendations_active_ref_unique` (ver migration
// 20260707210000), não por esta função: aqui só tentamos o INSERT e
// tratamos a violação de unicidade (23505) como "já existe uma
// recommendation ativa para este risco, não duplicar" — nunca
// atualizamos ou sincronizamos a linha existente, porque ela pode já
// estar sendo tratada por um humano (status/owner mudados
// manualmente).
export const persistRecommendation = async (
  supabase: SupabaseClient,
  params: {
    companyId: string;
    workspaceId: string;
    engineeringProjectId: string;
    decisionSnapshotId: string;
    recommendationRefId: string;
    title: string;
    severity: string;
  }
): Promise<PersistRecommendationOutcome> => {
  const { error } = await supabase.from("recommendations").insert({
    company_id: params.companyId,
    workspace_id: params.workspaceId,
    engineering_project_id: params.engineeringProjectId,
    decision_snapshot_id: params.decisionSnapshotId,
    recommendation_ref_id: params.recommendationRefId,
    title: params.title,
    severity: params.severity
  });

  if (!error) {
    return "created";
  }

  if (error.code === POSTGRES_UNIQUE_VIOLATION) {
    return "already_active";
  }

  throw error;
};

// BBA Advisor — narrativa via Claude (Sprint 13.12). Uma linha por
// decision_snapshot (índice único `advisor_narratives_snapshot_unique`);
// chamado no máximo uma vez por import, logo após o snapshot ser gravado.
// Se `narrateEngineeringBriefing` (packages/bdos-core) já falhou, esta
// função nunca é chamada — não há "narrativa vazia" gravada.
export const insertAdvisorNarrative = async (
  supabase: SupabaseClient,
  params: {
    companyId: string;
    engineeringProjectId: string;
    decisionSnapshotId: string;
    model: string;
    narrative: string;
  }
): Promise<void> => {
  const { error } = await supabase.from("advisor_narratives").insert({
    company_id: params.companyId,
    engineering_project_id: params.engineeringProjectId,
    decision_snapshot_id: params.decisionSnapshotId,
    model: params.model,
    narrative: params.narrative
  });

  if (error) {
    throw error;
  }
};
