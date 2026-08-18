import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const migration = readFileSync(resolve(root, "supabase/migrations/20260818134055_add_proposal_scenarios.sql"), "utf8");
const route = readFileSync(resolve(root, "apps/web/app/api/orcamentos/cenarios/route.ts"), "utf8");

assert("proposal_scenarios enables RLS", migration.includes("ALTER TABLE public.proposal_scenarios ENABLE ROW LEVEL SECURITY"));
assert("authenticated receives SELECT only", migration.includes("GRANT SELECT ON TABLE public.proposal_scenarios TO authenticated"));
assert("direct writes are revoked", migration.includes("REVOKE ALL ON TABLE public.proposal_scenarios FROM PUBLIC, anon, authenticated"));
assert("create RPC is unavailable to browser roles", migration.includes("FROM authenticated") && migration.includes("TO service_role"));
assert("create RPC validates actor against organization", migration.includes("get_company_id_for_actor(p_actor_id)") && migration.includes("is_bba_admin_actor(p_actor_id)"));
assert("API derives company from authenticated context", route.includes("requireAuthenticatedCompany") && !route.includes("body.companyId"));
assert("API writes through server-only client", route.includes("getSupabaseServiceRoleClient"));

function assert(name: string, condition: boolean): void {
  if (!condition) throw new Error(name);
  console.log(`ok - ${name}`);
}
