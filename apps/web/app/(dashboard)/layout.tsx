import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { Sidebar } from '@/components/sidebar'
import '../bba-globals.css'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    },
  )

  // ── Auth check ──
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // ── Dados do usuário ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', session.user.id)
    .single()

  // ── Contar alertas pendentes para o badge no "Hoje" ──
  // Usa dados reais que já existem: tarefas abertas + onboarding incompleto
  let alertCount = 0

  try {
    // Busca company_id do usuário
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('account_owner_id', session.user.id)
      .single()

    if (company) {
      // Tarefas abertas/atrasadas
      const { count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .in('status', ['open', 'overdue'])

      // Itens de onboarding incompletos
      const { count: onboardingCount } = await supabase
        .from('onboarding_checklist')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('completed', false)

      alertCount = (taskCount ?? 0) + (onboardingCount ?? 0)
      // Limita a 99 para o badge
      alertCount = Math.min(alertCount, 99)
    }
  } catch {
    // Falha silenciosa — badge simplesmente não aparece
    alertCount = 0
  }

  const isAdmin = profile?.role === 'bba_admin'

  return (
    <div className="bba-layout">

      <Sidebar
        userName={profile?.full_name ?? session.user.email ?? undefined}
        userEmail={session.user.email ?? undefined}
        isAdmin={isAdmin}
        alertCount={alertCount > 0 ? alertCount : undefined}
      />

      <main className="bba-main">
        {children}
      </main>

    </div>
  )
}
