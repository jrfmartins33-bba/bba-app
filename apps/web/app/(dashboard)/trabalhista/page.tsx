"use client";

import {
  Banknote,
  CheckCircle2,
  DollarSign,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Shirt,
  UserMinus,
  Users
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  calcularFGTS,
  calcularINSS,
  calcularIRPF,
  calcularSalarioLiquido,
  fetchRhModuleData,
  saveFolhaPagamento,
  saveFuncionario,
  updateFolhaStatus,
  updateFuncionarioSituacao,
  type CreateFolhaPagamentoInput,
  type CreateFuncionarioInput,
  type FolhaStatus,
  type FuncionarioSituacao,
  type FuncionarioTipoContrato,
  type RhFolhaPagamento,
  type RhFuncionario,
  type RhModuleData
} from "@bba/lib";
import { useBbaStore as useStore } from "@bba/lib";
import { Button, Card } from "@bba/ui";

type RhFormKind = "funcionario" | "folha";

type FuncionarioForm = {
  nome: string;
  cargo: string;
  departamento: string;
  tipo_contrato: FuncionarioTipoContrato;
  situacao: FuncionarioSituacao;
  data_admissao: string;
  salario_base: string;
  cpf: string;
  observacoes: string;
};

type FolhaForm = {
  funcionario_id: string;
  competencia: string;
  salario_bruto: string;
  desconto_inss: string;
  desconto_irpf: string;
  adicional_hrs_extras: string;
  desconto_outros: string;
  outros_descricao: string;
  observacoes: string;
};

const emptyRhData: RhModuleData = {
  funcionarios: [],
  folha: [],
  warnings: []
};

const tiposContrato: FuncionarioTipoContrato[] = [
  "CLT",
  "PJ",
  "Estágio",
  "Aprendiz",
  "Terceirizado",
  "Temporário"
];

const situacoes: FuncionarioSituacao[] = [
  "Ativo",
  "Em experiência",
  "Afastado",
  "Férias",
  "Demitido"
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

const parseMoney = (value: string): number => {
  if (!value.trim()) return 0;
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

const formatCompetencia = (value?: string | null) => {
  if (!value) return "-";
  const [year, month] = value.slice(0, 7).split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
};

const funcionarioBadge = (situacao: FuncionarioSituacao) => {
  if (situacao === "Ativo") return "status-badge status-badge--completed";
  if (situacao === "Em experiência" || situacao === "Afastado" || situacao === "Férias")
    return "status-badge status-badge--in_progress";
  return "status-badge status-badge--cancelled";
};

const folhaBadge = (status: FolhaStatus) => {
  if (status === "Pago") return "status-badge status-badge--completed";
  if (status === "Aprovado") return "status-badge status-badge--in_progress";
  if (status === "Cancelado") return "status-badge status-badge--cancelled";
  return "status-badge status-badge--pending";
};

const defaultFuncionarioForm = (): FuncionarioForm => ({
  nome: "",
  cargo: "",
  departamento: "",
  tipo_contrato: "CLT",
  situacao: "Em experiência",
  data_admissao: todayIso(),
  salario_base: "",
  cpf: "",
  observacoes: ""
});

const defaultFolhaForm = (funcionarioId = "", salarioBase = ""): FolhaForm => ({
  funcionario_id: funcionarioId,
  competencia: monthStartIso(),
  salario_bruto: salarioBase,
  desconto_inss: "",
  desconto_irpf: "",
  adicional_hrs_extras: "",
  desconto_outros: "",
  outros_descricao: "",
  observacoes: ""
});

export default function TrabalhistaPage() {
  const company = useStore((state) => state.company);
  const profile = useStore((state) => state.profile);
  const [data, setData] = useState<RhModuleData>(emptyRhData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeForm, setActiveForm] = useState<RhFormKind | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [funcionarioForm, setFuncionarioForm] = useState(defaultFuncionarioForm);
  const [folhaForm, setFolhaForm] = useState<FolhaForm>(defaultFolhaForm());

  const isAdminWithoutClient =
    profile.role === "bba_admin" && company.id === profile.id;

  const loadData = async () => {
    if (!company.id || isAdminWithoutClient) {
      setData(emptyRhData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      setData(await fetchRhModuleData(company.id));
    } catch (caught) {
      setData(emptyRhData);
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel carregar o modulo trabalhista."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, isAdminWithoutClient]);

  // ─── Live INSS/IRPF/FGTS calc for folha form ──────────────────────────
  const folhaCalc = useMemo(() => {
    const bruto = parseMoney(folhaForm.salario_bruto);
    const inss = folhaForm.desconto_inss !== ""
      ? parseMoney(folhaForm.desconto_inss)
      : calcularINSS(bruto);
    const irpf = folhaForm.desconto_irpf !== ""
      ? parseMoney(folhaForm.desconto_irpf)
      : calcularIRPF(bruto - inss);
    const fgts = calcularFGTS(bruto);
    const hrsExtras = parseMoney(folhaForm.adicional_hrs_extras);
    const outros = parseMoney(folhaForm.desconto_outros);
    const liquido = calcularSalarioLiquido(bruto, inss, irpf, outros, hrsExtras, 0);

    return { bruto, inss, irpf, fgts, hrsExtras, outros, liquido };
  }, [folhaForm]);

  // ─── Metrics ──────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const mesAtual = monthStartIso().slice(0, 7);
    const ativos = data.funcionarios.filter(
      (f) => f.situacao === "Ativo" || f.situacao === "Em experiência"
    );
    const folhaMes = data.folha.filter(
      (f) => f.competencia.slice(0, 7) === mesAtual && f.status !== "Cancelado"
    );

    return {
      totalAtivos: ativos.length,
      custoFolha: folhaMes.reduce((s, f) => s + Number(f.salario_bruto), 0),
      totalINSS: folhaMes.reduce((s, f) => s + Number(f.desconto_inss), 0),
      totalFGTS: folhaMes.reduce((s, f) => s + Number(f.fgts_competencia), 0)
    };
  }, [data]);

  const funcionarioNomeById = useMemo(
    () => new Map(data.funcionarios.map((f) => [f.id, f.nome])),
    [data.funcionarios]
  );

  const folhaOrdenada = useMemo(
    () => [...data.folha].sort((a, b) => b.competencia.localeCompare(a.competencia)),
    [data.folha]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeForm) return;

    setSaving(true);
    setNotice("");
    setError("");

    try {
      if (activeForm === "funcionario") {
        if (!funcionarioForm.nome.trim() || !funcionarioForm.data_admissao) {
          setError("Informe ao menos o nome e a data de admissao.");
          setSaving(false);
          return;
        }

        const payload: CreateFuncionarioInput = {
          company_id: company.id,
          nome: funcionarioForm.nome,
          cpf: funcionarioForm.cpf || null,
          cargo: funcionarioForm.cargo || null,
          departamento: funcionarioForm.departamento || null,
          tipo_contrato: funcionarioForm.tipo_contrato,
          situacao: funcionarioForm.situacao,
          data_admissao: funcionarioForm.data_admissao,
          salario_base: parseMoney(funcionarioForm.salario_base) || null,
          observacoes: funcionarioForm.observacoes || null
        };
        await saveFuncionario(payload);
        setFuncionarioForm(defaultFuncionarioForm());
        setNotice(`${funcionarioForm.nome} adicionado(a) com sucesso.`);
      }

      if (activeForm === "folha") {
        if (!folhaForm.funcionario_id || !folhaForm.competencia || !folhaCalc.bruto) {
          setError("Selecione o colaborador, competencia e informe o salario bruto.");
          setSaving(false);
          return;
        }

        const payload: CreateFolhaPagamentoInput = {
          company_id: company.id,
          funcionario_id: folhaForm.funcionario_id,
          competencia: folhaForm.competencia,
          salario_bruto: folhaCalc.bruto,
          desconto_inss: folhaCalc.inss,
          desconto_irpf: folhaCalc.irpf,
          desconto_outros: folhaCalc.outros,
          outros_descricao: folhaForm.outros_descricao || null,
          adicional_hrs_extras: folhaCalc.hrsExtras,
          adicional_outros: 0,
          salario_liquido: folhaCalc.liquido,
          fgts_competencia: folhaCalc.fgts,
          observacoes: folhaForm.observacoes || null
        };
        await saveFolhaPagamento(payload);
        setFolhaForm(defaultFolhaForm());
        setNotice("Entrada na folha registrada com sucesso.");
      }

      setActiveForm(null);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel salvar o registro de RH."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFolhaStatusChange = async (
    entry: RhFolhaPagamento,
    next: FolhaStatus
  ) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateFolhaStatus(entry.id, next);
      setNotice(
        `Folha de ${funcionarioNomeById.get(entry.funcionario_id) ?? "colaborador"} atualizada para ${next}.`
      );
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Falha ao atualizar folha."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDemitir = async (funcionario: RhFuncionario) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateFuncionarioSituacao(funcionario.id, "Demitido", todayIso());
      setNotice(`${funcionario.nome} desligado(a).`);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Falha ao atualizar colaborador."
      );
    } finally {
      setSaving(false);
    }
  };

  const openFolhaForm = (funcionario?: RhFuncionario) => {
    setFolhaForm(
      defaultFolhaForm(
        funcionario?.id ?? data.funcionarios[0]?.id ?? "",
        funcionario?.salario_base ? String(funcionario.salario_base) : ""
      )
    );
    setActiveForm("folha");
  };

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Trabalhista / RH</h1>
          <p>
            Colaboradores, folha de pagamentos e encargos de{" "}
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
            disabled={isAdminWithoutClient || !data.funcionarios.length}
            icon={<Shirt size={17} />}
            onClick={() => openFolhaForm()}
            variant="secondary"
          >
            Nova folha
          </Button>
          <Button
            disabled={isAdminWithoutClient}
            icon={<Plus size={17} />}
            onClick={() => {
              setFuncionarioForm(defaultFuncionarioForm());
              setActiveForm("funcionario");
            }}
          >
            Novo colaborador
          </Button>
        </div>
      </section>

      {isAdminWithoutClient ? (
        <Card title="Cliente nao selecionado">
          <div className="empty-state">
            A area admin ainda nao esta vinculada a um cliente especifico.
            O modulo trabalhista aparece quando entrar como usuario do cliente.
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
          Algumas tabelas de RH nao responderam no Supabase. Execute a migration
          de grants do modulo trabalhista e atualize a tela.
        </div>
      ) : null}

      <section className="section-grid">
        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <Users size={20} />
            </span>
            <div>
              <strong>{metrics.totalAtivos}</strong>
              <span>Colaboradores ativos</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <Banknote size={20} />
            </span>
            <div>
              <strong>{currency.format(metrics.custoFolha)}</strong>
              <span>Custo bruto da folha</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <DollarSign size={20} />
            </span>
            <div>
              <strong>{currency.format(metrics.totalINSS)}</strong>
              <span>Total INSS descontado</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <DollarSign size={20} />
            </span>
            <div>
              <strong>{currency.format(metrics.totalFGTS)}</strong>
              <span>Total FGTS a depositar</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card
          action={
            loading ? (
              <span className="status-badge status-badge--pending">Carregando</span>
            ) : (
              <span className="status-badge status-badge--pending">
                {data.funcionarios.length} colaborador(es)
              </span>
            )
          }
          className="span-8"
          title="Colaboradores"
        >
          <div className="fiscal-list fiscal-list--compact">
            {data.funcionarios.length ? (
              data.funcionarios.map((func) => (
                <article className="fiscal-row" key={func.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={funcionarioBadge(func.situacao)}>
                        {func.situacao}
                      </span>
                      <time>Desde {formatDate(func.data_admissao)}</time>
                    </div>
                    <h3>{func.nome}</h3>
                    <div className="fiscal-tags">
                      {func.cargo ? <span>{func.cargo}</span> : null}
                      {func.departamento ? <span>{func.departamento}</span> : null}
                      <span>{func.tipo_contrato}</span>
                      {func.salario_base ? (
                        <span>{currency.format(Number(func.salario_base))}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="fiscal-row__actions">
                    {func.situacao !== "Demitido" ? (
                      <>
                        <Button
                          disabled={saving}
                          icon={<Shirt size={15} />}
                          onClick={() => openFolhaForm(func)}
                          size="sm"
                          variant="secondary"
                        >
                          Folha
                        </Button>
                        <Button
                          disabled={saving}
                          icon={<UserMinus size={15} />}
                          onClick={() => void handleDemitir(func)}
                          size="sm"
                          variant="secondary"
                        >
                          Demitir
                        </Button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                Nenhum colaborador cadastrado.
              </div>
            )}
          </div>
        </Card>

        <Card className="span-4" title="Referências 2025">
          <div className="fiscal-list">
            <div className="timeline-row fiscal-deadline">
              <div>
                <strong>Salário mínimo</strong>
                <span>Decreto 12.302/2024</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                R$ 1.518,00
              </span>
            </div>

            <div className="timeline-row fiscal-deadline">
              <div>
                <strong>Teto INSS</strong>
                <span>Portaria MPS 26/2025</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                R$ 7.786,02
              </span>
            </div>

            <div className="timeline-row fiscal-deadline">
              <div>
                <strong>FGTS mensal</strong>
                <span>Lei 8.036/1990</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>8%</span>
            </div>

            <div className="timeline-row fiscal-deadline">
              <div>
                <strong>IRPF — isento até</strong>
                <span>Lei 14.848/2024</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                R$ 2.428,80
              </span>
            </div>

            <div style={{ padding: "6px 0 2px" }}>
              <small style={{ color: "var(--bba-muted)", fontWeight: 700, fontSize: "0.72rem" }}>
                INSS EMPREGADO — FAIXAS PROGRESSIVAS
              </small>
            </div>
            <div className="fiscal-tags" style={{ flexDirection: "column", gap: 4 }}>
              <span>Até R$ 1.518,00 → 7,5%</span>
              <span>R$ 1.518,01 a R$ 2.793,88 → 9%</span>
              <span>R$ 2.793,89 a R$ 4.190,83 → 12%</span>
              <span>R$ 4.190,84 a R$ 7.786,02 → 14%</span>
            </div>

            <div style={{ padding: "6px 0 2px" }}>
              <small style={{ color: "var(--bba-muted)", fontWeight: 700, fontSize: "0.72rem" }}>
                ENCARGOS PATRONAIS (estimativa geral)
              </small>
            </div>
            <div className="fiscal-tags" style={{ flexDirection: "column", gap: 4 }}>
              <span>INSS patronal: 20%</span>
              <span>FGTS patronal: 8%</span>
              <span>RAT/GILRAT: 1% a 3%</span>
              <span>Terceiros: ~2%</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card
          action={
            <span className="status-badge status-badge--pending">
              {data.folha.length} entrada(s)
            </span>
          }
          className="span-12"
          title="Folha de pagamentos"
        >
          <div className="fiscal-list fiscal-list--compact">
            {folhaOrdenada.length ? (
              folhaOrdenada.map((entry) => (
                <article className="fiscal-row" key={entry.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={folhaBadge(entry.status)}>
                        {entry.status}
                      </span>
                      <time>{formatCompetencia(entry.competencia)}</time>
                    </div>
                    <h3>
                      {funcionarioNomeById.get(entry.funcionario_id) ?? "Colaborador"}
                    </h3>
                    <div className="fiscal-tags">
                      <span>Bruto {currency.format(Number(entry.salario_bruto))}</span>
                      <span>INSS {currency.format(Number(entry.desconto_inss))}</span>
                      <span>IRPF {currency.format(Number(entry.desconto_irpf))}</span>
                      <span>FGTS {currency.format(Number(entry.fgts_competencia))}</span>
                      <span
                        style={{
                          color: "var(--bba-success)",
                          fontWeight: 700
                        }}
                      >
                        Líquido {currency.format(Number(entry.salario_liquido))}
                      </span>
                    </div>
                  </div>
                  <div className="fiscal-row__actions">
                    {entry.status === "Calculado" ? (
                      <Button
                        disabled={saving}
                        icon={<CheckCircle2 size={15} />}
                        onClick={() => void handleFolhaStatusChange(entry, "Aprovado")}
                        size="sm"
                        variant="secondary"
                      >
                        Aprovar
                      </Button>
                    ) : null}
                    {entry.status === "Aprovado" ? (
                      <Button
                        disabled={saving}
                        icon={<Banknote size={15} />}
                        onClick={() => void handleFolhaStatusChange(entry, "Pago")}
                        size="sm"
                        variant="secondary"
                      >
                        Pago
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                Nenhuma entrada na folha registrada.
              </div>
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
            title={activeForm === "funcionario" ? "Novo colaborador" : "Nova entrada na folha"}
          >
            <form className="fiscal-form" onSubmit={handleSubmit}>
              {activeForm === "funcionario" ? (
                <FuncionarioFields
                  form={funcionarioForm}
                  onChange={setFuncionarioForm}
                />
              ) : null}

              {activeForm === "folha" ? (
                <FolhaFields
                  calc={folhaCalc}
                  funcionarios={data.funcionarios}
                  form={folhaForm}
                  onChange={setFolhaForm}
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

function FuncionarioFields({
  form,
  onChange
}: {
  form: FuncionarioForm;
  onChange: (form: FuncionarioForm) => void;
}) {
  const update = <K extends keyof FuncionarioForm>(key: K, value: FuncionarioForm[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="form-grid form-grid--two">
      <div className="span-form-2">
        <Field id="func-nome" label="Nome completo">
          <input
            id="func-nome"
            onChange={(e) => update("nome", e.target.value)}
            placeholder="Ex: Ana Paula Ferreira"
            required
            value={form.nome}
          />
        </Field>
      </div>

      <Field id="func-cargo" label="Cargo">
        <input
          id="func-cargo"
          onChange={(e) => update("cargo", e.target.value)}
          placeholder="Ex: Analista Financeiro"
          value={form.cargo}
        />
      </Field>

      <Field id="func-depto" label="Departamento">
        <input
          id="func-depto"
          onChange={(e) => update("departamento", e.target.value)}
          placeholder="Ex: Financeiro"
          value={form.departamento}
        />
      </Field>

      <Field id="func-tipo" label="Tipo de contrato">
        <select
          id="func-tipo"
          onChange={(e) => update("tipo_contrato", e.target.value as FuncionarioTipoContrato)}
          value={form.tipo_contrato}
        >
          {tiposContrato.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </Field>

      <Field id="func-situacao" label="Situacao">
        <select
          id="func-situacao"
          onChange={(e) => update("situacao", e.target.value as FuncionarioSituacao)}
          value={form.situacao}
        >
          {situacoes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field id="func-admissao" label="Data de admissao">
        <input
          id="func-admissao"
          onChange={(e) => update("data_admissao", e.target.value)}
          required
          type="date"
          value={form.data_admissao}
        />
      </Field>

      <Field id="func-salario" label="Salario base (R$)">
        <input
          id="func-salario"
          inputMode="decimal"
          onChange={(e) => update("salario_base", e.target.value)}
          placeholder="0,00"
          value={form.salario_base}
        />
      </Field>

      <Field id="func-cpf" label="CPF (opcional)">
        <input
          id="func-cpf"
          onChange={(e) => update("cpf", e.target.value)}
          placeholder="000.000.000-00"
          value={form.cpf}
        />
      </Field>

      <div className="span-form-2">
        <Field id="func-obs" label="Observacoes">
          <textarea
            id="func-obs"
            onChange={(e) => update("observacoes", e.target.value)}
            value={form.observacoes}
          />
        </Field>
      </div>
    </div>
  );
}

function FolhaFields({
  calc,
  funcionarios,
  form,
  onChange
}: {
  calc: {
    bruto: number;
    inss: number;
    irpf: number;
    fgts: number;
    hrsExtras: number;
    outros: number;
    liquido: number;
  };
  funcionarios: RhFuncionario[];
  form: FolhaForm;
  onChange: (form: FolhaForm) => void;
}) {
  const update = <K extends keyof FolhaForm>(key: K, value: FolhaForm[K]) =>
    onChange({ ...form, [key]: value });

  const currency = new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  });

  return (
    <div className="form-grid form-grid--two">
      <div className="span-form-2">
        <Field id="folha-func" label="Colaborador">
          <select
            id="folha-func"
            onChange={(e) => {
              const func = funcionarios.find((f) => f.id === e.target.value);
              onChange({
                ...form,
                funcionario_id: e.target.value,
                salario_bruto: func?.salario_base ? String(func.salario_base) : "",
                desconto_inss: "",
                desconto_irpf: ""
              });
            }}
            required
            value={form.funcionario_id}
          >
            <option value="">Selecione um colaborador</option>
            {funcionarios
              .filter((f) => f.situacao !== "Demitido")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} {f.cargo ? `— ${f.cargo}` : ""}
                </option>
              ))}
          </select>
        </Field>
      </div>

      <Field id="folha-competencia" label="Competencia">
        <input
          id="folha-competencia"
          onChange={(e) => update("competencia", e.target.value)}
          required
          type="date"
          value={form.competencia}
        />
      </Field>

      <Field id="folha-bruto" label="Salario bruto (R$)">
        <input
          id="folha-bruto"
          inputMode="decimal"
          onChange={(e) => {
            update("salario_bruto", e.target.value);
            // clear overrides so they auto-recalculate
            onChange({ ...form, salario_bruto: e.target.value, desconto_inss: "", desconto_irpf: "" });
          }}
          placeholder="0,00"
          required
          value={form.salario_bruto}
        />
      </Field>

      <Field id="folha-inss" label={`INSS calculado (${currency.format(calc.inss)})`}>
        <input
          id="folha-inss"
          inputMode="decimal"
          onChange={(e) => update("desconto_inss", e.target.value)}
          placeholder={String(calc.inss)}
          value={form.desconto_inss}
        />
      </Field>

      <Field id="folha-irpf" label={`IRPF calculado (${currency.format(calc.irpf)})`}>
        <input
          id="folha-irpf"
          inputMode="decimal"
          onChange={(e) => update("desconto_irpf", e.target.value)}
          placeholder={String(calc.irpf)}
          value={form.desconto_irpf}
        />
      </Field>

      <Field id="folha-hrs" label="Adicional horas extras (R$)">
        <input
          id="folha-hrs"
          inputMode="decimal"
          onChange={(e) => update("adicional_hrs_extras", e.target.value)}
          placeholder="0,00"
          value={form.adicional_hrs_extras}
        />
      </Field>

      <Field id="folha-outros-desc" label="Outros descontos (R$)">
        <input
          id="folha-outros-desc"
          inputMode="decimal"
          onChange={(e) => update("desconto_outros", e.target.value)}
          placeholder="0,00"
          value={form.desconto_outros}
        />
      </Field>

      <Field id="folha-outros-label" label="Descricao outros descontos">
        <input
          id="folha-outros-label"
          onChange={(e) => update("outros_descricao", e.target.value)}
          placeholder="Ex: Vale transporte, plano de saude"
          value={form.outros_descricao}
        />
      </Field>

      <div className="span-form-2">
        <div
          className="fiscal-tags"
          style={{ background: "#f3f0ea", borderRadius: 8, padding: "10px 12px", gap: 8 }}
        >
          <span style={{ color: "var(--bba-muted)", fontWeight: 700, fontSize: "0.8rem" }}>
            FGTS a depositar (patronal):
          </span>
          <span style={{ fontWeight: 700 }}>{currency.format(calc.fgts)}</span>
          <span style={{ color: "var(--bba-success)", fontWeight: 700, marginLeft: "auto" }}>
            Salario líquido estimado: {currency.format(calc.liquido)}
          </span>
        </div>
      </div>

      <div className="span-form-2">
        <Field id="folha-obs" label="Observacoes">
          <textarea
            id="folha-obs"
            onChange={(e) => update("observacoes", e.target.value)}
            value={form.observacoes}
          />
        </Field>
      </div>
    </div>
  );
}

