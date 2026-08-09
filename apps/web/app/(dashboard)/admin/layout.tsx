"use client";

import type { ReactNode } from "react";
import { useBbaStore } from "@bba/lib";

// Gate global para toda a superfície /admin/*. `session` só deixa de ser
// null depois que BbaDashboardShell resolve hydrateSession() (ou depois de
// um signIn bem-sucedido) -- por isso usamos `session === null` como sinal
// de "ainda carregando", em vez de decidir "Acesso restrito" cedo demais
// para um admin real cuja role ainda não chegou. Um cliente não-admin
// nunca alcança `children`: enquanto a sessão carrega mostramos um estado
// neutro, e assim que ela resolve o teste de role decide corretamente --
// o conteúdo de Admin nunca chega a ser renderizado nesse caminho.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const session = useBbaStore((state) => state.session);
  const profile = useBbaStore((state) => state.profile);

  if (session === null) {
    return (
      <section className="page-header">
        <div>
          <h1>Admin BBA</h1>
          <p>Carregando...</p>
        </div>
      </section>
    );
  }

  if (profile.role !== "bba_admin") {
    return (
      <section className="page-header">
        <div>
          <h1>Admin BBA</h1>
          <p>Acesso restrito ao Admin BBA.</p>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
