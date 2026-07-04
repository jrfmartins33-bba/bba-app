import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  FileStack,
  FolderSearch,
  Landmark,
  Sparkles,
  Waves,
  type LucideIcon
} from "lucide-react";
import { Card } from "@bba/ui";

type CapabilityStatus = "Pronto" | "Em desenvolvimento";

interface CapabilityCard {
  id: string;
  title: string;
  description: string;
  status: CapabilityStatus;
  icon: LucideIcon;
}

const CAPABILITIES: CapabilityCard[] = [
  {
    id: "evidencias",
    title: "Evidências",
    description: "Organização de fotos, registros de campo, documentos e observações técnicas.",
    status: "Pronto",
    icon: FolderSearch
  },
  {
    id: "memorias-calculo",
    title: "Memórias de Cálculo",
    description: "Cálculo estruturado de quantitativos, fórmulas e trilhas auditáveis.",
    status: "Pronto",
    icon: ClipboardList
  },
  {
    id: "reconstrucao-documental",
    title: "Reconstrução Documental",
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
    id: "bba-advisor",
    title: "BBA Advisor",
    description: "Assistente operacional para destacar pendências, riscos e oportunidades.",
    status: "Em desenvolvimento",
    icon: Sparkles
  }
];

const CAPABILITY_BADGE_CLASS: Record<CapabilityStatus, string> = {
  Pronto: "status-badge status-badge--completed",
  "Em desenvolvimento": "status-badge status-badge--active"
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
          <span className="workspaces-eyebrow">BBA Platform · Operational Decision Platform</span>
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
