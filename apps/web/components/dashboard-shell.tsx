"use client";

import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  UserRoundCheck
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@bba/ui";
import { isSupabaseConfigured, useBbaStore } from "@bba/lib";

const navItems = [
  { href: "/dashboard", label: "Painel Executivo", icon: LayoutDashboard },
  { href: "/cadastro-cliente", label: "Cadastro", icon: Building2 },
  { href: "/fiscal", label: "Fiscal", icon: ReceiptText },
  { href: "/onboarding", label: "Onboarding", icon: UserRoundCheck },
  { href: "/tarefas", label: "Tarefas", icon: ClipboardList },
  { href: "/chat", label: "Chat", icon: MessageSquareText },
  { href: "/admin", label: "Admin BBA", icon: ShieldCheck }
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useBbaStore((state) => state.profile);
  const company = useBbaStore((state) => state.company);
  const tasks = useBbaStore((state) => state.tasks);
  const messages = useBbaStore((state) => state.messages);
  const hydrateSession = useBbaStore((state) => state.hydrateSession);
  const signOut = useBbaStore((state) => state.signOut);

  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const unread = messages.filter(
    (message) => message.sender_id !== profile.id
  ).length;

  const handleSignOut = () => {
    signOut();
    router.push("/login");
  };

  const isAdminArea = pathname.startsWith("/admin");

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
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <Image
            alt="BBA Brazil Business Advisory"
            className="brand-logo brand-logo--sidebar"
            height={56}
            priority
            src="/bba-logo.png"
            width={56}
          />
          <div>
            <strong>BBA App</strong>
            <span>Portal do cliente</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegacao principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link key={item.href} href={item.href} data-active={active}>
                <Icon size={18} strokeWidth={2.1} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-summary" aria-label="Resumo operacional">
          <div>
            <span>Tarefas abertas</span>
            <strong>{openTasks}</strong>
          </div>
          <div>
            <span>Mensagens novas</span>
            <strong>{unread}</strong>
          </div>
          <div>
            <span>Perfil</span>
            <strong>{profile.role === "bba_admin" ? "Admin" : "Cliente"}</strong>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div>
            <small>{isAdminArea ? "Equipe BBA" : "Cliente conectado"}</small>
            <strong>{isAdminArea ? "Painel interno" : company.name}</strong>
          </div>
          <Button
            aria-label="Sair"
            icon={<LogOut size={18} />}
            iconOnly
            onClick={handleSignOut}
            title="Sair"
            variant="ghost"
          />
        </header>

        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}
