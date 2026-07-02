import type { BusinessFact } from "../../../../domain/business-fact";

export type DiagnosisId = string;

export type DiagnosisCategory = string;

export type DiagnosisSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type DiagnosisMetadata = Readonly<Record<string, unknown>>;

export type DiagnosisDateTime = string;

export interface Diagnosis {
  readonly id: DiagnosisId;
  readonly category: DiagnosisCategory;
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly severity: DiagnosisSeverity;
  readonly confidence: number;
  readonly facts: ReadonlyArray<BusinessFact>;
  readonly metadata: DiagnosisMetadata;
  readonly createdAt: DiagnosisDateTime;
}

export type DiagnoseResult = ReadonlyArray<Diagnosis>;
