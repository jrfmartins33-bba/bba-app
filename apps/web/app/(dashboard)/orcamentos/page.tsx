"use client";

import { useEffect, useState } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import { BudgetEmptyState } from "@/components/budget/budget-empty-state";

// Epic 21.5A — /orcamentos deixa de ser sempre vazio (enunciado §43):
// quando existe uma BudgetVersion Consolidated acessível à organização
// do usuário autenticado, mostra o orçamento real; senão, mantém o
// estado vazio existente. Human-first (enunciado §44/§45): nenhum campo
// técnico (fingerprint, grammarId, evidence, engineVersion) aparece
// aqui — só o que a fonte documental realmente contém.

interface BudgetLine {
  readonly id: string;
  readonly kind: "Group" | "Subgroup" | "ServiceItem";
  readonly description: { readonly status: "Confirmed"; readonly text: string } | { readonly status: "AbsentFromSource" };
  readonly externalCode: string | null;
  readonly parentLineId: string | null;
  readonly position: number;
  readonly totalCents: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

interface BudgetVersionDto {
  readonly id: string;
  readonly status: "Draft" | "Consolidated";
  readonly lines: ReadonlyArray<BudgetLine>;
}

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calculateTotal(lines: ReadonlyArray<BudgetLine>, lineId: string): number {
  const line = lines.find((l) => l.id === lineId);
  if (!line) return 0;
  if (line.kind === "ServiceItem") return line.totalCents ?? 0;
  return lines.filter((l) => l.parentLineId === lineId).reduce((sum, child) => sum + calculateTotal(lines, child.id), 0);
}

function orderedChildren(lines: ReadonlyArray<BudgetLine>, parentId: string | null): ReadonlyArray<BudgetLine> {
  return lines.filter((l) => l.parentLineId === parentId).slice().sort((a, b) => a.position - b.position);
}

function lineText(line: BudgetLine): string {
  return line.description.status === "Confirmed" ? line.description.text : "—";
}

export default function OrcamentosPage() {
  const [budgetVersion, setBudgetVersion] = useState<BudgetVersionDto | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/orcamentos/consolidado")
      .then((res) => (res.ok ? res.json() : { budgetVersion: null }))
      .then((data) => setBudgetVersion(data.budgetVersion))
      .catch(() => setBudgetVersion(null));
  }, []);

  if (budgetVersion === undefined) {
    return (
      <>
        <BudgetPageHeader isDemonstration={false} />
        <section className="section-grid">
          <p>Carregando...</p>
        </section>
      </>
    );
  }

  if (budgetVersion === null) {
    return (
      <>
        <BudgetPageHeader isDemonstration={false} />
        <section className="section-grid">
          <BudgetEmptyState />
        </section>
      </>
    );
  }

  const lotGroups = orderedChildren(budgetVersion.lines, null).filter(
    (line) => typeof line.metadata.lotReference === "string",
  );
  const lotesByReference = new Map<string, BudgetLine[]>();
  lotGroups.forEach((line) => {
    const lot = String(line.metadata.lotReference);
    const list = lotesByReference.get(lot) ?? [];
    list.push(line);
    lotesByReference.set(lot, list);
  });

  const totalGeral = Array.from(lotesByReference.values())
    .flat()
    .reduce((sum, line) => sum + calculateTotal(budgetVersion.lines, line.id), 0);

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className="section-grid" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="bba-card">
          <h2>Orçamento Oficial Revisado</h2>
          <p style={{ color: "#666" }}>
            Representação estruturada do orçamento publicado pelo órgão, conferida no BBA.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>Origem</div>
              <div>DNOCS</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>Estado</div>
              <div>{budgetVersion.status === "Consolidated" ? "Revisado e consolidado" : "Em revisão"}</div>
            </div>
            {Array.from(lotesByReference.entries()).map(([lot, groups]) => (
              <div key={lot}>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>{lot}</div>
                <div style={{ fontWeight: 700 }}>
                  {centsToBRL(groups.reduce((sum, line) => sum + calculateTotal(budgetVersion.lines, line.id), 0))}
                </div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>Total geral</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{centsToBRL(totalGeral)}</div>
            </div>
          </div>
        </div>

        {Array.from(lotesByReference.entries()).map(([lot, groups]) => (
          <div className="bba-card" key={lot}>
            <h3>{lot}</h3>
            {groups
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((group) => (
                <BudgetLineTree key={group.id} lines={budgetVersion.lines} line={group} depth={0} />
              ))}
          </div>
        ))}
      </section>
    </>
  );
}

function BudgetLineTree({ lines, line, depth }: { lines: ReadonlyArray<BudgetLine>; line: BudgetLine; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const children = orderedChildren(lines, line.id);
  const total = calculateTotal(lines, line.id);
  const isLeaf = line.kind === "ServiceItem";

  return (
    <div style={{ marginLeft: `${depth * 1.25}rem`, borderBottom: depth === 0 ? "1px solid #eee" : undefined, padding: "0.35rem 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {!isLeaf && children.length > 0 && (
            <button onClick={() => setExpanded((v) => !v)} style={{ border: "none", background: "none", cursor: "pointer" }}>
              {expanded ? "▾" : "▸"}
            </button>
          )}
          <span style={{ fontWeight: line.kind !== "ServiceItem" ? 700 : 400 }}>
            {line.externalCode ? `${line.externalCode} — ` : ""}
            {lineText(line)}
          </span>
        </div>
        <span style={{ fontWeight: line.kind !== "ServiceItem" ? 700 : 400 }}>{centsToBRL(total)}</span>
      </div>
      {expanded && children.map((child) => <BudgetLineTree key={child.id} lines={lines} line={child} depth={depth + 1} />)}
    </div>
  );
}
