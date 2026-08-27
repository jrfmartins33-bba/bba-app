import {
  handleGetManagerialControl,
  type ManagerialControlReader
} from "./managerial-control-route-handler";
import type { AuthenticatedActor } from "@/lib/supabase/server";
import type { BuildManagerialControlViewInput } from "@/lib/bdos/measurement-managerial-control-service";
import type { MeasurementPhysicalFinancialAnalysis } from "@/lib/bdos/measurement-physical-financial-analysis-service";

// "Controle Gerencial da Execução" — escopo admin.
//
// Regressão do bug em que `handleGetManagerialControl` repassava
// `input.auth.companyId` (null para bba_admin) a
// `loadManagerialControlInput`. Isso fazia o carregamento da Base
// Contratual AUTORITATIVA (contract_baselines, escopada por
// company_id) curto-circuitar para `Promise.resolve(null)`, e o admin
// perdia o "Valor do contrato" oficial, caindo no fallback da soma
// canônica dos itens.
//
// Correção: depois que `findWorkspaceContext` localiza e o RLS
// autoriza o workspace, as leituras internas usam `context.companyId`
// (a empresa REAL da obra). A descoberta continua usando
// `auth.companyId` verbatim — nada amplia autorização.

const WORKSPACE = {
  workspaceId: "ws-1",
  companyId: "company-real",
  engineeringProjectId: "proj-1"
} as const;

// Reconciliação autoritativa (alta precisão) — só disponível quando a
// leitura interna recebe a empresa REAL da obra.
const AUTHORITATIVE_RECONCILIATION = {
  officialContractValueDecimal: "7611851.65",
  itemsTechnicalTotalDecimal: "7611852.11454550",
  roundingAdjustmentDecimal: "-0.46454550"
} as const;

const physicalFinancial: MeasurementPhysicalFinancialAnalysis = {
  obraAvailable: false,
  obraUnavailableReason: "sem dataset no teste",
  groupsAvailable: false,
  groupsUnavailableReason: "sem dataset no teste",
  sourceFileName: null,
  sourceSheetName: null,
  datasetId: null,
  period: null,
  obra: null,
  groups: [],
  adjustments: [],
  management: null,
  itemGroupByCode: new Map()
};

/**
 * Fake que grava exatamente qual `companyId` chegou a cada método e
 * reproduz o curto-circuito real da Base Contratual: a reconciliação
 * autoritativa só é devolvida quando a leitura interna recebe a
 * empresa real da obra (nunca com `null`).
 */
function makeReader() {
  const calls: {
    findWorkspaceContextCompanyId?: string | null;
    loadInputCompanyId?: string | null;
  } = {};

  const reader: ManagerialControlReader = {
    async findWorkspaceContext(query) {
      calls.findWorkspaceContextCompanyId = query.companyId;
      // O RLS já autoriza admin (companyId null) a enxergar qualquer
      // empresa; um cliente comum só encontra o próprio workspace.
      if (query.companyId !== null && query.companyId !== WORKSPACE.companyId) {
        return null;
      }
      return { ...WORKSPACE };
    },
    async loadManagerialControlInput(query) {
      calls.loadInputCompanyId = query.companyId;
      const contractReconciliation =
        query.companyId === WORKSPACE.companyId ? { ...AUTHORITATIVE_RECONCILIATION } : null;
      const viewInput: BuildManagerialControlViewInput = {
        contractItems: [
          {
            id: "it-1",
            code: "01.01.01",
            description: "Serviço 1",
            unit: "M2",
            contractQuantityDecimal: "100",
            unitPriceDecimal: "10.00",
            measurementType: "quantity"
          }
        ],
        certifiedBalances: [
          {
            managedServiceItemId: "it-1",
            contractedValueDecimal: "1000.00",
            certifiedAccumulatedQuantityDecimal: "0",
            certifiedAccumulatedValueDecimal: "0"
          }
        ],
        currentBulletin: null,
        physicalFinancial,
        certificationRegistered: false,
        currentBulletinCertified: false,
        contractReconciliation
      };
      return viewInput;
    }
  };

  return { reader, calls };
}

const NORMAL_USER: AuthenticatedActor = { userId: "u-1", companyId: "company-real", isAdmin: false };
const BBA_ADMIN: AuthenticatedActor = { userId: "u-admin", companyId: null, isAdmin: true };

const TESTS: Array<{ name: string; run: () => Promise<void> }> = [];
function runTest(name: string, run: () => Promise<void>): void {
  TESTS.push({ name, run });
}

runTest("usuário normal — descoberta e leitura interna usam a própria empresa; Base Contratual autoritativa carrega", async () => {
  const { reader, calls } = makeReader();
  const outcome = await handleGetManagerialControl(
    { auth: NORMAL_USER, measurementBulletinImportId: "imp-1" },
    { reader }
  );

  assertEqual(calls.findWorkspaceContextCompanyId, "company-real", "descoberta recebe o companyId do usuário");
  assertEqual(calls.loadInputCompanyId, "company-real", "leitura interna opera com a empresa real da obra");
  assertEqual(outcome.status, 200, "200 OK");
  const view = (outcome.body as { data: { summary: { contractOfficialValueDecimal: string | null } } }).data;
  assertEqual(
    view.summary.contractOfficialValueDecimal,
    "7611851.65",
    "valor oficial = Base Contratual, nunca o fallback da soma canônica"
  );
});

runTest("bba_admin (auth.companyId = null) — descoberta continua com null; leitura interna passa a empresa REAL do workspace", async () => {
  const { reader, calls } = makeReader();
  const outcome = await handleGetManagerialControl(
    { auth: BBA_ADMIN, measurementBulletinImportId: "imp-1" },
    { reader }
  );

  // Descoberta inalterada: o RLS/admin ainda decide o que é visível.
  assertEqual(calls.findWorkspaceContextCompanyId, null, "descoberta do admin continua sujeita ao RLS (companyId null)");
  // Depois de resolvido o workspace, o escopo econômico é o da obra.
  assertEqual(calls.loadInputCompanyId, WORKSPACE.companyId, "leitura interna recebe o companyId REAL do workspace, não null");
  assertEqual(outcome.status, 200, "200 OK");
});

runTest("admin recebe a MESMA reconciliação contratual autoritativa que o usuário da empresa", async () => {
  const userOutcome = await handleGetManagerialControl(
    { auth: NORMAL_USER, measurementBulletinImportId: "imp-1" },
    { reader: makeReader().reader }
  );
  const adminOutcome = await handleGetManagerialControl(
    { auth: BBA_ADMIN, measurementBulletinImportId: "imp-1" },
    { reader: makeReader().reader }
  );

  const userSummary = (userOutcome.body as { data: { summary: Record<string, unknown> } }).data.summary;
  const adminSummary = (adminOutcome.body as { data: { summary: Record<string, unknown> } }).data.summary;

  for (const key of [
    "contractOfficialValueDecimal",
    "itemsTechnicalTotalDecimal",
    "contractRoundingAdjustmentDecimal",
    "contractBalanceTotalDecimal"
  ]) {
    assertEqual(adminSummary[key], userSummary[key], `admin e usuário coincidem em ${key}`);
  }
  assertTrue(adminSummary.contractOfficialValueDecimal !== null, "admin nunca cai no fallback da soma canônica");
});

runTest("isolamento preservado — cliente de outra empresa não encontra o workspace (404), sem escalar escopo", async () => {
  const { reader, calls } = makeReader();
  const outcome = await handleGetManagerialControl(
    { auth: { userId: "u-2", companyId: "company-outra", isAdmin: false }, measurementBulletinImportId: "imp-1" },
    { reader }
  );

  assertEqual(calls.findWorkspaceContextCompanyId, "company-outra", "descoberta recebe a empresa do cliente");
  assertEqual(calls.loadInputCompanyId, undefined, "leitura interna nem chega a rodar sem workspace autorizado");
  assertEqual(outcome.status, 404, "workspace não encontrado para empresa alheia");
});

runTest("sem workspace autorizado — 404 antes de qualquer leitura interna", async () => {
  const reader: ManagerialControlReader = {
    async findWorkspaceContext() {
      return null;
    },
    async loadManagerialControlInput() {
      throw new Error("não deve ser chamado sem contexto");
    }
  };
  const outcome = await handleGetManagerialControl(
    { auth: BBA_ADMIN, measurementBulletinImportId: "imp-x" },
    { reader }
  );
  assertEqual(outcome.status, 404, "404 sem contexto");
});

runTest("nenhuma escrita — handler é somente leitura (auth ausente = 401, sem tocar no reader)", async () => {
  let touched = false;
  const reader: ManagerialControlReader = {
    async findWorkspaceContext() {
      touched = true;
      return { ...WORKSPACE };
    },
    async loadManagerialControlInput() {
      touched = true;
      return {} as BuildManagerialControlViewInput;
    }
  };
  const outcome = await handleGetManagerialControl(
    { auth: null, measurementBulletinImportId: "imp-1" },
    { reader }
  );
  assertEqual(outcome.status, 401, "401 sem autenticação");
  assertEqual(touched, false, "reader intocado — nada é lido nem escrito");
});

async function main(): Promise<void> {
  for (const test of TESTS) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
