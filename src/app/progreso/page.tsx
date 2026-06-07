import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/app-header'
import { ProgressView, type ProgressLog } from '@/components/progress/progress-view'

export default async function ProgresoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // RLS restricts this to the user's own logs. Ascending for the charts.
  const { data: logs } = await supabase
    .from('daily_logs')
    .select(
      'id, log_date, weight_kg, calorie_balance, total_calories_consumed, tdee_calories',
    )
    .eq('user_id', user.id)
    .order('log_date', { ascending: true })

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Progreso</h1>
          <p className="text-muted-foreground">
            Tu evolución a lo largo del tiempo.
          </p>
        </header>
        <ProgressView logs={(logs ?? []) as ProgressLog[]} />
      </main>
    </>
  )
}
