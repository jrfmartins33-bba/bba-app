import { canonicalizePhysicalCellFormationBounds } from "./physical-cell-hypothesis-formation-output-geometry-canonicalization";
const x=canonicalizePhysicalCellFormationBounds({leftPoints:0.1+0.2,topPoints:0,rightPoints:1,bottomPoints:2,widthPoints:0,heightPoints:0,centerXPoints:0,centerYPoints:0});
if(x.leftPoints!==0.3||x.widthPoints!==0.7||x.centerXPoints!==0.65)throw new Error("canonical bounds must derive coherent fields from canonical limits");
if(JSON.stringify(x)!==JSON.stringify(canonicalizePhysicalCellFormationBounds(x)))throw new Error("canonicalization must be idempotent");
console.log("ok - f.2c geometry canonicalization is coherent and idempotent");
