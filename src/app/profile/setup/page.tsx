import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileSetupForm } from '@/components/profile/profile-setup-form'

export default async function ProfileSetupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Completa tu perfil</h1>
        <p className="text-muted-foreground">
          Necesitamos algunos datos para calcular tus calorías diarias.
        </p>
      </header>
      <ProfileSetupForm defaultFullName={profile?.full_name ?? ''} />
    </main>
  )
}
