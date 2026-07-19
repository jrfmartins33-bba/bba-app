import { computeCellHypothesisKey,computeGridIntersectionKey,computeGroupProcessedKey,computePageProcessedKey,computeRegionProcessedKey } from "./physical-cell-hypothesis-formation-keys";
const keys=[computeGroupProcessedKey("f","g"),computePageProcessedKey("g",1),computeRegionProcessedKey("p","r"),computeGridIntersectionKey("r","l","c"),computeCellHypothesisKey("i",["s1","s2"])];
if(!keys.every(x=>/^[a-f0-9]{64}$/.test(x)))throw new Error("all keys must be SHA-256 hexadecimal");
if(computeCellHypothesisKey("i",["s1","s2"])===computeCellHypothesisKey("i",["s2","s1"]))throw new Error("ordered segment signature must affect the cell key");
console.log("ok - deterministic keys use canonical SHA-256 arrays");
