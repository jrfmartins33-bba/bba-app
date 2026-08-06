import { fingerprintCanonical } from "./budget-table-reconstruction-fingerprint";
import type {
  BudgetTableReconstructionInput,
  CanonicalLocatorEntry,
  StructuralLocator,
} from "./budget-table-reconstruction.types";

interface GeometryBounds {
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
}

export function structuralLocator(
  input: BudgetTableReconstructionInput,
  pageNumber: number,
  lineOrder: number | null,
  segmentOrder: number | null,
  bounds: GeometryBounds | null,
  sourceTextItemIndices: ReadonlyArray<number>,
): StructuralLocator {
  return {
    documentSha256: input.physicalRead.sourceByteHash,
    pageNumber,
    lineVerticalOrder: lineOrder,
    segmentHorizontalOrder: segmentOrder,
    bounds:
      bounds === null
        ? null
        : [bounds.leftPoints, bounds.topPoints, bounds.rightPoints, bounds.bottomPoints],
    sourceTextItemIndices: [...sourceTextItemIndices].sort((left, right) => left - right),
    readerIdentity: `${input.physicalRead.readerName}@${input.physicalRead.readerVersion}/${input.physicalRead.adapterVersion}`,
    libraryIdentity: input.physicalRead.underlyingLibraryVersion,
    reconstructorIdentity: `${input.structureReconstruction.reconstructorName}@${input.structureReconstruction.reconstructorVersion}`,
    physicalFingerprint: input.physicalRead.geometryContextFingerprint,
    structuralFingerprint: input.structureReconstruction.reconstructionContextFingerprint,
  };
}

export function locatorId(locator: StructuralLocator): string {
  return `locator:${fingerprintCanonical(locator)}`;
}

export class LocatorCatalog {
  readonly #entries = new Map<string, CanonicalLocatorEntry>();

  register(locator: StructuralLocator): string {
    const id = locatorId(locator);
    if (!this.#entries.has(id)) {
      this.#entries.set(id, { locatorId: id, locator });
    }
    return id;
  }

  entries(): ReadonlyArray<CanonicalLocatorEntry> {
    return [...this.#entries.values()].sort((left, right) =>
      left.locatorId < right.locatorId ? -1 : left.locatorId > right.locatorId ? 1 : 0,
    );
  }
}
