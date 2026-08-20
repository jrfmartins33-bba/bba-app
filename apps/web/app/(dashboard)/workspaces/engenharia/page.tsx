import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Banknote,
  Calculator,
  ClipboardCheck,
  FileDown,
  FileStack,
  FolderSearch,
  GanttChart,
  GanttChartSquare,
  HardHat,
  Map,
  Ruler,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@bba/ui";
import { EngineeringWorkspaceObras } from "@/components/engenharia/engineering-workspace-obras";

type CapabilityStatus = "Pronto" | "Em desenvolvimento" | "Em breve" | "Demonstração disponível";

interface CapabilityCard {
  id: string;
  title: string;
  description: string;
  status: CapabilityStatus;
  icon: LucideIcon;
  href?: string;
  actionLabel?: string;
}

const CAPABILITIES: CapabilityCard[] = [
  {
    id: "planejamento",
    title: "Planejamento",
    description: "Cronograma, Curva S, Baseline, Recursos, Custos, Forecast e planejamento integrado da obra.",
    status: "Pronto",
    icon: GanttChart,
    href: "/workspaces/engenharia/planejamento",
  },
  {
    id: "project-studio",
    title: "Project Studio",
    description: "O primeiro planejador de projetos orientado por decisões — importação, Curva S e caminho crítico.",
    status: "Pronto",
    icon: GanttChartSquare,
    href: "/bba-project",
  },
  {
    id: "execucao",
    title: "Execução",
    description: "Diário de Obras, equipes, equipamentos, clima, ocorrências e acompanhamento operacional.",
    status: "Em breve",
    icon: Wrench,
  },
  {
    id: "geo-studio",
    title: "Geo Studio",
    description: "Mapa da obra, georreferenciamento, drone, topografia e evolução espacial da execução.",
    status: "Pronto",
    icon: Map,
    href: "/geoespacial",
  },
  {
    id: "evidence-studio",
    title: "Studio de Evidências",
    description: "Organização de fotos, registros de campo, documentos e observações técnicas.",
    status: "Pronto",
    icon: FolderSearch,
    href: "/evidencias",
  },
  {
    id: "medicoes",
    title: "Medições",
    description: "Organização de boletins, quantitativos executados e acompanhamento da evolução da obra.",
    status: "Pronto",
    icon: Ruler,
    href: "/medicoes",
  },
  {
    id: "orcamento",
    title: "Orçamento",
    description: "Veja o orçamento oficial, a proposta e como os itens são organizados para análise.",
    status: "Pronto",
    icon: Wallet,
    href: "/orcamentos",
    actionLabel: "Ver orçamento",
  },
  {
    id: "documentos",
    title: "Documentos",
    description: "Reconstrução de boletins, relatórios e documentos técnicos para revisão.",
    status: "Pronto",
    icon: FileStack,
  },
  {
    id: "aprovacoes",
    title: "Aprovações",
    description: "Fluxo de revisão técnica e aprovação documental.",
    status: "Em desenvolvimento",
    icon: ClipboardCheck,
  },
  {
    id: "exportacoes",
    title: "Exportações",
    description: "Geração futura de arquivos oficiais e pacotes documentais.",
    status: "Em desenvolvimento",
    icon: FileDown,
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description: "Orçamento, custos, fluxo de caixa, margem, forecast e acompanhamento financeiro da obra.",
    status: "Em breve",
    icon: Banknote,
  },
  {
    id: "dashboard-executivo",
    title: "Dashboard Executivo",
    description: "KPIs, indicadores estratégicos, carteira de obras e visão consolidada para diretoria.",
    status: "Em breve",
    icon: BarChart3,
  },
];

const CAPABILITY_BADGE_CLASS: Record<CapabilityStatus, string> = {
  Pronto: "status-badge status-badge--completed",
  "Em desenvolvimento": "status-badge status-badge--active",
  "Em breve": "status-badge status-badge--pending",
  "Demonstração disponível": "status-badge status-badge--pending",
};

export default function EngenhariaWorkspacePage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Sistema Operacional de Decisão</span>
          <div className="workspace-header-title">
            <h1>Workspace Engenharia</h1>
            <span className="status-badge status-badge--active">Beta</span>
          </div>
        </div>
        <Link className="bba-button bba-button--ghost bba-button--sm" href="/workspaces">
          <ArrowLeft size={16} /> Voltar para Workspaces
        </Link>
      </section>

      <section className="section-grid">
        {/* Obras Reais em Execução */}
        <Suspense fallback={<div className="span-12"><p>Carregando obras…</p></div>}>
          <EngineeringWorkspaceObras />
        </Suspense>

        {/* Studios e Capacidades de Engenharia */}
        <div className="span-12" style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Capacidades & Studios de Engenharia
          </h3>
        </div>

        {CAPABILITIES.map((capability) => {
          const Icon = capability.icon;

          return (
            <Card
              action={
                <span className={CAPABILITY_BADGE_CLASS[capability.status]}>
                  {capability.status}
                </span>
              }
              className="span-4 workspace-card"
              key={capability.id}
              title={capability.title}
            >
              <div className="workspace-card__icon" aria-hidden="true">
                <Icon size={20} />
              </div>
              <p className="workspace-card__description">{capability.description}</p>
              {capability.href ? (
                <Link className="bba-button bba-button--secondary bba-button--sm" href={capability.href}>
                  {capability.actionLabel ?? "Abrir"}
                </Link>
              ) : null}
            </Card>
          );
        })}
      </section>
    </>
  );
}
