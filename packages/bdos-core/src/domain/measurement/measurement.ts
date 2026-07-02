import type {
  ContractBaselineId,
  ContractName,
  ContractNumber,
  ContractParty,
  MeasurementCalculationReference,
  MeasurementCatalogId,
  MeasurementCoordinate,
  MeasurementCorrelationId,
  MeasurementDate,
  MeasurementDimension,
  MeasurementEvidenceReference,
  MeasurementGeometry,
  MeasurementMemoryId,
  MeasurementMetadata,
  MeasurementMoney,
  MeasurementPeriodId,
  MeasurementQuantity,
  MeasurementStation,
  MeasurementUnit,
  ServiceItemCode,
  ServiceItemDescription,
  ServiceItemId,
  WorkPackageCode,
  WorkPackageId,
  WorkPackageName,
} from "./measurement.types";

export interface ContractBaseline {
  readonly id: ContractBaselineId;
  readonly contractId: ContractBaselineId;
  readonly contractNumber: ContractNumber;
  readonly contractName: ContractName;
  readonly client: ContractParty;
  readonly contractor: ContractParty;
  readonly totalContractValue: MeasurementMoney;
  readonly startDate: MeasurementDate;
  readonly endDate: MeasurementDate;
  readonly workPackages: ReadonlyArray<WorkPackage>;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata: MeasurementMetadata;
}

export interface WorkPackage {
  readonly id: WorkPackageId;
  readonly contractId: ContractBaselineId;
  readonly code: WorkPackageCode;
  readonly name: WorkPackageName;
  readonly description: string;
  readonly serviceItems: ReadonlyArray<ServiceItem>;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata: MeasurementMetadata;
}

export interface ServiceItem {
  readonly id: ServiceItemId;
  readonly contractId: ContractBaselineId;
  readonly workPackageId: WorkPackageId;
  readonly serviceItemId: ServiceItemId;
  readonly code: ServiceItemCode;
  readonly description: ServiceItemDescription;
  readonly unit: MeasurementUnit;
  readonly contractQuantity: MeasurementQuantity;
  readonly accumulatedQuantity: MeasurementQuantity;
  readonly remainingQuantity: MeasurementQuantity;
  readonly unitPrice: MeasurementMoney;
  readonly totalContractValue: MeasurementMoney;
  readonly requiresReplanilhamento: boolean;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementCatalog {
  readonly id: MeasurementCatalogId;
  readonly contractId: ContractBaselineId;
  readonly contractBaselineId: ContractBaselineId;
  readonly serviceItems: ReadonlyArray<ServiceItem>;
  readonly createdAt: MeasurementDate;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementMemory {
  readonly id: MeasurementMemoryId;
  readonly contractId: ContractBaselineId;
  readonly workPackageId: WorkPackageId;
  readonly serviceItemId: ServiceItemId;
  readonly correlationId: MeasurementCorrelationId;
  readonly area?: MeasurementDimension;
  readonly volume?: MeasurementDimension;
  readonly length?: MeasurementDimension;
  readonly station?: MeasurementStation;
  readonly coordinates: ReadonlyArray<MeasurementCoordinate>;
  readonly geometry?: MeasurementGeometry;
  readonly calculationReference?: MeasurementCalculationReference;
  readonly evidenceReferences: ReadonlyArray<MeasurementEvidenceReference>;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementPeriod {
  readonly id: MeasurementPeriodId;
  readonly contractId: ContractBaselineId;
  readonly periodNumber: number;
  readonly startDate: MeasurementDate;
  readonly endDate: MeasurementDate;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata: MeasurementMetadata;
}

export interface CreateContractBaselineInput {
  readonly id: ContractBaselineId;
  readonly contractNumber: ContractNumber;
  readonly contractName: ContractName;
  readonly client: ContractParty;
  readonly contractor: ContractParty;
  readonly startDate: MeasurementDate;
  readonly endDate: MeasurementDate;
  readonly workPackages: ReadonlyArray<WorkPackage>;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata?: MeasurementMetadata;
}

export interface CreateWorkPackageInput {
  readonly id: WorkPackageId;
  readonly contractId: ContractBaselineId;
  readonly code: WorkPackageCode;
  readonly name: WorkPackageName;
  readonly description: string;
  readonly serviceItems: ReadonlyArray<ServiceItem>;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata?: MeasurementMetadata;
}

export interface CreateServiceItemInput {
  readonly id: ServiceItemId;
  readonly contractId: ContractBaselineId;
  readonly workPackageId: WorkPackageId;
  readonly code: ServiceItemCode;
  readonly description: ServiceItemDescription;
  readonly unit: MeasurementUnit;
  readonly contractQuantity: MeasurementQuantity;
  readonly accumulatedQuantity: MeasurementQuantity;
  readonly unitPrice: MeasurementMoney;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata?: MeasurementMetadata;
}

export interface CreateMeasurementCatalogInput {
  readonly id: MeasurementCatalogId;
  readonly contractBaselineId: ContractBaselineId;
  readonly serviceItems: ReadonlyArray<ServiceItem>;
  readonly createdAt: MeasurementDate;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata?: MeasurementMetadata;
}

export interface CreateMeasurementMemoryInput {
  readonly id: MeasurementMemoryId;
  readonly contractId: ContractBaselineId;
  readonly workPackageId: WorkPackageId;
  readonly serviceItemId: ServiceItemId;
  readonly correlationId: MeasurementCorrelationId;
  readonly area?: MeasurementDimension;
  readonly volume?: MeasurementDimension;
  readonly length?: MeasurementDimension;
  readonly station?: MeasurementStation;
  readonly coordinates?: ReadonlyArray<MeasurementCoordinate>;
  readonly geometry?: MeasurementGeometry;
  readonly calculationReference?: MeasurementCalculationReference;
  readonly evidenceReferences?: ReadonlyArray<MeasurementEvidenceReference>;
  readonly metadata?: MeasurementMetadata;
}

export interface CreateMeasurementPeriodInput {
  readonly id: MeasurementPeriodId;
  readonly contractId: ContractBaselineId;
  readonly periodNumber: number;
  readonly startDate: MeasurementDate;
  readonly endDate: MeasurementDate;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata?: MeasurementMetadata;
}

export function createContractBaseline(
  input: CreateContractBaselineInput,
): ContractBaseline {
  return freezeDomainObject({
    id: input.id,
    contractId: input.id,
    contractNumber: input.contractNumber,
    contractName: input.contractName,
    client: input.client,
    contractor: input.contractor,
    totalContractValue: calculateContractBaselineValue(input.workPackages),
    startDate: input.startDate,
    endDate: input.endDate,
    workPackages: [...input.workPackages],
    correlationId: input.correlationId,
    metadata: input.metadata ?? {},
  });
}

export function createWorkPackage(input: CreateWorkPackageInput): WorkPackage {
  return freezeDomainObject({
    id: input.id,
    contractId: input.contractId,
    code: input.code,
    name: input.name,
    description: input.description,
    serviceItems: [...input.serviceItems],
    correlationId: input.correlationId,
    metadata: input.metadata ?? {},
  });
}

export function createServiceItem(input: CreateServiceItemInput): ServiceItem {
  const remainingQuantity = calculateRemainingQuantity(
    input.contractQuantity,
    input.accumulatedQuantity,
  );

  return freezeDomainObject({
    id: input.id,
    contractId: input.contractId,
    workPackageId: input.workPackageId,
    serviceItemId: input.id,
    code: input.code,
    description: input.description,
    unit: input.unit,
    contractQuantity: input.contractQuantity,
    accumulatedQuantity: input.accumulatedQuantity,
    remainingQuantity,
    unitPrice: input.unitPrice,
    totalContractValue: calculateServiceItemContractValue(
      input.contractQuantity,
      input.unitPrice,
    ),
    requiresReplanilhamento: input.accumulatedQuantity > input.contractQuantity,
    correlationId: input.correlationId,
    metadata: input.metadata ?? {},
  });
}

export function createMeasurementCatalog(
  input: CreateMeasurementCatalogInput,
): MeasurementCatalog {
  return freezeDomainObject({
    id: input.id,
    contractId: input.contractBaselineId,
    contractBaselineId: input.contractBaselineId,
    serviceItems: [...input.serviceItems],
    createdAt: input.createdAt,
    correlationId: input.correlationId,
    metadata: input.metadata ?? {},
  });
}

export function createMeasurementMemory(
  input: CreateMeasurementMemoryInput,
): MeasurementMemory {
  return freezeDomainObject({
    id: input.id,
    contractId: input.contractId,
    workPackageId: input.workPackageId,
    serviceItemId: input.serviceItemId,
    correlationId: input.correlationId,
    area: input.area,
    volume: input.volume,
    length: input.length,
    station: input.station,
    coordinates: [...(input.coordinates ?? [])],
    geometry: input.geometry,
    calculationReference: input.calculationReference,
    evidenceReferences: [...(input.evidenceReferences ?? [])],
    metadata: input.metadata ?? {},
  });
}

export function createMeasurementPeriod(
  input: CreateMeasurementPeriodInput,
): MeasurementPeriod {
  return freezeDomainObject({
    id: input.id,
    contractId: input.contractId,
    periodNumber: input.periodNumber,
    startDate: input.startDate,
    endDate: input.endDate,
    correlationId: input.correlationId,
    metadata: input.metadata ?? {},
  });
}

export function calculateServiceItemContractValue(
  contractQuantity: MeasurementQuantity,
  unitPrice: MeasurementMoney,
): MeasurementMoney {
  return contractQuantity * unitPrice;
}

export function calculateRemainingQuantity(
  contractQuantity: MeasurementQuantity,
  accumulatedQuantity: MeasurementQuantity,
): MeasurementQuantity {
  return contractQuantity - accumulatedQuantity;
}

function calculateContractBaselineValue(
  workPackages: ReadonlyArray<WorkPackage>,
): MeasurementMoney {
  return workPackages.reduce(
    (contractTotal, workPackage) =>
      contractTotal +
      workPackage.serviceItems.reduce(
        (packageTotal, serviceItem) => packageTotal + serviceItem.totalContractValue,
        0,
      ),
    0,
  );
}

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
