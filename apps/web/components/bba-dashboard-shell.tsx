"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { isSupabaseConfigured, useBbaStore } from "@bba/lib";
import { Sidebar } from "@/components/sidebar";

export function BbaDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useBbaStore((state) => state.profile);
  const hydrateSession = useBbaStore((state) => state.hydrateSession);
  const signOut = useBbaStore((state) => state.signOut);
  const tasks = useBbaStore((state) => state.tasks);
  const onboardingSteps = useBbaStore((state) => state.onboardingSteps);

  const alertCount = Math.min(
    tasks.filter((task) => task.status !== "done").length +
      onboardingSteps.filter((step) => step.status !== "completed").length,
    99
  );
  const isCockpit = pathname === "/hoje" || pathname.startsWith("/hoje/");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let mounted = true;

    void hydrateSession()
      .then((authenticated) => {
        if (mounted && !authenticated) {
          router.replace("/login");
        }
      })
      .catch(() => {
        if (mounted) {
          signOut();
          router.replace("/login");
        }
      });

    return () => {
      mounted = false;
    };
  }, [hydrateSession, router, signOut]);

  // Without Supabase configured, the store falls back to its local
  // demoState (Maria Oliveira, role "client", no real session) so the
  // hydrateSession effect above never even runs. That fallback exists for
  // isolated package/unit work, not for a deployed environment: a
  // misconfigured deployment must show a clear configuration error, never
  // let a visitor land on a "logged in" dashboard with no real login.
  if (!isSupabaseConfigured) {
    return (
      <div className="bba-layout">
        <main className="bba-main">
          <div className="bba-main__content bba-main__content--standard">
            <section className="page-header">
              <div>
                <h1>BBA Platform</h1>
                <p>Ambiente do BBA App nao configurado para autenticacao.</p>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bba-layout">
      <Sidebar
        alertCount={alertCount > 0 ? alertCount : undefined}
        isAdmin={profile.role === "bba_admin"}
        userEmail={profile.email ?? undefined}
        userName={profile.full_name || profile.email || undefined}
      />

      <main className="bba-main">
        <div
          className={
            isCockpit
              ? "bba-main__content bba-main__content--cockpit"
              : "bba-main__content bba-main__content--standard"
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}
