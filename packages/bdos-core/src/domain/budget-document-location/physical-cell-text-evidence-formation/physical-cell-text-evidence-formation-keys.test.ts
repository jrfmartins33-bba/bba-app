import { computeGroupProcessedKey, computePageProcessedKey, computeRegionProcessedKey } from "./physical-cell-text-evidence-formation-keys";

const HEX_64 = /^[0-9a-f]{64}$/;

const groupKey = computeGroupProcessedKey("fingerprint-1", "group-1");
if (!HEX_64.test(groupKey)) throw new Error("groupProcessedKey is not a canonical SHA-256 hex digest");
if (computeGroupProcessedKey("fingerprint-1", "group-1") !== groupKey) throw new Error("groupProcessedKey is not deterministic");
if (computeGroupProcessedKey("fingerprint-2", "group-1") === groupKey) throw new Error("groupProcessedKey did not vary with the identity fingerprint");
if (computeGroupProcessedKey("fingerprint-1", "group-2") === groupKey) throw new Error("groupProcessedKey did not vary with sourceCandidateGroupKey");

const pageKey = computePageProcessedKey(groupKey, 3);
if (!HEX_64.test(pageKey)) throw new Error("pageProcessedKey is not a canonical SHA-256 hex digest");
if (computePageProcessedKey(groupKey, 3) !== pageKey) throw new Error("pageProcessedKey is not deterministic");
if (computePageProcessedKey(groupKey, 4) === pageKey) throw new Error("pageProcessedKey did not vary with pageNumber");

const regionKey = computeRegionProcessedKey(pageKey, "region-1");
if (!HEX_64.test(regionKey)) throw new Error("regionProcessedKey is not a canonical SHA-256 hex digest");
if (computeRegionProcessedKey(pageKey, "region-1") !== regionKey) throw new Error("regionProcessedKey is not deterministic");
if (computeRegionProcessedKey(pageKey, "region-2") === regionKey) throw new Error("regionProcessedKey did not vary with sourceRegionKey");

console.log("ok - group/page/region processed keys are deterministic canonical SHA-256 digests, never UUID or incidental order");
