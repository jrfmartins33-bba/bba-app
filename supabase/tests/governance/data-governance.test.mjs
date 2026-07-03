import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

// Same convention as supabase/tests/rls/tenant-isolation.test.mjs and
// supabase/tests/audit/audit-log.test.mjs: real authenticated sessions
// through @supabase/supabase-js, node:test runner, no mocked JWT claims.

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const clientAEmail = process.env.RLS_TEST_CLIENT_A_EMAIL || 'carlos@carlosmendes.com.br';
const clientAPassword = process.env.RLS_TEST_CLIENT_A_PASSWORD || 'Teste123!';
const clientBEmail = process.env.RLS_TEST_CLIENT_B_EMAIL || 'vitoria@vitoriamodas.com.br';
const clientBPassword = process.env.RLS_TEST_CLIENT_B_PASSWORD || 'Teste123!';
const adminEmail = process.env.RLS_TEST_ADMIN_EMAIL || 'admin@bbabrazil.com.br';
const adminPassword = process.env.RLS_TEST_ADMIN_PASSWORD || 'BBAadmin2025!';

const clientAId = process.env.RLS_TEST_CLIENT_A_ID || 'd9e849b1-cd4a-4855-888c-857d8a7a6050';
const companyAId = process.env.RLS_TEST_COMPANY_A_ID || 'eeeeeeee-0000-0000-0000-000000000001';

const KNOWN_BUSINESS_TABLES = [
  'profiles', 'companies', 'projects', 'onboarding_steps', 'onboarding_checklist',
  'tasks', 'task_templates', 'task_attachments', 'chat_channels', 'chat_messages',
  'chat_read_state', 'chat_attachments', 'client_companies', 'client_socios',
  'client_cnaes_secundarios', 'client_documents', 'service_contracts', 'service_scope_items',
  'financial_contas', 'financial_categorias', 'financial_lancamentos', 'financial_cobrancas',
  'fiscal_calendario', 'fiscal_obrigacoes', 'fiscal_guias', 'fiscal_notas_fiscais',
  'fiscal_parcelamentos', 'rh_funcionarios', 'rh_folha_pagamentos', 'societario_socios',
  'societario_capital_social', 'societario_alteracoes', 'societario_assembleias',
  'notifications', 'reports_snapshots', 'audit_log',
];

const RETENTION_CATEGORIES = [
  'Financeiro', 'Fiscal', 'Trabalhista', 'Operacional',
  'Auditoria', 'Logs', 'Chat', 'Uploads', 'Documentos', 'Backups',
];

const CLASSIFICATION_VALUES = [
  'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED',
  'FINANCIAL', 'FISCAL', 'LABOR', 'PERSONAL_DATA', 'SYSTEM', 'AUDIT',
];

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_ equivalents) before running the governance tests.');
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

  return { client, session: data.session };
}

test('data_classification contains a row for every known business table', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client.from('data_classification').select('table_name, classificacao, criticidade');
  assert.equal(error, null, error?.message);

  const catalogued = new Set((data ?? []).map((row) => row.table_name));
  const missing = KNOWN_BUSINESS_TABLES.filter((name) => !catalogued.has(name));
  assert.deepEqual(missing, [], `expected every known business table to be classified, missing: ${missing.join(', ')}`);

  (data ?? []).forEach((row) => {
    assert.ok(CLASSIFICATION_VALUES.includes(row.classificacao), `unexpected classificacao value for ${row.table_name}: ${row.classificacao}`);
  });
});

test('data_classification also covers ref_* tables in bulk', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client
    .from('data_classification')
    .select('table_name, classificacao')
    .like('table_name', 'ref\\_%');

  assert.equal(error, null, error?.message);
  assert.ok((data?.length ?? 0) >= 30, `expected at least 30 ref_* tables to be classified, found ${data?.length ?? 0}`);
  assert.ok(data.every((row) => row.classificacao === 'PUBLIC'), 'expected all ref_* tables to be classified PUBLIC');
});

test('every data_catalog row references a valid retention category (FK integrity, no orphaned category name)', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client.from('data_catalog').select('table_name, retencao_categoria');
  assert.equal(error, null, error?.message);
  assert.ok((data?.length ?? 0) > 0, 'expected at least one data_catalog row');

  const invalid = (data ?? []).filter((row) => !RETENTION_CATEGORIES.includes(row.retencao_categoria));
  assert.deepEqual(invalid, [], `found data_catalog rows with a retencao_categoria outside the fixed list: ${JSON.stringify(invalid)}`);
});

test('data_retention_policy has exactly the 10 required categories with positive retention years', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client.from('data_retention_policy').select('categoria, retencao_minima_anos, retencao_recomendada_anos');
  assert.equal(error, null, error?.message);

  const categories = new Set((data ?? []).map((row) => row.categoria));
  RETENTION_CATEGORIES.forEach((expected) => {
    assert.ok(categories.has(expected), `missing retention policy for category ${expected}`);
  });

  (data ?? []).forEach((row) => {
    assert.ok(Number(row.retencao_minima_anos) > 0, `${row.categoria} should have a positive minimum retention`);
    assert.ok(Number(row.retencao_recomendada_anos) >= Number(row.retencao_minima_anos), `${row.categoria} recommended retention should be >= minimum`);
  });
});

test('ai_data_governance has a policy for all 10 classification values, and every classification used in data_classification is covered', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data: aiPolicies, error: aiError } = await client.from('ai_data_governance').select('classificacao, politica_ia');
  assert.equal(aiError, null, aiError?.message);

  const covered = new Set((aiPolicies ?? []).map((row) => row.classificacao));
  CLASSIFICATION_VALUES.forEach((value) => {
    assert.ok(covered.has(value), `missing AI governance policy for classification ${value}`);
  });

  const sensitive = (aiPolicies ?? []).filter((row) => ['LABOR', 'PERSONAL_DATA', 'RESTRICTED', 'AUDIT'].includes(row.classificacao));
  assert.ok(sensitive.every((row) => row.politica_ia === 'NEVER_SEND'), 'LABOR/PERSONAL_DATA/RESTRICTED/AUDIT must always be NEVER_SEND');
});

test('data_governance_overview view joins classification + catalog + retention + AI policy consistently', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client
    .from('data_governance_overview')
    .select('*')
    .eq('table_name', 'rh_folha_pagamentos')
    .single();

  assert.equal(error, null, error?.message);
  assert.equal(data.classificacao, 'LABOR');
  assert.equal(data.criticidade, 'CRITICAL');
  assert.equal(data.retencao_categoria, 'Trabalhista');
  assert.equal(Number(data.retencao_minima_anos), 5);
  assert.equal(data.politica_ia_recomendada, 'NEVER_SEND');
});

test('a client cannot write to data_classification (admin-only write)', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data, error } = await client
    .from('data_classification')
    .update({ criticidade: 'LOW' })
    .eq('table_name', 'rh_folha_pagamentos')
    .select();

  assert.equal(error, null, error?.message);
  assert.equal(data?.length ?? 0, 0, 'client should not be able to update data_classification');
});

test('user can insert their own consent record and read it back', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data: inserted, error: insertError } = await client
    .from('user_consents')
    .insert({
      user_id: clientAId,
      company_id: companyAId,
      tipo_consentimento: 'termos_uso',
      versao_aceita: 'sec-05-test-v1',
    })
    .select('id, versao_aceita')
    .single();

  assert.equal(insertError, null, insertError?.message);
  assert.equal(inserted.versao_aceita, 'sec-05-test-v1');

  const { data: readBack, error: readError } = await client
    .from('user_consents')
    .select('id')
    .eq('id', inserted.id)
    .maybeSingle();
  assert.equal(readError, null, readError?.message);
  assert.ok(readBack, 'user should be able to read back their own consent record');

  return inserted.id;
});

test('user_consents rows cannot be updated (immutable, mirrors audit_log RULE pattern)', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);

  const { data: created, error: createError } = await client
    .from('user_consents')
    .insert({
      user_id: clientAId,
      company_id: companyAId,
      tipo_consentimento: 'politica_privacidade',
      versao_aceita: 'sec-05-immutability-test-v1',
    })
    .select('id')
    .single();
  assert.equal(createError, null, createError?.message);

  const { error: updateError } = await client
    .from('user_consents')
    .update({ versao_aceita: 'tampered' })
    .eq('id', created.id);
  assert.equal(updateError, null, updateError?.message);

  const { data: after, error: afterError } = await client
    .from('user_consents')
    .select('versao_aceita')
    .eq('id', created.id)
    .single();
  assert.equal(afterError, null, afterError?.message);
  assert.notEqual(after.versao_aceita, 'tampered', 'user_consents row was mutated — immutability RULE is not effective');
});

test('a client cannot insert a consent record impersonating another user', async () => {
  const { client } = await signIn(clientAEmail, clientAPassword);
  const someoneElseId = '9ff84319-08bf-4a67-975e-4a229effdf4d'; // client B

  const { error } = await client
    .from('user_consents')
    .insert({
      user_id: someoneElseId,
      tipo_consentimento: 'termos_uso',
      versao_aceita: 'sec-05-impersonation-test',
    });

  assert.ok(error, 'expected the insert to be rejected by RLS (user_id must equal auth.uid())');
});

test('user can create a data subject request and read their own request', async () => {
  const { client } = await signIn(clientBEmail, clientBPassword);

  const { data: created, error: createError } = await client
    .from('data_subject_requests')
    .insert({
      requester_user_id: process.env.RLS_TEST_CLIENT_B_ID || '9ff84319-08bf-4a67-975e-4a229effdf4d',
      tipo_solicitacao: 'exportacao',
      descricao: 'SEC-05 automated test request',
    })
    .select('id, status')
    .single();

  assert.equal(createError, null, createError?.message);
  assert.equal(created.status, 'pendente');

  const { data: readBack, error: readError } = await client
    .from('data_subject_requests')
    .select('id')
    .eq('id', created.id)
    .maybeSingle();
  assert.equal(readError, null, readError?.message);
  assert.ok(readBack, 'requester should be able to read back their own request');
});

test('a client cannot change the status of a data subject request (admin-only)', async () => {
  const { client } = await signIn(clientBEmail, clientBPassword);
  const requesterId = process.env.RLS_TEST_CLIENT_B_ID || '9ff84319-08bf-4a67-975e-4a229effdf4d';

  const { data: created, error: createError } = await client
    .from('data_subject_requests')
    .insert({
      requester_user_id: requesterId,
      tipo_solicitacao: 'eliminacao',
      descricao: 'SEC-05 status-change guard test',
    })
    .select('id')
    .single();
  assert.equal(createError, null, createError?.message);

  const { data: updateResult, error: updateError } = await client
    .from('data_subject_requests')
    .update({ status: 'concluido' })
    .eq('id', created.id)
    .select();

  assert.equal(updateError, null, updateError?.message);
  assert.equal(updateResult?.length ?? 0, 0, 'client should not be able to self-approve/change status of their own data subject request');
});

test('bba_admin can update the status of a data subject request', async () => {
  const { client: clientB } = await signIn(clientBEmail, clientBPassword);
  const requesterId = process.env.RLS_TEST_CLIENT_B_ID || '9ff84319-08bf-4a67-975e-4a229effdf4d';

  const { data: created, error: createError } = await clientB
    .from('data_subject_requests')
    .insert({
      requester_user_id: requesterId,
      tipo_solicitacao: 'retificacao',
      descricao: 'SEC-05 admin-approval test',
    })
    .select('id')
    .single();
  assert.equal(createError, null, createError?.message);

  const { client: admin } = await signIn(adminEmail, adminPassword);
  const { data: updated, error: updateError } = await admin
    .from('data_subject_requests')
    .update({ status: 'em_analise' })
    .eq('id', created.id)
    .select('status')
    .single();

  assert.equal(updateError, null, updateError?.message);
  assert.equal(updated.status, 'em_analise');
});
