"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  UsersRound
} from "lucide-react";
import { useMemo } from "react";
import {
  taskStatusLabels,
  teamAreaLabels,
  type TaskStatus,
  useBbaStore
} from "@bba/lib";
import { Card, StatusBadge } from "@bba/ui";

const statusOrder: TaskStatus[] = ["todo", "doing", "done"];

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
  const unreadMessages = messages.filter(
    (message) => message.sender_role === "bba_team" && !message.read_at
  );
  const doneSteps = onboardingSteps.filter((step) => step.status === "done").length;

  const clients = useMemo(
    () => [
      {
        id: profile.id,
        name: profile.name,
        plan: profile.plan,
        regime: profile.regime ?? "Nao informado",
        owner: "Fiscal",
        health: blockedTasks.length ? "Atencao" : "Saudavel",
        onboarding: Math.round((doneSteps / Math.max(onboardingSteps.length, 1)) * 100),
        openTasks: openTasks.length,
        unread: unreadMessages.length
      },
      {
        id: "demo-client-2",
        name: "Fortaleza Digital Servicos",
        plan: "pro",
        regime: "LucroPresumido",
        owner: "Financeiro",
        health: "Saudavel",
        onboarding: 80,
        openTasks: 5,
        unread: 2
      },
      {
        id: "demo-client-3",
        name: "Norte Comercio Integrado",
        plan: "essencial",
        regime: "Simples",
        owner: "Governanca",
        health: "Atencao",
        onboarding: 45,
        openTasks: 7,
        unread: 4
      }
    ],
    [blockedTasks.length, doneSteps, onboardingSteps.length, openTasks.length, profile, unreadMessages.length]
  );

  const projectTitleById = new Map(
    projects.map((project) => [project.id, project.title])
  );
  const channelAreaById = new Map(
    channels.map((channel) => [channel.id, teamAreaLabels[channel.team_area]])
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
                  <th>Plano</th>
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
                    <td>{client.plan}</td>
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
                        status={client.health === "Saudavel" ? "done" : "current"}
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
                    {projectTitleById.get(task.project_id) ?? "Projeto BBA"} ·{" "}
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
                  {message.read_at ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <span className="unread-pill">nova</span>
                  )}
                </div>
                <p>{message.content}</p>
                <span>{message.sender_role === "client" ? profile.name : "Equipe BBA"}</span>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}
