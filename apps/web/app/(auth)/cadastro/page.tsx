"use client";

import { Building2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signUp as createSupabaseAccount, useBbaStore, type Regime } from "@bba/lib";
import { Button } from "@bba/ui";

const regimes: Regime[] = ["MEI", "Simples", "LucroPresumido", "LucroReal"];

export default function CadastroPage() {
  const router = useRouter();
  const createLocalAccount = useBbaStore((state) => state.signUp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    cnpj: "",
    regime: "Simples" as Regime,
    segmento: "",
    phone: ""
  });

  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    const profile = {
      name: form.name,
      cnpj: form.cnpj,
      regime: form.regime,
      segmento: form.segmento,
      phone: form.phone,
      plan: "essencial" as const
    };

    try {
      const { error: authError } = await createSupabaseAccount(
        form.email,
        form.password,
        profile
      );

      if (authError) {
        setBusy(false);
        setError(authError.message);
        return;
      }

      await createLocalAccount(form.email, form.password, profile);
      router.push("/onboarding");
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : "Nao foi possivel criar o acesso.");
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Criar cadastro</h2>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="form-grid form-grid--two">
        <div className="field">
          <label htmlFor="name">Empresa</label>
          <input
            autoComplete="organization"
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
            required
            value={form.cnpj}
          />
        </div>
      </div>

      <div className="form-grid form-grid--two">
        <div className="field">
          <label htmlFor="regime">Regime</label>
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
        <label htmlFor="phone">Telefone</label>
        <input
          autoComplete="tel"
          id="phone"
          onChange={(event) => update("phone", event.target.value)}
          value={form.phone}
        />
      </div>

      <div className="form-grid form-grid--two">
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            autoComplete="email"
            id="email"
            onChange={(event) => update("email", event.target.value)}
            required
            type="email"
            value={form.email}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            autoComplete="new-password"
            id="password"
            minLength={6}
            onChange={(event) => update("password", event.target.value)}
            required
            type="password"
            value={form.password}
          />
        </div>
      </div>

      <Button disabled={busy} icon={busy ? <Building2 size={18} /> : <UserPlus size={18} />} type="submit">
        {busy ? "Criando" : "Criar acesso"}
      </Button>

      <p className="auth-form__footer">
        Ja tem acesso? <Link href="/login">Entrar no portal</Link>
      </p>
    </form>
  );
}
