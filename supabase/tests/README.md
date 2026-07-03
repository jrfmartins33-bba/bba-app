# RLS test infrastructure

## Strategy
This repository uses Supabase Auth sessions through the official `@supabase/supabase-js` client to exercise RLS under real authenticated contexts.

This is the recommended approach because:
- it exercises the same `auth.uid()` and `auth.jwt()` behavior that the API uses in production;
- it validates the policies as Postgres sees them during an authenticated request;
- it does not require changing policies, migrations, or authentication logic;
- it avoids the unsupported pattern of manually setting `request.jwt.claim.*` values in the SQL editor.

## Prerequisites
Set these environment variables before running the tests:

```bash
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export RLS_TEST_CLIENT_A_EMAIL=carlos@carlosmendes.com.br
export RLS_TEST_CLIENT_A_PASSWORD=Teste123!
export RLS_TEST_CLIENT_B_EMAIL=vitoria@vitoriamodas.com.br
export RLS_TEST_CLIENT_B_PASSWORD=Teste123!
export RLS_TEST_ADMIN_EMAIL=admin@bbabrazil.com.br
export RLS_TEST_ADMIN_PASSWORD=BBAadmin2025!
```

## Execution
Run the tests with Node's built-in test runner:

```bash
node --test supabase/tests/rls/tenant-isolation.test.mjs
```

The suite will authenticate as:
- client A
- client B
- admin

and then verify tenant isolation, owner isolation, update/delete restrictions, and admin bypass behavior.
