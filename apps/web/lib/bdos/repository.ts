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
  }
): Promise<void> => {
  const { error } = await supabase.from("planning_imports").insert({
    id: params.id,
    company_id: params.companyId,
    engineering_project_id: params.engineeringProjectId,
    source_type: params.sourceType,
    file_name: params.fileName,
    storage_path: params.storagePath,
    uploaded_by: params.uploadedBy
  });

  if (error) {
    throw error;
  }
};

// Camada 2 do pipeline BDOS (Sprint 13.7) — Planning Dataset
// normalizado, guardado verbatim como JSONB (ver
// docs/BDOS_PERSISTENCE_ARCHITECTURE.md, seção 5.2). `dataset` é o
// `PlanningDataset` completo vindo de `importPlanningSource`; este
// repository não conhece sua forma interna, só o grava.
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
): Promise<void> => {
  const { error } = await supabase.from("planning_datasets").insert({
    company_id: params.companyId,
    engineering_project_id: params.engineeringProjectId,
    planning_import_id: params.planningImportId,
    dataset_schema_version: params.datasetSchemaVersion,
    detected_type: params.detectedType,
    dataset: params.dataset
  });

  if (error) {
    throw error;
  }
};
