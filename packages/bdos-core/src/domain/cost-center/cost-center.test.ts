import {
  createProjectCostCenter,
  getCostCenterPolicy,
  CostCenterValidationError,
} from "./cost-center";
import { CostCenterStatus } from "./cost-center.types";

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

// Test 7: Centro de custo pertence a membro + contexto da obra
runTest("centro de custo pertence a membro + contexto da obra", () => {
  const ccConjasf = createProjectCostCenter({
    id: "cc-lagoa-conjasf",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "proj-lagoa-do-arroz",
    consortiumMemberId: "member-conjasf",
    code: "CC-LAGOA-CONJASF",
    name: "Centro de Custo CONJASF — Lagoa do Arroz",
  });

  assert(ccConjasf.engineeringProjectId === "proj-lagoa-do-arroz", "pertence à obra Lagoa do Arroz");
  assert(ccConjasf.consortiumMemberId === "member-conjasf", "associado ao membro CONJASF");
  assert(ccConjasf.status === CostCenterStatus.Active, "deve nascer ativo");
});

// Test 8: Uma empresa pode ter centros de custo distintos em obras distintas
runTest("uma empresa pode ter centros de custo distintos em obras distintas", () => {
  const ccHidromecLagoa = createProjectCostCenter({
    id: "cc-lagoa-hidromec",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "proj-lagoa-do-arroz",
    consortiumMemberId: "member-hidromec",
    code: "CC-LAGOA-HIDROMEC",
    name: "Centro de Custo HIDROMEC — Lagoa do Arroz",
  });

  const ccHidromecAlagoas = createProjectCostCenter({
    id: "cc-alagoas-hidromec",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "proj-barragens-alagoas",
    consortiumMemberId: null, // Sem consórcio em Alagoas
    code: "CC-ALAGOAS-HIDROMEC",
    name: "Centro de Custo HIDROMEC — Barragens de Alagoas",
  });

  assert(ccHidromecLagoa.id !== ccHidromecAlagoas.id, "centros de custo com IDs distintos");
  assert(ccHidromecLagoa.engineeringProjectId !== ccHidromecAlagoas.engineeringProjectId, "projetos distintos");
  assert(ccHidromecLagoa.code === "CC-LAGOA-HIDROMEC", "código contextual Lagoa");
  assert(ccHidromecAlagoas.code === "CC-ALAGOAS-HIDROMEC", "código contextual Alagoas");
});

// Test 9: Participação societária não gera rateio automático
runTest("participação societária não gera rateio automático de custos", () => {
  const directPolicy = getCostCenterPolicy("DirectAttribution");
  assert(directPolicy.allocationRule === "DirectAttribution", "permite atribuição direta integral");
  assert(directPolicy.allowsManualOverride === true, "permite ajuste operacional");

  const customPolicy = getCostCenterPolicy("CustomSplit");
  assert(customPolicy.allocationRule === "CustomSplit", "permite rateio customizado");

  const proRataPolicy = getCostCenterPolicy("ProRataShare");
  assert(proRataPolicy.allocationRule === "ProRataShare", "rateio societário é apenas uma das opções quando acordado");
});
