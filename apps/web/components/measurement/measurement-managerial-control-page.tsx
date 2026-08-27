"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@bba/ui";
import { useBbaStore } from "@bba/lib";
import { fetchManagerialControl, type ManagerialControlView } from "./measurement-managerial-control-client";
import { MeasurementManagerialControlItemRow } from "./measurement-managerial-control-item-row";
import {
  applyManagerialFilter,
  DEFAULT_MANAGERIAL_FILTER,
  formatManagerialBRL,
  formatManagerialPercent,
  formatManagerialQuantity,
  formatManagerialStatus,
  MANAGERIAL_STATUS_ORDER,
  type ManagerialFilterState,
  type ManagerialSortKey
} from "./measurement-managerial-control-view-model";
import type { ManagerialItemStatus } from "@/lib/bdos/measurement-managerial-control-service";

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

  return (
    <>
      <Card className="span-12 workspace-card managerial-control-summary" title="Controle Gerencial da Execução">
        <p className="managerial-control-summary__subtitle">Posição item a item do contrato</p>

        <dl className="workspace-fact-list managerial-control-summary__facts">
          <div className="workspace-fact"><dt>Itens contratados</dt><dd>{s.totalItems}</dd></div>
          <div className="workspace-fact"><dt>Com medição registrada</dt><dd>{s.itemsWithBdosMeasurement}</dd></div>
          <div className="workspace-fact"><dt>Sem medição registrada</dt><dd>{s.itemsWithoutBdosMeasurement}</dd></div>
          <div className="workspace-fact"><dt>Medidos no BM {s.currentBulletinNumber ?? "atual"}</dt><dd>{s.itemsMeasuredThisPeriod}</dd></div>
          <div className="workspace-fact"><dt>Qtd. contratada atingida</dt><dd>{s.itemsContractQuantityReached}</dd></div>
          <div className="workspace-fact"><dt>Acima da qtd. contratada</dt><dd>{s.itemsAboveContractQuantity}</dd></div>
          <div className="workspace-fact"><dt>Base insuficiente</dt><dd>{s.itemsInsufficientBasis}</dd></div>
          <div className="workspace-fact"><dt>Valor contratual (soma dos itens)</dt><dd>{formatManagerialBRL(s.contractedValueTotalDecimal)}</dd></div>
          {s.contractOfficialValueDecimal ? (
            <div className="workspace-fact">
              <dt>Ajuste / reconciliação contratual</dt>
              <dd>{formatManagerialBRL(s.contractAdjustmentDecimal ?? "0.00")}</dd>
            </div>
          ) : null}
          <div className="workspace-fact">
            <dt>Registrado no sistema (BM {s.currentBulletinNumber ?? "atual"})</dt>
            <dd>{formatManagerialBRL(s.bdosRegisteredValueTotalDecimal)}{s.bdosRegisteredFinancialPercent ? ` · ${formatManagerialPercent(s.bdosRegisteredFinancialPercent)}` : ""}</dd>
          </div>
          <div className="workspace-fact"><dt>Saldo contratual (vs. registrado)</dt><dd>{formatManagerialBRL(s.contractBalanceTotalDecimal)}</dd></div>
        </dl>

        <div className="managerial-control-summary__truth-note">
          <p>
            <strong>Histórico acumulado item a item ainda não importado.</strong> O sistema registra por item somente o BM{" "}
            {s.currentBulletinNumber ?? "atual"} ({s.currentPeriodLabel ?? "período atual"}). As medições anteriores
            (MED-01…MED-{(s.currentBulletinNumber ?? 1) - 1}) existem apenas nas memórias de cálculo do arquivo-fonte e não foram
            importadas. <em>&ldquo;Sem medição registrada&rdquo;</em> não significa ausência de execução da obra.
          </p>
          {s.certificationRegistered ? null : (
            <p>
              Nenhuma certificação histórica registrada — <em>&ldquo;certificado = R$ 0,00&rdquo;</em> significa isso, não
              &ldquo;nenhuma execução realizada&rdquo;.
            </p>
          )}
          {s.obraReference ? (
            <p className="managerial-control-summary__obra-ref">
              Posição físico-financeira da obra (Curva S, grupo a grupo): realizado acumulado{" "}
              <strong>{formatManagerialBRL(s.obraReference.actualAccumulatedValueDecimal)}</strong>
              {s.obraReference.actualAccumulatedPercent ? ` (${formatManagerialPercent(s.obraReference.actualAccumulatedPercent)})` : ""} — não decompõe
              nos itens porque o histórico item a item não está importado.
            </p>
          ) : null}
          {s.currentBulletinTotalValueDecimal && s.currentBulletinLinesSumDecimal ? (
            <p className="managerial-control-summary__recon">
              Reconciliação do BM {s.currentBulletinNumber}: soma das linhas {formatManagerialBRL(s.currentBulletinLinesSumDecimal)} = total do
              boletim {formatManagerialBRL(s.currentBulletinTotalValueDecimal)}.
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="span-12 workspace-card managerial-control-analyses" title="Análises gerenciais">
        <div className="managerial-control-analyses__grid">
          <AnalysisBlock title={`Maior valor registrado acumulado (BM ${s.currentBulletinNumber ?? "atual"})`}>
            {view.analyses.topByRegisteredValue.length === 0 ? (
              <p className="managerial-control-item__muted">Nenhum item com valor registrado.</p>
            ) : (
              <ul>
                {view.analyses.topByRegisteredValue.map((i) => (
                  <li key={i.code}>
                    <span>{i.code} — {i.description}</span>
                    <strong>{formatManagerialBRL(i.valueDecimal)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </AnalysisBlock>

          <AnalysisBlock title="Maior saldo contratual">
            <ul>
              {view.analyses.topByContractBalance.map((i) => (
                <li key={i.code}>
                  <span>{i.code} — {i.description}</span>
                  <strong>{formatManagerialBRL(i.valueDecimal)}</strong>
                </li>
              ))}
            </ul>
          </AnalysisBlock>

          <AnalysisBlock title="Itens que atingiram 100% da quantidade contratada">
            {view.analyses.itemsAtFullContractQuantity.length === 0 ? (
              <p className="managerial-control-item__muted">Nenhum.</p>
            ) : (
              <ul>
                {view.analyses.itemsAtFullContractQuantity.map((i) => (
                  <li key={i.code}><span>{i.code} — {i.description}</span></li>
                ))}
              </ul>
            )}
          </AnalysisBlock>

          <AnalysisBlock title="Itens acima da quantidade contratada">
            {view.analyses.itemsAboveContractQuantity.length === 0 ? (
              <p className="managerial-control-item__muted">Nenhum.</p>
            ) : (
              <ul>
                {view.analyses.itemsAboveContractQuantity.map((i) => (
                  <li key={i.code}>
                    <span>{i.code} — {i.description}</span>
                    <strong>{formatManagerialPercent(i.executedPercent) ?? "—"}</strong>
                  </li>
                ))}
              </ul>
            )}
          </AnalysisBlock>
        </div>

        {view.analyses.valueConcentration ? (
          <p className="managerial-control-analyses__concentration">
            Os {view.analyses.valueConcentration.topCount} maiores itens concentram aproximadamente{" "}
            {formatManagerialPercent(view.analyses.valueConcentration.sharePercent) ?? "—"} do valor registrado no BM{" "}
            {s.currentBulletinNumber ?? "atual"} ({formatManagerialBRL(view.analyses.valueConcentration.topValueDecimal)} de{" "}
            {formatManagerialBRL(view.analyses.valueConcentration.totalValueDecimal)}).
          </p>
        ) : null}
        <p className="managerial-control-item__muted">
          {view.analyses.itemsWithoutMeasurementCount} itens ainda sem medição registrada no sistema.
        </p>
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

        <ul className="managerial-control-items">
          <li className="managerial-control-item managerial-control-item--head" aria-hidden="true">
            <div className="managerial-control-item__row">
              <span className="managerial-control-item__code">Código</span>
              <span className="managerial-control-item__description">Serviço</span>
              <span className="managerial-control-item__group">Grupo</span>
              <span className="managerial-control-item__unit">Unid.</span>
              <span className="managerial-control-item__qty">Qtd. contratada</span>
              <span className="managerial-control-item__qty">Qtd. registrada</span>
              <span className="managerial-control-item__pct">% exec.</span>
              <span className="managerial-control-item__qty">Saldo qtd.</span>
              <span className="managerial-control-item__value">Valor registrado</span>
              <span className="managerial-control-item__status">Situação</span>
              <span className="managerial-control-item__toggle" />
            </div>
          </li>
          {filteredItems.map((item) => (
            <MeasurementManagerialControlItemRow item={item} key={item.id} />
          ))}
        </ul>
      </Card>
    </>
  );
}

function AnalysisBlock({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="managerial-control-analyses__block">
      <h4>{title}</h4>
      {children}
    </section>
  );
}
