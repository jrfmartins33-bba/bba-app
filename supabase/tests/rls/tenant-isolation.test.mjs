import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

// Correção de segurança (Epic 21, Sprint 21.3C): nenhuma credencial, email
// ou identificador tem mais valor-padrão versionado — toda variável abaixo
// é obrigatória, e a ausência de qualquer uma falha imediatamente, antes
// de autenticar ou tocar no banco.
function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}. This test requires explicit credentials — no default is provided.`);
  }
  return value;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const clientAEmail = requireEnv('RLS_TEST_CLIENT_A_EMAIL');
const clientAPassword = requireEnv('RLS_TEST_CLIENT_A_PASSWORD');
const clientBEmail = requireEnv('RLS_TEST_CLIENT_B_EMAIL');
const clientBPassword = requireEnv('RLS_TEST_CLIENT_B_PASSWORD');
const adminEmail = requireEnv('RLS_TEST_ADMIN_EMAIL');
const adminPassword = requireEnv('RLS_TEST_ADMIN_PASSWORD');

const clientAId = requireEnv('RLS_TEST_CLIENT_A_ID');
const clientBId = requireEnv('RLS_TEST_CLIENT_B_ID');
const adminId = requireEnv('RLS_TEST_ADMIN_ID');
const companyAId = requireEnv('RLS_TEST_COMPANY_A_ID');
const companyBId = requireEnv('RLS_TEST_COMPANY_B_ID');
const taskAId = requireEnv('RLS_TEST_TASK_A_ID');
const taskBId = requireEnv('RLS_TEST_TASK_B_ID');

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) before running the RLS tests.');
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

  return { client, session: data.session };
}

function assertNoRows(rows) {
  assert.equal(rows?.length ?? 0, 0, 'Expected no rows to be visible');
}

function assertRowsContainOnly(rows, expectedIds) {
  const actualIds = (rows ?? []).map((row) => row.id).sort();
  const expected = [...expectedIds].sort();
  assert.deepEqual(actualIds, expected, 'Unexpected rows visible under RLS');
}

function assertRowsContainAtLeast(rows, expectedIds) {
  const actualIds = (rows ?? []).map((row) => row.id).sort();
  const missing = expectedIds.filter((id) => !actualIds.includes(id));
  assert.equal(missing.length, 0, `Expected admin to see rows ${expectedIds.join(', ')}, got ${actualIds.join(', ')}`);
}

test('client A can only read its own profile and company', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data: profiles, error: profileError } = await client.from('profiles').select('id, company_id, role');
  assert.equal(profileError, null, profileError?.message);
  assert.equal(profiles?.length, 1, 'Client A should only see its own profile');
  assert.equal(profiles?.[0].id, clientAId);

  const { data: companies, error: companyError } = await client.from('companies').select('id');
  assert.equal(companyError, null, companyError?.message);
  assert.equal(companies?.length, 1, 'Client A should only see its own company');
  assert.equal(companies?.[0].id, companyAId);
});

test('client A cannot read another tenant data', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data: tenantBCompanies, error: tenantBError } = await client.from('companies').select('id').eq('id', companyBId);
  assert.equal(tenantBError, null, tenantBError?.message);
  assertNoRows(tenantBCompanies);

  const { data: tenantBProfiles, error: profileError } = await client.from('profiles').select('id').eq('id', clientBId);
  assert.equal(profileError, null, profileError?.message);
  assertNoRows(tenantBProfiles);

  const { data: tenantBTasks, error: taskError } = await client.from('tasks').select('id').eq('id', taskBId);
  assert.equal(taskError, null, taskError?.message);
  assertNoRows(tenantBTasks);
});

test('client A can only read its own tenant tasks', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data: tasks, error } = await client.from('tasks').select('id, company_id');
  assert.equal(error, null, error?.message);
  assert.ok(tasks?.length > 0, 'Client A should see at least one task in its tenant');
  assert.ok(tasks?.every((task) => task.company_id === companyAId), 'Client A saw tasks from another tenant');
});

test('client A cannot update another tenant data', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client.from('tasks').update({ title: 'tampered-by-client-a' }).eq('id', taskBId);
  assert.equal(error, null, error?.message);
  assert.equal(data?.length ?? 0, 0, 'Client A should not be able to update another tenant task');
});

test('client A cannot delete another tenant data', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client.from('tasks').delete().eq('id', taskBId);
  assert.equal(error, null, error?.message);
  assert.equal(data?.length ?? 0, 0, 'Client A should not be able to delete another tenant task');
});

test('client A cannot self-promote to admin', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client.from('profiles').update({ role: 'bba_admin' }).eq('id', clientAId);
  assert.equal(error, null, error?.message);
  assert.equal(data?.length ?? 0, 0, 'Client A should not be able to promote itself to bba_admin');
});

test('admin can see cross-tenant data', async () => {
  const { client } = await signIn(adminEmail, adminPassword);

  const { data: companies, error: companyError } = await client.from('companies').select('id');
  assert.equal(companyError, null, companyError?.message);
  assert.ok((companies?.length ?? 0) >= 3, 'Admin should be able to read all companies');

  const { data: tasks, error: taskError } = await client.from('tasks').select('id, company_id');
  assert.equal(taskError, null, taskError?.message);
  assert.ok((tasks?.length ?? 0) >= 3, 'Admin should be able to read tasks across tenants');
  assert.ok(tasks?.some((task) => task.company_id === companyAId), 'Admin should see tenant A task data');
  assert.ok(tasks?.some((task) => task.company_id === companyBId), 'Admin should see tenant B task data');
});
