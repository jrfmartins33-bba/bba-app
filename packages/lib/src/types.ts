export type Regime = "MEI" | "Simples" | "LucroPresumido" | "LucroReal";
export type Plan = "essencial" | "pro" | "premium" | "bba_team";
export type ProjectStatus = "active" | "paused" | "completed";
export type TaskStatus = "todo" | "doing" | "done";
export type TeamArea = "fiscal" | "financeiro" | "ti" | "rh" | "governanca";
export type SenderRole = "client" | "bba_team";
export type OnboardingStatus = "pending" | "current" | "done";

export type Profile = {
  id: string;
  name: string;
  cnpj?: string | null;
  regime?: Regime | null;
  segmento?: string | null;
  phone?: string | null;
  plan: Plan;
  onboarding_step: number;
  expo_push_token?: string | null;
  created_at: string;
};

export type ProfileInput = Pick<Profile, "name"> &
  Partial<Pick<Profile, "cnpj" | "regime" | "segmento" | "phone" | "plan">>;

export type Project = {
  id: string;
  client_id: string;
  title: string;
  description?: string | null;
  status: ProjectStatus;
  created_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  client_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  tag?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatChannel = {
  id: string;
  client_id: string;
  team_area: TeamArea;
  created_at: string;
};

export type Message = {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_role: SenderRole;
  content: string;
  read_at?: string | null;
  created_at: string;
};

export type OnboardingStep = {
  id: string;
  client_id: string;
  step_number: number;
  step_title: string;
  status: OnboardingStatus;
  completed_at?: string | null;
};

export type CreateTaskInput = {
  project_id?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  tag?: string;
  due_date?: string;
};
