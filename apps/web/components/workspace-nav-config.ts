import {
  ClipboardCheck,
  ClipboardList,
  FileDown,
  FileStack,
  FolderSearch,
  HardHat,
  LayoutDashboard,
  Ruler,
  Sparkles,
  type LucideIcon
} from "lucide-react";

/**
 * Platform → Workspace → Navigation.
 *
 * One `WorkspaceNavConfig` entry fully describes one Workspace's presence
 * in the Sidebar: its group icon/label, the route prefix that determines
 * whether the group is the "active" workspace, and its own sub-navigation
 * items. The Sidebar renders this list generically (a single `.map`), so
 * adding a new Workspace (Contabilidade, Saúde, Educação, Jurídico,
 * Agronegócio, Indústria, Logística, Varejo, Manufatura, ...) only ever
 * requires appending a new entry here — never editing `sidebar.tsx` itself.
 *
 * A sub-item without `href` has no page yet: the Sidebar renders it as an
 * inert, muted "em breve" row instead of a link. The moment a real route
 * exists for that section, adding its `href` here is the only change
 * needed for it to become a fully working, route-aware nav link.
 */

export interface WorkspaceSubNavItem {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly href?: string;
}

export interface WorkspaceNavConfig {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Route prefix used to detect this Workspace as active (drives auto expand/collapse). */
  readonly basePath: string;
  readonly items: ReadonlyArray<WorkspaceSubNavItem>;
}

export const WORKSPACE_NAV_CONFIG: ReadonlyArray<WorkspaceNavConfig> = [
  {
    id: "engenharia",
    label: "Engenharia",
    icon: HardHat,
    basePath: "/workspaces/engenharia",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/workspaces/engenharia" },
      { label: "Evidências", icon: FolderSearch, href: "/workspaces/engenharia/evidencias" },
      { label: "Memórias", icon: ClipboardList, href: "/workspaces/engenharia/memorias" },
      { label: "Medições", icon: Ruler },
      { label: "Documentos", icon: FileStack },
      { label: "Aprovações", icon: ClipboardCheck },
      { label: "Exportações", icon: FileDown },
      { label: "BBA Advisor", icon: Sparkles }
    ]
    // FASE 6 (preparação futura — nenhuma lógica, nenhum componente, nenhuma
    // tela implementada): este Workspace poderá futuramente carregar uma
    // lista de Projetos ativos (ex.: um seletor exibido acima de `items`,
    // com o Projeto corrente marcado, similar a:
    //   Projetos
    //   ● Lagoa do Arroz   (projeto ativo)
    //   ○ Castanhão
    //   ○ Acaraú
    //   ○ Novo Projeto
    // Quando implementado, cada Projeto provavelmente reescopa `basePath`
    // (ex.: /workspaces/engenharia/lagoa-do-arroz) sem exigir nenhuma
    // mudança na Sidebar — apenas nova configuração, no mesmo espírito
    // deste arquivo.
  }
  // Próximos Workspaces (Contabilidade, Saúde, Educação, Jurídico,
  // Agronegócio, Indústria, Logística, Varejo, Manufatura, ...) entram
  // aqui como novas entradas — o mesmo Business Decision System (BDS) por
  // trás de cada um permanece inteiramente desacoplado desta camada de UI.
];
