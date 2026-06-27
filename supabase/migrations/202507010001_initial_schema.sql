CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  regime TEXT CHECK (regime IN ('MEI','Simples','LucroPresumido','LucroReal')),
  segmento TEXT,
  phone TEXT,
  plan TEXT DEFAULT 'essencial',
  expo_push_token TEXT,
  onboarding_step INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('active','paused','completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('todo','doing','done')) DEFAULT 'todo',
  tag TEXT,
  due_date DATE,
  assigned_to UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_area TEXT CHECK (team_area IN ('fiscal','financeiro','ti','rh','governanca')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, team_area)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role TEXT CHECK (sender_role IN ('client','bba_team')),
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_title TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending','current','done')) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  UNIQUE (client_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id_status ON public.tasks(client_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_channels_client_id ON public.chat_channels(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id_created_at ON public.messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_client_id ON public.onboarding_steps(client_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_bba_team()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND plan = 'bba_team'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  profile_name TEXT;
BEGIN
  profile_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'Cliente BBA');

  INSERT INTO public.profiles (
    id,
    name,
    cnpj,
    regime,
    segmento,
    phone,
    plan
  )
  VALUES (
    NEW.id,
    profile_name,
    NULLIF(NEW.raw_user_meta_data->>'cnpj', ''),
    NULLIF(NEW.raw_user_meta_data->>'regime', ''),
    NULLIF(NEW.raw_user_meta_data->>'segmento', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'plan', ''), 'essencial')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.onboarding_steps (client_id, step_number, step_title, status)
  VALUES
    (NEW.id, 1, 'Cadastro da empresa', 'current'),
    (NEW.id, 2, 'Contatos e responsaveis', 'pending'),
    (NEW.id, 3, 'Envio de documentos', 'pending'),
    (NEW.id, 4, 'Validacao BBA', 'pending'),
    (NEW.id, 5, 'Operacao assistida', 'pending')
  ON CONFLICT (client_id, step_number) DO NOTHING;

  INSERT INTO public.chat_channels (client_id, team_area)
  VALUES
    (NEW.id, 'fiscal'),
    (NEW.id, 'financeiro'),
    (NEW.id, 'ti'),
    (NEW.id, 'rh'),
    (NEW.id, 'governanca')
  ON CONFLICT (client_id, team_area) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE client_id = NEW.id) THEN
    INSERT INTO public.projects (client_id, title, description, status)
    VALUES (
      NEW.id,
      'Onboarding BBA',
      'Primeiro ciclo de implantacao e organizacao operacional.',
      'active'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_client_read" ON public.profiles;
CREATE POLICY "profiles_client_read" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_bba_team());

DROP POLICY IF EXISTS "profiles_client_insert" ON public.profiles;
CREATE POLICY "profiles_client_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_client_update" ON public.profiles;
CREATE POLICY "profiles_client_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_bba_team())
  WITH CHECK (id = auth.uid() OR public.is_bba_team());

DROP POLICY IF EXISTS "projects_client_access" ON public.projects;
CREATE POLICY "projects_client_access" ON public.projects
  FOR ALL USING (client_id = auth.uid() OR public.is_bba_team())
  WITH CHECK (client_id = auth.uid() OR public.is_bba_team());

DROP POLICY IF EXISTS "tasks_client_access" ON public.tasks;
CREATE POLICY "tasks_client_access" ON public.tasks
  FOR ALL USING (client_id = auth.uid() OR public.is_bba_team())
  WITH CHECK (client_id = auth.uid() OR public.is_bba_team());

DROP POLICY IF EXISTS "channels_client_access" ON public.chat_channels;
CREATE POLICY "channels_client_access" ON public.chat_channels
  FOR ALL USING (client_id = auth.uid() OR public.is_bba_team())
  WITH CHECK (client_id = auth.uid() OR public.is_bba_team());

DROP POLICY IF EXISTS "messages_client_access" ON public.messages;
CREATE POLICY "messages_client_access" ON public.messages
  FOR ALL USING (
    public.is_bba_team()
    OR channel_id IN (
      SELECT id FROM public.chat_channels WHERE client_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_bba_team()
    OR channel_id IN (
      SELECT id FROM public.chat_channels WHERE client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "onboarding_client_access" ON public.onboarding_steps;
CREATE POLICY "onboarding_client_access" ON public.onboarding_steps
  FOR ALL USING (client_id = auth.uid() OR public.is_bba_team())
  WITH CHECK (client_id = auth.uid() OR public.is_bba_team());

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
