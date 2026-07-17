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
  Landmark,
  Map,
  Ruler,
  Sparkles,
  Wallet,
  Waves,
  Wrench,
  type LucideIcon
} from "lucide-react";
import { Card } from "@bba/ui";

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

/**
 * Este Workspace é o contexto do projeto ativo (Barragem Lagoa do Arroz,
 * 2F Engenharia) — os cards abaixo abrem os Studios relevantes para ele
 * (ver docs/PLATFORM_ARCHITECTURE.md, seção 9). Project/Geo/Studio de
 * Evidências/Medições têm rota própria de nível superior, mas
 * só aparecem na Sidebar quando o usuário está dentro deste Workspace —
 * a visão de todos os Studios de uma vez é exclusiva do Admin BBA. BBA
 * Advisor não é um card de destino — vive contextualizado dentro de
 * cada Studio.
 */
const CAPABILITIES: CapabilityCard[] = [
  {
    id: "planejamento",
    title: "Planejamento",
    description:
      "Cronograma, Curva S, Baseline, Recursos, Custos, Forecast e planejamento integrado da obra.",
    status: "Pronto",
    icon: GanttChart,
    href: "/workspaces/engenharia/planejamento"
  },
  {
    id: "project-studio",
    title: "Project Studio",
    description: "O primeiro planejador de projetos orientado por decisões — importação, Curva S e caminho crítico.",
    status: "Pronto",
    icon: GanttChartSquare,
    href: "/bba-project"
  },
  {
    id: "execucao",
    title: "Execução",
    description:
      "Diário de Obras, equipes, equipamentos, clima, ocorrências e acompanhamento operacional.",
    status: "Em breve",
    icon: Wrench
  },
  {
    id: "geo-studio",
    title: "Geo Studio",
    description:
      "Mapa da obra, georreferenciamento, drone, topografia e evolução espacial da execução.",
    status: "Pronto",
    icon: Map,
    href: "/geoespacial"
  },
  {
    id: "evidence-studio",
    title: "Studio de Evidências",
    description: "Organização de fotos, registros de campo, documentos e observações técnicas.",
    status: "Pronto",
    icon: FolderSearch,
    href: "/evidencias"
  },
  {
    id: "medicoes",
    title: "Medições",
    description:
      "Organização de boletins, quantitativos executados e acompanhamento da evolução da obra.",
    status: "Pronto",
    icon: Ruler,
    href: "/medicoes"
  },
  {
    id: "orcamento",
    title: "Orçamento",
    description:
      "Veja como o orçamento oficial é apresentado, a proposta é comparada e os itens são organizados para decisão.",
    status: "Demonstração disponível",
    icon: Wallet,
    href: "/orcamentos/demonstracao",
    actionLabel: "Ver demonstração"
  },
  {
    id: "documentos",
    title: "Documentos",
    description: "Reconstrução de boletins, relatórios e documentos técnicos para revisão.",
    status: "Pronto",
    icon: FileStack
  },
  {
    id: "aprovacoes",
    title: "Aprovações",
    description: "Fluxo de revisão técnica e aprovação documental.",
    status: "Em desenvolvimento",
    icon: ClipboardCheck
  },
  {
    id: "exportacoes",
    title: "Exportações",
    description: "Geração futura de arquivos oficiais e pacotes documentais.",
    status: "Em desenvolvimento",
    icon: FileDown
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description:
      "Orçamento, custos, fluxo de caixa, margem, forecast e acompanhamento financeiro da obra.",
    status: "Em breve",
    icon: Banknote
  },
  {
    id: "dashboard-executivo",
    title: "Dashboard Executivo",
    description:
      "KPIs, indicadores estratégicos, carteira de obras e visão consolidada para diretoria.",
    status: "Em breve",
    icon: BarChart3
  }
];

const CAPABILITY_BADGE_CLASS: Record<CapabilityStatus, string> = {
  Pronto: "status-badge status-badge--completed",
  "Em desenvolvimento": "status-badge status-badge--active",
  "Em breve": "status-badge status-badge--pending",
  // Mesmo tom neutro/dourado já usado em "Exemplo demonstrativo" (mais abaixo
  // nesta página) — sinaliza que existe algo para ver agora, sem soar como
  // funcionalidade definitiva (nunca "Pronto"/verde, nunca "Em
  // desenvolvimento"/dourado ativo).
  "Demonstração disponível": "status-badge status-badge--pending"
};

const NEXT_STEPS = [
  "Importar documentos da obra",
  "Organizar evidências de campo",
  "Validar memórias de cálculo",
  "Reconstruir boletim de medição",
  "Enviar para revisão técnica"
];

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
        <div className="span-12 workspace-greeting">
          <h2>Bom dia, Fernando.</h2>
          <p>
            Este workspace foi preparado para acompanhar a execução técnica da obra da 2F
            Engenharia.
          </p>
        </div>

        <Card className="span-12 workspace-card workspace-card--highlight" title="Projeto ativo">
          <div className="workspace-card__icon" aria-hidden="true">
            <Waves size={20} />
          </div>
          <p className="workspace-card__description">
            <strong style={{ color: "var(--text-primary)" }}>
              Recuperação e Modernização da Barragem Lagoa do Arroz – PB
            </strong>
            <br />
            Obra pública federal · Paraíba
          </p>
        </Card>

        <Card className="span-12 workspace-card" title="Contexto do Contrato">
          <div className="workspace-card__icon" aria-hidden="true">
            <Landmark size={20} />
          </div>
          <dl className="workspace-fact-list">
            <div className="workspace-fact">
              <dt>Empresa</dt>
              <dd>2F Engenharia</dd>
            </div>
            <div className="workspace-fact">
              <dt>Consórcio</dt>
              <dd>CONJASF – HIDROMEC</dd>
            </div>
            <div className="workspace-fact">
              <dt>Contratante</dt>
              <dd>
                DNOCS
                <span className="workspace-fact__sub">
                  Departamento Nacional de Obras Contra as Secas
                </span>
              </dd>
            </div>
            <div className="workspace-fact">
              <dt>Vinculado ao</dt>
              <dd>Ministério da Integração e do Desenvolvimento Regional - MIDR</dd>
            </div>
            <div className="workspace-fact">
              <dt>Diretoria responsável</dt>
              <dd>Diretoria de Infraestrutura Hídrica - DI</dd>
            </div>
            <div className="workspace-fact">
              <dt>Natureza</dt>
              <dd>Obra pública federal</dd>
            </div>
          </dl>
        </Card>

        <Card className="span-12 workspace-card workspace-card--highlight" title="BBA Advisor">
          <div className="workspace-card__icon" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <p className="workspace-card__description">
            Fernando, preparei este Workspace utilizando os dados da obra da Barragem Lagoa do
            Arroz.
          </p>
          <p className="workspace-card__description">
            A BBA Platform foi projetada para centralizar evidências de campo, memórias de
            cálculo, reconstrução documental e fluxos de aprovação técnica em um único ambiente.
          </p>
          <p className="workspace-card__description">
            O próximo passo será importar os documentos da obra para iniciar a reconstrução
            técnica do projeto.
          </p>
        </Card>

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

        <Card
          action={<span className="status-badge status-badge--pending">Exemplo demonstrativo</span>}
          className="span-12 workspace-card"
          title="Exemplo de memória de cálculo"
        >
          <div className="workspace-card__icon" aria-hidden="true">
            <Calculator size={20} />
          </div>

          <dl className="workspace-fact-list">
            <div className="workspace-fact">
              <dt>Serviço</dt>
              <dd>Piso intertravado</dd>
            </div>
            <div className="workspace-fact">
              <dt>Comprimento</dt>
              <dd>500 m</dd>
            </div>
            <div className="workspace-fact">
              <dt>Largura</dt>
              <dd>4 m</dd>
            </div>
            <div className="workspace-fact">
              <dt>Resultado</dt>
              <dd className="workspace-fact__result">2.000 m²</dd>
            </div>
          </dl>

          <p className="workspace-calculation">
            500 × 4 = <strong>2.000 m²</strong>
          </p>

          <p className="workspace-card__note">
            Observação: exemplo ilustrativo baseado no fluxo operacional discutido com o cliente.
          </p>
        </Card>

        <Card className="span-12 workspace-card" title="Próximos passos">
          <ol className="workspace-steps">
            {NEXT_STEPS.map((step, index) => (
              <li className="workspace-step" key={step}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </Card>
      </section>
    </>
  );
}
