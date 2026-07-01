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
