"use client";

import {
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  Network,
  UserRoundCheck
} from "lucide-react";
import Link from "next/link";
import { areaLabels, isSupabaseConfigured, taskStatusLabels, useBbaStore } from "@bba/lib";
import { Card, OnboardingProgress, StatusBadge, TaskCard } from "@bba/ui";

export default function DashboardPage() {
  const profile = useBbaStore((state) => state.profile);
  const company = useBbaStore((state) => state.company);
  const projects = useBbaStore((state) => state.projects);
  const tasks = useBbaStore((state) => state.tasks);
  const channels = useBbaStore((state) => state.channels);
  const messages = useBbaStore((state) => state.messages);
  const onboardingSteps = useBbaStore((state) => state.onboardingSteps);

  const openTasks = tasks.filter((task) => task.status !== "done");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const unread = messages.filter(
    (message) => message.sender_id !== profile.id
  );
  const priorityTasks = [...openTasks]
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, 3);

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Painel Executivo</h1>
          <p>
            Visao consolidada do onboarding, pendencias e comunicacoes ativas de{" "}
            {company.name}.
          </p>
        </div>
        <StatusBadge status={isSupabaseConfigured ? "active" : "in_progress"}>
          {isSupabaseConfigured ? "Supabase ativo" : "Demo local"}
        </StatusBadge>
      </section>

      <section className="section-grid">
        <Card className="span-4">
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

        <Card className="span-4">
          <div className="metric">
            <span className="metric__icon">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <strong>{doneTasks.length}</strong>
              <span>Tarefas concluidas</span>
            </div>
          </div>
        </Card>

        <Card className="span-4">
          <div className="metric">
            <span className="metric__icon">
              <MessageSquareText size={20} />
            </span>
            <div>
              <strong>{unread.length}</strong>
              <span>Mensagens novas</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card
          action={
            <Link className="link-button link-button--secondary" href="/onboarding">
              <UserRoundCheck size={16} />
              Abrir
            </Link>
          }
          className="span-5"
          title="Onboarding"
        >
          <OnboardingProgress steps={onboardingSteps} />
        </Card>

        <Card
          action={
            <Link className="link-button link-button--primary" href="/tarefas">
              Ver board
            </Link>
          }
          className="span-7"
          title="Prioridades"
        >
          <div className="task-list">
            {priorityTasks.length ? (
              priorityTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  projectTitle={projects.find((project) => project.id === task.project_id)?.name}
                  task={task}
                />
              ))
            ) : (
              <div className="empty-state">Nenhuma pendencia aberta.</div>
            )}
          </div>
        </Card>
      </section>

      <section className="section-grid">
        <Card className="span-7" title="Projetos BBA">
          <div className="project-list">
            {projects.map((project) => (
              <article className="project-row" key={project.id}>
                <div className="task-card__topline">
                  <h3>{project.name}</h3>
                  <StatusBadge status={project.status}>
                    {project.status === "active" ? "Ativo" : project.status}
                  </StatusBadge>
                </div>
                <p>{project.description}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card
          action={
            <Link className="link-button link-button--secondary" href="/chat">
              Abrir chat
            </Link>
          }
          className="span-5"
          title="Canais"
        >
          <div className="timeline-list">
            {channels.slice(0, 4).map((channel) => {
              const count = messages.filter(
                (message) =>
                  message.channel_id === channel.id &&
                  message.sender_id !== profile.id
              ).length;

              return (
                <article className="timeline-row" key={channel.id}>
                  <div className="task-card__topline">
                    <h3>
                      <Network size={15} /> {areaLabels[channel.area]}
                    </h3>
                    <span>{count ? `${count} nova(s)` : "Em dia"}</span>
                  </div>
                  <p>Canal dedicado para alinhamentos da area.</p>
                </article>
              );
            })}
          </div>
        </Card>
      </section>
    </>
  );
}
