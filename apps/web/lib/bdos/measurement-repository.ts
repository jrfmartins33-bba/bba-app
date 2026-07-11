import type { SupabaseClient } from "@supabase/supabase-js";

// Repository do Studio de Medições (Epic 19, Sprint 4A) — mesmo
// motivo de measurement-repository.ts viver em apps/web e não em
// @bba/bdos-core que já vale para repository.ts (depende do
// SupabaseClient autenticado server-side). Arquivo próprio, separado
// de repository.ts (Project/Execution/Advisor): domínios diferentes,
// mesma disciplina de separação já praticada no resto do bdos-core.
//
// Fronteira obrigatória (Epic 19, Sprint 4.0): este arquivo não
// conhece Excel, parser ou HTTP — só persiste o que o Application
// Service (Sprint 4D, ainda não escrito) já decidiu. Nenhuma função
// aqui interpreta um arquivo nem decide numeração de boletim; isso é
// responsabilidade do Application Service.

const POSTGRES_UNIQUE_VIOLATION = "23505";

// ---------------------------------------------------------------
// measurement_bulletin_imports
// ---------------------------------------------------------------

export type MeasurementBulletinImportStatus = "pending_upload" | "uploaded" | "processing" | "completed" | "failed";

export interface MeasurementBulletinImportRecord {
  readonly id: string;
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly fileName: string;
  readonly storagePath: string;
  readonly status: MeasurementBulletinImportStatus;
}

// `status` opcional, mesmo raciocínio de insertPlanningImport
// (repository.ts): omitido deixa o DEFAULT 'pending_upload' do schema
// decidir, quando o upload ainda não aconteceu neste ponto do fluxo.
export const insertMeasurementBulletinImport = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    companyId: string;
    engineeringProjectId: string;
    fileName: string;
    storagePath: string;
    uploadedBy: string;
    status?: MeasurementBulletinImportStatus;
  }
): Promise<void> => {
  const { error } = await supabase.from("measurement_bulletin_imports").insert({
    id: params.id,
    company_id: params.companyId,
    engineering_project_id: params.engineeringProjectId,
    file_name: params.fileName,
    storage_path: params.storagePath,
    uploaded_by: params.uploadedBy,
    ...(params.status ? { status: params.status } : {})
  });

  if (error) {
    throw error;
  }
};

export const getMeasurementBulletinImportById = async (
  supabase: SupabaseClient,
  params: { id: string; companyId: string }
): Promise<MeasurementBulletinImportRecord | null> => {
  const { data, error } = await supabase
    .from("measurement_bulletin_imports")
    .select("id, company_id, engineering_project_id, file_name, storage_path, status")
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
    fileName: data.file_name as string,
    storagePath: data.storage_path as string,
    status: data.status as MeasurementBulletinImportStatus
  };
};

export const updateMeasurementBulletinImportStatus = async (
  supabase: SupabaseClient,
  params: { id: string; companyId: string; status: MeasurementBulletinImportStatus }
): Promise<void> => {
  const { error } = await supabase
    .from("measurement_bulletin_imports")
    .update({ status: params.status })
    .eq("id", params.id)
    .eq("company_id", params.companyId);

  if (error) {
    throw error;
  }
};

// ---------------------------------------------------------------
// work_packages
// ---------------------------------------------------------------

export type WorkPackageType =
  | "scope_group"
  | "execution_front"
  | "cost_group"
  | "administration"
  | "mobilization"
  | "demobilization"
  | "other";

export interface WorkPackageRecord {
  readonly id: string;
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly code: string;
  readonly normalizedCode: string;
  readonly name: string;
  readonly type: WorkPackageType;
  readonly parentWorkPackageId: string | null;
}

const selectWorkPackageColumns = "id, company_id, engineering_project_id, code, normalized_code, name, type, parent_work_package_id";

const toWorkPackageRecord = (data: Record<string, unknown>): WorkPackageRecord => ({
  id: data.id as string,
  companyId: data.company_id as string,
  engineeringProjectId: data.engineering_project_id as string,
  code: data.code as string,
  normalizedCode: data.normalized_code as string,
  name: data.name as string,
  type: data.type as WorkPackageType,
  parentWorkPackageId: (data.parent_work_package_id as string | null) ?? null
});

// Identidade canônica de EAP (Epic 19, Sprint 2B): find-or-create por
// (engineering_project_id, normalized_code), nunca duas linhas para o
// mesmo nó. A UNIQUE já existente na tabela é a última linha de
// defesa contra concorrência real (duas chamadas simultâneas tentando
// criar o mesmo work_package): tenta inserir; se colidir (23505),
// relê a linha existente — nunca cria uma identidade alternativa nem
// gera um código novo silenciosamente.
export const findOrCreateWorkPackage = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    companyId: string;
    engineeringProjectId: string;
    code: string;
    normalizedCode: string;
    name: string;
    type: WorkPackageType;
    parentWorkPackageId: string | null;
  }
): Promise<WorkPackageRecord> => {
  const { data: inserted, error: insertError } = await supabase
    .from("work_packages")
    .insert({
      id: params.id,
      company_id: params.companyId,
      engineering_project_id: params.engineeringProjectId,
      code: params.code,
      normalized_code: params.normalizedCode,
      name: params.name,
      type: params.type,
      parent_work_package_id: params.parentWorkPackageId
    })
    .select(selectWorkPackageColumns)
    .single();

  if (!insertError && inserted) {
    return toWorkPackageRecord(inserted);
  }

  if (insertError?.code !== POSTGRES_UNIQUE_VIOLATION) {
    throw insertError ?? new Error("Nao foi possivel criar o WorkPackage.");
  }

  const { data: existing, error: selectError } = await supabase
    .from("work_packages")
    .select(selectWorkPackageColumns)
    .eq("engineering_project_id", params.engineeringProjectId)
    .eq("normalized_code", params.normalizedCode)
    .single();

  if (selectError || !existing) {
    throw selectError ?? new Error("WorkPackage colidiu na criacao mas nao foi encontrado na releitura.");
  }

  return toWorkPackageRecord(existing);
};

// ---------------------------------------------------------------
// managed_service_items
// ---------------------------------------------------------------

export type ManagedServiceItemMeasurementType = "quantity" | "percentage" | "lump_sum";

export interface ManagedServiceItemRecord {
  readonly id: string;
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly workPackageId: string;
  readonly code: string;
  readonly description: string;
  readonly unit: string;
  readonly contractQuantity: number;
  readonly unitPrice: number;
}

const selectManagedServiceItemColumns =
  "id, company_id, engineering_project_id, work_package_id, code, description, unit, contract_quantity, unit_price";

const toManagedServiceItemRecord = (data: Record<string, unknown>): ManagedServiceItemRecord => ({
  id: data.id as string,
  companyId: data.company_id as string,
  engineeringProjectId: data.engineering_project_id as string,
  workPackageId: data.work_package_id as string,
  code: data.code as string,
  description: data.description as string,
  unit: data.unit as string,
  contractQuantity: Number(data.contract_quantity),
  unitPrice: Number(data.unit_price)
});

export type FindMatchingManagedServiceItemOutcome = "matched" | "created";

export interface FindMatchingManagedServiceItemResult {
  readonly item: ManagedServiceItemRecord;
  readonly outcome: FindMatchingManagedServiceItemOutcome;
}

// ATENÇÃO — nome deliberadamente diferente de "findOrCreate": esta
// função NÃO garante identidade, ao contrário de findOrCreateWorkPackage.
//
// Diferente de work_packages (UNIQUE(engineering_project_id,
// normalized_code) + insert-e-capturar-23505), managed_service_items
// NÃO tem mais UNIQUE(engineering_project_id, code) — removida na
// revisão da Sprint 3 porque códigos reais variam demais entre órgãos
// contratantes (DNIT, DER, DNOCS, Codevasf, Seinfra, ...) para
// congelar essa regra sem mais evidência.
//
// Consequência: "identidade" aqui é correlação heurística por texto
// (engineering_project_id + code), não uma garantia de banco.
//   - Concorrência: SELECT → não encontrou → INSERT não é atômico.
//     Duas chamadas simultâneas para o mesmo código podem ambas
//     tentar criar, resultando em duas linhas com o mesmo `code` — o
//     banco permite isso desde a Sprint 3, deliberadamente. Esta
//     função não tenta recriar no repository a unicidade que
//     removemos conscientemente do schema.
//   - Falso positivo: se o MESMO código já foi usado para um item
//     genuinamente diferente (descrição/unidade diferentes — o
//     próprio motivo real de existirem códigos repetidos), esta
//     função ainda retorna o primeiro match por código, sem comparar
//     description/unit. O outcome "matched" é sinal para o Application
//     Service inspecionar `item.description`/`item.unit` contra o que
//     acabou de ser declarado e decidir se aceita a correlação ou
//     trata como um item novo (create explícito por outro caminho) —
//     decisão de negócio, não deste repository.
//   - Retentativas do mesmo import: idempotentes no caso comum (uma
//     chamada sequencial após outra encontra a linha já criada), mas
//     nada aqui usa `measurement_bulletin_import_id` ou
//     `sourceLocation` como parte da correlação — a função não sabe
//     de onde a linha "deveria" ter vindo, só compara código.
export const findMatchingManagedServiceItemOrCreate = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    companyId: string;
    engineeringProjectId: string;
    workPackageId: string;
    code: string;
    description: string;
    unit: string;
    contractQuantity: number;
    unitPrice: number;
    measurementType?: ManagedServiceItemMeasurementType;
  }
): Promise<FindMatchingManagedServiceItemResult> => {
  const { data: existing, error: selectError } = await supabase
    .from("managed_service_items")
    .select(selectManagedServiceItemColumns)
    .eq("engineering_project_id", params.engineeringProjectId)
    .eq("code", params.code)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return { item: toManagedServiceItemRecord(existing), outcome: "matched" };
  }

  const { data: created, error: insertError } = await supabase
    .from("managed_service_items")
    .insert({
      id: params.id,
      company_id: params.companyId,
      engineering_project_id: params.engineeringProjectId,
      work_package_id: params.workPackageId,
      code: params.code,
      description: params.description,
      unit: params.unit,
      contract_quantity: params.contractQuantity,
      unit_price: params.unitPrice,
      ...(params.measurementType ? { measurement_type: params.measurementType } : {})
    })
    .select(selectManagedServiceItemColumns)
    .single();

  if (insertError || !created) {
    throw insertError ?? new Error("Nao foi possivel criar o ManagedServiceItem.");
  }

  return { item: toManagedServiceItemRecord(created), outcome: "created" };
};

// ---------------------------------------------------------------
// measurement_workspaces
// ---------------------------------------------------------------

export type MeasurementWorkspaceStatus = "Draft" | "InProgress" | "ReadyForReview" | "Closed" | "Cancelled";

export interface MeasurementWorkspaceRecord {
  readonly id: string;
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly measurementBulletinImportId: string | null;
  readonly periodNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: MeasurementWorkspaceStatus;
  readonly declaredBulletinNumber: number | null;
  readonly declaredPeriodStart: string | null;
  readonly declaredPeriodEnd: string | null;
}

const selectMeasurementWorkspaceColumns =
  "id, company_id, engineering_project_id, measurement_bulletin_import_id, period_number, start_date, end_date, status, declared_bulletin_number, declared_period_start, declared_period_end";

const toMeasurementWorkspaceRecord = (data: Record<string, unknown>): MeasurementWorkspaceRecord => ({
  id: data.id as string,
  companyId: data.company_id as string,
  engineeringProjectId: data.engineering_project_id as string,
  measurementBulletinImportId: (data.measurement_bulletin_import_id as string | null) ?? null,
  periodNumber: Number(data.period_number),
  startDate: data.start_date as string,
  endDate: data.end_date as string,
  status: data.status as MeasurementWorkspaceStatus,
  declaredBulletinNumber: data.declared_bulletin_number === null ? null : Number(data.declared_bulletin_number),
  declaredPeriodStart: (data.declared_period_start as string | null) ?? null,
  declaredPeriodEnd: (data.declared_period_end as string | null) ?? null
});

// Insere sem proteção de concorrência própria — o índice único
// parcial (uq_measurement_workspaces_bulletin_import) é quem garante
// no banco que um import nunca origina dois workspaces; esta função
// deixa o erro (23505) subir para o Application Service decidir o que
// "retomar" significa (Sprint 4.0, mapa de estados de
// processMeasurementBulletinImport) — decisão de negócio, não de
// repository.
export const insertMeasurementWorkspace = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    companyId: string;
    engineeringProjectId: string;
    measurementBulletinImportId: string | null;
    periodNumber: number;
    startDate: string;
    endDate: string;
    status?: MeasurementWorkspaceStatus;
    createdBy: string;
    declaredBulletinNumber?: number | null;
    declaredPeriodStart?: string | null;
    declaredPeriodEnd?: string | null;
  }
): Promise<MeasurementWorkspaceRecord> => {
  const { data, error } = await supabase
    .from("measurement_workspaces")
    .insert({
      id: params.id,
      company_id: params.companyId,
      engineering_project_id: params.engineeringProjectId,
      measurement_bulletin_import_id: params.measurementBulletinImportId,
      period_number: params.periodNumber,
      start_date: params.startDate,
      end_date: params.endDate,
      created_by: params.createdBy,
      ...(params.status ? { status: params.status } : {}),
      ...(params.declaredBulletinNumber !== undefined ? { declared_bulletin_number: params.declaredBulletinNumber } : {}),
      ...(params.declaredPeriodStart !== undefined ? { declared_period_start: params.declaredPeriodStart } : {}),
      ...(params.declaredPeriodEnd !== undefined ? { declared_period_end: params.declaredPeriodEnd } : {})
    })
    .select(selectMeasurementWorkspaceColumns)
    .single();

  if (error || !data) {
    throw error ?? new Error("Nao foi possivel criar o MeasurementWorkspace.");
  }

  return toMeasurementWorkspaceRecord(data);
};

export const getMeasurementWorkspaceById = async (
  supabase: SupabaseClient,
  params: { id: string; companyId: string }
): Promise<MeasurementWorkspaceRecord | null> => {
  const { data, error } = await supabase
    .from("measurement_workspaces")
    .select(selectMeasurementWorkspaceColumns)
    .eq("id", params.id)
    .eq("company_id", params.companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toMeasurementWorkspaceRecord(data) : null;
};

// Primitiva de idempotência (Sprint 4.0): resolve o workspace já
// vinculado a um import, se existir. O que fazer com o resultado
// (already_completed / resumed / workspace_closed / ...) é decisão do
// Application Service, nunca desta função.
export const getMeasurementWorkspaceByImportId = async (
  supabase: SupabaseClient,
  params: { measurementBulletinImportId: string; companyId: string }
): Promise<MeasurementWorkspaceRecord | null> => {
  const { data, error } = await supabase
    .from("measurement_workspaces")
    .select(selectMeasurementWorkspaceColumns)
    .eq("measurement_bulletin_import_id", params.measurementBulletinImportId)
    .eq("company_id", params.companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toMeasurementWorkspaceRecord(data) : null;
};

// Único ponto de mudança de status permitido pelo repository — o
// trigger measurement_workspaces_prevent_update_after_close (Sprint 3)
// recusa no banco qualquer UPDATE quando o status já é Closed ou
// Cancelled; esta função nunca tenta contornar isso, só propaga o
// erro se o Application Service chamá-la fora de hora.
export const updateMeasurementWorkspaceStatus = async (
  supabase: SupabaseClient,
  params: { id: string; companyId: string; status: MeasurementWorkspaceStatus }
): Promise<void> => {
  const { error } = await supabase
    .from("measurement_workspaces")
    .update({ status: params.status })
    .eq("id", params.id)
    .eq("company_id", params.companyId);

  if (error) {
    throw error;
  }
};

// ---------------------------------------------------------------
// measurement_workspace_lines
// ---------------------------------------------------------------

export interface MeasurementWorkspaceLineRecord {
  readonly id: string;
  readonly measurementWorkspaceId: string;
  readonly managedServiceItemId: string;
  readonly quantity: number;
  readonly unitValue: number;
  readonly totalValue: number;
  readonly declaredQuantity: number | null;
  readonly declaredUnitValue: number | null;
  readonly declaredTotalValue: number | null;
}

const selectMeasurementWorkspaceLineColumns =
  "id, measurement_workspace_id, managed_service_item_id, quantity, unit_value, total_value, declared_quantity, declared_unit_value, declared_total_value";

const toMeasurementWorkspaceLineRecord = (data: Record<string, unknown>): MeasurementWorkspaceLineRecord => ({
  id: data.id as string,
  measurementWorkspaceId: data.measurement_workspace_id as string,
  managedServiceItemId: data.managed_service_item_id as string,
  quantity: Number(data.quantity),
  unitValue: Number(data.unit_value),
  totalValue: Number(data.total_value),
  declaredQuantity: data.declared_quantity === null ? null : Number(data.declared_quantity),
  declaredUnitValue: data.declared_unit_value === null ? null : Number(data.declared_unit_value),
  declaredTotalValue: data.declared_total_value === null ? null : Number(data.declared_total_value)
});

// total_value é sempre passado pelo Application Service já recalculado
// (quantity * unit_value) — este repository nunca recalcula nada,
// mesma disciplina de insertPlanningDataset em repository.ts (não
// conhece a forma interna do que grava). UNIQUE(measurement_workspace_id,
// managed_service_item_id) já existente é a última linha de defesa
// contra duas linhas para o mesmo item no mesmo workspace.
export const insertMeasurementWorkspaceLine = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    measurementWorkspaceId: string;
    managedServiceItemId: string;
    quantity: number;
    unitValue: number;
    totalValue: number;
    declaredQuantity: number | null;
    declaredUnitValue: number | null;
    declaredTotalValue: number | null;
    notes?: string;
  }
): Promise<MeasurementWorkspaceLineRecord> => {
  const { data, error } = await supabase
    .from("measurement_workspace_lines")
    .insert({
      id: params.id,
      measurement_workspace_id: params.measurementWorkspaceId,
      managed_service_item_id: params.managedServiceItemId,
      quantity: params.quantity,
      unit_value: params.unitValue,
      total_value: params.totalValue,
      declared_quantity: params.declaredQuantity,
      declared_unit_value: params.declaredUnitValue,
      declared_total_value: params.declaredTotalValue,
      ...(params.notes ? { notes: params.notes } : {})
    })
    .select(selectMeasurementWorkspaceLineColumns)
    .single();

  if (error || !data) {
    throw error ?? new Error("Nao foi possivel criar a MeasurementWorkspaceLine.");
  }

  return toMeasurementWorkspaceLineRecord(data);
};

export const listMeasurementWorkspaceLines = async (
  supabase: SupabaseClient,
  params: { measurementWorkspaceId: string }
): Promise<ReadonlyArray<MeasurementWorkspaceLineRecord>> => {
  const { data, error } = await supabase
    .from("measurement_workspace_lines")
    .select(selectMeasurementWorkspaceLineColumns)
    .eq("measurement_workspace_id", params.measurementWorkspaceId);

  if (error) {
    throw error;
  }

  return (data ?? []).map(toMeasurementWorkspaceLineRecord);
};

// ---------------------------------------------------------------
// measurement_bulletins
// ---------------------------------------------------------------

export type MeasurementBulletinStatus = "Draft" | "Validated" | "Finalized" | "Cancelled";

export interface MeasurementBulletinRecord {
  readonly id: string;
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly measurementWorkspaceId: string;
  readonly bulletinNumber: number;
  readonly periodNumber: number;
  readonly issueDate: string;
  readonly status: MeasurementBulletinStatus;
  readonly finalizedAt: string | null;
}

const selectMeasurementBulletinColumns =
  "id, company_id, engineering_project_id, measurement_workspace_id, bulletin_number, period_number, issue_date, status, finalized_at";

const toMeasurementBulletinRecord = (data: Record<string, unknown>): MeasurementBulletinRecord => ({
  id: data.id as string,
  companyId: data.company_id as string,
  engineeringProjectId: data.engineering_project_id as string,
  measurementWorkspaceId: data.measurement_workspace_id as string,
  bulletinNumber: Number(data.bulletin_number),
  periodNumber: Number(data.period_number),
  issueDate: data.issue_date as string,
  status: data.status as MeasurementBulletinStatus,
  finalizedAt: (data.finalized_at as string | null) ?? null
});

// bulletinNumber já vem decidido pelo Application Service (regra de
// numeração, Sprint 4.0) — este repository nunca escolhe o número,
// só grava o que recebe. lines/totals/validationIssues são gravados
// verbatim (JSONB), mesma disciplina de insertPlanningDataset.
export const insertMeasurementBulletin = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    companyId: string;
    engineeringProjectId: string;
    measurementWorkspaceId: string;
    bulletinNumber: number;
    periodNumber: number;
    issueDate: string;
    lines: unknown;
    totals: unknown;
    validationIssues: unknown;
  }
): Promise<MeasurementBulletinRecord> => {
  const { data, error } = await supabase
    .from("measurement_bulletins")
    .insert({
      id: params.id,
      company_id: params.companyId,
      engineering_project_id: params.engineeringProjectId,
      measurement_workspace_id: params.measurementWorkspaceId,
      bulletin_number: params.bulletinNumber,
      period_number: params.periodNumber,
      issue_date: params.issueDate,
      lines: params.lines,
      totals: params.totals,
      validation_issues: params.validationIssues
    })
    .select(selectMeasurementBulletinColumns)
    .single();

  if (error || !data) {
    throw error ?? new Error("Nao foi possivel criar o MeasurementBulletin.");
  }

  return toMeasurementBulletinRecord(data);
};

export const getMeasurementBulletinById = async (
  supabase: SupabaseClient,
  params: { id: string; companyId: string }
): Promise<MeasurementBulletinRecord | null> => {
  const { data, error } = await supabase
    .from("measurement_bulletins")
    .select(selectMeasurementBulletinColumns)
    .eq("id", params.id)
    .eq("company_id", params.companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toMeasurementBulletinRecord(data) : null;
};

// Único ponto de transição de status permitido pelo repository — o
// trigger prevent_measurement_bulletin_update_after_finalization
// (Sprint 3) recusa no banco qualquer UPDATE quando o boletim já está
// Finalized, sem exceção. finalizedAt só é passado na transição para
// 'Finalized' (o CHECK measurement_bulletins_finalized_at_consistent
// exige os dois juntos ou nenhum).
export const updateMeasurementBulletinStatus = async (
  supabase: SupabaseClient,
  params: { id: string; companyId: string; status: MeasurementBulletinStatus; finalizedAt?: string }
): Promise<void> => {
  const { error } = await supabase
    .from("measurement_bulletins")
    .update({
      status: params.status,
      ...(params.finalizedAt ? { finalized_at: params.finalizedAt } : {})
    })
    .eq("id", params.id)
    .eq("company_id", params.companyId);

  if (error) {
    throw error;
  }
};
