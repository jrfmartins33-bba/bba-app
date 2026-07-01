"use client";

import {
  Building2,
  ClipboardCheck,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  clientRegimeFromTaxRegime,
  createDefaultClientProfile,
  fetchClientCompanyProfile,
  fetchClientRegistrationReferences,
  saveClientCompanyProfile,
  type ClientCompanyProfile,
  type ClientRegistrationReferences,
  useBbaStore
} from "@bba/lib";
import { Button, Card, StatusBadge } from "@bba/ui";

const statusOptions = ["Ativo", "Prospecto", "Suspenso", "Inativo", "Encerrado"];
const porteOptions = ["MEI", "ME", "EPP", "M\u00e9dio", "Grande"];
const bankAccountOptions = ["Corrente", "Poupan\u00e7a", "Pagamento"];

const localTaxRegimeByClientCode = {
  MEI: "mei",
  SN: "simples_nacional",
  LP: "lucro_presumido",
  LR: "lucro_real"
} as const;

const parseMoney = (value: string) => {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const moneyToInput = (value?: number | null) =>
  value == null ? "" : String(value).replace(".", ",");

const emptyRefs: ClientRegistrationReferences = {
  regimes: [],
  naturezas: [],
  cnaes: [],
  ufs: [],
  municipios: [],
  bancos: []
};

const completionFields: Array<{
  key: keyof ClientCompanyProfile;
  label: string;
  group: "Identidade" | "Fiscal" | "Endereco" | "Contato" | "Operacao";
}> = [
  { key: "razao_social", label: "Razao social", group: "Identidade" },
  { key: "cnpj", label: "CNPJ", group: "Identidade" },
  { key: "regime_tributario", label: "Regime", group: "Fiscal" },
  { key: "natureza_juridica", label: "Natureza juridica", group: "Fiscal" },
  { key: "cnae_principal", label: "CNAE principal", group: "Fiscal" },
  { key: "cep", label: "CEP", group: "Endereco" },
  { key: "logradouro", label: "Logradouro", group: "Endereco" },
  { key: "uf_sigla", label: "UF", group: "Endereco" },
  { key: "municipio_codigo_ibge", label: "Municipio", group: "Endereco" },
  { key: "email_principal", label: "Email principal", group: "Contato" },
  { key: "telefone_principal", label: "Telefone", group: "Contato" },
  { key: "status", label: "Status", group: "Operacao" },
  { key: "data_inicio_relacao", label: "Inicio da relacao", group: "Operacao" }
];

const hasValue = (value: unknown) => {
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
};

const OptionList = ({
  id,
  options
}: {
  id: string;
  options: Array<{ value: string; label: string }>;
}) => (
  <datalist id={id}>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </datalist>
);

export default function CadastroClientePage() {
  const company = useBbaStore((state) => state.company);
  const profile = useBbaStore((state) => state.profile);
  const updateCompany = useBbaStore((state) => state.updateCompany);
  const [form, setForm] = useState<ClientCompanyProfile>(() =>
    createDefaultClientProfile(company)
  );
  const [references, setReferences] =
    useState<ClientRegistrationReferences>(emptyRefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    Promise.all([
      fetchClientRegistrationReferences(),
      fetchClientCompanyProfile(company.id)
    ])
      .then(([refs, clientProfile]) => {
        if (!mounted) return;
        setReferences(refs);
        setForm(clientProfile ?? createDefaultClientProfile(company));
      })
      .catch((caught) => {
        if (!mounted) return;
        setReferences(emptyRefs);
        setForm(createDefaultClientProfile(company));
        setError(
          caught instanceof Error
            ? caught.message
            : "Nao foi possivel carregar o cadastro."
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [company]);

  const completion = useMemo(() => {
    const completed = completionFields.filter((field) =>
      hasValue(form[field.key])
    );
    const byGroup = completionFields.reduce<Record<string, { done: number; total: number }>>(
      (acc, field) => {
        const current = acc[field.group] ?? { done: 0, total: 0 };
        current.total += 1;
        if (hasValue(form[field.key])) current.done += 1;
        acc[field.group] = current;
        return acc;
      },
      {}
    );

    return {
      percent: Math.round((completed.length / completionFields.length) * 100),
      completed: completed.length,
      total: completionFields.length,
      byGroup
    };
  }, [form]);

  const missingFields = completionFields.filter((field) => !hasValue(form[field.key]));

  const update = <K extends keyof ClientCompanyProfile>(
    key: K,
    value: ClientCompanyProfile[K]
  ) => {
    setSavedAt(null);
    setError("");
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleReset = () => {
    setSavedAt(null);
    setError("");
    setForm(createDefaultClientProfile(company));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const saved = await saveClientCompanyProfile(form);
      setForm(saved);
      updateCompany({
        name: saved.nome_fantasia || saved.razao_social,
        cnpj: saved.cnpj?.replace(/\D/g, "") || company.cnpj,
        tax_regime:
          saved.regime_tributario &&
          saved.regime_tributario in localTaxRegimeByClientCode
            ? localTaxRegimeByClientCode[
                saved.regime_tributario as keyof typeof localTaxRegimeByClientCode
              ]
            : company.tax_regime,
        segment: saved.cnae_principal ?? company.segment,
        main_phone:
          saved.telefone_principal ?? saved.whatsapp ?? company.main_phone
      });
      setSavedAt(new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nao foi possivel salvar o cadastro."
      );
    } finally {
      setSaving(false);
    }
  };

  const isAdminWithoutClient =
    profile.role === "bba_admin" && company.id === profile.id;

  return (
    <div className="client-registration-page">
      <section className="page-header">
        <div>
          <h1>Cadastro do cliente</h1>
          <p>
            Ficha operacional completa de {company.name || "cliente BBA"}.
          </p>
        </div>
        <StatusBadge status={completion.percent >= 80 ? "completed" : "in_progress"}>
          {`${completion.percent}% completo`}
        </StatusBadge>
      </section>

      {isAdminWithoutClient ? (
        <Card title="Selecao de cliente">
          <div className="empty-state">
            A conta admin esta em uma area interna. A edicao direta por cliente
            entra na proxima etapa do Admin BBA.
          </div>
        </Card>
      ) : null}

      <section className="registration-metrics">
        <Card>
          <div className="metric">
            <span className="metric__icon">
              <ClipboardCheck size={20} />
            </span>
            <div>
              <strong>{completion.percent}%</strong>
              <span>Completude cadastral</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="metric">
            <span className="metric__icon">
              <Building2 size={20} />
            </span>
            <div>
              <strong>{form.status}</strong>
              <span>Status do cliente</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="metric">
            <span className="metric__icon">
              <ShieldCheck size={20} />
            </span>
            <div>
              <strong>{form.regime_tributario || "-"}</strong>
              <span>Regime tributario</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="metric">
            <span className="metric__icon">
              <Sparkles size={20} />
            </span>
            <div>
              <strong>{completion.completed}/{completion.total}</strong>
              <span>Campos-chave</span>
            </div>
          </div>
        </Card>
      </section>

      <form className="client-registration" onSubmit={handleSubmit}>
        <section className="registration-section registration-section--identity">
          <Card title="Identidade empresarial">
            <div className="form-grid form-grid--two">
              <Field label="Razao social" id="razao_social">
                <input
                  id="razao_social"
                  onChange={(event) => update("razao_social", event.target.value)}
                  required
                  value={form.razao_social}
                />
              </Field>

              <Field label="Nome fantasia" id="nome_fantasia">
                <input
                  id="nome_fantasia"
                  onChange={(event) => update("nome_fantasia", event.target.value)}
                  value={form.nome_fantasia ?? ""}
                />
              </Field>

              <Field label="CNPJ" id="cnpj">
                <input
                  id="cnpj"
                  inputMode="numeric"
                  onChange={(event) => update("cnpj", event.target.value)}
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj ?? ""}
                />
              </Field>

              <Field label="CPF do titular" id="cpf">
                <input
                  id="cpf"
                  inputMode="numeric"
                  onChange={(event) => update("cpf", event.target.value)}
                  placeholder="000.000.000-00"
                  value={form.cpf ?? ""}
                />
              </Field>

              <Field label="Inscricao estadual" id="inscricao_estadual">
                <input
                  id="inscricao_estadual"
                  onChange={(event) =>
                    update("inscricao_estadual", event.target.value)
                  }
                  value={form.inscricao_estadual ?? ""}
                />
              </Field>

              <Field label="Inscricao municipal" id="inscricao_municipal">
                <input
                  id="inscricao_municipal"
                  onChange={(event) =>
                    update("inscricao_municipal", event.target.value)
                  }
                  value={form.inscricao_municipal ?? ""}
                />
              </Field>

              <Field label="NIRE" id="nire">
                <input
                  id="nire"
                  onChange={(event) => update("nire", event.target.value)}
                  value={form.nire ?? ""}
                />
              </Field>

              <Field label="Status" id="status">
                <select
                  id="status"
                  onChange={(event) => update("status", event.target.value)}
                  value={form.status}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card title="Pendencias">
            <div className="completion-panel">
              <div
                className="completion-ring"
                style={{ "--value": completion.percent } as CSSProperties}
              >
                <span>{completion.percent}%</span>
              </div>
              <div className="completion-groups">
                {Object.entries(completion.byGroup).map(([group, value]) => (
                  <div key={group}>
                    <span>{group}</span>
                    <strong>
                      {value.done}/{value.total}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="missing-list">
                {missingFields.slice(0, 5).map((field) => (
                  <span key={field.key}>{field.label}</span>
                ))}
                {!missingFields.length ? (
                  <span className="missing-list__done">
                    Campos-chave completos
                  </span>
                ) : null}
              </div>
            </div>
          </Card>
        </section>

        <section className="registration-section registration-section--two">
          <Card title="Fiscal e tributario">
            <div className="form-grid form-grid--two">
              <Field label="Regime tributario" id="regime_tributario">
                <select
                  id="regime_tributario"
                  onChange={(event) =>
                    update("regime_tributario", event.target.value)
                  }
                  value={
                    form.regime_tributario ||
                    clientRegimeFromTaxRegime(company.tax_regime)
                  }
                >
                  <option value="">Selecione</option>
                  {references.regimes.map((regime) => (
                    <option key={regime.value} value={regime.value}>
                      {regime.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Porte" id="porte">
                <select
                  id="porte"
                  onChange={(event) => update("porte", event.target.value)}
                  value={form.porte ?? ""}
                >
                  <option value="">Selecione</option>
                  {porteOptions.map((porte) => (
                    <option key={porte} value={porte}>
                      {porte}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Natureza juridica" id="natureza_juridica">
                <input
                  id="natureza_juridica"
                  list="natureza-options"
                  onChange={(event) =>
                    update("natureza_juridica", event.target.value)
                  }
                  placeholder="2062"
                  value={form.natureza_juridica ?? ""}
                />
              </Field>

              <Field label="CNAE principal" id="cnae_principal">
                <input
                  id="cnae_principal"
                  list="cnae-options"
                  onChange={(event) => update("cnae_principal", event.target.value)}
                  placeholder="6204-0/00"
                  value={form.cnae_principal ?? ""}
                />
              </Field>

              <Field label="Data de abertura" id="data_abertura">
                <input
                  id="data_abertura"
                  onChange={(event) => update("data_abertura", event.target.value)}
                  type="date"
                  value={form.data_abertura ?? ""}
                />
              </Field>

              <Field label="Opcao pelo Simples" id="data_opcao_simples">
                <input
                  id="data_opcao_simples"
                  onChange={(event) =>
                    update("data_opcao_simples", event.target.value)
                  }
                  type="date"
                  value={form.data_opcao_simples ?? ""}
                />
              </Field>

              <Field label="Receita bruta anual" id="receita_bruta_anual">
                <input
                  id="receita_bruta_anual"
                  inputMode="decimal"
                  onChange={(event) =>
                    update("receita_bruta_anual", parseMoney(event.target.value))
                  }
                  placeholder="0,00"
                  value={moneyToInput(form.receita_bruta_anual)}
                />
              </Field>

              <Field label="Inscricao SUFRAMA" id="inscricao_suframa">
                <input
                  id="inscricao_suframa"
                  onChange={(event) =>
                    update("inscricao_suframa", event.target.value)
                  }
                  value={form.inscricao_suframa ?? ""}
                />
              </Field>
            </div>

            <div className="toggle-grid">
              <CheckField
                checked={form.optante_simples}
                label="Optante Simples"
                onChange={(checked) => update("optante_simples", checked)}
              />
              <CheckField
                checked={form.optante_mei}
                label="Optante MEI"
                onChange={(checked) => update("optante_mei", checked)}
              />
            </div>
          </Card>

          <Card title="Endereco">
            <div className="form-grid form-grid--two">
              <Field label="CEP" id="cep">
                <input
                  id="cep"
                  inputMode="numeric"
                  onChange={(event) => update("cep", event.target.value)}
                  placeholder="00000-000"
                  value={form.cep ?? ""}
                />
              </Field>

              <Field label="UF" id="uf_sigla">
                <select
                  id="uf_sigla"
                  onChange={(event) => update("uf_sigla", event.target.value)}
                  value={form.uf_sigla ?? ""}
                >
                  <option value="">Selecione</option>
                  {references.ufs.map((uf) => (
                    <option key={uf.value} value={uf.value}>
                      {uf.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Municipio" id="municipio_codigo_ibge">
                <input
                  id="municipio_codigo_ibge"
                  list="municipio-options"
                  onChange={(event) =>
                    update("municipio_codigo_ibge", event.target.value)
                  }
                  placeholder="5208707"
                  value={form.municipio_codigo_ibge ?? ""}
                />
              </Field>

              <Field label="Bairro" id="bairro">
                <input
                  id="bairro"
                  onChange={(event) => update("bairro", event.target.value)}
                  value={form.bairro ?? ""}
                />
              </Field>

              <Field label="Logradouro" id="logradouro">
                <input
                  id="logradouro"
                  onChange={(event) => update("logradouro", event.target.value)}
                  value={form.logradouro ?? ""}
                />
              </Field>

              <Field label="Numero" id="numero">
                <input
                  id="numero"
                  onChange={(event) => update("numero", event.target.value)}
                  value={form.numero ?? ""}
                />
              </Field>
            </div>

            <Field label="Complemento" id="complemento">
              <input
                id="complemento"
                onChange={(event) => update("complemento", event.target.value)}
                value={form.complemento ?? ""}
              />
            </Field>
          </Card>
        </section>

        <section className="registration-section registration-section--cards">
          <Card title="Contatos">
            <div className="form-grid">
              <Field label="Email principal" id="email_principal">
                <input
                  id="email_principal"
                  onChange={(event) =>
                    update("email_principal", event.target.value)
                  }
                  type="email"
                  value={form.email_principal ?? ""}
                />
              </Field>

              <Field label="Email contador" id="email_contador">
                <input
                  id="email_contador"
                  onChange={(event) =>
                    update("email_contador", event.target.value)
                  }
                  type="email"
                  value={form.email_contador ?? ""}
                />
              </Field>

              <Field label="Telefone principal" id="telefone_principal">
                <input
                  id="telefone_principal"
                  onChange={(event) =>
                    update("telefone_principal", event.target.value)
                  }
                  value={form.telefone_principal ?? ""}
                />
              </Field>

              <Field label="WhatsApp" id="whatsapp">
                <input
                  id="whatsapp"
                  onChange={(event) => update("whatsapp", event.target.value)}
                  value={form.whatsapp ?? ""}
                />
              </Field>

              <Field label="Site" id="site">
                <input
                  id="site"
                  onChange={(event) => update("site", event.target.value)}
                  placeholder="https://"
                  value={form.site ?? ""}
                />
              </Field>
            </div>
          </Card>

          <Card title="Dados bancarios">
            <div className="form-grid">
              <Field label="Banco" id="banco_codigo">
                <input
                  id="banco_codigo"
                  list="banco-options"
                  onChange={(event) => update("banco_codigo", event.target.value)}
                  placeholder="001"
                  value={form.banco_codigo ?? ""}
                />
              </Field>

              <div className="form-grid form-grid--two">
                <Field label="Agencia" id="banco_agencia">
                  <input
                    id="banco_agencia"
                    onChange={(event) =>
                      update("banco_agencia", event.target.value)
                    }
                    value={form.banco_agencia ?? ""}
                  />
                </Field>

                <Field label="Conta" id="banco_conta">
                  <input
                    id="banco_conta"
                    onChange={(event) => update("banco_conta", event.target.value)}
                    value={form.banco_conta ?? ""}
                  />
                </Field>
              </div>

              <Field label="Tipo de conta" id="banco_tipo_conta">
                <select
                  id="banco_tipo_conta"
                  onChange={(event) =>
                    update("banco_tipo_conta", event.target.value)
                  }
                  value={form.banco_tipo_conta ?? ""}
                >
                  <option value="">Selecione</option>
                  {bankAccountOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Chave PIX" id="banco_pix">
                <input
                  id="banco_pix"
                  onChange={(event) => update("banco_pix", event.target.value)}
                  value={form.banco_pix ?? ""}
                />
              </Field>
            </div>
          </Card>

          <Card title="Operacao BBA">
            <div className="form-grid">
              <div className="form-grid form-grid--two">
                <Field label="Inicio da relacao" id="data_inicio_relacao">
                  <input
                    id="data_inicio_relacao"
                    onChange={(event) =>
                      update("data_inicio_relacao", event.target.value)
                    }
                    type="date"
                    value={form.data_inicio_relacao ?? ""}
                  />
                </Field>

                <Field label="Fim da relacao" id="data_fim_relacao">
                  <input
                    id="data_fim_relacao"
                    onChange={(event) =>
                      update("data_fim_relacao", event.target.value)
                    }
                    type="date"
                    value={form.data_fim_relacao ?? ""}
                  />
                </Field>
              </div>

              <div className="form-grid form-grid--two">
                <Field label="Funcionarios" id="quantidade_funcionarios">
                  <input
                    id="quantidade_funcionarios"
                    min={0}
                    onChange={(event) =>
                      update(
                        "quantidade_funcionarios",
                        Number(event.target.value || 0)
                      )
                    }
                    type="number"
                    value={form.quantidade_funcionarios}
                  />
                </Field>

                <Field label="Pais BACEN" id="pais_codigo_bacen">
                  <input
                    id="pais_codigo_bacen"
                    onChange={(event) =>
                      update("pais_codigo_bacen", event.target.value)
                    }
                    value={form.pais_codigo_bacen ?? "1058"}
                  />
                </Field>
              </div>

              <div className="toggle-grid">
                <CheckField
                  checked={form.tem_funcionarios}
                  label="Tem funcionarios"
                  onChange={(checked) => update("tem_funcionarios", checked)}
                />
                <CheckField
                  checked={form.tem_estoque}
                  label="Tem estoque"
                  onChange={(checked) => update("tem_estoque", checked)}
                />
                <CheckField
                  checked={form.tem_filiais}
                  label="Tem filiais"
                  onChange={(checked) => update("tem_filiais", checked)}
                />
                <CheckField
                  checked={form.emite_nfe}
                  label="Emite NF-e"
                  onChange={(checked) => update("emite_nfe", checked)}
                />
                <CheckField
                  checked={form.emite_nfse}
                  label="Emite NFS-e"
                  onChange={(checked) => update("emite_nfse", checked)}
                />
                <CheckField
                  checked={form.emite_nfce}
                  label="Emite NFC-e"
                  onChange={(checked) => update("emite_nfce", checked)}
                />
              </div>
            </div>
          </Card>
        </section>

        <section className="registration-section registration-section--actions">
          <Card title="Observacoes">
            <Field label="Notas internas e contexto operacional" id="observacoes">
              <textarea
                id="observacoes"
                onChange={(event) => update("observacoes", event.target.value)}
                value={form.observacoes ?? ""}
              />
            </Field>
          </Card>

          <Card title="Acoes">
            <div className="save-panel">
              {loading ? (
                <span className="status-badge status-badge--pending">
                  Carregando cadastro
                </span>
              ) : null}
              {savedAt ? (
                <span className="status-badge status-badge--completed">
                  Salvo as {savedAt}
                </span>
              ) : null}
              {error ? <p className="form-error">{error}</p> : null}
              <div className="save-panel__buttons">
                <Button
                  disabled={saving}
                  icon={<RotateCcw size={17} />}
                  onClick={handleReset}
                  type="button"
                  variant="ghost"
                >
                  Restaurar
                </Button>
                <Button disabled={saving} icon={<Save size={17} />} type="submit">
                  {saving ? "Salvando" : "Salvar cadastro"}
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <OptionList id="natureza-options" options={references.naturezas} />
        <OptionList id="cnae-options" options={references.cnaes} />
        <OptionList id="municipio-options" options={references.municipios} />
        <OptionList id="banco-options" options={references.bancos} />
      </form>
    </div>
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
