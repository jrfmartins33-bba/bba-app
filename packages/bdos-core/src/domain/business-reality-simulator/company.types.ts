export type BusinessRealityCompanyId = string;

export type BusinessRealityScenarioId = string;

export type BusinessRealityEventId = string;

export type BusinessRealityDate = string;

export type BusinessRealityMoney = number;

export type BusinessRealityPercentage = number;

export type BusinessRealityMetadata = Readonly<Record<string, unknown>>;

export type BusinessRealityCountry = string;

export type BusinessRealityCurrency = string;

export type BusinessRealityTaxRegime = string;

export type BusinessRealityCompanySize = string;

export type BusinessRealityIndustry = string;

export type BusinessRealityExpectedFact = string;

export type BusinessEventCategory =
  | "commercial"
  | "financial"
  | "operational"
  | "people"
  | "supplier"
  | "maintenance"
  | "financing"
  | "cost";

export type BusinessOperationalImpact =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface BusinessRealityCompany {
  readonly id: BusinessRealityCompanyId;
  readonly legalName: string;
  readonly tradeName: string;
  readonly industry: BusinessRealityIndustry;
  readonly businessDescription: string;
  readonly country: BusinessRealityCountry;
  readonly currency: BusinessRealityCurrency;
  readonly taxRegime: BusinessRealityTaxRegime;
  readonly companySize: BusinessRealityCompanySize;
  readonly employees: number;
  readonly metadata: BusinessRealityMetadata;
}

export interface BusinessRealityProfile {
  readonly annualRevenue: BusinessRealityMoney;
  readonly monthlyRevenue: BusinessRealityMoney;
  readonly grossMargin: BusinessRealityPercentage;
  readonly ebitdaMargin: BusinessRealityPercentage;
  readonly cashBalance: BusinessRealityMoney;
  readonly workingCapital: BusinessRealityMoney;
  readonly receivables: BusinessRealityMoney;
  readonly payables: BusinessRealityMoney;
  readonly inventory: BusinessRealityMoney;
  readonly debt: BusinessRealityMoney;
}

export interface BusinessScenario {
  readonly id: BusinessRealityScenarioId;
  readonly name: string;
  readonly description: string;
  readonly primaryChallenge: string;
  readonly secondaryChallenges: ReadonlyArray<string>;
  readonly expectedBusinessFacts: ReadonlyArray<BusinessRealityExpectedFact>;
}

export interface BusinessEvent {
  readonly id: BusinessRealityEventId;
  readonly date: BusinessRealityDate;
  readonly category: BusinessEventCategory;
  readonly title: string;
  readonly description: string;
  readonly financialImpact: BusinessRealityMoney;
  readonly operationalImpact: BusinessOperationalImpact;
  readonly metadata: BusinessRealityMetadata;
}

export interface BusinessRealityCompanySimulation {
  readonly company: BusinessRealityCompany;
  readonly profile: BusinessRealityProfile;
  readonly scenario: BusinessScenario;
  readonly events: ReadonlyArray<BusinessEvent>;
}
