"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, FolderGit2, Layers, AlertCircle, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, Button } from "@bba/ui";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";

interface ProcurementLotDto {
  readonly id: string;
  readonly title: string;
  readonly externalReference: string | null;
}

interface ProcurementCaseDto {
  readonly id: string;
  readonly title: string;
  readonly externalReference: string | null;
  readonly companyId: string | null;
  readonly companyName: string | null;
  readonly lots: ReadonlyArray<ProcurementLotDto>;
}

interface ProcessResultDto {
  readonly outcome: string;
  readonly idempotentReuse: boolean;
  readonly reviewSessionId?: string;
  readonly canOpenReview: boolean;
  readonly procurementCaseTitle: string;
  readonly procurementLotTitle: string;
  readonly originalFileName: string;
  readonly groupCount: number;
  readonly subgroupCount: number;
  readonly serviceItemCount: number;
  readonly totalRowCount: number;
  readonly message?: string;
  readonly errors?: ReadonlyArray<string>;
}

type ImportStep = "idle" | "computing_hash" | "uploading" | "processing" | "success" | "error";

async function computeSha256InBrowser(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ImportarOrcamentoPage() {
  const [cases, setCases] = useState<ReadonlyArray<ProcurementCaseDto>>([]);
  const [actorRole, setActorRole] = useState<"company_user" | "bba_admin" | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [step, setStep] = useState<ImportStep>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResultDto | null>(null);

  // Fetch context (eligible procurement cases and lots)
  useEffect(() => {
    fetch("/api/orcamentos/importacao/contexto")
      .then((res) => {
        if (!res.ok) throw new Error("Não foi possível carregar os processos de licitação.");
        return res.json();
      })
      .then((data) => {
        const fetchedCases: ReadonlyArray<ProcurementCaseDto> = data.cases ?? [];
        setCases(fetchedCases);
        setActorRole(data.role ?? null);
        if (fetchedCases.length === 1) {
          setSelectedCaseId(fetchedCases[0].id);
          if (fetchedCases[0].lots.length === 1) {
            setSelectedLotId(fetchedCases[0].lots[0].id);
          }
        }
      })
      .catch((err) => {
        setContextError(err instanceof Error ? err.message : "Erro de conexão ao carregar processos.");
      })
      .finally(() => setLoadingContext(false));
  }, []);

  // Update selectedLotId when selectedCaseId changes
  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedLotId("");
      return;
    }
    const currentCase = cases.find((c) => c.id === selectedCaseId);
    if (currentCase) {
      if (currentCase.lots.length === 1) {
        setSelectedLotId(currentCase.lots[0].id);
      } else if (!currentCase.lots.some((l) => l.id === selectedLotId)) {
        setSelectedLotId("");
      }
    }
  }, [selectedCaseId, cases, selectedLotId]);

  const selectedCase = cases.find((c) => c.id === selectedCaseId);
  const availableLots = selectedCase?.lots ?? [];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setErrorMessage("Por favor, selecione uma Planilha Excel original no formato .xlsx.");
      setSelectedFile(null);
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
  }

  async function handleImport() {
    if (!selectedCaseId || !selectedLotId || !selectedFile) return;

    setStep("computing_hash");
    setStatusMessage("Calculando integridade da planilha...");
    setErrorMessage(null);
    setResult(null);

    try {
      // 1. Calculate SHA-256 in browser using Web Crypto
      const sha256 = await computeSha256InBrowser(selectedFile);

      // 2. Call prepare-upload endpoint
      const prepareRes = await fetch("/api/orcamentos/importacao/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procurementCaseId: selectedCaseId,
          procurementLotId: selectedLotId,
          fileName: selectedFile.name,
          contentType: selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: selectedFile.size,
          sha256,
        }),
      });

      const prepareData = await prepareRes.json();
      if (!prepareRes.ok) {
        throw new Error(prepareData.error === "file_must_be_xlsx" ? "O arquivo selecionado deve ser uma planilha Excel (.xlsx)." : prepareData.error ?? "Falha ao preparar o envio do arquivo.");
      }

      const storagePath: string = prepareData.storagePath;

      // 3. Upload file directly to Supabase Storage using browser client
      // upsert:false guarantees immutability — an existing object is never overwritten.
      setStep("uploading");
      setStatusMessage("Armazenando planilha de forma segura...");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
      const supabase = createBrowserClient(supabaseUrl, supabaseKey);

      const { error: uploadError } = await supabase.storage
        .from("bdos-imports")
        .upload(storagePath, selectedFile, {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: false,
        });

      if (uploadError) {
        // Supabase Storage returns a specific message when the object already exists.
        // Treat this as idempotent success — the server will verify the object bytes.
        const isAlreadyExists =
          uploadError.message?.toLowerCase().includes("already exists") ||
          uploadError.message?.toLowerCase().includes("duplicate") ||
          (uploadError as unknown as { statusCode?: string }).statusCode === "409";

        if (!isAlreadyExists) {
          console.error("Storage upload error:", uploadError);
          throw new Error("Não foi possível enviar o arquivo para o armazenamento. Tente novamente.");
        }
        // Object already exists — this is expected for re-imports; continue to process route.
      }

      // 4. Trigger backend Application Service processing
      setStep("processing");
      setStatusMessage("Identificando grupos, serviços e valores do orçamento...");

      const processRes = await fetch("/api/orcamentos/importacao/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procurementCaseId: selectedCaseId,
          procurementLotId: selectedLotId,
          storagePath,
          originalFileName: selectedFile.name,
        }),
      });

      const processData: ProcessResultDto = await processRes.json();

      if (!processRes.ok || processData.outcome !== "success") {
        throw new Error(processData.message ?? "Não conseguimos estruturar a planilha enviada. Confirme se esta é a planilha oficial do orçamento.");
      }

      setResult(processData);
      setStep("success");
    } catch (err) {
      console.error("Import error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Ocorreu uma falha inesperada durante a importação.");
      setStep("error");
    }
  }

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />

      <section className="section-grid" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "900px", margin: "0 auto" }}>
        {/* Navigation Link */}
        <div>
          <Link href="/orcamentos" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--color-primary-600, #0a5ea8)", textDecoration: "none", fontWeight: 500 }}>
            <ArrowLeft size={16} /> Voltar para Orçamentos
          </Link>
        </div>

        {/* Title & Introduction */}
        <div className="bba-card" style={{ background: "linear-gradient(135deg, #0a2540 0%, #1e3a5f 100%)", color: "#ffffff", padding: "2rem", borderRadius: "12px" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#ffffff" }}>Importar orçamento</h1>
          <p style={{ color: "#d0dceb", fontSize: "1rem", margin: 0, lineHeight: 1.5 }}>
            Envie a planilha oficial do orçamento para o BBA organizar os grupos, serviços e valores antes da revisão.
          </p>
        </div>

        {/* Step: Success Result Card */}
        {step === "success" && result && (
          <Card title="Resultado da Importação">
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Success Banner */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "1rem 1.25rem", borderRadius: "8px", color: "#166534" }}>
                <CheckCircle2 size={24} style={{ color: "#16a34a", flexShrink: 0 }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#15803d" }}>✓ Orçamento preparado</h3>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#166534" }}>
                    {result.idempotentReuse
                      ? "Este orçamento já havia sido importado para este lote. A revisão existente foi preservada."
                      : "A estrutura oficial da planilha foi processada e está disponível para conferência."}
                  </p>
                </div>
              </div>

              {/* Context Callout */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Planilha</div>
                  <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem", wordBreak: "break-all" }}>{result.originalFileName}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Processo de Licitação</div>
                  <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>{result.procurementCaseTitle}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Lote</div>
                  <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>{result.procurementLotTitle}</div>
                </div>
              </div>

              {/* Stats Counters */}
              <div>
                <h4 style={{ fontSize: "0.875rem", textTransform: "uppercase", color: "#64748b", margin: "0 0 0.75rem 0", fontWeight: 600 }}>Estrutura Encontrada</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem" }}>
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0a5ea8" }}>{result.groupCount}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>Grupos</div>
                  </div>
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0a5ea8" }}>{result.subgroupCount}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>Subgrupos</div>
                  </div>
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0a5ea8" }}>{result.serviceItemCount}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>Itens de Serviço</div>
                  </div>
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}>{result.totalRowCount}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>Linhas Analisadas</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", paddingTop: "0.5rem", borderTop: "1px solid #e2e8f0" }}>
                {result.canOpenReview && result.reviewSessionId ? (
                  <Link className="bba-button bba-button--primary" href={`/admin/orcamentos/${result.reviewSessionId}/revisao`}>
                    Abrir Revisão do Orçamento Oficial
                  </Link>
                ) : (
                  <div style={{ fontSize: "0.9rem", color: "#475569", fontWeight: 500 }}>
                    Orçamento preparado e enviado para revisão.
                  </div>
                )}
                <button
                  type="button"
                  className="bba-button bba-button--secondary"
                  onClick={() => {
                    setStep("idle");
                    setResult(null);
                    setSelectedFile(null);
                  }}
                >
                  Importar outro orçamento
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Main Import Form Card */}
        {step !== "success" && (
          <Card title="Dados da Importação">
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Context Error */}
              {contextError && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fef2f2", border: "1px solid #fecaca", padding: "0.875rem", borderRadius: "8px", color: "#991b1b" }}>
                  <AlertCircle size={18} />
                  <span>{contextError}</span>
                </div>
              )}

              {/* Step 1: Processo de Licitação */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                  Processo de Licitação
                </label>
                {loadingContext ? (
                  <div style={{ padding: "0.75rem", color: "#64748b", fontSize: "0.875rem" }}>Carregando processos de licitação...</div>
                ) : cases.length === 0 ? (
                  <div style={{ padding: "0.875rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#64748b", fontSize: "0.875rem" }}>
                    {actorRole === "bba_admin"
                      ? "Nenhum processo de licitação cadastrado no sistema."
                      : "Nenhum processo de licitação cadastrado para sua empresa."}
                  </div>
                ) : (
                  <select
                    value={selectedCaseId}
                    disabled={step !== "idle" && step !== "error"}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                    style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem", background: "#ffffff" }}
                  >
                    <option value="">Selecione o Processo de Licitação...</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {actorRole === "bba_admin" && c.companyName ? `[${c.companyName}] ` : ""}{c.title}{c.externalReference ? ` (${c.externalReference})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Step 2: Lote */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                  Lote
                </label>
                <select
                  value={selectedLotId}
                  disabled={!selectedCaseId || availableLots.length === 0 || (step !== "idle" && step !== "error")}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem", background: "#ffffff" }}
                >
                  <option value="">
                    {!selectedCaseId ? "Selecione primeiro o Processo..." : availableLots.length === 0 ? "Nenhum lote disponível neste processo" : "Selecione o Lote..."}
                  </option>
                  {availableLots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title} {l.externalReference ? `(${l.externalReference})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Planilha Excel (.xlsx) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                  Planilha do orçamento
                </label>
                <div
                  style={{
                    border: "2px dashed #cbd5e1",
                    borderRadius: "10px",
                    padding: "1.75rem",
                    textAlign: "center",
                    background: "#f8fafc",
                    cursor: step === "idle" || step === "error" ? "pointer" : "default",
                    transition: "border-color 0.2s ease",
                  }}
                  onClick={() => {
                    if (step === "idle" || step === "error") {
                      document.getElementById("file-input")?.click();
                    }
                  }}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={step !== "idle" && step !== "error"}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                    <FileSpreadsheet size={36} style={{ color: selectedFile ? "#0a5ea8" : "#94a3b8" }} />
                    {selectedFile ? (
                      <div>
                        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "1rem" }}>{selectedFile.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 600, color: "#334155" }}>Selecione a planilha original do orçamento publicada pelo órgão</div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>Arquivo no formato Excel (.xlsx)</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Message Display */}
              {errorMessage && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fef2f2", border: "1px solid #fecaca", padding: "0.875rem", borderRadius: "8px", color: "#991b1b", fontSize: "0.9rem" }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Progress Step Indicator */}
              {step !== "idle" && step !== "error" && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "1rem", borderRadius: "8px", color: "#1e40af" }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: "#2563eb" }} />
                  <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{statusMessage}</span>
                </div>
              )}

              {/* Action Button */}
              <div>
                <Button
                  disabled={!selectedCaseId || !selectedLotId || !selectedFile || (step !== "idle" && step !== "error")}
                  onClick={handleImport}
                >
                  {step !== "idle" && step !== "error" ? "Processando..." : "Importar orçamento"}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </section>
    </>
  );
}
