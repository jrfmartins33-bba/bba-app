import { createHash } from "node:crypto";
function key(parts: ReadonlyArray<string | number>): string { return createHash("sha256").update(JSON.stringify(parts)).digest("hex"); }
export const computeGroupProcessedKey = (fingerprint: string, sourceKey: string): string => key(["group", fingerprint, sourceKey]);
export const computePageProcessedKey = (groupKey: string, pageNumber: number): string => key(["page", groupKey, pageNumber]);
export const computeRegionProcessedKey = (pageKey: string, regionKey: string): string => key(["region", pageKey, regionKey]);
export const computeGridIntersectionKey = (regionKey: string, lineKey: string, columnKey: string): string => key(["grid-intersection", regionKey, lineKey, columnKey]);
export const computeCellHypothesisKey = (intersectionKey: string, segmentKeys: ReadonlyArray<string>): string => key(["cell-hypothesis", intersectionKey, ...segmentKeys]);
