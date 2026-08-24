import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260824231909_measurement_certification_traceability.sql",
);
const previousMeasurementMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260711000000_bdos_measurement_bulletin_import.sql",
);
const sql = readFileSync(migrationPath, "utf8");
const previousMeasurementSql = readFileSync(previousMeasurementMigrationPath, "utf8");

test("keeps the direct workspace-line to operational-item relationship and enforces relational scope", () => {
  assert.match(
    previousMeasurementSql,
    /managed_service_item_id UUID NOT NULL REFERENCES managed_service_items\(id\)/,
  );
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.enforce_measurement_workspace_line_scope\(\)/);
  assert.match(sql, /mw\.company_id = msi\.company_id/);
  assert.match(sql, /mw\.engineering_project_id = msi\.engineering_project_id/);
  assert.match(
    sql,
    /BEFORE INSERT OR UPDATE OF measurement_workspace_id, managed_service_item_id/,
  );
  assert.doesNotMatch(sql, /CREATE TABLE public\.measurement_(execution|workspace)_item_links/i);
});

test("rejects cross-project and cross-organization scope at the database boundary", () => {
  assert.match(sql, /Existing measurement workspace line crosses organization or project scope/);
  assert.match(sql, /USING ERRCODE = '23514'/);
  assert.match(sql, /mb\.company_id = mw\.company_id/);
  assert.match(sql, /mb\.company_id = msi\.company_id/);
  assert.match(sql, /mb\.engineering_project_id = mw\.engineering_project_id/);
  assert.match(sql, /mb\.engineering_project_id = msi\.engineering_project_id/);
});

test("preserves temporal cardinality and rejects duplicate item inside one workspace", () => {
  assert.match(
    previousMeasurementSql,
    /UNIQUE \(measurement_workspace_id, managed_service_item_id\)/,
  );
  assert.doesNotMatch(sql, /UNIQUE\s*\(managed_service_item_id\)/i);
  assert.match(sql, /measurement_cycles_workspace_once UNIQUE \(measurement_workspace_id\)/);
});

test("persists the existing cycle state machine with actor, time and evidence", () => {
  assert.match(
    sql,
    /status IN \('draft', 'measured', 'bulletin_generated', 'certified', 'closed'\)/,
  );
  assert.match(sql, /WHEN 'draft' THEN 'measured'/);
  assert.match(sql, /WHEN 'measured' THEN 'bulletin_generated'/);
  assert.match(sql, /WHEN 'bulletin_generated' THEN 'certified'/);
  assert.match(sql, /WHEN 'certified' THEN 'closed'/);
  assert.match(sql, /OLD\.status = 'bulletin_generated' AND NEW\.status = 'certified'/);
  assert.match(sql, /CREATE TABLE public\.measurement_cycle_events/);
  assert.match(sql, /actor_id UUID NOT NULL REFERENCES public\.profiles/);
  assert.match(sql, /occurred_at TIMESTAMPTZ NOT NULL/);
  assert.match(sql, /evidence JSONB NOT NULL/);
});

test("formal bulletin lines have immutable relational sources and internal item identity", () => {
  assert.match(sql, /CREATE TABLE public\.measurement_bulletin_line_sources/);
  assert.match(sql, /measurement_workspace_line_id UUID NOT NULL REFERENCES public\.measurement_workspace_lines/);
  assert.match(sql, /formal_line->>'serviceItemId' = mwl\.managed_service_item_id::TEXT/);
  assert.match(sql, /measurement_bulletin_line_sources_line_once[\s\S]*UNIQUE \(measurement_bulletin_id, bulletin_line_id\)/);
  assert.match(sql, /measurement_bulletin_line_sources_source_once[\s\S]*UNIQUE \(measurement_bulletin_id, measurement_workspace_line_id\)/);
  assert.match(sql, /Formal measurement traceability and certification history are append-only/);
});

test("official accumulated projections include only certified domain states", () => {
  assert.match(sql, /WHERE mc\.status IN \('certified', 'closed'\)/);
  assert.match(sql, /JOIN public\.measurement_certifications certification/);
  const officialProjection = sql.slice(sql.indexOf("CREATE VIEW public.measurement_certified_item_period_totals"));
  assert.doesNotMatch(officialProjection, /WHERE mc\.status IN \([^)]*'draft'/);
  assert.doesNotMatch(officialProjection, /WHERE mc\.status IN \([^)]*'measured'/);
  assert.doesNotMatch(officialProjection, /WHERE mc\.status IN \([^)]*'bulletin_generated'/);
});

test("uses exact numeric storage and records generic decimal policy provenance", () => {
  assert.match(sql, /source_quantity_raw TEXT/);
  assert.match(sql, /canonical_quantity_scale SMALLINT/);
  assert.match(sql, /monetary_policy_key TEXT/);
  assert.match(sql, /sum\(mwl\.quantity\)::NUMERIC/);
  assert.match(sql, /sum\(mwl\.total_value\)::NUMERIC/);
  assert.doesNotMatch(sql, /\b(REAL|DOUBLE PRECISION|FLOAT)\b/i);
});

test("contains no case-specific project, bulletin, quantity or service rule", () => {
  for (const forbidden of ["Lagoa do Arroz", "BM_08", "DNOCS", "COT-015"]) {
    assert.equal(sql.includes(forbidden), false, `migration contains forbidden case-specific term: ${forbidden}`);
  }
  assert.doesNotMatch(sql, /exactly\s+(15|300)/i);
});

test("new tables are read-only to clients and writes use restricted atomic routines", () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.measurement_cycles FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /GRANT SELECT ON TABLE public\.measurement_cycles TO authenticated, service_role/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.advance_measurement_cycle[\s\S]*TO service_role/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.advance_measurement_cycle[\s\S]*FROM PUBLIC, anon, authenticated/);
});
