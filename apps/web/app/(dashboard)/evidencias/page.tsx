import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Camera,
  Filter,
  FileStack,
  FileText,
  Images,
  ListChecks,
  Plus,
  Sparkles,
  UploadCloud,
  Video,
  type LucideIcon
} from "lucide-react";
import { Card, StatusBadge } from "@bba/ui";

type EvidenceType = "Fotografia" | "Vídeo" | "Relatório" | "Documento" | "Checklist";
type EvidenceStatus = "Validada" | "Em análise" | "Pendente";
type EvidenceOrigin = "Campo" | "Engenharia";

interface EvidenceRow {
  id: string;
  type: EvidenceType;
  description: string;
  date: string;
  status: EvidenceStatus;
  origin: EvidenceOrigin;
}

const TYPE_ICON: Record<EvidenceType, LucideIcon> = {
  Fotografia: Camera,
  Vídeo: Video,
  Relatório: FileText,
  Documento: FileStack,
  Checklist: ListChecks
};

const STATUS_BADGE: Record<EvidenceStatus, "completed" | "active" | "pending"> = {
  Validada: "completed",
  "Em análise": "active",
  Pendente: "pending"
};

const EVIDENCES: EvidenceRow[] = [
  {
    id: "EVD-0001",
    type: "Fotografia",
    description: "Escavação da fundação",
    date: "08/07/2026",
    status: "Validada",
    origin: "Campo"
  },
  {
    id: "EVD-0002",
    type: "Documento",
    description: "Projeto executivo",
    date: "07/07/2026",
    status: "Em análise",
    origin: "Engenharia"
  },
  {
    id: "EVD-0003",
    type: "Fotografia",
    description: "Lançamento de concreto - bloco A",
    date: "07/07/2026",
    status: "Validada",
    origin: "Campo"
  },
  {
    id: "EVD-0004",
    type: "Vídeo",
    description: "Inspeção da comporta principal",
    date: "06/07/2026",
    status: "Pendente",
    origin: "Campo"
  },
  {
    id: "EVD-0005",
    type: "Relatório",
    description: "Relatório semanal de avanço físico",
    date: "06/07/2026",
    status: "Validada",
    origin: "Engenharia"
  },
  {
    id: "EVD-0006",
    type: "Checklist",
    description: "Checklist de segurança - frente de serviço",
    date: "05/07/2026",
    status: "Validada",
    origin: "Campo"
  },
  {
    id: "EVD-0007",
    type: "Fotografia",
    description: "Armadura da fundação - trecho 2",
    date: "05/07/2026",
    status: "Em análise",
    origin: "Campo"
  },
  {
    id: "EVD-0008",
    type: "Documento",
    description: "ART do responsável técnico",
    date: "04/07/2026",
    status: "Validada",
    origin: "Engenharia"
  },
  {
    id: "EVD-0009",
    type: "Vídeo",
    description: "Ensaio de estanqueidade",
    date: "04/07/2026",
    status: "Pendente",
    origin: "Campo"
  },
  {
    id: "EVD-0010",
    type: "Checklist",
    description: "Checklist de recebimento de material",
    date: "03/07/2026",
    status: "Pendente",
    origin: "Campo"
  }
];

const SUMMARY = [
  { icon: Camera, value: 18, label: "Fotografias" },
  { icon: FileStack, value: 12, label: "Documentos" },
  { icon: Images, value: 7, label: "Registros" },
  { icon: ListChecks, value: 3, label: "Pendências" }
];

export default function EvidenciasPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Operational Decision Platform</span>
          <h1>Evidence Studio</h1>
          <p>Centralize fotografias, documentos e registros de campo da obra.</p>
        </div>
        <Link className="bba-button bba-button--ghost bba-button--sm" href="/workspaces/engenharia">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </section>

      <section className="section-grid">
        <div className="span-12 workspace-toolbar">
          <button className="bba-button bba-button--primary bba-button--sm" type="button">
            <Plus size={16} /> Nova Evidência
          </button>
          <button className="bba-button bba-button--secondary bba-button--sm" type="button">
            <UploadCloud size={16} /> Importar Arquivos
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

        <Card className="span-8 workspace-card" title="Lista de Evidências">
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {EVIDENCES.map((evidence) => {
                  const TypeIcon = TYPE_ICON[evidence.type];

                  return (
                    <tr key={evidence.id}>
                      <td>
                        <strong>{evidence.id}</strong>
                      </td>
                      <td>
                        <span className="workspace-table__type">
                          <TypeIcon aria-hidden="true" />
                          {evidence.type}
                        </span>
                      </td>
                      <td>{evidence.description}</td>
                      <td>{evidence.date}</td>
                      <td>
                        <StatusBadge status={STATUS_BADGE[evidence.status]}>{evidence.status}</StatusBadge>
                      </td>
                      <td>{evidence.origin}</td>
                    </tr>
                  );
                })}
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
            Identifiquei três evidências ainda pendentes de validação.
          </p>
          <p className="workspace-card__description">
            Após a validação, elas poderão ser utilizadas nas memórias de cálculo e posteriormente
            na reconstrução documental.
          </p>
          <p className="workspace-card__note">
            Sugestão: concluir primeiro os registros da fundação da barragem.
          </p>
        </Card>
      </section>
    </>
  );
}
