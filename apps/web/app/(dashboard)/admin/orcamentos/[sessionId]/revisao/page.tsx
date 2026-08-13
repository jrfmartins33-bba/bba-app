"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Button } from "@bba/ui";
import { formatBudgetMoneyPtBr } from "@/lib/bdos/format-budget-money";

// Revisão do Orçamento Oficial (Epic 21.5A / Sprint 21.5C.2B UX) — experiência Admin dedicada.

interface RowFields {
  readonly itemCode: string | null;
  readonly description: string | null;
  readonly sourceCode: string | null;
  readonly sourceFonte: string | null;
  readonly sourceTipo: string | null;
  readonly unit: string | null;
  readonly quantityText: string | null;
  readonly unitCostWithoutBdiText: string | null;
  readonly bdiPercentText: string | null;
  readonly unitPriceWithBdiText: string | null;
  readonly totalPriceText: string | null;
  readonly colFgvDnit: string | null;
  readonly documentalGroupTotalText: string | null;
}

interface ReconciliationDecision {
  readonly status: "AcceptedAsDocumented";
  readonly actor: string;
  readonly justification: string;
  readonly decidedAt: string;
}

interface ReviewRow {
  readonly id: string;
  readonly kind: "Group" | "Subgroup" | "ServiceItem";
  readonly lotReference: string;
  readonly parentRowId: string | null;
  readonly position: number;
  readonly state: "Pendente" | "Confirmado" | "Corrigido" | "NaoPertenceAoOrcamento" | "InseridoManualmente";
  readonly extracted: RowFields | null;
  readonly revised: RowFields;
  readonly page: number | null;
  readonly evidenceText: string | null;
  readonly justification: string | null;
  readonly insertedManually: boolean;
  readonly reconciliationDecision: ReconciliationDecision | null;
}

interface ReviewSession {
  readonly id: string;
  readonly status: "InProgress" | "Consolidated";
  readonly rows: ReadonlyArray<ReviewRow>;
}

interface Reconciliation {
  readonly serviceItems: ReadonlyArray<{ rowId: string; status: string; differenceCents: number | null }>;
  readonly groups: ReadonlyArray<{ rowId: string; status: string; differenceCents: number | null }>;
  readonly readiness: { ready: boolean; blockers: ReadonlyArray<string>; pendingRowCount: number; divergentReconciliationCount: number };
}

const STATE_LABELS: Record<ReviewRow["state"], string> = {
  Pendente: "Pendente",
  Confirmado: "Confirmado",
  Corrigido: "Corrigido",
  NaoPertenceAoOrcamento: "Não pertence ao orçamento",
  InseridoManualmente: "Inserido manualmente",
};

interface StateBadgeStyle {
  readonly bg: string;
  readonly border: string;
  readonly text: string;
  readonly dot: string;
}

const STATE_BADGE_STYLES: Record<ReviewRow["state"], StateBadgeStyle> = {
  Pendente: {
    bg: "rgba(245, 158, 11, 0.15)",
    border: "1px solid #f59e0b",
    text: "#fcd34d",
    dot: "#fbbf24",
  },
  Confirmado: {
    bg: "rgba(16, 185, 129, 0.15)",
    border: "1px solid #10b981",
    text: "#6ee7b7",
    dot: "#34d399",
  },
  Corrigido: {
    bg: "rgba(59, 130, 246, 0.15)",
    border: "1px solid #3b82f6",
    text: "#93c5fd",
    dot: "#60a5fa",
  },
  NaoPertenceAoOrcamento: {
    bg: "rgba(239, 68, 68, 0.15)",
    border: "1px solid #ef4444",
    text: "#fca5a5",
    dot: "#f87171",
  },
  InseridoManualmente: {
    bg: "rgba(168, 85, 247, 0.15)",
    border: "1px solid #a855f7",
    text: "#d8b4fe",
    dot: "#c084fc",
  },
};

function StateBadge({ state }: { state: ReviewRow["state"] }) {
  const style = STATE_BADGE_STYLES[state];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.2rem 0.55rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: style.bg,
        border: style.border,
        color: style.text,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: style.dot }} />
      {STATE_LABELS[state]}
    </span>
  );
}

const PAGE_SIZE = 50;

interface ReviewContext {
  readonly procurementCaseTitle: string;
  readonly procurementCaseReference: string | null;
  readonly procurementLotTitle: string;
}

export default function OrcamentoRevisaoPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [filterState, setFilterState] = useState<string>("all");
  const [filterLote, setFilterLote] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orcamentos/revisao/${sessionId}`);
      if (!res.ok) {
        setError(res.status === 403 ? "Acesso restrito ao Admin BBA." : "Sessão de Revisão não encontrada.");
        setSession(null);
        setReviewContext(null);
        return;
      }
      const data = await res.json();
      setSession(data.session);
      setReconciliation(data.reconciliation);
      setReviewContext(data.context ?? null);
    } catch {
      setError("Não foi possível carregar a Sessão de Revisão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionId) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const reconciliationByRowId = useMemo(() => {
    const map = new Map<string, string>();
    reconciliation?.serviceItems.forEach((r) => map.set(r.rowId, r.status));
    reconciliation?.groups.forEach((r) => map.set(r.rowId, r.status));
    return map;
  }, [reconciliation]);

  const lotes = useMemo(() => {
    if (!session) return [];
    return Array.from(new Set(session.rows.map((row) => row.lotReference))).sort();
  }, [session]);

  const filteredRows = useMemo(() => {
    if (!session) return [];
    const term = search.trim().toLowerCase();
    return session.rows.filter((row) => {
      if (filterState !== "all") {
        if (filterState === "divergent") {
          if (reconciliationByRowId.get(row.id) !== "diverges") return false;
        } else if (row.state !== filterState) {
          return false;
        }
      }
      if (filterLote !== "all" && row.lotReference !== filterLote) return false;
      if (term.length > 0) {
        const haystack = `${row.revised.itemCode ?? ""} ${row.revised.description ?? ""} ${row.revised.sourceCode ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [session, filterState, filterLote, search, reconciliationByRowId]);

  // Eligible rows for bulk selection in current filter scope
  const eligibleFilteredRows = useMemo(() => {
    return filteredRows.filter((row) => {
      const rec = reconciliationByRowId.get(row.id);
      const isPending = row.state === "Pendente";
      const isDivergent = rec === "diverges" && row.reconciliationDecision === null;
      return isPending || isDivergent;
    });
  }, [filteredRows, reconciliationByRowId]);

  const allEligibleSelected = useMemo(() => {
    if (eligibleFilteredRows.length === 0) return false;
    return eligibleFilteredRows.every((r) => selected.has(r.id));
  }, [eligibleFilteredRows, selected]);

  const someEligibleSelected = useMemo(() => {
    if (eligibleFilteredRows.length === 0) return false;
    return eligibleFilteredRows.some((r) => selected.has(r.id));
  }, [eligibleFilteredRows, selected]);

  // Derived counts for actionable buttons
  const pendingSelectedCount = useMemo(() => {
    if (!session) return 0;
    return Array.from(selected).filter((id) => session.rows.find((r) => r.id === id)?.state === "Pendente").length;
  }, [session, selected]);

  const divergentSelectedCount = useMemo(() => {
    if (!session) return 0;
    return Array.from(selected).filter((id) => {
      const r = session.rows.find((candidate) => candidate.id === id);
      return r !== undefined && r.reconciliationDecision === null && reconciliationByRowId.get(id) === "diverges";
    }).length;
  }, [session, selected, reconciliationByRowId]);

  function handleSelectAllFilteredToggle() {
    if (allEligibleSelected) {
      setSelected(new Set());
    } else {
      const next = new Set(selected);
      eligibleFilteredRows.forEach((r) => next.add(r.id));
      setSelected(next);
    }
  }

  function handleClearSelection() {
    setSelected(new Set());
  }

  // Clear selection on filter changes to prevent accidental bulk actions on invisible rows
  function handleFilterStateChange(newState: string) {
    setFilterState(newState);
    setPage(0);
    setSelected(new Set());
  }

  function handleFilterLoteChange(newLote: string) {
    setFilterLote(newLote);
    setPage(0);
    setSelected(new Set());
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch);
    setPage(0);
    setSelected(new Set());
  }

  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  async function callAction(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/orcamentos/revisao/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        window.alert(`Ação não concluída: ${payload.error ?? res.status}`);
        return false;
      }
      await reload();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(rowId: string) {
    await callAction({ action: "confirm", rowId });
  }

  async function handleExclude(rowId: string) {
    const justification = window.prompt("Justificativa para marcar como 'Não pertence ao orçamento':");
    if (!justification) return;
    await callAction({ action: "exclude", rowId, justification });
  }

  async function handleRestore(rowId: string) {
    await callAction({ action: "restore", rowId });
  }

  async function handleBulkConfirmSelection() {
    if (!session) return;
    const rowIds = Array.from(selected).filter((id) => session.rows.find((row) => row.id === id)?.state === "Pendente");
    if (rowIds.length === 0) {
      window.alert("Nenhuma linha selecionada está Pendente.");
      return;
    }
    if (!window.confirm(`Confirmar ${rowIds.length} linha(s) selecionada(s)?`)) return;
    const ok = await callAction({ action: "bulkConfirm", rowIds });
    if (ok) setSelected(new Set());
  }

  async function handleAcceptDivergence(rowId: string) {
    const justification = window.prompt(
      "Justificativa (os valores foram conferidos na fonte e serão preservados exatamente como publicados):",
    );
    if (!justification) return;
    await callAction({ action: "acceptDivergence", rowId, justification });
  }

  async function handleBulkAcceptDivergencesSelection() {
    if (!session) return;
    const rowIds = Array.from(selected).filter((id) => {
      const row = session.rows.find((candidate) => candidate.id === id);
      return row !== undefined && row.reconciliationDecision === null && reconciliationByRowId.get(id) === "diverges";
    });
    if (rowIds.length === 0) {
      window.alert("Nenhuma linha selecionada tem divergência ativa não aceita.");
      return;
    }
    const justification = window.prompt(
      `${rowIds.length} divergência(s) serão aceitas exatamente como documentadas. Justificativa:`,
    );
    if (!justification) return;
    const ok = await callAction({ action: "bulkAcceptDivergences", rowIds, justification });
    if (ok) setSelected(new Set());
  }

  async function handleConsolidate() {
    if (!window.confirm("Consolidar o Orçamento Oficial Revisado? Esta ação é irreversível.")) return;
    await callAction({ action: "consolidate" });
  }

  if (loading) {
    return (
      <section className="page-header">
        <div>
          <h1>Revisão do Orçamento Oficial</h1>
          <p>Carregando...</p>
        </div>
      </section>
    );
  }

  if (error || !session) {
    return (
      <section className="page-header">
        <div>
          <h1>Revisão do Orçamento Oficial</h1>
          <p>{error ?? "Sessão não encontrada."}</p>
        </div>
      </section>
    );
  }

  const totalRows = session.rows.length;
  const confirmedCount = session.rows.filter((r) => r.state === "Confirmado" || r.state === "Corrigido").length;
  const pendingCount = session.rows.filter((r) => r.state === "Pendente").length;
  const correctedCount = session.rows.filter((r) => r.state === "Corrigido").length;
  const notBudgetCount = session.rows.filter((r) => r.state === "NaoPertenceAoOrcamento").length;

  const thStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#111827",
    color: "#f3f4f6",
    padding: "0.6rem 0.5rem",
    borderBottom: "2px solid #374151",
    boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section className="page-header">
        <div>
          <h1>Revisão do Orçamento Oficial</h1>
          <p>
            {reviewContext
              ? `${reviewContext.procurementCaseTitle}${reviewContext.procurementLotTitle ? ` — ${reviewContext.procurementLotTitle}` : ""}`
              : "Documento oficial"}
          </p>
        </div>
      </section>

      <Card title="Resumo">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
          <Stat label="Estado" value={session.status === "Consolidated" ? "Revisado e consolidado" : "Em revisão"} />
          <Stat label="Lotes" value={String(lotes.length)} />
          <Stat label="Linhas" value={String(totalRows)} />
          <Stat label="Revisadas" value={`${confirmedCount} / ${totalRows}`} />
          <Stat label="Pendentes" value={String(pendingCount)} />
          <Stat label="Corrigidas" value={String(correctedCount)} />
          <Stat label="Não pertencem" value={String(notBudgetCount)} />
        </div>
        {reconciliation && (
          <div style={{ marginTop: "1rem" }}>
            {reconciliation.readiness.ready ? (
              <p style={{ color: "#0a7a3d" }}>Pronto para consolidação.</p>
            ) : (
              <div>
                <p style={{ color: "#8a2e2e", fontWeight: 600 }}>Pendências para consolidação:</p>
                <ul>
                  {reconciliation.readiness.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button disabled={!reconciliation.readiness.ready || busy || session.status === "Consolidated"} onClick={handleConsolidate}>
              {session.status === "Consolidated" ? "Já consolidado" : "Consolidar Orçamento Oficial Revisado"}
            </Button>
          </div>
        )}
      </Card>

      <Card title="Filtros">
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterState} onChange={(e) => handleFilterStateChange(e.target.value)}>
            <option value="all">Todos os estados</option>
            <option value="Pendente">Pendente</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Corrigido">Corrigido</option>
            <option value="NaoPertenceAoOrcamento">Não pertence ao orçamento</option>
            <option value="InseridoManualmente">Inserido manualmente</option>
            <option value="divergent">Somente com divergência de reconciliação</option>
          </select>
          <select value={filterLote} onChange={(e) => handleFilterLoteChange(e.target.value)}>
            <option value="all">Todos os lotes</option>
            {lotes.map((lote) => (
              <option key={lote} value={lote}>{lote}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Buscar por item, código ou descrição"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ minWidth: "260px" }}
          />
          <span style={{ fontWeight: 500 }}>{filteredRows.length} linha(s) encontrada(s)</span>

          {eligibleFilteredRows.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={allEligibleSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someEligibleSelected && !allEligibleSelected;
                  }}
                  onChange={handleSelectAllFilteredToggle}
                />
                Selecionar todos os resultados filtrados ({eligibleFilteredRows.length})
              </label>
              {selected.size > 0 && (
                <Button variant="secondary" onClick={handleClearSelection}>
                  Limpar seleção ({selected.size})
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Linhas do Orçamento"
        action={
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Button disabled={pendingSelectedCount === 0 || busy} onClick={handleBulkConfirmSelection}>
              Confirmar selecionadas ({pendingSelectedCount})
            </Button>
            <Button disabled={divergentSelectedCount === 0 || busy} onClick={handleBulkAcceptDivergencesSelection}>
              Aceitar divergências selecionadas ({divergentSelectedCount})
            </Button>
          </div>
        }
      >
        <div style={{ overflowX: "auto", position: "relative" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ ...thStyle, width: "32px" }}></th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Lote</th>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Descrição</th>
                <th style={thStyle}>Unid.</th>
                <th style={thStyle}>Quant.</th>
                <th style={thStyle}>Custo unit. (R$)</th>
                <th style={thStyle}>BDI</th>
                <th style={thStyle}>Preço unit. (R$)</th>
                <th style={thStyle}>Total (R$)</th>
                <th style={thStyle}>Pág.</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const rec = reconciliationByRowId.get(row.id);
                return (
                  <Fragment key={row.id}>
                    <tr style={{ borderBottom: "1px solid #1f2937" }}>
                      <td style={{ padding: "0.5rem" }}>
                        {(row.state === "Pendente" || (rec === "diverges" && row.reconciliationDecision === null)) && (
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={(e) => {
                              const next = new Set(selected);
                              if (e.target.checked) next.add(row.id);
                              else next.delete(row.id);
                              setSelected(next);
                            }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                          <StateBadge state={row.state} />
                          {rec === "diverges" && row.reconciliationDecision === null && (
                            <span style={{ color: "#ef4444", fontWeight: 700, marginLeft: "0.2rem" }} title="Divergência de reconciliação não resolvida">⚠</span>
                          )}
                          {rec === "diverges" && row.reconciliationDecision !== null && (
                            <span style={{ color: "#10b981", fontWeight: 700, marginLeft: "0.2rem" }} title="Divergência aceita como documentada">✓</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "0.5rem" }}>{row.lotReference}</td>
                      <td style={{ padding: "0.5rem" }}>{row.revised.itemCode ?? "—"}</td>
                      <td style={{ padding: "0.5rem", fontWeight: row.kind !== "ServiceItem" ? 700 : 400, maxWidth: "320px" }}>{row.revised.description ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{row.revised.unit ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{row.revised.quantityText ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{formatBudgetMoneyPtBr(row.revised.unitCostWithoutBdiText)}</td>
                      <td style={{ padding: "0.5rem" }}>{row.revised.bdiPercentText ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{formatBudgetMoneyPtBr(row.revised.unitPriceWithBdiText)}</td>
                      <td style={{ padding: "0.5rem" }}>{formatBudgetMoneyPtBr(row.revised.totalPriceText ?? row.revised.documentalGroupTotalText)}</td>
                      <td style={{ padding: "0.5rem" }}>{row.page ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>
                        <button onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}>
                          {expandedRowId === row.id ? "Fechar" : "Ver"}
                        </button>
                      </td>
                    </tr>
                    {expandedRowId === row.id && (
                      <tr>
                        <td colSpan={13} style={{ background: "#1f2937", padding: "1rem" }}>
                          <RowDetail
                            row={row}
                            reconciliationStatus={rec}
                            onConfirm={() => handleConfirm(row.id)}
                            onExclude={() => handleExclude(row.id)}
                            onRestore={() => handleRestore(row.id)}
                            onAcceptDivergence={() => handleAcceptDivergence(row.id)}
                            busy={busy}
                            sessionInProgress={session.status === "InProgress"}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button disabled={page === 0} onClick={() => setPage(0)}>
              ⏮ Primeira página
            </Button>
            <Button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Anterior
            </Button>
          </div>
          <span style={{ fontWeight: 600 }}>Página {page + 1} de {totalPages}</span>
          <Button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
            Próxima
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function RowDetail({
  row,
  reconciliationStatus,
  onConfirm,
  onExclude,
  onRestore,
  onAcceptDivergence,
  busy,
  sessionInProgress,
}: {
  row: ReviewRow;
  reconciliationStatus: string | undefined;
  onConfirm: () => void;
  onExclude: () => void;
  onRestore: () => void;
  onAcceptDivergence: () => void;
  busy: boolean;
  sessionInProgress: boolean;
}) {
  const hasUnresolvedDivergence = reconciliationStatus === "diverges" && row.reconciliationDecision === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <strong>Valor extraído (imutável)</strong>
          {row.extracted ? <FieldsTable fields={row.extracted} /> : <p>Linha inserida manualmente — sem valor extraído original.</p>}
        </div>
        <div>
          <strong>Valor revisado (atual)</strong>
          <FieldsTable fields={row.revised} />
        </div>
      </div>
      {reconciliationStatus === "diverges" && (
        <div style={{ background: row.reconciliationDecision ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", padding: "0.75rem", borderRadius: "4px" }}>
          <strong>Divergência de reconciliação</strong>
          {row.reconciliationDecision ? (
            <p>
              Aceita como documentada por {row.reconciliationDecision.actor} em {new Date(row.reconciliationDecision.decidedAt).toLocaleString("pt-BR")}: “{row.reconciliationDecision.justification}”. Os valores foram preservados exatamente como publicados.
            </p>
          ) : (
            <p>O total derivado não bate com o total documental — confira contra a fonte antes de confirmar, ou aceite a divergência se os três valores estiverem corretamente transcritos.</p>
          )}
        </div>
      )}
      {row.evidenceText && (
        <div>
          <strong>Evidência (texto de origem)</strong>
          <p style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{row.evidenceText}</p>
        </div>
      )}
      {row.justification && (
        <div>
          <strong>Justificativa</strong>
          <p>{row.justification}</p>
        </div>
      )}
      {row.page && <p>Página fonte: {row.page}</p>}
      {sessionInProgress && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {row.state === "Pendente" && (
            <Button disabled={busy} onClick={onConfirm}>Confirmar</Button>
          )}
          {row.state !== "NaoPertenceAoOrcamento" && (
            <Button disabled={busy} onClick={onExclude}>Marcar como não pertencente ao orçamento</Button>
          )}
          {row.state === "NaoPertenceAoOrcamento" && (
            <Button disabled={busy} onClick={onRestore}>Restaurar</Button>
          )}
          {hasUnresolvedDivergence && (
            <Button disabled={busy} onClick={onAcceptDivergence}>Aceitar divergência documental</Button>
          )}
        </div>
      )}
    </div>
  );
}

function FieldsTable({ fields }: { fields: RowFields }) {
  const entries: Array<[string, string | null]> = [
    ["Código", fields.sourceCode],
    ["Fonte", fields.sourceFonte],
    ["Tipo", fields.sourceTipo],
    ["Unidade", fields.unit],
    ["Quantidade", fields.quantityText],
    ["Custo unit. s/BDI", formatBudgetMoneyPtBr(fields.unitCostWithoutBdiText)],
    ["BDI", fields.bdiPercentText],
    ["Preço unit. c/BDI", formatBudgetMoneyPtBr(fields.unitPriceWithBdiText)],
    ["Total", formatBudgetMoneyPtBr(fields.totalPriceText)],
    ["Total documental (grupo)", formatBudgetMoneyPtBr(fields.documentalGroupTotalText)],
    ["Col. FGV-DNIT", fields.colFgvDnit],
  ];
  return (
    <table style={{ fontSize: "0.8rem" }}>
      <tbody>
        {entries.map(([label, value]) => (
          <tr key={label}>
            <td style={{ color: "#9ca3af", paddingRight: "0.5rem" }}>{label}</td>
            <td>{value ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
