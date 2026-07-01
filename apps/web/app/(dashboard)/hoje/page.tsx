import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
  due_date?: string
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

// ── Score simples calculado de dados existentes ───────────────────────────────

function calcScoreFromExistingData(
  clientCompany: ClientCompany | null,
  onboardingItems: OnboardingItem[],
  tasks: Task[],
): {
  fiscal: number
  financeiro: number
  governanca: number
  operacional: number
  total: number
} {
  // FISCAL (0-100) — baseado em campos do client_companies
  let fiscal = 0
  if (clientCompany?.tax_regime) fiscal += 30
  if (clientCompany?.cnpj) fiscal += 30
  if (clientCompany?.status === 'active' || clientCompany?.status === 'Ativo') fiscal += 40

  // GOVERNANÇA (0-100) — baseado em onboarding_checklist
  const completed = onboardingItems.filter((i) => i.completed).length
  const total = onboardingItems.length
  const governanca = total > 0 ? Math.round((completed / total) * 100) : 0

  // OPERACIONAL (0-100) — baseado em tarefas e dados de cadastro
  let operacional = 0
  if (clientCompany?.trade_name) operacional += 25
  if (clientCompany?.city) operacional += 15
  if (clientCompany?.state) operacional += 10
  const overdueTasks = tasks.filter((t) => t.status === 'overdue').length
  operacional = Math.max(0, operacional + 50 - overdueTasks * 10)

  // FINANCEIRO (0-100) — placeholder: dados de caixa ainda não existem
  const financeiro = 0 // será calculado no Passo 5

  const totalScore = Math.round((fiscal + financeiro + governanca + operacional) / 4)

  return { fiscal, financeiro, governanca, operacional, total: totalScore }
}

// ── Componentes inline ────────────────────────────────────────────────────────

function RadarCard({
  label,
  status,
  statusText,
  detail,
  delay = 0,
}: {
  label: string
  status: 'green' | 'amber' | 'red' | 'muted'
  statusText: string
  detail?: string
  delay?: number
}) {
  const statusMap = {
    green: { cls: 'bba-status--green', emoji: '🟢' },
    amber: { cls: 'bba-status--amber', emoji: '🟡' },
    red: { cls: 'bba-status--red', emoji: '🔴' },
    muted: { cls: '', emoji: '⚪' },
  }

  const s = statusMap[status]

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
      <span className="bba-label">{label}</span>
      <div className={`bba-status ${s.cls}`} style={{ width: 'fit-content' }}>
        <span className="bba-status__dot" />
        {statusText}
      </div>
      {detail && (
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '11px',
            lineHeight: 1.4,
          }}
        >
          {detail}
        </span>
      )}
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

export default async function HojePage() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  // ── Buscar dados reais ────────────────────────────────────────────────────

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', session.user.id)
    .single()

  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('account_owner_id', session.user.id)
    .single()

  let clientCompany: ClientCompany | null = null
  let onboardingItems: OnboardingItem[] = []
  let tasks: Task[] = []
  let openTaskCount = 0
  let overdueTaskCount = 0
  let onboardingPct = 0

  if (company) {
    // Client company data
    const { data: cc } = await supabase
      .from('client_companies')
      .select('trade_name, status, tax_regime, cnpj, city, state')
      .eq('company_id', company.id)
      .single()
    clientCompany = cc

    // Onboarding
    const { data: ob } = await supabase
      .from('onboarding_checklist')
      .select('id, completed, category')
      .eq('company_id', company.id)
    onboardingItems = ob ?? []
    const done = onboardingItems.filter((i) => i.completed).length
    onboardingPct =
      onboardingItems.length > 0
        ? Math.round((done / onboardingItems.length) * 100)
        : 0

    // Tasks
    const { data: ts } = await supabase
      .from('tasks')
      .select('id, status, due_date, title')
      .eq('company_id', company.id)
      .neq('status', 'completed')
    tasks = ts ?? []
    openTaskCount = tasks.filter((t) => t.status === 'open').length
    overdueTaskCount = tasks.filter((t) => t.status === 'overdue').length
  }

  // ── Calcular score com dados reais ───────────────────────────────────────

  const score = calcScoreFromExistingData(clientCompany, onboardingItems, tasks)

  // ── Determinar status do Radar ───────────────────────────────────────────

  const companyStatus =
    clientCompany?.status === 'active' || clientCompany?.status === 'Ativo'
      ? ('green' as const)
      : ('amber' as const)

  const riskStatus = overdueTaskCount > 0 ? ('amber' as const) : ('green' as const)

  // Caixa: placeholder — dados não existem ainda
  const caixaStatus = 'muted' as const

  // ── Ação mais importante do dia ──────────────────────────────────────────

  let acaoDoDia: {
    titulo: string
    descricao: string
    urgencia: 'critico' | 'atencao' | 'info'
    cta: string
    ctaHref: string
  } | null = null

  if (overdueTaskCount > 0) {
    acaoDoDia = {
      titulo: `${overdueTaskCount} tarefa${overdueTaskCount > 1 ? 's' : ''} em atraso`,
      descricao:
        overdueTaskCount > 1
          ? `Existem ${overdueTaskCount} tarefas vencidas. Atrasos podem gerar risco fiscal ou operacional.`
          : 'Existe 1 tarefa vencida. Resolva agora para manter a operação em dia.',
      urgencia: 'critico',
      cta: 'Ver tarefas em atraso',
      ctaHref: '/motor/tarefas',
    }
  } else if (onboardingPct < 50) {
    acaoDoDia = {
      titulo: 'Cadastro da empresa incompleto',
      descricao: `Seu cadastro está ${onboardingPct}% completo. Dados ausentes podem impedir emissão de notas e cálculo correto de impostos.`,
      urgencia: 'atencao',
      cta: 'Completar cadastro',
      ctaHref: '/motor/cadastro',
    }
  } else if (onboardingPct < 80) {
    acaoDoDia = {
      titulo: `${100 - onboardingPct}% do cadastro ainda falta`,
      descricao: `Complete o cadastro para ativar todos os módulos de monitoramento da BBA.`,
      urgencia: 'info',
      cta: 'Ver o que falta',
      ctaHref: '/motor/cadastro',
    }
  }

  const firstName = getFirstName(profile?.full_name)
  const companyName = clientCompany?.trade_name ?? company?.name ?? 'sua empresa'

  const urgenciaStyle = {
    critico: 'bba-card--red',
    atencao: 'bba-card--amber',
    info: 'bba-card--gold',
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
                de 100 pontos
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Radar ─────────────────────────────────────────────────── */}
      <section style={{ marginBottom: '28px' }}>
        <span className="bba-eyebrow" style={{ marginBottom: '14px', display: 'block' }}>
          Radar de hoje
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
          }}
        >
          <RadarCard
            label="Caixa"
            status={caixaStatus}
            statusText="Não configurado"
            detail="Configure entradas e saídas para monitorar seu fluxo."
            delay={0.05}
          />
          <RadarCard
            label="Risco Operacional"
            status={riskStatus}
            statusText={riskStatus === 'green' ? 'Regular' : `${overdueTaskCount} em atraso`}
            detail={
              riskStatus === 'green'
                ? 'Nenhuma tarefa vencida.'
                : 'Tarefas vencidas podem gerar risco fiscal.'
            }
            delay={0.10}
          />
          <RadarCard
            label="Empresa"
            status={companyStatus}
            statusText={
              companyStatus === 'green' ? 'Ativa e regular' : 'Verificar status'
            }
            detail={clientCompany?.tax_regime ?? 'Regime tributário não cadastrado'}
            delay={0.15}
          />
        </div>
      </section>

      {/* ── Grid principal: Ação + Score ──────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '16px',
          marginBottom: '28px',
          alignItems: 'start',
        }}
      >

        {/* Ação do dia */}
        <div style={{ display: 'grid', gap: '12px' }}>
          <span className="bba-eyebrow">Ação do dia</span>

          {acaoDoDia ? (
            <div
              className={`bba-card bba-card--highlight ${urgenciaStyle[acaoDoDia.urgencia]} bba-animate-in`}
              style={{ padding: '24px', display: 'grid', gap: '14px', animationDelay: '0.2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'grid',
                    placeItems: 'center',
                    background:
                      acaoDoDia.urgencia === 'critico'
                        ? 'var(--status-red-bg)'
                        : acaoDoDia.urgencia === 'atencao'
                          ? 'var(--status-amber-bg)'
                          : 'rgba(185,149,79,0.12)',
                    border: `1px solid ${acaoDoDia.urgencia === 'critico' ? 'rgba(239,68,68,0.3)' : acaoDoDia.urgencia === 'atencao' ? 'rgba(245,158,11,0.3)' : 'var(--bba-gold-dim)'}`,
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={acaoDoDia.urgencia === 'critico' ? 'var(--status-red)' : acaoDoDia.urgencia === 'atencao' ? 'var(--status-amber)' : 'var(--bba-gold)'}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <h2
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: '16px',
                      fontWeight: 600,
                      marginBottom: '6px',
                      lineHeight: 1.2,
                    }}
                  >
                    {acaoDoDia.titulo}
                  </h2>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      lineHeight: 1.55,
                    }}
                  >
                    {acaoDoDia.descricao}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link href={acaoDoDia.ctaHref} className="bba-btn bba-btn--primary">
                  {acaoDoDia.cta}
                </Link>
                <Link href="/motor/tarefas" className="bba-btn bba-btn--secondary">
                  Ver todas as tarefas
                </Link>
              </div>
            </div>
          ) : (
            <div
              className="bba-card bba-card--green bba-animate-in"
              style={{ padding: '24px', display: 'grid', gap: '10px', animationDelay: '0.2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--status-green-bg)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: '4px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>
                    Tudo em dia
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>
                    Nenhuma ação urgente identificada hoje.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Próximas obrigações (placeholder inteligente) */}
          <div
            className="bba-card bba-animate-in"
            style={{ padding: '20px 24px', animationDelay: '0.25s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span className="bba-eyebrow">Próximas obrigações</span>
              <Link
                href="/impostos"
                style={{ color: 'var(--bba-gold-soft)', fontSize: '11px', fontWeight: 600 }}
              >
                Ver agenda →
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
                Configure o módulo de impostos para monitorar DAS, FGTS e IRPJ automaticamente.
                <Link href="/impostos"> Configurar agenda tributária</Link>
              </span>
            </div>
          </div>

          {/* Resumo de tarefas */}
          {(openTaskCount > 0 || overdueTaskCount > 0) && (
            <div
              className="bba-card bba-animate-in"
              style={{ padding: '20px 24px', animationDelay: '0.3s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span className="bba-eyebrow">Tarefas</span>
                <Link href="/motor/tarefas" style={{ color: 'var(--bba-gold-soft)', fontSize: '11px', fontWeight: 600 }}>
                  Ver todas →
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
                    Em aberto
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
                    Atrasadas
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Score BBA ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gap: '12px' }}>
          <span className="bba-eyebrow">Score BBA</span>

          <div
            className="bba-card bba-animate-in"
            style={{ padding: '22px', display: 'grid', gap: '20px', animationDelay: '0.2s' }}
          >
            {/* Score total visual */}
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
            </div>

            {/* Pilares */}
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

            {/* Próximo passo */}
            {onboardingPct < 100 && (
              <div
                style={{
                  paddingTop: '16px',
                  borderTop: '1px solid var(--app-divider)',
                }}
              >
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '10px', lineHeight: 1.4 }}>
                  Para subir no score hoje:
                </p>
                <Link href="/motor/cadastro" className="bba-btn bba-btn--ghost" style={{ width: '100%', justifyContent: 'center' }}>
                  Completar cadastro +{Math.round((100 - onboardingPct) * 0.3)} pts
                </Link>
              </div>
            )}
          </div>

          {/* Placeholder IA BBA — Wave 2 */}
          <div
            className="bba-card bba-animate-in"
            style={{
              padding: '18px 20px',
              display: 'grid',
              gap: '10px',
              borderStyle: 'dashed',
              borderColor: 'rgba(185,149,79,0.2)',
              animationDelay: '0.3s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(185,149,79,0.1)',
                  border: '1px solid var(--bba-gold-dim)',
                  borderRadius: '4px',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--bba-gold)" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
              </div>
              <span style={{ color: 'var(--bba-gold-soft)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em' }}>
                BBA Advisor
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.5 }}>
              Análise inteligente da sua empresa — disponível em breve.
            </p>
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
                Configuração inicial
              </span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {onboardingPct}% concluído ·{' '}
                {onboardingItems.length - onboardingItems.filter((i) => i.completed).length} item
                {onboardingItems.length - onboardingItems.filter((i) => i.completed).length !== 1 ? 's' : ''}{' '}
                pendente
                {onboardingItems.length - onboardingItems.filter((i) => i.completed).length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link href="/motor/onboarding" className="bba-btn bba-btn--ghost">
              Continuar configuração
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

    </div>
  )
}
