"use client";

import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  FilePen,
  Landmark,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Users
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchSocietarioModuleData,
  saveAlteracao,
  saveAssembleia,
  saveCapitalSocial,
  saveSocio,
  updateAlteracaoStatus,
  updateAssembleiaStatus,
  updateSocioStatus,
  type AlteracaoStatus,
  type AlteracaoTipo,
  type AssembleiaTipo,
  type AssembleiaStatus,
  type Alteracao,
  type Assembleia,
  type CreateAlteracaoInput,
  type CreateAssembleiaInput,
  type CreateCapitalSocialInput,
  type CreateSocioInput,
  type Socio,
  type SocioEstadoCivil,
  type SocioStatus,
  type SocioTipo,
  type SocietarioModuleData
} from "@bba/lib";
import { useBbaStore as useStore } from "@bba/lib";
import { Button, Card } from "@bba/ui";

type FormKind = "socio" | "alteracao" | "assembleia" | "capital" | null;

type SocioForm = {
  nome: string;
  cpf_cnpj: string;
  tipo: SocioTipo;
  nacionalidade: string;
  profissao: string;
  estado_civil: SocioEstadoCivil | "";
  percentual_participacao: string;
  valor_cotas: string;
  numero_cotas: string;
  data_entrada: string;
  observacoes: string;
};

type AlteracaoForm = {
  tipo: AlteracaoTipo;
  numero_alteracao: string;
  data_assinatura: string;
  data_registro: string;
  nire: string;
  junta_comercial: string;
  descricao: string;
  status: AlteracaoStatus;
  observacoes: string;
};

type AssembleiaForm = {
  tipo: AssembleiaTipo;
  data_convocacao: string;
  data_realizacao: string;
  pauta: string;
  deliberacoes: string;
  quorum_percentual: string;
  status: AssembleiaStatus;
  observacoes: string;
};

type CapitalForm = {
  valor_total: string;
  valor_integralizado: string;
  data_referencia: string;
  observacoes: string;
};

const emptyData: SocietarioModuleData = {
  socios: [],
  capital: [],
  alteracoes: [],
  assembleias: [],
  warnings: []
};

const tiposSocio: SocioTipo[] = ["PF", "PJ"];
const estadosCivis: SocioEstadoCivil[] = [
  "Solteiro", "Casado", "Divorciado", "Viúvo", "União estável", "Separado"
];
const tiposAlteracao: AlteracaoTipo[] = [
  "Constituição", "Alteração", "Consolidação", "Distrato",
  "Transferência de Cotas", "Aumento de Capital", "Redução de Capital",
  "Mudança de Objeto Social", "Mudança de Endereço", "Mudança de Nome"
];
const statusAlteracao: AlteracaoStatus[] = [
  "Em elaboração", "Assinado", "Registrado", "Arquivado"
];
const tiposAssembleia: AssembleiaTipo[] = [
  "AGO", "AGE", "Reunião de Diretoria", "Reunião de Sócios", "Outros"
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${Number(v).toFixed(2).replace(".", ",")}%`;

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
};

const parseMoney = (v: string): number => {
  if (!v.trim()) return 0;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const parseNum = (v: string): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const socioBadge = (status: SocioStatus) => {
  if (status === "Ativo") return "status-badge status-badge--completed";
  if (status === "Cedente") return "status-badge status-badge--pending";
  return "status-badge status-badge--cancelled";
};

const alteracaoBadge = (status: AlteracaoStatus) => {
  if (status === "Arquivado") return "status-badge status-badge--completed";
  if (status === "Registrado") return "status-badge status-badge--in_progress";
  if (status === "Assinado") return "status-badge status-badge--in_progress";
  return "status-badge status-badge--pending";
};

const assembleiaBadge = (status: AssembleiaStatus) => {
  if (status === "Realizada") return "status-badge status-badge--completed";
  if (status === "Cancelada") return "status-badge status-badge--cancelled";
  return "status-badge status-badge--pending";
};

const alteracaoNextStatus = (current: AlteracaoStatus): AlteracaoStatus | null => {
  if (current === "Em elaboração") return "Assinado";
  if (current === "Assinado") return "Registrado";
  if (current === "Registrado") return "Arquivado";
  return null;
};

const alteracaoNextLabel = (next: AlteracaoStatus) => {
  if (next === "Assinado") return "Assinar";
  if (next === "Registrado") return "Registrar";
  if (next === "Arquivado") return "Arquivar";
  return next;
};

const defaultSocioForm = (): SocioForm => ({
  nome: "",
  cpf_cnpj: "",
  tipo: "PF",
  nacionalidade: "Brasileira",
  profissao: "",
  estado_civil: "",
  percentual_participacao: "",
  valor_cotas: "",
  numero_cotas: "",
  data_entrada: todayIso(),
  observacoes: ""
});

const defaultAlteracaoForm = (): AlteracaoForm => ({
  tipo: "Alteração",
  numero_alteracao: "",
  data_assinatura: todayIso(),
  data_registro: "",
  nire: "",
  junta_comercial: "",
  descricao: "",
  status: "Em elaboração",
  observacoes: ""
});

const defaultAssembleiaForm = (): AssembleiaForm => ({
  tipo: "AGE",
  data_convocacao: todayIso(),
  data_realizacao: "",
  pauta: "",
  deliberacoes: "",
  quorum_percentual: "",
  status: "Convocada",
  observacoes: ""
});

const defaultCapitalForm = (): CapitalForm => ({
  valor_total: "",
  valor_integralizado: "",
  data_referencia: todayIso(),
  observacoes: ""
});

export default function SocietarioPage() {
  const company = useStore((s) => s.company);
  const profile = useStore((s) => s.profile);
  const [data, setData] = useState<SocietarioModuleData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeForm, setActiveForm] = useState<FormKind>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [socioForm, setSocioForm] = useState<SocioForm>(defaultSocioForm);
  const [alteracaoForm, setAlteracaoForm] = useState<AlteracaoForm>(defaultAlteracaoForm);
  const [assembleiaForm, setAssembleiaForm] = useState<AssembleiaForm>(defaultAssembleiaForm);
  const [capitalForm, setCapitalForm] = useState<CapitalForm>(defaultCapitalForm);

  const isAdminWithoutClient =
    profile.role === "bba_admin" && company.id === profile.id;

  const loadData = async () => {
    if (!company.id || isAdminWithoutClient) {
      setData(emptyData);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await fetchSocietarioModuleData(company.id));
    } catch (e) {
      setData(emptyData);
      setError(e instanceof Error ? e.message : "Erro ao carregar dados societários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, isAdminWithoutClient]);

  // ─── Metrics ──────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const today = todayIso();
    const ativos = data.socios.filter((s) => s.status === "Ativo");
    const capitalAtual = data.capital[0];
    const ultimaAlteracao = data.alteracoes.find((a) => a.data_assinatura)?.data_assinatura;
    const proximasAssembleias = data.assembleias.filter(
      (a) => a.status === "Convocada" && a.data_realizacao >= today
    ).length;

    return {
      totalSocios: ativos.length,
      capitalTotal: capitalAtual ? Number(capitalAtual.valor_total) : null,
      ultimaAlteracao: ultimaAlteracao ?? null,
      proximasAssembleias
    };
  }, [data]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeForm) return;
    setSaving(true);
    setNotice("");
    setError("");

    try {
      if (activeForm === "socio") {
        if (!socioForm.nome.trim() || !socioForm.data_entrada) {
          setError("Informe ao menos o nome e a data de entrada.");
          setSaving(false);
          return;
        }
        const payload: CreateSocioInput = {
          company_id: company.id,
          nome: socioForm.nome,
          cpf_cnpj: socioForm.cpf_cnpj || null,
          tipo: socioForm.tipo,
          nacionalidade: socioForm.nacionalidade || null,
          profissao: socioForm.profissao || null,
          estado_civil: (socioForm.estado_civil || null) as SocioEstadoCivil | null,
          percentual_participacao: parseMoney(socioForm.percentual_participacao),
          valor_cotas: parseMoney(socioForm.valor_cotas),
          numero_cotas: parseNum(socioForm.numero_cotas),
          data_entrada: socioForm.data_entrada,
          observacoes: socioForm.observacoes || null
        };
        await saveSocio(payload);
        setSocioForm(defaultSocioForm());
        setNotice(`${socioForm.nome} adicionado(a) ao quadro societário.`);
      }

      if (activeForm === "alteracao") {
        const payload: CreateAlteracaoInput = {
          company_id: company.id,
          tipo: alteracaoForm.tipo,
          numero_alteracao: parseNum(alteracaoForm.numero_alteracao),
          data_assinatura: alteracaoForm.data_assinatura || null,
          data_registro: alteracaoForm.data_registro || null,
          nire: alteracaoForm.nire || null,
          junta_comercial: alteracaoForm.junta_comercial || null,
          descricao: alteracaoForm.descricao || null,
          status: alteracaoForm.status,
          observacoes: alteracaoForm.observacoes || null
        };
        await saveAlteracao(payload);
        setAlteracaoForm(defaultAlteracaoForm());
        setNotice("Alteração contratual registrada com sucesso.");
      }

      if (activeForm === "assembleia") {
        if (!assembleiaForm.data_realizacao) {
          setError("Informe a data de realização da assembleia.");
          setSaving(false);
          return;
        }
        const payload: CreateAssembleiaInput = {
          company_id: company.id,
          tipo: assembleiaForm.tipo,
          data_convocacao: assembleiaForm.data_convocacao || null,
          data_realizacao: assembleiaForm.data_realizacao,
          pauta: assembleiaForm.pauta || null,
          deliberacoes: assembleiaForm.deliberacoes || null,
          quorum_percentual: parseNum(assembleiaForm.quorum_percentual),
          status: assembleiaForm.status,
          observacoes: assembleiaForm.observacoes || null
        };
        await saveAssembleia(payload);
        setAssembleiaForm(defaultAssembleiaForm());
        setNotice("Assembleia registrada com sucesso.");
      }

      if (activeForm === "capital") {
        const total = parseMoney(capitalForm.valor_total);
        if (!total) {
          setError("Informe o valor total do capital social.");
          setSaving(false);
          return;
        }
        const payload: CreateCapitalSocialInput = {
          company_id: company.id,
          valor_total: total,
          valor_integralizado: parseMoney(capitalForm.valor_integralizado) || total,
          data_referencia: capitalForm.data_referencia,
          observacoes: capitalForm.observacoes || null
        };
        await saveCapitalSocial(payload);
        setCapitalForm(defaultCapitalForm());
        setNotice("Capital social atualizado.");
      }

      setActiveForm(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar registro societário.");
    } finally {
      setSaving(false);
    }
  };

  const handleAlteracaoAvance = async (alt: Alteracao) => {
    const next = alteracaoNextStatus(alt.status);
    if (!next) return;
    setSaving(true);
    setError("");
    try {
      await updateAlteracaoStatus(alt.id, next);
      setNotice(`Alteração atualizada para "${next}".`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar alteração.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssembleiaRealizada = async (asm: Assembleia) => {
    setSaving(true);
    setError("");
    try {
      await updateAssembleiaStatus(asm.id, "Realizada");
      setNotice("Assembleia marcada como realizada.");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar assembleia.");
    } finally {
      setSaving(false);
    }
  };

  const handleSocioDesligar = async (socio: Socio) => {
    setSaving(true);
    setError("");
    try {
      await updateSocioStatus(socio.id, "Cedente", todayIso());
      setNotice(`${socio.nome} marcado(a) como cedente.`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar sócio.");
    } finally {
      setSaving(false);
    }
  };

  const capitalAtual = data.capital[0];
  const totalParticipacao = data.socios
    .filter((s) => s.status === "Ativo")
    .reduce((s, v) => s + Number(v.percentual_participacao), 0);

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Societário</h1>
          <p>
            Quadro societário, capital social, alterações e assembleias de{" "}
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
            icon={<CalendarDays size={17} />}
            onClick={() => { setAssembleiaForm(defaultAssembleiaForm()); setActiveForm("assembleia"); }}
            variant="secondary"
          >
            Nova assembleia
          </Button>
          <Button
            disabled={isAdminWithoutClient}
            icon={<FilePen size={17} />}
            onClick={() => { setAlteracaoForm(defaultAlteracaoForm()); setActiveForm("alteracao"); }}
            variant="secondary"
          >
            Nova alteração
          </Button>
          <Button
            disabled={isAdminWithoutClient}
            icon={<Plus size={17} />}
            onClick={() => { setSocioForm(defaultSocioForm()); setActiveForm("socio"); }}
          >
            Novo sócio
          </Button>
        </div>
      </section>

      {isAdminWithoutClient ? (
        <Card title="Cliente não selecionado">
          <div className="empty-state">
            O módulo societário aparece quando você entrar como usuário do cliente.
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
          Algumas tabelas societárias não responderam. Execute a migration de grants do
          módulo societário e atualize a tela.
        </div>
      ) : null}

      {/* ── Metrics ── */}
      <section className="section-grid">
        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon"><Users size={20} /></span>
            <div>
              <strong>{metrics.totalSocios}</strong>
              <span>Sócios ativos</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon"><DollarSign size={20} /></span>
            <div>
              <strong>
                {metrics.capitalTotal !== null
                  ? currency.format(metrics.capitalTotal)
                  : "—"}
              </strong>
              <span>Capital social</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon"><FilePen size={20} /></span>
            <div>
              <strong>
                {metrics.ultimaAlteracao ? formatDate(metrics.ultimaAlteracao) : "—"}
              </strong>
              <span>Última alteração</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon"><CalendarDays size={20} /></span>
            <div>
              <strong>{metrics.proximasAssembleias}</strong>
              <span>Assembleias convocadas</span>
            </div>
          </div>
        </Card>
      </section>

      {/* ── Quadro societário + Capital social ── */}
      <section className="section-grid">
        <Card
          action={
            loading ? (
              <span className="status-badge status-badge--pending">Carregando</span>
            ) : (
              <span className="status-badge status-badge--pending">
                {data.socios.length} sócio(s)
              </span>
            )
          }
          className="span-8"
          title="Quadro Societário"
        >
          <div className="fiscal-list fiscal-list--compact">
            {data.socios.length ? (
              data.socios.map((socio) => (
                <article className="fiscal-row" key={socio.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={socioBadge(socio.status)}>{socio.status}</span>
                      <time>Desde {formatDate(socio.data_entrada)}</time>
                    </div>
                    <h3>{socio.nome}</h3>
                    <div className="fiscal-tags">
                      <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                        {pct(Number(socio.percentual_participacao))}
                      </span>
                      <span>{currency.format(Number(socio.valor_cotas))}</span>
                      {socio.numero_cotas ? (
                        <span>{socio.numero_cotas.toLocaleString("pt-BR")} cotas</span>
                      ) : null}
                      <span>{socio.tipo}</span>
                      {socio.profissao ? <span>{socio.profissao}</span> : null}
                      {socio.nacionalidade ? <span>{socio.nacionalidade}</span> : null}
                    </div>
                  </div>
                  <div className="fiscal-row__actions">
                    {socio.status === "Ativo" ? (
                      <Button
                        disabled={saving}
                        onClick={() => void handleSocioDesligar(socio)}
                        size="sm"
                        variant="secondary"
                      >
                        Cedente
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">Nenhum sócio cadastrado.</div>
            )}

            {data.socios.length > 0 ? (
              <div
                style={{
                  padding: "10px 0 2px",
                  borderTop: "1px solid var(--bba-border)",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  fontSize: "0.8rem",
                  color: "var(--bba-muted)"
                }}
              >
                <span>Total participação:</span>
                <strong style={{ color: totalParticipacao === 100 ? "var(--bba-success)" : "var(--bba-danger)" }}>
                  {pct(totalParticipacao)}
                </strong>
                {totalParticipacao !== 100 ? (
                  <span style={{ color: "var(--bba-danger)" }}>
                    ⚠ Soma deve ser 100%
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card
          action={
            <Button
              disabled={isAdminWithoutClient || saving}
              icon={<Plus size={15} />}
              onClick={() => { setCapitalForm(defaultCapitalForm()); setActiveForm("capital"); }}
              size="sm"
              variant="secondary"
            >
              Atualizar
            </Button>
          }
          className="span-4"
          title="Capital Social"
        >
          <div className="fiscal-list">
            {capitalAtual ? (
              <>
                <div className="timeline-row fiscal-deadline">
                  <div>
                    <strong>Capital total</strong>
                    <span>Referência: {formatDate(capitalAtual.data_referencia)}</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    {currency.format(Number(capitalAtual.valor_total))}
                  </span>
                </div>
                <div className="timeline-row fiscal-deadline">
                  <div>
                    <strong>Integralizado</strong>
                    <span>
                      {pct(
                        capitalAtual.valor_total > 0
                          ? (Number(capitalAtual.valor_integralizado) /
                              Number(capitalAtual.valor_total)) *
                            100
                          : 0
                      )}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    {currency.format(Number(capitalAtual.valor_integralizado))}
                  </span>
                </div>
                <div className="timeline-row fiscal-deadline">
                  <div>
                    <strong>Moeda</strong>
                  </div>
                  <span>{capitalAtual.moeda}</span>
                </div>
                {capitalAtual.observacoes ? (
                  <div style={{ padding: "6px 0", fontSize: "0.82rem", color: "var(--bba-muted)" }}>
                    {capitalAtual.observacoes}
                  </div>
                ) : null}
                {data.capital.length > 1 ? (
                  <div style={{ padding: "6px 0 0", fontSize: "0.78rem", color: "var(--bba-muted)" }}>
                    {data.capital.length - 1} registro(s) anterior(es)
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-state">
                Nenhum registro de capital social.
                <br />
                <button
                  className="link-button"
                  onClick={() => { setCapitalForm(defaultCapitalForm()); setActiveForm("capital"); }}
                  style={{ color: "var(--bba-accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: "0.85rem", marginTop: 6 }}
                >
                  Registrar capital social
                </button>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* ── Alterações + Assembleias ── */}
      <section className="section-grid">
        <Card
          action={
            <span className="status-badge status-badge--pending">
              {data.alteracoes.length} registro(s)
            </span>
          }
          className="span-8"
          title="Alterações Contratuais"
        >
          <div className="fiscal-list fiscal-list--compact">
            {data.alteracoes.length ? (
              data.alteracoes.map((alt) => {
                const next = alteracaoNextStatus(alt.status);
                return (
                  <article className="fiscal-row" key={alt.id}>
                    <div className="fiscal-row__main">
                      <div className="task-card__topline">
                        <span className={alteracaoBadge(alt.status)}>{alt.status}</span>
                        {alt.numero_alteracao ? (
                          <span>Nº {alt.numero_alteracao}</span>
                        ) : null}
                        {alt.data_assinatura ? (
                          <time>Assinado {formatDate(alt.data_assinatura)}</time>
                        ) : null}
                      </div>
                      <h3>{alt.tipo}</h3>
                      <div className="fiscal-tags">
                        {alt.nire ? <span>NIRE: {alt.nire}</span> : null}
                        {alt.junta_comercial ? <span>{alt.junta_comercial}</span> : null}
                        {alt.data_registro ? (
                          <span>Registrado {formatDate(alt.data_registro)}</span>
                        ) : null}
                      </div>
                      {alt.descricao ? (
                        <p style={{ fontSize: "0.82rem", color: "var(--bba-muted)", margin: "4px 0 0" }}>
                          {alt.descricao}
                        </p>
                      ) : null}
                    </div>
                    <div className="fiscal-row__actions">
                      {next ? (
                        <Button
                          disabled={saving}
                          icon={<CheckCircle2 size={15} />}
                          onClick={() => void handleAlteracaoAvance(alt)}
                          size="sm"
                          variant="secondary"
                        >
                          {alteracaoNextLabel(next)}
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">Nenhuma alteração contratual registrada.</div>
            )}
          </div>
        </Card>

        <Card
          action={
            <span className="status-badge status-badge--pending">
              {data.assembleias.length} evento(s)
            </span>
          }
          className="span-4"
          title="Assembleias e Reuniões"
        >
          <div className="fiscal-list">
            {data.assembleias.length ? (
              data.assembleias.map((asm) => (
                <article className="fiscal-row" key={asm.id} style={{ flexDirection: "column", gap: 4 }}>
                  <div className="task-card__topline">
                    <span className={assembleiaBadge(asm.status)}>{asm.status}</span>
                    <strong style={{ fontSize: "0.8rem" }}>{asm.tipo}</strong>
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    {formatDate(asm.data_realizacao)}
                  </div>
                  {asm.pauta ? (
                    <p style={{ fontSize: "0.78rem", color: "var(--bba-muted)", margin: 0 }}>
                      {asm.pauta.length > 80 ? `${asm.pauta.slice(0, 80)}…` : asm.pauta}
                    </p>
                  ) : null}
                  {asm.quorum_percentual ? (
                    <span style={{ fontSize: "0.75rem", color: "var(--bba-muted)" }}>
                      Quórum: {pct(Number(asm.quorum_percentual))}
                    </span>
                  ) : null}
                  {asm.status === "Convocada" ? (
                    <Button
                      disabled={saving}
                      icon={<CheckCircle2 size={14} />}
                      onClick={() => void handleAssembleiaRealizada(asm)}
                      size="sm"
                      variant="secondary"
                    >
                      Realizada
                    </Button>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="empty-state">Nenhuma assembleia registrada.</div>
            )}
          </div>
        </Card>
      </section>

      {/* ── Modal ── */}
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
            title={
              activeForm === "socio"
                ? "Novo sócio"
                : activeForm === "alteracao"
                ? "Nova alteração contratual"
                : activeForm === "assembleia"
                ? "Nova assembleia / reunião"
                : "Atualizar capital social"
            }
          >
            <form className="fiscal-form" onSubmit={handleSubmit}>
              {activeForm === "socio" ? (
                <SocioFields form={socioForm} onChange={setSocioForm} />
              ) : null}
              {activeForm === "alteracao" ? (
                <AlteracaoFields form={alteracaoForm} onChange={setAlteracaoForm} />
              ) : null}
              {activeForm === "assembleia" ? (
                <AssembleiaFields form={assembleiaForm} onChange={setAssembleiaForm} />
              ) : null}
              {activeForm === "capital" ? (
                <CapitalFields form={capitalForm} onChange={setCapitalForm} />
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

// ─── Sub-components ────────────────────────────────────────────────────────────

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

function SocioFields({
  form,
  onChange
}: {
  form: SocioForm;
  onChange: (f: SocioForm) => void;
}) {
  const set = <K extends keyof SocioForm>(k: K, v: SocioForm[K]) =>
    onChange({ ...form, [k]: v });

  return (
    <div className="form-grid form-grid--two">
      <div className="span-form-2">
        <Field id="s-nome" label="Nome completo">
          <input
            id="s-nome"
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Ex: João Paulo Rodrigues"
            required
            value={form.nome}
          />
        </Field>
      </div>

      <Field id="s-tipo" label="Tipo">
        <select id="s-tipo" onChange={(e) => set("tipo", e.target.value as SocioTipo)} value={form.tipo}>
          {tiposSocio.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>

      <Field id="s-cpf" label={form.tipo === "PF" ? "CPF" : "CNPJ"}>
        <input
          id="s-cpf"
          onChange={(e) => set("cpf_cnpj", e.target.value)}
          placeholder={form.tipo === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
          value={form.cpf_cnpj}
        />
      </Field>

      <Field id="s-nacionalidade" label="Nacionalidade">
        <input
          id="s-nacionalidade"
          onChange={(e) => set("nacionalidade", e.target.value)}
          value={form.nacionalidade}
        />
      </Field>

      <Field id="s-profissao" label="Profissão">
        <input
          id="s-profissao"
          onChange={(e) => set("profissao", e.target.value)}
          placeholder="Ex: Empresário"
          value={form.profissao}
        />
      </Field>

      {form.tipo === "PF" ? (
        <Field id="s-estado-civil" label="Estado civil">
          <select
            id="s-estado-civil"
            onChange={(e) => set("estado_civil", e.target.value as SocioEstadoCivil)}
            value={form.estado_civil}
          >
            <option value="">Selecione</option>
            {estadosCivis.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
          </select>
        </Field>
      ) : null}

      <Field id="s-pct" label="Participação (%)">
        <input
          id="s-pct"
          inputMode="decimal"
          onChange={(e) => set("percentual_participacao", e.target.value)}
          placeholder="Ex: 60"
          value={form.percentual_participacao}
        />
      </Field>

      <Field id="s-valor" label="Valor das cotas (R$)">
        <input
          id="s-valor"
          inputMode="decimal"
          onChange={(e) => set("valor_cotas", e.target.value)}
          placeholder="0,00"
          value={form.valor_cotas}
        />
      </Field>

      <Field id="s-ncotas" label="Número de cotas">
        <input
          id="s-ncotas"
          inputMode="numeric"
          onChange={(e) => set("numero_cotas", e.target.value)}
          placeholder="Ex: 60000"
          value={form.numero_cotas}
        />
      </Field>

      <Field id="s-entrada" label="Data de entrada">
        <input
          id="s-entrada"
          onChange={(e) => set("data_entrada", e.target.value)}
          required
          type="date"
          value={form.data_entrada}
        />
      </Field>

      <div className="span-form-2">
        <Field id="s-obs" label="Observações">
          <textarea id="s-obs" onChange={(e) => set("observacoes", e.target.value)} value={form.observacoes} />
        </Field>
      </div>
    </div>
  );
}

function AlteracaoFields({
  form,
  onChange
}: {
  form: AlteracaoForm;
  onChange: (f: AlteracaoForm) => void;
}) {
  const set = <K extends keyof AlteracaoForm>(k: K, v: AlteracaoForm[K]) =>
    onChange({ ...form, [k]: v });

  return (
    <div className="form-grid form-grid--two">
      <Field id="a-tipo" label="Tipo de alteração">
        <select id="a-tipo" onChange={(e) => set("tipo", e.target.value as AlteracaoTipo)} value={form.tipo}>
          {tiposAlteracao.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>

      <Field id="a-status" label="Status">
        <select id="a-status" onChange={(e) => set("status", e.target.value as AlteracaoStatus)} value={form.status}>
          {statusAlteracao.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <Field id="a-num" label="Número da alteração">
        <input
          id="a-num"
          inputMode="numeric"
          onChange={(e) => set("numero_alteracao", e.target.value)}
          placeholder="Ex: 2"
          value={form.numero_alteracao}
        />
      </Field>

      <Field id="a-junta" label="Junta Comercial">
        <input
          id="a-junta"
          onChange={(e) => set("junta_comercial", e.target.value)}
          placeholder="Ex: JUCESP"
          value={form.junta_comercial}
        />
      </Field>

      <Field id="a-assinatura" label="Data de assinatura">
        <input
          id="a-assinatura"
          onChange={(e) => set("data_assinatura", e.target.value)}
          type="date"
          value={form.data_assinatura}
        />
      </Field>

      <Field id="a-registro" label="Data de registro">
        <input
          id="a-registro"
          onChange={(e) => set("data_registro", e.target.value)}
          type="date"
          value={form.data_registro}
        />
      </Field>

      <div className="span-form-2">
        <Field id="a-nire" label="NIRE">
          <input
            id="a-nire"
            onChange={(e) => set("nire", e.target.value)}
            placeholder="Ex: 35901234560"
            value={form.nire}
          />
        </Field>
      </div>

      <div className="span-form-2">
        <Field id="a-desc" label="Descrição / objeto da alteração">
          <textarea id="a-desc" onChange={(e) => set("descricao", e.target.value)} value={form.descricao} />
        </Field>
      </div>

      <div className="span-form-2">
        <Field id="a-obs" label="Observações">
          <textarea id="a-obs" onChange={(e) => set("observacoes", e.target.value)} value={form.observacoes} />
        </Field>
      </div>
    </div>
  );
}

function AssembleiaFields({
  form,
  onChange
}: {
  form: AssembleiaForm;
  onChange: (f: AssembleiaForm) => void;
}) {
  const set = <K extends keyof AssembleiaForm>(k: K, v: AssembleiaForm[K]) =>
    onChange({ ...form, [k]: v });

  return (
    <div className="form-grid form-grid--two">
      <Field id="asm-tipo" label="Tipo">
        <select id="asm-tipo" onChange={(e) => set("tipo", e.target.value as AssembleiaTipo)} value={form.tipo}>
          {tiposAssembleia.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>

      <Field id="asm-status" label="Status">
        <select
          id="asm-status"
          onChange={(e) => set("status", e.target.value as AssembleiaStatus)}
          value={form.status}
        >
          {(["Convocada", "Realizada", "Cancelada"] as AssembleiaStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>

      <Field id="asm-conv" label="Data de convocação">
        <input
          id="asm-conv"
          onChange={(e) => set("data_convocacao", e.target.value)}
          type="date"
          value={form.data_convocacao}
        />
      </Field>

      <Field id="asm-real" label="Data de realização">
        <input
          id="asm-real"
          onChange={(e) => set("data_realizacao", e.target.value)}
          required
          type="date"
          value={form.data_realizacao}
        />
      </Field>

      <Field id="asm-quorum" label="Quórum presente (%)">
        <input
          id="asm-quorum"
          inputMode="decimal"
          onChange={(e) => set("quorum_percentual", e.target.value)}
          placeholder="Ex: 100"
          value={form.quorum_percentual}
        />
      </Field>

      <div className="span-form-2">
        <Field id="asm-pauta" label="Pauta">
          <textarea id="asm-pauta" onChange={(e) => set("pauta", e.target.value)} value={form.pauta} />
        </Field>
      </div>

      <div className="span-form-2">
        <Field id="asm-delib" label="Deliberações">
          <textarea
            id="asm-delib"
            onChange={(e) => set("deliberacoes", e.target.value)}
            placeholder="Registre as deliberações tomadas"
            value={form.deliberacoes}
          />
        </Field>
      </div>

      <div className="span-form-2">
        <Field id="asm-obs" label="Observações">
          <textarea id="asm-obs" onChange={(e) => set("observacoes", e.target.value)} value={form.observacoes} />
        </Field>
      </div>
    </div>
  );
}

function CapitalFields({
  form,
  onChange
}: {
  form: CapitalForm;
  onChange: (f: CapitalForm) => void;
}) {
  const set = <K extends keyof CapitalForm>(k: K, v: CapitalForm[K]) =>
    onChange({ ...form, [k]: v });

  return (
    <div className="form-grid form-grid--two">
      <Field id="cap-total" label="Capital total (R$)">
        <input
          id="cap-total"
          inputMode="decimal"
          onChange={(e) => set("valor_total", e.target.value)}
          placeholder="0,00"
          required
          value={form.valor_total}
        />
      </Field>

      <Field id="cap-int" label="Valor integralizado (R$)">
        <input
          id="cap-int"
          inputMode="decimal"
          onChange={(e) => set("valor_integralizado", e.target.value)}
          placeholder="Deixe em branco para 100%"
          value={form.valor_integralizado}
        />
      </Field>

      <div className="span-form-2">
        <Field id="cap-data" label="Data de referência">
          <input
            id="cap-data"
            onChange={(e) => set("data_referencia", e.target.value)}
            required
            type="date"
            value={form.data_referencia}
          />
        </Field>
      </div>

      <div className="span-form-2">
        <Field id="cap-obs" label="Observações">
          <textarea id="cap-obs" onChange={(e) => set("observacoes", e.target.value)} value={form.observacoes} />
        </Field>
      </div>
    </div>
  );
}

// Keeps unused imports satisfied for linting
void Landmark;
void BookOpen;
