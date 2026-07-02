import type { Decision } from "../../../domain/decision";
import type { Diagnosis } from "../pipeline/diagnose";

export type BuildDecisionsInput = ReadonlyArray<Diagnosis>;

export type BuildDecisionsResult = ReadonlyArray<Decision>;
