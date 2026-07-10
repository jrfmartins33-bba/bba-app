// Epic 19, Sprint 4.0 (Contract Freeze) -- proves the three "declared"
// columns and the partial unique index added by
// supabase/migrations/20260711040000_bdos_measurement_workspace_declared_fields.sql,
// using real authenticated sessions (same strategy as
// supabase/tests/rls/tenant-isolation.test.mjs and
// supabase/tests/measurement/bulletin-finalization-guard.test.mjs).
//
// Fixtures use fixed UUIDs and are not deleted afterward (same
// reasoning as the finalization-guard suite: these tables block
// DELETE by design, and this is demo-company data, not real customer
// data).
//
// Run with: node --test supabase/tests/measurement/workspace-declared-fields.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const clientAEmail = process.env.RLS_TEST_CLIENT_A_EMAIL || 'carlos@carlosmendes.com.br';
const clientAPassword = process.env.RLS_TEST_CLIENT_A_PASSWORD || 'Teste123!';

const companyAId = process.env.RLS_TEST_COMPANY_A_ID || 'eeeeeeee-0000-0000-0000-000000000001';
const engineeringProjectAId = process.env.MEASUREMENT_TEST_PROJECT_A_ID || '23c7c492-8721-4507-b05d-bf730d2439ab';

// Fixed fixture ids, continuing the 40000000-... convention from
// bulletin-finalization-guard.test.mjs (…0001-…0006 already used there).
const nativeWorkspaceId1 = '40000000-0000-0000-0000-000000000007';
const nativeWorkspaceId2 = '40000000-0000-0000-0000-000000000008';
const bulletinImportId = '40000000-0000-0000-0000-000000000009';
const workspaceForImportId = '40000000-0000-0000-0000-000000000010';
const duplicateWorkspaceForSameImportId = '40000000-0000-0000-0000-000000000011';
const badDeclaredNumberWorkspaceId = '40000000-0000-0000-0000-000000000012';
const invertedDeclaredPeriodWorkspaceId = '40000000-0000-0000-0000-000000000013';
const declaredVsOfficialWorkspaceId = '40000000-0000-0000-0000-000000000014';

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) before running this test.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email, password) {
  const client = createSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Authentication failed for ${email}: ${error.message}`);
  }

  if (!data.session) {
    throw new Error(`No session returned for ${email}`);
  }

  return client;
}

function baseWorkspace(overrides) {
  return {
    company_id: companyAId,
    engineering_project_id: engineeringProjectAId,
    period_number: 1,
    start_date: '2026-06-01',
    end_date: '2026-06-30',
    status: 'Draft',
    ...overrides,
  };
}

test('accepts a native workspace with measurement_bulletin_import_id = NULL', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('measurement_workspaces').upsert(
    baseWorkspace({ id: nativeWorkspaceId1, measurement_bulletin_import_id: null }),
    { onConflict: 'id' },
  );
  assert.equal(error, null, error?.message);
});

test('accepts multiple native workspaces, all with NULL import id', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('measurement_workspaces').upsert(
    baseWorkspace({ id: nativeWorkspaceId2, measurement_bulletin_import_id: null, period_number: 2 }),
    { onConflict: 'id' },
  );
  assert.equal(error, null, 'a second native workspace with NULL import id should not collide with the first');
});

test('rejects a second workspace for the same measurement_bulletin_import_id', async () => {
  const client = await signIn(clientAEmail, clientAPassword);

  // fixture: the import row, and the first workspace it originates.
  const { error: importError } = await client.from('measurement_bulletin_imports').upsert(
    {
      id: bulletinImportId,
      company_id: companyAId,
      engineering_project_id: engineeringProjectAId,
      file_name: 'teste-declared-fields.xlsx',
      storage_path: `${companyAId}/teste-declared-fields.xlsx`,
      status: 'uploaded',
    },
    { onConflict: 'id' },
  );
  assert.equal(importError, null, importError?.message);

  const { error: firstWorkspaceError } = await client.from('measurement_workspaces').upsert(
    baseWorkspace({ id: workspaceForImportId, measurement_bulletin_import_id: bulletinImportId }),
    { onConflict: 'id' },
  );
  assert.equal(firstWorkspaceError, null, firstWorkspaceError?.message);

  // A second, DIFFERENT workspace row pointing at the same import must
  // always be rejected -- plain insert (not upsert), since this row
  // must never actually exist.
  const { error: duplicateError } = await client.from('measurement_workspaces').insert(
    baseWorkspace({ id: duplicateWorkspaceForSameImportId, measurement_bulletin_import_id: bulletinImportId }),
  );
  assert.notEqual(duplicateError, null, 'a second workspace for the same import should be rejected by the partial unique index');
  assert.equal(duplicateError.code, '23505', 'expected a unique_violation, not a different error');
});

test('accepts declared_bulletin_number/declared_period_start/declared_period_end as NULL', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { data, error } = await client
    .from('measurement_workspaces')
    .select('declared_bulletin_number, declared_period_start, declared_period_end')
    .eq('id', nativeWorkspaceId1)
    .single();
  assert.equal(error, null, error?.message);
  assert.equal(data.declared_bulletin_number, null);
  assert.equal(data.declared_period_start, null);
  assert.equal(data.declared_period_end, null);
});

test('rejects declared_bulletin_number <= 0', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('measurement_workspaces').insert(
    baseWorkspace({ id: badDeclaredNumberWorkspaceId, measurement_bulletin_import_id: null, declared_bulletin_number: 0 }),
  );
  assert.notEqual(error, null, 'declared_bulletin_number = 0 should be rejected');
  assert.equal(error.code, '23514', 'expected a check_violation');
});

test('rejects an inverted declared period (end before start)', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('measurement_workspaces').insert(
    baseWorkspace({
      id: invertedDeclaredPeriodWorkspaceId,
      measurement_bulletin_import_id: null,
      declared_period_start: '2026-06-30',
      declared_period_end: '2026-06-01',
    }),
  );
  assert.notEqual(error, null, 'declared_period_end before declared_period_start should be rejected');
  assert.equal(error.code, '23514', 'expected a check_violation');
});

test('keeps declared period independent from the official period (they may differ)', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('measurement_workspaces').upsert(
    baseWorkspace({
      id: declaredVsOfficialWorkspaceId,
      measurement_bulletin_import_id: null,
      start_date: '2026-06-01', // official
      end_date: '2026-06-30', // official
      declared_bulletin_number: 8,
      declared_period_start: '2026-05-28', // declared, deliberately different from official
      declared_period_end: '2026-06-27', // declared, deliberately different from official
    }),
    { onConflict: 'id' },
  );
  assert.equal(error, null, error?.message);

  const { data, error: readError } = await client
    .from('measurement_workspaces')
    .select('start_date, end_date, declared_period_start, declared_period_end')
    .eq('id', declaredVsOfficialWorkspaceId)
    .single();
  assert.equal(readError, null, readError?.message);
  assert.notEqual(data.start_date, data.declared_period_start, 'official and declared start dates should be stored independently, not collapsed into one');
  assert.notEqual(data.end_date, data.declared_period_end, 'official and declared end dates should be stored independently, not collapsed into one');
});
