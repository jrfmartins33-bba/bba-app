'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Home,
  Building2,
  Wallet,
  FileText,
  Users,
  MessageSquare,
  ChevronDown,
  LogOut,
  Shield,
  Briefcase,
  ReceiptText,
  FileCheck2,
  DollarSign,
  Zap,
  Settings,
} from 'lucide-react'

interface SidebarProps {
  userName?: string
  userEmail?: string
  isAdmin?: boolean
  alertCount?: number
}

const NAV_MAIN = [
  {
    href: '/hoje',
    label: 'Hoje',
    icon: Home,
    description: 'Cockpit · Radar · Ações',
  },
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
  {
    href: '/bba',
    label: 'BBA',
    icon: MessageSquare,
    description: 'Consultor · Solicitações',
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
  const supabase = createClientComponentClient()
  const [motorOpen, setMotorOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/hoje') return pathname === '/hoje' || pathname === '/'
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
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
          <span className="bba-sidebar__brand-name">BBA App</span>
          <span className="bba-sidebar__brand-role">Portal do cliente</span>
        </div>
      </div>

      {/* ── Navegação principal ── */}
      <nav className="bba-sidebar__nav" aria-label="Navegação principal">

        <div className="bba-nav-section">
          {NAV_MAIN.map((item) => {
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
