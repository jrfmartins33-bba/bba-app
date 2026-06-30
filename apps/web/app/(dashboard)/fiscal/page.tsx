"use client";

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FilePlus2,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCcw,
  Send,
  ShieldAlert
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  clientRegimeFromTaxRegime,
  fetchClientCompanyProfile,
  fetchFiscalModuleData,
  generateFiscalObligationsFromCalendar,
  markFiscalGuiaAsPaid,
  saveFiscalGuia,
  saveFiscalNota,
  saveFiscalObrigacao,
  updateFiscalObrigacaoStatus,
  type CreateFiscalGuiaInput,
  type CreateFiscalNotaInput,
  type CreateFiscalObrigacaoInput,
  type FiscalGuia,
  type FiscalModuleData,
  type FiscalObrigacao,
  type FiscalObrigacaoStatus,
  type FiscalGuiaStatus,
  type FiscalNotaStatus
} from "@bba/lib";
import { useBbaStore as useStore } from "@bba/lib";
import { Button, Card, StatusBadge } from "@bba/ui";

type FiscalFormKind = "obrigacao" | "guia" | "nota";

type ObrigacaoForm = {
  tipo: string;
  nome: string;
  descricao: string;
  competencia: string;
  data_vencimento: string;
  status: FiscalObrigacaoStatus;
  observacoes: string;
};

type GuiaForm = {
  tipo_guia: string;
  tributo: string;
  codigo_receita: string;
  competencia: string;
  data_vencimento: string;
  valor_principal: string;
  valor_multa: string;
  valor_juros: string;
  status: FiscalGuiaStatus;
  linha_digitavel: string;
  obrigacao_id: string;
  observacoes: string;
};

type NotaForm = {
  tipo: string;
  direcao: "Emitida" | "Recebida";
  numero: string;
  serie: string;
  natureza_operacao: string;
  cfop: string;
  data_emissao: string;
  data_competencia: string;
  emitente_cnpj: string;
  emitente_razao_social: string;
  destinatario_cnpj: string;
  destinatario_razao_social: string;
  valor_produtos: string;
  valor_servicos: string;
  valor_total: string;
  valor_icms: string;
  valor_iss: string;
  chave_acesso: string;
  status_sefaz: FiscalNotaStatus;
  observacoes_internas: string;
};

const emptyFiscalData: FiscalModuleData = {
  obrigacoes: [],
  guias: [],
  notas: [],
  parcelamentos: [],
  calendario: [],
  warnings: []
};

const obrigacaoTipos = [
  "DCTF",
  "DCTF-WEB",
  "ECD",
  "ECF",
  "EFD-ICMS-IPI",
  "EFD-Contribuicoes",
  "SPED-Fiscal",
  "SPED-Contabil",
  "PGDAS-D",
  "DASN-SIMEI",
  "DEFIS",
  "DIRF",
  "DIMOB",
  "RAIS",
  "CAGED",
  "eSocial",
  "DCTFWeb-eSocial",
  "GIA",
  "GIA-ST",
  "DIEF",
  "DeSTDA",
  "DES",
  "DAMSP",
  "NFSE-Mensal",
  "Livro-ISS",
  "Declaracao",
  "Relatorio",
  "Outras"
];

const obrigacaoStatuses: FiscalObrigacaoStatus[] = [
  "Pendente",
  "Em andamento",
  "Transmitida",
  "Retificada",
  "Dispensada",
  "Atrasada",
  "Cancelada"
];

const guiaTipos = [
  "DARF",
  "GPS",
  "DAS",
  "DAS-MEI",
  "GNRE",
  "DAE",
  "DARE",
  "DAM",
  "TED",
  "Outros"
];

const guiaStatuses: FiscalGuiaStatus[] = [
  "Pendente",
  "Pago",
  "Atrasado",
  "Cancelado",
  "Parcelado",
  "Compensado"
];

const notaTipos = ["NFE", "NFSE", "NFCE", "CTE", "MDFE", "NFP", "Outros"];

const notaStatuses: FiscalNotaStatus[] = [
  "Emitida",
  "Autorizada",
  "Cancelada",
  "Denegada",
  "Inutilizada",
  "Em processamento",
  "Pendente"
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
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
};

const addDaysIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const parseMoney = (value: string) => {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return shortDate.format(new Date(year, month - 1, day));
};

const badgeClass = (status: string) => {
  if (
    ["Transmitida", "Retificada", "Dispensada", "Pago", "Compensado", "Autorizada"].includes(
      status
    )
  ) {
    return "status-badge status-badge--completed";
  }

  if (
    ["Em andamento", "Parcelado", "Emitida", "Em processamento"].includes(status)
  ) {
    return "status-badge status-badge--in_progress";
  }

  if (
    ["Atrasada", "Atrasado", "Cancelada", "Cancelado", "Denegada", "Inutilizada"].includes(
      status
    )
  ) {
    return "status-badge status-badge--cancelled";
  }

  return "status-badge status-badge--pending";
};

const defaultObrigacaoForm = (): ObrigacaoForm => ({
  tipo: "Declaracao",
  nome: "",
  descricao: "",
  competencia: monthStartIso(),
  data_vencimento: addDaysIso(10),
  status: "Pendente",
  observacoes: ""
});

const defaultGuiaForm = (): GuiaForm => ({
  tipo_guia: "DARF",
  tributo: "",
  codigo_receita: "",
  competencia: monthStartIso(),
  data_vencimento: addDaysIso(10),
  valor_principal: "",
  valor_multa: "",
  valor_juros: "",
  status: "Pendente",
  linha_digitavel: "",
  obrigacao_id: "",
  observacoes: ""
});

const defaultNotaForm = (): NotaForm => ({
  tipo: "NFSE",
  direcao: "Emitida",
  numero: "",
  serie: "",
  natureza_operacao: "",
  cfop: "",
  data_emissao: todayIso(),
  data_competencia: monthStartIso(),
  emitente_cnpj: "",
  emitente_razao_social: "",
  destinatario_cnpj: "",
  destinatario_razao_social: "",
  valor_produtos: "",
  valor_servicos: "",
  valor_total: "",
  valor_icms: "",
  valor_iss: "",
  chave_acesso: "",
  status_sefaz: "Emitida",
  observacoes_internas: ""
});

export default function FiscalPage() {
  const company = useStore((state) => state.company);
  const profile = useStore((state) => state.profile);
  const [data, setData] = useState<FiscalModuleData>(emptyFiscalData);
  const [regimeCode, setRegimeCode] = useState(
    clientRegimeFromTaxRegime(company.tax_regime)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeForm, setActiveForm] = useState<FiscalFormKind | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [obrigacaoForm, setObrigacaoForm] = useState(defaultObrigacaoForm);
  const [guiaForm, setGuiaForm] = useState(defaultGuiaForm);
  const [notaForm, setNotaForm] = useState(defaultNotaForm);

  const isAdminWithoutClient =
    profile.role === "bba_admin" && company.id === profile.id;

  const loadFiscalData = async () => {
    if (!company.id || isAdminWithoutClient) {
      setData(emptyFiscalData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const clientProfile = await fetchClientCompanyProfile(company.id).catch(
        () => null
      );
      const nextRegimeCode =
        clientProfile?.regime_tributario ||
        clientRegimeFromTaxRegime(company.tax_regime);
      setRegimeCode(nextRegimeCode);
      setData(await fetchFiscalModuleData(company.id, nextRegimeCode));
    } catch (caught) {
      setData(emptyFiscalData);
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel carregar o modulo fiscal."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFiscalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, company.tax_regime, isAdminWithoutClient]);

  const metrics = useMemo(() => {
    const currentMonth = monthStartIso().slice(0, 7);
    const today = todayIso();
    const openObrigacoes = data.obrigacoes.filter(
      (row) => !["Transmitida", "Dispensada", "Cancelada"].includes(row.status)
    );
    const overdueObrigacoes = openObrigacoes.filter(
      (row) => row.esta_atrasada || row.data_vencimento < today
    );
    const openGuias = data.guias.filter(
      (row) => !["Pago", "Cancelado", "Compensado"].includes(row.status)
    );
    const overdueGuias = openGuias.filter(
      (row) => row.esta_atrasada || row.data_vencimento < today
    );
    const guiasMes = data.guias.filter((row) =>
      row.competencia?.startsWith(currentMonth)
    );
    const notasMes = data.notas.filter((row) =>
      (row.data_competencia || row.data_emissao)?.startsWith(currentMonth)
    );

    return {
      openObrigacoes: openObrigacoes.length,
      overdueObrigacoes: overdueObrigacoes.length,
      openGuias: openGuias.length,
      overdueGuias: overdueGuias.length,
      totalImpostosMes: guiasMes.reduce(
        (total, row) => total + Number(row.valor_total ?? 0),
        0
      ),
      totalNotasMes: notasMes.reduce(
        (total, row) => total + Number(row.valor_total ?? 0),
        0
      )
    };
  }, [data]);

  const nextDeadlines = useMemo(
    () =>
      [...data.obrigacoes]
        .filter((row) => !["Transmitida", "Dispensada", "Cancelada"].includes(row.status))
        .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
        .slice(0, 5),
    [data.obrigacoes]
  );

  const handleGenerateRoutine = async () => {
    setSaving(true);
    setNotice("");
    setError("");

    try {
      const result = await generateFiscalObligationsFromCalendar(
        company.id,
        regimeCode
      );
      setNotice(
        result.created
          ? `${result.created} obrigacao(oes) gerada(s) para o mes.`
          : "Rotina do mes ja estava em dia."
      );
      await loadFiscalData();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel gerar a rotina fiscal."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeForm) return;

    setSaving(true);
    setNotice("");
    setError("");

    try {
      if (activeForm === "obrigacao") {
        const payload: CreateFiscalObrigacaoInput = {
          company_id: company.id,
          tipo: obrigacaoForm.tipo,
          nome: obrigacaoForm.nome,
          descricao: obrigacaoForm.descricao,
          competencia: obrigacaoForm.competencia,
          data_vencimento: obrigacaoForm.data_vencimento,
          status: obrigacaoForm.status,
          observacoes: obrigacaoForm.observacoes
        };
        await saveFiscalObrigacao(payload);
        setObrigacaoForm(defaultObrigacaoForm());
        setNotice("Obrigacao fiscal registrada.");
      }

      if (activeForm === "guia") {
        const payload: CreateFiscalGuiaInput = {
          company_id: company.id,
          tipo_guia: guiaForm.tipo_guia,
          tributo: guiaForm.tributo,
          codigo_receita: guiaForm.codigo_receita,
          competencia: guiaForm.competencia,
          data_vencimento: guiaForm.data_vencimento,
          valor_principal: parseMoney(guiaForm.valor_principal),
          valor_multa: parseMoney(guiaForm.valor_multa),
          valor_juros: parseMoney(guiaForm.valor_juros),
          status: guiaForm.status,
          linha_digitavel: guiaForm.linha_digitavel,
          obrigacao_id: guiaForm.obrigacao_id || null,
          observacoes: guiaForm.observacoes
        };
        await saveFiscalGuia(payload);
        setGuiaForm(defaultGuiaForm());
        setNotice("Guia fiscal registrada.");
      }

      if (activeForm === "nota") {
        const payload: CreateFiscalNotaInput = {
          company_id: company.id,
          tipo: notaForm.tipo,
          direcao: notaForm.direcao,
          numero: notaForm.numero,
          serie: notaForm.serie,
          natureza_operacao: notaForm.natureza_operacao,
          cfop: notaForm.cfop,
          data_emissao: notaForm.data_emissao,
          data_competencia: notaForm.data_competencia,
          emitente_cnpj: notaForm.emitente_cnpj,
          emitente_razao_social: notaForm.emitente_razao_social,
          destinatario_cnpj: notaForm.destinatario_cnpj,
          destinatario_razao_social: notaForm.destinatario_razao_social,
          valor_produtos: parseMoney(notaForm.valor_produtos),
          valor_servicos: parseMoney(notaForm.valor_servicos),
          valor_total: parseMoney(notaForm.valor_total),
          valor_icms: parseMoney(notaForm.valor_icms),
          valor_iss: parseMoney(notaForm.valor_iss),
          chave_acesso: notaForm.chave_acesso,
          status_sefaz: notaForm.status_sefaz,
          observacoes_internas: notaForm.observacoes_internas
        };
        await saveFiscalNota(payload);
        setNotaForm(defaultNotaForm());
        setNotice("Nota fiscal registrada.");
      }

      setActiveForm(null);
      await loadFiscalData();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel salvar o registro fiscal."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTransmit = async (obrigacao: FiscalObrigacao) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateFiscalObrigacaoStatus(obrigacao.id, "Transmitida");
      setNotice(`${obrigacao.nome} marcada como transmitida.`);
      await loadFiscalData();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Falha ao atualizar obrigacao."
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePayGuide = async (guia: FiscalGuia) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await markFiscalGuiaAsPaid(guia.id);
      setNotice(`${guia.tributo} marcada como paga.`);
      await loadFiscalData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao pagar guia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Modulo Fiscal</h1>
          <p>
            Rotina fiscal de {company.name || "cliente BBA"} por competencia,
            vencimento, transmissao, pagamento e notas fiscais.
          </p>
        </div>
        <div className="module-actions">
          <Button
            disabled={saving || loading || isAdminWithoutClient}
            icon={saving ? <Loader2 size={17} /> : <RefreshCcw size={17} />}
            onClick={handleGenerateRoutine}
            variant="secondary"
          >
            Gerar rotina
          </Button>
          <Button
            disabled={isAdminWithoutClient}
            icon={<FilePlus2 size={17} />}
            onClick={() => setActiveForm("obrigacao")}
            variant="ghost"
          >
            Obrigacao
          </Button>
          <Button
            disabled={isAdminWithoutClient}
            icon={<Plus size={17} />}
            onClick={() => setActiveForm("guia")}
            variant="ghost"
          >
            Guia
          </Button>
          <Button
            disabled={isAdminWithoutClient}
            icon={<ReceiptText size={17} />}
            onClick={() => setActiveForm("nota")}
          >
            Nota fiscal
          </Button>
        </div>
      </section>

      {isAdminWithoutClient ? (
        <Card title="Cliente nao selecionado">
          <div className="empty-state">
            A area admin ainda nao esta vinculada a um cliente especifico nesta
            tela. A operacao fiscal aparece quando entrar como usuario do
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
          Algumas tabelas fiscais ainda nao responderam no Supabase. Rode a
          migration de grants do modulo fiscal e atualize a tela.
        </div>
      ) : null}

      <section className="section-grid">
        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <FileCheck2 size={20} />
            </span>
            <div>
              <strong>{metrics.openObrigacoes}</strong>
              <span>Obrigacoes abertas</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <ShieldAlert size={20} />
            </span>
            <div>
              <strong>{metrics.overdueObrigacoes + metrics.overdueGuias}</strong>
              <span>Itens atrasados</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <Banknote size={20} />
            </span>
            <div>
              <strong>{currency.format(metrics.totalImpostosMes)}</strong>
              <span>Guias do mes</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <ReceiptText size={20} />
            </span>
            <div>
              <strong>{currency.format(metrics.totalNotasMes)}</strong>
              <span>Notas do mes</span>
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
              <StatusBadge status="active">
                {regimeCode || "Regime nao informado"}
              </StatusBadge>
            )
          }
          className="span-8"
          title="Rotina fiscal"
        >
          <div className="fiscal-list">
            {data.obrigacoes.length ? (
              data.obrigacoes.map((obrigacao) => (
                <article className="fiscal-row" key={obrigacao.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={badgeClass(obrigacao.status)}>
                        {obrigacao.status}
                      </span>
                      <time>{formatDate(obrigacao.data_vencimento)}</time>
                    </div>
                    <h3>{obrigacao.nome}</h3>
                    <p>{obrigacao.descricao || obrigacao.tipo}</p>
                    <div className="fiscal-tags">
                      <span>{obrigacao.tipo}</span>
                      <span>Comp. {formatDate(obrigacao.competencia)}</span>
                      {obrigacao.numero_recibo ? (
                        <span>Recibo {obrigacao.numero_recibo}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="fiscal-row__actions">
                    {!["Transmitida", "Dispensada", "Cancelada"].includes(
                      obrigacao.status
                    ) ? (
                      <Button
                        disabled={saving}
                        icon={<Send size={15} />}
                        onClick={() => handleTransmit(obrigacao)}
                        size="sm"
                        variant="secondary"
                      >
                        Transmitida
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                Nenhuma obrigacao fiscal registrada para este cliente.
              </div>
            )}
          </div>
        </Card>

        <Card className="span-4" title="Proximos vencimentos">
          <div className="timeline-list">
            {nextDeadlines.length ? (
              nextDeadlines.map((item) => (
                <article className="timeline-row fiscal-deadline" key={item.id}>
                  <div>
                    <strong>{item.nome}</strong>
                    <span>{formatDate(item.data_vencimento)}</span>
                  </div>
                  <span className={badgeClass(item.status)}>{item.status}</span>
                </article>
              ))
            ) : (
              <div className="empty-state">Sem vencimentos abertos.</div>
            )}
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card
          action={
            <span className="status-badge status-badge--pending">
              {metrics.openGuias} aberta(s)
            </span>
          }
          className="span-6"
          title="Guias de recolhimento"
        >
          <div className="fiscal-list fiscal-list--compact">
            {data.guias.length ? (
              data.guias.map((guia) => (
                <article className="fiscal-row fiscal-row--compact" key={guia.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={badgeClass(guia.status)}>{guia.status}</span>
                      <time>{formatDate(guia.data_vencimento)}</time>
                    </div>
                    <h3>
                      {guia.tipo_guia} - {guia.tributo}
                    </h3>
                    <p>{currency.format(Number(guia.valor_total ?? 0))}</p>
                  </div>
                  {guia.status !== "Pago" ? (
                    <Button
                      disabled={saving}
                      icon={<CheckCircle2 size={15} />}
                      onClick={() => handlePayGuide(guia)}
                      size="sm"
                      variant="secondary"
                    >
                      Paga
                    </Button>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="empty-state">Nenhuma guia cadastrada.</div>
            )}
          </div>
        </Card>

        <Card className="span-6" title="Notas fiscais">
          <div className="fiscal-list fiscal-list--compact">
            {data.notas.length ? (
              data.notas.map((nota) => (
                <article className="fiscal-row fiscal-row--compact" key={nota.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={badgeClass(nota.status_sefaz)}>
                        {nota.status_sefaz}
                      </span>
                      <time>{formatDate(nota.data_emissao)}</time>
                    </div>
                    <h3>
                      {nota.tipo} {nota.numero ? `#${nota.numero}` : ""}
                    </h3>
                    <p>
                      {nota.direcao} -{" "}
                      {nota.direcao === "Emitida"
                        ? nota.destinatario_razao_social || "Destinatario nao informado"
                        : nota.emitente_razao_social || "Emitente nao informado"}
                    </p>
                    <div className="fiscal-tags">
                      <span>{currency.format(Number(nota.valor_total ?? 0))}</span>
                      {nota.cfop ? <span>CFOP {nota.cfop}</span> : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">Nenhuma nota fiscal cadastrada.</div>
            )}
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card className="span-7" title="Calendario fiscal do regime">
          <div className="fiscal-calendar">
            {data.calendario.length ? (
              data.calendario.map((item) => (
                <article className="calendar-row" key={item.id}>
                  <CalendarDays size={17} />
                  <div>
                    <strong>{item.obrigacao}</strong>
                    <span>
                      {item.periodicidade}
                      {item.dia_vencimento
                        ? ` - dia ${item.dia_vencimento}`
                        : ""}
                    </span>
                  </div>
                  <span>{item.orgao_entrega || "Orgao nao informado"}</span>
                </article>
              ))
            ) : (
              <div className="empty-state">
                Calendario fiscal indisponivel para o regime atual.
              </div>
            )}
          </div>
        </Card>

        <Card className="span-5" title="Parcelamentos tributarios">
          <div className="fiscal-list fiscal-list--compact">
            {data.parcelamentos.length ? (
              data.parcelamentos.map((item) => (
                <article className="fiscal-row fiscal-row--compact" key={item.id}>
                  <div className="fiscal-row__main">
                    <div className="task-card__topline">
                      <span className={badgeClass(item.status)}>{item.status}</span>
                      <span>{item.parcelas_restantes} restante(s)</span>
                    </div>
                    <h3>{item.programa}</h3>
                    <p>
                      {item.tributo} - saldo{" "}
                      {currency.format(Number(item.valor_saldo ?? 0))}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">Nenhum parcelamento ativo.</div>
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
            title={modalTitle(activeForm)}
          >
            <form className="fiscal-form" onSubmit={handleSubmit}>
              {activeForm === "obrigacao" ? (
                <ObrigacaoFields
                  form={obrigacaoForm}
                  onChange={setObrigacaoForm}
                />
              ) : null}

              {activeForm === "guia" ? (
                <GuiaFields
                  form={guiaForm}
                  obrigacoes={data.obrigacoes}
                  onChange={setGuiaForm}
                />
              ) : null}

              {activeForm === "nota" ? (
                <NotaFields form={notaForm} onChange={setNotaForm} />
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

function modalTitle(kind: FiscalFormKind) {
  if (kind === "obrigacao") return "Nova obrigacao fiscal";
  if (kind === "guia") return "Nova guia";
  return "Nova nota fiscal";
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

function ObrigacaoFields({
  form,
  onChange
}: {
  form: ObrigacaoForm;
  onChange: (form: ObrigacaoForm) => void;
}) {
  const update = <K extends keyof ObrigacaoForm>(
    key: K,
    value: ObrigacaoForm[K]
  ) => onChange({ ...form, [key]: value });

  return (
    <div className="form-grid form-grid--two">
      <Field id="obrigacao-tipo" label="Tipo">
        <select
          id="obrigacao-tipo"
          onChange={(event) => update("tipo", event.target.value)}
          value={form.tipo}
        >
          {obrigacaoTipos.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </Field>

      <Field id="obrigacao-status" label="Status">
        <select
          id="obrigacao-status"
          onChange={(event) =>
            update("status", event.target.value as FiscalObrigacaoStatus)
          }
          value={form.status}
        >
          {obrigacaoStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </Field>

      <Field id="obrigacao-nome" label="Nome">
        <input
          id="obrigacao-nome"
          onChange={(event) => update("nome", event.target.value)}
          required
          value={form.nome}
        />
      </Field>

      <Field id="obrigacao-competencia" label="Competencia">
        <input
          id="obrigacao-competencia"
          onChange={(event) => update("competencia", event.target.value)}
          required
          type="date"
          value={form.competencia}
        />
      </Field>

      <Field id="obrigacao-vencimento" label="Vencimento">
        <input
          id="obrigacao-vencimento"
          onChange={(event) => update("data_vencimento", event.target.value)}
          required
          type="date"
          value={form.data_vencimento}
        />
      </Field>

      <Field id="obrigacao-descricao" label="Descricao">
        <input
          id="obrigacao-descricao"
          onChange={(event) => update("descricao", event.target.value)}
          value={form.descricao}
        />
      </Field>

      <div className="span-form-2">
        <Field id="obrigacao-observacoes" label="Observacoes">
          <textarea
            id="obrigacao-observacoes"
            onChange={(event) => update("observacoes", event.target.value)}
            value={form.observacoes}
          />
        </Field>
      </div>
    </div>
  );
}

function GuiaFields({
  form,
  obrigacoes,
  onChange
}: {
  form: GuiaForm;
  obrigacoes: FiscalObrigacao[];
  onChange: (form: GuiaForm) => void;
}) {
  const update = <K extends keyof GuiaForm>(key: K, value: GuiaForm[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="form-grid form-grid--two">
      <Field id="guia-tipo" label="Tipo">
        <select
          id="guia-tipo"
          onChange={(event) => update("tipo_guia", event.target.value)}
          value={form.tipo_guia}
        >
          {guiaTipos.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </Field>

      <Field id="guia-status" label="Status">
        <select
          id="guia-status"
          onChange={(event) =>
            update("status", event.target.value as FiscalGuiaStatus)
          }
          value={form.status}
        >
          {guiaStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </Field>

      <Field id="guia-tributo" label="Tributo">
        <input
          id="guia-tributo"
          onChange={(event) => update("tributo", event.target.value)}
          placeholder="IRPJ, CSLL, DAS, ISS"
          required
          value={form.tributo}
        />
      </Field>

      <Field id="guia-codigo" label="Codigo receita">
        <input
          id="guia-codigo"
          onChange={(event) => update("codigo_receita", event.target.value)}
          value={form.codigo_receita}
        />
      </Field>

      <Field id="guia-competencia" label="Competencia">
        <input
          id="guia-competencia"
          onChange={(event) => update("competencia", event.target.value)}
          required
          type="date"
          value={form.competencia}
        />
      </Field>

      <Field id="guia-vencimento" label="Vencimento">
        <input
          id="guia-vencimento"
          onChange={(event) => update("data_vencimento", event.target.value)}
          required
          type="date"
          value={form.data_vencimento}
        />
      </Field>

      <Field id="guia-principal" label="Valor principal">
        <input
          id="guia-principal"
          inputMode="decimal"
          onChange={(event) => update("valor_principal", event.target.value)}
          placeholder="0,00"
          required
          value={form.valor_principal}
        />
      </Field>

      <div className="form-grid form-grid--two">
        <Field id="guia-multa" label="Multa">
          <input
            id="guia-multa"
            inputMode="decimal"
            onChange={(event) => update("valor_multa", event.target.value)}
            placeholder="0,00"
            value={form.valor_multa}
          />
        </Field>

        <Field id="guia-juros" label="Juros">
          <input
            id="guia-juros"
            inputMode="decimal"
            onChange={(event) => update("valor_juros", event.target.value)}
            placeholder="0,00"
            value={form.valor_juros}
          />
        </Field>
      </div>

      <Field id="guia-obrigacao" label="Obrigacao vinculada">
        <select
          id="guia-obrigacao"
          onChange={(event) => update("obrigacao_id", event.target.value)}
          value={form.obrigacao_id}
        >
          <option value="">Sem vinculo</option>
          {obrigacoes.map((obrigacao) => (
            <option key={obrigacao.id} value={obrigacao.id}>
              {obrigacao.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field id="guia-linha" label="Linha digitavel">
        <input
          id="guia-linha"
          onChange={(event) => update("linha_digitavel", event.target.value)}
          value={form.linha_digitavel}
        />
      </Field>

      <div className="span-form-2">
        <Field id="guia-observacoes" label="Observacoes">
          <textarea
            id="guia-observacoes"
            onChange={(event) => update("observacoes", event.target.value)}
            value={form.observacoes}
          />
        </Field>
      </div>
    </div>
  );
}

function NotaFields({
  form,
  onChange
}: {
  form: NotaForm;
  onChange: (form: NotaForm) => void;
}) {
  const update = <K extends keyof NotaForm>(key: K, value: NotaForm[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="form-grid form-grid--two">
      <Field id="nota-tipo" label="Tipo">
        <select
          id="nota-tipo"
          onChange={(event) => update("tipo", event.target.value)}
          value={form.tipo}
        >
          {notaTipos.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </Field>

      <Field id="nota-direcao" label="Direcao">
        <select
          id="nota-direcao"
          onChange={(event) =>
            update("direcao", event.target.value as "Emitida" | "Recebida")
          }
          value={form.direcao}
        >
          <option value="Emitida">Emitida</option>
          <option value="Recebida">Recebida</option>
        </select>
      </Field>

      <Field id="nota-numero" label="Numero">
        <input
          id="nota-numero"
          onChange={(event) => update("numero", event.target.value)}
          value={form.numero}
        />
      </Field>

      <Field id="nota-serie" label="Serie">
        <input
          id="nota-serie"
          onChange={(event) => update("serie", event.target.value)}
          value={form.serie}
        />
      </Field>

      <Field id="nota-emissao" label="Emissao">
        <input
          id="nota-emissao"
          onChange={(event) => update("data_emissao", event.target.value)}
          required
          type="date"
          value={form.data_emissao}
        />
      </Field>

      <Field id="nota-competencia" label="Competencia">
        <input
          id="nota-competencia"
          onChange={(event) => update("data_competencia", event.target.value)}
          type="date"
          value={form.data_competencia}
        />
      </Field>

      <Field id="nota-status" label="Status fiscal">
        <select
          id="nota-status"
          onChange={(event) =>
            update("status_sefaz", event.target.value as FiscalNotaStatus)
          }
          value={form.status_sefaz}
        >
          {notaStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </Field>

      <Field id="nota-cfop" label="CFOP">
        <input
          id="nota-cfop"
          onChange={(event) => update("cfop", event.target.value)}
          value={form.cfop}
        />
      </Field>

      <Field id="nota-natureza" label="Natureza da operacao">
        <input
          id="nota-natureza"
          onChange={(event) => update("natureza_operacao", event.target.value)}
          value={form.natureza_operacao}
        />
      </Field>

      <Field id="nota-total" label="Valor total">
        <input
          id="nota-total"
          inputMode="decimal"
          onChange={(event) => update("valor_total", event.target.value)}
          placeholder="0,00"
          required
          value={form.valor_total}
        />
      </Field>

      <Field id="nota-servicos" label="Servicos">
        <input
          id="nota-servicos"
          inputMode="decimal"
          onChange={(event) => update("valor_servicos", event.target.value)}
          placeholder="0,00"
          value={form.valor_servicos}
        />
      </Field>

      <Field id="nota-produtos" label="Produtos">
        <input
          id="nota-produtos"
          inputMode="decimal"
          onChange={(event) => update("valor_produtos", event.target.value)}
          placeholder="0,00"
          value={form.valor_produtos}
        />
      </Field>

      <Field id="nota-icms" label="ICMS">
        <input
          id="nota-icms"
          inputMode="decimal"
          onChange={(event) => update("valor_icms", event.target.value)}
          placeholder="0,00"
          value={form.valor_icms}
        />
      </Field>

      <Field id="nota-iss" label="ISS">
        <input
          id="nota-iss"
          inputMode="decimal"
          onChange={(event) => update("valor_iss", event.target.value)}
          placeholder="0,00"
          value={form.valor_iss}
        />
      </Field>

      <Field id="nota-emitente" label="Emitente">
        <input
          id="nota-emitente"
          onChange={(event) =>
            update("emitente_razao_social", event.target.value)
          }
          value={form.emitente_razao_social}
        />
      </Field>

      <Field id="nota-destinatario" label="Destinatario">
        <input
          id="nota-destinatario"
          onChange={(event) =>
            update("destinatario_razao_social", event.target.value)
          }
          value={form.destinatario_razao_social}
        />
      </Field>

      <div className="span-form-2">
        <Field id="nota-chave" label="Chave de acesso">
          <input
            id="nota-chave"
            onChange={(event) => update("chave_acesso", event.target.value)}
            value={form.chave_acesso}
          />
        </Field>
      </div>

      <div className="span-form-2">
        <Field id="nota-observacoes" label="Observacoes internas">
          <textarea
            id="nota-observacoes"
            onChange={(event) =>
              update("observacoes_internas", event.target.value)
            }
            value={form.observacoes_internas}
          />
        </Field>
      </div>
    </div>
  );
}
