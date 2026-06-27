import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-intro">
          <div className="brand-lockup">
            <Image
              alt="BBA Brazil Business Advisory"
              className="brand-logo"
              height={56}
              priority
              src="/bba-logo.png"
              width={56}
            />
            <div>
              <strong>BBA App</strong>
              <span>Gestao operacional do cliente</span>
            </div>
          </div>
          <h1>Rotinas, tarefas e conversas em um unico ambiente.</h1>
          <p>
            Acompanhe o onboarding, valide pendencias e converse com as areas da
            BBA sem perder historico operacional.
          </p>
        </div>
        {children}
      </section>
    </main>
  );
}
