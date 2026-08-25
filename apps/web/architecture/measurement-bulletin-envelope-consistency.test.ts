// Etapa 3C.1C (correção cirúrgica) -- prova estática de que o bypass
// do cabeçalho/referência/contexto-decimal vazio (`{}`) foi eliminado
// do trigger de consistência do envelope formal do boletim de medição,
// e que o repository parou de inventar `{}`/`[]` silenciosamente
// quando o chamador omite o envelope.
//
// Assim como lagoa-contractual-foundation.test.ts (verificação de DDL
// de consórcio/baseline), este arquivo lê o texto bruto da migration
// e do repository -- não conecta a um Postgres real. A migration
// 20260825120000_measurement_bulletin_formal_envelope.sql
// deliberadamente não foi aplicada no Supabase nesta rodada (ver
// instruções da tarefa); este teste comprova a correção da SQL sem
// tocar o banco.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260825120000_measurement_bulletin_formal_envelope.sql"),
  "utf8"
);
const repository = readFileSync(resolve(root, "apps/web/lib/bdos/measurement-repository.ts"), "utf8");

// --- 1. O bypass de "só valida se não for {}" foi removido -----------------

assert(
  "header = {} não passa mais despercebido -- o gate 'IF NEW.header <> {} THEN' foi removido",
  !migration.includes("NEW.header IS NOT NULL AND NEW.header <> '{}'::jsonb")
);

assert(
  "referência ausente (reference = {}) não passa mais despercebida -- o gate 'IF NEW.reference <> {} THEN' foi removido",
  !migration.includes("NEW.reference IS NOT NULL AND NEW.reference <> '{}'::jsonb")
);

assert(
  "a obrigatoriedade do responsável técnico deixou de ser restrita a status IN (Validated, Finalized) -- agora é incondicional",
  !migration.includes("NEW.status IN ('Validated', 'Finalized')")
);

// --- 2. Rejeição incondicional (ausência nunca vira 'nada para comparar') --

assert(
  "referência ausente não passa: reference.id é exigido incondicionalmente",
  migration.includes("v_ref_id IS NULL OR trim(v_ref_id) = ''") &&
    migration.includes("reference.id é obrigatório e não pode estar ausente ou vazio")
);

assert(
  "header.projectId ausente não passa incondicionalmente",
  migration.includes("v_header_project_id IS NULL OR trim(v_header_project_id) = ''") &&
    migration.includes("header.projectId é obrigatório e não pode estar ausente ou vazio")
);

assert(
  "header.periodNumber ausente não passa incondicionalmente",
  migration.includes("v_header_period_number IS NULL OR trim(v_header_period_number) = ''") &&
    migration.includes("header.periodNumber é obrigatório e não pode estar ausente ou vazio")
);

assert(
  "data de emissão ausente não passa: header.issueDate é exigido incondicionalmente",
  migration.includes("v_header_issue_date IS NULL OR trim(v_header_issue_date) = ''") &&
    migration.includes("header.issueDate é obrigatório e não pode estar ausente ou vazio")
);

assert(
  "responsável técnico ausente (ID) não passa incondicionalmente, em qualquer status",
  migration.includes("v_header_tech_id IS NULL OR trim(v_header_tech_id) = ''") &&
    migration.includes("header.technicalResponsibleId é obrigatório e não pode estar ausente ou vazio")
);

assert(
  "responsável técnico ausente (Nome) não passa incondicionalmente, em qualquer status",
  migration.includes("v_header_tech_name IS NULL OR trim(v_header_tech_name) = ''") &&
    migration.includes("header.technicalResponsibleName é obrigatório e não pode estar ausente ou vazio")
);

assert(
  "contexto decimal incompleto (sem quantityScale/unitValueScale/monetaryPolicy) não passa",
  migration.includes("NEW.decimal_context->>'quantityScale' IS NULL") &&
    migration.includes("decimal_context é obrigatório e materialmente incompleto")
);

// --- 3. Envelope completo válido continua sendo aceito (cross-checks preservados) --

assert(
  "envelope completo válido: reference.id continua confrontado contra measurement_workspace_id",
  migration.includes("v_ref_id::uuid <> NEW.measurement_workspace_id")
);
assert(
  "envelope completo válido: header.projectId continua confrontado contra engineering_project_id",
  migration.includes("v_header_project_id::uuid <> NEW.engineering_project_id")
);
assert(
  "envelope completo válido: header.periodNumber continua confrontado contra period_number",
  migration.includes("(v_header_period_number::int) <> NEW.period_number")
);
assert(
  "envelope completo válido: header.issueDate continua confrontado contra issue_date",
  migration.includes("(v_header_issue_date::date) <> NEW.issue_date")
);

// --- 4. Segurança do trigger: SECURITY INVOKER + search_path fixo ----------

assert(
  "função de consistência roda com SECURITY INVOKER, não privilégios elevados",
  migration.includes("SECURITY INVOKER") && !migration.includes("SECURITY DEFINER")
);
assert(
  "função de consistência fixa SET search_path = public, pg_temp",
  migration.includes("SET search_path = public, pg_temp")
);

// --- 5. Repository não inventa mais {}/[] silenciosamente ------------------

const insertFnStart = repository.indexOf("export const insertMeasurementBulletin = async");
const insertFnEnd = repository.indexOf("export const getMeasurementBulletinById", insertFnStart);
assert("insertMeasurementBulletin encontrado no repository", insertFnStart !== -1 && insertFnEnd !== -1);
const insertFnSource = repository.slice(insertFnStart, insertFnEnd);

assert(
  "repository não injeta mais '?? {}' para reference/header/decimalContext/metadata",
  !insertFnSource.includes("?? {}")
);
assert(
  "repository não injeta mais '?? []' para validationIssues/trace",
  !insertFnSource.includes("?? []")
);
assert(
  "reference/header/decimalContext/validationIssues/trace/metadata são parâmetros obrigatórios (sem '?:')",
  !insertFnSource.includes("reference?: unknown") &&
    !insertFnSource.includes("header?: unknown") &&
    !insertFnSource.includes("decimalContext?: unknown") &&
    !insertFnSource.includes("validationIssues?: unknown") &&
    !insertFnSource.includes("trace?: unknown") &&
    !insertFnSource.includes("metadata?: unknown")
);
assert(
  "o envelope é gravado verbatim (reference/header/decimalContext/validationIssues/trace/metadata sem fallback)",
  insertFnSource.includes("reference: params.reference,") &&
    insertFnSource.includes("header: params.header,") &&
    insertFnSource.includes("decimal_context: params.decimalContext,") &&
    insertFnSource.includes("validation_issues: params.validationIssues,") &&
    insertFnSource.includes("trace: params.trace,") &&
    insertFnSource.includes("metadata: params.metadata")
);

function assert(name: string, condition: boolean): void {
  if (!condition) throw new Error(name);
  console.log(`ok - ${name}`);
}
