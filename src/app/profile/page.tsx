import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/app-header'
import {
  ProfileSetupForm,
  type ProfileFormDefaults,
} from '@/components/profile/profile-setup-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Only the editable columns — control columns (is_admin, approved) are excluded.
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, gender, age, height_cm, current_weight_kg, target_weight, job_type, activity_level, goal, health_conditions, pathologies',
    )
    .eq('id', user.id)
    .single()

  const defaults: ProfileFormDefaults = {
    fullName: profile?.full_name ?? '',
    gender: profile?.gender ?? undefined,
    age: profile?.age ?? null,
    heightCm: profile?.height_cm ?? null,
    currentWeightKg: profile?.current_weight_kg ?? null,
    targetWeight: profile?.target_weight ?? null,
    jobType: profile?.job_type ?? undefined,
    activityLevel: profile?.activity_level ?? undefined,
    goal: profile?.goal ?? undefined,
    healthConditions: profile?.health_conditions ?? '',
    pathologies: profile?.pathologies ?? '',
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Mi perfil</h1>
          <p className="text-muted-foreground">
            Revisa y actualiza tus datos cuando lo necesites.
          </p>
        </header>
        <ProfileSetupForm mode="edit" defaults={defaults} />
      </main>
    </>
  )
}
