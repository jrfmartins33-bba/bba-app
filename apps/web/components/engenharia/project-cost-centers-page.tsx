"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, Info, RotateCw } from "lucide-react";
import { Card, SkeletonCard, StatusBadge } from "@bba/ui";
import type { ProjectCostCentersReadModel } from "@bba/bdos-core/domain/cost-center";
import styles from "./project-cost-centers.module.css";

interface ProjectCostCentersPageProps {
  readonly projectId: string;
}

type ViewState =
  | { readonly phase: "loading" }
  | { readonly phase: "ready"; readonly readModel: ProjectCostCentersReadModel }
  | { readonly phase: "not_found" }
  | { readonly phase: "error"; readonly message: string };

// NOTA: este componente NÃO calcula valor financeiro, participação, saldo
// não atribuído nem proporção de barra. Tudo vem PRONTO do read model
// (BDOS calcula, UI apresenta): strings já formatadas em BRL/percentual e
// larguras de barra inteiras 0..100. Nenhuma conversão numérica de decimal
// canônico acontece aqui.

export function ProjectCostCentersPage({ projectId }: ProjectCostCentersPageProps) {
  const searchParams = useSearchParams();
  const requestedOrganizationId = searchParams.get("empresa");
  const requestedPeriod = searchParams.get("periodo");
  const [state, setState] = useState<ViewState>({ phase: "loading" });
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    const query = new URLSearchParams();
    if (requestedOrganizationId) query.set("empresa", requestedOrganizationId);
    if (requestedPeriod) query.set("periodo", requestedPeriod);
    const qs = query.toString();
    try {
      const response = await fetch(
        `/api/engenharia/obras/${encodeURIComponent(projectId)}/centros-de-custo${qs ? `?${qs}` : ""}`,
      );
      if (response.status === 404) {
        setState({ phase: "not_found" });
        return;
      }
      if (!response.ok) {
        throw new Error("Não foi possível carregar os Centros de Custo da obra.");
      }
      const data = await response.json();
      if (!data.readModel) {
        setState({ phase: "not_found" });
        return;
      }
      setState({ phase: "ready", readModel: data.readModel });
    } catch (err: unknown) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Erro inesperado ao consultar Centros de Custo.",
      });
    }
  }, [projectId, requestedOrganizationId, requestedPeriod]);

  useEffect(() => {
    void load();
  }, [load]);

  const organizationQuery = requestedOrganizationId
    ? `?empresa=${encodeURIComponent(requestedOrganizationId)}`
    : "";
  const backHref = `/workspaces/engenharia/obras/${encodeURIComponent(projectId)}${organizationQuery}`;

  if (state.phase === "loading") {
    return (
      <div className={styles.container}>
        <section className="page-header">
          <div>
            <span className="workspaces-eyebrow">BBA Platform · Workspace Engenharia · Centros de Custo</span>
            <h1>Carregando Centros de Custo…</h1>
          </div>
        </section>
        <div className={styles.kpiGrid}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (state.phase === "not_found") {
    return (
      <div className={styles.container}>
        <section className="page-header">
          <div>
            <span className="workspaces-eyebrow">BBA Platform · Workspace Engenharia · Centros de Custo</span>
            <h1>Obra não encontrada</h1>
            <p>A obra solicitada não existe ou não pertence à organização ativa.</p>
          </div>
          <Link className="bba-button bba-button--ghost bba-button--sm" href={backHref}>
            <ArrowLeft size={16} /> Voltar para a obra
          </Link>
        </section>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className={styles.container}>
        <section className="page-header">
          <div>
            <span className="workspaces-eyebrow">BBA Platform · Workspace Engenharia · Centros de Custo</span>
            <h1>Não foi possível abrir os Centros de Custo</h1>
            <p>{state.message}</p>
          </div>
          <Link className="bba-button bba-button--ghost bba-button--sm" href={backHref}>
            <ArrowLeft size={16} /> Voltar
          </Link>
        </section>
        <Card className="span-12 workspace-card" title="Falha de conexão">
          <button className="bba-button bba-button--secondary bba-button--sm" onClick={() => void load()} type="button">
            <RotateCw size={16} /> Tentar novamente
          </button>
        </Card>
      </div>
    );
  }

  return (
    <CostCentersReady
      readModel={state.readModel}
      backHref={backHref}
      expandedEntryId={expandedEntryId}
      setExpandedEntryId={setExpandedEntryId}
    />
  );
}

function CostCentersReady({
  readModel,
  backHref,
  expandedEntryId,
  setExpandedEntryId,
}: {
  readModel: ProjectCostCentersReadModel;
  backHref: string;
  expandedEntryId: string | null;
  setExpandedEntryId: (id: string | null) => void;
}) {
  const rm = readModel;
  const isDemonstrative = rm.dataNature === "Demonstrative";
  const notMaterialized = rm.operationalState === "not_materialized";
  const hasConsortiumShare = rm.costCenters.some((cc) => cc.consortiumSharePercent !== null);
  const mc = rm.measurementComparison;

  return (
    <div className={styles.container}>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">
            BBA Platform · Workspace Engenharia · {rm.projectName ?? "Obra"}
          </span>
          <div className={styles.headerRow}>
            <h1>Centros de Custo</h1>
            {isDemonstrative && (
              <span className={styles.demoBadge}>
                <Info size={13} aria-hidden="true" /> Dados demonstrativos
              </span>
            )}
          </div>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem" }}>Período: {rm.periodLabel}</p>
        </div>
        <Link className="bba-button bba-button--ghost bba-button--sm" href={backHref}>
          <ArrowLeft size={16} /> Voltar para a obra
        </Link>
      </section>

      {isDemonstrative && (
        <p className={styles.demoNote}>
          Valores utilizados exclusivamente para demonstração da funcionalidade. Não representam os custos reais da obra.
        </p>
      )}

      {notMaterialized && (
        <div className={styles.emptyState}>
          A camada operacional de custos ainda não foi materializada para esta obra. Os Centros de Custo já cadastrados
          aparecem abaixo; ainda não há despesas nem alocações registradas — isto é diferente de{" "}
          <strong>R$ 0,00 atribuído</strong>.
        </div>
      )}

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
          <span className={styles.kpiLabel}>{isDemonstrative ? "Custos demonstrativos" : "Custos do período"}</span>
          <span className={`${styles.kpiValue} ${styles.kpiValuePrimary}`}>
            {rm.hasCostEntries ? rm.totalCostFormatted : "—"}
          </span>
          <span className={styles.kpiSub}>
            {rm.hasCostEntries ? `${rm.entries.length} despesas` : "Sem despesas materializadas"}
          </span>
        </div>
        {rm.costCenters.map((cc) => (
          <div className={styles.kpiCard} key={cc.id}>
            <span className={styles.kpiLabel}>{cc.name}</span>
            <span className={styles.kpiValue}>{rm.hasCostEntries ? cc.allocatedCostFormatted : "—"}</span>
            <span className={styles.kpiSub}>
              {rm.hasCostEntries ? `${cc.costShareFormatted} dos custos` : "Aguardando custos"}
            </span>
          </div>
        ))}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Não atribuído</span>
          <span className={styles.kpiValue}>{rm.hasCostEntries ? rm.unallocatedCostFormatted : "—"}</span>
          <span className={styles.kpiSub}>
            {rm.hasCostEntries ? "Total − soma das alocações" : "Sem base para cálculo"}
          </span>
        </div>
      </div>

      <div className={styles.sectionGrid}>
        {/* Distribuição por Centro de Custo */}
        <Card className={`${styles.cardFull} workspace-card`} title="Distribuição por Centro de Custo">
          <div className={styles.ccList}>
            {rm.costCenters.map((cc) => (
              <div className={styles.ccCard} key={cc.id}>
                <div>
                  <div className={styles.ccName}>{cc.name}</div>
                  <div className={styles.ccCode}>{cc.code}</div>
                  {cc.consortiumMemberName && (
                    <div className={styles.note}>Consorciada: {cc.consortiumMemberName}</div>
                  )}
                </div>

                <div>
                  <div className={styles.ccMetricRow}>
                    <span>Participação no consórcio</span>
                    <strong>{cc.consortiumShareFormatted}</strong>
                  </div>
                  <div className={styles.shareTrack}>
                    <div
                      className={styles.shareFillSociety}
                      style={{ width: `${cc.consortiumShareBarWidthPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className={styles.ccMetricRow}>
                    <span>Participação nos custos</span>
                    <strong>{rm.hasCostEntries ? cc.costShareFormatted : "—"}</strong>
                  </div>
                  <div className={styles.shareTrack}>
                    <div className={styles.shareFillCost} style={{ width: `${cc.costShareBarWidthPercent}%` }} />
                  </div>
                </div>

                <div className={styles.ccMetricRow}>
                  <span>{isDemonstrative ? "Custos demonstrativos" : "Custos atribuídos"}</span>
                  <strong>{rm.hasCostEntries ? cc.allocatedCostFormatted : "—"}</strong>
                </div>
              </div>
            ))}
          </div>

          {hasConsortiumShare && <p className={styles.note}>{rm.consortiumVsCostNote}</p>}
        </Card>

        {/* Por categoria / família */}
        {rm.families.length > 0 && (
          <Card className={`${styles.cardFull} workspace-card`} title="Por categoria / família">
            {rm.families.map((f) => (
              <div className={styles.familyRow} key={f.family}>
                <div>
                  <div className={styles.familyName}>{f.familyLabel}</div>
                  <div className={styles.familyBreakdown}>
                    {f.costCenters.map((c) => `${c.costCenterCode} ${c.amountFormatted}`).join(" · ")}
                  </div>
                </div>
                <div className={styles.familyBarTrack}>
                  <div className={styles.familyBarFill} style={{ width: `${f.barWidthPercent}%` }} />
                </div>
                <div className={styles.familyValue}>
                  <strong>{f.amountFormatted}</strong>
                  {f.shareFormatted}
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Despesas */}
        {rm.entries.length > 0 && (
          <Card className={`${styles.cardFull} workspace-card`} title="Despesas do período">
            <div style={{ overflowX: "auto" }}>
              <table className={styles.expenseTable}>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Valor</th>
                    <th>Distribuição</th>
                    <th>Método</th>
                    <th>Natureza</th>
                  </tr>
                </thead>
                <tbody>
                  {rm.entries.map((entry) => {
                    const expanded = expandedEntryId === entry.id;
                    const distrib = entry.allocations
                      .map((a) => `${a.costCenterCode} ${a.percentageFormatted}`)
                      .join(" · ");
                    return (
                      <Fragment key={entry.id}>
                        <tr>
                          <td>
                            <span className={styles.expenseDesc}>{entry.description}</span>
                            <br />
                            <button
                              className={styles.expandButton}
                              type="button"
                              onClick={() => setExpandedEntryId(expanded ? null : entry.id)}
                            >
                              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />} alocações
                            </button>
                          </td>
                          <td>{entry.category ?? entry.familyLabel}</td>
                          <td className={styles.expenseAmount}>{entry.amountFormatted}</td>
                          <td className={styles.distribCell}>{distrib}</td>
                          <td>
                            <span className={styles.methodTag}>{entry.allocations[0]?.methodLabel ?? "—"}</span>
                          </td>
                          <td>
                            <span className={styles.natureTag}>{entry.natureLabel}</span>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className={styles.allocationDetail}>
                            <td colSpan={6}>
                              {entry.allocations.map((a) => (
                                <div className={styles.allocationLine} key={a.costCenterId}>
                                  <span>
                                    <strong>{a.costCenterName}</strong>
                                  </span>
                                  <span>{a.percentageFormatted}</span>
                                  <span>{a.amountFormatted}</span>
                                  <span>{a.methodLabel}</span>
                                </div>
                              ))}
                              {entry.hasUnallocatedAmount && (
                                <div className={styles.allocationLine}>
                                  <span>
                                    <strong>Não atribuído</strong>
                                  </span>
                                  <span>—</span>
                                  <span>{entry.unallocatedFormatted}</span>
                                  <span>—</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Simulação gerencial do período — só quando a medição foi localizada */}
        {mc.available && (
          <Card className={`${styles.cardFull} workspace-card`} title="Simulação gerencial do período">
            <div className={styles.simCard}>
              <div className={styles.simGrid}>
                <div className={styles.simMetric}>
                  <span className={styles.simMetricLabel}>Valor medido</span>
                  <span className={styles.simMetricValue}>{mc.measuredValueFormatted}</span>
                  {mc.measurementLabel && <span className={styles.simDisclaimer}>{mc.measurementLabel}</span>}
                </div>
                <div className={styles.simMetric}>
                  <span className={styles.simMetricLabel}>
                    {isDemonstrative ? "Custos demonstrativos" : "Custos do período"}
                  </span>
                  <span className={styles.simMetricValue}>{mc.demonstrativeCostValueFormatted}</span>
                </div>
                <div className={styles.simMetric}>
                  <span className={styles.simMetricLabel}>Diferença demonstrativa</span>
                  <span className={`${styles.simMetricValue} ${styles.simMetricValueDiff}`}>
                    {mc.demonstrativeDifferenceFormatted}
                  </span>
                </div>
              </div>
              {mc.neutralStatement && <p className={styles.simDisclaimer}>{mc.neutralStatement}</p>}
              {mc.disclaimer && <p className={styles.simDisclaimer}>{mc.disclaimer}</p>}
            </div>
          </Card>
        )}
      </div>

      <section style={{ display: "flex", justifyContent: "flex-end" }}>
        <StatusBadge status="active">
          {rm.operationalState === "materialized" ? "Camada operacional materializada" : "Camada operacional pendente"}
        </StatusBadge>
      </section>
    </div>
  );
}
