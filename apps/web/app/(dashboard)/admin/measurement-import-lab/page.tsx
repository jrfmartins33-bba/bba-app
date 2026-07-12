"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@bba/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Measurement Import Lab (Epic 19, Sprint 4B) — ferramenta interna de
// diagnóstico do pipeline completo de Boletim de Medição
// (prepare-upload -> upload direto -> upload-complete -> process),
// não a UI final do produto. Mesmo raciocínio do Advisor Lab
// (apps/web/app/(dashboard)/admin/advisor-lab/page.tsx): página
// client-side, sem Server Component lendo Supabase, chama as rotas já
// existentes de /api/measurement/imports/* (nenhuma rota nova criada
// só para esta página) e mostra o pipeline etapa a etapa, com o
// MeasurementAnalysisResult bruto sempre visível -- pensada para
// continuar sendo a ferramenta de diagnóstico oficial quando novos
// layouts/órgãos (DER, SICRO, SINAPI...) forem suportados, não código
// descartável.

const UPLOAD_BUCKET_NAME = "bdos-imports";

interface MeasurementImportIssue {
  readonly code: string;
  readonly severity: "blocking" | "warning";
  readonly message: string;
  readonly sourceLocation?: {
    readonly sheetName: string;
    readonly rowNumber: number;
    readonly physicalColumn?: string;
    readonly financialColumn?: string;
  };
}

interface MeasurementAnalysisResultBase {
  readonly schemaVersion: number;
  readonly parserKey: string;
  readonly generatedAt: string;
  readonly measurementBulletinImportId: string;
  readonly engineeringProjectId: string;
  readonly declaredBulletinNumber: number | null;
  readonly declaredPeriod: {
    readonly startDate: string | null;
    readonly endDate: string | null;
    readonly labels: ReadonlyArray<string>;
  } | null;
  readonly structuralIssues: ReadonlyArray<MeasurementImportIssue>;
  readonly skippedSheets: ReadonlyArray<{ readonly sheetName: string; readonly reason: string }>;
}

type MeasurementAnalysisResult =
  | (MeasurementAnalysisResultBase & {
      readonly status: "reconciled" | "needs_review";
      readonly measurementWorkspaceId: string;
      readonly officialPeriodTotal: number;
      readonly recalculatedTotal: number;
      readonly totalDifference: number;
      readonly workPackages: { readonly created: number; readonly matched: number };
      readonly serviceItems: { readonly created: number; readonly matched: number };
      readonly lines: { readonly imported: number; readonly alreadyPresent: number; readonly updated: number; readonly skippedZeroValue: number };
    })
  | (MeasurementAnalysisResultBase & {
      readonly status: "failed";
      readonly measurementWorkspaceId: string | null;
    });

interface ProcessOutcome {
  readonly kind: string;
  readonly measurementWorkspaceId: string | null;
  readonly issues: ReadonlyArray<MeasurementImportIssue>;
  readonly analysisResult: MeasurementAnalysisResult | null;
}

type ProcessResult =
  | { readonly success: true; readonly outcome: ProcessOutcome }
  | { readonly success: false; readonly error: string; readonly analysisResult?: MeasurementAnalysisResult };

type StageStatus = "pending" | "running" | "done" | "error";

interface PipelineState {
  readonly upload: StageStatus;
  readonly uploadCompleteStage: StageStatus;
  readonly process: StageStatus;
}

const INITIAL_STAGES: PipelineState = { upload: "pending", uploadCompleteStage: "pending", process: "pending" };

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

function stageBadgeStatus(status: StageStatus): "pending" | "in_progress" | "completed" | "cancelled" {
  switch (status) {
    case "pending":
      return "pending";
    case "running":
      return "in_progress";
    case "done":
      return "completed";
    case "error":
      return "cancelled";
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MeasurementImportLabPage() {
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineState>(INITIAL_STAGES);
  const [measurementBulletinImportId, setMeasurementBulletinImportId] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [uploadElapsedMs, setUploadElapsedMs] = useState<number | null>(null);
  const [processElapsedMs, setProcessElapsedMs] = useState<number | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  const runPipeline = async () => {
    if (!file) return;

    setRunning(true);
    setError(null);
    setStages(INITIAL_STAGES);
    setMeasurementBulletinImportId(null);
    setStoragePath(null);
    setUploadElapsedMs(null);
    setProcessElapsedMs(null);
    setProcessResult(null);

    const uploadStart = performance.now();

    try {
      // Etapa 1 -- prepare-upload + upload direto ao Storage.
      setStages((current) => ({ ...current, upload: "running" }));

      const prepareResponse = await fetch("/api/measurement/imports/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size })
      });

      if (!prepareResponse.ok) {
        const body = await prepareResponse.json().catch(() => ({}));
        throw new Error(`prepare-upload falhou (${prepareResponse.status}): ${body.error ?? "erro desconhecido"}`);
      }

      const prepared = (await prepareResponse.json()) as { measurementBulletinImportId: string; storagePath: string };
      setMeasurementBulletinImportId(prepared.measurementBulletinImportId);
      setStoragePath(prepared.storagePath);

      const supabase = getSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(UPLOAD_BUCKET_NAME)
        .upload(prepared.storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });

      if (uploadError) {
        throw new Error(`Falha ao enviar o arquivo para o Storage: ${uploadError.message}`);
      }

      setStages((current) => ({ ...current, upload: "done", uploadCompleteStage: "running" }));

      // Etapa 2 -- upload-complete.
      const uploadCompleteResponse = await fetch("/api/measurement/imports/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ measurementBulletinImportId: prepared.measurementBulletinImportId })
      });

      if (!uploadCompleteResponse.ok) {
        const body = await uploadCompleteResponse.json().catch(() => ({}));
        throw new Error(`upload-complete falhou (${uploadCompleteResponse.status}): ${body.error ?? "erro desconhecido"}`);
      }

      setUploadElapsedMs(Math.round(performance.now() - uploadStart));
      setStages((current) => ({ ...current, uploadCompleteStage: "done", process: "running" }));

      // Etapa 3 -- process.
      const processStart = performance.now();
      const processResponse = await fetch("/api/measurement/imports/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ measurementBulletinImportId: prepared.measurementBulletinImportId })
      });

      const body = (await processResponse.json()) as ProcessResult;
      setProcessElapsedMs(Math.round(performance.now() - processStart));
      setProcessResult(body);
      setStages((current) => ({ ...current, process: body.success ? "done" : "error" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStages((current) => ({
        upload: current.upload === "running" ? "error" : current.upload,
        uploadCompleteStage: current.uploadCompleteStage === "running" ? "error" : current.uploadCompleteStage,
        process: current.process === "running" ? "error" : current.process
      }));
    } finally {
      setRunning(false);
    }
  };

  const analysis = processResult?.success ? processResult.outcome.analysisResult : (processResult?.success === false ? (processResult.analysisResult ?? null) : null);
  const outcomeIssues = processResult?.success ? processResult.outcome.issues : [];
  const workspaceId = processResult?.success ? processResult.outcome.measurementWorkspaceId : null;
  const blockingIssues = outcomeIssues.filter((issue) => issue.severity === "blocking");
  const warningIssues = outcomeIssues.filter((issue) => issue.severity === "warning");

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Measurement Import Lab</h1>
          <p>Ferramenta interna de diagnóstico do pipeline de importação de Boletim de Medição — não é a UI final do produto.</p>
        </div>
        <StatusBadge status="active">Somente diagnóstico</StatusBadge>
      </section>

      <div className="form-error fiscal-alert" role="alert" style={{ marginBottom: "16px" }}>
        Esta página executa o pipeline real (prepare-upload → upload direto ao Storage → upload-complete → process)
        contra a empresa/projeto da sua sessão atual, com persistência real no Supabase. Use apenas com um arquivo de
        Boletim de Medição real (.xlsx, formato DNOCS).
      </div>

      <section className="section-grid">
        <Card className="span-12" title="1. Selecionar arquivo">
          <input
            accept=".xlsx"
            disabled={running}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          <div style={{ marginTop: "12px" }}>
            <Button disabled={!file || running} onClick={() => void runPipeline()}>
              {running ? "Executando pipeline..." : "Executar pipeline completo"}
            </Button>
          </div>
          {error ? (
            <div className="form-error fiscal-alert" role="alert" style={{ marginTop: "12px" }}>
              {error}
            </div>
          ) : null}
        </Card>
      </section>

      <section className="section-grid">
        <Card className="span-4" title="Etapa 1 — Upload">
          <p style={{ marginBottom: "8px" }}>
            <StatusBadge status={stageBadgeStatus(stages.upload)}>
              {stages.upload === "done" ? "Upload realizado" : stages.upload.toUpperCase()}
            </StatusBadge>
          </p>
          {measurementBulletinImportId ? (
            <>
              <p style={{ fontSize: "12px" }}>
                <strong>importId:</strong> {measurementBulletinImportId}
              </p>
              <p style={{ fontSize: "12px", wordBreak: "break-all" }}>
                <strong>storagePath:</strong> {storagePath}
              </p>
            </>
          ) : null}
        </Card>

        <Card className="span-4" title="Etapa 2 — Processamento">
          <p style={{ marginBottom: "8px" }}>
            <StatusBadge status={stageBadgeStatus(stages.process)}>
              {stages.process === "done" ? "Processamento concluído" : stages.process.toUpperCase()}
            </StatusBadge>
          </p>
          {workspaceId ? (
            <p style={{ fontSize: "12px" }}>
              <strong>workspaceId:</strong> {workspaceId}
            </p>
          ) : null}
          {uploadElapsedMs !== null ? (
            <p style={{ fontSize: "12px" }}>
              <strong>Upload+confirmação:</strong> {uploadElapsedMs}ms
            </p>
          ) : null}
          {processElapsedMs !== null ? (
            <p style={{ fontSize: "12px" }}>
              <strong>process():</strong> {processElapsedMs}ms
            </p>
          ) : null}
        </Card>

        <Card className="span-4" title="Etapa 6 — IDs persistidos">
          <p style={{ fontSize: "12px" }}>
            <strong>measurementBulletinImportId:</strong>
            <br />
            {measurementBulletinImportId ?? "—"}
          </p>
          <p style={{ fontSize: "12px", marginTop: "8px" }}>
            <strong>measurementWorkspaceId:</strong>
            <br />
            {workspaceId ?? "—"}
          </p>
        </Card>
      </section>

      {analysis ? (
        <section className="section-grid">
          <Card className="span-12" title="Etapa 3 — Análise do Boletim">
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Boletim</span>
                <p style={{ fontSize: "20px", margin: "2px 0" }}>{analysis.declaredBulletinNumber ?? "—"}</p>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Período</span>
                <p style={{ fontSize: "14px", margin: "2px 0" }}>
                  {analysis.declaredPeriod?.startDate ?? "—"} a {analysis.declaredPeriod?.endDate ?? "—"}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Status</span>
                <p style={{ margin: "2px 0" }}>
                  <StatusBadge
                    status={analysis.status === "reconciled" ? "completed" : analysis.status === "needs_review" ? "pending" : "cancelled"}
                  >
                    {analysis.status}
                  </StatusBadge>
                </p>
              </div>
            </div>

            {analysis.status !== "failed" ? (
              <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", marginTop: "20px" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Valor oficial</span>
                  <p style={{ fontSize: "18px", margin: "2px 0" }}>{formatCurrency(analysis.officialPeriodTotal)}</p>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Valor recalculado</span>
                  <p style={{ fontSize: "18px", margin: "2px 0" }}>{formatCurrency(analysis.recalculatedTotal)}</p>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Diferença</span>
                  <p style={{ fontSize: "18px", margin: "2px 0" }}>{formatCurrency(analysis.totalDifference)}</p>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>WorkPackages</span>
                  <p style={{ fontSize: "18px", margin: "2px 0" }}>
                    {analysis.workPackages.created + analysis.workPackages.matched}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>ManagedServiceItems</span>
                  <p style={{ fontSize: "18px", margin: "2px 0" }}>
                    {analysis.serviceItems.created + analysis.serviceItems.matched}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>MeasurementLines</span>
                  <p style={{ fontSize: "18px", margin: "2px 0" }}>
                    {analysis.lines.imported + analysis.lines.alreadyPresent + analysis.lines.updated}
                  </p>
                </div>
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      {warningIssues.length > 0 ? (
        <section className="section-grid">
          <Card className="span-12" title={`Etapa 4 — Warnings (${warningIssues.length})`}>
            <div style={{ display: "grid", gap: "8px" }}>
              {warningIssues.map((issue, index) => (
                <div key={`${issue.code}-${index}`} style={{ fontSize: "12px", padding: "6px 0", borderBottom: "1px solid var(--app-divider)" }}>
                  <strong>{issue.code}</strong> — {issue.message}
                  {issue.sourceLocation ? (
                    <span style={{ color: "var(--text-muted)" }}>
                      {" "}
                      ({issue.sourceLocation.sheetName}, linha {issue.sourceLocation.rowNumber})
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      {blockingIssues.length > 0 ? (
        <section className="section-grid">
          <Card className="span-12" title={`Etapa 5 — Blocking (${blockingIssues.length})`}>
            <div style={{ display: "grid", gap: "8px" }}>
              {blockingIssues.map((issue, index) => (
                <div key={`${issue.code}-${index}`} style={{ fontSize: "12px", padding: "6px 0", borderBottom: "1px solid var(--app-divider)", color: "var(--status-red, #d33)" }}>
                  <strong>{issue.code}</strong> — {issue.message}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      {processResult ? (
        <section className="section-grid">
          <Card className="span-12" title="ProcessMeasurementBulletinImportResult (JSON bruto)">
            <pre style={preStyle}>{JSON.stringify(processResult, null, 2)}</pre>
          </Card>
        </section>
      ) : null}
    </>
  );
}
