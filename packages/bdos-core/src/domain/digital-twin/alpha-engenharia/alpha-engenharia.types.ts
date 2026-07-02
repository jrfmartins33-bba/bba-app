export type AlphaEngenhariaId = string;

export type AlphaEngenhariaDate = string;

export type AlphaEngenhariaMoney = number;

export type AlphaEngenhariaPercentage = number;

export type AlphaEngenhariaMetadata = Readonly<Record<string, unknown>>;

export type AlphaEngenhariaCurrency = "BRL";

export type AlphaEngenhariaProjectStatus =
  | "planned"
  | "mobilizing"
  | "active"
  | "paused"
  | "completed";

export type AlphaEngenhariaContractStatus =
  | "draft"
  | "signed"
  | "active"
  | "completed"
  | "cancelled";

export type AlphaEngenhariaMeasurementStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "invoiced"
  | "paid"
  | "disputed";

export type AlphaEngenhariaBusinessEventCategory =
  | "contract"
  | "project"
  | "progress"
  | "measurement"
  | "financial"
  | "operational"
  | "supplier";

export type AlphaEngenhariaOperationalImpact =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AlphaEngenhariaBusinessEventSourceType =
  | "company"
  | "organization"
  | "project"
  | "contract"
  | "measurement";

export interface AlphaEngenhariaCompany {
  readonly id: AlphaEngenhariaId;
  readonly legalName: string;
  readonly tradeName: string;
  readonly industry: string;
  readonly businessDescription: string;
  readonly country: string;
  readonly currency: AlphaEngenhariaCurrency;
  readonly taxRegime: string;
  readonly companySize: string;
  readonly employees: number;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaEngenhariaOperatingUnit {
  readonly id: AlphaEngenhariaId;
  readonly name: string;
  readonly responsibility: string;
  readonly headcount: number;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaEngenhariaOrganization {
  readonly id: AlphaEngenhariaId;
  readonly companyId: AlphaEngenhariaId;
  readonly name: string;
  readonly operatingUnits: ReadonlyArray<AlphaEngenhariaOperatingUnit>;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaEngenhariaPaymentTerms {
  readonly measurementCycle: string;
  readonly paymentDueDays: number;
  readonly retentionPercentage: AlphaEngenhariaPercentage;
  readonly currency: AlphaEngenhariaCurrency;
}

export interface AlphaEngenhariaContract {
  readonly id: AlphaEngenhariaId;
  readonly companyId: AlphaEngenhariaId;
  readonly projectId: AlphaEngenhariaId;
  readonly contractNumber: string;
  readonly clientName: string;
  readonly signedAt: AlphaEngenhariaDate;
  readonly contractValue: AlphaEngenhariaMoney;
  readonly currency: AlphaEngenhariaCurrency;
  readonly paymentTerms: AlphaEngenhariaPaymentTerms;
  readonly status: AlphaEngenhariaContractStatus;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaEngenhariaPhysicalProgress {
  readonly plannedPercentage: AlphaEngenhariaPercentage;
  readonly actualPercentage: AlphaEngenhariaPercentage;
  readonly measuredPercentage: AlphaEngenhariaPercentage;
  readonly lastMeasurementId: AlphaEngenhariaId;
}

export interface AlphaEngenhariaProject {
  readonly id: AlphaEngenhariaId;
  readonly companyId: AlphaEngenhariaId;
  readonly organizationUnitId: AlphaEngenhariaId;
  readonly contractId: AlphaEngenhariaId;
  readonly name: string;
  readonly projectType: string;
  readonly location: string;
  readonly status: AlphaEngenhariaProjectStatus;
  readonly plannedStartDate: AlphaEngenhariaDate;
  readonly plannedEndDate: AlphaEngenhariaDate;
  readonly physicalProgress: AlphaEngenhariaPhysicalProgress;
  readonly budget: AlphaEngenhariaMoney;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaEngenhariaMeasurement {
  readonly id: AlphaEngenhariaId;
  readonly projectId: AlphaEngenhariaId;
  readonly contractId: AlphaEngenhariaId;
  readonly measurementNumber: string;
  readonly periodStart: AlphaEngenhariaDate;
  readonly periodEnd: AlphaEngenhariaDate;
  readonly measuredAt: AlphaEngenhariaDate;
  readonly physicalProgressPercentage: AlphaEngenhariaPercentage;
  readonly measuredAmount: AlphaEngenhariaMoney;
  readonly invoiceReference: string;
  readonly status: AlphaEngenhariaMeasurementStatus;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaEngenhariaBusinessEvent {
  readonly id: AlphaEngenhariaId;
  readonly date: AlphaEngenhariaDate;
  readonly category: AlphaEngenhariaBusinessEventCategory;
  readonly title: string;
  readonly description: string;
  readonly sourceObjectType: AlphaEngenhariaBusinessEventSourceType;
  readonly sourceObjectId: AlphaEngenhariaId;
  readonly financialImpact: AlphaEngenhariaMoney;
  readonly operationalImpact: AlphaEngenhariaOperationalImpact;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaEngenhariaDigitalTwin {
  readonly company: AlphaEngenhariaCompany;
  readonly organization: AlphaEngenhariaOrganization;
  readonly projects: ReadonlyArray<AlphaEngenhariaProject>;
  readonly contracts: ReadonlyArray<AlphaEngenhariaContract>;
  readonly measurements: ReadonlyArray<AlphaEngenhariaMeasurement>;
  readonly businessEvents: ReadonlyArray<AlphaEngenhariaBusinessEvent>;
}
