import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  ListChecks,
  Plus,
  Target,
  UploadCloud
} from "lucide-react";
import {
  AnimatedCounter,
  Card,
  DecisionInsightCard,
  ProgressBar,
  StatusBadge,
  type DecisionInsightCardSection
} from "@bba/ui";

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
  { icon: ListChecks, value: 245, label: "Total de atividades", suffix: "" },
  { icon: CheckCircle2, value: 71, label: "Concluídas", suffix: "" },
  { icon: Clock, value: 28, label: "Em andamento", suffix: "" },
  { icon: Target, value: PROGRESS_PERCENT, label: "Prazo geral", suffix: "%" }
];

// Nenhum Engine alimenta esta análise ainda — ver PRINCIPLE 001 (Full
// Traceability) em packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md.
// Cada placeholder comunica especificamente o que o Planning Engine
// fará por essa seção no futuro — nenhum dado ou conclusão inventada.
const DECISION_SECTIONS: DecisionInsightCardSection[] = [
  { title: "Onde está o desvio?", placeholder: "Aguardando identificação automática." },
  { title: "O que está causando?", placeholder: "Aguardando análise das causas." },
  { title: "Qual o impacto?", placeholder: "Aguardando cálculo de impacto." },
  {
    title: "Quais evidências suportam?",
    placeholder: "Aguardando integração com os módulos operacionais."
  },
  { title: "Qual a ação recomendada?", placeholder: "Será gerada automaticamente pelo BBA Advisor." },
  {
    title: "Nível de confiança",
    placeholder:
      "Será calculado automaticamente conforme a quantidade e qualidade das evidências disponíveis."
  }
];

// Conversacional — o Advisor fala como um especialista, não como um
// formulário (Release 1.1, item 1).
const ADVISOR_MESSAGE = ["Analisei o cronograma desta obra.", "Encontrei um ponto que merece sua atenção."];

export default function PlanejamentoPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Sistema Operacional de Decisão</span>
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
            <div className="workspace-fact">
              <dt>Consórcio</dt>
              <dd>CONJASF – HIDROMEC</dd>
            </div>
            <div className="workspace-fact">
              <dt>Diretoria</dt>
              <dd>Diretoria de Infraestrutura Hídrica - DI</dd>
            </div>
          </dl>

          <p className="workspace-section-label">Progresso da Obra</p>
          <ProgressBar animated color="gold" label={`${PROGRESS_PERCENT}% concluído`} value={PROGRESS_PERCENT} />

          <p className="workspace-section-label">Situação do Projeto</p>
          <dl className="workspace-fact-list">
            <div className="workspace-fact">
              <dt>Situação</dt>
              <dd>🟢 Dentro do prazo</dd>
            </div>
            <div className="workspace-fact">
              <dt>Planejado</dt>
              <dd>{PROGRESS_PERCENT}%</dd>
            </div>
            <div className="workspace-fact">
              <dt>Executado</dt>
              <dd>79%</dd>
            </div>
            <div className="workspace-fact">
              <dt>Financeiro</dt>
              <dd>74%</dd>
            </div>
          </dl>
        </Card>

        {/* Padrão oficial "BBA Advisor UX Pattern" (Release 1.1, ver
            packages/ui/src/decision/README.md): nasce recolhido
            (Progressive Disclosure, PRINCIPLE 003) e expande no mesmo
            card como accordion — uma seção aberta por vez. */}
        <DecisionInsightCard
          className="span-12"
          engineLabel="Planning Engine"
          message={ADVISOR_MESSAGE}
          sections={DECISION_SECTIONS}
          status="🟢 Dentro do prazo"
        />

        {SUMMARY.map((item) => {
          const Icon = item.icon;

          return (
            <Card className="span-3" key={item.label}>
              <div className="metric">
                <span className="metric__icon">
                  <Icon size={20} />
                </span>
                <div>
                  <strong>
                    <AnimatedCounter value={item.value} />
                    {item.suffix}
                  </strong>
                  <span>{item.label}</span>
                </div>
              </div>
            </Card>
          );
        })}

        <Card className="span-12 workspace-card" title="Cronograma">
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
      </section>
    </>
  );
}
