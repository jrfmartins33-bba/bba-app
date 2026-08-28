"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, Info, RotateCw } from "lucide-react";
import { Card, SkeletonCard } from "@bba/ui";
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
// (BDOS calcula, UI apresenta): strings já formatadas em BRL/percentual,
// larguras de barra inteiras 0..100 e identidade visual por tom. Nenhuma
// conversão numérica de decimal canônico acontece aqui.

/** "cost-center-tone-2" → classe CSS do tom. O tom é só IDENTIDADE do Centro de Custo. */
function toneClass(toneKey: string): string {
  const n = toneKey.split("-").pop() ?? "1";
  return styles[`tone${n}`] ?? styles.tone1;
}

export function ProjectCostCentersPage({ projectId }: ProjectCostCentersPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
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

  const onSelectPeriod = useCallback(
    (value: string) => {
      const query = new URLSearchParams();
      if (requestedOrganizationId) query.set("empresa", requestedOrganizationId);
      query.set("periodo", value);
      router.push(`${pathname}?${query.toString()}`);
    },
    [pathname, requestedOrganizationId, router],
  );

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
      onSelectPeriod={onSelectPeriod}
    />
  );
}

function ToneDot({ toneKey }: { toneKey: string }) {
  return <span className={`${styles.toneDot} ${toneClass(toneKey)}`} aria-hidden="true" />;
}

function Legend({ items }: { items: ReadonlyArray<{ id: string; displayLabel: string; toneKey: string }> }) {
  return (
    <div className={styles.legend}>
      {items.map((it) => (
        <span className={styles.legendItem} key={it.id}>
          <ToneDot toneKey={it.toneKey} /> {it.displayLabel}
        </span>
      ))}
    </div>
  );
}

function CostCentersReady({
  readModel,
  backHref,
  expandedEntryId,
  setExpandedEntryId,
  onSelectPeriod,
}: {
  readModel: ProjectCostCentersReadModel;
  backHref: string;
  expandedEntryId: string | null;
  setExpandedEntryId: (id: string | null) => void;
  onSelectPeriod: (value: string) => void;
}) {
  const rm = readModel;
  const isDemonstrative = rm.isDemonstrative;
  const notMaterialized = rm.operationalState === "not_materialized";
  const noEntries = !notMaterialized && !rm.hasCostEntries;
  const hasConsortiumShare = rm.costCenters.some((cc) => cc.consortiumSharePercent !== null);
  const mc = rm.measurementComparison;
  const matrix = rm.costMatrix;
  const legendItems = rm.costCenters.map((cc) => ({
    id: cc.id,
    displayLabel: cc.displayLabel,
    toneKey: cc.toneKey,
  }));

  return (
    <div className={styles.container}>
      {/* 1. CABEÇALHO */}
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">
            BBA Platform · Workspace Engenharia · {rm.projectName ?? "Obra"}
          </span>
          <div className={styles.headerRow}>
            <h1>Centros de Custo</h1>
            {isDemonstrative && <span className={styles.demoBadge}>DADOS DEMONSTRATIVOS</span>}
          </div>
          <p className={styles.subtitle}>Distribuição gerencial dos custos da obra</p>
          <div className={styles.periodPicker}>
            <label htmlFor="cc-period">Período</label>
            <select
              id="cc-period"
              className={styles.periodSelect}
              value={rm.period}
              onChange={(e) => onSelectPeriod(e.target.value)}
            >
              {rm.availablePeriods.map((p) => (
                <option value={p.value} key={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Link className="bba-button bba-button--ghost bba-button--sm" href={backHref}>
          <ArrowLeft size={16} /> Voltar para a obra
        </Link>
      </section>

      {isDemonstrative && (
        <p className={styles.demoNote}>
          <Info size={14} aria-hidden="true" /> Valores utilizados exclusivamente para demonstração da funcionalidade.
          Não representam os custos reais da obra.
        </p>
      )}

      {notMaterialized && (
        <div className={styles.emptyState}>Controle de custos ainda não disponível para esta obra.</div>
      )}
      {noEntries && <div className={styles.emptyState}>Não há custos registrados para este período.</div>}

      {/* 2. RESUMO EXECUTIVO */}
      {rm.hasCostEntries && (
        <div className={styles.kpiGrid}>
          <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
            <span className={styles.kpiLabel}>{isDemonstrative ? "Custos demonstrativos" : "Custos do período"}</span>
            <span className={`${styles.kpiValue} ${styles.kpiValuePrimary}`}>{rm.totalCostFormatted}</span>
            <span className={styles.kpiSub}>{rm.entries.length} despesas</span>
          </div>
          {rm.costCenters.map((cc) => (
            <div className={`${styles.kpiCard} ${styles.kpiCardTone} ${toneClass(cc.toneKey)}`} key={cc.id}>
              <span className={styles.kpiLabel}>
                <ToneDot toneKey={cc.toneKey} /> {cc.displayLabel}
              </span>
              <span className={styles.kpiValue}>{cc.allocatedCostFormatted}</span>
              <span className={styles.kpiSub}>{cc.costShareFormatted} dos custos</span>
            </div>
          ))}
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Não atribuído</span>
            <span className={styles.kpiValue}>{rm.unallocatedCostFormatted}</span>
            <span className={styles.kpiSub}>Total menos a soma das distribuições</span>
          </div>
        </div>
      )}

      <div className={styles.sectionGrid}>
        {/* 3. CUSTOS POR CENTRO DE CUSTO E CATEGORIA — bloco principal */}
        {rm.hasCostEntries && matrix.rows.length > 0 && (
          <Card className={`${styles.cardFull} workspace-card`} title="Custos por Centro de Custo e Categoria">
            <Legend items={legendItems} />

            {/* Desktop: matriz */}
            <div className={styles.matrixScroll}>
              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th>Tipo de custo</th>
                    {matrix.costCenters.map((cc) => (
                      <th key={cc.id} className={styles.matrixNum}>
                        <span className={styles.matrixHeadCell}>
                          <ToneDot toneKey={cc.toneKey} /> {cc.displayLabel}
                        </span>
                      </th>
                    ))}
                    <th className={styles.matrixNum}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row) => (
                    <tr key={row.family}>
                      <td className={styles.matrixRowLabel}>{row.familyLabel}</td>
                      {row.cells.map((cell, i) => (
                        <td
                          key={cell.costCenterId}
                          className={`${styles.matrixNum} ${styles.matrixToneValue} ${toneClass(matrix.costCenters[i].toneKey)}`}
                        >
                          {cell.amountFormatted}
                        </td>
                      ))}
                      <td className={`${styles.matrixNum} ${styles.matrixStrong}`}>{row.totalFormatted}</td>
                    </tr>
                  ))}
                  <tr className={styles.matrixTotalRow}>
                    <td className={styles.matrixRowLabel}>Total</td>
                    {matrix.columnTotals.map((cell) => (
                      <td key={cell.costCenterId} className={`${styles.matrixNum} ${styles.matrixStrong}`}>
                        {cell.amountFormatted}
                      </td>
                    ))}
                    <td className={`${styles.matrixNum} ${styles.matrixStrong}`}>{matrix.grandTotalFormatted}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile: cards por tipo de custo */}
            <div className={styles.matrixCards}>
              {matrix.rows.map((row) => (
                <div className={styles.matrixCard} key={row.family}>
                  <div className={styles.matrixCardHead}>
                    <span>{row.familyLabel}</span>
                    <strong>{row.totalFormatted}</strong>
                  </div>
                  {row.cells.map((cell, i) => (
                    <div className={styles.matrixCardRow} key={cell.costCenterId}>
                      <span>
                        <ToneDot toneKey={matrix.costCenters[i].toneKey} /> {matrix.costCenters[i].displayLabel}
                      </span>
                      <span>{cell.amountFormatted}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className={`${styles.matrixCard} ${styles.matrixCardTotalMobile}`}>
                <div className={styles.matrixCardHead}>
                  <span>Total</span>
                  <strong>{matrix.grandTotalFormatted}</strong>
                </div>
                {matrix.columnTotals.map((cell, i) => (
                  <div className={styles.matrixCardRow} key={cell.costCenterId}>
                    <span>{matrix.costCenters[i].displayLabel}</span>
                    <strong>{cell.amountFormatted}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* 4. COMPOSIÇÃO POR TIPO DE CUSTO — barra empilhada por Centro de Custo */}
        {rm.families.length > 0 && (
          <Card className={`${styles.cardFull} workspace-card`} title="Composição por tipo de custo">
            <Legend items={legendItems} />
            {rm.families.map((f) => (
              <div className={styles.familyBlock} key={f.family}>
                <div className={styles.familyHead}>
                  <span className={styles.familyName}>{f.familyLabel}</span>
                  <span className={styles.familyValue}>
                    <strong>{f.amountFormatted}</strong> · {f.shareFormatted}
                  </span>
                </div>
                <div className={styles.stackedBar}>
                  {f.costCenters.map((c) => (
                    <div
                      key={c.costCenterId}
                      className={`${styles.stackedSeg} ${toneClass(c.toneKey)}`}
                      style={{ width: `${c.barWidthPercent}%` }}
                      title={`${c.costCenterDisplayLabel} · ${c.amountFormatted} · ${c.shareWithinFamilyFormatted}`}
                    />
                  ))}
                </div>
                <div className={styles.familyCenters}>
                  {f.costCenters.map((c) => (
                    <span className={styles.familyCenterChip} key={c.costCenterId}>
                      <ToneDot toneKey={c.toneKey} /> {c.costCenterDisplayLabel}: <strong>{c.amountFormatted}</strong>{" "}
                      ({c.shareWithinFamilyFormatted})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* 5. COMO OS CUSTOS FORAM DISTRIBUÍDOS */}
        {rm.entries.length > 0 && (
          <Card className={`${styles.cardFull} workspace-card`} title="Como os custos foram distribuídos">
            <p className={styles.blockIntro}>
              Cada despesa é atribuída diretamente a um Centro de Custo ou rateada por um critério específico.
            </p>
            <div className={styles.distribList}>
              {rm.entries.map((entry) => (
                <div className={styles.distribCard} key={entry.id}>
                  <div className={styles.distribCardHead}>
                    <div>
                      <div className={styles.distribCardTitle}>{entry.description}</div>
                      <div className={styles.distribCardType}>{entry.category ?? entry.familyLabel}</div>
                    </div>
                    <div className={styles.distribCardAmount}>{entry.amountFormatted}</div>
                  </div>

                  <div className={styles.distribTargets}>
                    {entry.allocations.map((a) => (
                      <div className={styles.distribTargetRow} key={a.costCenterId}>
                        <span>
                          <ToneDot toneKey={a.toneKey} /> {a.costCenterDisplayLabel}
                        </span>
                        <span>{a.amountFormatted}</span>
                        <span className={styles.distribTargetPct}>{a.percentageFormatted}</span>
                      </div>
                    ))}
                  </div>

                  {entry.allocations.length > 1 && (
                    <div className={styles.stackedBar}>
                      {entry.allocations.map((a) => (
                        <div
                          key={a.costCenterId}
                          className={`${styles.stackedSeg} ${toneClass(a.toneKey)}`}
                          style={{ width: `${a.barWidthPercent}%` }}
                          title={`${a.costCenterDisplayLabel} · ${a.percentageFormatted}`}
                        />
                      ))}
                    </div>
                  )}

                  <div className={styles.distribCardFoot}>
                    <span className={styles.criterionTag}>{entry.criterionLabel}</span>
                    <span className={styles.natureTag}>{entry.natureLabel}</span>
                  </div>
                  {entry.distributionNote && <p className={styles.distribNote}>{entry.distributionNote}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 6. PARTICIPAÇÃO SOCIETÁRIA × DISTRIBUIÇÃO DOS CUSTOS */}
        {hasConsortiumShare && rm.hasCostEntries && (
          <Card
            className={`${styles.cardFull} workspace-card`}
            title="Participação societária × distribuição dos custos"
          >
            <div className={styles.compareGrid}>
              <div>
                <div className={styles.compareHeading}>Participação no consórcio</div>
                {rm.costCenters.map((cc) => (
                  <div className={styles.compareRow} key={cc.id}>
                    <span>
                      <ToneDot toneKey={cc.toneKey} /> {cc.displayLabel}
                    </span>
                    <strong>{cc.consortiumShareFormatted}</strong>
                  </div>
                ))}
              </div>
              <div>
                <div className={styles.compareHeading}>Distribuição dos custos demonstrativos</div>
                {rm.costCenters.map((cc) => (
                  <div className={styles.compareRow} key={cc.id}>
                    <span>
                      <ToneDot toneKey={cc.toneKey} /> {cc.displayLabel}
                    </span>
                    <strong>{cc.costShareFormatted}</strong>
                  </div>
                ))}
              </div>
            </div>
            <p className={styles.note}>{rm.consortiumVsCostDetailNote}</p>
          </Card>
        )}

        {/* 7. DESPESAS DETALHADAS */}
        {rm.entries.length > 0 && (
          <Card className={`${styles.cardFull} workspace-card`} title="Despesas detalhadas">
            <div className={styles.matrixScroll}>
              <table className={styles.expenseTable}>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Tipo de custo</th>
                    <th>Valor</th>
                    <th>Distribuição</th>
                    <th>Critério</th>
                    <th>Natureza</th>
                  </tr>
                </thead>
                <tbody>
                  {rm.entries.map((entry) => {
                    const expanded = expandedEntryId === entry.id;
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
                              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />} distribuição
                            </button>
                          </td>
                          <td>{entry.category ?? entry.familyLabel}</td>
                          <td className={styles.expenseAmount}>{entry.amountFormatted}</td>
                          <td className={styles.distribCell}>
                            {entry.allocations.map((a) => (
                              <span className={styles.distribChip} key={a.costCenterId}>
                                <ToneDot toneKey={a.toneKey} /> {a.costCenterDisplayLabel} {a.percentageFormatted}
                              </span>
                            ))}
                          </td>
                          <td>
                            <span className={styles.criterionTag}>{entry.criterionLabel}</span>
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
                                    <ToneDot toneKey={a.toneKey} /> <strong>{a.costCenterDisplayLabel}</strong>
                                    <span className={styles.allocationFull}> — {a.costCenterName}</span>
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
                              {entry.distributionNote && (
                                <p className={styles.distribNote}>{entry.distributionNote}</p>
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

        {/* 8. SIMULAÇÃO GERENCIAL DO PERÍODO */}
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

        {/* 9. NOTAS / EXPLICAÇÕES */}
        {rm.hasCostEntries && (
          <Card className={`${styles.cardFull} workspace-card`} title="Notas">
            <ul className={styles.notesList}>
              <li>
                O valor medido do período é um dado formal e documental do boletim de medição. Os custos apresentados
                nesta tela são demonstrativos e não representam os custos reais da obra.
              </li>
              <li>{rm.consortiumVsCostDetailNote}</li>
              <li>
                A diferença demonstrativa não é lucro, margem, ganho ou economia — apenas o contraste entre o valor
                medido e os custos utilizados nesta simulação.
              </li>
              <li>As cores identificam cada Centro de Custo; não indicam desempenho, positivo ou negativo.</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
