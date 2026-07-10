// Epic 19, Sprint 3 (Measurement Bulletin Import) -- proves the
// finalization guard trigger (measurement_bulletins_prevent_update_after_finalization,
// see supabase/migrations/20260711010000_bdos_measurement_bulletin_finalization_guard.sql)
// and RLS isolation for the new tables, using real authenticated
// sessions via @supabase/supabase-js -- same strategy as
// supabase/tests/rls/tenant-isolation.test.mjs (see its README:
// simulating request.jwt.claim.* in SQL is deliberately not used here).
//
// Fixtures use fixed UUIDs (same convention as taskAId/taskBId in the
// RLS suite) and are NOT deleted afterward: measurement_bulletins,
// measurement_workspaces, managed_service_items and work_packages all
// block DELETE by design (immutable provenance, same reasoning as
// planning_imports) -- there is structurally no client-authorized way
// to clean them up. This is demo-company data (eeeeeeee-...-000000000001,
// the same fake "Carlos Mendes" company already used by the RLS
// suite), not real customer data.
//
// Run with: node --test supabase/tests/measurement/bulletin-finalization-guard.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const clientAEmail = process.env.RLS_TEST_CLIENT_A_EMAIL || 'carlos@carlosmendes.com.br';
const clientAPassword = process.env.RLS_TEST_CLIENT_A_PASSWORD || 'Teste123!';
const clientBEmail = process.env.RLS_TEST_CLIENT_B_EMAIL || 'vitoria@vitoriamodas.com.br';
const clientBPassword = process.env.RLS_TEST_CLIENT_B_PASSWORD || 'Teste123!';

// Fixed, reusable "authenticated but no company" user -- get_my_company_id()
// returns NULL for this session, exercising the company_id = get_my_company_id()
// comparison (NULL = anything is NULL, never true) in every policy,
// including the child-table subqueries. Created once via signUp (no
// email confirmation required in this project); subsequent runs fall
// back to signInWithPassword. Deliberately a single fixed account,
// not a fresh signUp per run, to avoid accumulating auth.users rows.
const noCompanyEmail = process.env.MEASUREMENT_TEST_NO_COMPANY_EMAIL || 'sem-empresa@teste.bba.com.br';
const noCompanyPassword = process.env.MEASUREMENT_TEST_NO_COMPANY_PASSWORD || 'TesteSemEmpresa123!';

const companyAId = process.env.RLS_TEST_COMPANY_A_ID || 'eeeeeeee-0000-0000-0000-000000000001';
// Pre-existing engineering_projects row for company A (created by an
// earlier manual BM_08 import test in this same Epic, reused here
// instead of fabricating a second one).
const engineeringProjectAId = process.env.MEASUREMENT_TEST_PROJECT_A_ID || '23c7c492-8721-4507-b05d-bf730d2439ab';

// Fixed fixture ids (same convention as taskAId/taskBId).
const workPackageId = '40000000-0000-0000-0000-000000000001';
const serviceItemId = '40000000-0000-0000-0000-000000000002';
const workspaceId = '40000000-0000-0000-0000-000000000003';
const bulletinId = '40000000-0000-0000-0000-000000000004';
// Dedicated fixtures for the review-adjustments migration
// (20260711030000): a second workspace, closed on purpose, kept
// separate from `workspaceId` above so closing it never blocks future
// runs from reusing the main Draft/Finalized fixture chain.
const duplicateCodeServiceItemId = '40000000-0000-0000-0000-000000000005';
const closedWorkspaceId = '40000000-0000-0000-0000-000000000006';

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) before running this test.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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

// signUp first (idempotent in intent: only the first run actually
// creates the account); falls back to signInWithPassword once the
// account exists, matching the same fixed-account convention as
// clientA/clientB above.
async function signInOrSignUp(email, password) {
  const client = createSupabaseClient();
  const { data, error } = await client.auth.signUp({ email, password });

  if (!error && data.session) {
    return client;
  }

  return signIn(email, password);
}

// Ensures the fixture chain (work_package -> service_item -> workspace
// -> bulletin) exists, without erroring on repeated runs -- upsert on
// the fixed ids rather than plain insert.
async function ensureFixtures(client) {
  const { error: workPackageError } = await client.from('work_packages').upsert(
    {
      id: workPackageId,
      company_id: companyAId,
      engineering_project_id: engineeringProjectAId,
      code: 'TEST-WP-01',
      normalized_code: 'TEST-WP-01',
      name: '[teste] Frente de teste do trigger de finalização',
      type: 'execution_front',
    },
    { onConflict: 'id' },
  );
  assert.equal(workPackageError, null, workPackageError?.message);

  const { error: serviceItemError } = await client.from('managed_service_items').upsert(
    {
      id: serviceItemId,
      company_id: companyAId,
      engineering_project_id: engineeringProjectAId,
      work_package_id: workPackageId,
      code: 'TEST-SI-01',
      description: '[teste] Item de serviço do trigger de finalização',
      unit: 'un',
      contract_quantity: 100,
      unit_price: 10,
    },
    { onConflict: 'id' },
  );
  assert.equal(serviceItemError, null, serviceItemError?.message);

  const { error: workspaceError } = await client.from('measurement_workspaces').upsert(
    {
      id: workspaceId,
      company_id: companyAId,
      engineering_project_id: engineeringProjectAId,
      period_number: 1,
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      status: 'Draft',
    },
    { onConflict: 'id' },
  );
  assert.equal(workspaceError, null, workspaceError?.message);

  // Bulletin always resets to Draft/finalized_at=null at the start of
  // a run, so tests B-F exercise the real transition every time
  // rather than short-circuiting on an already-finalized row from a
  // previous run. This UPDATE only succeeds while not yet finalized
  // -- see the "reset" note in the finalize test below for the one
  // case where this needs a raw fallback.
  const { error: bulletinError } = await client.from('measurement_bulletins').upsert(
    {
      id: bulletinId,
      company_id: companyAId,
      engineering_project_id: engineeringProjectAId,
      measurement_workspace_id: workspaceId,
      bulletin_number: 1,
      period_number: 1,
      issue_date: '2026-06-30',
      status: 'Draft',
      lines: [],
      totals: {},
      validation_issues: [],
      finalized_at: null,
    },
    { onConflict: 'id' },
  );

  // A finalized row cannot be reset by this upsert (the trigger
  // rejects it) -- that is fine, it just means a previous run already
  // finalized it; tests C-F still have a valid finalized row to
  // exercise, and test A/B are skipped naturally by asserting on the
  // fixture's *current* state instead of assuming Draft.
  return bulletinError;
}

test('fixture setup (work_package -> service_item -> workspace -> bulletin)', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  await ensureFixtures(client);

  const { data: bulletin, error } = await client.from('measurement_bulletins').select('id, status, finalized_at').eq('id', bulletinId).single();
  assert.equal(error, null, error?.message);
  assert.ok(bulletin, 'fixture bulletin should exist after upsert');
});

test('A: Draft bulletin can be updated', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { data: before } = await client.from('measurement_bulletins').select('status, finalized_at').eq('id', bulletinId).single();

  if (before.finalized_at !== null) {
    return; // already finalized by a previous run -- covered by tests C-F instead.
  }

  const { data, error } = await client.from('measurement_bulletins').update({ issue_date: '2026-06-29' }).eq('id', bulletinId).select();
  assert.equal(error, null, error?.message);
  assert.equal(data?.length, 1, 'Draft bulletin update should succeed');
});

test('B: Draft -> Validated -> Finalized transition succeeds', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { data: before } = await client.from('measurement_bulletins').select('status, finalized_at').eq('id', bulletinId).single();

  if (before.finalized_at !== null) {
    assert.equal(before.status, 'Finalized', 'a row with finalized_at set must have status Finalized (CHECK constraint)');
    return; // already finalized by a previous run.
  }

  const { error: validateError } = await client.from('measurement_bulletins').update({ status: 'Validated' }).eq('id', bulletinId);
  assert.equal(validateError, null, validateError?.message);

  const { data, error: finalizeError } = await client
    .from('measurement_bulletins')
    .update({ status: 'Finalized', finalized_at: new Date().toISOString() })
    .eq('id', bulletinId)
    .select();
  assert.equal(finalizeError, null, finalizeError?.message);
  assert.equal(data?.length, 1, 'finalize transition should succeed while not yet finalized');
});

test('C: Finalized bulletin rejects changes to lines', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('measurement_bulletins').update({ lines: [{ tampered: true }] }).eq('id', bulletinId);
  assert.notEqual(error, null, 'updating lines on a finalized bulletin should be rejected');
  assert.match(error.message, /immutable/i);
});

test('D: Finalized bulletin rejects changes to totals', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('measurement_bulletins').update({ totals: { tampered: true } }).eq('id', bulletinId);
  assert.notEqual(error, null, 'updating totals on a finalized bulletin should be rejected');
  assert.match(error.message, /immutable/i);
});

test('E: Finalized bulletin rejects reverting status to Draft', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('measurement_bulletins').update({ status: 'Draft' }).eq('id', bulletinId);
  assert.notEqual(error, null, 'reverting status on a finalized bulletin should be rejected');
  assert.match(error.message, /immutable/i);
});

test('F: Finalized bulletin rejects clearing finalized_at', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('measurement_bulletins').update({ finalized_at: null }).eq('id', bulletinId);
  assert.notEqual(error, null, 'clearing finalized_at on a finalized bulletin should be rejected');
  assert.match(error.message, /immutable/i);
});

test('cross-company: client B cannot read company A measurement_bulletins', async () => {
  const client = await signIn(clientBEmail, clientBPassword);
  const { data, error } = await client.from('measurement_bulletins').select('id').eq('id', bulletinId);
  assert.equal(error, null, error?.message);
  assert.equal(data?.length ?? 0, 0, 'Client B should not see company A bulletin rows');
});

test('cross-company: client B cannot update company A measurement_bulletins', async () => {
  const client = await signIn(clientBEmail, clientBPassword);
  const { data, error } = await client.from('measurement_bulletins').update({ issue_date: '2026-01-01' }).eq('id', bulletinId).select();
  assert.equal(error, null, error?.message);
  assert.equal(data?.length ?? 0, 0, 'Client B should not be able to update company A bulletin rows');
});

test('anon: cannot read measurement_bulletins at all', async () => {
  const client = createSupabaseClient();
  const { error } = await client.from('measurement_bulletins').select('id').eq('id', bulletinId);
  assert.notEqual(error, null, 'anon should be denied access, not just see zero rows');
});

test('authenticated without company: cannot read any measurement_bulletins row', async () => {
  const client = await signInOrSignUp(noCompanyEmail, noCompanyPassword);
  const { data, error } = await client.from('measurement_bulletins').select('id');
  assert.equal(error, null, error?.message);
  assert.equal(data?.length ?? 0, 0, 'a session with no company should see zero rows (get_my_company_id() is NULL)');
});

test('authenticated without company: cannot insert into measurement_bulletins', async () => {
  const client = await signInOrSignUp(noCompanyEmail, noCompanyPassword);
  const { error } = await client.from('measurement_bulletins').insert({
    id: '40000000-0000-0000-0000-000000000099',
    company_id: companyAId,
    engineering_project_id: engineeringProjectAId,
    measurement_workspace_id: workspaceId,
    bulletin_number: 999,
    period_number: 1,
    issue_date: '2026-06-30',
    lines: [],
    totals: {},
  });
  assert.notEqual(error, null, 'a session with no company should not be able to insert, even naming a real company_id');
});

test('authenticated without company: cannot read child table measurement_workspace_lines (subquery against parent workspace)', async () => {
  const client = await signInOrSignUp(noCompanyEmail, noCompanyPassword);
  const { data, error } = await client.from('measurement_workspace_lines').select('id').eq('measurement_workspace_id', workspaceId);
  assert.equal(error, null, error?.message);
  assert.equal(data?.length ?? 0, 0, 'a session with no company should see zero rows in the child table too');
});

// Review adjustments (20260711030000_bdos_measurement_bulletin_review_adjustments.sql)

test('adjustment 1: managed_service_items no longer enforces unique code per project', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { error } = await client.from('managed_service_items').upsert(
    {
      id: duplicateCodeServiceItemId,
      company_id: companyAId,
      engineering_project_id: engineeringProjectAId,
      work_package_id: workPackageId,
      code: 'TEST-SI-01', // deliberately the same code as `serviceItemId`'s fixture
      description: '[teste] segundo item com o mesmo código (constraint removida)',
      unit: 'un',
      contract_quantity: 1,
      unit_price: 1,
    },
    { onConflict: 'id' },
  );
  assert.equal(error, null, 'duplicate code within the same project should be accepted (constraint intentionally removed, see Sprint 3 review)');
});

test('adjustment 4: closed workspace can be reached (Draft -> Closed), then rejects further updates', async () => {
  const client = await signIn(clientAEmail, clientAPassword);
  const { data: existing } = await client.from('measurement_workspaces').select('status').eq('id', closedWorkspaceId).maybeSingle();

  if (!existing) {
    const { error: createError } = await client.from('measurement_workspaces').insert({
      id: closedWorkspaceId,
      company_id: companyAId,
      engineering_project_id: engineeringProjectAId,
      period_number: 2,
      start_date: '2026-07-01',
      end_date: '2026-07-31',
      status: 'Draft',
    });
    assert.equal(createError, null, createError?.message);
  }

  const { data: before } = await client.from('measurement_workspaces').select('status').eq('id', closedWorkspaceId).single();

  if (before.status !== 'Closed') {
    const { data, error } = await client.from('measurement_workspaces').update({ status: 'Closed' }).eq('id', closedWorkspaceId).select();
    assert.equal(error, null, error?.message);
    assert.equal(data?.length, 1, 'transition to Closed should succeed while not yet closed');
  }

  const { error: rejectError } = await client.from('measurement_workspaces').update({ status: 'InProgress' }).eq('id', closedWorkspaceId);
  assert.notEqual(rejectError, null, 'reopening a closed workspace should be rejected');
  assert.match(rejectError.message, /immutable/i);
});
