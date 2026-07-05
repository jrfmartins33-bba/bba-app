import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  ListChecks,
  Plus,
  Sparkles,
  Target,
  UploadCloud
} from "lucide-react";
import { Card, ProgressBar, StatusBadge } from "@bba/ui";

type ActivityStatus = "Concluída" | "Em andamento" | "Planejada";

interface ActivityRow {
  id: string;
  activity: string;
  responsible: string;
  start: string;
  end: string;
  status: ActivityStatus;
}

const STATUS_BADGE: Record<ActivityStatus, "completed" | "active" | "pending"> = {
  Concluída: "completed",
  "Em andamento": "active",
  Planejada: "pending"
};

const ACTIVITIES: ActivityRow[] = [
  {
    id: "PLN-001",
    activity: "Mobilização",
    responsible: "Engenharia",
    start: "01/07",
    end: "05/07",
    status: "Concluída"
  },
  {
    id: "PLN-002",
    activity: "Instalação do canteiro",
    responsible: "Campo",
    start: "03/07",
    end: "10/07",
    status: "Concluída"
  },
  {
    id: "PLN-003",
    activity: "Topografia",
    responsible: "Topografia",
    start: "08/07",
    end: "15/07",
    status: "Em andamento"
  },
  {
    id: "PLN-004",
    activity: "Escavação da fundação",
    responsible: "Campo",
    start: "10/07",
    end: "20/07",
    status: "Em andamento"
  },
  {
    id: "PLN-005",
    activity: "Desvio do curso d'água",
    responsible: "Engenharia",
    start: "12/07",
    end: "22/07",
    status: "Planejada"
  },
  {
    id: "PLN-006",
    activity: "Concretagem da fundação",
    responsible: "Estruturas",
    start: "20/07",
    end: "05/08",
    status: "Planejada"
  },
  {
    id: "PLN-007",
    activity: "Montagem de fôrmas",
    responsible: "Estruturas",
    start: "22/07",
    end: "30/07",
    status: "Planejada"
  },
  {
    id: "PLN-008",
    activity: "Armação estrutural",
    responsible: "Estruturas",
    start: "25/07",
    end: "02/08",
    status: "Planejada"
  },
  {
    id: "PLN-009",
    activity: "Instalação da comporta",
    responsible: "Equipamentos",
    start: "05/08",
    end: "20/08",
    status: "Planejada"
  },
  {
    id: "PLN-010",
    activity: "Impermeabilização",
    responsible: "Estruturas",
    start: "15/08",
    end: "25/08",
    status: "Planejada"
  },
  {
    id: "PLN-011",
    activity: "Testes de estanqueidade",
    responsible: "Engenharia",
    start: "26/08",
    end: "30/08",
    status: "Planejada"
  },
  {
    id: "PLN-012",
    activity: "Entrega técnica",
    responsible: "Engenharia",
    start: "01/09",
    end: "05/09",
    status: "Planejada"
  }
];

const PROGRESS_PERCENT = 82;

const SUMMARY = [
  { icon: ListChecks, value: 245, label: "Total de atividades" },
  { icon: CheckCircle2, value: 71, label: "Concluídas" },
  { icon: Clock, value: 28, label: "Em andamento" },
  { icon: Target, value: `${PROGRESS_PERCENT}%`, label: "Prazo geral" }
];

export default function PlanejamentoPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Operational Decision Platform</span>
          <h1>Planejamento</h1>
          <p>Cronograma executivo da obra e acompanhamento do planejamento.</p>
        </div>
        <Link className="bba-button bba-button--ghost bba-button--sm" href="/workspaces/engenharia">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </section>

      <section className="section-grid">
        <div className="span-12 workspace-toolbar">
          <button className="bba-button bba-button--primary bba-button--sm" type="button">
            <Plus size={16} /> Nova Atividade
          </button>
          <button className="bba-button bba-button--secondary bba-button--sm" type="button">
            <UploadCloud size={16} /> Importar Cronograma
          </button>
          <button className="bba-button bba-button--ghost bba-button--sm" type="button">
            <Filter size={16} /> Filtrar
          </button>
        </div>

        <Card className="span-12 workspace-card" title="Contexto da Obra">
          <div className="workspace-card__icon" aria-hidden="true">
            <Building2 size={20} />
          </div>
          <dl className="workspace-fact-list">
            <div className="workspace-fact">
              <dt>Empresa</dt>
              <dd>2F Engenharia</dd>
            </div>
            <div className="workspace-fact">
              <dt>Projeto</dt>
              <dd>Recuperação e Modernização da Barragem Lagoa do Arroz – PB</dd>
            </div>
            <div className="workspace-fact">
              <dt>Contratante</dt>
              <dd>DNOCS</dd>
            </div>
          </dl>
        </Card>

        {SUMMARY.map((item) => {
          const Icon = item.icon;

          return (
            <Card className="span-3" key={item.label}>
              <div className="metric">
                <span className="metric__icon">
                  <Icon size={20} />
                </span>
                <div>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              </div>
            </Card>
          );
        })}

        <Card className="span-8 workspace-card" title="Cronograma">
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Atividade</th>
                  <th>Responsável</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ACTIVITIES.map((activity) => (
                  <tr key={activity.id}>
                    <td>
                      <strong>{activity.id}</strong>
                    </td>
                    <td>{activity.activity}</td>
                    <td>{activity.responsible}</td>
                    <td>{activity.start}</td>
                    <td>{activity.end}</td>
                    <td>
                      <StatusBadge status={STATUS_BADGE[activity.status]}>{activity.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="span-4 workspace-card workspace-card--highlight" title="BBA Advisor">
          <div className="workspace-card__icon" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <p className="workspace-card__description">Fernando,</p>
          <p className="workspace-card__description">
            o planejamento encontra-se consistente com a evolução atual da obra.
          </p>
          <p className="workspace-card__description">
            As próximas atividades críticas concentram-se na execução da fundação e preparação das
            estruturas hidráulicas.
          </p>
          <p className="workspace-card__note">
            Recomendação: acompanhar diariamente as atividades do caminho crítico.
          </p>
        </Card>

        <Card className="span-12 workspace-card" title="Linha do Tempo">
          <ProgressBar animated color="gold" label={`${PROGRESS_PERCENT}% concluído`} value={PROGRESS_PERCENT} />
        </Card>
      </section>
    </>
  );
}
