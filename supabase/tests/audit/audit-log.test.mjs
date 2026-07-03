import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

// Mirrors supabase/tests/rls/tenant-isolation.test.mjs exactly: real
// authenticated sessions through @supabase/supabase-js, no mocked
// request.jwt.claim.* values, no changes to policies/migrations required
// to run.

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const clientAEmail = process.env.RLS_TEST_CLIENT_A_EMAIL || 'carlos@carlosmendes.com.br';
const clientAPassword = process.env.RLS_TEST_CLIENT_A_PASSWORD || 'Teste123!';
const clientBEmail = process.env.RLS_TEST_CLIENT_B_EMAIL || 'vitoria@vitoriamodas.com.br';
const clientBPassword = process.env.RLS_TEST_CLIENT_B_PASSWORD || 'Teste123!';
const adminEmail = process.env.RLS_TEST_ADMIN_EMAIL || 'admin@bbabrazil.com.br';
const adminPassword = process.env.RLS_TEST_ADMIN_PASSWORD || 'BBAadmin2025!';

const companyAId = process.env.RLS_TEST_COMPANY_A_ID || 'eeeeeeee-0000-0000-0000-000000000001';
const companyBId = process.env.RLS_TEST_COMPANY_B_ID || 'eeeeeeee-0000-0000-0000-000000000002';

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) before running the audit tests.');
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

test('audit_log rows cannot be updated by an authenticated client (audit_no_update RULE)', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data: before, error: beforeError } = await client
    .from('audit_log')
    .select('id, descricao')
    .eq('company_id', companyAId)
    .limit(1);
  assert.equal(beforeError, null, beforeError?.message);

  if (!before?.length) {
    console.log('[audit-log.test] No audit_log rows for company A yet; skipping update-immutability assertion body, RULE is still verified structurally in the migration.');
    return;
  }

  const targetId = before[0].id;
  const { error: updateError } = await client
    .from('audit_log')
    .update({ descricao: 'tampered-by-test' })
    .eq('id', targetId);
  assert.equal(updateError, null, updateError?.message);

  const { data: after, error: afterError } = await client
    .from('audit_log')
    .select('descricao')
    .eq('id', targetId)
    .single();
  assert.equal(afterError, null, afterError?.message);
  assert.notEqual(after.descricao, 'tampered-by-test', 'audit_log row was mutated — audit_no_update RULE is not effective');
});

test('audit_log rows cannot be deleted by an authenticated client (audit_no_delete RULE)', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data: before, error: beforeError } = await client
    .from('audit_log')
    .select('id')
    .eq('company_id', companyAId)
    .limit(1);
  assert.equal(beforeError, null, beforeError?.message);

  if (!before?.length) {
    console.log('[audit-log.test] No audit_log rows for company A yet; skipping delete-immutability assertion body.');
    return;
  }

  const targetId = before[0].id;
  const { error: deleteError } = await client.from('audit_log').delete().eq('id', targetId);
  assert.equal(deleteError, null, deleteError?.message);

  const { data: stillThere, error: checkError } = await client
    .from('audit_log')
    .select('id')
    .eq('id', targetId)
    .maybeSingle();
  assert.equal(checkError, null, checkError?.message);
  assert.ok(stillThere, 'audit_log row was deleted — audit_no_delete RULE is not effective');
});

test('client A cannot read audit_log rows belonging to company B (existing audit_sel policy)', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client
    .from('audit_log')
    .select('id')
    .eq('company_id', companyBId);

  assert.equal(error, null, error?.message);
  assert.equal(data?.length ?? 0, 0, 'Client A should not see company B audit_log rows');
});

test('log_audit_event() RPC derives user_id/company_id from the caller and preserves correlacao_id', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);
  const correlationId = '11111111-1111-4111-8111-111111111111';

  const { data: logId, error } = await client.rpc('log_audit_event', {
    p_acao: 'VIEW_SENSITIVE',
    p_entidade: 'audit_log_test',
    p_descricao: 'SEC-04 automated test event',
    p_correlacao_id: correlationId,
    p_origem: 'API',
  });

  assert.equal(error, null, error?.message);
  assert.ok(logId, 'log_audit_event should return the new row id');

  const { data: row, error: readError } = await client
    .from('audit_log')
    .select('user_id, company_id, correlacao_id, severidade, ator_tipo, origem')
    .eq('id', logId)
    .single();

  assert.equal(readError, null, readError?.message);
  assert.equal(row.company_id, companyAId, 'company_id should be derived from the caller profile, not guessable/spoofable');
  assert.equal(row.correlacao_id, correlationId, 'correlacao_id should round-trip unchanged');
  assert.equal(row.ator_tipo, 'client', 'ator_tipo should reflect the caller profile role at event time');
  assert.equal(row.origem, 'API');
  assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(row.severidade), 'severidade should always be classified');
});

test('generic row-change trigger captures an INSERT end-to-end (client_documents)', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data: inserted, error: insertError } = await client
    .from('client_documents')
    .insert({
      company_id: companyAId,
      tipo_documento: 'Outros',
      nome: 'SEC-04 automated test document',
    })
    .select('id')
    .single();
  assert.equal(insertError, null, insertError?.message);

  const { data: auditRows, error: auditError } = await client
    .from('audit_log')
    .select('acao, entidade, entidade_id, dados_depois, severidade')
    .eq('entidade', 'client_documents')
    .eq('entidade_id', inserted.id)
    .order('created_at', { ascending: false })
    .limit(1);

  assert.equal(auditError, null, auditError?.message);
  assert.equal(auditRows?.length, 1, 'expected exactly one audit_log row for the new client_documents insert');
  assert.equal(auditRows[0].acao, 'INSERT');
  assert.equal(auditRows[0].entidade_id, inserted.id);
  assert.equal(auditRows[0].dados_depois?.nome, 'SEC-04 automated test document');
});

test('a client (non-admin) cannot call get_audit_log_for_admin()', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client.rpc('get_audit_log_for_admin', { p_limit: 10 });

  assert.equal(data, null, 'a non-admin caller should not receive any rows');
  assert.ok(error, 'expected get_audit_log_for_admin to reject a non-admin caller');
});

test('bba_admin can read cross-tenant audit_log rows via get_audit_log_for_admin()', async () => {
  const { client } = await signIn(adminEmail, adminPassword);

  const { data, error } = await client.rpc('get_audit_log_for_admin', { p_limit: 200 });
  assert.equal(error, null, error?.message);

  const companyIds = new Set((data ?? []).map((row) => row.company_id).filter(Boolean));
  assert.ok(companyIds.size >= 1, 'admin should be able to read at least one tenant worth of audit_log rows');
});

test('a client (non-admin) cannot call audit_log_retention_status()', async () => {
  const { client } = await signIn(clientBEmail, clientBPassword);

  const { data, error } = await client.rpc('audit_log_retention_status');

  assert.equal(data, null, 'a non-admin caller should not receive retention status rows');
  assert.ok(error, 'expected audit_log_retention_status to reject a non-admin caller');
});

test('bba_admin can read the retention policy definition via audit_log_retention_status()', async () => {
  const { client } = await signIn(adminEmail, adminPassword);

  const { data, error } = await client.rpc('audit_log_retention_status');
  assert.equal(error, null, error?.message);
  assert.ok((data?.length ?? 0) > 0, 'expected at least one retention policy row');

  const financial = data.find((row) => row.entidade === 'financial_lancamentos');
  assert.ok(financial, 'expected financial_lancamentos to be classified under the retention policy');
  assert.equal(financial.categoria, 'fiscal_trabalhista_societario');
  assert.equal(financial.retencao_minima_anos, 5);

  const profile = data.find((row) => row.entidade === 'profiles');
  assert.ok(profile, 'expected profiles to be classified under the retention policy');
  assert.equal(profile.retencao_minima_anos, 2);
});
