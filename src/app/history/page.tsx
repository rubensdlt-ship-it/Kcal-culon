import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/app-header'
import { HistoryTable, type HistoryRow } from '@/components/history/history-table'

export default async function HistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // RLS restricts this to the user's own logs.
  const { data: logs } = await supabase
    .from('daily_logs')
    .select(
      'id, log_date, weight_kg, total_calories_consumed, tdee_calories, calorie_balance',
    )
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })

  const rows = (logs ?? []) as HistoryRow[]

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Historial</h1>
          <p className="text-muted-foreground">
            Todos tus días registrados, del más reciente al más antiguo.
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="text-muted-foreground">
            Todavía no tienes registros.
          </p>
        ) : (
          <div className="rounded-lg border">
            <HistoryTable rows={rows} />
          </div>
        )}
      </main>
    </>
  )
}
