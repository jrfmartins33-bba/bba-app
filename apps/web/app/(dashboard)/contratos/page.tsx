"use client";

import {
  Ban,
  CalendarClock,
  CheckCircle2,
  FileSignature,
  ListChecks,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Wallet
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchContractsModuleData,
  saveScopeItem,
  saveServiceContract,
  updateContractStatus,
  type ContractAreaBba,
  type ContractFormaPagamento,
  type ContractIndiceReajuste,
  type ContractStatus,
  type ContractTipo,
  type ContractsModuleData,
  type CreateScopeItemInput,
  type CreateServiceContractInput,
  type ScopePeriodicidade,
  type ServiceContract
} from "@bba/lib";
import { useBbaStore as useStore } from "@bba/lib";
import { Button, Card } from "@bba/ui";

type ContratosFormKind = "contrato" | "escopo";

type ContratoForm = {
  titulo: string;
  tipo_contrato: ContractTipo;
  area_bba: ContractAreaBba | "";
  valor_mensal: string;
  valor_total: string;
  dia_vencimento: string;
  forma_pagamento: ContractFormaPagamento | "";
  data_inicio: string;
  data_fim: string;
  duracao_meses: string;
  renovacao_automatica: boolean;
  indice_reajuste: ContractIndiceReajuste | "";
  data_assinatura: string;
  observacoes: string;
};

type ScopeForm = {
  contract_id: string;
  area_bba: ContractAreaBba | "";
  categoria: string;
  descricao: string;
  periodicidade: ScopePeriodicidade | "";
  tipo_entregavel: string;
  sla_dias: string;
  incluso_no_valor: boolean;
  valor_adicional: string;
  observacoes: string;
};

const emptyContractsData: ContractsModuleData = {
  contracts: [],
  scopeItems: [],
  warnings: []
};

const tiposContrato: ContractTipo[] = [
  "Recorrente",
  "Projeto",
  "Avulso",
  "Consultoria Pontual"
];

const areasBba: ContractAreaBba[] = ["Financas", "TI", "Governanca", "RH", "Multi"];

const formasPagamento: ContractFormaPagamento[] = [
  "PIX",
  "Boleto",
  "Transferência",
  "Cartão",
  "Débito Automático"
];

const indicesReajuste: ContractIndiceReajuste[] = [
  "IPCA",
  "IGPM",
  "INPC",
  "SELIC",
  "Fixo",
  "Negociado"
];

const periodicidades: ScopePeriodicidade[] = [
  "Mensal",
  "Trimestral",
  "Semestral",
  "Anual",
  "Pontual",
  "Sob demanda"
];

const currency = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency"
});

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit"
});

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDaysIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const parseMoney = (value: string): number | null => {
  if (!value.trim()) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseInteger = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return shortDate.format(new Date(year, month - 1, day));
};

const badgeClass = (status: ContractStatus) => {
  if (status === "Ativo") return "status-badge status-badge--completed";
  if (status === "Suspenso") return "status-badge status-badge--in_progress";
  if (status === "Cancelado") return "status-badge status-badge--cancelled";
  return "status-badge status-badge--pending";
};

const getStatusActions = (
  status: ContractStatus
): { label: string; next: ContractStatus }[] => {
  switch (status) {
    case "Proposta":
      return [
        { label: "Ativar", next: "Ativo" },
        { label: "Cancelar", next: "Cancelado" }
      ];
    case "Ativo":
      return [
        { label: "Suspender", next: "Suspenso" },
        { label: "Encerrar", next: "Encerrado" }
      ];
    case "Suspenso":
      return [
        { label: "Reativar", next: "Ativo" },
        { label: "Encerrar", next: "Encerrado" }
      ];
    default:
      return [];
  }
};

const statusActionIcon = (next: ContractStatus) => {
  if (next === "Ativo") return <PlayCircle size={15} />;
  if (next === "Suspenso") return <PauseCircle size={15} />;
  return <Ban size={15} />;
};

const defaultContratoForm = (): ContratoForm => ({
  titulo: "",
  tipo_contrato: "Recorrente",
  area_bba: "",
  valor_mensal: "",
  valor_total: "",
  dia_vencimento: "",
  forma_pagamento: "",
  data_inicio: todayIso(),
  data_fim: "",
  duracao_meses: "",
  renovacao_automatica: true,
  indice_reajuste: "",
  data_assinatura: "",
  observacoes: ""
});

const defaultScopeForm = (contractId = ""): ScopeForm => ({
  contract_id: contractId,
  area_bba: "",
  categoria: "",
  descricao: "",
  periodicidade: "Mensal",
  tipo_entregavel: "",
  sla_dias: "",
  incluso_no_valor: true,
  valor_adicional: "",
  observacoes: ""
});

export default function ContratosPage() {
  const company = useStore((state) => state.company);
  const profile = useStore((state) => state.profile);
  const [data, setData] = useState<ContractsModuleData>(emptyContractsData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeForm, setActiveForm] = useState<ContratosFormKind | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [contratoForm, setContratoForm] = useState(defaultContratoForm);
  const [scopeForm, setScopeForm] = useState<ScopeForm>(defaultScopeForm());

  const isAdminWithoutClient =
    profile.role === "bba_admin" && company.id === profile.id;

  const loadData = async () => {
    if (!company.id || isAdminWithoutClient) {
      setData(emptyContractsData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      setData(await fetchContractsModuleData(company.id));
    } catch (caught) {
      setData(emptyContractsData);
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel carregar o modulo de contratos."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, isAdminWithoutClient]);

  const metrics = useMemo(() => {
    const ativos = data.contracts.filter((c) => c.status === "Ativo");
    const receitaMensal = ativos.reduce(
      (sum, c) => sum + Number(c.valor_mensal ?? 0),
      0
    );
    const limite60 = addDaysIso(60);
    const today = todayIso();
    const vencendo = data.contracts.filter(
      (c) =>
        c.status === "Ativo" &&
        c.data_fim &&
        c.data_fim >= today &&
        c.data_fim <= limite60
    ).length;
    const escopoAtivo = data.scopeItems.filter((item) => item.ativo).length;

    return {
      contratosAtivos: ativos.length,
      receitaMensal,
      vencendo,
      escopoAtivo
    };
  }, [data]);

  const proximosVencimentos = useMemo(
    () =>
      [...data.contracts]
        .filter((c) => c.data_fim && c.status !== "Cancelado")
        .sort((a, b) => String(a.data_fim).localeCompare(String(b.data_fim)))
        .slice(0, 6),
    [data.contracts]
  );

  const contractTitleById = useMemo(
    () => new Map(data.contracts.map((c) => [c.id, c.titulo])),
    [data.contracts]
  );

  const scopeItemsOrdered = useMemo(
    () => [...data.scopeItems].sort((a, b) => a.ordem - b.ordem),
    [data.scopeItems]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeForm) return;

    setSaving(true);
    setNotice("");
    setError("");

    try {
      if (activeForm === "contrato") {
        if (!contratoForm.titulo.trim() || !contratoForm.data_inicio) {
          setError("Informe ao menos o titulo e a data de inicio do contrato.");
          setSaving(false);
          return;
        }

        const payload: CreateServiceContractInput = {
          company_id: company.id,
          titulo: contratoForm.titulo,
          tipo_contrato: contratoForm.tipo_contrato,
          area_bba: contratoForm.area_bba || null,
          valor_mensal: parseMoney(contratoForm.valor_mensal),
          valor_total: parseMoney(contratoForm.valor_total),
          dia_vencimento: parseInteger(contratoForm.dia_vencimento),
          forma_pagamento: contratoForm.forma_pagamento || null,
          data_inicio: contratoForm.data_inicio,
          data_fim: contratoForm.data_fim || null,
          duracao_meses: parseInteger(contratoForm.duracao_meses),
          renovacao_automatica: contratoForm.renovacao_automatica,
          indice_reajuste: contratoForm.indice_reajuste || null,
          data_assinatura: contratoForm.data_assinatura || null,
          observacoes: contratoForm.observacoes || null
        };
        await saveServiceContract(payload);
        setContratoForm(defaultContratoForm());
        setNotice("Contrato criado com sucesso.");
      }

      if (activeForm === "escopo") {
        if (!scopeForm.contract_id || !scopeForm.categoria.trim() || !scopeForm.descricao.trim()) {
          setError("Selecione o contrato e preencha categoria e descricao do item.");
          setSaving(false);
          return;
        }

        const payload: CreateScopeItemInput = {
          company_id: company.id,
          contract_id: scopeForm.contract_id,
          area_bba: scopeForm.area_bba || null,
          categoria: scopeForm.categoria,
          descricao: scopeForm.descricao,
          periodicidade: scopeForm.periodicidade || null,
          tipo_entregavel: scopeForm.tipo_entregavel || null,
          sla_dias: parseInteger(scopeForm.sla_dias),
          incluso_no_valor: scopeForm.incluso_no_valor,
          valor_adicional: parseMoney(scopeForm.valor_adicional) ?? 0,
          observacoes: scopeForm.observacoes || null
        };
        await saveScopeItem(payload);
        setScopeForm(defaultScopeForm());
        setNotice("Item de escopo adicionado com sucesso.");
      }

      setActiveForm(null);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel salvar o registro de contrato."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (contract: ServiceContract, next: ContractStatus) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateContractStatus(contract.id, next);
      setNotice(`${contract.titulo} atualizado para ${next}.`);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao atualizar status do contrato."
      );
    } finally {
      setSaving(false);
    }
  };

  const openEscopoForm = () => {
    setScopeForm(defaultScopeForm(data.contracts[0]?.id ?? ""));
    setActiveForm("escopo");
  };

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Contratos de Servico</h1>
          <p>
            Contratos, escopo de servico e vigencias de{" "}
            {company.name || "cliente BBA"}.
          </p>
        </div>
        <div className="module-actions">
          <Button
            disabled={saving || loading}
            icon={saving ? <Loader2 size={17} /> : <RefreshCcw size={17} />}
            onClick={() => void loadData()}
            variant="ghost"
          >
            Atualizar
          </Button>
          <Button
            disabled={isAdminWithoutClient || !data.contracts.length}
            icon={<ListChecks size={17} />}
            onClick={openEscopoForm}
            variant="secondary"
          >
            Novo item de escopo
          </Button>
          <Button
            disabled={isAdminWithoutClient}
            icon={<Plus size={17} />}
            onClick={() => {
              setContratoForm(defaultContratoForm());
              setActiveForm("contrato");
            }}
          >
            Novo contrato
          </Button>
        </div>
      </section>

      {isAdminWithoutClient ? (
        <Card title="Cliente nao selecionado">
          <div className="empty-state">
            A area admin ainda nao esta vinculada a um cliente especifico nesta
            tela. O modulo de contratos aparece quando entrar como usuario do
            cliente.
          </div>
        </Card>
      ) : null}

      {notice ? (
        <div className="form-success" role="status">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="form-error fiscal-alert" role="alert">
          <ShieldAlert size={16} />
          {error}
        </div>
      ) : null}

      {data.warnings.length ? (
        <div className="form-error fiscal-alert" role="alert">
          <ShieldAlert size={16} />
          Algumas tabelas de contratos nao responderam no Supabase. Execute a
          migration de grants do modulo de contratos e atualize a tela.
        </div>
      ) : null}

      <section className="section-grid">
        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <FileSignature size={20} />
            </span>
            <div>
              <strong>{metrics.contratosAtivos}</strong>
              <span>Contratos ativos</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <Wallet size={20} />
            </span>
            <div>
              <strong>{currency.format(metrics.receitaMensal)}</strong>
              <span>Receita mensal recorrente</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <CalendarClock size={20} />
            </span>
            <div>
              <strong>{metrics.vencendo}</strong>
              <span>Vencendo em 60 dias</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <ListChecks size={20} />
            </span>
            <div>
              <strong>{metrics.escopoAtivo}</strong>
              <span>Itens de escopo ativos</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card
          action={
            loading ? (
              <span className="status-badge status-badge--pending">
                Carregando
              </span>
            ) : (
              <span className="status-badge status-badge--pending">
                {data.contracts.length} contrato(s)
              </span>
            )
          }
          className="span-8"
          title="Contratos de servico"
        >
          <div className="fiscal-list fiscal-list--compact">
            {data.contracts.length ? (
              data.contracts.map((contract) => (
                <article className="fiscal-row" key={contract.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={badgeClass(contract.status)}>
                        {contract.status}
                      </span>
                      <time>{contract.numero_contrato}</time>
                    </div>
                    <h3>{contract.titulo}</h3>
                    <div className="fiscal-tags">
                      <span>{contract.tipo_contrato}</span>
                      {contract.area_bba ? <span>{contract.area_bba}</span> : null}
                      {contract.valor_mensal ? (
                        <span>{currency.format(Number(contract.valor_mensal))}/mes</span>
                      ) : null}
                      {contract.valor_total ? (
                        <span>{currency.format(Number(contract.valor_total))} total</span>
                      ) : null}
                      <span>
                        {formatDate(contract.data_inicio)} ate{" "}
                        {contract.data_fim ? formatDate(contract.data_fim) : "indeterminado"}
                      </span>
                    </div>
                  </div>
                  <div className="fiscal-row__actions">
                    {getStatusActions(contract.status).map((action) => (
                      <Button
                        disabled={saving}
                        icon={statusActionIcon(action.next)}
                        key={action.next}
                        onClick={() => void handleStatusChange(contract, action.next)}
                        size="sm"
                        variant="secondary"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                Nenhum contrato cadastrado para este cliente.
              </div>
            )}
          </div>
        </Card>

        <Card className="span-4" title="Vencimentos de contrato">
          <div className="fiscal-calendar">
            {proximosVencimentos.length ? (
              proximosVencimentos.map((contract) => (
                <div
                  className="timeline-row fiscal-deadline"
                  key={contract.id}
                >
                  <div>
                    <strong>{contract.titulo}</strong>
                    <span>{contract.numero_contrato}</span>
                  </div>
                  <time>{formatDate(contract.data_fim)}</time>
                </div>
              ))
            ) : (
              <div className="empty-state">Nenhum vencimento programado.</div>
            )}
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card
          action={
            <span className="status-badge status-badge--pending">
              {data.scopeItems.length} item(ns)
            </span>
          }
          className="span-12"
          title="Escopo de servicos"
        >
          <div className="fiscal-list fiscal-list--compact">
            {scopeItemsOrdered.length ? (
              scopeItemsOrdered.map((item) => (
                <article className="fiscal-row fiscal-row--compact" key={item.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className="status-badge status-badge--pending">
                        {item.categoria}
                      </span>
                      <span>{contractTitleById.get(item.contract_id) ?? "Contrato"}</span>
                    </div>
                    <h3>{item.descricao}</h3>
                    <div className="fiscal-tags">
                      {item.periodicidade ? <span>{item.periodicidade}</span> : null}
                      {item.area_bba ? <span>{item.area_bba}</span> : null}
                      {item.sla_dias ? <span>SLA {item.sla_dias}d</span> : null}
                      <span>
                        {item.incluso_no_valor
                          ? "Incluso no contrato"
                          : `Adicional ${currency.format(Number(item.valor_adicional ?? 0))}`}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">Nenhum item de escopo cadastrado.</div>
            )}
          </div>
        </Card>
      </section>

      {activeForm ? (
        <div className="task-modal" role="dialog" aria-modal="true">
          <Card
            action={
              <Button
                disabled={saving}
                onClick={() => setActiveForm(null)}
                type="button"
                variant="ghost"
              >
                Fechar
              </Button>
            }
            className="fiscal-modal"
            title={activeForm === "contrato" ? "Novo contrato" : "Novo item de escopo"}
          >
            <form className="fiscal-form" onSubmit={handleSubmit}>
              {activeForm === "contrato" ? (
                <ContratoFields form={contratoForm} onChange={setContratoForm} />
              ) : null}

              {activeForm === "escopo" ? (
                <ScopeFields
                  contracts={data.contracts}
                  form={scopeForm}
                  onChange={setScopeForm}
                />
              ) : null}

              {error ? (
                <div className="form-error fiscal-alert" role="alert">
                  <ShieldAlert size={15} />
                  {error}
                </div>
              ) : null}

              <div className="save-panel__buttons">
                <Button
                  disabled={saving}
                  onClick={() => setActiveForm(null)}
                  type="button"
                  variant="ghost"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={saving}
                  icon={saving ? <Loader2 size={17} /> : <CheckCircle2 size={17} />}
                  type="submit"
                >
                  Salvar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function Field({
  children,
  id,
  label
}: {
  children: ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function CheckField({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="check-field">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function ContratoFields({
  form,
  onChange
}: {
  form: ContratoForm;
  onChange: (form: ContratoForm) => void;
}) {
  const update = <K extends keyof ContratoForm>(key: K, value: ContratoForm[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="form-grid form-grid--two">
      <div className="span-form-2">
        <Field id="ctr-titulo" label="Titulo do contrato">
          <input
            id="ctr-titulo"
            onChange={(e) => update("titulo", e.target.value)}
            placeholder="Ex: Assessoria contabil e tributaria recorrente"
            required
            value={form.titulo}
          />
        </Field>
      </div>

      <Field id="ctr-tipo" label="Tipo de contrato">
        <select
          id="ctr-tipo"
          onChange={(e) => update("tipo_contrato", e.target.value as ContratoForm["tipo_contrato"])}
          value={form.tipo_contrato}
        >
          {tiposContrato.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </Field>

      <Field id="ctr-area" label="Area BBA">
        <select
          id="ctr-area"
          onChange={(e) => update("area_bba", e.target.value as ContratoForm["area_bba"])}
          value={form.area_bba}
        >
          <option value="">Nao definida</option>
          {areasBba.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </Field>

      <Field id="ctr-valor-mensal" label="Valor mensal (R$)">
        <input
          id="ctr-valor-mensal"
          inputMode="decimal"
          onChange={(e) => update("valor_mensal", e.target.value)}
          placeholder="0,00"
          value={form.valor_mensal}
        />
      </Field>

      <Field id="ctr-valor-total" label="Valor total (R$)">
        <input
          id="ctr-valor-total"
          inputMode="decimal"
          onChange={(e) => update("valor_total", e.target.value)}
          placeholder="0,00"
          value={form.valor_total}
        />
      </Field>

      <Field id="ctr-forma" label="Forma de pagamento">
        <select
          id="ctr-forma"
          onChange={(e) => update("forma_pagamento", e.target.value as ContratoForm["forma_pagamento"])}
          value={form.forma_pagamento}
        >
          <option value="">Nao definida</option>
          {formasPagamento.map((forma) => (
            <option key={forma} value={forma}>
              {forma}
            </option>
          ))}
        </select>
      </Field>

      <Field id="ctr-dia-vencimento" label="Dia de vencimento">
        <input
          id="ctr-dia-vencimento"
          inputMode="numeric"
          max={31}
          min={1}
          onChange={(e) => update("dia_vencimento", e.target.value)}
          placeholder="Ex: 10"
          type="number"
          value={form.dia_vencimento}
        />
      </Field>

      <Field id="ctr-inicio" label="Data de inicio">
        <input
          id="ctr-inicio"
          onChange={(e) => update("data_inicio", e.target.value)}
          required
          type="date"
          value={form.data_inicio}
        />
      </Field>

      <Field id="ctr-fim" label="Data de termino (opcional)">
        <input
          id="ctr-fim"
          onChange={(e) => update("data_fim", e.target.value)}
          type="date"
          value={form.data_fim}
        />
      </Field>

      <Field id="ctr-duracao" label="Duracao (meses)">
        <input
          id="ctr-duracao"
          inputMode="numeric"
          onChange={(e) => update("duracao_meses", e.target.value)}
          placeholder="Ex: 12"
          type="number"
          value={form.duracao_meses}
        />
      </Field>

      <Field id="ctr-indice" label="Indice de reajuste">
        <select
          id="ctr-indice"
          onChange={(e) => update("indice_reajuste", e.target.value as ContratoForm["indice_reajuste"])}
          value={form.indice_reajuste}
        >
          <option value="">Nao definido</option>
          {indicesReajuste.map((indice) => (
            <option key={indice} value={indice}>
              {indice}
            </option>
          ))}
        </select>
      </Field>

      <Field id="ctr-assinatura" label="Data de assinatura (opcional)">
        <input
          id="ctr-assinatura"
          onChange={(e) => update("data_assinatura", e.target.value)}
          type="date"
          value={form.data_assinatura}
        />
      </Field>

      <div className="span-form-2">
        <CheckField
          checked={form.renovacao_automatica}
          label="Renovacao automatica"
          onChange={(checked) => update("renovacao_automatica", checked)}
        />
      </div>

      <div className="span-form-2">
        <Field id="ctr-observacoes" label="Observacoes">
          <textarea
            id="ctr-observacoes"
            onChange={(e) => update("observacoes", e.target.value)}
            value={form.observacoes}
          />
        </Field>
      </div>
    </div>
  );
}

function ScopeFields({
  contracts,
  form,
  onChange
}: {
  contracts: ServiceContract[];
  form: ScopeForm;
  onChange: (form: ScopeForm) => void;
}) {
  const update = <K extends keyof ScopeForm>(key: K, value: ScopeForm[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="form-grid form-grid--two">
      <div className="span-form-2">
        <Field id="esc-contrato" label="Contrato">
          <select
            id="esc-contrato"
            onChange={(e) => update("contract_id", e.target.value)}
            required
            value={form.contract_id}
          >
            <option value="">Selecione um contrato</option>
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.titulo} ({contract.numero_contrato})
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="esc-categoria" label="Categoria">
        <input
          id="esc-categoria"
          onChange={(e) => update("categoria", e.target.value)}
          placeholder="Ex: Fiscal, Financeiro, Folha"
          required
          value={form.categoria}
        />
      </Field>

      <Field id="esc-area" label="Area BBA">
        <select
          id="esc-area"
          onChange={(e) => update("area_bba", e.target.value as ScopeForm["area_bba"])}
          value={form.area_bba}
        >
          <option value="">Nao definida</option>
          {areasBba.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </Field>

      <div className="span-form-2">
        <Field id="esc-descricao" label="Descricao do item">
          <input
            id="esc-descricao"
            onChange={(e) => update("descricao", e.target.value)}
            placeholder="Ex: Apuracao e envio de obrigacoes fiscais mensais"
            required
            value={form.descricao}
          />
        </Field>
      </div>

      <Field id="esc-periodicidade" label="Periodicidade">
        <select
          id="esc-periodicidade"
          onChange={(e) => update("periodicidade", e.target.value as ScopeForm["periodicidade"])}
          value={form.periodicidade}
        >
          {periodicidades.map((periodicidade) => (
            <option key={periodicidade} value={periodicidade}>
              {periodicidade}
            </option>
          ))}
        </select>
      </Field>

      <Field id="esc-entregavel" label="Tipo de entregavel">
        <input
          id="esc-entregavel"
          onChange={(e) => update("tipo_entregavel", e.target.value)}
          placeholder="Ex: Relatorio, Declaracao"
          value={form.tipo_entregavel}
        />
      </Field>

      <Field id="esc-sla" label="SLA (dias)">
        <input
          id="esc-sla"
          inputMode="numeric"
          onChange={(e) => update("sla_dias", e.target.value)}
          placeholder="Ex: 5"
          type="number"
          value={form.sla_dias}
        />
      </Field>

      <Field id="esc-valor-adicional" label="Valor adicional (R$)">
        <input
          id="esc-valor-adicional"
          inputMode="decimal"
          onChange={(e) => update("valor_adicional", e.target.value)}
          placeholder="0,00"
          value={form.valor_adicional}
        />
      </Field>

      <div className="span-form-2">
        <CheckField
          checked={form.incluso_no_valor}
          label="Incluso no valor do contrato"
          onChange={(checked) => update("incluso_no_valor", checked)}
        />
      </div>

      <div className="span-form-2">
        <Field id="esc-observacoes" label="Observacoes">
          <textarea
            id="esc-observacoes"
            onChange={(e) => update("observacoes", e.target.value)}
            value={form.observacoes}
          />
        </Field>
      </div>
    </div>
  );
}
