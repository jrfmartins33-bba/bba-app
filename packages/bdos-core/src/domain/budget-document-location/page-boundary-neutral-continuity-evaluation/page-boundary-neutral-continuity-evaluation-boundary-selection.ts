import type { NeutralDocumentLine, NeutralDocumentPage, NeutralDocumentRegion } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import { ELIGIBLE_BOUNDARY_LINE_STATUSES, ELIGIBLE_BOUNDARY_REGION_STATES } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";

export type BoundaryRegionSelection =
  | { readonly outcome: "selected"; readonly region: NeutralDocumentRegion }
  | { readonly outcome: "missing" }
  | { readonly outcome: "ambiguous" };

export type BoundaryLineSelection =
  | { readonly outcome: "selected"; readonly line: NeutralDocumentLine }
  | { readonly outcome: "missing" }
  | { readonly outcome: "ambiguous" };

/**
 * Seleção extremal determinística (§6): a região de fronteira que "fecha" a
 * página é a de maior `order` entre as elegíveis; a que "abre" a página
 * seguinte é a de menor `order`. Empate no valor extremo entre regiões
 * distintas é uma falha localizada da avaliação do par (nunca resolvida por
 * escolha arbitrária) — nunca confundida com ausência.
 */
export function selectClosingRegion(page: NeutralDocumentPage): BoundaryRegionSelection {
  const eligible = page.regions.filter((region) => ELIGIBLE_BOUNDARY_REGION_STATES.includes(region.status));
  if (eligible.length === 0) return { outcome: "missing" };
  const maxOrder = Math.max(...eligible.map((region) => region.order));
  const atMax = eligible.filter((region) => region.order === maxOrder);
  if (atMax.length > 1) return { outcome: "ambiguous" };
  return { outcome: "selected", region: atMax[0] };
}

export function selectOpeningRegion(page: NeutralDocumentPage): BoundaryRegionSelection {
  const eligible = page.regions.filter((region) => ELIGIBLE_BOUNDARY_REGION_STATES.includes(region.status));
  if (eligible.length === 0) return { outcome: "missing" };
  const minOrder = Math.min(...eligible.map((region) => region.order));
  const atMin = eligible.filter((region) => region.order === minOrder);
  if (atMin.length > 1) return { outcome: "ambiguous" };
  return { outcome: "selected", region: atMin[0] };
}

/** Emenda 1: `upstream_not_processable` nunca é elegível — só `failed` seria insuficiente. */
export function selectClosingLine(region: NeutralDocumentRegion): BoundaryLineSelection {
  const eligible = region.documentLines.filter((line) => ELIGIBLE_BOUNDARY_LINE_STATUSES.includes(line.status));
  if (eligible.length === 0) return { outcome: "missing" };
  const maxOrder = Math.max(...eligible.map((line) => line.verticalOrder));
  const atMax = eligible.filter((line) => line.verticalOrder === maxOrder);
  if (atMax.length > 1) return { outcome: "ambiguous" };
  return { outcome: "selected", line: atMax[0] };
}

export function selectOpeningLine(region: NeutralDocumentRegion): BoundaryLineSelection {
  const eligible = region.documentLines.filter((line) => ELIGIBLE_BOUNDARY_LINE_STATUSES.includes(line.status));
  if (eligible.length === 0) return { outcome: "missing" };
  const minOrder = Math.min(...eligible.map((line) => line.verticalOrder));
  const atMin = eligible.filter((line) => line.verticalOrder === minOrder);
  if (atMin.length > 1) return { outcome: "ambiguous" };
  return { outcome: "selected", line: atMin[0] };
}
