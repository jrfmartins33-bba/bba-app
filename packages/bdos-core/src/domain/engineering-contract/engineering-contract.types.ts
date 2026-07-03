export type EngineeringContractMetadata = Readonly<Record<string, unknown>>;

export type EngineeringContractId = string;

export type EngineeringContractActor = string;

export type EngineeringContractOccurredAt = string;

export type EngineeringContractCorrelationId = string;

export type EngineeringContractCreatedBy = string;

export type EngineeringContractSourceSystem = string;

export enum EngineeringContractStatus {
  Draft = "Draft",
  Signed = "Signed",
  Executed = "Executed",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

/**
 * Curated, business-readable record of contractual milestones (signature,
 * start of execution, completion, cancellation) — distinct from `trace`,
 * which is the technical/audit record of every action taken on the
 * aggregate. Every entry is derived from caller-supplied data only.
 */
export interface EngineeringContractTimelineEvent {
  readonly type: string;
  readonly occurredAt: EngineeringContractOccurredAt;
  readonly description: string;
  readonly metadata: EngineeringContractMetadata;
}

export interface EngineeringContractTrace {
  readonly action: string;
  readonly actor: EngineeringContractActor;
  readonly occurredAt: EngineeringContractOccurredAt;
  readonly description: string;
  readonly metadata: EngineeringContractMetadata;
}

/**
 * Aggregate root for the administrative context of a public engineering
 * contract. Represents the contract itself — not measurement, not
 * approval, not export. Those are separate aggregates (measurement
 * workspace, approval workflow, export engine) that this domain must
 * never import.
 */
export interface EngineeringContract {
  readonly id: EngineeringContractId;
  readonly publicOwner: string;
  readonly contractNumber: string;
  readonly administrativeProcess: string;
  readonly administrativeProcessSEI: string | null;
  readonly commitmentNumber: string | null;
  readonly serviceOrder: string | null;
  readonly contractor: string | null;
  readonly consortium: string | null;
  readonly projectName: string | null;
  readonly objectDescription: string;
  readonly city: string;
  readonly state: string;
  readonly contractValue: number | null;
  readonly fundingSource: string | null;
  readonly status: EngineeringContractStatus;
  readonly timeline: ReadonlyArray<EngineeringContractTimelineEvent>;
  readonly trace: ReadonlyArray<EngineeringContractTrace>;
  readonly metadata: EngineeringContractMetadata;
}

export interface CreateEngineeringContractInput {
  readonly id: EngineeringContractId;
  readonly publicOwner: string;
  readonly contractNumber: string;
  readonly administrativeProcess: string;
  readonly administrativeProcessSEI?: string | null;
  readonly commitmentNumber?: string | null;
  readonly serviceOrder?: string | null;
  readonly contractor?: string | null;
  readonly consortium?: string | null;
  readonly projectName?: string | null;
  readonly objectDescription: string;
  readonly city: string;
  readonly state: string;
  readonly contractValue?: number | null;
  readonly fundingSource?: string | null;
  readonly actor: EngineeringContractActor;
  readonly occurredAt: EngineeringContractOccurredAt;
  readonly correlationId: EngineeringContractCorrelationId;
  readonly createdBy: EngineeringContractCreatedBy;
  readonly sourceSystem: EngineeringContractSourceSystem;
  readonly metadata?: EngineeringContractMetadata;
}

export interface AdvanceEngineeringContractStatusInput {
  readonly contract: EngineeringContract;
  readonly toStatus: EngineeringContractStatus;
  readonly actor: EngineeringContractActor;
  readonly occurredAt: EngineeringContractOccurredAt;
  readonly metadata?: EngineeringContractMetadata;
}

export type EngineeringContractErrorCode =
  | "missing_id"
  | "duplicate_contract_id"
  | "missing_public_owner"
  | "missing_contract_number"
  | "missing_administrative_process"
  | "missing_object_description"
  | "missing_city"
  | "missing_state"
  | "negative_contract_value"
  | "contract_terminal"
  | "invalid_contract_status_transition";

export interface EngineeringContractError {
  readonly code: EngineeringContractErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EngineeringContractMetadata;
}

export type EngineeringContractWarningCode = "none";

export interface EngineeringContractWarning {
  readonly code: EngineeringContractWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EngineeringContractMetadata;
}

export interface EngineeringContractSuccess {
  readonly success: true;
  readonly contract: EngineeringContract;
  readonly errors: ReadonlyArray<EngineeringContractError>;
  readonly warnings: ReadonlyArray<EngineeringContractWarning>;
  readonly metadata: EngineeringContractMetadata;
}

export interface EngineeringContractFailure {
  readonly success: false;
  readonly contract: null;
  readonly errors: ReadonlyArray<EngineeringContractError>;
  readonly warnings: ReadonlyArray<EngineeringContractWarning>;
  readonly metadata: EngineeringContractMetadata;
}

export type EngineeringContractResult = EngineeringContractSuccess | EngineeringContractFailure;
