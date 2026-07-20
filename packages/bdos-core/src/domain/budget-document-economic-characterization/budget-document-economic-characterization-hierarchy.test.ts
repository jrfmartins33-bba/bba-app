import { parseHierarchicalCode } from "./budget-document-economic-characterization-row-classification";
import {
  advanceContextAfterGroup, advanceContextAfterSubgroup, EMPTY_HIERARCHY_CONTEXT,
  resolveGroupParent, resolveServiceItemParentByCode, resolveServiceItemParentByPosition, resolveSubgroupParent,
} from "./budget-document-economic-characterization-hierarchy";

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// --- padrão XX.YY.ZZ ------------------------------------------------------------

equal(parseHierarchicalCode("01.00.00")?.level, "group", "YY=00 and ZZ=00 must classify as group");
equal(parseHierarchicalCode("01.02.00")?.level, "subgroup", "ZZ=00, YY!=00 must classify as subgroup");
equal(parseHierarchicalCode("01.02.03")?.level, "service_item", "ZZ!=00 must classify as service_item");
equal(parseHierarchicalCode("COT-015"), null, "a non-conforming code must never be forced into the hierarchical pattern");
equal(parseHierarchicalCode("1.2.3"), null, "a code without two-digit zero-padded segments must not match (never a lenient/fuzzy pattern)");

// --- resolução de pai -------------------------------------------------------------

equal(resolveGroupParent().parentProposedLineId, null, "a group always resolves to no parent");
equal(resolveGroupParent().method, "TopLevelNoParent", "a group's resolution method is always TopLevelNoParent");

// Subgrupo órfão: nenhum Grupo aberto.
const orphanSubgroup = resolveSubgroupParent(EMPTY_HIERARCHY_CONTEXT, parseHierarchicalCode("01.02.00")!);
equal(orphanSubgroup.outcome, "orphan", "a subgroup with no open compatible group must be orphan, never silently attached");

// Subgrupo cujo segmento de grupo não bate com o Grupo aberto.
const ctxWithGroup01 = advanceContextAfterGroup("group-01", parseHierarchicalCode("01.00.00")!);
const mismatchedSubgroup = resolveSubgroupParent(ctxWithGroup01, parseHierarchicalCode("02.01.00")!);
equal(mismatchedSubgroup.outcome, "orphan", "a subgroup whose group segment does not match the open group must be orphan, never attached to the wrong group");

// Subgrupo compatível.
const goodSubgroup = resolveSubgroupParent(ctxWithGroup01, parseHierarchicalCode("01.02.00")!);
equal(goodSubgroup.outcome, "resolved", "a subgroup matching the open group's segment must resolve");
if (goodSubgroup.outcome === "resolved") {
  equal(goodSubgroup.parentProposedLineId, "group-01", "the subgroup's parent must be the open group's id");
  equal(goodSubgroup.method, "HierarchicalCode", "a coded subgroup's resolution method is always HierarchicalCode");
}

// Item com Subgrupo aberto compatível.
const ctxWithSubgroup = advanceContextAfterSubgroup(ctxWithGroup01, "subgroup-01-02", parseHierarchicalCode("01.02.00")!);
const itemUnderSubgroup = resolveServiceItemParentByCode(ctxWithSubgroup, parseHierarchicalCode("01.02.05")!);
equal(itemUnderSubgroup.outcome, "resolved", "an item matching the open subgroup must resolve to it");
if (itemUnderSubgroup.outcome === "resolved") equal(itemUnderSubgroup.parentProposedLineId, "subgroup-01-02", "item's parent must be the open subgroup");

// Item direto sob o Grupo, sem Subgrupo intermediário (caso real confirmado pela fixture: "05.00.01" sob "05.00.00").
const itemDirectUnderGroup = resolveServiceItemParentByCode(ctxWithGroup01, parseHierarchicalCode("01.00.05")!);
equal(itemDirectUnderGroup.outcome, "resolved", "an item whose group segment matches the open group, with no compatible subgroup open, must resolve directly to the group");
if (itemDirectUnderGroup.outcome === "resolved") {
  equal(itemDirectUnderGroup.parentProposedLineId, "group-01", "the item's parent must be the group itself, never fabricated");
}

// Item órfão (nem grupo nem subgrupo compatível aberto).
const orphanItem = resolveServiceItemParentByCode(EMPTY_HIERARCHY_CONTEXT, parseHierarchicalCode("03.01.01")!);
equal(orphanItem.outcome, "orphan", "an item whose group segment has no open group must be orphan");

// Item sem código (estilo COT-015) — herda a seção vigente (DocumentPositionSection).
const uncodedWithSubgroup = resolveServiceItemParentByPosition(ctxWithSubgroup);
equal(uncodedWithSubgroup.outcome, "resolved", "an uncoded item must inherit the open subgroup when one is open");
if (uncodedWithSubgroup.outcome === "resolved") {
  equal(uncodedWithSubgroup.parentProposedLineId, "subgroup-01-02", "the uncoded item's parent must be the open subgroup");
  equal(uncodedWithSubgroup.method, "DocumentPositionSection", "uncoded item resolution method must be DocumentPositionSection, never HierarchicalCode");
}
const uncodedWithGroupOnly = resolveServiceItemParentByPosition(ctxWithGroup01);
equal(uncodedWithGroupOnly.outcome === "resolved" && uncodedWithGroupOnly.parentProposedLineId, "group-01", "an uncoded item with no open subgroup must inherit the open group directly");
const uncodedOrphan = resolveServiceItemParentByPosition(EMPTY_HIERARCHY_CONTEXT);
equal(uncodedOrphan.outcome, "orphan", "an uncoded item with neither an open group nor subgroup must be orphan, never silently attached to nothing meaningful");

console.log("ok - hierarchical code pattern (group/subgroup/item classification, non-conforming codes never forced), parent resolution (orphan subgroup, mismatched group segment, compatible subgroup, item direct-under-group without intermediate subgroup — the real confirmed case, orphan item, and COT-015-style positional inheritance with and without an open subgroup)");
