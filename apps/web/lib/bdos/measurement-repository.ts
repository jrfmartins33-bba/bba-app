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
  // Achado real (E2E contra o BM_08, Sprint 4B): measurement_workspaces.created_by
  // referencia profiles(id), não company_id -- o Application Service
  // precisa do uploader original para não violar
  // measurement_workspaces_created_by_fkey ao criar o workspace.
  readonly uploadedBy: string;
  // Snapshot imutável da última execução (Sprint 4D.0, R2) -- unknown
  // porque este repository nunca interpreta a forma do JSON, mesma
  // disciplina do restante do arquivo para colunas JSONB. Consumidor
  // imediato: o caminho already_completed da idempotência (Sprint
  // 4D.2) precisa devolver o resultado já persistido sem reprocessar
  // o arquivo nem fazer uma segunda consulta só para esta coluna.
  readonly analysisResult: unknown | null;
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

const selectMeasurementBulletinImportColumns =
  "id, company_id, engineering_project_id, file_name, storage_path, status, analysis_result, uploaded_by";

// analysisResult passa verbatim -- este repository não valida nem faz
// cast para MeasurementAnalysisResult; essa é responsabilidade do
// Application Service (Sprint 4D.2), o único lugar que conhece a
// forma exata do contrato.
const toMeasurementBulletinImportRecord = (data: Record<string, unknown>): MeasurementBulletinImportRecord => ({
  id: data.id as string,
  companyId: data.company_id as string,
  engineeringProjectId: data.engineering_project_id as string,
  fileName: data.file_name as string,
  uploadedBy: data.uploaded_by as string,
  storagePath: data.storage_path as string,
  status: data.status as MeasurementBulletinImportStatus,
  analysisResult: data.analysis_result ?? null
});

// `companyId` opcional -- omitido só quando o chamador já confirmou
// (requireAuthenticatedActor) que o ator é bba_admin, autorizado pela
// RLS a ler qualquer empresa (`company_id = get_my_company_id() OR
// is_bba_admin()`). Continua sendo o filtro obrigatório para todo
// cliente comum -- este parâmetro nunca é opcional nas chamadas
// company-scoped já existentes.
export const getMeasurementBulletinImportById = async (
  supabase: SupabaseClient,
  params: { id: string; companyId?: string }
): Promise<MeasurementBulletinImportRecord | null> => {
  let query = supabase.from("measurement_bulletin_imports").select(selectMeasurementBulletinImportColumns).eq("id", params.id);
  if (params.companyId) {
    query = query.eq("company_id", params.companyId);
  }
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toMeasurementBulletinImportRecord(data) : null;
};

// Epic 20 (Decision Experience), Sprint 20.1E.1A -- select próprio,
// nunca reaproveita selectMeasurementBulletinImportColumns/
// MeasurementBulletinImportRecord (usados por getMeasurementBulletinImportById
// e pelo fluxo de processamento do Epic 19): esta consulta precisa de
// uploaded_at/updated_at (não expostos ali) e nunca pode arrastar o
// JSON de analysis_result inteiro do banco só para calcular um
// boolean -- por isso hasAnalysisResult vem de uma segunda consulta
// leve (só `id`), nunca do payload completo.
export interface MeasurementBulletinImportSummary {
  readonly id: string;
  readonly fileName: string;
  readonly status: MeasurementBulletinImportStatus;
  readonly uploadedAt: string;
  readonly updatedAt: string;
  /**
   * `analysis_result IS NOT NULL` -- nunca `status === "completed"`.
   * Achado real do Epic 19: `finalizeAsFailed` persiste
   * `analysis_result` (um `FailedMeasurementAnalysisResult`) mesmo
   * quando `status` vira `"failed"` (gates de bloqueio,
   * measurement-bulletin-import-service.ts) -- por isso a análise
   * pode estar disponível mesmo sem `status: "completed"`. Mesmo
   * sinal que 20.1C (`getMeasurementDecisionBrief`) já usa para
   * decidir `analysis_not_available`.
   */
  readonly hasAnalysisResult: boolean;
}

const selectMeasurementBulletinImportSummaryColumns = "id, file_name, status, uploaded_at, updated_at";

const toMeasurementBulletinImportSummary = (data: Record<string, unknown>, hasAnalysisResult: boolean): MeasurementBulletinImportSummary => ({
  id: data.id as string,
  fileName: data.file_name as string,
  status: data.status as MeasurementBulletinImportStatus,
  uploadedAt: data.uploaded_at as string,
  updatedAt: data.updated_at as string,
  hasAnalysisResult
});

/**
 * Tenant-scoped, sem paginação -- nenhuma infraestrutura de paginação
 * existe hoje em nenhuma rota de listagem do projeto
 * (advisor-lab/projects, execution/tasks); inventar um `limit`
 * arbitrário aqui seria Categoria C. Ordenação por `uploaded_at`
 * descendente -- mesmo critério já usado por `advisor.ts` para achar
 * o `planning_import` mais recente do projeto.
 *
 * Duas consultas leves em vez de uma view/RPC nova: não existe hoje
 * uma coluna booleana persistida `analysis_available`, e criar uma
 * (migration/view) ampliaria o escopo desta Sprint. Consistência
 * transitória entre as duas leituras é aceitável -- esta listagem é
 * navegação, nunca a fonte da decisão (a rota de detalhe, 20.1D,
 * continua sendo a fonte real de `analysisAvailable` no momento em
 * que o usuário abre um boletim específico).
 */
export const listMeasurementBulletinImportsByCompany = async (
  supabase: SupabaseClient,
  params: { companyId: string }
): Promise<ReadonlyArray<MeasurementBulletinImportSummary>> => {
  const { data, error } = await supabase
    .from("measurement_bulletin_imports")
    .select(selectMeasurementBulletinImportSummaryColumns)
    .eq("company_id", params.companyId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw error;
  }

  const { data: rowsWithAnalysis, error: analysisError } = await supabase
    .from("measurement_bulletin_imports")
    .select("id")
    .eq("company_id", params.companyId)
    .not("analysis_result", "is", null);

  if (analysisError) {
    throw analysisError;
  }

  const idsWithAnalysis = new Set((rowsWithAnalysis ?? []).map((row: Record<string, unknown>) => row.id as string));

  return (data ?? []).map((row) => toMeasurementBulletinImportSummary(row as Record<string, unknown>, idsWithAnalysis.has((row as Record<string, unknown>).id as string)));
};

export interface MeasurementBulletinImportSummaryWithCompany extends MeasurementBulletinImportSummary {
  readonly companyId: string;
  /** `companies.name` -- null só se a empresa referenciada foi removida (nunca acontece hoje, DELETE bloqueado em toda a cadeia). */
  readonly companyName: string | null;
}

const selectMeasurementBulletinImportSummaryWithCompanyColumns =
  "id, file_name, status, uploaded_at, updated_at, company_id, companies(name)";

// Cross-tenant -- exclusivo para bba_admin (RLS já autoriza via
// is_bba_admin() nas policies de measurement_bulletin_imports;
// requireAuthenticatedActor, na fronteira da rota, é quem garante que
// só um admin real chega até aqui). Nunca aceita companyId: listar
// "todas as empresas para um cliente comum" não é um caso de uso,
// seria uma forma de bypass -- a distinção entre esta função e
// listMeasurementBulletinImportsByCompany é a própria fronteira de
// autorização, não um parâmetro opcional.
export const listAllMeasurementBulletinImportsForAdmin = async (
  supabase: SupabaseClient
): Promise<ReadonlyArray<MeasurementBulletinImportSummaryWithCompany>> => {
  const { data, error } = await supabase
    .from("measurement_bulletin_imports")
    .select(selectMeasurementBulletinImportSummaryWithCompanyColumns)
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw error;
  }

  const { data: rowsWithAnalysis, error: analysisError } = await supabase
    .from("measurement_bulletin_imports")
    .select("id")
    .not("analysis_result", "is", null);

  if (analysisError) {
    throw analysisError;
  }

  const idsWithAnalysis = new Set((rowsWithAnalysis ?? []).map((row: Record<string, unknown>) => row.id as string));

  return (data ?? []).map((row) => {
    const typedRow = row as Record<string, unknown>;
    const company = typedRow.companies as { name: string | null } | { name: string | null }[] | null;
    const companyName = Array.isArray(company) ? (company[0]?.name ?? null) : (company?.name ?? null);
    return {
      ...toMeasurementBulletinImportSummary(typedRow, idsWithAnalysis.has(typedRow.id as string)),
      companyId: typedRow.company_id as string,
      companyName
    };
  });
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

// Correção 4 (revisão de arquitetura da Sprint 4D) — claim atômico:
// UPDATE ... WHERE status IN ('uploaded', 'failed') é uma única
// instrução SQL via PostgREST, portanto atômica no Postgres. Duas
// chamadas concorrentes para o mesmo import nunca reivindicam a mesma
// linha -- a que perder a corrida encontra 0 linhas afetadas.
// maybeSingle() com 0 linhas retorna null sem erro; o Application
// Service interpreta null como "não pude reivindicar" (already_processing
// ou status inesperado), nunca como sucesso silencioso. Não tenta
// distinguir os dois motivos aqui -- essa distinção, se vier a
// importar, é decisão do Application Service (Sprint 4D.2), não deste
// repository.
export const claimMeasurementBulletinImportForProcessing = async (
  supabase: SupabaseClient,
  params: { id: string; companyId: string }
): Promise<MeasurementBulletinImportRecord | null> => {
  const { data, error } = await supabase
    .from("measurement_bulletin_imports")
    .update({ status: "processing" })
    .eq("id", params.id)
    .eq("company_id", params.companyId)
    .in("status", ["uploaded", "failed"])
    .select(selectMeasurementBulletinImportColumns)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toMeasurementBulletinImportRecord(data) : null;
};

export type MeasurementBulletinImportFinalStatus = "completed" | "failed";

// Correção 5 -- analysis_result e o status final (completed/failed)
// são gravados na MESMA atualização de linha, nunca em duas chamadas
// separadas. Evita as duas inconsistências que a versão anterior do
// desenho permitia: um import completed sem resultado, ou um
// resultado persistido enquanto o status ainda mostra processing.
// analysisResult é gravado verbatim (JSONB) -- este repository nunca
// interpreta sua forma, mesma disciplina de insertMeasurementBulletin
// para lines/totals/validationIssues. O snapshot é imutável por
// execução (Parte XII, R2): uma retomada que produz um novo resultado
// simplesmente substitui o valor desta coluna, não acumula histórico.
//
// Guarda simétrica ao claim: só finaliza uma linha que está
// efetivamente em 'processing' (`.in("status", ["processing"])`,
// mesma mecânica atômica de claimMeasurementBulletinImportForProcessing).
// Sem isso, uma chamada indevida ou duplicada (ex.: bug no Application
// Service, ou uma segunda finalização de uma execução já concluída)
// poderia sobrescrever silenciosamente um import já `completed`/`failed`
// com um resultado obsoleto. `null` de volta significa "não havia
// nada em processing para finalizar" -- nunca esperado no fluxo normal
// (finalize sempre segue um claim bem-sucedido na mesma execução); o
// Application Service deve tratar como anomalia, não como sucesso.
export const finalizeMeasurementBulletinImportWithResult = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    companyId: string;
    status: MeasurementBulletinImportFinalStatus;
    analysisResult: unknown;
  }
): Promise<MeasurementBulletinImportRecord | null> => {
  const { data, error } = await supabase
    .from("measurement_bulletin_imports")
    .update({ status: params.status, analysis_result: params.analysisResult })
    .eq("id", params.id)
    .eq("company_id", params.companyId)
    .in("status", ["processing"])
    .select(selectMeasurementBulletinImportColumns)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toMeasurementBulletinImportRecord(data) : null;
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
  readonly contractQuantityDecimal: string;
  readonly unitPriceDecimal: string;
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
  unitPrice: Number(data.unit_price),
  contractQuantityDecimal: String(data.contract_quantity),
  unitPriceDecimal: String(data.unit_price)
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

// Sprint 4D.2 -- primitiva nova para period_number_conflict (Parte IX
// do desenho, aprovada mas não implementada na 19.4D.1 por falta desta
// consulta). Usada só em MODO FRESCO: nesse modo não existe workspace
// para o import atual ainda, então qualquer linha devolvida aqui já é,
// por construção, de um import DIFERENTE -- não precisa filtrar o
// import atual manualmente. Não impõe unicidade nenhuma (o schema não
// tem essa constraint, deliberadamente -- remedição de período é
// legítima); só permite ao Application Service DETECTAR a colisão
// para sinalizar como warning, nunca para bloquear.
export const listMeasurementWorkspacesByProjectAndPeriod = async (
  supabase: SupabaseClient,
  params: { companyId: string; engineeringProjectId: string; periodNumber: number }
): Promise<ReadonlyArray<MeasurementWorkspaceRecord>> => {
  const { data, error } = await supabase
    .from("measurement_workspaces")
    .select(selectMeasurementWorkspaceColumns)
    .eq("company_id", params.companyId)
    .eq("engineering_project_id", params.engineeringProjectId)
    .eq("period_number", params.periodNumber);

  if (error) {
    throw error;
  }

  return (data ?? []).map(toMeasurementWorkspaceRecord);
};

// Primitiva de idempotência (Sprint 4.0): resolve o workspace já
// vinculado a um import, se existir. O que fazer com o resultado
// (already_completed / resumed / workspace_closed / ...) é decisão do
// Application Service, nunca desta função.
// `companyId` opcional -- mesma disciplina de getMeasurementBulletinImportById.
export const getMeasurementWorkspaceByImportId = async (
  supabase: SupabaseClient,
  params: { measurementBulletinImportId: string; companyId?: string }
): Promise<MeasurementWorkspaceRecord | null> => {
  let query = supabase
    .from("measurement_workspaces")
    .select(selectMeasurementWorkspaceColumns)
    .eq("measurement_bulletin_import_id", params.measurementBulletinImportId);
  if (params.companyId) {
    query = query.eq("company_id", params.companyId);
  }
  const { data, error } = await query.maybeSingle();

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
  readonly quantityDecimal: string;
  readonly unitValueDecimal: string;
  readonly totalValueDecimal: string;
  readonly declaredQuantity: number | null;
  readonly declaredUnitValue: number | null;
  readonly declaredTotalValue: number | null;
  // R1 (Sprint 4D.0) — rastreabilidade até a célula de origem. Nulos
  // no Caminho A (lançamento nativo, ainda não implementado neste
  // Epic) ou quando o parser não expõe granularidade de coluna.
  readonly sourceSheetName: string | null;
  readonly sourceRowNumber: number | null;
  readonly sourcePhysicalColumn: string | null;
  readonly sourceFinancialColumn: string | null;
  readonly sourceQuantityRaw: string | null;
  readonly canonicalQuantityScale: number | null;
  readonly monetaryPolicyKey: string | null;
  readonly monetaryScale: number | null;
}

const selectMeasurementWorkspaceLineColumns =
  "id, measurement_workspace_id, managed_service_item_id, quantity, unit_value, total_value, declared_quantity, declared_unit_value, declared_total_value, source_sheet_name, source_row_number, source_physical_column, source_financial_column, source_quantity_raw, canonical_quantity_scale, monetary_policy_key, monetary_scale";

const toMeasurementWorkspaceLineRecord = (data: Record<string, unknown>): MeasurementWorkspaceLineRecord => ({
  id: data.id as string,
  measurementWorkspaceId: data.measurement_workspace_id as string,
  managedServiceItemId: data.managed_service_item_id as string,
  quantity: Number(data.quantity),
  unitValue: Number(data.unit_value),
  totalValue: Number(data.total_value),
  quantityDecimal: String(data.quantity),
  unitValueDecimal: String(data.unit_value),
  totalValueDecimal: String(data.total_value),
  declaredQuantity: data.declared_quantity === null ? null : Number(data.declared_quantity),
  declaredUnitValue: data.declared_unit_value === null ? null : Number(data.declared_unit_value),
  declaredTotalValue: data.declared_total_value === null ? null : Number(data.declared_total_value),
  sourceSheetName: (data.source_sheet_name as string | null) ?? null,
  sourceRowNumber: data.source_row_number === null || data.source_row_number === undefined ? null : Number(data.source_row_number),
  sourcePhysicalColumn: (data.source_physical_column as string | null) ?? null,
  sourceFinancialColumn: (data.source_financial_column as string | null) ?? null,
  sourceQuantityRaw: (data.source_quantity_raw as string | null) ?? null,
  canonicalQuantityScale:
    data.canonical_quantity_scale === null || data.canonical_quantity_scale === undefined
      ? null
      : Number(data.canonical_quantity_scale),
  monetaryPolicyKey: (data.monetary_policy_key as string | null) ?? null,
  monetaryScale:
    data.monetary_scale === null || data.monetary_scale === undefined
      ? null
      : Number(data.monetary_scale)
});

// total_value é sempre passado pelo Application Service já recalculado
// (quantity * unit_value) — este repository nunca recalcula nada,
// mesma disciplina de insertPlanningDataset em repository.ts (não
// conhece a forma interna do que grava). UNIQUE(measurement_workspace_id,
// managed_service_item_id) já existente é a última linha de defesa
// contra duas linhas para o mesmo item no mesmo workspace.
//
// source_* são parâmetros obrigatórios (não opcionais), mesmo padrão
// de declared_quantity/declared_unit_value/declared_total_value --
// deliberado (R1 tratado como obrigatório, não opcional, na revisão
// de arquitetura): força quem chama a decidir explicitamente a origem
// de cada linha (null é uma resposta válida no Caminho A; omitir não
// é uma opção silenciosa).
export const insertMeasurementWorkspaceLine = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    measurementWorkspaceId: string;
    managedServiceItemId: string;
    quantity: number | string;
    unitValue: number | string;
    totalValue: number | string;
    declaredQuantity: number | null;
    declaredUnitValue: number | null;
    declaredTotalValue: number | null;
    sourceSheetName: string | null;
    sourceRowNumber: number | null;
    sourcePhysicalColumn: string | null;
    sourceFinancialColumn: string | null;
    sourceQuantityRaw: string | null;
    canonicalQuantityScale: number;
    monetaryPolicyKey: string;
    monetaryScale: number;
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
      source_sheet_name: params.sourceSheetName,
      source_row_number: params.sourceRowNumber,
      source_physical_column: params.sourcePhysicalColumn,
      source_financial_column: params.sourceFinancialColumn,
      source_quantity_raw: params.sourceQuantityRaw,
      canonical_quantity_scale: params.canonicalQuantityScale,
      monetary_policy_key: params.monetaryPolicyKey,
      monetary_scale: params.monetaryScale,
      ...(params.notes ? { notes: params.notes } : {})
    })
    .select(selectMeasurementWorkspaceLineColumns)
    .single();

  if (error || !data) {
    throw error ?? new Error("Nao foi possivel criar a MeasurementWorkspaceLine.");
  }

  return toMeasurementWorkspaceLineRecord(data);
};

// Correção 2 (revisão de arquitetura da Sprint 4D) — lê a linha
// persistida para um (workspace, item) específico, para que uma
// colisão 23505 em insertMeasurementWorkspaceLine possa ser comparada
// contra o que já está gravado, nunca tratada como "está tudo certo"
// por padrão. UNIQUE(measurement_workspace_id, managed_service_item_id)
// garante que no máximo uma linha existe para o par.
export const getMeasurementWorkspaceLineByWorkspaceAndServiceItem = async (
  supabase: SupabaseClient,
  params: { measurementWorkspaceId: string; managedServiceItemId: string }
): Promise<MeasurementWorkspaceLineRecord | null> => {
  const { data, error } = await supabase
    .from("measurement_workspace_lines")
    .select(selectMeasurementWorkspaceLineColumns)
    .eq("measurement_workspace_id", params.measurementWorkspaceId)
    .eq("managed_service_item_id", params.managedServiceItemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toMeasurementWorkspaceLineRecord(data) : null;
};

// Correção 2 -- atualização explícita, nunca um segundo INSERT. Só
// deve ser chamada pelo Application Service depois de comparar a
// linha existente (getMeasurementWorkspaceLineByWorkspaceAndServiceItem)
// contra os valores pretendidos e concluir que divergem; uma linha
// idêntica é already_present, sem escrita nenhuma.
//
// Filtra por `id` E `measurement_workspace_id` -- `id` já é chave
// primária (suficiente para o banco), mas o segundo filtro protege o
// contrato semântico da função ("atualizar esta linha dentro deste
// workspace") contra um erro de programação que passe um `id` de
// outro workspace: em vez de atualizar silenciosamente a linha errada
// (que existiria de qualquer forma, só em outro workspace),
// `measurement_workspace_id` incompatível faz o filtro não casar
// nenhuma linha. maybeSingle() (não single()) porque "zero linhas" é
// um resultado válido dessa guarda, não necessariamente um erro de
// infraestrutura -- o Application Service deve tratar `null` como
// anomalia de consistência (id inexistente ou de outro workspace),
// nunca como sucesso silencioso.
export const updateMeasurementWorkspaceLine = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    measurementWorkspaceId: string;
    quantity: number | string;
    unitValue: number | string;
    totalValue: number | string;
    declaredQuantity: number | null;
    declaredUnitValue: number | null;
    declaredTotalValue: number | null;
    sourceSheetName: string | null;
    sourceRowNumber: number | null;
    sourcePhysicalColumn: string | null;
    sourceFinancialColumn: string | null;
    sourceQuantityRaw: string | null;
    canonicalQuantityScale: number;
    monetaryPolicyKey: string;
    monetaryScale: number;
  }
): Promise<MeasurementWorkspaceLineRecord | null> => {
  const { data, error } = await supabase
    .from("measurement_workspace_lines")
    .update({
      quantity: params.quantity,
      unit_value: params.unitValue,
      total_value: params.totalValue,
      declared_quantity: params.declaredQuantity,
      declared_unit_value: params.declaredUnitValue,
      declared_total_value: params.declaredTotalValue,
      source_sheet_name: params.sourceSheetName,
      source_row_number: params.sourceRowNumber,
      source_physical_column: params.sourcePhysicalColumn,
      source_financial_column: params.sourceFinancialColumn,
      source_quantity_raw: params.sourceQuantityRaw,
      canonical_quantity_scale: params.canonicalQuantityScale,
      monetary_policy_key: params.monetaryPolicyKey,
      monetary_scale: params.monetaryScale
    })
    .eq("id", params.id)
    .eq("measurement_workspace_id", params.measurementWorkspaceId)
    .select(selectMeasurementWorkspaceLineColumns)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toMeasurementWorkspaceLineRecord(data) : null;
};

// Releitura das linhas persistidas (correção 2 / correção 5) — o
// Application Service usa esta função, nunca o DTO do parser em
// memória, para calcular recalculatedTotal depois da materialização.
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
  readonly reference: Record<string, unknown>;
  readonly header: Record<string, unknown>;
  readonly decimalContext: Record<string, unknown>;
  readonly lines: unknown;
  readonly totals: unknown;
  readonly validationIssues: unknown;
  readonly trace: unknown;
  readonly metadata: Record<string, unknown>;
  readonly finalizedAt: string | null;
}

const selectMeasurementBulletinColumns =
  "id, company_id, engineering_project_id, measurement_workspace_id, bulletin_number, period_number, issue_date, status, reference, header, decimal_context, lines, totals, validation_issues, trace, metadata, finalized_at";

const toMeasurementBulletinRecord = (data: Record<string, unknown>): MeasurementBulletinRecord => ({
  id: data.id as string,
  companyId: data.company_id as string,
  engineeringProjectId: data.engineering_project_id as string,
  measurementWorkspaceId: data.measurement_workspace_id as string,
  bulletinNumber: Number(data.bulletin_number),
  periodNumber: Number(data.period_number),
  issueDate: data.issue_date as string,
  status: data.status as MeasurementBulletinStatus,
  reference: (data.reference as Record<string, unknown>) ?? {},
  header: (data.header as Record<string, unknown>) ?? {},
  decimalContext: (data.decimal_context as Record<string, unknown>) ?? {},
  lines: data.lines,
  totals: data.totals,
  validationIssues: data.validation_issues,
  trace: data.trace ?? [],
  metadata: (data.metadata as Record<string, unknown>) ?? {},
  finalizedAt: (data.finalized_at as string | null) ?? null
});

// bulletinNumber já vem decidido pelo Application Service (regra de
// numeração, Sprint 4.0) — este repository nunca escolhe o número,
// só grava o que recebe. O envelope formal completo (reference, header,
// decimalContext, lines, totals, validationIssues, trace, metadata) é
// gravado verbatim (JSONB) para garantir rastreabilidade determinística.
//
// reference/header/decimalContext/validationIssues/trace/metadata são
// obrigatórios (não opcionais), sem fallback `?? {}`/`?? []` --
// correção pós-3C.1C: um repository que inventa `{}`/`[]` quando o
// chamador omite o envelope é exatamente o tipo de bypass que o
// trigger de consistência do banco (enforce_measurement_bulletin_envelope_consistency)
// foi corrigido para rejeitar. O chamador (Application Service) é
// quem já produziu o envelope real via o domínio (bulletin-generator)
// -- este repository nunca decide o que "vazio" deveria significar.
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
    reference: unknown;
    header: unknown;
    decimalContext: unknown;
    lines: unknown;
    totals: unknown;
    validationIssues: unknown;
    trace: unknown;
    metadata: unknown;
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
      reference: params.reference,
      header: params.header,
      decimal_context: params.decimalContext,
      lines: params.lines,
      totals: params.totals,
      validation_issues: params.validationIssues,
      trace: params.trace,
      metadata: params.metadata
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
// exige os dois juntos ou nenhum). Permite evoluir validation_issues,
// trace e metadata durante as transições de domínio.
export const updateMeasurementBulletinStatus = async (
  supabase: SupabaseClient,
  params: {
    id: string;
    companyId: string;
    status: MeasurementBulletinStatus;
    validationIssues?: unknown;
    trace?: unknown;
    metadata?: unknown;
    finalizedAt?: string;
  }
): Promise<void> => {
  const payload: Record<string, unknown> = {
    status: params.status,
    ...(params.finalizedAt ? { finalized_at: params.finalizedAt } : {}),
    ...(params.validationIssues !== undefined ? { validation_issues: params.validationIssues } : {}),
    ...(params.trace !== undefined ? { trace: params.trace } : {}),
    ...(params.metadata !== undefined ? { metadata: params.metadata } : {})
  };

  const { error } = await supabase
    .from("measurement_bulletins")
    .update(payload)
    .eq("id", params.id)
    .eq("company_id", params.companyId);

  if (error) {
    throw error;
  }
};

// Leitura por workspace (não por id do boletim) -- ponto de entrada real
// para a tela de um import específico, que só conhece o workspace
// (via measurement_workspaces.measurement_bulletin_import_id), nunca o
// id do boletim formal diretamente. Um workspace pode, em tese, ter
// mais de um boletim ao longo do tempo (ex.: um Cancelled seguido de
// um novo) -- `order by created_at desc, limit 1` devolve sempre o
// mais recente, nunca uma leitura ambígua.
// `companyId` opcional -- mesma disciplina de getMeasurementBulletinImportById.
export const getMeasurementBulletinByWorkspaceId = async (
  supabase: SupabaseClient,
  params: { measurementWorkspaceId: string; companyId?: string }
): Promise<MeasurementBulletinRecord | null> => {
  let query = supabase
    .from("measurement_bulletins")
    .select(selectMeasurementBulletinColumns)
    .eq("measurement_workspace_id", params.measurementWorkspaceId);
  if (params.companyId) {
    query = query.eq("company_id", params.companyId);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.length > 0 ? toMeasurementBulletinRecord(rows[0]!) : null;
};

// ---------------------------------------------------------------
// measurement_bulletin_line_sources
// ---------------------------------------------------------------

// Só a contagem -- a tela de status formal (Etapa 3C.2) só precisa
// comprovar "todas as linhas têm fonte relacional", nunca exibir o
// conteúdo de cada fonte. `head: true` evita trazer as 15 linhas
// inteiras do banco só para contar.
export const countMeasurementBulletinLineSources = async (
  supabase: SupabaseClient,
  params: { measurementBulletinId: string }
): Promise<number> => {
  const { count, error } = await supabase
    .from("measurement_bulletin_line_sources")
    .select("id", { count: "exact", head: true })
    .eq("measurement_bulletin_id", params.measurementBulletinId);

  if (error) {
    throw error;
  }

  return count ?? 0;
};

// ---------------------------------------------------------------
// measurement_cycles
// ---------------------------------------------------------------

export type MeasurementCycleRecordStatus = "draft" | "measured" | "bulletin_generated" | "certified" | "closed";

export interface MeasurementCycleRecord {
  readonly id: string;
  readonly measurementWorkspaceId: string;
  readonly measurementBulletinId: string | null;
  readonly status: MeasurementCycleRecordStatus;
}

const selectMeasurementCycleColumns = "id, measurement_workspace_id, measurement_bulletin_id, status";

const toMeasurementCycleRecord = (data: Record<string, unknown>): MeasurementCycleRecord => ({
  id: data.id as string,
  measurementWorkspaceId: data.measurement_workspace_id as string,
  measurementBulletinId: (data.measurement_bulletin_id as string | null) ?? null,
  status: data.status as MeasurementCycleRecordStatus
});

// UNIQUE(measurement_workspace_id) no banco garante no máximo um ciclo
// por workspace -- maybeSingle() é seguro aqui, ao contrário do
// boletim (que não tem essa mesma garantia de unicidade).
// `companyId` opcional -- mesma disciplina de getMeasurementBulletinImportById.
export const getMeasurementCycleByWorkspaceId = async (
  supabase: SupabaseClient,
  params: { measurementWorkspaceId: string; companyId?: string }
): Promise<MeasurementCycleRecord | null> => {
  let query = supabase
    .from("measurement_cycles")
    .select(selectMeasurementCycleColumns)
    .eq("measurement_workspace_id", params.measurementWorkspaceId);
  if (params.companyId) {
    query = query.eq("company_id", params.companyId);
  }
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toMeasurementCycleRecord(data) : null;
};
