import {
  createConsortium,
  addMemberToConsortium,
  consolidateConsortiumComposition,
  formatSharePercentagePtBr,
  getConsortiumLeader,
  ConsortiumValidationError,
} from "./consortium";
import { ConsortiumCompositionStatus } from "./consortium.types";

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

// Test 1: Consórcio aceita N membros (cardinalidade N)
runTest("consórcio aceita N membros com cardinalidade arbitrária", () => {
  const consortium2 = createConsortium({
    id: "consortium-001",
    organizationId: "org-hidromec",
    legalName: "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB",
    tradeName: "CONSÓRCIO CONJASF-HIDROMEC",
    members: [
      { id: "m-01", partyNameSnapshot: "CONJASF", shareBasisPoints: 5000, isLeader: true },
      { id: "m-02", partyNameSnapshot: "HIDROMEC", shareBasisPoints: 5000, isLeader: false },
    ],
  });
  assert(consortium2.members.length === 2, "deve ter 2 membros");

  const consortium4 = createConsortium({
    id: "consortium-002",
    organizationId: "org-teste",
    legalName: "CONSÓRCIO QUADRILATERO",
    members: [
      { id: "m-1", partyNameSnapshot: "Empresa A", shareBasisPoints: 4000, isLeader: true },
      { id: "m-2", partyNameSnapshot: "Empresa B", shareBasisPoints: 3000, isLeader: false },
      { id: "m-3", partyNameSnapshot: "Empresa C", shareBasisPoints: 2000, isLeader: false },
      { id: "m-4", partyNameSnapshot: "Empresa D", shareBasisPoints: 1000, isLeader: false },
    ],
  });
  assert(consortium4.members.length === 4, "deve ter 4 membros");
});

// Test 2: Composição consolidada exige soma = 100% (10000 basis points)
runTest("composição consolidada exige soma = 100%", () => {
  assertThrows(
    () =>
      createConsortium({
        id: "consortium-err",
        organizationId: "org-1",
        legalName: "CONSÓRCIO INCOMPLETO",
        compositionStatus: ConsortiumCompositionStatus.Consolidated,
        members: [
          { id: "m-1", partyNameSnapshot: "Empresa A", shareBasisPoints: 5000 },
          { id: "m-2", partyNameSnapshot: "Empresa B", shareBasisPoints: 4000 }, // Total = 90%
        ],
      }),
    "Consolidated consortium composition must total exactly 100%",
  );
});

// Test 3: Dois membros 50/50 passa na consolidação (Caso real Lagoa do Arroz)
runTest("dois membros 50/50 passa na consolidação (caso real Lagoa do Arroz)", () => {
  const lagoaConsortium = createConsortium({
    id: "consortium-lagoa",
    organizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
    legalName: "CONSÓRCIO CONJASF-HIDROMEC LAGOA DO ARROZ/PB",
    tradeName: "CONSÓRCIO CONJASF-HIDROMEC",
    compositionStatus: ConsortiumCompositionStatus.Consolidated,
    members: [
      {
        id: "member-conjasf",
        partyNameSnapshot: "CONJASF - Construtora e Empreendimentos Eireli",
        partyTradeNameSnapshot: "CONJASF",
        partyIdentifier: "00.000.000/0001-00",
        shareBasisPoints: 5000,
        isLeader: true,
      },
      {
        id: "member-hidromec",
        partyNameSnapshot: "Hidromec Serviços e Locações Ltda",
        partyTradeNameSnapshot: "HIDROMEC",
        partyIdentifier: "00.000.000/0001-01",
        shareBasisPoints: 5000,
        isLeader: false,
        memberOrganizationId: "a0904068-2a24-4120-aef0-c9db670ba7b7",
      },
    ],
  });

  assert(lagoaConsortium.compositionStatus === ConsortiumCompositionStatus.Consolidated, "deve estar consolidado");
  assert(lagoaConsortium.members.length === 2, "deve ter 2 membros");
  assert(lagoaConsortium.members[0].shareBasisPoints === 5000, "CONJASF tem 50%");
  assert(lagoaConsortium.members[1].shareBasisPoints === 5000, "HIDROMEC tem 50%");
  assert(formatSharePercentagePtBr(lagoaConsortium.members[0].shareBasisPoints) === "50,00%", "formatação pt-BR 50,00%");
});

// Test 4: Três membros 40/35/25 passa
runTest("três membros 40/35/25 passa na consolidação", () => {
  const consortium3 = createConsortium({
    id: "consortium-triplo",
    organizationId: "org-1",
    legalName: "CONSÓRCIO TRIPLO",
    compositionStatus: ConsortiumCompositionStatus.Consolidated,
    members: [
      { id: "m-1", partyNameSnapshot: "Empresa A", shareBasisPoints: 4000 },
      { id: "m-2", partyNameSnapshot: "Empresa B", shareBasisPoints: 3500 },
      { id: "m-3", partyNameSnapshot: "Empresa C", shareBasisPoints: 2500 },
    ],
  });
  assert(consortium3.members.length === 3, "deve ter 3 membros");
  assert(consortium3.compositionStatus === ConsortiumCompositionStatus.Consolidated, "deve estar consolidado");
});

// Test 5: 50/40 falha quando composição for consolidada
runTest("50/40 falha quando composição for consolidada", () => {
  const draft = createConsortium({
    id: "consortium-draft",
    organizationId: "org-1",
    legalName: "CONSÓRCIO DRAFT",
    compositionStatus: ConsortiumCompositionStatus.Draft,
    members: [
      { id: "m-1", partyNameSnapshot: "Empresa A", shareBasisPoints: 5000 },
      { id: "m-2", partyNameSnapshot: "Empresa B", shareBasisPoints: 4000 },
    ],
  });
  assert(draft.compositionStatus === ConsortiumCompositionStatus.Draft, "draft pode ter 90%");

  assertThrows(() => consolidateConsortiumComposition(draft), "Consolidated consortium composition must total exactly 100%");
});

// Test 6: Liderança não depende do percentual
runTest("liderança é atributo explícito e não depende do percentual", () => {
  const consortium = createConsortium({
    id: "consortium-lead",
    organizationId: "org-1",
    legalName: "CONSÓRCIO ALPHA",
    compositionStatus: ConsortiumCompositionStatus.Consolidated,
    members: [
      { id: "m-1", partyNameSnapshot: "Empresa Menor Participação", shareBasisPoints: 2000, isLeader: true },
      { id: "m-2", partyNameSnapshot: "Empresa Maior Participação", shareBasisPoints: 8000, isLeader: false },
    ],
  });

  const leader = getConsortiumLeader(consortium);
  assert(leader !== null, "deve ter líder");
  assert(leader?.partyNameSnapshot === "Empresa Menor Participação", "o líder é explicitamente a empresa com 20%, não a com 80%");
});

// Test 7: Mais de um líder no mesmo consórcio é rejeitado
runTest("dois líderes no mesmo consórcio falham", () => {
  assertThrows(
    () =>
      createConsortium({
        id: "consortium-multi-lead",
        organizationId: "org-1",
        legalName: "CONSÓRCIO DOIS LIDERES",
        members: [
          { id: "m-1", partyNameSnapshot: "Empresa A", shareBasisPoints: 5000, isLeader: true },
          { id: "m-2", partyNameSnapshot: "Empresa B", shareBasisPoints: 5000, isLeader: true },
        ],
      }),
    "Consortium can have at most one leader",
  );
});

// Test 8: Duplicação de partyIdentifier no mesmo consórcio é rejeitada
runTest("mesmo party_identifier duplicado no mesmo consórcio falha", () => {
  assertThrows(
    () =>
      createConsortium({
        id: "consortium-dup-cnpj",
        organizationId: "org-1",
        legalName: "CONSÓRCIO DUPLICADO",
        members: [
          { id: "m-1", partyNameSnapshot: "Empresa A Matriz", partyIdentifier: "12.345.678/0001-90", shareBasisPoints: 5000 },
          { id: "m-2", partyNameSnapshot: "Empresa A Filial", partyIdentifier: "12.345.678/0001-90", shareBasisPoints: 5000 },
        ],
      }),
    "is duplicated in this consortium",
  );
});

// Test 9: Mesmo partyIdentifier em consórcios diferentes é permitido
runTest("mesmo party_identifier em consórcios diferentes é permitido", () => {
  const c1 = createConsortium({
    id: "consortium-01",
    organizationId: "org-1",
    legalName: "CONSÓRCIO 1",
    members: [{ id: "m-1", partyNameSnapshot: "Empresa A", partyIdentifier: "12.345.678/0001-90", shareBasisPoints: 10000 }],
  });
  const c2 = createConsortium({
    id: "consortium-02",
    organizationId: "org-1",
    legalName: "CONSÓRCIO 2",
    members: [{ id: "m-2", partyNameSnapshot: "Empresa A", partyIdentifier: "12.345.678/0001-90", shareBasisPoints: 10000 }],
  });
  assert(c1.members[0].partyIdentifier === c2.members[0].partyIdentifier, "mesmo CNPJ em consórcios distintos");
});
