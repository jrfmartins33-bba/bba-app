import type { Task } from "@bba/lib";
import { taskStatusLabels } from "@bba/lib";
import { StatusBadge } from "./StatusBadge";

type TaskCardProps = {
  task: Task;
  projectTitle?: string;
};

export function TaskCard({ projectTitle, task }: TaskCardProps) {
  const date = task.due_date
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit"
      }).format(new Date(`${task.due_date}T12:00:00`))
    : "Sem data";

  return (
    <article className="task-card">
      <div className="task-card__topline">
        <StatusBadge status={task.status}>{taskStatusLabels[task.status]}</StatusBadge>
        <span>{date}</span>
      </div>
      <h3>{task.title}</h3>
      {task.description ? <p>{task.description}</p> : null}
      <div className="task-card__meta">
        {task.tag ? <span>{task.tag}</span> : null}
        {projectTitle ? <span>{projectTitle}</span> : null}
      </div>
    </article>
  );
}
