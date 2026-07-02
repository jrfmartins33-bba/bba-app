import type {
  BusinessEvent,
  BusinessRealityCompany,
  BusinessRealityCompanySimulation,
  BusinessRealityProfile,
  BusinessScenario,
} from "./company.types";

export interface CreateBusinessRealityCompanyInput {
  readonly company: BusinessRealityCompany;
  readonly profile: BusinessRealityProfile;
  readonly scenario: BusinessScenario;
  readonly events: ReadonlyArray<BusinessEvent>;
}

export function createBusinessRealityCompany(
  input: CreateBusinessRealityCompanyInput,
): BusinessRealityCompanySimulation {
  return {
    company: {
      ...input.company,
      metadata: {
        ...input.company.metadata,
      },
    },
    profile: {
      ...input.profile,
    },
    scenario: {
      ...input.scenario,
      secondaryChallenges: [...input.scenario.secondaryChallenges],
      expectedBusinessFacts: [...input.scenario.expectedBusinessFacts],
    },
    events: input.events.map((event) => ({
      ...event,
      metadata: {
        ...event.metadata,
      },
    })),
  };
}

export const alphaEngenhariaBusinessRealityInput: CreateBusinessRealityCompanyInput = {
  company: {
    id: "brs-company-alpha-engenharia",
    legalName: "Alpha Engenharia Ltda.",
    tradeName: "Alpha Engenharia",
    industry: "Engineering and Construction",
    businessDescription:
      "Engineering company specialized in construction of dams, industrial infrastructure and large civil engineering projects.",
    country: "Brazil",
    currency: "BRL",
    taxRegime: "Lucro Real",
    companySize: "Medium Enterprise",
    employees: 180,
    metadata: {
      simulator: "business-reality-simulator",
      traceId: "brs-alpha-engenharia",
    },
  },
  profile: {
    annualRevenue: 48000000,
    monthlyRevenue: 4000000,
    grossMargin: 0.27,
    ebitdaMargin: 0.12,
    cashBalance: 1850000,
    workingCapital: 620000,
    receivables: 7200000,
    payables: 5900000,
    inventory: 2400000,
    debt: 11000000,
  },
  scenario: {
    id: "brs-scenario-alpha-projected-cash-deficit",
    name: "Projected Cash Deficit",
    description:
      "Alpha Engenharia faces a projected cash deficit driven by delayed customer payments, large capital expenditure, supplier pressure, and reduced working capital.",
    primaryChallenge: "Projected Cash Deficit",
    secondaryChallenges: [
      "Delayed customer payments",
      "Large CAPEX",
      "Supplier pressure",
      "Working capital reduction",
    ],
    expectedBusinessFacts: [
      "current_cash_balance",
      "upcoming_receivables",
      "upcoming_payables",
      "average_daily_cash_burn",
      "minimum_cash_reserve",
      "working_capital",
      "debt_position",
    ],
  },
  events: [
    {
      id: "brs-alpha-event-001",
      date: "2026-01-10",
      category: "commercial",
      title: "Large contract signed",
      description:
        "Alpha Engenharia signed a large infrastructure contract for an industrial civil engineering project.",
      financialImpact: 18000000,
      operationalImpact: "high",
      metadata: {
        companyId: "brs-company-alpha-engenharia",
        scenarioId: "brs-scenario-alpha-projected-cash-deficit",
        traceId: "brs-alpha-event-001",
      },
    },
    {
      id: "brs-alpha-event-002",
      date: "2026-01-22",
      category: "financial",
      title: "Client delayed payment",
      description:
        "A major customer postponed a milestone payment originally expected in the current cash cycle.",
      financialImpact: -2500000,
      operationalImpact: "high",
      metadata: {
        companyId: "brs-company-alpha-engenharia",
        scenarioId: "brs-scenario-alpha-projected-cash-deficit",
        traceId: "brs-alpha-event-002",
      },
    },
    {
      id: "brs-alpha-event-003",
      date: "2026-02-03",
      category: "operational",
      title: "Equipment acquisition",
      description:
        "The company acquired heavy equipment required for dam and industrial infrastructure projects.",
      financialImpact: -3200000,
      operationalImpact: "high",
      metadata: {
        companyId: "brs-company-alpha-engenharia",
        scenarioId: "brs-scenario-alpha-projected-cash-deficit",
        traceId: "brs-alpha-event-003",
      },
    },
    {
      id: "brs-alpha-event-004",
      date: "2026-02-12",
      category: "people",
      title: "Payroll increase",
      description:
        "Payroll increased after mobilizing engineering and field teams for new large civil engineering projects.",
      financialImpact: -420000,
      operationalImpact: "medium",
      metadata: {
        companyId: "brs-company-alpha-engenharia",
        scenarioId: "brs-scenario-alpha-projected-cash-deficit",
        traceId: "brs-alpha-event-004",
      },
    },
    {
      id: "brs-alpha-event-005",
      date: "2026-02-18",
      category: "supplier",
      title: "Supplier renegotiation",
      description:
        "Key suppliers requested shorter payment terms while renegotiating materials and equipment service contracts.",
      financialImpact: -600000,
      operationalImpact: "medium",
      metadata: {
        companyId: "brs-company-alpha-engenharia",
        scenarioId: "brs-scenario-alpha-projected-cash-deficit",
        traceId: "brs-alpha-event-005",
      },
    },
    {
      id: "brs-alpha-event-006",
      date: "2026-02-25",
      category: "cost",
      title: "Fuel cost increase",
      description:
        "Fuel and logistics costs increased for construction sites located outside major urban centers.",
      financialImpact: -280000,
      operationalImpact: "medium",
      metadata: {
        companyId: "brs-company-alpha-engenharia",
        scenarioId: "brs-scenario-alpha-projected-cash-deficit",
        traceId: "brs-alpha-event-006",
      },
    },
    {
      id: "brs-alpha-event-007",
      date: "2026-03-04",
      category: "maintenance",
      title: "Unexpected maintenance",
      description:
        "Unexpected maintenance was required on specialized equipment used in dam construction operations.",
      financialImpact: -750000,
      operationalImpact: "high",
      metadata: {
        companyId: "brs-company-alpha-engenharia",
        scenarioId: "brs-scenario-alpha-projected-cash-deficit",
        traceId: "brs-alpha-event-007",
      },
    },
    {
      id: "brs-alpha-event-008",
      date: "2026-03-12",
      category: "financing",
      title: "Bank financing approved",
      description:
        "A working capital credit facility was approved to reduce near-term cash pressure.",
      financialImpact: 2500000,
      operationalImpact: "medium",
      metadata: {
        companyId: "brs-company-alpha-engenharia",
        scenarioId: "brs-scenario-alpha-projected-cash-deficit",
        traceId: "brs-alpha-event-008",
      },
    },
  ],
};

export const alphaEngenhariaBusinessReality =
  createBusinessRealityCompany(alphaEngenhariaBusinessRealityInput);
