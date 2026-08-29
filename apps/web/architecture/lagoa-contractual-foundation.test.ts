import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createConsortium,
  consolidateConsortiumComposition,
  getConsortiumLeader,
  formatSharePercentagePtBr,
  ConsortiumCompositionStatus,
} from "@bba/bdos-core/domain/consortium";
import {
  createProjectCostCenter,
  getCostCenterPolicy,
  CostCenterStatus,
} from "@bba/bdos-core/domain/cost-center";
import {
  createContractBaseline,
  reconcileContractBaselineMath,
  formatContractedValuePtBr,
  formatRoundingAdjustmentPtBr,
  formatDerivedItemsTotalPtBr,
  ContractBaselineStatus,
} from "@bba/bdos-core/domain/contract-baseline";

const root = resolve(__dirname, "..", "..", "..");

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`ok - ${name}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertThrows(fn: () => void, expectedSnippet: string): void {
  try {
    fn();
    throw new Error(`Expected function to throw with snippet "${expectedSnippet}", but it did not throw.`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes(expectedSnippet)) {
      return;
    }
    throw error;
  }
}

// 1. equação Lagoa fecha exatamente
runTest("1. equação Lagoa fecha exatamente", () => {
  const math = reconcileContractBaselineMath(761185165, "7611852.11454550", "-0.46454550");
  assert(math.matches === true, "reconciliação matemática exata fecha sem resíduo");
  assert(math.expectedContracted === "7611851.65000000", "esperado 7611851.65");
  assert(math.calculatedTotal === "7611851.65000000", "calculado 7611851.65");

  const baseline = createContractBaseline({
    id: "b-lagoa",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "proj-lagoa",
    contractNumber: "Contrato nº 22/2025",
    contractorNameSnapshot: "CONSÓRCIO CONJASF-HIDROMEC",
    status: ContractBaselineStatus.InExecution,
    contractedValueCents: 761185165,
    derivedItemsTotalDecimal: "7611852.11454550",
    contractualRoundingAdjustmentDecimal: "-0.46454550",
    historicalOfficialBudgetCents: 980908718,
  });
  assert(baseline.contractedValueCents === 761185165, "761185165 centavos");
  assert(formatContractedValuePtBr(baseline).includes("7.611.851,65"), "display R$ 7.611.851,65");
  assert(formatRoundingAdjustmentPtBr(baseline).includes("0,46") && formatRoundingAdjustmentPtBr(baseline).startsWith("-"), "display - R$ 0,46");
  assert(formatDerivedItemsTotalPtBr(baseline).includes("7.611.852,11"), "display R$ 7.611.852,11");
});

// 2. contrato acima de R$ 100 milhões é representável
runTest("2. contrato acima de R$ 100 milhões é representável com NUMERIC(20,8)", () => {
  const math = reconcileContractBaselineMath(25000000000, "250000000.75321890", "-0.75321890");
  assert(math.matches === true, "contrato de R$ 250 milhões reconcilia exatamente");

  const largeBaseline = createContractBaseline({
    id: "b-megaprojeto",
    organizationId: "org-infra",
    engineeringProjectId: "proj-megaprojeto",
    contractNumber: "Contrato nº 99/2026",
    contractorNameSnapshot: "CONSÓRCIO MEGAPROJETO BRASIL",
    contractedValueCents: 25000000000,
    derivedItemsTotalDecimal: "250000000.75321890",
    contractualRoundingAdjustmentDecimal: "-0.75321890",
  });
  assert(largeBaseline.contractedValueCents === 25000000000, "autoridade em centavos");
  assert(formatContractedValuePtBr(largeBaseline).includes("250.000.000,00"), "formatado R$ 250 milhões");
});

// 3. company_id incompatível entre member/consortium é rejeitado (Migration check & DDL verification)
runTest("3. company_id incompatível entre member/consortium é protegido no banco", () => {
  const sql = readFileSync(resolve(root, "supabase/migrations/20260820000000_bdos_contract_baseline_and_consortium.sql"), "utf8");
  assert(sql.includes("enforce_consortium_member_company_consistency"), "gatilho de consistência multiempresa para consortium_members");
  assert(sql.includes("consortium_members.company_id must match the company_id of its consortium_id"), "mensagem de erro explícita");
});

// 4. company_id incompatível entre project/cost center é rejeitado
runTest("4. company_id incompatível entre project/cost center é protegido no banco", () => {
  const sql = readFileSync(resolve(root, "supabase/migrations/20260820000000_bdos_contract_baseline_and_consortium.sql"), "utf8");
  assert(sql.includes("enforce_project_cost_center_company_consistency"), "gatilho de consistência multiempresa para project_cost_centers");
  assert(sql.includes("project_cost_centers.company_id must match the company_id of its engineering_project_id"), "mensagem de erro explícita");
  assert(sql.includes("project_cost_centers.company_id must match the company_id of its consortium_member_id"), "validação cruzada de membro");
});

// 5. company_id incompatível entre baseline/project é rejeitado
runTest("5. company_id incompatível entre baseline/project é protegido no banco", () => {
  const sql = readFileSync(resolve(root, "supabase/migrations/20260820000000_bdos_contract_baseline_and_consortium.sql"), "utf8");
  assert(sql.includes("enforce_contract_baseline_company_consistency"), "gatilho de consistência multiempresa para contract_baselines");
  assert(sql.includes("contract_baselines.company_id must match the company_id of its engineering_project_id"), "validação de projeto");
  assert(sql.includes("contract_baselines.company_id must match the company_id of its consortium_id"), "validação de consórcio");
  assert(sql.includes("contract_baselines.company_id must match the company_id of its source_budget_version_id"), "validação de budget_version");
});

// 6. Consolidated com 10000 bps passa
runTest("6. Consolidated com 10000 bps passa", () => {
  const c2 = createConsortium({
    id: "consortium-50-50",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    legalName: "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB",
    compositionStatus: ConsortiumCompositionStatus.Consolidated,
    members: [
      { id: "m1", partyNameSnapshot: "CONJASF", shareBasisPoints: 5000, isLeader: true },
      { id: "m2", partyNameSnapshot: "HIDROMEC", shareBasisPoints: 5000, isLeader: false },
    ],
  });
  assert(c2.compositionStatus === ConsortiumCompositionStatus.Consolidated, "consolidado com 100%");
});

// 7. Consolidated com 9000 bps falha
runTest("7. Consolidated com 9000 bps falha", () => {
  assertThrows(
    () =>
      createConsortium({
        id: "consortium-90",
        organizationId: "org-1",
        legalName: "CONSÓRCIO 90%",
        compositionStatus: ConsortiumCompositionStatus.Consolidated,
        members: [
          { id: "m1", partyNameSnapshot: "Empresa A", shareBasisPoints: 5000 },
          { id: "m2", partyNameSnapshot: "Empresa B", shareBasisPoints: 4000 },
        ],
      }),
    "Consolidated consortium composition must total exactly 100%",
  );

  const sql = readFileSync(resolve(root, "supabase/migrations/20260820000000_bdos_contract_baseline_and_consortium.sql"), "utf8");
  assert(sql.includes("enforce_consortium_composition_total"), "gatilho persistente de composição 100%");
  assert(sql.includes("must have member shares totaling exactly 10000 basis points"), "validação SQL");
});

// 8. dois líderes no mesmo consórcio falham
runTest("8. dois líderes no mesmo consórcio falham", () => {
  assertThrows(
    () =>
      createConsortium({
        id: "consortium-multi-lead",
        organizationId: "org-1",
        legalName: "CONSÓRCIO DOIS LÍDERES",
        members: [
          { id: "m1", partyNameSnapshot: "Empresa A", shareBasisPoints: 5000, isLeader: true },
          { id: "m2", partyNameSnapshot: "Empresa B", shareBasisPoints: 5000, isLeader: true },
        ],
      }),
    "Consortium can have at most one leader",
  );

  const sql = readFileSync(resolve(root, "supabase/migrations/20260820000000_bdos_contract_baseline_and_consortium.sql"), "utf8");
  assert(sql.includes("consortium_members_single_leader_idx"), "índice único parcial SQL de líder único");
});

// 9. mesmo party_identifier duplicado no mesmo consórcio falha
runTest("9. mesmo party_identifier duplicado no mesmo consórcio falha", () => {
  assertThrows(
    () =>
      createConsortium({
        id: "consortium-dup-cnpj",
        organizationId: "org-1",
        legalName: "CONSÓRCIO CNPJ DUPLICADO",
        members: [
          { id: "m1", partyNameSnapshot: "Empresa A Matriz", partyIdentifier: "12.345.678/0001-90", shareBasisPoints: 5000 },
          { id: "m2", partyNameSnapshot: "Empresa A Filial", partyIdentifier: "12.345.678/0001-90", shareBasisPoints: 5000 },
        ],
      }),
    "is duplicated in this consortium",
  );

  const sql = readFileSync(resolve(root, "supabase/migrations/20260820000000_bdos_contract_baseline_and_consortium.sql"), "utf8");
  assert(sql.includes("consortium_members_party_identifier_idx"), "índice único parcial SQL para party_identifier");
});

// 10. mesmo party_identifier em consórcios diferentes é permitido
runTest("10. mesmo party_identifier em consórcios diferentes é permitido", () => {
  const c1 = createConsortium({
    id: "consortium-1",
    organizationId: "org-1",
    legalName: "CONSÓRCIO 1",
    members: [{ id: "m1", partyNameSnapshot: "Empresa A", partyIdentifier: "12.345.678/0001-90", shareBasisPoints: 10000 }],
  });
  const c2 = createConsortium({
    id: "consortium-2",
    organizationId: "org-1",
    legalName: "CONSÓRCIO 2",
    members: [{ id: "m2", partyNameSnapshot: "Empresa A", partyIdentifier: "12.345.678/0001-90", shareBasisPoints: 10000 }],
  });
  assert(c1.members[0].partyIdentifier === c2.members[0].partyIdentifier, "mesmo CNPJ presente em consórcios distintos");
});

// 11. participação não gera rateio automático
runTest("11. participação não gera rateio automático", () => {
  const direct = getCostCenterPolicy("DirectAttribution");
  assert(direct.allocationRule === "DirectAttribution", "permite atribuição direta ao executor sem rateio");
  const custom = getCostCenterPolicy("CustomSplit");
  assert(custom.allocationRule === "CustomSplit", "permite rateio customizado específico");
});

// 12. source_budget_version_id pode ser NULL
runTest("12. source_budget_version_id pode ser NULL", () => {
  const baseline = createContractBaseline({
    id: "b-lagoa-standalone",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "proj-lagoa",
    contractNumber: "Contrato nº 22/2025",
    contractorNameSnapshot: "CONSÓRCIO CONJASF-HIDROMEC",
    sourceBudgetVersionId: null,
    contractedValueCents: 761185165,
    derivedItemsTotalDecimal: "7611852.11454550",
    contractualRoundingAdjustmentDecimal: "-0.46454550",
  });
  assert(baseline.sourceBudgetVersionId === null, "sourceBudgetVersionId é nulo quando não há proposta associada");

  const sql = readFileSync(resolve(root, "supabase/migrations/20260820000000_bdos_contract_baseline_and_consortium.sql"), "utf8");
  assert(sql.includes("source_budget_version_id UUID REFERENCES budget_versions(id) ON DELETE SET NULL"), "FK opcional em SQL");
});
