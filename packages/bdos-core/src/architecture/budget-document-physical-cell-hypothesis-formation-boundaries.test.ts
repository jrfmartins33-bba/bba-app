import { readFileSync,readdirSync } from "node:fs";
import { dirname,join,resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..","domain","budget-document-location");
const dir=join(root,"physical-cell-hypothesis-formation");
const production=readdirSync(dir).filter(x=>x.endsWith(".ts")&&!x.endsWith(".test.ts")).map(x=>join(dir,x));
const barrel=readFileSync(join(dir,"index.ts"),"utf8");
const forbiddenExports=["PROFILE","computeGridIntersectionKey","computeIdentityFingerprint","canonicalizePhysicalCellFormationBounds","problem"];
for(const id of forbiddenExports)if(barrel.includes(id))throw new Error(`public barrel exports internal ${id}`);
for(const file of production){const content=readFileSync(file,"utf8");if(/\.text\b/.test(content.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"")))throw new Error(`${file} reads textual content`);for(const term of ["supabase","apps/web","apps/mobile","uuid","Math.random","confidence","ranking","probability","PhysicalHorizontalBand"]){if(content.includes(term))throw new Error(`${file} contains forbidden production term ${term}`);}}
const types=readFileSync(join(dir,"budget-document-physical-cell-hypothesis-formation.types.ts"),"utf8");
const cell=types.slice(types.indexOf("export interface PhysicalCellHypothesis {"),types.indexOf("export type PhysicalCellHypothesisSegmentDisposition"));
for(const duplicated of ["sourceLineKey","sourceRegionKey","pageNumber","rowOrder","columnOrder","gridBounds"])if(cell.includes(duplicated))throw new Error(`cell duplicates intersection field ${duplicated}`);
if(types.includes("associatedSegmentKeys"))throw new Error("intersection duplicates cell segment ownership");
if(/failedPhase:[\s\S]{0,160}grid_formation/.test(types))throw new Error("failed intersection exposes impossible grid_formation phase");
console.log("ok - f.2c architectural boundaries preserve the physical-only minimal public contract");
