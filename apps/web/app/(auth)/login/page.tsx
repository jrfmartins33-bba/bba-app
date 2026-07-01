"use client";

import { LockKeyhole, LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useBbaStore } from "@bba/lib";
import { Button } from "@bba/ui";

const readErrorMessage = (caught: unknown) => {
  if (caught instanceof Error) {
    return caught.message;
  }

  if (caught && typeof caught === "object" && "message" in caught) {
    const message = (caught as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }

  return "";
};

const getLoginErrorMessage = (caught: unknown) => {
  const message = readErrorMessage(caught);

  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Email ou senha invalidos. Contas demo usam a senha Teste123!.";
  }

  return message || "Nao foi possivel entrar.";
};

export default function LoginPage() {
  const router = useRouter();
  const signIn = useBbaStore((state) => state.signIn);
  const [email, setEmail] = useState("carlos@carlosmendes.com.br");
  const [password, setPassword] = useState("Teste123!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await signIn(email, password);
      router.push("/cadastro-cliente");
    } catch (caught) {
      setBusy(false);
      setError(getLoginErrorMessage(caught));
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Entrar</h2>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          autoComplete="email"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          autoComplete="current-password"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      <Button
        disabled={busy}
        icon={busy ? <LockKeyhole size={18} /> : <LogIn size={18} />}
        type="submit"
      >
        {busy ? "Entrando" : "Entrar no portal"}
      </Button>

      <p className="auth-form__footer">
        Ainda nao tem cadastro? <Link href="/cadastro">Criar acesso</Link>
      </p>

      <p className="auth-form__footer">
        <Mail size={14} /> O MVP abre com dados de demonstracao ate o Supabase
        ser configurado.
      </p>
    </form>
  );
}
