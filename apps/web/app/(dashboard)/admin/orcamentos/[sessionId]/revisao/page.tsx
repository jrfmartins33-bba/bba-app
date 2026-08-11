"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Button } from "@bba/ui";

// Revisão do Orçamento Oficial (Epic 21.5A) — experiência Admin dedicada
// (enunciado §26). Cliente nunca acessa esta rota (gate em
// app/(dashboard)/admin/layout.tsx + RLS admin-only nas tabelas). Não
// expõe fingerprint/grammarId/evidence IDs na primeira dobra (enunciado
// §27) — diagnóstico técnico fica em painel sob demanda por linha.

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

const STATE_COLORS: Record<ReviewRow["state"], string> = {
  Pendente: "#9a7b00",
  Confirmado: "#0a7a3d",
  Corrigido: "#0a5ea8",
  NaoPertenceAoOrcamento: "#8a2e2e",
  InseridoManualmente: "#6a3d9a",
};

const PAGE_SIZE = 50;

export default function OrcamentoRevisaoPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
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
        return;
      }
      const data = await res.json();
      setSession(data.session);
      setReconciliation(data.reconciliation);
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
    if (selected.size === 0) return;
    if (!window.confirm(`Confirmar ${selected.size} linha(s) selecionada(s)?`)) return;
    const ok = await callAction({ action: "bulkConfirm", rowIds: Array.from(selected) });
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section className="page-header">
        <div>
          <h1>Revisão do Orçamento Oficial</h1>
          <p>Recuperação das Barragens de Alagoas — origem: documento oficial DNOCS</p>
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
          <select value={filterState} onChange={(e) => { setFilterState(e.target.value); setPage(0); }}>
            <option value="all">Todos os estados</option>
            <option value="Pendente">Pendente</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Corrigido">Corrigido</option>
            <option value="NaoPertenceAoOrcamento">Não pertence ao orçamento</option>
            <option value="InseridoManualmente">Inserido manualmente</option>
            <option value="divergent">Somente com divergência de reconciliação</option>
          </select>
          <select value={filterLote} onChange={(e) => { setFilterLote(e.target.value); setPage(0); }}>
            <option value="all">Todos os lotes</option>
            {lotes.map((lote) => (
              <option key={lote} value={lote}>{lote}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Buscar por item, código ou descrição"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            style={{ minWidth: "260px" }}
          />
          <span>{filteredRows.length} linha(s)</span>
        </div>
      </Card>

      <Card
        title="Linhas do Orçamento"
        action={
          <Button disabled={selected.size === 0 || busy} onClick={handleBulkConfirmSelection}>
            Confirmar seleção ({selected.size})
          </Button>
        }
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th></th>
                <th>Estado</th>
                <th>Lote</th>
                <th>Item</th>
                <th>Descrição</th>
                <th>Unid.</th>
                <th>Quant.</th>
                <th>Custo unit.</th>
                <th>BDI</th>
                <th>Preço unit.</th>
                <th>Total</th>
                <th>Pág.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const rec = reconciliationByRowId.get(row.id);
                return (
                  <Fragment key={row.id}>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td>
                        {row.state === "Pendente" && (
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
                      <td>
                        <span style={{ color: STATE_COLORS[row.state], fontWeight: 600 }}>{STATE_LABELS[row.state]}</span>
                        {rec === "diverges" && <span style={{ color: "#8a2e2e", marginLeft: "0.4rem" }}>⚠</span>}
                      </td>
                      <td>{row.lotReference}</td>
                      <td>{row.revised.itemCode ?? "—"}</td>
                      <td style={{ fontWeight: row.kind !== "ServiceItem" ? 700 : 400, maxWidth: "320px" }}>{row.revised.description ?? "—"}</td>
                      <td>{row.revised.unit ?? "—"}</td>
                      <td>{row.revised.quantityText ?? "—"}</td>
                      <td>{row.revised.unitCostWithoutBdiText ?? "—"}</td>
                      <td>{row.revised.bdiPercentText ?? "—"}</td>
                      <td>{row.revised.unitPriceWithBdiText ?? "—"}</td>
                      <td>{row.revised.totalPriceText ?? row.revised.documentalGroupTotalText ?? "—"}</td>
                      <td>{row.page ?? "—"}</td>
                      <td>
                        <button onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}>
                          {expandedRowId === row.id ? "Fechar" : "Ver"}
                        </button>
                      </td>
                    </tr>
                    {expandedRowId === row.id && (
                      <tr>
                        <td colSpan={13} style={{ background: "#fafafa", padding: "1rem" }}>
                          <RowDetail row={row} onConfirm={() => handleConfirm(row.id)} onExclude={() => handleExclude(row.id)} onRestore={() => handleRestore(row.id)} busy={busy} sessionInProgress={session.status === "InProgress"} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
          <Button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
          <span>Página {page + 1} de {totalPages}</span>
          <Button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Próxima</Button>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "#666" }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function RowDetail({
  row,
  onConfirm,
  onExclude,
  onRestore,
  busy,
  sessionInProgress,
}: {
  row: ReviewRow;
  onConfirm: () => void;
  onExclude: () => void;
  onRestore: () => void;
  busy: boolean;
  sessionInProgress: boolean;
}) {
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
    ["Custo unit. s/BDI", fields.unitCostWithoutBdiText],
    ["BDI", fields.bdiPercentText],
    ["Preço unit. c/BDI", fields.unitPriceWithBdiText],
    ["Total", fields.totalPriceText],
    ["Total documental (grupo)", fields.documentalGroupTotalText],
    ["Col. FGV-DNIT", fields.colFgvDnit],
  ];
  return (
    <table style={{ fontSize: "0.8rem" }}>
      <tbody>
        {entries.map(([label, value]) => (
          <tr key={label}>
            <td style={{ color: "#666", paddingRight: "0.5rem" }}>{label}</td>
            <td>{value ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
