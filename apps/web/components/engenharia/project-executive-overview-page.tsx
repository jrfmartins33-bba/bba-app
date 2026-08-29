"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  GanttChartSquare,
  HardHat,
  Layers,
  RotateCw,
  Ruler,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Card, SkeletonCard, StatusBadge } from "@bba/ui";
import styles from "./project-overview.module.css";
import type { ProjectExecutiveOverviewDto } from "@/lib/bdos/project-executive-overview-server";

interface ProjectExecutiveOverviewPageProps {
  readonly projectId: string;
}

type ViewState =
  | { readonly phase: "loading" }
  | { readonly phase: "ready"; readonly overview: ProjectExecutiveOverviewDto; readonly organizationName: string | null }
  | { readonly phase: "not_found" }
  | { readonly phase: "error"; readonly message: string };

export function ProjectExecutiveOverviewPage({ projectId }: ProjectExecutiveOverviewPageProps) {
  const searchParams = useSearchParams();
  const requestedOrganizationId = searchParams.get("empresa");
  const [state, setState] = useState<ViewState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    const query = requestedOrganizationId ? `?empresa=${encodeURIComponent(requestedOrganizationId)}` : "";
    try {
      const response = await fetch(`/api/engenharia/obras/${encodeURIComponent(projectId)}${query}`);
      if (response.status === 404) {
        setState({ phase: "not_found" });
        return;
      }
      if (!response.ok) {
        throw new Error("Não foi possível carregar as informações executivas da obra.");
      }
      const data = await response.json();
      if (!data.overview) {
        setState({ phase: "not_found" });
        return;
      }
      setState({
        phase: "ready",
        overview: data.overview,
        organizationName: data.organization?.name ?? null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao consultar a obra.";
      setState({ phase: "error", message });
    }
  }, [projectId, requestedOrganizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const organizationQuery = requestedOrganizationId ? `?empresa=${encodeURIComponent(requestedOrganizationId)}` : "";
  const backHref = `/workspaces/engenharia${organizationQuery}`;

  if (state.phase === "loading") {
    return (
      <div className={styles.container}>
        <section className="page-header">
          <div>
            <span className="workspaces-eyebrow">BBA Platform · Workspace Engenharia</span>
            <h1>Carregando obra…</h1>
          </div>
        </section>
        <div className={styles.heroBar}>
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
            <span className="workspaces-eyebrow">BBA Platform · Workspace Engenharia</span>
            <h1>Obra não encontrada</h1>
            <p>A obra solicitada não existe ou não pertence à organização ativa.</p>
          </div>
          <Link className="bba-button bba-button--ghost bba-button--sm" href={backHref}>
            <ArrowLeft size={16} /> Voltar para Engenharia
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
            <span className="workspaces-eyebrow">BBA Platform · Workspace Engenharia</span>
            <h1>Não foi possível abrir a obra</h1>
            <p>{state.message}</p>
          </div>
          <Link className="bba-button bba-button--ghost bba-button--sm" href={backHref}>
            <ArrowLeft size={16} /> Voltar
          </Link>
        </section>
        <Card className="span-12 workspace-card" title="Falha de conexão">
          <p className="workspace-card__description">Ocorreu um erro ao consultar os dados da obra no servidor.</p>
          <button className="bba-button bba-button--secondary bba-button--sm" onClick={() => void load()} type="button">
            <RotateCw size={16} /> Tentar novamente
          </button>
        </Card>
      </div>
    );
  }

  const { overview } = state;
  const { project, contractualFoundation, planning, measurement, structure } = overview;
  const contractNumber = contractualFoundation.contractNumber ?? project.contractNumber ?? "—";
  const contractorName = contractualFoundation.contractorName ?? project.contractorName ?? "—";
  const projectStudioHref = `/bba-project?projeto=${encodeURIComponent(project.id)}${requestedOrganizationId ? `&empresa=${encodeURIComponent(requestedOrganizationId)}` : ""}`;
  const costCentersHref = `/workspaces/engenharia/obras/${encodeURIComponent(project.id)}/centros-de-custo${requestedOrganizationId ? `?empresa=${encodeURIComponent(requestedOrganizationId)}` : ""}`;
  const historicalBudgetCents = contractualFoundation.historicalOfficialBudgetCents;
  const contractedValueCents = contractualFoundation.contractedValueCents;
  const hasFinancialComparison =
    historicalBudgetCents !== null &&
    historicalBudgetCents > 0 &&
    contractedValueCents !== null;
  const historicalBudgetValue = historicalBudgetCents ?? 0;
  const contractedValue = contractedValueCents ?? 0;
  const financialDifferenceCents = hasFinancialComparison
    ? historicalBudgetValue - contractedValue
    : 0;
  const financialDifferenceFormatted = (Math.abs(financialDifferenceCents) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const financialVariationPercent = hasFinancialComparison
    ? (Math.abs(financialDifferenceCents) / historicalBudgetValue) * 100
    : 0;
  const financialVariationFormatted = financialVariationPercent.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const contractedSharePercent = hasFinancialComparison
    ? Math.min((contractedValue / historicalBudgetValue) * 100, 100)
    : 0;
  const financialVariationLabel =
    financialDifferenceCents > 0 ? "Redução" : financialDifferenceCents < 0 ? "Acréscimo" : "Sem variação";

  return (
    <div className={styles.container}>
      {/* Cabeçalho da Obra */}
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Workspace Engenharia · Obra em Execução</span>
          <div className="workspace-header-title" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1>{project.name}</h1>
            <StatusBadge status="active">{project.statusLabel}</StatusBadge>
          </div>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Contrato nº {contractNumber} · Contratado: <strong>{contractorName}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link className="bba-button bba-button--secondary bba-button--sm" href={costCentersHref}>
            <Banknote size={16} /> Centros de Custo
          </Link>
          <Link className="bba-button bba-button--ghost bba-button--sm" href={backHref}>
            <ArrowLeft size={16} /> Voltar para Engenharia
          </Link>
        </div>
      </section>

      {/* Destaque Principal — Faixa de Métricas Rápidas */}
      <div className={styles.heroBar}>
        <div className={`${styles.heroMetricCard} ${styles.heroMetricCardHighlight}`}>
          <span className={styles.heroMetricLabel}>Valor Contratado</span>
          <span className={`${styles.heroMetricValue} ${styles.heroMetricValueHighlight}`}>
            {contractualFoundation.contractedValueFormatted ?? "—"}
          </span>
          <span className={styles.heroMetricSub}>Contrato nº {contractNumber}</span>
        </div>

        <div className={styles.heroMetricCard}>
          <span className={styles.heroMetricLabel}>Medição Atual</span>
          <span className={styles.heroMetricValue}>
            {measurement.hasActiveMeasurement && measurement.bulletinNumber ? `BM ${String(measurement.bulletinNumber).padStart(2, "0")}` : "BM 08"}
          </span>
          <span className={styles.heroMetricSub}>
            {measurement.statusLabel} · {measurement.analyzedLinesCount} linhas
          </span>
        </div>

        <div className={styles.heroMetricCard}>
          <span className={styles.heroMetricLabel}>Planejamento</span>
          <span className={styles.heroMetricValue}>
            {planning.hasPlanning ? "Curva S" : "Sem Planejamento"}
          </span>
          <span className={styles.heroMetricSub}>
            {planning.statusLabel}
          </span>
        </div>

        <div className={styles.heroMetricCard}>
          <span className={styles.heroMetricLabel}>Estrutura da Obra</span>
          <span className={styles.heroMetricValue}>
            {structure.totalItemsCount} itens
          </span>
          <span className={styles.heroMetricSub}>
            {structure.scopeGroupsLabel || `${structure.mainScopeGroupsCount} grupos principais · ${structure.subScopeGroupsCount} subgrupos`}
          </span>
        </div>
      </div>

      {/* Grid de Seções Executivas */}
      <div className={styles.sectionGrid}>
        {/* SEÇÃO A: BASE CONTRATUAL DA OBRA */}
        <Card className={`${styles.cardFull} workspace-card`} title="Base Contratual da Obra">
          <div className={styles.baselineHero}>
            <div>
              <span className={styles.baselineHeroTitle}>Valor Contratado</span>
              <div className={styles.baselineHeroAmount}>
                {contractualFoundation.contractedValueFormatted ?? "—"}
              </div>
            </div>
            <StatusBadge status="completed">{`Contrato nº ${contractNumber}`}</StatusBadge>
          </div>

          <div className={styles.breakdownGrid}>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Itens Contratados</span>
              <span className={styles.breakdownValue}>{structure.totalItemsCount} itens</span>
            </div>

            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Soma Econômica dos Itens</span>
              <span className={styles.breakdownValue}>{contractualFoundation.derivedItemsTotalFormatted ?? "—"}</span>
            </div>

            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Ajuste Contratual de Arredondamento</span>
              <span className={styles.breakdownValue} style={{ color: "var(--text-secondary-strong)" }}>
                {contractualFoundation.roundingAdjustmentFormatted ?? "R$ 0,00"}
              </span>
            </div>
          </div>

          <div className={styles.roundingNote}>
            O valor contratual considera o ajuste de arredondamento previsto na base da obra.
          </div>

          {hasFinancialComparison &&
            contractualFoundation.historicalOfficialBudgetFormatted &&
            contractualFoundation.contractedValueFormatted && (
            <div className={styles.valueComparison}>
              <div className={styles.valueComparisonHeader}>
                <div>
                  <span className={styles.valueComparisonEyebrow}>Licitação x Contrato</span>
                  <strong className={styles.valueComparisonTitle}>Comparação financeira da contratação</strong>
                </div>
                <span className={styles.valueComparisonDelta}>
                  {financialVariationLabel} {financialVariationFormatted}%
                </span>
              </div>

              <div className={styles.valueComparisonGrid}>
                <div className={styles.valueComparisonMetric}>
                  <span className={styles.valueComparisonMetricLabel}>Valor da Licitação</span>
                  <strong className={styles.valueComparisonMetricValue}>
                    {contractualFoundation.historicalOfficialBudgetFormatted}
                  </strong>
                  <span className={styles.valueComparisonMetricHint}>Referência oficial</span>
                </div>

                <div className={styles.valueComparisonArrow} aria-hidden="true">
                  <ArrowRight size={20} />
                </div>

                <div className={`${styles.valueComparisonMetric} ${styles.valueComparisonMetricContract}`}>
                  <span className={styles.valueComparisonMetricLabel}>Valor Contratado</span>
                  <strong className={styles.valueComparisonMetricValue}>
                    {contractualFoundation.contractedValueFormatted}
                  </strong>
                  <span className={styles.valueComparisonMetricHint}>Base vigente da obra</span>
                </div>
              </div>

              <div className={styles.valueComparisonBars} aria-label="Comparação visual entre licitação e contrato">
                <div className={styles.valueComparisonBarRow}>
                  <span>Licitação</span>
                  <div className={styles.valueComparisonTrack}>
                    <div className={`${styles.valueComparisonFill} ${styles.valueComparisonFillReference}`} style={{ width: "100%" }} />
                  </div>
                </div>
                <div className={styles.valueComparisonBarRow}>
                  <span>Contrato</span>
                  <div className={styles.valueComparisonTrack}>
                    <div
                      className={`${styles.valueComparisonFill} ${styles.valueComparisonFillContract}`}
                      style={{ width: `${contractedSharePercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.valueComparisonFooter}>
                Diferença em relação à licitação:
                <strong>{financialDifferenceFormatted}</strong>
              </div>
            </div>
          )}
        </Card>

        {/* SEÇÃO B: CONSÓRCIO E CENTROS DE CUSTO */}
        {contractualFoundation.consortium && (
          <Card className={`${styles.cardHalf} workspace-card`} title="Consórcio e Centros de Custo">
            <div className={styles.operationalCardBody}>
              <div>
                <strong style={{ color: "var(--text-primary)", fontSize: "1rem" }}>
                  {contractualFoundation.consortium.legalName}
                </strong>
                {contractualFoundation.consortium.cnpj && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                    CNPJ: {contractualFoundation.consortium.cnpj} · Composição: Consolidada
                  </div>
                )}
              </div>

              <div className={styles.consortiumMemberList}>
                {contractualFoundation.consortium.members.map((member) => (
                  <div
                    className={`${styles.memberCard} ${member.isLeader ? styles.memberCardLeader : ""}`}
                    key={member.memberId}
                  >
                    <div className={styles.memberHeader}>
                      <span className={styles.memberName}>
                        {member.partyTradeName || member.partyName}
                      </span>
                      <span className={styles.memberShare}>{member.sharePercentage}</span>
                    </div>

                    <div className={styles.memberDetails}>
                      {member.isLeader ? (
                        <StatusBadge status="active">Líder do Consórcio</StatusBadge>
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>Consorciada</span>
                      )}
                      {member.partyIdentifier && (
                        <div style={{ marginTop: "0.25rem" }}>CNPJ: {member.partyIdentifier}</div>
                      )}
                    </div>

                    {member.costCenter && (
                      <div className={styles.costCenterTag}>
                        <Banknote size={14} aria-hidden="true" />
                        <span className={styles.costCenterLabel}>Centro de Custo</span>
                        <span className={styles.costCenterCode}>{member.costCenter.code}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                Os centros de custo permitem separar a apropriação operacional de cada consorciado.
              </p>

              <div className={styles.actionRow}>
                <Link className="bba-button bba-button--primary bba-button--sm" href={costCentersHref}>
                  <Banknote size={16} /> Abrir Centros de Custo
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* SEÇÃO C: MEDIÇÕES EM ANDAMENTO */}
        <Card className={`${styles.cardHalf} workspace-card`} title="Medição em Andamento">
          <div className={styles.operationalCardBody}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ color: "var(--text-primary)", fontSize: "1.15rem" }}>
                  {measurement.bulletinNumber ? `Boletim de Medição nº ${String(measurement.bulletinNumber).padStart(2, "0")}` : "Boletim de Medição BM 08"}
                </strong>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.15rem" }}>
                  {measurement.latestImportFileName ? `Origem: ${measurement.latestImportFileName}` : "Medição operacional"}
                </div>
              </div>
              <StatusBadge status="active">{measurement.statusLabel}</StatusBadge>
            </div>

            <div className={styles.operationalFacts}>
              <div className={styles.operationalFact}>
                <span className={styles.operationalFactLabel}>Situação Técnica</span>
                <span className={styles.operationalFactValue}>{measurement.statusLabel}</span>
              </div>
              <div className={styles.operationalFact}>
                <span className={styles.operationalFactLabel}>Linhas Analisadas</span>
                <span className={styles.operationalFactValue}>{measurement.analyzedLinesCount} linhas de serviço</span>
              </div>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.5" }}>
              A medição está em fase de análise técnica e verificação de quantitativos executados.
            </p>

            <div className={styles.actionRow}>
              {measurement.latestImportId ? (
                <Link
                  className="bba-button bba-button--primary bba-button--sm"
                  href={`/medicoes/${encodeURIComponent(measurement.latestImportId)}`}
                >
                  <Ruler size={16} /> Ver Relatório Executivo da Medição
                </Link>
              ) : (
                <Link className="bba-button bba-button--secondary bba-button--sm" href="/medicoes">
                  <Ruler size={16} /> Abrir Medições
                </Link>
              )}
            </div>
          </div>
        </Card>

        {/* SEÇÃO D: PLANEJAMENTO E CURVA S */}
        <Card className={`${styles.cardHalf} workspace-card`} title="Planejamento e Curva S">
          <div className={styles.operationalCardBody}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ color: "var(--text-primary)", fontSize: "1rem" }}>
                  Cronograma e Curva S
                </strong>
                {planning.latestFileName && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.15rem" }}>
                    Arquivo: {planning.latestFileName}
                  </div>
                )}
              </div>
              <StatusBadge status={planning.hasPlanning ? "completed" : "pending"}>
                {planning.statusLabel}
              </StatusBadge>
            </div>

            <div className={styles.operationalFacts}>
              <div className={styles.operationalFact}>
                <span className={styles.operationalFactLabel}>Curva S</span>
                <span className={styles.operationalFactValue}>{planning.hasPlanning ? "Disponível" : "Não disponível"}</span>
              </div>
              <div className={styles.operationalFact}>
                <span className={styles.operationalFactLabel}>Snapshots de Decisão</span>
                <span className={styles.operationalFactValue}>{planning.snapshotCount} registros</span>
              </div>
            </div>

            {planning.latestNarrative && (
              <div className={styles.narrativeBox}>
                <span className={styles.narrativeTitle}>
                  <Sparkles size={15} /> {planning.latestNarrative.title || "Análise de Planejamento"}
                </span>
                <p className={styles.narrativeText}>{planning.latestNarrative.text}</p>
                <span className={styles.narrativeContext}>{planning.latestNarrative.contextNote}</span>
              </div>
            )}

            <div className={styles.actionRow}>
              <Link className="bba-button bba-button--secondary bba-button--sm" href={projectStudioHref}>
                <GanttChartSquare size={16} /> Abrir Project Studio
              </Link>
            </div>
          </div>
        </Card>

        {/* SEÇÃO E: ESTRUTURA CONTRATUAL */}
        <Card className={`${styles.cardHalf} workspace-card`} title="Estrutura Contratual">
          <div className={styles.operationalCardBody}>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.5" }}>
              Estrutura Analítica do Projeto (EAP) organizada em grupos de escopo e itens de serviço contratuais.
            </p>

            <div className={styles.operationalFacts}>
              <div className={styles.operationalFact}>
                <span className={styles.operationalFactLabel}>Itens de Serviço</span>
                <span className={styles.operationalFactValue}>{structure.totalItemsCount} itens</span>
              </div>
              <div className={styles.operationalFact}>
                <span className={styles.operationalFactLabel}>Grupos Principais</span>
                <span className={styles.operationalFactValue}>{structure.mainScopeGroupsCount} grupos</span>
              </div>
              <div className={styles.operationalFact}>
                <span className={styles.operationalFactLabel}>Subgrupos</span>
                <span className={styles.operationalFactValue}>{structure.subScopeGroupsCount} subgrupos</span>
              </div>
              <div className={styles.operationalFact}>
                <span className={styles.operationalFactLabel}>Valor Total dos Itens</span>
                <span className={styles.operationalFactValue}>{structure.itemsTotalValueFormatted ?? "—"}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
