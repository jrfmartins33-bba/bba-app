import type { TaskStatus } from "@bba/lib";

type StatusBadgeProps = {
  status:
    | TaskStatus
    | "active"
    | "paused"
    | "cancelled"
    | "completed"
    | "pending"
    | "in_progress";
  children: string;
};

export function StatusBadge({ children, status }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${status}`}>{children}</span>;
}
