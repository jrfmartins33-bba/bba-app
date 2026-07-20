import { deriveRegionStatus } from "./page-local-neutral-structured-evidence-formation-classifiers";

/**
 * Correção B1: prova diretamente, no nível do classificador único de região,
 * a reordenação de `deriveRegionStatus` (technicalProblemCount verificado
 * ANTES de documentCellCount === 0). Sem essa ordem, uma região cujo
 * `documentCellCount` chegou a zero por causa de uma falha de formação
 * (célula/posição/linha isolada) seria incorretamente classificada como
 * `grid_without_cells` — mascarando o problema real — em vez de
 * `structured_with_problems`. O caso legítimo (malha real sem nenhuma célula,
 * zero problemas técnicos) precisa continuar classificado corretamente como
 * `grid_without_cells`, nunca `structured_with_problems`.
 */

const base = { upstreamNotProcessable: false, withoutPhysicalGrid: false, ambiguousPositionCount: 0, formationFailed: false };

// Caso legítimo: malha real, mas nenhuma interseção jamais formou célula, e nenhum problema técnico.
const legitimate = deriveRegionStatus({ ...base, documentCellCount: 0, technicalProblemCount: 0 });
if (legitimate !== "grid_without_cells") throw new Error(`a genuinely empty grid (no cells, no technical problems) must classify as grid_without_cells, got ${legitimate}`);

// Caso mascarado: documentCellCount também chegou a zero, mas por causa de uma falha de
// formação registrada (ex.: a única célula da região falhou isoladamente) — deve continuar
// visível como structured_with_problems, nunca esconder-se atrás de grid_without_cells.
const masked = deriveRegionStatus({ ...base, documentCellCount: 0, technicalProblemCount: 1 });
if (masked !== "structured_with_problems") throw new Error(`documentCellCount reaching zero because of a recorded formation failure must never be masked as grid_without_cells, got ${masked}`);

// Caso comum (não afetado pela reordenação): células formadas normalmente, sem problemas.
const normal = deriveRegionStatus({ ...base, documentCellCount: 3, technicalProblemCount: 0 });
if (normal !== "structured") throw new Error(`a region with real cells and no problems must classify as structured, got ${normal}`);

console.log("ok - deriveRegionStatus checks technicalProblemCount before documentCellCount === 0, so a formation failure that zeroes out the cell count is never masked as grid_without_cells, while the genuinely empty grid case still classifies correctly");
