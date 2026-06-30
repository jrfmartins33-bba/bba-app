"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CheckCircle2,
  Loader2,
  Plus,
  Receipt,
  RefreshCcw,
  ShieldAlert,
  Wallet
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  efetivarLancamento,
  fetchFinancialModuleData,
  generateNumeroFatura,
  marcarCobrancaComoPaga,
  saveCobranca,
  saveLancamento,
  type CobrancaStatus,
  type CreateCobrancaInput,
  type CreateLancamentoInput,
  type FinancialCategoria,
  type FinancialCobranca,
  type FinancialLancamento,
  type FinancialModuleData,
  type LancamentoStatus
} from "@bba/lib";
import { useBbaStore as useStore } from "@bba/lib";
import { Button, Card } from "@bba/ui";

type FinancialFormKind = "lancamento" | "cobranca";

type LancamentoForm = {
  tipo: "Receita" | "Despesa" | "Transferência";
  categoria_id: string;
  conta_id: string;
  descricao: string;
  valor: string;
  data_competencia: string;
  data_pagamento: string;
  observacoes: string;
};

type CobrancaForm = {
  descricao: string;
  competencia: string;
  data_vencimento: string;
  valor: string;
  forma_pagamento: string;
  observacoes: string;
};

const emptyFinancialData: FinancialModuleData = {
  contas: [],
  categorias: [],
  lancamentos: [],
  cobrancas: [],
  warnings: []
};

const formasPagamento = ["PIX", "Boleto", "Transferencia", "Cartao", "Debito Automatico"];

const lancamentoStatuses: LancamentoStatus[] = [
  "Previsto",
  "Realizado",
  "Cancelado",
  "Estornado"
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

const monthStartIso = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const addDaysIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const parseMoney = (value: string) => {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return shortDate.format(new Date(year, month - 1, day));
};

const badgeClass = (status: string) => {
  if (["Realizado", "Paga"].includes(status)) {
    return "status-badge status-badge--completed";
  }
  if (["Enviada", "Parcialmente paga"].includes(status)) {
    return "status-badge status-badge--in_progress";
  }
  if (["Cancelado", "Cancelada", "Estornado", "Estornada", "Atrasada"].includes(status)) {
    return "status-badge status-badge--cancelled";
  }
  return "status-badge status-badge--pending";
};

const defaultLancamentoForm = (): LancamentoForm => ({
  tipo: "Receita",
  categoria_id: "",
  conta_id: "",
  descricao: "",
  valor: "",
  data_competencia: monthStartIso(),
  data_pagamento: "",
  observacoes: ""
});

const defaultCobrancaForm = (): CobrancaForm => ({
  descricao: "",
  competencia: monthStartIso(),
  data_vencimento: addDaysIso(10),
  valor: "",
  forma_pagamento: "PIX",
  observacoes: ""
});

export default function FinanceiroPage() {
  const company = useStore((state) => state.company);
  const profile = useStore((state) => state.profile);
  const [data, setData] = useState<FinancialModuleData>(emptyFinancialData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeForm, setActiveForm] = useState<FinancialFormKind | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [lancamentoForm, setLancamentoForm] = useState(defaultLancamentoForm);
  const [cobrancaForm, setCobrancaForm] = useState(defaultCobrancaForm);

  const isAdminWithoutClient =
    profile.role === "bba_admin" && company.id === profile.id;

  const loadData = async () => {
    if (!company.id || isAdminWithoutClient) {
      setData(emptyFinancialData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      setData(await fetchFinancialModuleData(company.id));
    } catch (caught) {
      setData(emptyFinancialData);
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel carregar o modulo financeiro."
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
    const currentMonth = monthStartIso().slice(0, 7);
    const lancamentosMes = data.lancamentos.filter((l) =>
      l.data_competencia?.startsWith(currentMonth)
    );
    const receitasMes = lancamentosMes
      .filter((l) => l.tipo === "Receita" && l.status !== "Cancelado" && l.status !== "Estornado")
      .reduce((sum, l) => sum + Number(l.valor ?? 0), 0);
    const despesasMes = lancamentosMes
      .filter((l) => l.tipo === "Despesa" && l.status !== "Cancelado" && l.status !== "Estornado")
      .reduce((sum, l) => sum + Number(l.valor ?? 0), 0);
    const saldoTotal = data.contas
      .filter((c) => c.incluir_no_total)
      .reduce((sum, c) => sum + Number(c.saldo_atual ?? 0), 0);
    const cobrancasAbertas = data.cobrancas.filter(
      (c) => !["Paga", "Cancelada", "Estornada"].includes(c.status)
    ).length;

    return { saldoTotal, receitasMes, despesasMes, cobrancasAbertas };
  }, [data]);

  const categoriasParaTipo = useMemo(
    () =>
      data.categorias.filter(
        (cat) =>
          cat.tipo === lancamentoForm.tipo || cat.tipo === "Transferência"
      ),
    [data.categorias, lancamentoForm.tipo]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeForm) return;

    setSaving(true);
    setNotice("");
    setError("");

    try {
      if (activeForm === "lancamento") {
        const valorNum = parseMoney(lancamentoForm.valor);
        if (!valorNum) {
          setError("Informe um valor valido maior que zero.");
          setSaving(false);
          return;
        }

        const payload: CreateLancamentoInput = {
          company_id: company.id,
          tipo: lancamentoForm.tipo,
          categoria_id: lancamentoForm.categoria_id || null,
          conta_id: lancamentoForm.conta_id || null,
          descricao: lancamentoForm.descricao,
          valor: valorNum,
          data_competencia: lancamentoForm.data_competencia,
          data_pagamento: lancamentoForm.data_pagamento || null,
          observacoes: lancamentoForm.observacoes || null
        };
        await saveLancamento(payload);
        setLancamentoForm(defaultLancamentoForm());
        setNotice(`${lancamentoForm.tipo} registrada com sucesso.`);
      }

      if (activeForm === "cobranca") {
        const valorNum = parseMoney(cobrancaForm.valor);
        if (!valorNum) {
          setError("Informe um valor valido maior que zero.");
          setSaving(false);
          return;
        }

        const payload: CreateCobrancaInput = {
          company_id: company.id,
          numero_fatura: generateNumeroFatura(),
          descricao: cobrancaForm.descricao,
          competencia: cobrancaForm.competencia,
          data_vencimento: cobrancaForm.data_vencimento,
          valor: valorNum,
          forma_pagamento: cobrancaForm.forma_pagamento || null,
          observacoes: cobrancaForm.observacoes || null
        };
        await saveCobranca(payload);
        setCobrancaForm(defaultCobrancaForm());
        setNotice("Cobranca registrada com sucesso.");
      }

      setActiveForm(null);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel salvar o registro financeiro."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEfetivar = async (lancamento: FinancialLancamento) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await efetivarLancamento(lancamento.id);
      setNotice(`${lancamento.descricao} efetivado.`);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Falha ao efetivar lancamento."
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePagarCobranca = async (cobranca: FinancialCobranca) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await marcarCobrancaComoPaga(cobranca.id);
      setNotice(`Fatura ${cobranca.numero_fatura} marcada como paga.`);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Falha ao pagar cobranca."
      );
    } finally {
      setSaving(false);
    }
  };

  const openLancamentoForm = (tipo: "Receita" | "Despesa") => {
    setLancamentoForm({ ...defaultLancamentoForm(), tipo });
    setActiveForm("lancamento");
  };

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Modulo Financeiro</h1>
          <p>
            Fluxo de caixa, contas bancarias, lancamentos e cobrancas de{" "}
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
            disabled={isAdminWithoutClient}
            icon={<ArrowUpCircle size={17} />}
            onClick={() => openLancamentoForm("Receita")}
            variant="secondary"
          >
            Receita
          </Button>
          <Button
            disabled={isAdminWithoutClient}
            icon={<ArrowDownCircle size={17} />}
            onClick={() => openLancamentoForm("Despesa")}
            variant="secondary"
          >
            Despesa
          </Button>
          <Button
            disabled={isAdminWithoutClient}
            icon={<Receipt size={17} />}
            onClick={() => setActiveForm("cobranca")}
          >
            Nova cobranca
          </Button>
        </div>
      </section>

      {isAdminWithoutClient ? (
        <Card title="Cliente nao selecionado">
          <div className="empty-state">
            A area admin ainda nao esta vinculada a um cliente especifico nesta
            tela. O modulo financeiro aparece quando entrar como usuario do
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
          Algumas tabelas financeiras nao responderam no Supabase. Execute a
          migration de grants do modulo financeiro e atualize a tela.
        </div>
      ) : null}

      <section className="section-grid">
        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <Wallet size={20} />
            </span>
            <div>
              <strong>{currency.format(metrics.saldoTotal)}</strong>
              <span>Saldo em contas</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <ArrowUpCircle size={20} />
            </span>
            <div>
              <strong>{currency.format(metrics.receitasMes)}</strong>
              <span>Receitas do mes</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <ArrowDownCircle size={20} />
            </span>
            <div>
              <strong>{currency.format(metrics.despesasMes)}</strong>
              <span>Despesas do mes</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <Banknote size={20} />
            </span>
            <div>
              <strong>{metrics.cobrancasAbertas}</strong>
              <span>Cobrancas abertas</span>
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
                {data.lancamentos.length} lancamento(s)
              </span>
            )
          }
          className="span-8"
          title="Fluxo de caixa"
        >
          <div className="fiscal-list fiscal-list--compact">
            {data.lancamentos.length ? (
              data.lancamentos.map((lancamento) => (
                <article className="fiscal-row" key={lancamento.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={badgeClass(lancamento.status)}>
                        {lancamento.status}
                      </span>
                      <time>{formatDate(lancamento.data_competencia)}</time>
                    </div>
                    <h3>{lancamento.descricao}</h3>
                    <div className="fiscal-tags">
                      <span
                        style={{
                          color:
                            lancamento.tipo === "Receita"
                              ? "var(--bba-success)"
                              : "var(--bba-danger)"
                        }}
                      >
                        {lancamento.tipo === "Receita" ? "+" : "-"}
                        {currency.format(Number(lancamento.valor ?? 0))}
                      </span>
                      <span>{lancamento.tipo}</span>
                      {lancamento.data_pagamento ? (
                        <span>Pago em {formatDate(lancamento.data_pagamento)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="fiscal-row__actions">
                    {lancamento.status === "Previsto" ? (
                      <Button
                        disabled={saving}
                        icon={<CheckCircle2 size={15} />}
                        onClick={() => void handleEfetivar(lancamento)}
                        size="sm"
                        variant="secondary"
                      >
                        Efetivar
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                Nenhum lancamento registrado para este cliente.
              </div>
            )}
          </div>
        </Card>

        <Card className="span-4" title="Contas bancarias">
          <div className="fiscal-list">
            {data.contas.length ? (
              data.contas.map((conta) => (
                <article className="fiscal-row fiscal-row--compact" key={conta.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className="status-badge status-badge--pending">
                        {conta.tipo}
                      </span>
                    </div>
                    <h3>{conta.nome}</h3>
                    <div className="fiscal-tags">
                      <span>{currency.format(Number(conta.saldo_atual ?? 0))}</span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">Nenhuma conta cadastrada.</div>
            )}
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card
          action={
            <span className="status-badge status-badge--pending">
              {metrics.cobrancasAbertas} aberta(s)
            </span>
          }
          className="span-7"
          title="Cobrancas BBA"
        >
          <div className="fiscal-list fiscal-list--compact">
            {data.cobrancas.length ? (
              data.cobrancas.map((cobranca) => (
                <article className="fiscal-row" key={cobranca.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={badgeClass(cobranca.status)}>
                        {cobranca.status}
                      </span>
                      <time>Venc. {formatDate(cobranca.data_vencimento)}</time>
                    </div>
                    <h3>{cobranca.descricao}</h3>
                    <div className="fiscal-tags">
                      <span>{currency.format(Number(cobranca.valor_total ?? 0))}</span>
                      <span>{cobranca.numero_fatura}</span>
                      {cobranca.forma_pagamento ? (
                        <span>{cobranca.forma_pagamento}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="fiscal-row__actions">
                    {!["Paga", "Cancelada", "Estornada"].includes(cobranca.status) ? (
                      <Button
                        disabled={saving}
                        icon={<CheckCircle2 size={15} />}
                        onClick={() => void handlePagarCobranca(cobranca)}
                        size="sm"
                        variant="secondary"
                      >
                        Paga
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">Nenhuma cobranca cadastrada.</div>
            )}
          </div>
        </Card>

        <Card className="span-5" title="Categorias do mes">
          <CategorySummary
            categorias={data.categorias}
            lancamentos={data.lancamentos}
          />
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
            title={activeForm === "lancamento" ? `Novo lancamento — ${lancamentoForm.tipo}` : "Nova cobranca"}
          >
            <form className="fiscal-form" onSubmit={handleSubmit}>
              {activeForm === "lancamento" ? (
                <LancamentoFields
                  categorias={categoriasParaTipo}
                  contas={data.contas}
                  form={lancamentoForm}
                  onChange={setLancamentoForm}
                />
              ) : null}

              {activeForm === "cobranca" ? (
                <CobrancaFields form={cobrancaForm} onChange={setCobrancaForm} />
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

function LancamentoFields({
  categorias,
  contas,
  form,
  onChange
}: {
  categorias: FinancialCategoria[];
  contas: FinancialModuleData["contas"];
  form: LancamentoForm;
  onChange: (form: LancamentoForm) => void;
}) {
  const update = <K extends keyof LancamentoForm>(key: K, value: LancamentoForm[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="form-grid form-grid--two">
      <Field id="lanc-tipo" label="Tipo">
        <select
          id="lanc-tipo"
          onChange={(e) => update("tipo", e.target.value as LancamentoForm["tipo"])}
          value={form.tipo}
        >
          <option value="Receita">Receita</option>
          <option value="Despesa">Despesa</option>
          <option value="Transferência">Transferencia</option>
        </select>
      </Field>

      <Field id="lanc-categoria" label="Categoria">
        <select
          id="lanc-categoria"
          onChange={(e) => update("categoria_id", e.target.value)}
          value={form.categoria_id}
        >
          <option value="">Sem categoria</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nome}
            </option>
          ))}
        </select>
      </Field>

      <div className="span-form-2">
        <Field id="lanc-descricao" label="Descricao">
          <input
            id="lanc-descricao"
            onChange={(e) => update("descricao", e.target.value)}
            placeholder="Ex: Honorarios BBA — julho/2026"
            required
            value={form.descricao}
          />
        </Field>
      </div>

      <Field id="lanc-valor" label="Valor (R$)">
        <input
          id="lanc-valor"
          inputMode="decimal"
          onChange={(e) => update("valor", e.target.value)}
          placeholder="0,00"
          required
          value={form.valor}
        />
      </Field>

      <Field id="lanc-conta" label="Conta">
        <select
          id="lanc-conta"
          onChange={(e) => update("conta_id", e.target.value)}
          value={form.conta_id}
        >
          <option value="">Sem conta vinculada</option>
          {contas.map((conta) => (
            <option key={conta.id} value={conta.id}>
              {conta.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field id="lanc-competencia" label="Competencia">
        <input
          id="lanc-competencia"
          onChange={(e) => update("data_competencia", e.target.value)}
          required
          type="date"
          value={form.data_competencia}
        />
      </Field>

      <Field id="lanc-pagamento" label="Data de pagamento (opcional)">
        <input
          id="lanc-pagamento"
          onChange={(e) => update("data_pagamento", e.target.value)}
          type="date"
          value={form.data_pagamento}
        />
      </Field>

      <div className="span-form-2">
        <Field id="lanc-observacoes" label="Observacoes">
          <textarea
            id="lanc-observacoes"
            onChange={(e) => update("observacoes", e.target.value)}
            value={form.observacoes}
          />
        </Field>
      </div>
    </div>
  );
}

function CobrancaFields({
  form,
  onChange
}: {
  form: CobrancaForm;
  onChange: (form: CobrancaForm) => void;
}) {
  const update = <K extends keyof CobrancaForm>(key: K, value: CobrancaForm[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="form-grid form-grid--two">
      <div className="span-form-2">
        <Field id="cob-descricao" label="Descricao da fatura">
          <input
            id="cob-descricao"
            onChange={(e) => update("descricao", e.target.value)}
            placeholder="Ex: Assessoria contabil — julho/2026"
            required
            value={form.descricao}
          />
        </Field>
      </div>

      <Field id="cob-valor" label="Valor (R$)">
        <input
          id="cob-valor"
          inputMode="decimal"
          onChange={(e) => update("valor", e.target.value)}
          placeholder="0,00"
          required
          value={form.valor}
        />
      </Field>

      <Field id="cob-forma" label="Forma de pagamento">
        <select
          id="cob-forma"
          onChange={(e) => update("forma_pagamento", e.target.value)}
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

      <Field id="cob-competencia" label="Competencia">
        <input
          id="cob-competencia"
          onChange={(e) => update("competencia", e.target.value)}
          required
          type="date"
          value={form.competencia}
        />
      </Field>

      <Field id="cob-vencimento" label="Vencimento">
        <input
          id="cob-vencimento"
          onChange={(e) => update("data_vencimento", e.target.value)}
          required
          type="date"
          value={form.data_vencimento}
        />
      </Field>

      <div className="span-form-2">
        <Field id="cob-observacoes" label="Observacoes">
          <textarea
            id="cob-observacoes"
            onChange={(e) => update("observacoes", e.target.value)}
            value={form.observacoes}
          />
        </Field>
      </div>
    </div>
  );
}

function CategorySummary({
  categorias,
  lancamentos
}: {
  categorias: FinancialCategoria[];
  lancamentos: FinancialLancamento[];
}) {
  const currentMonth = monthStartIso().slice(0, 7);

  const catMap = useMemo(() => {
    const map = new Map<string, { nome: string; tipo: string; total: number }>();

    for (const lancamento of lancamentos) {
      if (!lancamento.data_competencia?.startsWith(currentMonth)) continue;
      if (lancamento.status === "Cancelado" || lancamento.status === "Estornado") continue;
      if (!lancamento.categoria_id) continue;

      const cat = categorias.find((c) => c.id === lancamento.categoria_id);
      if (!cat) continue;

      const existing = map.get(lancamento.categoria_id);
      if (existing) {
        existing.total += Number(lancamento.valor ?? 0);
      } else {
        map.set(lancamento.categoria_id, {
          nome: cat.nome,
          tipo: lancamento.tipo,
          total: Number(lancamento.valor ?? 0)
        });
      }
    }

    return [...map.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [lancamentos, categorias, currentMonth]);

  if (!catMap.length) {
    return (
      <div className="empty-state">Sem lancamentos com categoria no mes.</div>
    );
  }

  return (
    <div className="fiscal-list">
      {catMap.map((item) => (
        <div className="timeline-row fiscal-deadline" key={item.nome}>
          <div>
            <strong>{item.nome}</strong>
            <span>{item.tipo}</span>
          </div>
          <span
            style={{
              color:
                item.tipo === "Receita"
                  ? "var(--bba-success)"
                  : "var(--bba-danger)",
              fontWeight: 700,
              fontSize: "0.92rem"
            }}
          >
            {currency.format(item.total)}
          </span>
        </div>
      ))}
    </div>
  );
}
