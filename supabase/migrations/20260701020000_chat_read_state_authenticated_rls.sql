-- Allow authenticated users to manage only their own chat read state rows.
-- RLS remains enabled; anon/public receive no table privileges.

ALTER TABLE public.chat_read_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chat_read_state FROM anon;
REVOKE ALL ON TABLE public.chat_read_state FROM public;
REVOKE ALL ON TABLE public.chat_read_state FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.chat_read_state
TO authenticated;

DROP POLICY IF EXISTS chat_read_state_select_own_or_admin
ON public.chat_read_state;

DROP POLICY IF EXISTS chat_read_state_insert_own_channel_or_admin
ON public.chat_read_state;

DROP POLICY IF EXISTS chat_read_state_update_own_channel_or_admin
ON public.chat_read_state;

DROP POLICY IF EXISTS chat_read_state_delete_blocked
ON public.chat_read_state;

DROP POLICY IF EXISTS chat_read_state_select_own
ON public.chat_read_state;

CREATE POLICY chat_read_state_select_own
ON public.chat_read_state
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS chat_read_state_insert_own
ON public.chat_read_state;

CREATE POLICY chat_read_state_insert_own
ON public.chat_read_state
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_read_state_update_own
ON public.chat_read_state;

CREATE POLICY chat_read_state_update_own
ON public.chat_read_state
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_read_state_delete_own
ON public.chat_read_state;

CREATE POLICY chat_read_state_delete_own
ON public.chat_read_state
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
