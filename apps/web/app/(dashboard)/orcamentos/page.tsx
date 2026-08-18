"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import { BudgetEmptyState } from "@/components/budget/budget-empty-state";
import scenarioStyles from "@/components/budget/proposal-scenarios.module.css";
import { formatBasisPointsPtBr, formatCentsPtBr, type ProposalScenarioDto } from "@/lib/proposal-scenarios";

// Epic 21.5A — /orcamentos deixa de ser sempre vazio (enunciado §43):
// Quando existe um orçamento oficial consolidado acessível à organização
// do usuário autenticado, mostra o retrato real; senão, mantém o estado
// vazio. A tela exibe somente informação documental útil ao cliente.

interface OfficialLine {
  readonly id: string;
  readonly kind: "Group" | "Subgroup" | "ServiceItem";
  readonly description: { readonly status: "Confirmed"; readonly text: string } | { readonly status: "AbsentFromSource" };
  readonly externalCode: string | null;
  readonly parentLineId: string | null;
  readonly position: number;
  readonly totalCents: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

interface OfficialBudgetDto {
  readonly id: string;
  readonly status: "Draft" | "Consolidated";
  readonly lines: ReadonlyArray<OfficialLine>;
}

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calculateTotal(lines: ReadonlyArray<OfficialLine>, lineId: string): number {
  const line = lines.find((l) => l.id === lineId);
  if (!line) return 0;
  if (line.kind === "ServiceItem") return line.totalCents ?? 0;
  return lines.filter((l) => l.parentLineId === lineId).reduce((sum, child) => sum + calculateTotal(lines, child.id), 0);
}

function orderedChildren(lines: ReadonlyArray<OfficialLine>, parentId: string | null): ReadonlyArray<OfficialLine> {
  return lines.filter((l) => l.parentLineId === parentId).slice().sort((a, b) => a.position - b.position);
}

function lineText(line: OfficialLine): string {
  return line.description.status === "Confirmed" ? line.description.text : "—";
}

export default function OrcamentosPage() {
  const [officialBudget, setOfficialBudget] = useState<OfficialBudgetDto | null | undefined>(undefined);
  const [scenarios, setScenarios] = useState<ReadonlyArray<ProposalScenarioDto> | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/orcamentos/consolidado", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { budget: null }))
      .then((data) => setOfficialBudget(data.budget))
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setOfficialBudget(null);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/orcamentos/cenarios", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { scenarios: [] })
      .then((data: { scenarios: ReadonlyArray<ProposalScenarioDto> }) => setScenarios(data.scenarios))
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setScenarios([]);
      });
    return () => controller.abort();
  }, []);

  if (officialBudget === undefined) {
    return (
      <>
        <BudgetPageHeader isDemonstration={false} />
        <section className="section-grid">
          <p>Carregando...</p>
        </section>
      </>
    );
  }

  if (officialBudget === null) {
    return (
      <>
        <BudgetPageHeader isDemonstration={false} />
        <section className="section-grid">
          <BudgetEmptyState />
        </section>
      </>
    );
  }

  const lotGroups = orderedChildren(officialBudget.lines, null).filter(
    (line) => typeof line.metadata.lotReference === "string",
  );
  const lotesByReference = new Map<string, OfficialLine[]>();
  lotGroups.forEach((line) => {
    const lot = String(line.metadata.lotReference);
    const list = lotesByReference.get(lot) ?? [];
    list.push(line);
    lotesByReference.set(lot, list);
  });

  const totalGeral = Array.from(lotesByReference.values())
    .flat()
    .reduce((sum, line) => sum + calculateTotal(officialBudget.lines, line.id), 0);
  const currentScenarios = (scenarios ?? []).filter((scenario) => scenario.sourceBudgetId === officialBudget.id);

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className="section-grid" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="bba-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2>Orçamento Oficial Revisado</h2>
              <p style={{ color: "#666" }}>
                Representação estruturada do orçamento publicado pelo órgão, conferida no BBA.
              </p>
            </div>
            <Link href="/orcamentos/importar" className="bba-button bba-button--secondary bba-button--sm">
              Importar outro orçamento
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>Origem</div>
              <div>Documento oficial</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>Estado</div>
              <div>{officialBudget.status === "Consolidated" ? "Revisado e consolidado" : "Em revisão"}</div>
            </div>
            {Array.from(lotesByReference.entries()).map(([lot, groups]) => (
              <div key={lot}>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>{lot}</div>
                <div style={{ fontWeight: 700 }}>
                  {centsToBRL(groups.reduce((sum, line) => sum + calculateTotal(officialBudget.lines, line.id), 0))}
                </div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>Total geral</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{centsToBRL(totalGeral)}</div>
            </div>
          </div>
        </div>

        <div className="bba-card">
          <div className={scenarioStyles.sectionTitle}>
            <div>
              <p className={scenarioStyles.eyebrow}>Decisão de preço</p>
              <h2>Cenários de Proposta</h2>
              <p>Compare valores comerciais preservando o orçamento oficial.</p>
            </div>
            <div className={scenarioStyles.actions}>
              {currentScenarios.length > 0 ? <Link href="/orcamentos/cenarios/comparar" className={scenarioStyles.secondary}>Comparar cenários</Link> : null}
              <Link href={`/orcamentos/cenarios/novo?orcamento=${officialBudget.id}`} className={scenarioStyles.primary}>Criar cenário</Link>
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            {scenarios === undefined ? <p style={{ color: "#68746f" }}>Carregando cenários…</p> : null}
            {scenarios && currentScenarios.length === 0 ? (
              <div className={scenarioStyles.notice}><strong>Nenhum cenário criado</strong>O primeiro cenário registra um valor de proposta sem alterar o orçamento oficial.</div>
            ) : null}
            {currentScenarios.length > 0 ? (
              <div className={scenarioStyles.list}>
                {currentScenarios.map((scenario) => (
                  <div className={scenarioStyles.listItem} key={scenario.id}>
                    <div>
                      <h3>{scenario.name}</h3>
                      <div className={scenarioStyles.listMeta}>
                        <strong>{formatCentsPtBr(scenario.targetValueCents)}</strong>
                        <span>{formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}</span>
                        <span>Criado em {new Date(scenario.createdAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className={scenarioStyles.listActions}>
                      <Link href={`/orcamentos/cenarios/${scenario.id}`} className={scenarioStyles.secondary}>Abrir</Link>
                      <Link href={`/orcamentos/cenarios/novo?orcamento=${officialBudget.id}&duplicar=${scenario.id}`} className={scenarioStyles.secondary}>Duplicar</Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {Array.from(lotesByReference.entries()).map(([lot, groups]) => (
          <div className="bba-card" key={lot}>
            <h3>{lot}</h3>
            {groups
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((group) => (
                <OfficialLineTree key={group.id} lines={officialBudget.lines} line={group} depth={0} />
              ))}
          </div>
        ))}
      </section>
    </>
  );
}

function OfficialLineTree({ lines, line, depth }: { lines: ReadonlyArray<OfficialLine>; line: OfficialLine; depth: number }) {
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
      {expanded && children.map((child) => <OfficialLineTree key={child.id} lines={lines} line={child} depth={depth + 1} />)}
    </div>
  );
}
