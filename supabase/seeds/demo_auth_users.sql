/*
  BBA App - Demo Auth Users

  Run this in the Supabase SQL Editor before supabase/seeds/demo_seed_real.sql.
  You can also run it by itself to repair demo logins that return
  "Invalid login credentials".

  This script creates or resets the Supabase Auth users required by the demo
  seed. It keeps the UUIDs aligned with public.profiles, which is required
  because profiles.id references auth.users.id.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TEMP TABLE bba_demo_auth_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  app_role TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO bba_demo_auth_users (
  id,
  email,
  password,
  full_name,
  app_role
) VALUES
  (
    '673e0c35-5afc-4c54-a82a-0c8e63279b99',
    'admin@bbabrazil.com.br',
    'BBAadmin2025!',
    'Admin BBA',
    'bba_admin'
  ),
  (
    'd9e849b1-cd4a-4855-888c-857d8a7a6050',
    'carlos@carlosmendes.com.br',
    'Teste123!',
    'Carlos Mendes',
    'client'
  ),
  (
    '9ff84319-08bf-4a67-975e-4a229effdf4d',
    'vitoria@vitoriamodas.com.br',
    'Teste123!',
    'Vitoria Souza',
    'client'
  ),
  (
    '30feab53-1950-4099-8699-6ea24bd71d71',
    'ricardo@construtorahorizonte.com.br',
    'Teste123!',
    'Ricardo Horizonte',
    'client'
  );

-- If a demo email was created manually with a different UUID, remove that
-- wrong Auth record first. The demo data depends on the fixed UUIDs above.
DELETE FROM auth.identities AS identity
USING auth.users AS auth_user, bba_demo_auth_users AS demo_user
WHERE identity.user_id = auth_user.id
  AND lower(auth_user.email) = lower(demo_user.email)
  AND auth_user.id <> demo_user.id;

DELETE FROM auth.users AS auth_user
USING bba_demo_auth_users AS demo_user
WHERE lower(auth_user.email) = lower(demo_user.email)
  AND auth_user.id <> demo_user.id;

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  id,
  'authenticated',
  'authenticated',
  email,
  crypt(password, gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
  jsonb_build_object('full_name', full_name, 'role', app_role),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
FROM bba_demo_auth_users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = NOW();

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  id,
  id::TEXT,
  jsonb_build_object(
    'sub', id::TEXT,
    'email', email,
    'email_verified', TRUE,
    'phone_verified', FALSE
  ),
  'email',
  NOW(),
  NOW(),
  NOW()
FROM bba_demo_auth_users
ON CONFLICT (provider_id, provider) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  identity_data = EXCLUDED.identity_data,
  updated_at = NOW();

COMMIT;
