import type { PlanningDetectedType } from "../../planning-dataset.types";

export type PlanningColumnKind =
  | "code"
  | "name"
  | "start"
  | "end"
  | "duration"
  | "percent"
  | "predecessors"
  | "value"
  | "weight"
  | "control"
  | "period";

export interface DetectedColumn {
  readonly columnIndex: number;
  readonly kind: PlanningColumnKind;
  readonly header: string;
}

export interface DetectedPeriodColumn {
  readonly columnIndex: number;
  readonly label: string;
  readonly date: string | null;
}

export interface SheetDetectionResult {
  readonly detectedType: PlanningDetectedType;
  readonly headerRowIndex: number | null;
  readonly columns: ReadonlyArray<DetectedColumn>;
  readonly periodHeaderRowIndex: number | null;
  readonly periodColumns: ReadonlyArray<DetectedPeriodColumn>;
  readonly hasPredecessorColumn: boolean;
  readonly hasValueColumn: boolean;
  /** Quantas colunas/sinais reconhecidos ao todo — usado para escolher a "aba principal" entre várias planilhas. */
  readonly confidence: number;
}
