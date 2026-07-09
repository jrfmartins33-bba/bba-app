"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, StatusBadge } from "@bba/ui";

// Advisor Lab (Sprint 14.2A) — ferramenta interna de engenharia para
// evolução/auditoria/calibração do Advisor. Não é produto: não altera
// Home, não persiste em advisor_narratives, não recalcula snapshot nem
// recommendation nenhuma. Segue o mesmo padrão do resto do app (página
// client-side, gate real acontece em cada rota de /api/admin/advisor-lab
// via requireBbaAdmin) — não há Server Component lendo Supabase aqui
// porque este projeto não usa esse padrão em nenhum outro lugar (cookies
// só podem ser escritos em Route Handlers, ver lib/supabase/server.ts).

interface AdvisorLabProject {
  readonly engineeringProjectId: string;
  readonly engineeringProjectName: string;
  readonly companyId: string;
  readonly companyName: string;
}

interface AdvisorLabSnapshot {
  readonly decisionSnapshotId: string;
  readonly computedAt: string;
  readonly healthScore: number | null;
  readonly triggerReason: string;
}

type ValidatorResult =
  | { readonly valid: true; readonly summary: { readonly insights: ReadonlyArray<unknown> } }
  | { readonly valid: false; readonly reason: string };

interface RunMetrics {
  readonly model: string;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly stopReason: string | null;
  readonly responseId: string;
}

// ok:false = Claude respondeu (temos prompts/métricas/context normalmente),
// mas o texto não era JSON válido — diagnóstico mínimo (ver run/route.ts):
// preserva rawText/parseError em vez de esconder atrás de um erro genérico.
type RunResult =
  | {
      readonly ok: true;
      readonly context: unknown;
      readonly systemPrompt: string;
      readonly userPrompt: string;
      readonly raw: unknown;
      readonly validator: ValidatorResult;
      readonly narrative: string | null;
      readonly metrics: RunMetrics;
    }
  | {
      readonly ok: false;
      readonly context: unknown;
      readonly systemPrompt: string;
      readonly userPrompt: string;
      readonly rawText: string;
      readonly parseError: string;
      readonly metrics: RunMetrics;
    };

type LoadState = "loading" | "forbidden" | "ready" | "error";

const preStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid var(--app-divider)",
  borderRadius: "6px",
  padding: "12px 14px",
  fontSize: "12px",
  lineHeight: 1.5,
  overflowX: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word"
};

export default function AdvisorLabPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [projects, setProjects] = useState<ReadonlyArray<AdvisorLabProject>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [snapshots, setSnapshots] = useState<ReadonlyArray<AdvisorLabSnapshot>>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/api/admin/advisor-lab/projects")
      .then(async (response) => {
        if (!mounted) return;
        if (response.status === 403) {
          setLoadState("forbidden");
          return;
        }
        if (!response.ok) {
          setLoadState("error");
          return;
        }
        const body = (await response.json()) as { projects: ReadonlyArray<AdvisorLabProject> };
        setProjects(body.projects);
        setLoadState("ready");
      })
      .catch(() => {
        if (mounted) setLoadState("error");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setSnapshots([]);
      setSelectedSnapshotId("");
      return;
    }

    let mounted = true;
    setSelectedSnapshotId("");
    setResult(null);

    fetch(`/api/admin/advisor-lab/snapshots?engineeringProjectId=${encodeURIComponent(selectedProjectId)}`)
      .then(async (response) => {
        if (!mounted || !response.ok) return;
        const body = (await response.json()) as { snapshots: ReadonlyArray<AdvisorLabSnapshot> };
        setSnapshots(body.snapshots);
      })
      .catch(() => {
        if (mounted) setSnapshots([]);
      });

    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  const runFromSnapshot = async () => {
    if (!selectedSnapshotId) return;
    setRunning(true);
    setRunError(null);

    try {
      const response = await fetch("/api/admin/advisor-lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "from-snapshot", decisionSnapshotId: selectedSnapshotId })
      });
      const body = await response.json();
      if (!response.ok) {
        setRunError(body.message ?? body.error ?? "Falha ao executar o Advisor.");
        setResult(null);
        return;
      }
      setResult(body as RunResult);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  // "Executar novamente" reenvia o context devolvido pela execução
  // anterior (não decisionSnapshotId de novo) — garante replay com
  // exatamente o mesmo EngineeringAdvisorContext, para comparar
  // estabilidade da resposta do Claude sobre o mesmo input.
  const runAgainWithSameContext = async () => {
    if (!result) return;
    setRunning(true);
    setRunError(null);

    try {
      const response = await fetch("/api/admin/advisor-lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "from-context", context: result.context })
      });
      const body = await response.json();
      if (!response.ok) {
        setRunError(body.message ?? body.error ?? "Falha ao executar o Advisor.");
        return;
      }
      setResult(body as RunResult);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  };

  const exportSession = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `advisor-lab-session-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedProject = useMemo(
    () => projects.find((project) => project.engineeringProjectId === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  if (loadState === "loading") {
    return (
      <section className="page-header">
        <div>
          <h1>Advisor Lab</h1>
          <p>Carregando...</p>
        </div>
      </section>
    );
  }

  if (loadState === "forbidden") {
    return (
      <section className="page-header">
        <div>
          <h1>Advisor Lab</h1>
          <p>Acesso restrito a administradores BBA.</p>
        </div>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section className="page-header">
        <div>
          <h1>Advisor Lab</h1>
          <p>Não foi possível carregar os projetos. Tente novamente mais tarde.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Advisor Lab</h1>
          <p>Ferramenta interna de engenharia para evolução, auditoria e calibração do Advisor.</p>
        </div>
        <StatusBadge status="active">Somente leitura / Admin</StatusBadge>
      </section>

      <div
        className="form-error fiscal-alert"
        role="alert"
        style={{ marginBottom: "16px" }}
      >
        Advisor Lab é uma ferramenta interna. Ao executar, o contexto selecionado será enviado à API Anthropic
        para fins de diagnóstico.
      </div>

      <section className="section-grid">
        <Card className="span-6" title="1. Selecionar Projeto">
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="">Selecione um projeto de engenharia...</option>
            {projects.map((project) => (
              <option key={project.engineeringProjectId} value={project.engineeringProjectId}>
                {project.companyName} — {project.engineeringProjectName}
              </option>
            ))}
          </select>
        </Card>

        <Card className="span-6" title="2. Selecionar Snapshot">
          <select
            value={selectedSnapshotId}
            onChange={(event) => setSelectedSnapshotId(event.target.value)}
            disabled={!selectedProject}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="">Selecione um snapshot...</option>
            {snapshots.map((snapshot) => (
              <option key={snapshot.decisionSnapshotId} value={snapshot.decisionSnapshotId}>
                {new Date(snapshot.computedAt).toLocaleString("pt-BR")} — Health Score{" "}
                {snapshot.healthScore ?? "N/A"} ({snapshot.triggerReason})
              </option>
            ))}
          </select>
        </Card>
      </section>

      <section className="section-grid">
        <Card className="span-12">
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Button disabled={!selectedSnapshotId || running} onClick={() => void runFromSnapshot()}>
              {running ? "Executando..." : "Executar Advisor"}
            </Button>
            <Button
              variant="secondary"
              disabled={!result || running}
              onClick={() => void runAgainWithSameContext()}
            >
              Executar novamente (mesmo contexto)
            </Button>
            <Button variant="ghost" disabled={!result} onClick={exportSession}>
              Export Session
            </Button>
          </div>
          {runError ? (
            <div className="form-error fiscal-alert" role="alert" style={{ marginTop: "12px" }}>
              {runError}
            </div>
          ) : null}
        </Card>
      </section>

      {result ? (
        <>
          <section className="section-grid">
            <Card className="span-12" title="Métricas">
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "13px" }}>
                <span>
                  <strong>Modelo:</strong> {result.metrics.model}
                </span>
                <span>
                  <strong>Latência:</strong> {result.metrics.latencyMs}ms
                </span>
                <span>
                  <strong>Input tokens:</strong> {result.metrics.inputTokens}
                </span>
                <span>
                  <strong>Output tokens:</strong> {result.metrics.outputTokens}
                </span>
                <span>
                  <strong>Total tokens:</strong> {result.metrics.totalTokens}
                </span>
                <span>
                  <strong>Stop reason:</strong> {result.metrics.stopReason ?? "N/A"}
                </span>
                <span>
                  <strong>Response ID:</strong> {result.metrics.responseId}
                </span>
              </div>
            </Card>
          </section>

          {!result.ok ? (
            <section className="section-grid">
              <Card className="span-12" title="Parse do JSON falhou">
                <p style={{ marginBottom: "8px" }}>
                  <StatusBadge status="cancelled">PARSE FAILED</StatusBadge>
                </p>
                <p>{result.parseError}</p>
              </Card>
            </section>
          ) : (
            <section className="section-grid">
              <Card className="span-12" title="Validator">
                <p style={{ marginBottom: "8px" }}>
                  <StatusBadge status={result.validator.valid ? "completed" : "cancelled"}>
                    {result.validator.valid ? "VALID" : "INVALID"}
                  </StatusBadge>
                </p>
                {!result.validator.valid ? <p>{result.validator.reason}</p> : null}
                {result.validator.valid ? (
                  <p>{result.validator.summary.insights.length} insight(s) validado(s).</p>
                ) : null}
              </Card>
            </section>
          )}

          {result.ok ? (
            <section className="section-grid">
              <Card className="span-12" title="Narrativa renderizada">
                <p style={{ whiteSpace: "pre-line" }}>{result.narrative ?? "(nenhuma — validação reprovou)"}</p>
              </Card>
            </section>
          ) : null}

          <section className="section-grid">
            <Card className="span-6" title="System Prompt">
              <pre style={preStyle}>{result.systemPrompt}</pre>
            </Card>
            <Card className="span-6" title="User Prompt">
              <pre style={preStyle}>{result.userPrompt}</pre>
            </Card>
          </section>

          <section className="section-grid">
            <Card className="span-6" title={result.ok ? "Claude Response (JSON bruto)" : "Claude Response bruto (parse falhou — texto cru)"}>
              <pre style={preStyle}>{result.ok ? JSON.stringify(result.raw, null, 2) : result.rawText || "(vazio)"}</pre>
            </Card>
            <Card className="span-6" title="EngineeringAdvisorContext enviado">
              <pre style={preStyle}>{JSON.stringify(result.context, null, 2)}</pre>
            </Card>
          </section>
        </>
      ) : null}
    </>
  );
}
