"use client";

import { Check, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { taxRegimeLabels, type TaxRegime, useBbaStore } from "@bba/lib";
import { Button, Card, OnboardingProgress } from "@bba/ui";

const regimes: TaxRegime[] = [
  "mei",
  "simples_nacional",
  "lucro_presumido",
  "lucro_real"
];

export default function OnboardingPage() {
  const company = useBbaStore((state) => state.company);
  const onboardingSteps = useBbaStore((state) => state.onboardingSteps);
  const updateCompany = useBbaStore((state) => state.updateCompany);
  const completeStep = useBbaStore((state) => state.completeOnboardingStep);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: company.name,
    cnpj: company.cnpj ?? "",
    tax_regime: (company.tax_regime ?? "simples_nacional") as TaxRegime,
    segment: company.segment ?? "",
    main_phone: company.main_phone ?? ""
  });

  useEffect(() => {
    setForm({
      name: company.name,
      cnpj: company.cnpj ?? "",
      tax_regime: (company.tax_regime ?? "simples_nacional") as TaxRegime,
      segment: company.segment ?? "",
      main_phone: company.main_phone ?? ""
    });
  }, [company]);

  const currentStep = useMemo(
    () => onboardingSteps.find((step) => step.status === "in_progress"),
    [onboardingSteps]
  );

  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateCompany(form);
    setSaved(true);
  };

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Onboarding</h1>
          <p>Complete os dados cadastrais e acompanhe o avanco da implantacao.</p>
        </div>
      </section>

      <section className="section-grid">
        <Card className="span-5" title="Progresso">
          <OnboardingProgress steps={onboardingSteps} />
          <div className="step-actions">
            <Button
              disabled={!currentStep}
              icon={<Check size={17} />}
              onClick={() => currentStep && completeStep(currentStep.step_number)}
              variant="secondary"
            >
              Concluir etapa atual
            </Button>
          </div>
        </Card>

        <Card className="span-7" title="Dados da empresa">
          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="form-grid form-grid--two">
              <div className="field">
                <label htmlFor="name">Empresa</label>
                <input
                  id="name"
                  onChange={(event) => update("name", event.target.value)}
                  required
                  value={form.name}
                />
              </div>

              <div className="field">
                <label htmlFor="cnpj">CNPJ</label>
                <input
                  id="cnpj"
                  onChange={(event) => update("cnpj", event.target.value)}
                  value={form.cnpj}
                />
              </div>
            </div>

            <div className="form-grid form-grid--two">
              <div className="field">
                <label htmlFor="regime">Regime tributario</label>
                <select
                  id="regime"
                  onChange={(event) =>
                    update("tax_regime", event.target.value as TaxRegime)
                  }
                  value={form.tax_regime}
                >
                  {regimes.map((regime) => (
                    <option key={regime} value={regime}>
                      {taxRegimeLabels[regime]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="segmento">Segmento</label>
                <input
                  id="segmento"
                  onChange={(event) => update("segment", event.target.value)}
                  value={form.segment}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="phone">Telefone principal</label>
              <input
                id="phone"
                onChange={(event) => update("main_phone", event.target.value)}
                value={form.main_phone}
              />
            </div>

            <div className="step-actions">
              {saved ? <StatusText /> : null}
              <Button icon={<Save size={17} />} type="submit">
                Salvar dados
              </Button>
            </div>
          </form>
        </Card>
      </section>
    </>
  );
}

function StatusText() {
  return <span className="status-badge status-badge--completed">Salvo</span>;
}
