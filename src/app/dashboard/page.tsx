import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayLocalDate, formatLongDate, formatShortDate } from '@/lib/date'
import { formatInt } from '@/lib/format'
import { calculateBMR, type Gender } from '@/lib/calories'
import { AppHeader } from '@/components/app-header'
import { BalanceBadge } from '@/components/day/balance-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, age, height_cm, gender, current_weight_kg')
    .eq('id', user.id)
    .single()

  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] || 'de nuevo'
  const today = todayLocalDate()

  // Today's log (if any).
  const { data: todayLog } = await supabase
    .from('daily_logs')
    .select('id, tdee_calories, total_calories_consumed, calorie_balance')
    .eq('user_id', user.id)
    .eq('log_date', today)
    .maybeSingle()

  // Last 7 logs for the cards + average balance.
  const { data: recentLogs } = await supabase
    .from('daily_logs')
    .select('id, log_date, weight_kg, calorie_balance')
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })
    .limit(7)

  const recent = recentLogs ?? []

  // Total days logged.
  const { count: totalDays } = await supabase
    .from('daily_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Quick stats.
  const latestWeight =
    recent[0]?.weight_kg ?? profile?.current_weight_kg ?? null
  const avgBalance =
    recent.length > 0
      ? recent.reduce((s, l) => s + (l.calorie_balance ?? 0), 0) / recent.length
      : null

  // BMR for today, using the most recent known weight.
  const canComputeBmr =
    latestWeight != null && profile?.height_cm != null && profile?.age != null
  const bmrToday = canComputeBmr
    ? Math.round(
        calculateBMR(
          Number(latestWeight),
          profile!.height_cm,
          profile!.age,
          (profile!.gender ?? 'other') as Gender,
        ),
      )
    : null

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">¡Hola, {firstName}! 👋</h1>
          <p className="text-muted-foreground capitalize">
            {formatLongDate(today)}
          </p>
        </header>

        {/* Today */}
        {todayLog ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Tu día de hoy</CardTitle>
              <CardDescription>Resumen de lo registrado hoy.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <span>
                  Consumidas:{' '}
                  <span className="font-medium">
                    {formatInt(todayLog.total_calories_consumed ?? 0)} kcal
                  </span>
                </span>
                <span>
                  Gasto (TDEE):{' '}
                  <span className="font-medium">
                    {formatInt(todayLog.tdee_calories ?? 0)} kcal
                  </span>
                </span>
              </div>
              <div>
                <BalanceBadge balance={todayLog.calorie_balance ?? 0} />
              </div>
              <div>
                <Button render={<Link href={`/day/${todayLog.id}`} />} variant="outline">
                  Editar día de hoy
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Registrar día de hoy</CardTitle>
              <CardDescription>
                Aún no has registrado tu día.
                {bmrToday != null
                  ? ` Tu BMR estimado de hoy: ${formatInt(bmrToday)} kcal.`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/day/new" />}>
                Registrar día de hoy
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="mb-8">
          <Button render={<Link href="/day/new" />} variant="outline">
            Registrar otro día
          </Button>
        </div>

        {/* Quick stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Peso actual"
            value={latestWeight != null ? `${formatInt(Number(latestWeight))} kg` : '—'}
          />
          <StatCard
            label="Balance medio (7 días)"
            value={
              avgBalance != null
                ? `${avgBalance < 0 ? '−' : '+'}${formatInt(Math.abs(avgBalance))} kcal`
                : '—'
            }
          />
          <StatCard label="Días registrados" value={formatInt(totalDays ?? 0)} />
        </div>

        {/* Últimos días */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Últimos días</h2>
            <Link href="/history" className="text-sm underline">
              Ver historial
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-muted-foreground">
              Todavía no tienes registros. ¡Empieza registrando tu día de hoy!
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recent.map((log) => (
                <Link
                  key={log.id}
                  href={`/day/${log.id}`}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{formatShortDate(log.log_date)}</p>
                      <p className="text-sm text-muted-foreground">
                        {log.weight_kg != null
                          ? `${formatInt(Number(log.weight_kg))} kg`
                          : 'Sin peso'}
                      </p>
                    </div>
                    <BalanceBadge balance={log.calorie_balance ?? 0} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
