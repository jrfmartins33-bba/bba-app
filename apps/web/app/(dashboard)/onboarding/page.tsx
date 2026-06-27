"use client";

import { Check, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { type Regime, useBbaStore } from "@bba/lib";
import { Button, Card, OnboardingProgress } from "@bba/ui";

const regimes: Regime[] = ["MEI", "Simples", "LucroPresumido", "LucroReal"];

export default function OnboardingPage() {
  const profile = useBbaStore((state) => state.profile);
  const onboardingSteps = useBbaStore((state) => state.onboardingSteps);
  const updateProfile = useBbaStore((state) => state.updateProfile);
  const completeStep = useBbaStore((state) => state.completeOnboardingStep);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: profile.name,
    cnpj: profile.cnpj ?? "",
    regime: (profile.regime ?? "Simples") as Regime,
    segmento: profile.segmento ?? "",
    phone: profile.phone ?? ""
  });

  useEffect(() => {
    setForm({
      name: profile.name,
      cnpj: profile.cnpj ?? "",
      regime: (profile.regime ?? "Simples") as Regime,
      segmento: profile.segmento ?? "",
      phone: profile.phone ?? ""
    });
  }, [profile]);

  const currentStep = useMemo(
    () => onboardingSteps.find((step) => step.status === "current"),
    [onboardingSteps]
  );

  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateProfile(form);
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
                  onChange={(event) => update("regime", event.target.value as Regime)}
                  value={form.regime}
                >
                  {regimes.map((regime) => (
                    <option key={regime} value={regime}>
                      {regime}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="segmento">Segmento</label>
                <input
                  id="segmento"
                  onChange={(event) => update("segmento", event.target.value)}
                  value={form.segmento}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="phone">Telefone principal</label>
              <input
                id="phone"
                onChange={(event) => update("phone", event.target.value)}
                value={form.phone}
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
  return <span className="status-badge status-badge--done">Salvo</span>;
}
