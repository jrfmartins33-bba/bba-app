import { BbaDashboardShell } from "@/components/bba-dashboard-shell";
import "../bba-globals.css";

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <BbaDashboardShell>{children}</BbaDashboardShell>;
}
