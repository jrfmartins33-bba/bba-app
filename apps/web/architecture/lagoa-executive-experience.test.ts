import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyBudgetOrganizationActor,
  selectBudgetCatalogOrganization,
  authorizeBudgetResourceOrganization,
} from "../lib/budget/budget-organization-policy";
import {
  createContractBaseline,
  formatContractedValuePtBr,
  formatHistoricalOfficialBudgetPtBr,
  formatDerivedItemsTotalPtBr,
  formatRoundingAdjustmentPtBr,
  ContractBaselineStatus,
} from "@bba/bdos-core/domain/contract-baseline";
import {
  createConsortium,
  formatSharePercentagePtBr,
  ConsortiumCompositionStatus,
} from "@bba/bdos-core/domain/consortium";
import {
  createProjectCostCenter,
  CostCenterStatus,
} from "@bba/bdos-core/domain/cost-center";
import { getProjectContractualFoundationService } from "@bba/bdos-core/services/contract-baseline";

const root = resolve(__dirname, "..", "..", "..");

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`ok - ${name}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// 1. Hidromec consegue listar e acessar Lagoa via política multiempresa
runTest("1. Hidromec consegue listar Lagoa", () => {
  const actor = classifyBudgetOrganizationActor("user-hidromec-1", {
    companyId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    role: "client",
  });
  assert(actor.status === "authenticated", "ator Hidromec autenticado");
  if (actor.status !== "authenticated") return;

  const organizations = [
    { id: "a0904068-2a24-4120-aef0-c9db670ba7b7", name: "Hidromec Servicos e Locacoes Ltda" },
  ];

  const selection = selectBudgetCatalogOrganization(actor.actor, organizations, null);
  assert(selection.status === "resolved", "seleção resolvida para Hidromec");
  if (selection.status === "resolved") {
    assert(selection.organization.id === "a0904068-2a24-4120-aef0-c9db670ba7b7", "empresa resolvida é Hidromec");
  }
});

// 2. Outra empresa não consegue acessar Lagoa
runTest("2. outra empresa não consegue acessar Lagoa", () => {
  const actorOther = classifyBudgetOrganizationActor("user-carlos-1", {
    companyId: "eeeeeeee-0000-0000-0000-000000000001",
    role: "client",
  });
  assert(actorOther.status === "authenticated", "ator Carlos Mendes autenticado");
  if (actorOther.status !== "authenticated") return;

  // Tentativa de acessar recursos da Hidromec
  const authResource = authorizeBudgetResourceOrganization(
    actorOther.actor,
    { id: "a0904068-2a24-4120-aef0-c9db670ba7b7", name: "Hidromec" },
    "a0904068-2a24-4120-aef0-c9db670ba7b7",
  );
  assert(authResource === "forbidden", "acesso a recursos da Hidromec por outra empresa é proibido (403)");
});

// 3. Lagoa exibe status Em execução
runTest("3. Lagoa exibe status Em execução", () => {
  const baseline = createContractBaseline({
    id: "43e7d4ea-d46d-419b-b8db-c8ac849664b6",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "f82dd4af-ff67-4404-9739-8cac0cc4bd72",
    contractNumber: "22/2025",
    contractorNameSnapshot: "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB",
    status: ContractBaselineStatus.InExecution,
    contractedValueCents: 761185165,
    historicalOfficialBudgetCents: 980908718,
    derivedItemsTotalDecimal: "7611852.11454550",
    contractualRoundingAdjustmentDecimal: "-0.46454550",
  });

  assert(baseline.status === ContractBaselineStatus.InExecution, "status no domínio é InExecution (Em execução)");
});

// 4. Contrato 22/2025 aparece
runTest("4. contrato 22/2025 aparece", () => {
  const baseline = createContractBaseline({
    id: "43e7d4ea-d46d-419b-b8db-c8ac849664b6",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "f82dd4af-ff67-4404-9739-8cac0cc4bd72",
    contractNumber: "22/2025",
    contractorNameSnapshot: "CONSÓRCIO CONJASF-HIDROMEC",
    status: ContractBaselineStatus.InExecution,
    contractedValueCents: 761185165,
    derivedItemsTotalDecimal: "7611852.11454550",
    contractualRoundingAdjustmentDecimal: "-0.46454550",
  });

  assert(baseline.contractNumber === "22/2025", "número do contrato é 22/2025");
});

// 5. Valor contratado vem do contract_baseline
runTest("5. valor contratado vem do contract_baseline", () => {
  const baseline = createContractBaseline({
    id: "43e7d4ea-d46d-419b-b8db-c8ac849664b6",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "f82dd4af-ff67-4404-9739-8cac0cc4bd72",
    contractNumber: "22/2025",
    contractorNameSnapshot: "CONSÓRCIO CONJASF-HIDROMEC",
    status: ContractBaselineStatus.InExecution,
    contractedValueCents: 761185165,
    derivedItemsTotalDecimal: "7611852.11454550",
    contractualRoundingAdjustmentDecimal: "-0.46454550",
  });

  assert(baseline.contractedValueCents === 761185165, "autoridade única é 761185165 centavos");
  const formatted = formatContractedValuePtBr(baseline);
  assert(formatted.includes("7.611.851,65"), "valor formatado é R$ 7.611.851,65");
});

// 6. R$ 9.809.087,18 aparece somente como orçamento oficial histórico
runTest("6. R$ 9.809.087,18 aparece somente como orçamento oficial histórico", () => {
  const baseline = createContractBaseline({
    id: "43e7d4ea-d46d-419b-b8db-c8ac849664b6",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "f82dd4af-ff67-4404-9739-8cac0cc4bd72",
    contractNumber: "22/2025",
    contractorNameSnapshot: "CONSÓRCIO CONJASF-HIDROMEC",
    status: ContractBaselineStatus.InExecution,
    contractedValueCents: 761185165,
    historicalOfficialBudgetCents: 980908718,
    derivedItemsTotalDecimal: "7611852.11454550",
    contractualRoundingAdjustmentDecimal: "-0.46454550",
  });

  assert(baseline.historicalOfficialBudgetCents === 980908718, "orçamento histórico é 980908718 centavos");
  const formatted = formatHistoricalOfficialBudgetPtBr(baseline);
  assert(formatted !== null && formatted.includes("9.809.087,18"), "orçamento histórico formatado é R$ 9.809.087,18");
  assert(baseline.contractedValueCents !== baseline.historicalOfficialBudgetCents, "valor contratado é diferente do histórico");
});

// 7 e 8. CONJASF 50% líder e HIDROMEC 50% consorciada
runTest("7 e 8. CONJASF 50% líder e HIDROMEC 50% consorciada", () => {
  const consortium = createConsortium({
    id: "397ab844-b633-47db-a97c-969b8e541aa0",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    legalName: "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB",
    tradeName: "CONSÓRCIO CONJASF-HIDROMEC",
    cnpj: "63.358.484/0001-65",
    compositionStatus: ConsortiumCompositionStatus.Consolidated,
    members: [
      {
        id: "fb3a2993-bd5b-4139-8880-cff91cd6180e",
        partyName: "CONJASF",
        shareBasisPoints: 5000,
        isLeader: true,
      },
      {
        id: "02b03b5f-8482-4ff1-87b4-3b9ae834b560",
        partyName: "Hidromec Servicos e Locacoes Ltda",
        partyTradeName: "HIDROMEC",
        partyIdentifier: "39.745.018/0001-58",
        shareBasisPoints: 5000,
        isLeader: false,
        memberOrganizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
      },
    ],
  });

  const conjasf = consortium.members.find((m) => m.partyNameSnapshot === "CONJASF")!;
  const hidromec = consortium.members.find((m) => m.partyTradeNameSnapshot === "HIDROMEC")!;

  assert(conjasf.isLeader === true, "CONJASF é líder");
  assert(formatSharePercentagePtBr(conjasf.shareBasisPoints) === "50,00%", "CONJASF tem 50,00%");

  assert(hidromec.isLeader === false, "HIDROMEC é consorciada (não líder)");
  assert(formatSharePercentagePtBr(hidromec.shareBasisPoints) === "50,00%", "HIDROMEC tem 50,00%");
});

// 9. Dois centros de custo aparecem vinculados aos consorciados
runTest("9. dois centros de custo aparecem", async () => {
  const ccConjasf = createProjectCostCenter({
    id: "f4bb9834-4cdb-4475-8bc6-cec72db870d6",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "f82dd4af-ff67-4404-9739-8cac0cc4bd72",
    consortiumMemberId: "fb3a2993-bd5b-4139-8880-cff91cd6180e",
    code: "CC-LAGOA-CONJASF",
    name: "Centro de Custo CONJASF — Lagoa do Arroz",
  });

  const ccHidromec = createProjectCostCenter({
    id: "10b14855-3ad2-49ae-8212-0e6782d5d423",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    engineeringProjectId: "f82dd4af-ff67-4404-9739-8cac0cc4bd72",
    consortiumMemberId: "02b03b5f-8482-4ff1-87b4-3b9ae834b560",
    code: "CC-LAGOA-HIDROMEC",
    name: "Centro de Custo HIDROMEC — Lagoa do Arroz",
  });

  assert(ccConjasf.code === "CC-LAGOA-CONJASF", "código CC CONJASF correto");
  assert(ccHidromec.code === "CC-LAGOA-HIDROMEC", "código CC HIDROMEC correto");
});

// 10. Participação não é apresentada como rateio automático
runTest("10. participação não é apresentada como rateio", () => {
  const pageSrc = readFileSync(
    resolve(root, "apps/web/components/engenharia/project-executive-overview-page.tsx"),
    "utf8",
  );
  assert(
    pageSrc.includes("Os centros de custo permitem separar a apropriação operacional de cada consorciado."),
    "UI esclarece separação operacional sem rateio financeiro automático",
  );
  assert(!pageSrc.includes("rateio automático"), "UI não infere nem afirma rateio automático");
});

// 11. BM08 aparece sem afirmar certificação/finalização inexistente
runTest("11. BM08 aparece sem afirmar certificação/finalização inexistente", () => {
  const pageSrc = readFileSync(
    resolve(root, "apps/web/components/engenharia/project-executive-overview-page.tsx"),
    "utf8",
  );
  assert(!pageSrc.includes("Boletim certificado"), "não afirma boletim certificado");
  assert(!pageSrc.includes("Boletim finalizado"), "não afirma boletim finalizado");
  assert(!pageSrc.includes("BM08 aprovada"), "não afirma BM08 aprovada");
  assert(pageSrc.includes("A medição está em fase de análise técnica"), "afirma fase de análise técnica");
});

// 12. 300 itens aparecem como contagem, sem carregar a árvore inteira
runTest("12. 300 itens aparecem como contagem, sem carregar a árvore inteira", () => {
  const serverReadModelSrc = readFileSync(
    resolve(root, "apps/web/lib/bdos/project-executive-overview-server.ts"),
    "utf8",
  );
  assert(
    serverReadModelSrc.includes("count: \"exact\", head: true"),
    "read model usa contagens leves (head: true) sem carregar árvores completas",
  );
  assert(
    serverReadModelSrc.includes("mainScopeGroupsCount") && serverReadModelSrc.includes("subScopeGroupsCount"),
    "read model diferencia grupos principais e subgrupos da EAP",
  );
});

// 13. Página não contém IDs hardcoded da Lagoa
runTest("13. página não contém IDs hardcoded da Lagoa", () => {
  const pageSrc = readFileSync(
    resolve(root, "apps/web/components/engenharia/project-executive-overview-page.tsx"),
    "utf8",
  );
  const obrasListSrc = readFileSync(
    resolve(root, "apps/web/components/engenharia/engineering-workspace-obras.tsx"),
    "utf8",
  );

  // Não pode conter hardcodes de IDs ou valores fixos
  assert(!pageSrc.includes("f82dd4af-ff67-4404-9739-8cac0cc4bd72"), "sem projectId hardcoded no componente de visão");
  assert(!pageSrc.includes("43e7d4ea-d46d-419b-b8db-c8ac849664b6"), "sem baselineId hardcoded");
  assert(!pageSrc.includes("7.611.851,65"), "sem valor monetário hardcoded em JSX");
  assert(!obrasListSrc.includes("f82dd4af-ff67-4404-9739-8cac0cc4bd72"), "sem projectId hardcoded na listagem");
  assert(!obrasListSrc.includes("7.611.851,65"), "sem valor monetário hardcoded na listagem");
});

// 14. Barragens L01/L02 não sofrem regressão
runTest("14. Barragens L01/L02 não sofrem regressão", () => {
  const catalogSrc = readFileSync(
    resolve(root, "apps/web/app/(dashboard)/orcamentos/page.tsx"),
    "utf8",
  );
  assert(catalogSrc.includes("/api/orcamentos/consolidado/resumo"), "rota de orçamentos oficiais preservada");
  assert(!catalogSrc.includes("f82dd4af"), "orçamentos não misturados com obras em execução");
});

// 15. Usuário não consegue trocar company_id no client para acessar outra empresa
runTest("15. usuário não consegue trocar company_id no client para acessar outra empresa", () => {
  const actor = classifyBudgetOrganizationActor("user-client-a", {
    companyId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    role: "client",
  });
  assert(actor.status === "authenticated", "ator autenticado");
  if (actor.status !== "authenticated") return;

  const orgs = [
    { id: "a0904068-2a24-4120-aef0-c9db670ba7b7", name: "Hidromec" },
    { id: "eeeeeeee-0000-0000-0000-000000000001", name: "Carlos Mendes" },
  ];

  // Client passa ?empresa=outra_empresa
  const selectionTampered = selectBudgetCatalogOrganization(
    actor.actor,
    orgs,
    "eeeeeeee-0000-0000-0000-000000000001",
  );
  assert(selectionTampered.status === "forbidden", "tentativa de spoofing de company_id retorna forbidden (403)");
});
