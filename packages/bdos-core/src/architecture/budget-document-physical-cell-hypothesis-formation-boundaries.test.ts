import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const locationRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "domain", "budget-document-location");
const moduleRoot = join(locationRoot, "physical-cell-hypothesis-formation");

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : extname(path) === ".ts" ? [path] : [];
  });
}

const allFiles = walk(moduleRoot);
const productionFiles = allFiles.filter((path) => !path.endsWith(".test.ts") && !path.includes(`${join("", "testing")}`));
const barrel = readFileSync(join(moduleRoot, "index.ts"), "utf8");
const forbiddenPublicNames = [
  "PROFILE", "computeGridIntersectionKey", "computeIdentityFingerprint",
  "canonicalizePhysicalCellFormationBounds", "PhysicalCellFormationDependencies",
  "WithDependencies", "getDefaultPhysicalCellFormationDependencies",
];
for (const name of forbiddenPublicNames) if (barrel.includes(name)) throw new Error(`public barrel exports internal ${name}`);

const forbiddenImportPatterns = [
  /from\s+["'][^"']*(?:infrastructure|apps\/|supabase|physical-reader|page-location)[^"']*["']/,
  /from\s+["'][^"']*(?:economic|commercial|pricing|cost-estimation)[^"']*["']/,
];
for (const file of productionFiles) {
  const raw = readFileSync(file, "utf8");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  if (/\.text\b|textContent|localizedText|contentLocator/.test(code)) throw new Error(`${file} reads or locates textual content`);
  for (const pattern of forbiddenImportPatterns) if (pattern.test(code)) throw new Error(`${file} imports a forbidden layer`);
  for (const term of ["uuid", "Math.random", "confidence", "ranking", "probability", "PhysicalHorizontalBand", "seam", "bridge"]) {
    if (code.includes(term)) throw new Error(`${file} contains forbidden production term ${term}`);
  }
  const executableCode = code.replaceAll("no_new_numeric_tolerance_applied", "");
  if (/\bDate\s*\(|\bnew\s+Date\b|timestamp|tolerance/i.test(executableCode)) throw new Error(`${file} introduces time or geometric tolerance`);
}

const orchestrator = readFileSync(join(moduleRoot, "form-budget-document-physical-cell-hypotheses.ts"), "utf8");
if (!/export function formBudgetDocumentPhysicalCellHypotheses\(\s*input\s*:/.test(orchestrator)) throw new Error("public operation must expose exactly one input object");
if (/export function formBudgetDocumentPhysicalCellHypotheses\([^)]*,/.test(orchestrator)) throw new Error("public operation has more than one argument");

const types = readFileSync(join(moduleRoot, "budget-document-physical-cell-hypothesis-formation.types.ts"), "utf8");
const cell = types.slice(types.indexOf("export interface PhysicalCellHypothesis {"), types.indexOf("export type PhysicalCellHypothesisSegmentDisposition"));
for (const duplicated of ["sourceLineKey", "sourceRegionKey", "pageNumber", "rowOrder", "columnOrder", "gridBounds"]) if (cell.includes(duplicated)) throw new Error(`cell duplicates intersection field ${duplicated}`);
if (types.includes("associatedSegmentKeys")) throw new Error("intersection duplicates cell segment ownership");
if (/failedPhase:[\s\S]{0,180}grid_formation/.test(types)) throw new Error("failed intersection exposes impossible grid_formation phase");
if (!types.includes('gridFormationRuleId: string') || !types.includes('cellFormationRuleId: string')) throw new Error("grid and cell rules are not explicitly named");

for (const requiredPhase of ["physical-grid-formation.ts", "physical-segment-grid-association.ts", "physical-cell-hypothesis-formation.ts", "physical-cell-hypothesis-formation-conservation.ts"]) {
  if (!allFiles.some((path) => path.endsWith(requiredPhase))) throw new Error(`missing isolated phase ${requiredPhase}`);
}
console.log("ok - recursive f.2c guard protects imports, one-input API, physical-only behavior, minimal contracts and isolated phases");
