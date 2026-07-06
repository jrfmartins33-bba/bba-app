import type { PlanningDataset } from "../../planning-dataset.types";

export interface ExcelImportInput {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly importedAt: string;
}

export interface ExcelImportResult {
  readonly success: boolean;
  readonly dataset: PlanningDataset;
}
