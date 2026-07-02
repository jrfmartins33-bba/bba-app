import type {
  AlphaEngenhariaBusinessEvent,
  AlphaEngenhariaCompany,
  AlphaEngenhariaContract,
  AlphaEngenhariaDigitalTwin,
  AlphaEngenhariaMeasurement,
  AlphaEngenhariaOrganization,
  AlphaEngenhariaProject,
} from "./alpha-engenharia.types";

export interface CreateAlphaEngenhariaDigitalTwinInput {
  readonly company: AlphaEngenhariaCompany;
  readonly organization: AlphaEngenhariaOrganization;
  readonly projects: ReadonlyArray<AlphaEngenhariaProject>;
  readonly contracts: ReadonlyArray<AlphaEngenhariaContract>;
  readonly measurements: ReadonlyArray<AlphaEngenhariaMeasurement>;
  readonly businessEvents: ReadonlyArray<AlphaEngenhariaBusinessEvent>;
}

export function createAlphaEngenhariaDigitalTwin(
  input: CreateAlphaEngenhariaDigitalTwinInput,
): AlphaEngenhariaDigitalTwin {
  return {
    company: {
      ...input.company,
      metadata: {
        ...input.company.metadata,
      },
    },
    organization: {
      ...input.organization,
      operatingUnits: input.organization.operatingUnits.map((unit) => ({
        ...unit,
        metadata: {
          ...unit.metadata,
        },
      })),
      metadata: {
        ...input.organization.metadata,
      },
    },
    projects: input.projects.map((project) => ({
      ...project,
      physicalProgress: {
        ...project.physicalProgress,
      },
      metadata: {
        ...project.metadata,
      },
    })),
    contracts: input.contracts.map((contract) => ({
      ...contract,
      paymentTerms: {
        ...contract.paymentTerms,
      },
      metadata: {
        ...contract.metadata,
      },
    })),
    measurements: input.measurements.map((measurement) => ({
      ...measurement,
      metadata: {
        ...measurement.metadata,
      },
    })),
    businessEvents: input.businessEvents.map((event) => ({
      ...event,
      metadata: {
        ...event.metadata,
      },
    })),
  };
}

export const alphaEngenhariaDigitalTwinInput: CreateAlphaEngenhariaDigitalTwinInput = {
  company: {
    id: "alpha-company",
    legalName: "Alpha Engenharia Ltda.",
    tradeName: "Alpha Engenharia",
    industry: "Heavy Civil Construction",
    businessDescription:
      "Engineering company specialized in dam construction, industrial infrastructure, access roads, earthworks, and large civil engineering projects.",
    country: "Brazil",
    currency: "BRL",
    taxRegime: "Lucro Real",
    companySize: "Medium Enterprise",
    employees: 180,
    metadata: {
      digitalTwin: "alpha-engenharia",
      traceId: "alpha-company",
    },
  },
  organization: {
    id: "alpha-organization",
    companyId: "alpha-company",
    name: "Alpha Engenharia Operating Model",
    operatingUnits: [
      {
        id: "alpha-unit-executive-office",
        name: "Executive Office",
        responsibility: "Executive governance and strategic decision ownership.",
        headcount: 5,
        metadata: {
          traceId: "alpha-unit-executive-office",
        },
      },
      {
        id: "alpha-unit-engineering",
        name: "Engineering",
        responsibility:
          "Technical design, constructability analysis, and engineering controls.",
        headcount: 32,
        metadata: {
          traceId: "alpha-unit-engineering",
        },
      },
      {
        id: "alpha-unit-project-controls",
        name: "Project Controls",
        responsibility:
          "Planning, physical progress, measurements, and contract control.",
        headcount: 18,
        metadata: {
          traceId: "alpha-unit-project-controls",
        },
      },
      {
        id: "alpha-unit-field-operations",
        name: "Field Operations",
        responsibility:
          "Construction execution, equipment mobilization, and site productivity.",
        headcount: 92,
        metadata: {
          traceId: "alpha-unit-field-operations",
        },
      },
      {
        id: "alpha-unit-procurement",
        name: "Procurement",
        responsibility:
          "Supplier negotiation, materials availability, and service contracts.",
        headcount: 14,
        metadata: {
          traceId: "alpha-unit-procurement",
        },
      },
      {
        id: "alpha-unit-finance",
        name: "Finance",
        responsibility:
          "Billing, accounts receivable, cash flow, financing, and tax interface.",
        headcount: 19,
        metadata: {
          traceId: "alpha-unit-finance",
        },
      },
    ],
    metadata: {
      traceId: "alpha-organization",
    },
  },
  projects: [
    {
      id: "alpha-project-serra-azul-dam",
      companyId: "alpha-company",
      organizationUnitId: "alpha-unit-field-operations",
      contractId: "alpha-contract-serra-azul-dam",
      name: "Serra Azul Dam Construction",
      projectType: "Dam Construction",
      location: "Minas Gerais, Brazil",
      status: "active",
      plannedStartDate: "2026-01-15",
      plannedEndDate: "2027-06-30",
      physicalProgress: {
        plannedPercentage: 32,
        actualPercentage: 28,
        measuredPercentage: 27.5,
        lastMeasurementId: "alpha-measure-serra-azul-2026-03",
      },
      budget: 14200000,
      metadata: {
        traceId: "alpha-project-serra-azul-dam",
        primaryCapability: "cash-intelligence",
      },
    },
    {
      id: "alpha-project-horizonte-industrial",
      companyId: "alpha-company",
      organizationUnitId: "alpha-unit-engineering",
      contractId: "alpha-contract-horizonte-industrial",
      name: "Horizonte Industrial Infrastructure",
      projectType: "Industrial Infrastructure",
      location: "Goias, Brazil",
      status: "active",
      plannedStartDate: "2026-02-01",
      plannedEndDate: "2026-12-20",
      physicalProgress: {
        plannedPercentage: 18,
        actualPercentage: 16,
        measuredPercentage: 15.2,
        lastMeasurementId: "alpha-measure-horizonte-2026-03",
      },
      budget: 9800000,
      metadata: {
        traceId: "alpha-project-horizonte-industrial",
        primaryCapability: "operations-intelligence",
      },
    },
    {
      id: "alpha-project-vale-norte-access-road",
      companyId: "alpha-company",
      organizationUnitId: "alpha-unit-field-operations",
      contractId: "alpha-contract-vale-norte-access-road",
      name: "Vale Norte Access Road and Earthworks",
      projectType: "Access Road and Earthworks",
      location: "Para, Brazil",
      status: "active",
      plannedStartDate: "2025-11-10",
      plannedEndDate: "2026-08-15",
      physicalProgress: {
        plannedPercentage: 54,
        actualPercentage: 49.5,
        measuredPercentage: 49,
        lastMeasurementId: "alpha-measure-vale-norte-2026-03",
      },
      budget: 6600000,
      metadata: {
        traceId: "alpha-project-vale-norte-access-road",
        primaryCapability: "cash-intelligence",
      },
    },
  ],
  contracts: [
    {
      id: "alpha-contract-serra-azul-dam",
      companyId: "alpha-company",
      projectId: "alpha-project-serra-azul-dam",
      contractNumber: "ALPHA-CTR-2026-001",
      clientName: "Consorcio HidroSerra S.A.",
      signedAt: "2026-01-10",
      contractValue: 18000000,
      currency: "BRL",
      paymentTerms: {
        measurementCycle: "monthly",
        paymentDueDays: 45,
        retentionPercentage: 0.05,
        currency: "BRL",
      },
      status: "active",
      metadata: {
        traceId: "alpha-contract-serra-azul-dam",
      },
    },
    {
      id: "alpha-contract-horizonte-industrial",
      companyId: "alpha-company",
      projectId: "alpha-project-horizonte-industrial",
      contractNumber: "ALPHA-CTR-2026-002",
      clientName: "Horizonte Mineracao Ltda.",
      signedAt: "2026-01-28",
      contractValue: 12400000,
      currency: "BRL",
      paymentTerms: {
        measurementCycle: "monthly",
        paymentDueDays: 30,
        retentionPercentage: 0.03,
        currency: "BRL",
      },
      status: "active",
      metadata: {
        traceId: "alpha-contract-horizonte-industrial",
      },
    },
    {
      id: "alpha-contract-vale-norte-access-road",
      companyId: "alpha-company",
      projectId: "alpha-project-vale-norte-access-road",
      contractNumber: "ALPHA-CTR-2025-014",
      clientName: "Vale Norte Energia S.A.",
      signedAt: "2025-10-20",
      contractValue: 7800000,
      currency: "BRL",
      paymentTerms: {
        measurementCycle: "monthly",
        paymentDueDays: 60,
        retentionPercentage: 0.05,
        currency: "BRL",
      },
      status: "active",
      metadata: {
        traceId: "alpha-contract-vale-norte-access-road",
      },
    },
  ],
  measurements: [
    {
      id: "alpha-measure-serra-azul-2026-01",
      projectId: "alpha-project-serra-azul-dam",
      contractId: "alpha-contract-serra-azul-dam",
      measurementNumber: "SA-2026-001",
      periodStart: "2026-01-15",
      periodEnd: "2026-01-31",
      measuredAt: "2026-02-03",
      physicalProgressPercentage: 9,
      measuredAmount: 1620000,
      invoiceReference: "alpha-invoice-serra-azul-001",
      status: "paid",
      metadata: {
        traceId: "alpha-measure-serra-azul-2026-01",
      },
    },
    {
      id: "alpha-measure-serra-azul-2026-02",
      projectId: "alpha-project-serra-azul-dam",
      contractId: "alpha-contract-serra-azul-dam",
      measurementNumber: "SA-2026-002",
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      measuredAt: "2026-03-04",
      physicalProgressPercentage: 18.5,
      measuredAmount: 1710000,
      invoiceReference: "alpha-invoice-serra-azul-002",
      status: "invoiced",
      metadata: {
        traceId: "alpha-measure-serra-azul-2026-02",
      },
    },
    {
      id: "alpha-measure-serra-azul-2026-03",
      projectId: "alpha-project-serra-azul-dam",
      contractId: "alpha-contract-serra-azul-dam",
      measurementNumber: "SA-2026-003",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      measuredAt: "2026-04-04",
      physicalProgressPercentage: 27.5,
      measuredAmount: 1620000,
      invoiceReference: "alpha-invoice-serra-azul-003",
      status: "submitted",
      metadata: {
        traceId: "alpha-measure-serra-azul-2026-03",
      },
    },
    {
      id: "alpha-measure-horizonte-2026-03",
      projectId: "alpha-project-horizonte-industrial",
      contractId: "alpha-contract-horizonte-industrial",
      measurementNumber: "HI-2026-001",
      periodStart: "2026-02-01",
      periodEnd: "2026-03-31",
      measuredAt: "2026-04-05",
      physicalProgressPercentage: 15.2,
      measuredAmount: 1884800,
      invoiceReference: "alpha-invoice-horizonte-001",
      status: "approved",
      metadata: {
        traceId: "alpha-measure-horizonte-2026-03",
      },
    },
    {
      id: "alpha-measure-vale-norte-2026-03",
      projectId: "alpha-project-vale-norte-access-road",
      contractId: "alpha-contract-vale-norte-access-road",
      measurementNumber: "VN-2026-006",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      measuredAt: "2026-04-02",
      physicalProgressPercentage: 49,
      measuredAmount: 1100000,
      invoiceReference: "alpha-invoice-vale-norte-006",
      status: "invoiced",
      metadata: {
        traceId: "alpha-measure-vale-norte-2026-03",
      },
    },
  ],
  businessEvents: [
    {
      id: "alpha-event-001",
      date: "2026-01-10",
      category: "contract",
      title: "Serra Azul dam contract signed",
      description:
        "Alpha Engenharia signed the Serra Azul dam construction contract with monthly measurement billing.",
      sourceObjectType: "contract",
      sourceObjectId: "alpha-contract-serra-azul-dam",
      financialImpact: 18000000,
      operationalImpact: "high",
      metadata: {
        traceId: "alpha-event-001",
      },
    },
    {
      id: "alpha-event-002",
      date: "2026-01-15",
      category: "project",
      title: "Serra Azul project mobilized",
      description:
        "Field teams and equipment were mobilized for the first dam construction front.",
      sourceObjectType: "project",
      sourceObjectId: "alpha-project-serra-azul-dam",
      financialImpact: -950000,
      operationalImpact: "high",
      metadata: {
        traceId: "alpha-event-002",
      },
    },
    {
      id: "alpha-event-003",
      date: "2026-03-04",
      category: "measurement",
      title: "Second Serra Azul measurement invoiced",
      description:
        "The second Serra Azul measurement was invoiced and became part of accounts receivable.",
      sourceObjectType: "measurement",
      sourceObjectId: "alpha-measure-serra-azul-2026-02",
      financialImpact: 1710000,
      operationalImpact: "medium",
      metadata: {
        traceId: "alpha-event-003",
      },
    },
    {
      id: "alpha-event-004",
      date: "2026-03-12",
      category: "financial",
      title: "Client payment delayed",
      description:
        "A major client payment related to measured work moved beyond the expected cash cycle.",
      sourceObjectType: "measurement",
      sourceObjectId: "alpha-measure-serra-azul-2026-02",
      financialImpact: -1710000,
      operationalImpact: "high",
      metadata: {
        traceId: "alpha-event-004",
      },
    },
    {
      id: "alpha-event-005",
      date: "2026-03-18",
      category: "supplier",
      title: "Supplier pressure increased",
      description:
        "Concrete, steel, and equipment suppliers requested shorter payment terms for active projects.",
      sourceObjectType: "organization",
      sourceObjectId: "alpha-unit-procurement",
      financialImpact: -600000,
      operationalImpact: "medium",
      metadata: {
        traceId: "alpha-event-005",
      },
    },
    {
      id: "alpha-event-006",
      date: "2026-03-25",
      category: "progress",
      title: "Serra Azul progress behind plan",
      description:
        "Serra Azul actual progress reached 28 percent against a planned 32 percent.",
      sourceObjectType: "project",
      sourceObjectId: "alpha-project-serra-azul-dam",
      financialImpact: -420000,
      operationalImpact: "high",
      metadata: {
        traceId: "alpha-event-006",
      },
    },
    {
      id: "alpha-event-007",
      date: "2026-04-02",
      category: "measurement",
      title: "Vale Norte measurement invoiced",
      description:
        "The Vale Norte access road measurement was invoiced with a 60-day payment term.",
      sourceObjectType: "measurement",
      sourceObjectId: "alpha-measure-vale-norte-2026-03",
      financialImpact: 1100000,
      operationalImpact: "medium",
      metadata: {
        traceId: "alpha-event-007",
      },
    },
    {
      id: "alpha-event-008",
      date: "2026-04-08",
      category: "financial",
      title: "Working capital financing approved",
      description:
        "A working capital facility was approved to reduce pressure from delayed receivables and supplier payment demands.",
      sourceObjectType: "company",
      sourceObjectId: "alpha-company",
      financialImpact: 2500000,
      operationalImpact: "medium",
      metadata: {
        traceId: "alpha-event-008",
      },
    },
  ],
};

export const alphaEngenhariaDigitalTwin =
  createAlphaEngenhariaDigitalTwin(alphaEngenhariaDigitalTwinInput);
