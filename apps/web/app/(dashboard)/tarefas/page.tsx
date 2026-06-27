"use client";

import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult
} from "@hello-pangea/dnd";
import { Filter, Plus, Search } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  groupTasksByStatus,
  taskStatusLabels,
  type TaskStatus,
  useBbaStore
} from "@bba/lib";
import { Button, Card, TaskCard } from "@bba/ui";

const statuses: TaskStatus[] = ["todo", "doing", "done"];

export default function TarefasPage() {
  const projects = useBbaStore((state) => state.projects);
  const tasks = useBbaStore((state) => state.tasks);
  const createTask = useBbaStore((state) => state.createTask);
  const updateTaskStatus = useBbaStore((state) => state.updateTaskStatus);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("all");
  const [newTask, setNewTask] = useState({
    title: "",
    tag: "",
    due_date: "",
    project_id: projects[0]?.id ?? ""
  });

  const tags = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.tag).filter(Boolean))) as string[],
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const description = task.description ?? "";
      const matchesTerm =
        !term ||
        task.title.toLowerCase().includes(term) ||
        description.toLowerCase().includes(term);
      const matchesTag = tag === "all" || task.tag === tag;
      return matchesTerm && matchesTag;
    });
  }, [search, tag, tasks]);

  const grouped = groupTasksByStatus(filteredTasks);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const nextStatus = result.destination.droppableId as TaskStatus;
    updateTaskStatus(result.draggableId, nextStatus);
  };

  const handleCreateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createTask(newTask);
    setNewTask({
      title: "",
      tag: "",
      due_date: "",
      project_id: projects[0]?.id ?? ""
    });
  };

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Tarefas</h1>
          <p>Board operacional para acompanhar pendencias, responsaveis e prazos.</p>
        </div>
      </section>

      <Card className="span-12" title="Nova tarefa">
        <form className="task-create" onSubmit={handleCreateTask}>
          <div className="field">
            <label htmlFor="task-title">Titulo</label>
            <input
              id="task-title"
              onChange={(event) =>
                setNewTask((current) => ({ ...current, title: event.target.value }))
              }
              required
              value={newTask.title}
            />
          </div>

          <div className="field">
            <label htmlFor="task-project">Projeto</label>
            <select
              id="task-project"
              onChange={(event) =>
                setNewTask((current) => ({ ...current, project_id: event.target.value }))
              }
              value={newTask.project_id}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="task-tag">Tag</label>
            <input
              id="task-tag"
              onChange={(event) =>
                setNewTask((current) => ({ ...current, tag: event.target.value }))
              }
              placeholder="Fiscal"
              value={newTask.tag}
            />
          </div>

          <div className="field">
            <label htmlFor="task-due">Prazo</label>
            <input
              id="task-due"
              onChange={(event) =>
                setNewTask((current) => ({ ...current, due_date: event.target.value }))
              }
              type="date"
              value={newTask.due_date}
            />
          </div>

          <Button icon={<Plus size={17} />} type="submit">
            Adicionar
          </Button>
        </form>
      </Card>

      <Card title="Filtros">
        <div className="task-toolbar">
          <div className="field">
            <label htmlFor="search">Buscar</label>
            <div style={{ position: "relative" }}>
              <Search
                aria-hidden="true"
                size={16}
                style={{ color: "#696969", left: 12, position: "absolute", top: 13 }}
              />
              <input
                className="control-input"
                id="search"
                onChange={(event) => setSearch(event.target.value)}
                style={{ paddingLeft: 36 }}
                value={search}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="tag">Tag</label>
            <select id="tag" onChange={(event) => setTag(event.target.value)} value={tag}>
              <option value="all">Todas</option>
              {tags.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Resultado</label>
            <span className="status-badge status-badge--current">
              <Filter size={13} /> {filteredTasks.length} tarefa(s)
            </span>
          </div>
        </div>
      </Card>

      <DragDropContext onDragEnd={handleDragEnd}>
        <section className="tasks-board" aria-label="Board de tarefas">
          {statuses.map((status) => (
            <Droppable droppableId={status} key={status}>
              {(provided, snapshot) => (
                <div className="kanban-column">
                  <div className="kanban-column__header">
                    <h2>{taskStatusLabels[status]}</h2>
                    <span className="status-badge status-badge--pending">
                      {grouped[status].length}
                    </span>
                  </div>

                  <div
                    className={`kanban-list ${snapshot.isDraggingOver ? "kanban-list--dragging" : ""}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {grouped[status].map((task, index) => (
                      <Draggable draggableId={task.id} index={index} key={task.id}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            className={dragSnapshot.isDragging ? "dragging-card" : undefined}
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                          >
                            <TaskCard
                              projectTitle={
                                projects.find((project) => project.id === task.project_id)
                                  ?.title
                              }
                              task={task}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {!grouped[status].length ? (
                      <div className="empty-state">Sem tarefas nesta coluna.</div>
                    ) : null}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </section>
      </DragDropContext>
    </>
  );
}
