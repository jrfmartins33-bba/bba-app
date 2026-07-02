import type { BusinessFact } from "../../../../domain/business-fact";
import type { DiagnoseResult } from "./diagnose.types";

export function diagnose(facts: ReadonlyArray<BusinessFact>): DiagnoseResult {
  void facts;

  return [];
}
