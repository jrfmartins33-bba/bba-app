export type TaxRegime =
  | "mei"
  | "simples_nacional"
  | "lucro_presumido"
  | "lucro_real";

export type UserRole = "client" | "bba_admin";
export type ProjectStatus = "active" | "paused" | "completed" | "cancelled";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type BbaArea = "fiscal" | "financeiro" | "rh" | "ti" | "governanca";
export type OnboardingStatus = "pending" | "in_progress" | "completed";

export type Profile = {
  id: string;
  full_name: string;
  email?: string | null;
  role: UserRole;
  company_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  cnpj?: string | null;
  tax_regime?: TaxRegime | null;
  segment?: string | null;
  main_phone?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CompanyInput = Pick<Company, "name"> &
  Partial<Pick<Company, "cnpj" | "tax_regime" | "segment" | "main_phone">>;

export type Project = {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  area?: BbaArea | null;
  status: ProjectStatus;
  responsible_id?: string | null;
  due_date?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  company_id: string;
  project_id?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  area?: BbaArea | null;
  tag?: string | null;
  due_date?: string | null;
  attachments_count: number;
  created_by?: string | null;
  assigned_to?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ChatChannel = {
  id: string;
  company_id: string;
  name: string;
  area: BbaArea;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type OnboardingStep = {
  id: string;
  company_id: string;
  step_number: number;
  title: string;
  description?: string | null;
  status: OnboardingStatus;
  responsible_id?: string | null;
  notes?: string | null;
  completed_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateTaskInput = {
  project_id?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  area?: BbaArea;
  tag?: string;
  due_date?: string;
};

export type ChatReadState = {
  channel_id: string;
  last_read_at: string;
};