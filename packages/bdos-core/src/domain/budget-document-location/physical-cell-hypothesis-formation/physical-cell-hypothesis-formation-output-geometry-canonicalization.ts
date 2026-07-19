import { canonicalizeOutputGeometryBounds } from "../structure-reconstruction/structure-reconstruction-output-geometry-canonicalization";
import type { PhysicalGeometryBounds } from "./budget-document-physical-cell-hypothesis-formation.types";
export const PHYSICAL_CELL_HYPOTHESIS_FORMATION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION = "physical-cell-hypothesis-formation-output-geometry-canonicalization-v1" as const;
export function canonicalizePhysicalCellFormationBounds(bounds: PhysicalGeometryBounds): PhysicalGeometryBounds { return canonicalizeOutputGeometryBounds(bounds); }
