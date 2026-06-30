-- Add admin ownership metadata and per-user chat read state.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS account_owner_id UUID
  REFERENCES profiles(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_account_owner_id
  ON companies (account_owner_id);

CREATE TABLE IF NOT EXISTS chat_read_state (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);

DROP TRIGGER IF EXISTS set_chat_read_state_updated_at
ON chat_read_state;
CREATE TRIGGER set_chat_read_state_updated_at
BEFORE UPDATE ON chat_read_state
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE chat_read_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_read_state_select_own_or_admin
ON chat_read_state;
CREATE POLICY chat_read_state_select_own_or_admin
ON chat_read_state
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_bba_admin());

DROP POLICY IF EXISTS chat_read_state_insert_own_channel_or_admin
ON chat_read_state;
CREATE POLICY chat_read_state_insert_own_channel_or_admin
ON chat_read_state
FOR INSERT
TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
    AND channel_id IN (
      SELECT id
      FROM chat_channels
      WHERE company_id = get_my_company_id()
    )
  )
  OR is_bba_admin()
);

DROP POLICY IF EXISTS chat_read_state_update_own_channel_or_admin
ON chat_read_state;
CREATE POLICY chat_read_state_update_own_channel_or_admin
ON chat_read_state
FOR UPDATE
TO authenticated
USING (
  (
    user_id = auth.uid()
    AND channel_id IN (
      SELECT id
      FROM chat_channels
      WHERE company_id = get_my_company_id()
    )
  )
  OR is_bba_admin()
)
WITH CHECK (
  (
    user_id = auth.uid()
    AND channel_id IN (
      SELECT id
      FROM chat_channels
      WHERE company_id = get_my_company_id()
    )
  )
  OR is_bba_admin()
);

DROP POLICY IF EXISTS chat_read_state_delete_blocked
ON chat_read_state;
CREATE POLICY chat_read_state_delete_blocked
ON chat_read_state
FOR DELETE
TO authenticated
USING (false);

CREATE INDEX IF NOT EXISTS idx_chat_read_state_channel_id
  ON chat_read_state (channel_id);

CREATE INDEX IF NOT EXISTS idx_chat_read_state_last_read_at
  ON chat_read_state (last_read_at DESC);
