"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type {
  BudgetComparedItem,
  BudgetComparisonClassification,
  BudgetDocumentDivergenceKind,
  BudgetVersionComparison,
} from "@bba/bdos-core/services/procurement-engineering";
import catalogStyles from "./official-budget-catalog.module.css";
import { formatCentsPtBr } from "@/lib/proposal-scenarios";
import type { ConsolidatedBudgetSummaryDto } from "@/lib/budget/consolidated-budget-catalog";
import {
  buildLineIndex,
  buildVisibleLineIds,
  formatCanonicalQuantityPtBr,
  formatDocumentUnitPtBr,
  type ComparisonFilter,
  type OfficialBudgetDto,
  type OfficialLine,
} from "./official-budget-comparison-view-model";

export { buildLineIndex, buildVisibleLineIds } from "./official-budget-comparison-view-model";
export type { ComparisonFilter, OfficialBudgetDto, OfficialLine } from "./official-budget-comparison-view-model";

const FILTERS: ReadonlyArray<{ readonly value: ComparisonFilter; readonly label: string }> = [
  { value: "All", label: "Todos" },
  { value: "Reduction", label: "Com redução" },
  { value: "Increase", label: "Com acréscimo" },
  { value: "Equal", label: "Sem alteração" },
  { value: "Divergence", label: "Divergência documental" },
];

export function OfficialBudgetDetail({
  budget,
  summary,
  comparison,
}: {
  readonly budget: OfficialBudgetDto;
  readonly summary: ConsolidatedBudgetSummaryDto;
  readonly comparison?: BudgetVersionComparison | null;
}) {
  const [comparisonMode, setComparisonMode] = useState(false);
  const [filter, setFilter] = useState<ComparisonFilter>("All");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const { childrenByParent, totalsByLine, linesById } = useMemo(() => buildLineIndex(budget.lines), [budget.lines]);
  const comparisonByLineId = useMemo(
    () => new Map((comparison?.items ?? []).map((item) => [item.proposalLineId, item])),
    [comparison],
  );
  const visibleLineIds = useMemo(
    () => buildVisibleLineIds({ budget, comparisonByLineId, linesById, comparisonMode, filter, search: deferredSearch }),
    [budget, comparisonByLineId, comparisonMode, deferredSearch, filter, linesById],
  );
  const roots = (childrenByParent.get(null) ?? []).filter((line) => visibleLineIds.has(line.id));
  const visibleItemCount = budget.lines.filter((line) => line.kind === "ServiceItem" && visibleLineIds.has(line.id)).length;

  return (
    <div className={catalogStyles.detailWrapper}>
      <div className={catalogStyles.detailHeader}>
        <div>
          <h3>{summary.documentKind === "WinningProposal" ? "Itens da proposta" : "Itens do orçamento"}</h3>
          <span className={catalogStyles.detailCount}>
            {summary.serviceItemCount} itens de serviço{summary.lineCount !== null ? ` · ${summary.lineCount} linhas` : ""}
          </span>
        </div>
        {comparison ? (
          <div className={catalogStyles.viewSwitcher} aria-label="Visualização dos itens">
            <button type="button" aria-pressed={!comparisonMode} onClick={() => setComparisonMode(false)}>Proposta Vencedora</button>
            <button type="button" aria-pressed={comparisonMode} onClick={() => setComparisonMode(true)}>Comparar com Orçamento Oficial</button>
          </div>
        ) : <strong className={catalogStyles.detailTotalValue}>{formatCentsPtBr(summary.officialValueCents)}</strong>}
      </div>

      {comparisonMode && comparison ? (
        <>
          <ComparisonExecutiveSummary comparison={comparison} comparisonByLineId={comparisonByLineId} linesById={linesById} />
          <div className={catalogStyles.comparisonToolbar}>
            <label className={catalogStyles.comparisonSearch}>
              <span>Buscar item</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código ou descrição" />
            </label>
            <div className={catalogStyles.comparisonFilters} aria-label="Filtrar comparação">
              {FILTERS.map((option) => (
                <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <span className={catalogStyles.filterResult}>{visibleItemCount} {visibleItemCount === 1 ? "item" : "itens"}</span>
          </div>
        </>
      ) : null}

      <div className={`${catalogStyles.treeContainer} ${comparisonMode ? catalogStyles.comparisonTree : ""}`}>
        {roots.length > 0 ? roots.map((line) => (
          <OfficialLineTree
            key={line.id}
            line={line}
            depth={0}
            childrenByParent={childrenByParent}
            totalsByLine={totalsByLine}
            comparisonByLineId={comparisonByLineId}
            visibleLineIds={visibleLineIds}
            comparisonMode={comparisonMode}
            filtering={filter !== "All" || search.trim().length > 0}
          />
        )) : (
          <div className={catalogStyles.comparisonEmpty}><strong>Nenhum item encontrado</strong><span>Ajuste a busca ou escolha outro filtro.</span></div>
        )}
      </div>
    </div>
  );
}

function ComparisonExecutiveSummary({ comparison, comparisonByLineId, linesById }: {
  readonly comparison: BudgetVersionComparison;
  readonly comparisonByLineId: ReadonlyMap<string, BudgetComparedItem>;
  readonly linesById: ReadonlyMap<string, OfficialLine>;
}) {
  const summary = comparison.summary;
  const largestReduction = summary.largestReductionProposalLineId ? comparisonByLineId.get(summary.largestReductionProposalLineId) ?? null : null;
  const largestIncrease = summary.largestIncreaseProposalLineId ? comparisonByLineId.get(summary.largestIncreaseProposalLineId) ?? null : null;

  return (
    <section className={catalogStyles.comparisonExecutive} aria-labelledby="comparison-executive-title">
      <div className={catalogStyles.comparisonExecutiveHeading}>
        <div><p>Leitura executiva</p><h4 id="comparison-executive-title">Onde o preço contratado mudou</h4></div>
        <span className={catalogStyles.auditSeal}>{summary.matchedItemCount} de {summary.proposalServiceItemCount} pares validados</span>
      </div>
      <div className={catalogStyles.comparisonTotals}>
        <ComparisonMetric label="Orçamento Oficial" value={formatCentsPtBr(summary.officialTotalCents)} />
        <ComparisonMetric label="Proposta Vencedora" value={formatCentsPtBr(summary.proposalTotalCents)} />
        <ComparisonMetric label={summary.differenceCents < 0 ? "Acréscimo total" : "Economia na contratação"} value={formatCentsPtBr(Math.abs(summary.differenceCents))} accent />
        <ComparisonMetric label="Variação" value={formatBasisPoints(summary.percentageBasisPoints)} accent />
      </div>
      <div className={catalogStyles.comparisonCounts}>
        <CountPill label="Redução" count={summary.reductionCount} tone="reduction" />
        <CountPill label="Acréscimo" count={summary.increaseCount} tone="increase" />
        <CountPill label="Sem alteração" count={summary.equalCount} tone="equal" />
        <CountPill label="Divergência documental" count={summary.divergenceCount} tone="divergence" />
      </div>
      <div className={catalogStyles.decisionSignals}>
        {largestReduction ? <LargestEconomySignal item={largestReduction} line={linesById.get(largestReduction.proposalLineId)} /> : null}
        <div className={catalogStyles.exceptionSignal}>
          <span>Exceções relevantes</span>
          <div className={catalogStyles.exceptionMetrics}>
            <div><strong>{summary.increaseCount}</strong><small>itens com preço maior</small></div>
            <div><strong>{summary.divergenceCount}</strong><small>divergências documentais</small></div>
            <div><strong>{summary.normalizedQuantityMatchCount}</strong><small>quantidades normalizadas</small></div>
          </div>
          <p>{largestIncrease
            ? `Maior acréscimo: ${linesById.get(largestIncrease.proposalLineId)?.externalCode ?? "item sem código"}.`
            : "Não há itens com acréscimo. As exceções remanescentes são estritamente documentais."}</p>
        </div>
      </div>
    </section>
  );
}

function ComparisonMetric({ label, value, accent = false }: { readonly label: string; readonly value: string; readonly accent?: boolean }) {
  return <div className={accent ? catalogStyles.comparisonMetricAccent : ""}><span>{label}</span><strong>{value}</strong></div>;
}

function CountPill({ label, count, tone }: { readonly label: string; readonly count: number; readonly tone: string }) {
  return <span className={`${catalogStyles.countPill} ${catalogStyles[tone]}`}><strong>{count}</strong>{label}</span>;
}

function LargestEconomySignal({ item, line }: { readonly item: BudgetComparedItem; readonly line?: OfficialLine }) {
  const description = line?.description.status === "Confirmed" ? line.description.text : "Descrição não informada";
  return (
    <div className={catalogStyles.decisionSignal}>
      <span>Maior economia na contratação</span>
      <strong>{description}</strong>
      <small>{line?.externalCode ?? "Item sem código"}</small>
      <div className={catalogStyles.decisionEconomics}>
        <div><small>Orçamento Oficial</small><strong>{formatNullableMoney(item.total.officialCents)}</strong></div>
        <div><small>Proposta Vencedora</small><strong>{formatNullableMoney(item.total.winnerCents)}</strong></div>
        <div><small>Economia na contratação</small><strong>{formatNullableMoney(item.total.differenceCents)}</strong></div>
      </div>
      <p>Este foi o item com maior redução absoluta de valor entre o Orçamento Oficial e a Proposta Vencedora.</p>
    </div>
  );
}

export function OfficialLineTree({ line, depth, childrenByParent, totalsByLine, comparisonByLineId = new Map(), visibleLineIds = new Set([line.id]), comparisonMode = false, filtering = false }: {
  readonly line: OfficialLine;
  readonly depth: number;
  readonly childrenByParent: ReadonlyMap<string | null, ReadonlyArray<OfficialLine>>;
  readonly totalsByLine: ReadonlyMap<string, number>;
  readonly comparisonByLineId?: ReadonlyMap<string, BudgetComparedItem>;
  readonly visibleLineIds?: ReadonlySet<string>;
  readonly comparisonMode?: boolean;
  readonly filtering?: boolean;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const children = (childrenByParent.get(line.id) ?? []).filter((child) => visibleLineIds.has(child.id));
  const isLeaf = line.kind === "ServiceItem";
  const isGroup = line.kind === "Group";
  const isSubgroup = line.kind === "Subgroup";
  const description = line.description.status === "Confirmed" ? line.description.text : "Descrição não informada";
  const totalValue = totalsByLine.get(line.id) ?? (line.totalCents ?? 0);
  const comparisonItem = comparisonByLineId.get(line.id) ?? null;
  const isExpanded = filtering ? true : expanded;
  const rowClass = isGroup ? `${catalogStyles.treeRow} ${catalogStyles.treeGroupRow}` : isSubgroup ? `${catalogStyles.treeRow} ${catalogStyles.treeSubgroupRow}` : `${catalogStyles.treeRow} ${catalogStyles.treeItemRow}`;

  return (
    <div className={`${catalogStyles.treeNode} ${isGroup ? catalogStyles.groupNode : ""}`} style={{ paddingLeft: comparisonMode && isLeaf ? undefined : `${Math.min(depth, 5) * 1.25}rem` }}>
      <div className={`${rowClass} ${comparisonMode && isLeaf ? catalogStyles.comparisonItemRow : ""}`}>
        <div className={catalogStyles.treeContent}>
          {!isLeaf && children.length > 0 ? (
            <button type="button" className={catalogStyles.treeToggle} aria-expanded={isExpanded} aria-label={`${isExpanded ? "Recolher" : "Expandir"} ${description}`} onClick={() => setExpanded((current) => !current)} disabled={filtering}>
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : <span className={catalogStyles.treeSpacer} />}
          <span className={isGroup ? catalogStyles.groupTitle : isSubgroup ? catalogStyles.subgroupTitle : catalogStyles.itemTitle}>
            {line.externalCode ? <strong className={catalogStyles.lineCode}>{line.externalCode}</strong> : null}{line.externalCode ? " — " : ""}<span className={catalogStyles.lineDescription}>{description}</span>
          </span>
          {comparisonMode && comparisonItem ? <StatusBadge classification={comparisonItem.classification} /> : null}
        </div>
        {comparisonMode && comparisonItem ? <ItemComparison item={comparisonItem} /> : (
          <strong className={isGroup ? catalogStyles.groupValue : isSubgroup ? catalogStyles.subgroupValue : catalogStyles.itemValue}>{formatCentsPtBr(totalValue)}</strong>
        )}
      </div>
      {isExpanded ? children.map((child) => (
        <OfficialLineTree key={child.id} line={child} depth={depth + 1} childrenByParent={childrenByParent} totalsByLine={totalsByLine} comparisonByLineId={comparisonByLineId} visibleLineIds={visibleLineIds} comparisonMode={comparisonMode} filtering={filtering} />
      )) : null}
    </div>
  );
}

function ItemComparison({ item }: { readonly item: BudgetComparedItem }) {
  const difference = item.total.differenceCents;
  const differenceLabel = item.classification === "Reduction"
    ? "Economia"
    : item.classification === "Increase" ? "Acréscimo" : "Diferença";
  return (
    <div className={catalogStyles.itemComparison}>
      <div className={catalogStyles.itemComparisonMetrics}>
        <ItemMetric label="Oficial" value={formatNullableMoney(item.total.officialCents)} />
        <ItemMetric label="Vencedora" value={formatNullableMoney(item.total.winnerCents)} strong />
        <ItemMetric label={differenceLabel} value={formatNullableMoney(difference === null ? null : Math.abs(difference))} />
        <ItemMetric label="Variação" value={formatBasisPoints(item.total.percentageBasisPoints)} />
      </div>
      <details className={catalogStyles.itemDetails}>
        <summary>Ver composição e rastreabilidade</summary>
        <div className={catalogStyles.itemDetailGrid}>
          <DetailBlock
            label="Quantidade"
            official={formatCanonicalQuantityPtBr(item.officialQuantity)}
            winner={formatCanonicalQuantityPtBr(item.proposalQuantity)}
            divergenceLabel={item.quantityDiffers ? "Quantidade diferente" : null}
            detail={item.quantityNormalizedForComparison ? "Representações equivalentes após normalização decimal canônica." : undefined}
          />
          <DetailBlock label="Unidade" official={formatDocumentUnitPtBr(item.officialUnit)} winner={formatDocumentUnitPtBr(item.proposalUnit)} divergenceLabel={item.unitDiffers ? "Unidade diferente" : null} />
          <DetailBlock label="Preço unitário" official={formatNullableMoney(item.unitPrice.officialCents)} winner={formatNullableMoney(item.unitPrice.winnerCents)} detail={`${item.unitPrice.differenceCents !== null && item.unitPrice.differenceCents < 0 ? "Acréscimo" : "Diferença"} ${formatNullableMoney(item.unitPrice.differenceCents === null ? null : Math.abs(item.unitPrice.differenceCents))} · ${formatBasisPoints(item.unitPrice.percentageBasisPoints)}`} />
          <div className={catalogStyles.traceBlock}><span>Correspondência</span><strong>{matchMethodLabel(item.matchMethod)}</strong><small>Validação determinística um-para-um</small></div>
        </div>
        {item.documentDivergences.length > 0 ? (
          <div className={catalogStyles.divergenceNote}>
            <strong>Divergência documental</strong>
            <ul aria-label="Natureza da divergência documental">
              {item.documentDivergences.map((kind) => <li key={kind}>{documentDivergenceLabel(kind)}</li>)}
            </ul>
            {item.unmatchedReason ? <p>{item.unmatchedReason}</p> : null}
          </div>
        ) : null}
      </details>
    </div>
  );
}

function ItemMetric({ label, value, strong = false }: { readonly label: string; readonly value: string; readonly strong?: boolean }) {
  return <div className={strong ? catalogStyles.itemMetricStrong : ""}><span>{label}</span><strong>{value}</strong></div>;
}

function DetailBlock({ label, official, winner, detail, divergenceLabel = null }: { readonly label: string; readonly official: string; readonly winner: string; readonly detail?: string; readonly divergenceLabel?: string | null }) {
  return <div className={catalogStyles.detailBlock}><span>{label}{divergenceLabel ? <em>{divergenceLabel}</em> : null}</span><small>Orçamento Oficial</small><strong>{official}</strong><small>Proposta Vencedora</small><strong>{winner}</strong>{detail ? <p>{detail}</p> : null}</div>;
}

function StatusBadge({ classification }: { readonly classification: BudgetComparisonClassification }) {
  const labels: Record<BudgetComparisonClassification, string> = { Reduction: "Redução", Increase: "Acréscimo", Equal: "Sem alteração", Divergence: "Divergência documental" };
  return <span className={`${catalogStyles.statusBadge} ${catalogStyles[classification.toLowerCase()]}`}>{labels[classification]}</span>;
}

function formatNullableMoney(value: number | null): string {
  return value === null ? "Não informado" : formatCentsPtBr(value);
}

function formatBasisPoints(value: number | null): string {
  if (value === null) return "Não aplicável";
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value) / 100)}%`;
}

function matchMethodLabel(method: BudgetComparedItem["matchMethod"]): string {
  if (method === "PersistedSourceLineId") return "Vínculo de origem persistido";
  if (method === "UniqueHierarchicalCode") return "Código hierárquico único";
  if (method === "UniqueDocumentPosition") return "Posição hierárquica única";
  if (method === "UniqueExternalCode") return "Código documental único";
  if (method === "UniqueDocumentEvidence") return "Evidência documental composta";
  return "Sem correspondência comprovada";
}

function documentDivergenceLabel(kind: BudgetDocumentDivergenceKind): string {
  if (kind === "Unit") return "Unidade diferente";
  if (kind === "Quantity") return "Quantidade diferente";
  if (kind === "Description") return "Descrição diferente";
  if (kind === "Code") return "Código diferente";
  return "Correspondência não comprovada";
}
