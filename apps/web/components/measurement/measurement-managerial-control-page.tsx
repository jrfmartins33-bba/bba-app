"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import { Card } from "@bba/ui";
import { useBbaStore } from "@bba/lib";
import { fetchManagerialControl, type ManagerialControlView } from "./measurement-managerial-control-client";
import { MeasurementManagerialControlItemRow } from "./measurement-managerial-control-item-row";
import {
  applyManagerialFilter,
  DEFAULT_MANAGERIAL_FILTER,
  formatManagerialBRL,
  formatManagerialPercent,
  formatManagerialStatus,
  MANAGERIAL_STATUS_ORDER,
  type ManagerialFilterState,
  type ManagerialSortKey
} from "./measurement-managerial-control-view-model";
import type { ManagerialItemStatus } from "@/lib/bdos/measurement-managerial-control-service";
import type {
  PhysicalFinancialExecutionHistory,
  PhysicalFinancialHistoryPoint
} from "@/lib/bdos/measurement-physical-financial-analysis-service";
import { formatPhysicalFinancialSituation, physicalFinancialSituationTone } from "./measurement-review-view-model";

type PageState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly view: ManagerialControlView }
  | { readonly status: "not_found" }
  | { readonly status: "technical_error" };

/**
 * "Controle Gerencial da Execução" — posição item a item do CONTRATO.
 * Camada A: contrato + BM do período + posição certificada + contexto
 * do grupo. O acumulado histórico item a item (MED-01…MED-N) NÃO está
 * importado — a página deixa isso explícito e nunca lê "zero" como
 * "sem execução". Human-first: a tabela é ferramenta de exploração, não
 * a única interface.
 */
export function MeasurementManagerialControlPage({ measurementBulletinImportId }: { measurementBulletinImportId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signOut = useBbaStore((state) => state.signOut);
  const hydrateSession = useBbaStore((state) => state.hydrateSession);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [filter, setFilter] = useState<ManagerialFilterState>(() => ({
    ...DEFAULT_MANAGERIAL_FILTER,
    groupCode: searchParams.get("grupo") ?? "all"
  }));

  const load = useCallback(async () => {
    setState({ status: "loading" });
    let outcome = await fetchManagerialControl(measurementBulletinImportId);
    if (outcome.kind === "unauthenticated") {
      const stillAuthenticated = await hydrateSession();
      if (stillAuthenticated) outcome = await fetchManagerialControl(measurementBulletinImportId);
    }
    if (outcome.kind === "unauthenticated") {
      signOut();
      router.replace("/login");
      return;
    }
    if (outcome.kind === "ok") {
      setState({ status: "loaded", view: outcome.view });
      return;
    }
    setState({ status: outcome.kind });
  }, [hydrateSession, measurementBulletinImportId, router, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="section-grid managerial-control-page">
      {state.status === "loading" ? (
        <Card className="span-12 workspace-card" title="Controle Gerencial da Execução">
          <p className="workspace-card__description">Carregando posição item a item do contrato...</p>
        </Card>
      ) : null}

      {state.status === "not_found" || state.status === "technical_error" ? (
        <Card className="span-12 workspace-card" title="Controle Gerencial da Execução">
          <p className="workspace-card__description">Não foi possível carregar o controle gerencial agora.</p>
        </Card>
      ) : null}

      {state.status === "loaded" ? <LoadedView view={state.view} filter={filter} setFilter={setFilter} /> : null}
    </section>
  );
}

function LoadedView({
  view,
  filter,
  setFilter
}: {
  readonly view: ManagerialControlView;
  readonly filter: ManagerialFilterState;
  readonly setFilter: (next: ManagerialFilterState) => void;
}) {
  const s = view.summary;
  const filteredItems = useMemo(() => applyManagerialFilter(view.items, filter), [view.items, filter]);
  const groupCodes = useMemo(
    () => Array.from(new Set(view.items.map((i) => i.groupCode).filter((c): c is string => c !== null))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [view.items]
  );

  if (!view.available) {
    return (
      <Card className="span-12 workspace-card" title="Controle Gerencial da Execução">
        <p className="workspace-card__description">{view.unavailableReason ?? "Base contratual ainda não disponível."}</p>
      </Card>
    );
  }

  const contractReferenceDecimal = s.contractOfficialValueDecimal ?? s.itemsCanonicalSumDecimal;
  const registeredPercentLabel = s.bdosRegisteredFinancialPercent
    ? formatManagerialPercent(s.bdosRegisteredFinancialPercent)
    : null;
  const bulletinLabel = s.currentBulletinNumber ?? "atual";
  const headline =
    `${s.itemsWithBdosMeasurement} de ${s.totalItems} itens com medição registrada · ` +
    `registrado ${formatManagerialBRL(s.bdosRegisteredValueTotalDecimal)}` +
    `${registeredPercentLabel ? ` (${registeredPercentLabel})` : ""} de ${formatManagerialBRL(contractReferenceDecimal)} · ` +
    `saldo consolidado ${formatManagerialBRL(s.contractBalanceTotalDecimal)}`;

  return (
    <>
      <Card className="span-12 workspace-card managerial-control-summary" title="Controle Gerencial da Execução">
        <p className="managerial-control-summary__subtitle">Posição item a item do contrato · {s.totalItems} itens</p>

        <div className="managerial-control-kpis">
          <div className="managerial-control-kpi managerial-control-kpi--accent">
            <span className="managerial-control-kpi__label">Valor do contrato</span>
            <span className="managerial-control-kpi__value">{formatManagerialBRL(contractReferenceDecimal)}</span>
            <span className="managerial-control-kpi__hint">
              {s.contractOfficialValueDecimal ? "Base Contratual da Obra" : "Soma dos itens (base contratual indisponível)"}
            </span>
          </div>
          <div className="managerial-control-kpi">
            <span className="managerial-control-kpi__label">
              Registrado · BM {bulletinLabel}{s.currentBulletinCertified ? " · certificado" : ""}
            </span>
            <span className="managerial-control-kpi__value">{formatManagerialBRL(s.bdosRegisteredValueTotalDecimal)}</span>
            <span className="managerial-control-kpi__hint">
              {registeredPercentLabel ? `${registeredPercentLabel} do contrato` : "—"}
            </span>
          </div>
          <div className="managerial-control-kpi">
            <span className="managerial-control-kpi__label">Saldo consolidado</span>
            <span className="managerial-control-kpi__value">{formatManagerialBRL(s.contractBalanceTotalDecimal)}</span>
            <span className="managerial-control-kpi__hint">Contrato − registrado</span>
          </div>
        </div>

        <p className="managerial-control-headline">{headline}</p>

        <div className="managerial-control-counters">
          <Counter n={s.totalItems} label="contratados" />
          <Counter n={s.itemsWithBdosMeasurement} label="com medição" />
          <Counter n={s.itemsWithoutBdosMeasurement} label="sem medição" />
          <Counter n={s.itemsMeasuredThisPeriod} label={`medidos no BM ${bulletinLabel}`} />
          <Counter n={s.itemsContractQuantityReached} label="qtd. contratada atingida" />
          {s.itemsAboveContractQuantity > 0 ? (
            <Counter n={s.itemsAboveContractQuantity} label="acima da qtd. contratada" tone="caution" />
          ) : null}
          {s.itemsInsufficientBasis > 0 ? <Counter n={s.itemsInsufficientBasis} label="base insuficiente" /> : null}
        </div>

        <details className="managerial-control-legend">
          <summary>Como ler estes números</summary>
          <div className="managerial-control-legend__body">
            <p>
              <strong>Histórico acumulado item a item ainda não importado.</strong> O sistema registra por item apenas o
              BM {bulletinLabel} ({s.currentPeriodLabel ?? "período atual"}); as medições anteriores existem só nas
              memórias de cálculo do arquivo-fonte. &ldquo;Sem medição registrada&rdquo; não é ausência de execução da
              obra{s.certificationRegistered
                ? ""
                : ". Nenhuma certificação histórica registrada — “certificado = R$ 0,00” significa isso"}.
            </p>
            <p>
              {s.currentBulletinCertified
                ? `O BM ${bulletinLabel} já está certificado — a posição registrada é o acumulado certificado, sem somar o BM de novo (o valor do período continua visível item a item).`
                : `O BM ${bulletinLabel} ainda não está certificado — a posição registrada é o acumulado certificado anterior + o BM atual, sem dupla contagem.`}
            </p>
            {s.contractOfficialValueDecimal && s.itemsTechnicalTotalDecimal && s.contractRoundingAdjustmentDecimal ? (
              <p>
                <strong>Reconciliação contratual (Base Contratual da Obra):</strong> soma técnica dos itens{" "}
                {formatManagerialBRL(s.itemsTechnicalTotalDecimal)} + ajuste contratual de arredondamento{" "}
                {formatManagerialBRL(s.contractRoundingAdjustmentDecimal)} = valor oficial do contrato{" "}
                {formatManagerialBRL(s.contractOfficialValueDecimal)}. O ajuste nunca é rateado pelos itens.
              </p>
            ) : null}
            {s.obraReference ? (
              <p>
                Posição físico-financeira da obra (Curva S, grupo a grupo): realizado acumulado{" "}
                <strong>{formatManagerialBRL(s.obraReference.actualAccumulatedValueDecimal)}</strong>
                {s.obraReference.actualAccumulatedPercent
                  ? ` (${formatManagerialPercent(s.obraReference.actualAccumulatedPercent)})`
                  : ""}{" "}
                — não decompõe nos itens porque o histórico item a item não está importado.
              </p>
            ) : null}
            {s.currentBulletinTotalValueDecimal && s.currentBulletinLinesSumDecimal ? (
              <p>
                Reconciliação do BM {s.currentBulletinNumber}: soma das linhas{" "}
                {formatManagerialBRL(s.currentBulletinLinesSumDecimal)} = total do boletim{" "}
                {formatManagerialBRL(s.currentBulletinTotalValueDecimal)}.
              </p>
            ) : null}
          </div>
        </details>
      </Card>

      <Card className="span-12 workspace-card managerial-control-analyses" title="Análises gerenciais">
        <div className="managerial-control-analyses__grid">
          <AnalysisBlock
            icon={<TrendingUp aria-hidden="true" size={15} />}
            title={`Maiores valores registrados · BM ${bulletinLabel}`}
            variant="value"
          >
            <RankedList
              empty="Nenhum item com valor registrado."
              rows={view.analyses.topByRegisteredValue.map((i) => ({
                code: i.code,
                description: i.description,
                metric: formatManagerialBRL(i.valueDecimal)
              }))}
            />
          </AnalysisBlock>

          <AnalysisBlock icon={<Wallet aria-hidden="true" size={15} />} title="Maiores saldos contratuais" variant="balance">
            <RankedList
              empty="Sem saldos a exibir."
              rows={view.analyses.topByContractBalance.map((i) => ({
                code: i.code,
                description: i.description,
                metric: formatManagerialBRL(i.valueDecimal)
              }))}
            />
          </AnalysisBlock>

          <AnalysisBlock icon={<CircleCheck aria-hidden="true" size={15} />} title="Atingiram 100% da quantidade" variant="full">
            <RankedList
              empty="Nenhum item atingiu 100% da quantidade contratada."
              rows={view.analyses.itemsAtFullContractQuantity.map((i) => ({ code: i.code, description: i.description }))}
            />
          </AnalysisBlock>

          <AnalysisBlock
            icon={<TriangleAlert aria-hidden="true" size={15} />}
            title="Acima da quantidade contratada"
            variant="above"
          >
            <RankedList
              empty="Nenhum item acima da quantidade contratada."
              rows={view.analyses.itemsAboveContractQuantity.map((i) => ({
                code: i.code,
                description: i.description,
                metric: formatManagerialPercent(i.executedPercent) ?? "—"
              }))}
            />
          </AnalysisBlock>
        </div>

        <p className="managerial-control-analyses__note">
          {view.analyses.valueConcentration
            ? `Os ${view.analyses.valueConcentration.topCount} maiores itens concentram ${
                formatManagerialPercent(view.analyses.valueConcentration.sharePercent) ?? "—"
              } do valor registrado no BM ${bulletinLabel} (${formatManagerialBRL(
                view.analyses.valueConcentration.topValueDecimal
              )} de ${formatManagerialBRL(view.analyses.valueConcentration.totalValueDecimal)}). `
            : ""}
          {view.analyses.itemsWithoutMeasurementCount} itens ainda sem medição registrada.
        </p>
      </Card>

      <Card className="span-12 workspace-card managerial-control-history" title="Evolução da execução">
        <ExecutionHistorySection history={view.executionHistory} />
      </Card>

      <Card
        action={<span className="measurement-section-count">{filteredItems.length} de {view.items.length}</span>}
        className="span-12 workspace-card managerial-control-table-card"
        title="Itens do contrato"
      >
        <div className="managerial-control-filters">
          <input
            aria-label="Buscar por código ou serviço"
            className="managerial-control-filters__search"
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            placeholder="Buscar por código ou serviço"
            type="search"
            value={filter.search}
          />
          <select aria-label="Grupo" onChange={(e) => setFilter({ ...filter, groupCode: e.target.value })} value={filter.groupCode}>
            <option value="all">Todos os grupos</option>
            {groupCodes.map((c) => (
              <option key={c} value={c}>Grupo {c}</option>
            ))}
          </select>
          <select
            aria-label="Situação"
            onChange={(e) => setFilter({ ...filter, status: e.target.value as ManagerialItemStatus | "all" })}
            value={filter.status}
          >
            <option value="all">Todas as situações</option>
            {MANAGERIAL_STATUS_ORDER.map((st) => (
              <option key={st} value={st}>{formatManagerialStatus(st)}</option>
            ))}
          </select>
          <select
            aria-label="Ordenar"
            onChange={(e) => setFilter({ ...filter, sort: e.target.value as ManagerialSortKey })}
            value={filter.sort}
          >
            <option value="code">Ordenar: código</option>
            <option value="contract_value">Ordenar: maior valor contratual</option>
            <option value="registered_value">Ordenar: maior valor registrado</option>
            <option value="balance">Ordenar: maior saldo</option>
            <option value="executed_percent">Ordenar: maior % executado</option>
          </select>
          <label className="managerial-control-filters__check">
            <input checked={filter.onlyMeasuredThisPeriod} onChange={(e) => setFilter({ ...filter, onlyMeasuredThisPeriod: e.target.checked })} type="checkbox" />
            Medidos no BM {s.currentBulletinNumber ?? "atual"}
          </label>
          <label className="managerial-control-filters__check">
            <input checked={filter.onlyWithoutMeasurement} onChange={(e) => setFilter({ ...filter, onlyWithoutMeasurement: e.target.checked })} type="checkbox" />
            Sem medição
          </label>
          <label className="managerial-control-filters__check">
            <input checked={filter.onlyAboveContractQuantity} onChange={(e) => setFilter({ ...filter, onlyAboveContractQuantity: e.target.checked })} type="checkbox" />
            Acima da qtd. contratada
          </label>
        </div>

        <div className="managerial-control-panel">
          <ul className="managerial-control-items">
            <li className="managerial-control-item managerial-control-item--head" aria-hidden="true">
              <div className="managerial-control-item__row">
                <span className="managerial-control-item__code">Código</span>
                <span className="managerial-control-item__description">Serviço</span>
                <span className="managerial-control-item__group">Grupo</span>
                <span className="managerial-control-item__exec">% executado</span>
                <span className="managerial-control-item__value">Valor registrado</span>
                <span className="managerial-control-item__status">Situação</span>
                <span className="managerial-control-item__toggle" />
              </div>
            </li>
            {filteredItems.map((item) => (
              <MeasurementManagerialControlItemRow item={item} key={item.id} />
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}

function shortMonthLabel(point: { readonly periodLabel: string; readonly periodDate: string }): string {
  // "2026-06-01" -> "jun/26". Determinístico, sem Date/locale.
  const match = /^(\d{4})-(\d{2})/.exec(point.periodDate);
  if (!match) return point.periodLabel;
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const monthIndex = Number(match[2]) - 1;
  const name = names[monthIndex] ?? match[2];
  return `${name}/${match[1].slice(2)}`;
}

const historyBRL = (value: string | null): string => (value === null ? "—" : formatManagerialBRL(value));

function HistorySituationBadge({ situation }: { readonly situation: PhysicalFinancialHistoryPoint["situation"] }) {
  if (situation === null) {
    return <span className="managerial-control-item__status managerial-control-item__status--neutral">Sem realização</span>;
  }
  return (
    <span
      className={`managerial-control-item__status managerial-control-item__status--${physicalFinancialSituationTone(situation)}`}
    >
      {formatPhysicalFinancialSituation(situation)}
    </span>
  );
}

function ExecutionHistorySection({ history }: { readonly history: PhysicalFinancialExecutionHistory | null }) {
  const periodCount = history?.obra.length ?? 0;
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, periodCount - 1));

  if (!history || !history.available || history.obra.length === 0) {
    return (
      <p className="managerial-control-history__empty">
        {history?.unavailableReason ??
          "A evolução mensal ficará disponível quando houver um cronograma físico-financeiro consolidado para esta obra."}
      </p>
    );
  }

  const clampedIndex = Math.min(selectedIndex, history.obra.length - 1);
  const point = history.obra[clampedIndex];
  const groupsForPeriod = history.groups
    .map((group) => ({ groupCode: group.groupCode, groupName: group.groupName, point: group.points[clampedIndex] ?? null }))
    .filter((entry): entry is { groupCode: string; groupName: string; point: PhysicalFinancialHistoryPoint } => entry.point !== null);

  return (
    <div className="managerial-control-history__body">
      <div className="managerial-control-history__toolbar">
        <label className="managerial-control-history__period">
          <span>Período</span>
          <select
            aria-label="Período da evolução"
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
            value={String(clampedIndex)}
          >
            {history.obra.map((historyPoint, index) => (
              <option key={historyPoint.periodDate} value={String(index)}>
                {shortMonthLabel(historyPoint)} · {historyPoint.periodLabel}
              </option>
            ))}
          </select>
        </label>
        <span className="managerial-control-history__source">
          Curva S{history.sourceFileName ? ` · ${history.sourceFileName}` : ""} — espinha dorsal histórica da obra e dos
          grupos; não substitui o histórico item a item.
        </span>
      </div>

      <div className="managerial-control-history__kpis">
        <HistoryTile label="Realizado no período" value={historyBRL(point.actualPeriodValueDecimal)} />
        <HistoryTile
          label="Realizado acumulado"
          value={historyBRL(point.actualAccumulatedValueDecimal)}
          hint={
            point.actualAccumulatedPercent
              ? `${formatManagerialPercent(point.actualAccumulatedPercent)} do previsto total`
              : undefined
          }
        />
        <HistoryTile
          label="Planejado acumulado"
          value={historyBRL(point.plannedAccumulatedValueDecimal)}
          hint={
            point.plannedAccumulatedPercent
              ? `${formatManagerialPercent(point.plannedAccumulatedPercent)} do previsto total`
              : undefined
          }
        />
        <HistoryTile
          label="Desvio acumulado"
          value={historyBRL(point.deviationAccumulatedValueDecimal)}
          hint={
            point.deviationAccumulatedPercentPoints
              ? `${formatManagerialPercent(point.deviationAccumulatedPercentPoints)} p.p.`
              : undefined
          }
          tone={point.situation === null ? "neutral" : physicalFinancialSituationTone(point.situation)}
        />
      </div>

      <p className="managerial-control-history__situation">
        <HistorySituationBadge situation={point.situation} /> no acumulado até {shortMonthLabel(point)} · planejado no
        período {historyBRL(point.plannedPeriodValueDecimal)}.
      </p>

      <details className="managerial-control-history__disclosure">
        <summary>Obra — mês a mês</summary>
        <div className="managerial-control-history__table-wrap">
          <table className="managerial-control-history__table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Realizado no período</th>
                <th>Realizado acumulado</th>
                <th>Planejado acumulado</th>
                <th>Desvio acumulado</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {history.obra.map((historyPoint) => (
                <tr key={historyPoint.periodDate}>
                  <td>{shortMonthLabel(historyPoint)}</td>
                  <td>{historyBRL(historyPoint.actualPeriodValueDecimal)}</td>
                  <td>{historyBRL(historyPoint.actualAccumulatedValueDecimal)}</td>
                  <td>{historyBRL(historyPoint.plannedAccumulatedValueDecimal)}</td>
                  <td>{historyBRL(historyPoint.deviationAccumulatedValueDecimal)}</td>
                  <td>
                    <HistorySituationBadge situation={historyPoint.situation} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {groupsForPeriod.length > 0 ? (
        <details className="managerial-control-history__disclosure">
          <summary>Grupos — {shortMonthLabel(point)}</summary>
          <div className="managerial-control-history__table-wrap">
            <table className="managerial-control-history__table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Realizado no período</th>
                  <th>Realizado acumulado</th>
                  <th>Planejado acumulado</th>
                  <th>Desvio acumulado</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {groupsForPeriod.map((entry) => (
                  <tr key={entry.groupCode}>
                    <td>
                      <b>{entry.groupCode}</b> {entry.groupName}
                    </td>
                    <td>{historyBRL(entry.point.actualPeriodValueDecimal)}</td>
                    <td>{historyBRL(entry.point.actualAccumulatedValueDecimal)}</td>
                    <td>{historyBRL(entry.point.plannedAccumulatedValueDecimal)}</td>
                    <td>{historyBRL(entry.point.deviationAccumulatedValueDecimal)}</td>
                    <td>
                      <HistorySituationBadge situation={entry.point.situation} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function HistoryTile({
  label,
  value,
  hint,
  tone
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: "info" | "neutral" | "caution";
}) {
  return (
    <div className={`managerial-control-history__tile${tone ? ` managerial-control-history__tile--${tone}` : ""}`}>
      <span className="managerial-control-history__tile-label">{label}</span>
      <span className="managerial-control-history__tile-value">{value}</span>
      {hint ? <span className="managerial-control-history__tile-hint">{hint}</span> : null}
    </div>
  );
}

function Counter({ n, label, tone }: { readonly n: number; readonly label: string; readonly tone?: "caution" }) {
  return (
    <span className={`managerial-control-counter${tone ? ` managerial-control-counter--${tone}` : ""}`}>
      <span className="managerial-control-counter__n">{n}</span>
      <span className="managerial-control-counter__label">{label}</span>
    </span>
  );
}

function AnalysisBlock({
  variant,
  icon,
  title,
  children
}: {
  readonly variant: "value" | "balance" | "full" | "above";
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={`managerial-control-analyses__block managerial-control-analyses__block--${variant}`}>
      <div className="managerial-control-analyses__head">
        {icon}
        <h4>{title}</h4>
      </div>
      {children}
    </section>
  );
}

function RankedList({
  rows,
  empty
}: {
  readonly rows: ReadonlyArray<{ readonly code: string; readonly description: string; readonly metric?: string }>;
  readonly empty: string;
}) {
  if (rows.length === 0) {
    return <p className="managerial-control-analyses__empty">{empty}</p>;
  }
  return (
    <ol>
      {rows.map((row, index) => (
        <li key={row.code}>
          <span className="managerial-control-analyses__rank">{index + 1}</span>
          <span className="managerial-control-analyses__name">
            <b>{row.code}</b>
            {row.description}
          </span>
          {row.metric ? <span className="managerial-control-analyses__metric">{row.metric}</span> : <span />}
        </li>
      ))}
    </ol>
  );
}
