"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  UsersRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminClients,
  areaLabels,
  taskStatusLabels,
  taxRegimeLabels,
  type AdminClientSummary,
  type TaskStatus,
  useBbaStore
} from "@bba/lib";
import { Card, StatusBadge } from "@bba/ui";

const statusOrder: TaskStatus[] = ["todo", "in_progress", "done"];

const formatDate = (date?: string | null) =>
  date
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(new Date(`${date}T12:00:00`))
    : "Sem prazo";

export default function AdminPage() {
  const profile = useBbaStore((state) => state.profile);
  const company = useBbaStore((state) => state.company);
  const projects = useBbaStore((state) => state.projects);
  const tasks = useBbaStore((state) => state.tasks);
  const channels = useBbaStore((state) => state.channels);
  const messages = useBbaStore((state) => state.messages);
  const onboardingSteps = useBbaStore((state) => state.onboardingSteps);

  const openTasks = tasks.filter((task) => task.status !== "done");
  const blockedTasks = tasks.filter(
    (task) =>
      task.status !== "done" &&
      task.due_date &&
      new Date(`${task.due_date}T12:00:00`) < new Date()
  );
  const unreadMessages = messages.filter((message) => message.sender_id !== profile.id);
  const doneSteps = onboardingSteps.filter(
    (step) => step.status === "completed"
  ).length;

  const [adminClients, setAdminClients] = useState<AdminClientSummary[] | null>(
    null
  );

  const currentClient = useMemo<AdminClientSummary>(
    () => ({
      id: company.id || "local-client",
      name: company.name || "Cliente BBA",
      role: profile.role === "bba_admin" ? "Admin" : "Cliente",
      regime: company.tax_regime
        ? taxRegimeLabels[company.tax_regime]
        : "Nao informado",
      owner: "Fiscal",
      health: blockedTasks.length ? "Atencao" : "Saudavel",
      onboarding: Math.round((doneSteps / Math.max(onboardingSteps.length, 1)) * 100),
      openTasks: openTasks.length,
      unread: unreadMessages.length
    }),
    [
      blockedTasks.length,
      company.id,
      company.name,
      company.tax_regime,
      doneSteps,
      onboardingSteps.length,
      openTasks.length,
      profile.role,
      unreadMessages.length
    ]
  );

  useEffect(() => {
    let mounted = true;

    void fetchAdminClients()
      .then((clients) => {
        if (mounted) {
          setAdminClients(clients);
        }
      })
      .catch(() => {
        if (mounted) {
          setAdminClients(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const clients = useMemo(() => {
    const source = adminClients ?? [currentClient];

    return source.map((client) =>
      client.id === company.id
        ? {
            ...client,
            role: currentClient.role,
            health: currentClient.health,
            onboarding: currentClient.onboarding,
            openTasks: currentClient.openTasks,
            unread: currentClient.unread
          }
        : client
    );
  }, [adminClients, company.id, currentClient]);

  const projectTitleById = new Map(
    projects.map((project) => [project.id, project.name])
  );
  const channelAreaById = new Map(
    channels.map((channel) => [channel.id, areaLabels[channel.area]])
  );

  const taskQueue = [...tasks].sort((a, b) => {
    const statusDelta = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    if (statusDelta) return statusDelta;
    return String(a.due_date).localeCompare(String(b.due_date));
  });

  const recentMessages = [...messages]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Painel Admin BBA</h1>
          <p>Carteira, pendencias e comunicacoes operacionais da equipe BBA.</p>
        </div>
        <StatusBadge status="active">Operacao interna</StatusBadge>
      </section>

      <section className="section-grid">
        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <UsersRound size={20} />
            </span>
            <div>
              <strong>{clients.length}</strong>
              <span>Clientes ativos</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <ClipboardList size={20} />
            </span>
            <div>
              <strong>{openTasks.length}</strong>
              <span>Tarefas abertas</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <MessageSquareText size={20} />
            </span>
            <div>
              <strong>{unreadMessages.length}</strong>
              <span>Mensagens novas</span>
            </div>
          </div>
        </Card>

        <Card className="span-3">
          <div className="metric">
            <span className="metric__icon">
              <AlertTriangle size={20} />
            </span>
            <div>
              <strong>{blockedTasks.length}</strong>
              <span>Prazos em atencao</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card className="span-12" title="Carteira de clientes">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Perfil</th>
                  <th>Regime</th>
                  <th>Responsavel</th>
                  <th>Onboarding</th>
                  <th>Pendencias</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.name}</strong>
                    </td>
                    <td>{client.role}</td>
                    <td>{client.regime}</td>
                    <td>{client.owner}</td>
                    <td>
                      <span className="admin-progress">
                        <span style={{ width: `${client.onboarding}%` }} />
                      </span>
                      <small>{client.onboarding}%</small>
                    </td>
                    <td>{client.openTasks + client.unread}</td>
                    <td>
                      <StatusBadge
                        status={client.health === "Saudavel" ? "done" : "in_progress"}
                      >
                        {client.health}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card className="span-7" title="Fila de tarefas BBA">
          <div className="admin-queue">
            {taskQueue.map((task) => (
              <article className="admin-queue-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>
                    {projectTitleById.get(task.project_id ?? "") ?? "Projeto BBA"} -{" "}
                    {task.tag ?? "Geral"}
                  </span>
                </div>
                <div className="admin-row-actions">
                  <StatusBadge status={task.status}>
                    {taskStatusLabels[task.status]}
                  </StatusBadge>
                  <time>{formatDate(task.due_date)}</time>
                </div>
              </article>
            ))}
          </div>
        </Card>

        <Card className="span-5" title="Mensagens recentes">
          <div className="admin-queue">
            {recentMessages.map((message) => (
              <article className="admin-message-row" key={message.id}>
                <div className="task-card__topline">
                  <strong>{channelAreaById.get(message.channel_id) ?? "Canal BBA"}</strong>
                  {message.sender_id === profile.id ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <span className="unread-pill">nova</span>
                  )}
                </div>
                <p>{message.body}</p>
                <span>{message.sender_id === profile.id ? company.name : "Equipe BBA"}</span>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}
