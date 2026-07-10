import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  Plus,
  Sparkles,
  UploadCloud
} from "lucide-react";
import { Card, StatusBadge } from "@bba/ui";

type MemoryStatus = "Aprovada" | "Em revisão" | "Pendente";

interface MemoryRow {
  id: string;
  service: string;
  category: string;
  responsible: string;
  lastReview: string;
  status: MemoryStatus;
}

const STATUS_BADGE: Record<MemoryStatus, "completed" | "active" | "pending"> = {
  Aprovada: "completed",
  "Em revisão": "active",
  Pendente: "pending"
};

const MEMORIES: MemoryRow[] = [
  {
    id: "MEM-0001",
    service: "Escavação",
    category: "Terraplenagem",
    responsible: "Fernando",
    lastReview: "04/07/2026",
    status: "Aprovada"
  },
  {
    id: "MEM-0002",
    service: "Concreto Estrutural",
    category: "Estruturas",
    responsible: "Fernando",
    lastReview: "04/07/2026",
    status: "Em revisão"
  },
  {
    id: "MEM-0003",
    service: "Forma",
    category: "Estruturas",
    responsible: "Fernando",
    lastReview: "03/07/2026",
    status: "Aprovada"
  },
  {
    id: "MEM-0004",
    service: "Armadura",
    category: "Estruturas",
    responsible: "Fernando",
    lastReview: "03/07/2026",
    status: "Pendente"
  },
  {
    id: "MEM-0005",
    service: "Pavimentação",
    category: "Urbanização",
    responsible: "Fernando",
    lastReview: "02/07/2026",
    status: "Aprovada"
  },
  {
    id: "MEM-0006",
    service: "Impermeabilização",
    category: "Estruturas",
    responsible: "Fernando",
    lastReview: "02/07/2026",
    status: "Em revisão"
  },
  {
    id: "MEM-0007",
    service: "Drenagem",
    category: "Terraplenagem",
    responsible: "Fernando",
    lastReview: "01/07/2026",
    status: "Aprovada"
  },
  {
    id: "MEM-0008",
    service: "Alvenaria",
    category: "Estruturas",
    responsible: "Fernando",
    lastReview: "01/07/2026",
    status: "Pendente"
  },
  {
    id: "MEM-0009",
    service: "Revestimento",
    category: "Acabamento",
    responsible: "Fernando",
    lastReview: "30/06/2026",
    status: "Aprovada"
  },
  {
    id: "MEM-0010",
    service: "Pintura",
    category: "Acabamento",
    responsible: "Fernando",
    lastReview: "30/06/2026",
    status: "Em revisão"
  },
  {
    id: "MEM-0011",
    service: "Comporta Metálica",
    category: "Equipamentos",
    responsible: "Fernando",
    lastReview: "29/06/2026",
    status: "Pendente"
  },
  {
    id: "MEM-0012",
    service: "Instalação Elétrica",
    category: "Instalações",
    responsible: "Fernando",
    lastReview: "29/06/2026",
    status: "Em revisão"
  }
];

const SUMMARY = [
  { icon: ClipboardList, value: 28, label: "Memórias" },
  { icon: Calculator, value: 143, label: "Itens Calculados" },
  { icon: Clock, value: 6, label: "Em Revisão" },
  { icon: CheckCircle2, value: 22, label: "Aprovadas" }
];

export default function MemoriasPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Sistema Operacional de Decisão</span>
          <h1>Studio de Medições</h1>
          <p>Organize quantitativos, fórmulas e cálculos auditáveis da obra.</p>
        </div>
        <Link className="bba-button bba-button--ghost bba-button--sm" href="/workspaces/engenharia">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </section>

      <section className="section-grid">
        <div className="span-12 workspace-toolbar">
          <button className="bba-button bba-button--primary bba-button--sm" type="button">
            <Plus size={16} /> Nova Memória
          </button>
          <button className="bba-button bba-button--secondary bba-button--sm" type="button">
            <UploadCloud size={16} /> Importar Planilha
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

        <Card className="span-8 workspace-card" title="Memórias de Cálculo">
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Serviço</th>
                  <th>Categoria</th>
                  <th>Responsável</th>
                  <th>Última revisão</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {MEMORIES.map((memory) => (
                  <tr key={memory.id}>
                    <td>
                      <strong>{memory.id}</strong>
                    </td>
                    <td>{memory.service}</td>
                    <td>{memory.category}</td>
                    <td>{memory.responsible}</td>
                    <td>{memory.lastReview}</td>
                    <td>
                      <StatusBadge status={STATUS_BADGE[memory.status]}>{memory.status}</StatusBadge>
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
            Identifiquei seis memórias aguardando validação técnica.
          </p>
          <p className="workspace-card__description">
            Após a revisão dessas memórias, a reconstrução documental poderá utilizar cálculos
            validados automaticamente.
          </p>
          <p className="workspace-card__note">
            Recomendação: concluir primeiro as memórias classificadas como &quot;Em revisão&quot;.
          </p>
        </Card>
      </section>
    </>
  );
}
