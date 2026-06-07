import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayLocalDate, formatLongDate } from '@/lib/date'
import { type Gender } from '@/lib/calories'
import { AppHeader } from '@/components/app-header'
import { DayLogForm } from '@/components/day/day-log-form'
import { DayDatePicker } from '@/components/day/day-date-picker'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function NewDayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('age, height_cm, gender, current_weight_kg')
    .eq('id', user.id)
    .single()

  if (!profile || profile.age == null || profile.height_cm == null) {
    redirect('/profile/setup')
  }

  const today = todayLocalDate()

  // Selected date from the query string. Default to today; never allow the
  // future or a malformed value.
  const { date } = await searchParams
  const logDate = date && DATE_RE.test(date) && date <= today ? date : today

  // If a log already exists for that date, edit it instead of duplicating.
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('log_date', logDate)
    .maybeSingle()

  if (existing) {
    redirect(`/day/${existing.id}`)
  }

  // Prefill weight: most recent logged weight on or before the selected date,
  // else the profile weight.
  const { data: lastLog } = await supabase
    .from('daily_logs')
    .select('weight_kg')
    .eq('user_id', user.id)
    .lte('log_date', logDate)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prefillWeight = lastLog?.weight_kg ?? profile.current_weight_kg ?? 0

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">
            {logDate === today ? 'Registrar día de hoy' : 'Registrar día'}
          </h1>
          <p className="text-muted-foreground capitalize">
            {formatLongDate(logDate)}
          </p>
        </header>

        <div className="mb-6">
          <DayDatePicker value={logDate} max={today} />
        </div>

        <DayLogForm
          mode="new"
          logDate={logDate}
          profile={{
            age: profile.age,
            heightCm: profile.height_cm,
            gender: (profile.gender ?? 'other') as Gender,
          }}
          initial={{
            weightKg: Number(prefillWeight) || 0,
            hoursSedentary: 0,
            hoursLight: 0,
            hoursSport: 0,
            notes: '',
            activities: [],
            meals: [],
          }}
        />
      </main>
    </>
  )
}
