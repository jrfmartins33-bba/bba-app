import Link from "next/link";
import {
  Calculator,
  Cog,
  Factory,
  GraduationCap,
  HardHat,
  HeartPulse,
  Scale,
  ShoppingBag,
  Sprout,
  Truck,
  type LucideIcon
} from "lucide-react";
import { Card } from "@bba/ui";

type WorkspaceStatus = "Ativo" | "Beta" | "Em breve";

interface WorkspaceDefinition {
  id: string;
  name: string;
  description: string;
  status: WorkspaceStatus;
  icon: LucideIcon;
  href?: string;
}

const WORKSPACES: WorkspaceDefinition[] = [
  {
    id: "contabilidade",
    name: "Contabilidade",
    description: "Rotinas fiscais, financeiras e trabalhistas em um único lugar.",
    status: "Ativo",
    icon: Calculator,
    href: "/hoje"
  },
  {
    id: "engenharia",
    name: "Engenharia",
    description:
      "Evidências, cálculos, medições e documentos técnicos em um único workspace.",
    status: "Beta",
    icon: HardHat,
    href: "/workspaces/engenharia"
  },
  {
    id: "saude",
    name: "Saúde",
    description: "Gestão operacional para clínicas, consultórios e redes de saúde.",
    status: "Em breve",
    icon: HeartPulse
  },
  {
    id: "educacao",
    name: "Educação",
    description: "Gestão administrativa e financeira para instituições de ensino.",
    status: "Em breve",
    icon: GraduationCap
  },
  {
    id: "agronegocio",
    name: "Agronegócio",
    description: "Controle operacional e financeiro para produtores e cooperativas.",
    status: "Em breve",
    icon: Sprout
  },
  {
    id: "industria",
    name: "Indústria",
    description: "Planejamento, custos e operação para ambientes industriais.",
    status: "Em breve",
    icon: Factory
  },
  {
    id: "juridico",
    name: "Jurídico",
    description: "Gestão de processos, prazos e contratos para escritórios jurídicos.",
    status: "Em breve",
    icon: Scale
  },
  {
    id: "varejo",
    name: "Varejo",
    description: "Vendas, estoque e financeiro para operações de varejo.",
    status: "Em breve",
    icon: ShoppingBag
  },
  {
    id: "logistica",
    name: "Logística",
    description: "Controle de frota, rotas e operações logísticas.",
    status: "Em breve",
    icon: Truck
  },
  {
    id: "manufatura",
    name: "Manufatura",
    description: "Produção, custos e controle de chão de fábrica.",
    status: "Em breve",
    icon: Cog
  }
];

const STATUS_BADGE_CLASS: Record<WorkspaceStatus, string> = {
  Ativo: "status-badge status-badge--completed",
  Beta: "status-badge status-badge--active",
  "Em breve": "status-badge status-badge--pending"
};

export default function WorkspacesPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Sistema Operacional de Decisão</span>
          <h1>Workspaces</h1>
          <p>Escolha um workspace para continuar.</p>
        </div>
      </section>

      <section className="section-grid">
        {WORKSPACES.map((workspace) => {
          const Icon = workspace.icon;

          return (
            <Card
              action={
                <span className={STATUS_BADGE_CLASS[workspace.status]}>{workspace.status}</span>
              }
              className="span-4 workspace-card"
              key={workspace.id}
              title={workspace.name}
            >
              <div className="workspace-card__icon" aria-hidden="true">
                <Icon size={20} />
              </div>
              <p className="workspace-card__description">{workspace.description}</p>
              {workspace.href ? (
                <Link className="bba-button bba-button--primary bba-button--sm" href={workspace.href}>
                  Abrir workspace
                </Link>
              ) : (
                <button className="bba-button bba-button--ghost bba-button--sm" disabled type="button">
                  Em breve
                </button>
              )}
            </Card>
          );
        })}

        <Card
          className="span-4 workspace-card workspace-card--add"
          title="+ Adicionar Workspace"
        >
          <p className="workspace-card__description">
            Conecte um novo segmento de atuação à sua operação na BBA Platform.
          </p>
          <button className="bba-button bba-button--ghost bba-button--sm" disabled type="button">
            Em breve
          </button>
        </Card>
      </section>
    </>
  );
}
