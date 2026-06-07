import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayLocalDate } from '@/lib/date'
import { type Gender } from '@/lib/calories'
import { DayLogForm } from '@/components/day/day-log-form'

export default async function NewDayPage() {
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

  const logDate = todayLocalDate()

  // If today's log already exists, edit it instead of creating a duplicate.
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('log_date', logDate)
    .maybeSingle()

  if (existing) {
    redirect(`/day/${existing.id}`)
  }

  // Prefill weight: most recent logged weight, else the profile weight.
  const { data: lastLog } = await supabase
    .from('daily_logs')
    .select('weight_kg')
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prefillWeight =
    lastLog?.weight_kg ?? profile.current_weight_kg ?? 0

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Registrar día de hoy</h1>
        <p className="text-muted-foreground">{logDate}</p>
      </header>
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
  )
}
