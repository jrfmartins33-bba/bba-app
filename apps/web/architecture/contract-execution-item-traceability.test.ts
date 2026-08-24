import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260824203457_contract_execution_item_traceability.sql"),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(
    resolve(root, "supabase/manifests/lagoa-do-arroz-contract-execution-item-links.v1.json"),
    "utf8",
  ),
) as {
  writeStatus: string;
  integrity: Record<string, number | string>;
  economics: Record<string, number | string | boolean>;
  links: Array<{
    proposalLine: { id: string; documentCode: string; parentLineId: string | null };
    operationalItem: { id: string };
    matchMethod: string;
    evidence: { documentaryPositionShiftPreserved: boolean; cot015ParentlessPreserved: boolean };
  }>;
};

const proposalIds = new Set(manifest.links.map((link) => link.proposalLine.id));
const operationalIds = new Set(manifest.links.map((link) => link.operationalItem.id));
const structural = manifest.links.filter((link) => link.matchMethod === "StructuralCodeAndExactMaterialFields");
const remainder = manifest.links.filter((link) => link.matchMethod === "UniqueExactDocumentaryRemainder");
const shifted = manifest.links.filter((link) => link.evidence.documentaryPositionShiftPreserved);
const cot015 = manifest.links.filter((link) => link.proposalLine.documentCode === "COT-015");

assert("manifest remains unapplied", manifest.writeStatus === "NOT_APPLIED");
assert("manifest contains exactly 300 links", manifest.links.length === 300);
assert("proposal side contains 300 distinct internal IDs", proposalIds.size === 300);
assert("operational side contains 300 distinct internal IDs", operationalIds.size === 300);
assert("match methods preserve the validated 285/15 split", structural.length === 285 && remainder.length === 15);
assert("integrity evidence is the approved validation-set ID", manifest.integrity.validationSetIntegrityId === "7e362455f55af07f8378009c1dce1d5f");
assert("14 documentary position shifts are explicit", shifted.length === 14);
assert("COT-015 occurs once and remains parentless", cot015.length === 1 && cot015[0].proposalLine.parentLineId === null && cot015[0].evidence.cot015ParentlessPreserved);
assert("economics are evidence-only", manifest.economics.mutationPlanned === false);
assert("table uniqueness rejects proposal and operational reuse", migration.includes("contract_execution_item_links_proposal_once") && migration.includes("contract_execution_item_links_operational_once"));
assert("cross-organization and cross-project links are rejected", migration.includes("cb.company_id = NEW.company_id") && migration.includes("msi.engineering_project_id = NEW.engineering_project_id"));
assert("only the contracted consolidated proposal is accepted", migration.includes("cb.source_budget_version_id = NEW.proposal_budget_version_id") && migration.includes("bv.status = 'Consolidated'"));
assert("traceability rows are append-only", migration.includes("block_contract_execution_item_link_update_or_delete"));
assert("browser roles cannot write or execute persistence", migration.includes("REVOKE INSERT, UPDATE, DELETE") && migration.includes("persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB) FROM authenticated"));
assert("future write is service-role-only and atomic", migration.includes("TO service_role") && migration.includes("v_inserted_count <> 300"));
assert("pre-write guards cover integrity, snapshots and economics", migration.includes("v_current_integrity_id = v_expected_integrity_id") && migration.includes("v_snapshots_ok") && migration.includes("v_economics_ok"));
assert("future write cannot mutate execution or measurements", !migration.includes("UPDATE public.managed_service_items") && !migration.includes("measurement_items") && !migration.includes("measurement_entries"));

function assert(name: string, condition: boolean): void {
  if (!condition) throw new Error(name);
  console.log("ok - " + name);
}
