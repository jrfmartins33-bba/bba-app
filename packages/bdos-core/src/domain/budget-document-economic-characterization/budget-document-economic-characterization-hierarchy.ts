import type { ParentResolutionMethod } from "./budget-document-economic-characterization.types";
import type { HierarchicalCodeParse } from "./budget-document-economic-characterization-row-classification";

/**
 * Contexto hierárquico corrente, mantido em ordem documental através de
 * todo o grupo de proveniência — nunca reiniciado por página ou região,
 * porque um Subgrupo real frequentemente atravessa páginas. Nunca funde
 * linhas físicas; apenas resolve, linha a linha, qual `proposedLineId` é o
 * pai — a linha física permanece intocada e auditável isoladamente.
 */
export interface HierarchyContext {
  readonly openGroup: { readonly proposedLineId: string; readonly groupSegment: string } | null;
  readonly openSubgroup: { readonly proposedLineId: string; readonly groupSegment: string; readonly subgroupSegment: string } | null;
}

export const EMPTY_HIERARCHY_CONTEXT: HierarchyContext = { openGroup: null, openSubgroup: null };

export type ParentResolution =
  | { readonly outcome: "resolved"; readonly parentProposedLineId: string | null; readonly method: ParentResolutionMethod }
  | { readonly outcome: "orphan" };

/**
 * Resolve o pai de uma linha "group" — sempre topo, nunca tem pai (§17).
 */
export function resolveGroupParent(): { readonly parentProposedLineId: null; readonly method: "TopLevelNoParent" } {
  return { parentProposedLineId: null, method: "TopLevelNoParent" };
}

/**
 * Resolve o pai de uma linha "subgroup" — sempre o Grupo aberto cujo
 * segmento bate com o próprio código (§17). Órfão quando nenhum Grupo
 * compatível está aberto — nunca anexado ao Grupo errado.
 */
export function resolveSubgroupParent(context: HierarchyContext, code: HierarchicalCodeParse): ParentResolution {
  if (context.openGroup === null || context.openGroup.groupSegment !== code.groupSegment) return { outcome: "orphan" };
  return { outcome: "resolved", parentProposedLineId: context.openGroup.proposedLineId, method: "HierarchicalCode" };
}

/**
 * Resolve o pai de um Item de Serviço COM código hierárquico próprio.
 * Caso real confirmado pela fixture oficial (§17): um item pode estar
 * direto sob o Grupo, sem Subgrupo intermediário, quando seu segmento de
 * grupo bate com o Grupo aberto mas não há Subgrupo aberto compatível — a
 * prova nunca é a ausência de zeros no próprio código do item, é a
 * ausência real de um Subgrupo aberto que o preceda documentalmente.
 */
export function resolveServiceItemParentByCode(context: HierarchyContext, code: HierarchicalCodeParse): ParentResolution {
  if (context.openSubgroup !== null && context.openSubgroup.groupSegment === code.groupSegment && context.openSubgroup.subgroupSegment === code.subgroupSegment) {
    return { outcome: "resolved", parentProposedLineId: context.openSubgroup.proposedLineId, method: "HierarchicalCode" };
  }
  if (context.openGroup !== null && context.openGroup.groupSegment === code.groupSegment) {
    return { outcome: "resolved", parentProposedLineId: context.openGroup.proposedLineId, method: "HierarchicalCode" };
  }
  return { outcome: "orphan" };
}

/**
 * Resolve o pai de um Item de Serviço SEM código hierárquico (ex.:
 * `COT-015`) — herdado da seção documental vigente (Subgrupo aberto, ou o
 * próprio Grupo aberto na ausência de Subgrupo), nunca do próprio item
 * (§17, `DocumentPositionSection`). Órfão quando nenhuma seção está aberta.
 */
export function resolveServiceItemParentByPosition(context: HierarchyContext): ParentResolution {
  if (context.openSubgroup !== null) return { outcome: "resolved", parentProposedLineId: context.openSubgroup.proposedLineId, method: "DocumentPositionSection" };
  if (context.openGroup !== null) return { outcome: "resolved", parentProposedLineId: context.openGroup.proposedLineId, method: "DocumentPositionSection" };
  return { outcome: "orphan" };
}

export function advanceContextAfterGroup(proposedLineId: string, code: HierarchicalCodeParse): HierarchyContext {
  return { openGroup: { proposedLineId, groupSegment: code.groupSegment }, openSubgroup: null };
}

export function advanceContextAfterSubgroup(context: HierarchyContext, proposedLineId: string, code: HierarchicalCodeParse): HierarchyContext {
  return { openGroup: context.openGroup, openSubgroup: { proposedLineId, groupSegment: code.groupSegment, subgroupSegment: code.subgroupSegment } };
}
