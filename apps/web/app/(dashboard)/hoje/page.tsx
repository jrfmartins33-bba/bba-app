"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  fetchClientCompanyProfile,
  type ClientCompanyProfile,
  useBbaStore,
} from '@bba/lib'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getFirstName(fullName?: string | null): string {
  if (!fullName) return ''
  return fullName.split(' ')[0]
}

function formatDate(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

// ── Tipos ────────────────────────────────────────────────────────────────────

interface OnboardingItem {
  id: string
  completed: boolean
  category?: string
}

interface Task {
  id: string
  status: string
  due_date?: string | null
  title?: string
}

interface ClientCompany {
  trade_name?: string
  status?: string
  tax_regime?: string
  cnpj?: string
  city?: string
  state?: string
}

type ScoreSnapshot = {
  fiscal: number
  financeiro: number
  governanca: number
  operacional: number
  total: number
}

type ScoreBand = {
  label: 'Inicial' | 'Fundação' | 'Estrutura' | 'Crescimento' | 'Alta performance'
  summary: string
}

type RecommendedAction = {
  title: string
  lever: string
  reason: string
  impact: string
  benefit: string
  estimate: string
  cta: string
  href: string
  urgency: 'critico' | 'atencao' | 'info' | 'ok'
}

type AdvisorPoint = {
  label: string
  text: string
}

function isTaskOverdue(task: Task): boolean {
  if (task.status === 'done' || !task.due_date) return false

  const dueDate = new Date(`${task.due_date}T12:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return dueDate < today
}

function getScoreBand(score: number): ScoreBand {
  if (score >= 90) {
    return {
      label: 'Alta performance',
      summary: 'A empresa já tem base consistente para decisões recorrentes.',
    }
  }

  if (score >= 80) {
    return {
      label: 'Crescimento',
      summary: 'A base está madura, com poucos pontos limitando a evolução.',
    }
  }

  if (score >= 60) {
    return {
      label: 'Estrutura',
      summary: 'A operação tem fundamentos, mas ainda precisa fechar lacunas.',
    }
  }

  if (score >= 40) {
    return {
      label: 'Fundação',
      summary: 'A empresa está formando a base necessária para análises confiáveis.',
    }
  }

  return {
    label: 'Inicial',
    summary: 'Ainda faltam dados essenciais para um diagnóstico completo.',
  }
}

function getOpenTaskText(openTaskCount: number, overdueTaskCount: number): string {
  if (overdueTaskCount > 0) {
    return `${overdueTaskCount} rotina${overdueTaskCount > 1 ? 's' : ''} operacional${overdueTaskCount > 1 ? 'is' : ''} em atraso`
  }

  if (openTaskCount > 0) {
    return `${openTaskCount} rotina${openTaskCount > 1 ? 's' : ''} em acompanhamento`
  }

  return 'nenhuma rotina crítica aberta'
}

function getRecommendedAction({
  onboardingPct,
  overdueTaskCount,
  openTaskCount,
  clientCompany,
  score,
}: {
  onboardingPct: number
  overdueTaskCount: number
  openTaskCount: number
  clientCompany: ClientCompany | null
  score: ScoreSnapshot
}): RecommendedAction {
  if (overdueTaskCount > 0) {
    return {
      title: 'Resolver rotinas críticas em atraso',
      lever: 'resolver rotinas críticas',
      reason: `${overdueTaskCount} rotina${overdueTaskCount > 1 ? 's estão' : ' está'} em atraso.`,
      impact: 'Atrasos podem travar obrigações, respostas da BBA e rotinas críticas da empresa.',
      benefit: 'Reduz risco operacional e melhora a leitura diária do BBA Advisor.',
      estimate: overdueTaskCount > 1 ? '8 minutos' : '4 minutos',
      cta: 'Priorizar decisões críticas',
      href: '/tarefas',
      urgency: 'critico',
    }
  }

  if (onboardingPct < 50) {
    return {
      title: 'Falta concluir a base da empresa',
      lever: 'concluir base da empresa',
      reason: `Sua base está ${onboardingPct}% validada.`,
      impact: 'Dados ausentes podem limitar emissão de notas, cálculo correto de impostos e análises financeiras.',
      benefit: 'Libera um diagnóstico BBA mais confiável e aumenta o Score da empresa.',
      estimate: '4 minutos',
      cta: 'Liberar diagnóstico completo',
      href: '/cadastro-cliente',
      urgency: 'atencao',
    }
  }

  if (!clientCompany?.tax_regime || !clientCompany?.cnpj) {
    return {
      title: 'Validar dados fiscais essenciais',
      lever: 'validar dados fiscais essenciais',
      reason: 'CNPJ ou regime tributário ainda não estão completos na base atual.',
      impact: 'Sem esses dados, o BBA não consegue estimar obrigações e riscos fiscais com segurança.',
      benefit: 'Prepara a Agenda Tributária e melhora a precisão do Score Fiscal.',
      estimate: '3 minutos',
      cta: 'Liberar diagnóstico fiscal',
      href: '/cadastro-cliente',
      urgency: 'atencao',
    }
  }

  if (onboardingPct < 80) {
    return {
      title: 'Fechar lacunas do diagnóstico',
      lever: 'fechar lacunas da base',
      reason: `${100 - onboardingPct}% da configuração inicial ainda não foi concluída.`,
      impact: 'As lacunas reduzem a capacidade da BBA de antecipar riscos e orientar decisões.',
      benefit: 'Aumenta a governança e deixa o cockpit mais acionável.',
      estimate: '5 minutos',
      cta: 'Revisar oportunidades da base',
      href: '/onboarding',
      urgency: 'info',
    }
  }

  if (score.financeiro === 0) {
    return {
      title: 'Liberar visão financeira da empresa',
      lever: 'configurar caixa',
      reason: 'Ainda não há base suficiente para analisar caixa e previsibilidade financeira.',
      impact: 'Sem caixa estruturado, o BBA Advisor não consegue antecipar pressão de curto prazo.',
      benefit: 'Abre caminho para leitura de fluxo de caixa e decisões financeiras mais rápidas.',
      estimate: '6 minutos',
      cta: 'Organizar financeiro',
      href: '/financeiro',
      urgency: 'info',
    }
  }

  return {
    title: 'Manter a rotina executiva ativa',
    lever: 'manter rotina executiva',
    reason: openTaskCount > 0 ? `${openTaskCount} rotina${openTaskCount > 1 ? 's seguem' : ' segue'} em acompanhamento.` : 'A operação não tem bloqueios críticos no momento.',
    impact: 'A cadência diária evita que pequenos desvios virem risco operacional.',
    benefit: 'Mantém o cockpit confiável e pronto para decisões recorrentes.',
    estimate: '2 minutos',
    cta: 'Revisar rotina de hoje',
    href: openTaskCount > 0 ? '/tarefas' : '/hoje',
    urgency: 'ok',
  }
}

function getDiagnosticPhrase({
  scoreBand,
  onboardingPct,
  overdueTaskCount,
  openTaskCount,
  score,
}: {
  scoreBand: ScoreBand
  onboardingPct: number
  overdueTaskCount: number
  openTaskCount: number
  score: ScoreSnapshot
}): string {
  if (overdueTaskCount > 0) {
    return `Hoje existem ${overdueTaskCount} decisão${overdueTaskCount > 1 ? 'ões' : ''} importante${overdueTaskCount > 1 ? 's' : ''} para proteger a operação.`
  }

  if (onboardingPct < 50) {
    return `Sua empresa está em fase de ${scoreBand.label}.`
  }

  if (score.total < 60) {
    return 'Sua empresa está regular, mas ainda incompleta.'
  }

  if (openTaskCount > 1) {
    return `Hoje existem ${openTaskCount} pontos em acompanhamento para evoluir sua empresa.`
  }

  if (score.financeiro === 0) {
    return 'A base operacional está avançando, mas a leitura financeira ainda precisa ser liberada.'
  }

  return 'A empresa tem base suficiente para uma rotina executiva mais preditiva.'
}

function getScoreLosses({
  score,
  clientCompany,
  onboardingPct,
  overdueTaskCount,
}: {
  score: ScoreSnapshot
  clientCompany: ClientCompany | null
  onboardingPct: number
  overdueTaskCount: number
}): string[] {
  const losses: string[] = []

  if (!clientCompany?.tax_regime) {
    losses.push('Fiscal: regime tributário ainda não validado limita 30 pontos.')
  }

  if (!clientCompany?.cnpj) {
    losses.push('Fiscal: CNPJ ausente limita 30 pontos.')
  }

  if (score.financeiro === 0) {
    losses.push('Financeiro: ainda não há base de caixa para análise preditiva.')
  }

  if (onboardingPct < 100) {
    losses.push(`Governança: configuração inicial está ${onboardingPct}% concluída.`)
  }

  if (!clientCompany?.city || !clientCompany?.state) {
    losses.push('Operacional: endereço fiscal incompleto reduz a leitura da empresa.')
  }

  if (overdueTaskCount > 0) {
    losses.push(`Operacional: ${overdueTaskCount} rotina${overdueTaskCount > 1 ? 's em atraso reduzem' : ' em atraso reduz'} previsibilidade.`)
  }

  return losses.length > 0 ? losses.slice(0, 4) : ['Nenhuma perda relevante identificada com os dados disponíveis hoje.']
}

// ── Score simples calculado de dados existentes ───────────────────────────────

function calcScoreFromExistingData(
  clientCompany: ClientCompany | null,
  onboardingItems: OnboardingItem[],
  tasks: Task[],
): ScoreSnapshot {
  // FISCAL (0-100) — baseado em campos do client_companies
  let fiscal = 0
  if (clientCompany?.tax_regime) fiscal += 30
  if (clientCompany?.cnpj) fiscal += 30
  if (clientCompany?.status === 'active' || clientCompany?.status === 'Ativo') fiscal += 40

  // GOVERNANÇA (0-100) — baseado em onboarding_checklist
  const completed = onboardingItems.filter((i) => i.completed).length
  const total = onboardingItems.length
  const governanca = total > 0 ? Math.round((completed / total) * 100) : 0

  // OPERACIONAL (0-100) — baseado em rotinas e dados de cadastro
  let operacional = 0
  if (clientCompany?.trade_name) operacional += 25
  if (clientCompany?.city) operacional += 15
  if (clientCompany?.state) operacional += 10
  const overdueTasks = tasks.filter(isTaskOverdue).length
  operacional = Math.max(0, operacional + 50 - overdueTasks * 10)

  // FINANCEIRO (0-100) — placeholder: dados de caixa ainda não existem
  const financeiro = 0 // será calculado no Passo 5

  const totalScore = Math.round((fiscal + financeiro + governanca + operacional) / 4)

  return { fiscal, financeiro, governanca, operacional, total: totalScore }
}

// ── Componentes inline ────────────────────────────────────────────────────────

function PulseCard({
  question,
  status,
  statusText,
  impact,
  actionLabel,
  href,
  delay = 0,
}: {
  question: string
  status: 'green' | 'amber' | 'red' | 'muted'
  statusText: string
  impact: string
  actionLabel: string
  href: string
  delay?: number
}) {
  const statusMap = {
    green: { cls: 'bba-status--green' },
    amber: { cls: 'bba-status--amber' },
    red: { cls: 'bba-status--red' },
    muted: { cls: '' },
  }

  const s = { cls: statusMap[status].cls }

  return (
    <div
      className="bba-card bba-animate-in"
      style={{
        padding: '20px',
        display: 'grid',
        gap: '10px',
        animationDelay: `${delay}s`,
      }}
    >
      <span className="bba-label">{question}</span>
      <div className={`bba-status ${s.cls}`} style={{ width: 'fit-content' }}>
        <span className="bba-status__dot" />
        {statusText}
      </div>
      <div style={{ display: 'grid', gap: '8px' }}>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          {impact}
        </p>
        <Link href={href} className="bba-btn bba-btn--ghost" style={{ width: 'fit-content' }}>
          {actionLabel}
        </Link>
      </div>
    </div>
  )
}

function ScoreBar({
  label,
  value,
  max = 100,
  isPlaceholder = false,
}: {
  label: string
  value: number
  max?: number
  isPlaceholder?: boolean
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color =
    pct >= 80
      ? 'var(--status-green)'
      : pct >= 50
        ? 'var(--bba-gold)'
        : 'var(--status-amber)'

  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            color: 'var(--text-secondary)',
            fontSize: '12px',
          }}
        >
          {label}
        </span>
        <span
          style={{
            color: isPlaceholder ? 'var(--text-muted)' : color,
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          {isPlaceholder ? '—' : `${value} / ${max}`}
        </span>
      </div>
      <div className="bba-score-bar__track">
        {!isPlaceholder && (
          <div
            className="bba-score-bar__fill"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              boxShadow:
                pct > 0 ? `0 0 8px ${color}55` : 'none',
            }}
          />
        )}
        {isPlaceholder && (
          <div
            style={{
              width: '100%',
              height: '100%',
              background:
                'repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 3px, transparent 3px, transparent 8px)',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HojePage() {
  const profile = useBbaStore((state) => state.profile)
  const company = useBbaStore((state) => state.company)
  const storeTasks = useBbaStore((state) => state.tasks)
  const onboardingSteps = useBbaStore((state) => state.onboardingSteps)
  const [clientProfile, setClientProfile] =
    useState<ClientCompanyProfile | null>(null)
  const [scoreExpanded, setScoreExpanded] = useState(false)

  // ── Buscar dados reais ────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true

    if (!company.id) {
      setClientProfile(null)
      return () => {
        mounted = false
      }
    }

    void fetchClientCompanyProfile(company.id)
      .then((loadedProfile) => {
        if (mounted) {
          setClientProfile(loadedProfile)
        }
      })
      .catch(() => {
        if (mounted) {
          setClientProfile(null)
        }
      })

    return () => {
      mounted = false
    }
  }, [company.id])

  const clientCompany = useMemo<ClientCompany | null>(() => {
    if (!company.id) return null

    return {
      trade_name:
        clientProfile?.nome_fantasia || clientProfile?.razao_social || company.name,
      status: clientProfile?.status ?? 'active',
      tax_regime: clientProfile?.regime_tributario ?? company.tax_regime ?? undefined,
      cnpj: clientProfile?.cnpj ?? company.cnpj ?? undefined,
      city: clientProfile?.municipio_codigo_ibge ?? undefined,
      state: clientProfile?.uf_sigla ?? undefined,
    }
  }, [clientProfile, company])

  const onboardingItems: OnboardingItem[] = useMemo(
    () =>
      onboardingSteps.map((step) => ({
        id: step.id,
        completed: step.status === 'completed',
      })),
    [onboardingSteps],
  )
  const tasks: Task[] = useMemo(
    () => storeTasks.filter((task) => task.status !== 'done'),
    [storeTasks],
  )
  const openTaskCount = tasks.length
  const overdueTaskCount = tasks.filter(isTaskOverdue).length
  const onboardingDone = onboardingItems.filter((i) => i.completed).length
  const onboardingPct =
    onboardingItems.length > 0
      ? Math.round((onboardingDone / onboardingItems.length) * 100)
      : 0
  const onboardingPendingCount = Math.max(0, onboardingItems.length - onboardingDone)

  // ── Calcular score com dados reais ───────────────────────────────────────

  const score = calcScoreFromExistingData(clientCompany, onboardingItems, tasks)
  const scoreBand = getScoreBand(score.total)
  const recommendedAction = getRecommendedAction({
    onboardingPct,
    overdueTaskCount,
    openTaskCount,
    clientCompany,
    score,
  })
  const diagnosticPhrase = getDiagnosticPhrase({
    scoreBand,
    onboardingPct,
    overdueTaskCount,
    openTaskCount,
    score,
  })
  const scoreLosses = getScoreLosses({
    score,
    clientCompany,
    onboardingPct,
    overdueTaskCount,
  })

  // ── Determinar status do Radar ───────────────────────────────────────────

  const riskStatus = overdueTaskCount > 0 ? ('amber' as const) : ('green' as const)

  const caixaStatus = 'muted' as const

  const firstName = getFirstName(profile?.full_name)
  const companyName = clientCompany?.trade_name ?? company?.name ?? 'sua empresa'
  const advisorGreeting = firstName
    ? `${firstName}, analisei sua empresa agora.`
    : 'Analisei sua empresa agora.'
  const advisorPoints: AdvisorPoint[] = [
    {
      label: 'Base da empresa',
      text:
        onboardingPct > 0
          ? `Base ${onboardingPct}% validada; ${Math.max(0, 100 - onboardingPct)}% ainda limita a profundidade do diagnóstico.`
          : 'Ainda não há checklist de base suficiente para medir a configuração inicial.',
    },
    {
      label: 'Operação',
      text:
        overdueTaskCount > 0
          ? `${getOpenTaskText(openTaskCount, overdueTaskCount)} exigem decisão antes de avançar.`
          : `${getOpenTaskText(openTaskCount, overdueTaskCount)} no momento; a rotina está sem bloqueio em atraso.`,
    },
    {
      label: 'Caixa e impostos',
      text:
        score.financeiro === 0
          ? 'Ainda não tenho dados suficientes para analisar caixa; a leitura fiscal depende da base da empresa validada.'
          : 'A base financeira já permite iniciar uma leitura de previsibilidade.',
    },
  ]

  const urgenciaStyle = {
    critico: 'bba-card--red',
    atencao: 'bba-card--amber',
    info: 'bba-card--gold',
    ok: 'bba-card--green',
  }

  return (
    <div className="bba-page" style={{ paddingBottom: '48px' }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <header
        className="bba-animate-in"
        style={{
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--app-divider)',
          display: 'grid',
          gap: '4px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 700,
                marginBottom: '6px',
              }}
            >
              {formatDate()}
            </p>
            <h1
              style={{
                color: 'var(--text-primary)',
                fontSize: 'clamp(24px, 3vw, 34px)',
                fontWeight: 300,
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
              }}
            >
              {getGreeting()}{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                marginTop: '6px',
                fontWeight: 300,
              }}
            >
              {companyName}
            </p>
            <p
              style={{
                color: 'var(--bba-gold-soft)',
                fontSize: '13px',
                marginTop: '8px',
                lineHeight: 1.5,
                maxWidth: '560px',
              }}
            >
              {diagnosticPhrase}
            </p>
          </div>

          {/* Score total resumido no header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              background: 'var(--app-card)',
              border: '1px solid var(--app-border)',
              borderRadius: '6px',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: `conic-gradient(var(--bba-gold) ${score.total * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--app-bg)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--bba-gold)',
                }}
              >
                {score.total}
              </div>
            </div>
            <div>
              <span className="bba-eyebrow" style={{ marginBottom: '3px' }}>
                Score BBA
              </span>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '10px',
                  lineHeight: 1,
                }}
              >
                {scoreBand.label}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section
        className={`bba-card bba-card--highlight ${urgenciaStyle[recommendedAction.urgency]} bba-animate-in`}
        style={{
          padding: '24px',
          display: 'grid',
          gap: '18px',
          marginBottom: '28px',
          animationDelay: '0.05s',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'grid', gap: '8px', maxWidth: '720px' }}>
            <span className="bba-eyebrow">BBA Advisor</span>
            <h2
              style={{
                color: 'var(--text-primary)',
                fontSize: '20px',
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {advisorGreeting}
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                lineHeight: 1.6,
              }}
            >
              Encontrei 3 pontos que merecem atenção hoje, usando apenas os dados disponíveis no BBA App.
            </p>
          </div>
          <div
            className="bba-status bba-status--green"
            style={{ width: 'fit-content' }}
          >
            <span className="bba-status__dot" />
            Diagnóstico atualizado agora
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: '12px',
          }}
        >
          {advisorPoints.map((point) => (
            <div
              key={point.label}
              style={{
                padding: '14px',
                border: '1px solid var(--app-divider)',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.18)',
                display: 'grid',
                gap: '8px',
              }}
            >
              <span className="bba-label">{point.label}</span>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                {point.text}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            paddingTop: '4px',
            flexWrap: 'wrap',
          }}
        >
          <p
            style={{
              color: 'var(--text-primary)',
              fontSize: '14px',
              lineHeight: 1.55,
            }}
          >
            Minha recomendação: <strong>{recommendedAction.title}</strong>.
          </p>
          <Link href={recommendedAction.href} className="bba-btn bba-btn--primary">
            {recommendedAction.cta}
          </Link>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '11px',
              lineHeight: 1.5,
              flexBasis: '100%',
            }}
          >
            Se essa recomendação continuar aberta, o BBA Advisor acompanhará o impacto nos próximos dias.
          </p>
        </div>
      </section>

      {/* ── Pulso da Empresa ───────────────────────────────────────── */}
      <section style={{ marginBottom: '28px' }}>
        <span className="bba-eyebrow" style={{ marginBottom: '14px', display: 'block' }}>
          Pulso da Empresa
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
            gap: '12px',
          }}
        >
          <PulseCard
            question="Tenho dinheiro?"
            status={caixaStatus}
            statusText="Dados insuficientes"
            impact="Ainda não consigo prever seu fluxo de caixa porque entradas e saídas não estão estruturadas."
            actionLabel="Configurar caixa"
            href="/financeiro"
            delay={0.05}
          />
          <PulseCard
            question="Estou em risco?"
            status={riskStatus}
            statusText={riskStatus === 'green' ? 'Sob controle' : 'Atenção hoje'}
            impact={
              riskStatus === 'green'
                ? 'Nenhuma rotina em atraso foi identificada.'
                : `${overdueTaskCount} rotina${overdueTaskCount > 1 ? 's exigem' : ' exige'} decisão para reduzir risco operacional.`
            }
            actionLabel={
              riskStatus === 'green'
                ? 'Ver rotina'
                : 'Priorizar decisões'
            }
            href="/tarefas"
            delay={0.10}
          />
          <PulseCard
            question="Estou crescendo?"
            status={
              onboardingPct >= 80 && score.total >= 60
                ? 'green'
                : onboardingPct > 0
                  ? 'amber'
                  : 'muted'
            }
            statusText={
              onboardingPct >= 80 && score.total >= 60
                ? 'Base evoluindo'
                : 'Base em formação'
            }
            impact={
              onboardingPct < 100
                ? `A empresa está ${onboardingPct}% validada; falta base para um diagnóstico mais profundo.`
                : 'A base está validada e pronta para leituras executivas recorrentes.'
            }
            actionLabel={
              onboardingPct < 100
                ? 'Liberar diagnóstico completo'
                : 'Revisar Score'
            }
            href={onboardingPct < 100 ? '/cadastro-cliente' : '#score-bba'}
            delay={0.15}
          />
        </div>
      </section>

      {/* ── Grid principal: Decisão + Score ───────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '16px',
          marginBottom: '28px',
          alignItems: 'start',
        }}
      >

        {/* Decisão do Dia */}
        <div style={{ display: 'grid', gap: '12px' }}>
          <span className="bba-eyebrow">Decisão do Dia</span>

          <div
            className={`bba-card bba-card--highlight ${urgenciaStyle[recommendedAction.urgency]} bba-animate-in`}
            style={{ padding: '24px', display: 'grid', gap: '16px', animationDelay: '0.2s' }}
          >
            <div style={{ display: 'grid', gap: '8px' }}>
              <h2
                style={{
                  color: 'var(--text-primary)',
                  fontSize: '18px',
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {recommendedAction.title}
              </h2>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                {recommendedAction.reason} {recommendedAction.impact}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
                gap: '10px',
              }}
            >
              <div
                style={{
                  padding: '12px',
                  background: 'rgba(0,0,0,0.18)',
                  border: '1px solid var(--app-divider)',
                  borderRadius: '6px',
                }}
              >
                <span className="bba-label">Tempo estimado</span>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginTop: '6px' }}>
                  {recommendedAction.estimate}
                </strong>
              </div>
              <div
                style={{
                  padding: '12px',
                  background: 'rgba(0,0,0,0.18)',
                  border: '1px solid var(--app-divider)',
                  borderRadius: '6px',
                }}
              >
                <span className="bba-label">Impacto prático</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.45, marginTop: '6px' }}>
                  {recommendedAction.benefit}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link href={recommendedAction.href} className="bba-btn bba-btn--primary">
                {recommendedAction.cta}
              </Link>
              <Link href="/tarefas" className="bba-btn bba-btn--secondary">
                Revisar rotina operacional
              </Link>
            </div>
          </div>

          {/* Próximas obrigações (placeholder inteligente) */}
          <div
            className="bba-card bba-animate-in"
            style={{ padding: '20px 24px', animationDelay: '0.25s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span className="bba-eyebrow">Próximas obrigações</span>
              <Link
                href="/fiscal"
                style={{ color: 'var(--bba-gold-soft)', fontSize: '11px', fontWeight: 600 }}
              >
                Ver fiscal →
              </Link>
            </div>

            {/* Placeholder — dados de obrigações ainda não existem */}
            <div className="bba-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>
                Ainda faltam dados fiscais suficientes para prever obrigações com segurança. Isso importa porque o BBA só consegue antecipar DAS, FGTS e IRPJ quando a base fiscal está validada.
                <Link href="/fiscal"> Revisar rotina fiscal</Link>
              </span>
            </div>
          </div>

          {/* Rotina em acompanhamento */}
          {(openTaskCount > 0 || overdueTaskCount > 0) && (
            <div
              className="bba-card bba-animate-in"
              style={{ padding: '20px 24px', animationDelay: '0.3s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span className="bba-eyebrow">Rotina em acompanhamento</span>
                <Link href="/tarefas" style={{ color: 'var(--bba-gold-soft)', fontSize: '11px', fontWeight: 600 }}>
                  Ver rotina →
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  style={{
                    padding: '12px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--app-divider)',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '24px', fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {openTaskCount}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '4px', display: 'block' }}>
                    Em acompanhamento
                  </span>
                </div>
                <div
                  style={{
                    padding: '12px',
                    background: overdueTaskCount > 0 ? 'var(--status-red-bg)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${overdueTaskCount > 0 ? 'rgba(239,68,68,0.25)' : 'var(--app-divider)'}`,
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: '24px',
                      fontWeight: 300,
                      color: overdueTaskCount > 0 ? 'var(--status-red)' : 'var(--text-muted)',
                      lineHeight: 1,
                    }}
                  >
                    {overdueTaskCount}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '4px', display: 'block' }}>
                    Exigem decisão
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Score BBA ─────────────────────────────────────────── */}
        <div id="score-bba" style={{ display: 'grid', gap: '12px', scrollMarginTop: '24px' }}>
          <span className="bba-eyebrow">Score BBA</span>

          <div
            className="bba-card bba-animate-in"
            style={{ padding: '22px', display: 'grid', gap: '20px', animationDelay: '0.2s' }}
          >
            <div style={{ textAlign: 'center', paddingBottom: '18px', borderBottom: '1px solid var(--app-divider)' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  margin: '0 auto 12px',
                  borderRadius: '50%',
                  background: `conic-gradient(var(--bba-gold) ${score.total * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: `0 0 24px var(--bba-gold-glow)`,
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'var(--app-bg)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--bba-gold)', lineHeight: 1 }}>
                    {score.total}
                  </span>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                de 100 pontos
              </p>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--bba-gold-soft)',
                  fontSize: '14px',
                  marginTop: '8px',
                }}
              >
                Nível: {scoreBand.label}
              </strong>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  lineHeight: 1.45,
                  marginTop: '6px',
                }}
              >
                {scoreBand.summary}
              </p>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  lineHeight: 1.45,
                  marginTop: '10px',
                }}
              >
                Principal alavanca hoje: <strong>{recommendedAction.lever}</strong>.
              </p>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  lineHeight: 1.45,
                  marginTop: '6px',
                }}
              >
                Histórico de evolução será exibido quando houver leituras suficientes.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <ScoreBar label="Fiscal" value={score.fiscal} />
              <ScoreBar
                label="Financeiro"
                value={score.financeiro}
                isPlaceholder={true}
              />
              <ScoreBar label="Governança" value={score.governanca} />
              <ScoreBar label="Operacional" value={score.operacional} />
            </div>

            <button
              type="button"
              className="bba-btn bba-btn--ghost"
              onClick={() => setScoreExpanded((current) => !current)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {scoreExpanded ? 'Ocultar explicação' : 'Por que essa nota?'}
            </button>

            {scoreExpanded && (
              <div
                style={{
                  paddingTop: '16px',
                  borderTop: '1px solid var(--app-divider)',
                  display: 'grid',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'grid', gap: '8px' }}>
                  <span className="bba-label">Leitura por pilar</span>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.55 }}>
                    Fiscal mede CNPJ, regime e status. Financeiro ainda está sem base de caixa. Governança usa a configuração inicial. Operacional combina base da empresa, endereço e rotinas em atraso.
                  </p>
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <span className="bba-label">Principais perdas de pontos</span>
                  {scoreLosses.map((loss) => (
                    <p
                      key={loss}
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        lineHeight: 1.45,
                      }}
                    >
                      {loss}
                    </p>
                  ))}
                </div>

                <div
                  style={{
                    padding: '12px',
                    background: 'rgba(185,149,79,0.08)',
                    border: '1px solid var(--bba-gold-dim)',
                    borderRadius: '6px',
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  <span className="bba-label">Alavanca para ganhar pontos hoje</span>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
                    {recommendedAction.title}: {recommendedAction.benefit}
                  </p>
                  <Link href={recommendedAction.href} className="bba-btn bba-btn--ghost" style={{ width: '100%', justifyContent: 'center' }}>
                    {recommendedAction.cta}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Onboarding progress (se incompleto) ───────────────────── */}
      {onboardingPct < 100 && onboardingPct > 0 && (
        <section
          className="bba-card bba-animate-in"
          style={{ padding: '20px 24px', animationDelay: '0.35s' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <span className="bba-eyebrow" style={{ marginBottom: '6px' }}>
                Base para decisão
              </span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {onboardingPct}% concluído ·{' '}
                {onboardingPendingCount} {onboardingPendingCount === 1 ? 'oportunidade ainda limita' : 'oportunidades ainda limitam'} o diagnóstico
              </p>
            </div>
            <Link href="/onboarding" className="bba-btn bba-btn--ghost">
              Revisar oportunidades
            </Link>
          </div>
          <div style={{ marginTop: '14px' }}>
            <div className="bba-score-bar__track" style={{ height: '6px' }}>
              <div
                className="bba-score-bar__fill"
                style={{ width: `${onboardingPct}%` }}
              />
            </div>
          </div>
        </section>
      )}

      <section
        className={`bba-card bba-card--highlight ${urgenciaStyle[recommendedAction.urgency]} bba-animate-in`}
        style={{
          padding: '24px',
          display: 'grid',
          gap: '16px',
          animationDelay: '0.4s',
        }}
      >
        <span className="bba-eyebrow">Decisão recomendada</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: '14px',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: '8px' }}>
            <span className="bba-label">Decisão</span>
            <h2
              style={{
                color: 'var(--text-primary)',
                fontSize: '18px',
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {recommendedAction.title}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
              Motivo: {recommendedAction.reason}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
              Impacto prático: {recommendedAction.impact}
            </p>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <span className="bba-label">Benefício esperado</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
              {recommendedAction.benefit}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.5 }}>
              Se essa recomendação continuar aberta, o BBA Advisor acompanhará o impacto nos próximos dias.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '10px', justifyItems: 'start' }}>
            <span className="bba-label">Tempo estimado: {recommendedAction.estimate}</span>
            <Link href={recommendedAction.href} className="bba-btn bba-btn--primary">
              {recommendedAction.cta}
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
