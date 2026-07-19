import { createHash } from "node:crypto";

function key(parts: ReadonlyArray<string | number>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export const computeGroupProcessedKey = (identityFingerprint: string, sourceCandidateGroupKey: string): string =>
  key(["text-evidence-group", identityFingerprint, sourceCandidateGroupKey]);
export const computePageProcessedKey = (groupProcessedKey: string, pageNumber: number): string =>
  key(["text-evidence-page", groupProcessedKey, pageNumber]);
export const computeRegionProcessedKey = (pageProcessedKey: string, sourceRegionKey: string): string =>
  key(["text-evidence-region", pageProcessedKey, sourceRegionKey]);
