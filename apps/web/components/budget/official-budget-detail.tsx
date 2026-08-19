"use client";

import { useMemo, useState } from "react";
import catalogStyles from "./official-budget-catalog.module.css";
import { formatCentsPtBr } from "@/lib/proposal-scenarios";
import type { ConsolidatedBudgetSummaryDto } from "@/lib/budget/consolidated-budget-catalog";

export interface OfficialLine {
  readonly id: string;
  readonly kind: "Group" | "Subgroup" | "ServiceItem";
  readonly description: { readonly status: "Confirmed"; readonly text: string } | { readonly status: "AbsentFromSource" };
  readonly externalCode: string | null;
  readonly parentLineId: string | null;
  readonly position: number;
  readonly totalCents: number | null;
}

export interface OfficialBudgetDto {
  readonly id: string;
  readonly status: "Consolidated";
  readonly lines: ReadonlyArray<OfficialLine>;
}

export interface LineIndex {
  readonly childrenByParent: ReadonlyMap<string | null, ReadonlyArray<OfficialLine>>;
  readonly totalsByLine: ReadonlyMap<string, number>;
}

export function buildLineIndex(lines: ReadonlyArray<OfficialLine>): LineIndex {
  const childrenByParent = new Map<string | null, OfficialLine[]>();
  for (const line of lines) {
    const current = childrenByParent.get(line.parentLineId) ?? [];
    current.push(line);
    childrenByParent.set(line.parentLineId, current);
  }
  for (const children of childrenByParent.values()) {
    children.sort((left, right) => left.position - right.position);
  }

  const totalsByLine = new Map<string, number>();
  const calculate = (line: OfficialLine): number => {
    const cached = totalsByLine.get(line.id);
    if (cached !== undefined) return cached;
    const total =
      line.kind === "ServiceItem"
        ? line.totalCents ?? 0
        : (childrenByParent.get(line.id) ?? []).reduce((sum, child) => sum + calculate(child), 0);
    totalsByLine.set(line.id, total);
    return total;
  };
  for (const line of lines) calculate(line);
  return { childrenByParent, totalsByLine };
}

export function OfficialBudgetDetail({
  budget,
  summary,
}: {
  readonly budget: OfficialBudgetDto;
  readonly summary: ConsolidatedBudgetSummaryDto;
}) {
  const { childrenByParent, totalsByLine } = useMemo(() => buildLineIndex(budget.lines), [budget.lines]);
  const roots = childrenByParent.get(null) ?? [];

  return (
    <div className={catalogStyles.detailWrapper}>
      <div className={catalogStyles.detailHeader}>
        <div>
          <h3>Itens do orçamento</h3>
          <span className={catalogStyles.detailCount}>
            {summary.serviceItemCount} itens de serviço{summary.lineCount !== null ? ` · ${summary.lineCount} linhas` : ""}
          </span>
        </div>
        <strong className={catalogStyles.detailTotalValue}>{formatCentsPtBr(summary.officialValueCents)}</strong>
      </div>
      <div className={catalogStyles.treeContainer}>
        {roots.map((line) => (
          <OfficialLineTree
            key={line.id}
            line={line}
            depth={0}
            childrenByParent={childrenByParent}
            totalsByLine={totalsByLine}
          />
        ))}
      </div>
    </div>
  );
}

export function OfficialLineTree({
  line,
  depth,
  childrenByParent,
  totalsByLine,
}: {
  readonly line: OfficialLine;
  readonly depth: number;
  readonly childrenByParent: ReadonlyMap<string | null, ReadonlyArray<OfficialLine>>;
  readonly totalsByLine: ReadonlyMap<string, number>;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const children = childrenByParent.get(line.id) ?? [];
  const isLeaf = line.kind === "ServiceItem";
  const isGroup = line.kind === "Group";
  const isSubgroup = line.kind === "Subgroup";
  const description = line.description.status === "Confirmed" ? line.description.text : "Descrição não informada";
  const totalValue = totalsByLine.get(line.id) ?? (line.totalCents ?? 0);

  const rowClass = isGroup
    ? `${catalogStyles.treeRow} ${catalogStyles.treeGroupRow}`
    : isSubgroup
    ? `${catalogStyles.treeRow} ${catalogStyles.treeSubgroupRow}`
    : `${catalogStyles.treeRow} ${catalogStyles.treeItemRow}`;

  return (
    <div
      className={`${catalogStyles.treeNode} ${isGroup ? catalogStyles.groupNode : ""}`}
      style={{ paddingLeft: `${Math.min(depth, 5) * 1.25}rem` }}
    >
      <div className={rowClass}>
        <div className={catalogStyles.treeContent}>
          {!isLeaf && children.length > 0 ? (
            <button
              type="button"
              className={catalogStyles.treeToggle}
              aria-expanded={expanded}
              aria-label={`${expanded ? "Recolher" : "Expandir"} ${description}`}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className={catalogStyles.treeSpacer} />
          )}
          <span className={isGroup ? catalogStyles.groupTitle : isSubgroup ? catalogStyles.subgroupTitle : catalogStyles.itemTitle}>
            {line.externalCode ? <strong className={catalogStyles.lineCode}>{line.externalCode}</strong> : null}
            {line.externalCode ? " — " : ""}
            <span className={catalogStyles.lineDescription}>{description}</span>
          </span>
        </div>
        <strong className={isGroup ? catalogStyles.groupValue : isSubgroup ? catalogStyles.subgroupValue : catalogStyles.itemValue}>
          {formatCentsPtBr(totalValue)}
        </strong>
      </div>
      {expanded
        ? children.map((child) => (
            <OfficialLineTree
              key={child.id}
              line={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              totalsByLine={totalsByLine}
            />
          ))
        : null}
    </div>
  );
}
