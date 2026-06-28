-- BBA App core schema

-- BLOCO 1: EXTENSOES
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- BLOCO 2: ENUM COMPARTILHADO
CREATE TYPE bba_area AS ENUM (
  'fiscal',
  'financeiro',
  'rh',
  'ti',
  'governanca'
);

-- BLOCO 3: FUNCAO UPDATED_AT
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- BLOCO 4: TABELA profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'client'
    CHECK (role IN ('client', 'bba_admin')),
  company_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 5: FUNCAO get_my_company_id()
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- BLOCO 6: FUNCAO is_bba_admin()
CREATE OR REPLACE FUNCTION is_bba_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'bba_admin'
  );
$$;

-- BLOCO 7: FUNCAO handle_new_user()
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  extracted_full_name TEXT;
  extracted_role TEXT;
BEGIN
  extracted_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.email, ''),
    'Cliente BBA'
  );

  extracted_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'role', ''),
    'client'
  );

  IF extracted_role NOT IN ('client', 'bba_admin') THEN
    extracted_role := 'client';
  END IF;

  INSERT INTO profiles (id, full_name, email, role)
  VALUES (NEW.id, extracted_full_name, NEW.email, extracted_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- BLOCO 8: TABELA companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE CHECK (cnpj ~ '^\d{14}$'),
  tax_regime TEXT CHECK (
    tax_regime IN (
      'mei',
      'simples_nacional',
      'lucro_presumido',
      'lucro_real'
    )
  ),
  segment TEXT,
  main_phone TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 9: FK CIRCULAR profiles -> companies
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_company
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE SET NULL;

-- BLOCO 10: TABELA projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  area bba_area,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 11: TABELA onboarding_steps
CREATE TABLE onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, step_number)
);

CREATE TRIGGER set_onboarding_steps_updated_at
BEFORE UPDATE ON onboarding_steps
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 12: TABELA tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  area bba_area,
  tag TEXT,
  due_date DATE,
  attachments_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 13: TABELA chat_channels
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area bba_area NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, area)
);

CREATE TRIGGER set_chat_channels_updated_at
BEFORE UPDATE ON chat_channels
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- BLOCO 14: TABELA chat_messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (char_length(body) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BLOCO 15: HABILITAR RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- BLOCO 16: POLITICAS RLS
CREATE POLICY profiles_select_own_or_admin
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR is_bba_admin());

CREATE POLICY profiles_insert_blocked
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY profiles_update_own_or_admin
ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR is_bba_admin())
WITH CHECK (
  (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()))
  OR is_bba_admin()
);

CREATE POLICY profiles_delete_blocked
ON profiles
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY companies_select_owner_or_admin
ON companies
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR is_bba_admin());

CREATE POLICY companies_insert_owner
ON companies
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY companies_update_owner_or_admin
ON companies
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR is_bba_admin())
WITH CHECK (owner_id = auth.uid() OR is_bba_admin());

CREATE POLICY companies_delete_admin
ON companies
FOR DELETE
TO authenticated
USING (is_bba_admin());

CREATE POLICY projects_select_company_or_admin
ON projects
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY projects_insert_company_or_admin
ON projects
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY projects_update_company_or_admin
ON projects
FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY projects_delete_company_or_admin
ON projects
FOR DELETE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY onboarding_steps_select_company_or_admin
ON onboarding_steps
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY onboarding_steps_insert_company_or_admin
ON onboarding_steps
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY onboarding_steps_update_company_or_admin
ON onboarding_steps
FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY onboarding_steps_delete_company_or_admin
ON onboarding_steps
FOR DELETE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY tasks_select_company_or_admin
ON tasks
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY tasks_insert_company_or_admin
ON tasks
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY tasks_update_company_or_admin
ON tasks
FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY tasks_delete_company_or_admin
ON tasks
FOR DELETE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY chat_channels_select_company_or_admin
ON chat_channels
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY chat_channels_insert_company_or_admin
ON chat_channels
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY chat_channels_update_company_or_admin
ON chat_channels
FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY chat_channels_delete_company_or_admin
ON chat_channels
FOR DELETE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

CREATE POLICY chat_messages_select_company_or_admin
ON chat_messages
FOR SELECT
TO authenticated
USING (
  channel_id IN (
    SELECT id
    FROM chat_channels
    WHERE company_id = get_my_company_id()
  )
  OR is_bba_admin()
);

CREATE POLICY chat_messages_insert_own_company_or_admin
ON chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    sender_id = auth.uid()
    AND channel_id IN (
      SELECT id
      FROM chat_channels
      WHERE company_id = get_my_company_id()
    )
  )
  OR is_bba_admin()
);

CREATE POLICY chat_messages_update_blocked
ON chat_messages
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY chat_messages_delete_blocked
ON chat_messages
FOR DELETE
TO authenticated
USING (false);

-- BLOCO 17: INDICES
CREATE INDEX idx_profiles_company_id ON profiles (company_id);
CREATE INDEX idx_profiles_role ON profiles (role);
CREATE INDEX idx_companies_owner_id ON companies (owner_id);
CREATE INDEX idx_companies_cnpj ON companies (cnpj);
CREATE INDEX idx_projects_company_id ON projects (company_id);
CREATE INDEX idx_projects_area ON projects (area);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_onboarding_steps_company_id ON onboarding_steps (company_id);
CREATE INDEX idx_onboarding_steps_status ON onboarding_steps (status);
CREATE INDEX idx_tasks_company_id ON tasks (company_id);
CREATE INDEX idx_tasks_assigned_to ON tasks (assigned_to);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_priority ON tasks (priority);
CREATE INDEX idx_tasks_due_date ON tasks (due_date);
CREATE INDEX idx_chat_channels_company_id ON chat_channels (company_id);
CREATE INDEX idx_chat_messages_channel_id ON chat_messages (channel_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages (sender_id);
CREATE INDEX idx_chat_messages_created_at_desc ON chat_messages (created_at DESC);

-- BLOCO 18: REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- BLOCO 19: COMENTARIOS
COMMENT ON TABLE profiles IS
  'Usuarios do sistema. role define acesso: client ou bba_admin.';
COMMENT ON TABLE companies IS
  'Empresas clientes da BBA. Separada de profiles para suportar multiplos usuarios por empresa no futuro.';
COMMENT ON TABLE tasks IS
  'Tarefas operacionais. project_id e nullable - tarefa pode existir sem projeto associado.';
COMMENT ON COLUMN profiles.metadata IS
  'Dados extras sem schema fixo. Nao usar para controle de acesso.';
COMMENT ON COLUMN companies.cnpj IS
  'Apenas 14 digitos sem mascara. Normalizar no frontend antes de salvar.';
COMMENT ON COLUMN tasks.attachments_count IS
  'Contador de arquivos no Storage. Atualizado pela aplicacao, nao por trigger.';
COMMENT ON COLUMN onboarding_steps.step_number IS
  'Ordem da etapa. UNIQUE por company_id - sem duplicatas.';
