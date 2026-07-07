'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useBbaStore } from '@bba/lib'
import {
  Home,
  LayoutGrid,
  Building2,
  Wallet,
  FileText,
  Users,
  ChevronDown,
  LogOut,
  Shield,
  Briefcase,
  ReceiptText,
  FileCheck2,
  DollarSign,
  Zap,
  Settings,
  GanttChartSquare,
  Map,
  FolderSearch,
  ClipboardList,
  HardHat,
  FileStack,
  ClipboardCheck,
  FileDown,
} from 'lucide-react'
import { WORKSPACE_NAV_CONFIG } from './workspace-nav-config'

interface SidebarProps {
  userName?: string
  userEmail?: string
  isAdmin?: boolean
  alertCount?: number
}

const NAV_TOP = [
  {
    href: '/hoje',
    label: 'Hoje',
    icon: Home,
    description: 'Cockpit · Radar · Ações',
  },
  {
    href: '/workspaces',
    label: 'Workspaces',
    icon: LayoutGrid,
    description: 'Contabilidade · Engenharia · Novos módulos',
  },
]

// BBA Platform — cada Studio é uma capacidade de produto de mesmo nível,
// independente de qual workspace/projeto está ativo (ver
// docs/PLATFORM_ARCHITECTURE.md, seção 9.2). Um item sem `href` ainda não
// tem Studio implementado — a Sidebar o renderiza como uma linha inerte
// "em breve", igual ao padrão já usado nos sub-itens de Workspace.
const NAV_STUDIOS = [
  {
    href: '/bba-project',
    label: 'Project Studio',
    icon: GanttChartSquare,
    description: 'O primeiro planejador de projetos orientado por decisões',
  },
  {
    href: '/geoespacial',
    label: 'Geo Studio',
    icon: Map,
    description: 'Mapa, GIS e evolução espacial da obra',
  },
  {
    href: '/evidencias',
    label: 'Evidence Studio',
    icon: FolderSearch,
    description: 'Fotografias, vídeos e registros de campo',
  },
  {
    href: '/memorias',
    label: 'Measure Studio',
    icon: ClipboardList,
    description: 'Memórias de cálculo e quantitativos',
  },
  {
    label: 'Finance Studio',
    icon: Wallet,
    description: 'Fluxo de caixa, custos, DRE e forecast financeiro',
  },
  {
    label: 'Field Studio',
    icon: HardHat,
    description: 'Diário de obra, equipes e execução física',
  },
  {
    label: 'Document Studio',
    icon: FileStack,
    description: 'Contratos, projetos e reconstrução documental',
  },
  {
    label: 'Approval Studio',
    icon: ClipboardCheck,
    description: 'Fluxos de aprovação e histórico de pendências',
  },
  {
    label: 'Export Studio',
    icon: FileDown,
    description: 'PDF, Excel, APIs e integrações',
  },
]

const NAV_SECONDARY = [
  {
    href: '/empresa',
    label: 'Empresa',
    icon: Building2,
    description: 'Score · Diagnóstico · Estágio',
  },
  {
    href: '/caixa',
    label: 'Caixa',
    icon: Wallet,
    description: 'Fluxo · Entradas · Saídas',
  },
  {
    href: '/impostos',
    label: 'Impostos',
    icon: ReceiptText,
    description: 'DAS · FGTS · IRPJ · Agenda',
  },
  {
    href: '/equipe',
    label: 'Equipe',
    icon: Users,
    description: 'RH · Folha · Encargos',
  },
]

const NAV_MOTOR = [
  { href: '/motor/cadastro',    label: 'Cadastro',    icon: FileText },
  { href: '/motor/fiscal',      label: 'Fiscal',      icon: FileCheck2 },
  { href: '/motor/financeiro',  label: 'Financeiro',  icon: DollarSign },
  { href: '/motor/contratos',   label: 'Contratos',   icon: Briefcase },
  { href: '/motor/trabalhista', label: 'Trabalhista', icon: Shield },
]

export function Sidebar({ userName, userEmail, isAdmin, alertCount }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const signOut = useBbaStore((state) => state.signOut)
  const [motorOpen, setMotorOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/hoje') return pathname === '/hoje' || pathname === '/'
    if (href === '/workspaces') return pathname === '/workspaces'
    return pathname.startsWith(href)
  }

  const handleLogout = () => {
    signOut()
    router.push('/login')
  }

  // Iniciais do nome para o avatar
  const initials = userName
    ? userName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <aside className="bba-sidebar">

      {/* ── Logo BBA ── */}
      <div className="bba-sidebar__brand">
        <div className="bba-sidebar__brand-emblem">
          {/* Ícone BBA — diamond/spark */}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <div className="bba-sidebar__brand-text">
          <span className="bba-sidebar__brand-name">BBA Platform</span>
          <span className="bba-sidebar__brand-role">Portal do cliente</span>
        </div>
      </div>

      {/* ── Navegação principal ── */}
      <nav className="bba-sidebar__nav" aria-label="Navegação principal">

        <div className="bba-nav-section">
          {NAV_TOP.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const showBadge = item.href === '/hoje' && alertCount && alertCount > 0

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`bba-nav-item ${active ? 'bba-nav-item--active' : ''}`}
                title={item.description}
              >
                <Icon />
                <span>{item.label}</span>
                {showBadge && (
                  <span className="bba-nav-badge" aria-label={`${alertCount} alertas`}>
                    {alertCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* ── Divisor ── */}
        <div className="bba-sidebar__divider" />

        {/* ── Studios (capacidades de produto, mesmo nível para todas —
             ver docs/PLATFORM_ARCHITECTURE.md, seção 9.2) ── */}
        <div className="bba-nav-section">
          <span className="bba-nav-section-label">Studios</span>
          {NAV_STUDIOS.map((item) => {
            const Icon = item.icon

            if (!item.href) {
              return (
                <span className="bba-nav-item bba-nav-item--soon" key={item.label} title={item.description}>
                  <Icon />
                  <span>{item.label}</span>
                  <span className="bba-nav-item__soon-tag">em breve</span>
                </span>
              )
            }

            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`bba-nav-item ${active ? 'bba-nav-item--active' : ''}`}
                title={item.description}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* ── Divisor ── */}
        <div className="bba-sidebar__divider" />

        {/* ── Workspaces (navegação contextual, config-driven) ──
             O grupo de um Workspace só existe na Sidebar quando a rota
             atual está dentro do seu `basePath` — fora disso, nenhum
             grupo é renderizado (nem o próprio cabeçalho "Engenharia").
             Nenhum estado manual, nenhum clique de expandir/recolher: o
             App Router (via usePathname) é a única fonte de verdade.
             Adicionar um novo Workspace nunca exige editar este
             componente — apenas WORKSPACE_NAV_CONFIG. */}
        {WORKSPACE_NAV_CONFIG.filter((workspace) => pathname.startsWith(workspace.basePath)).map(
          (workspace) => {
            const WorkspaceIcon = workspace.icon

            return (
              <div className="bba-nav-workspace-group" key={workspace.id}>
                <Link href={workspace.basePath} className="bba-nav-item bba-nav-item--active">
                  <WorkspaceIcon />
                  <span>{workspace.label}</span>
                  <ChevronDown className="bba-nav-workspace-chevron bba-nav-workspace-chevron--open" />
                </Link>

                <div className="bba-nav-workspace-items">
                  {workspace.items.map((item) => {
                    const ItemIcon = item.icon

                    if (!item.href) {
                      return (
                        <span className="bba-nav-item bba-nav-subitem bba-nav-item--soon" key={item.label}>
                          <ItemIcon />
                          <span>{item.label}</span>
                          <span className="bba-nav-item__soon-tag">em breve</span>
                        </span>
                      )
                    }

                    const itemActive = pathname === item.href

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`bba-nav-item bba-nav-subitem ${itemActive ? 'bba-nav-item--active' : ''}`}
                      >
                        <ItemIcon />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          }
        )}

        {/* ── Divisor (só existe quando algum Workspace está aberto,
             evitando um divisor duplicado quando o grupo acima não
             renderiza nada) ── */}
        {WORKSPACE_NAV_CONFIG.some((workspace) => pathname.startsWith(workspace.basePath)) && (
          <div className="bba-sidebar__divider" />
        )}

        <div className="bba-nav-section">
          {NAV_SECONDARY.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`bba-nav-item ${active ? 'bba-nav-item--active' : ''}`}
                title={item.description}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* ── Divisor ── */}
        <div className="bba-sidebar__divider" />

        {/* ── Operacional (colapsável) ── */}
        <div style={{ padding: '0 10px' }}>
          <button
            className={`bba-nav-collapsible-trigger ${motorOpen ? 'bba-nav-collapsible-trigger--open' : ''}`}
            onClick={() => setMotorOpen(!motorOpen)}
            aria-expanded={motorOpen}
            aria-controls="motor-nav"
          >
            <Zap width={12} height={12} />
            <span>Operacional</span>
            <ChevronDown />
          </button>

          <div
            id="motor-nav"
            className={`bba-nav-collapsible-content ${motorOpen ? 'bba-nav-collapsible-content--open' : 'bba-nav-collapsible-content--closed'}`}
          >
            {NAV_MOTOR.map((item) => {
              const Icon = item.icon
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`bba-nav-item ${active ? 'bba-nav-item--active' : ''}`}
                  style={{ fontSize: '12px', minHeight: '36px' }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── Admin BBA (só para admins) ── */}
        {isAdmin && (
          <>
            <div className="bba-sidebar__divider" />
            <div style={{ padding: '0 10px' }}>
              <Link
                href="/admin"
                className={`bba-nav-item ${pathname.startsWith('/admin') ? 'bba-nav-item--active' : ''}`}
              >
                <Settings />
                <span>Admin BBA</span>
              </Link>
            </div>
          </>
        )}

      </nav>

      {/* ── Usuário + Logout ── */}
      <div className="bba-sidebar__user">
        <div className="bba-sidebar__avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="bba-sidebar__user-info">
          <span className="bba-sidebar__user-name">{userName || 'Usuário'}</span>
          {userEmail && (
            <span className="bba-sidebar__user-email">{userEmail}</span>
          )}
        </div>
        <button
          className="bba-sidebar__logout"
          onClick={handleLogout}
          title="Sair da conta"
          aria-label="Sair da conta"
        >
          <LogOut />
        </button>
      </div>

    </aside>
  )
}
