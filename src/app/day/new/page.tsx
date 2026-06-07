import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayLocalDate, formatLongDate } from '@/lib/date'
import { type Gender, type Intensity, type MealType } from '@/lib/calories'
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

  // Selected date from the query string. Default to today; never the future.
  const { date } = await searchParams
  const logDate = date && DATE_RE.test(date) && date <= today ? date : today

  // Load the log for the selected date (if any) — we edit it inline rather
  // than redirecting away, so the picker stays available.
  const { data: existing } = await supabase
    .from('daily_logs')
    .select(
      'id, weight_kg, hours_sedentary, hours_light, hours_sport, notes',
    )
    .eq('user_id', user.id)
    .eq('log_date', logDate)
    .maybeSingle()

  let mode: 'new' | 'edit' = 'new'
  let logId: string | undefined
  let initial

  if (existing) {
    mode = 'edit'
    logId = existing.id

    const { data: activities } = await supabase
      .from('activities')
      .select('activity_name, duration_minutes, intensity')
      .eq('daily_log_id', existing.id)

    const { data: meals } = await supabase
      .from('meals')
      .select('meal_type, food_name, portion_description, calories')
      .eq('daily_log_id', existing.id)

    initial = {
      weightKg: Number(existing.weight_kg) || 0,
      hoursSedentary: Number(existing.hours_sedentary) || 0,
      hoursLight: Number(existing.hours_light) || 0,
      hoursSport: Number(existing.hours_sport) || 0,
      notes: existing.notes ?? '',
      activities: (activities ?? []).map((a) => ({
        activityName: a.activity_name ?? '',
        durationMinutes: Number(a.duration_minutes) || 0,
        intensity: (a.intensity ?? 'moderate') as Intensity,
      })),
      meals: (meals ?? []).map((m) => ({
        mealType: m.meal_type as MealType,
        foodName: m.food_name ?? '',
        portionDescription: m.portion_description ?? '',
        calories: Number(m.calories) || 0,
      })),
    }
  } else {
    // Prefill weight: most recent logged weight on or before the selected
    // date, else the profile weight.
    const { data: lastLog } = await supabase
      .from('daily_logs')
      .select('weight_kg')
      .eq('user_id', user.id)
      .lte('log_date', logDate)
      .order('log_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const prefillWeight = lastLog?.weight_kg ?? profile.current_weight_kg ?? 0

    initial = {
      weightKg: Number(prefillWeight) || 0,
      hoursSedentary: 0,
      hoursLight: 0,
      hoursSport: 0,
      notes: '',
      activities: [],
      meals: [],
    }
  }

  const heading = existing
    ? `Editando el día ${formatLongDate(logDate)}`
    : logDate === today
      ? 'Registrar día de hoy'
      : `Registrar el día ${formatLongDate(logDate)}`

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold capitalize">{heading}</h1>
          <p className="text-muted-foreground">
            {existing
              ? 'Ya tienes datos para este día. Edítalos y guarda.'
              : 'Elige la fecha y registra tu día.'}
          </p>
        </header>

        <div className="mb-6">
          <DayDatePicker value={logDate} max={today} />
        </div>

        {/* key forces a fresh form (re-running its state initializers) whenever
            the selected date changes. */}
        <DayLogForm
          key={logDate}
          mode={mode}
          logId={logId}
          logDate={logDate}
          profile={{
            age: profile.age,
            heightCm: profile.height_cm,
            gender: (profile.gender ?? 'other') as Gender,
          }}
          initial={initial}
        />
      </main>
    </>
  )
}
