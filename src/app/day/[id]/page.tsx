import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type Gender, type Intensity, type MealType } from '@/lib/calories'
import { AppHeader } from '@/components/app-header'
import { DayLogForm } from '@/components/day/day-log-form'

export default async function DayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // RLS already restricts to the owner; this also 404s on a bad id.
  const { data: log } = await supabase
    .from('daily_logs')
    .select(
      'id, log_date, weight_kg, hours_sedentary, hours_light, hours_sport, notes',
    )
    .eq('id', id)
    .single()

  if (!log) {
    notFound()
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('age, height_cm, gender')
    .eq('id', user.id)
    .single()

  if (!profile || profile.age == null || profile.height_cm == null) {
    redirect('/profile/setup')
  }

  const { data: activities } = await supabase
    .from('activities')
    .select('activity_name, duration_minutes, intensity')
    .eq('daily_log_id', id)

  const { data: meals } = await supabase
    .from('meals')
    .select('meal_type, food_name, portion_description, calories')
    .eq('daily_log_id', id)

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Día {log.log_date}</h1>
        <p className="text-muted-foreground">Edita y guarda los cambios.</p>
      </header>
      <DayLogForm
        mode="edit"
        logId={log.id}
        logDate={log.log_date}
        profile={{
          age: profile.age,
          heightCm: profile.height_cm,
          gender: (profile.gender ?? 'other') as Gender,
        }}
        initial={{
          weightKg: Number(log.weight_kg) || 0,
          hoursSedentary: Number(log.hours_sedentary) || 0,
          hoursLight: Number(log.hours_light) || 0,
          hoursSport: Number(log.hours_sport) || 0,
          notes: log.notes ?? '',
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
        }}
      />
      </main>
    </>
  )
}
