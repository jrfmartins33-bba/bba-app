import { composePageProvenanceKey } from "./page-local-neutral-structured-evidence-formation-keys";

const HEX_64 = /^[0-9a-f]{64}$/;

const key = composePageProvenanceKey("group-1", 3);
if (!HEX_64.test(key)) throw new Error("page provenance key is not a canonical SHA-256 hex digest");
if (composePageProvenanceKey("group-1", 3) !== key) throw new Error("page provenance key is not deterministic");
if (composePageProvenanceKey("group-2", 3) === key) throw new Error("page provenance key did not vary with sourceCandidateGroupKey");
if (composePageProvenanceKey("group-1", 4) === key) throw new Error("page provenance key did not vary with pageNumber");

console.log("ok - page provenance key is a deterministic canonical SHA-256 over (sourceCandidateGroupKey, pageNumber)");
