import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayLocalDate } from '@/lib/date'
import { signOut } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'

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
    .select('full_name')
    .eq('id', user.id)
    .single()

  const name = profile?.full_name?.trim() || 'usuario'

  // Has the user already logged today?
  const { data: todayLog } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('log_date', todayLocalDate())
    .maybeSingle()

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">¡Hola, {name}! 👋</h1>
          <p className="text-muted-foreground">Bienvenido a Kcal-culón.</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Cerrar sesión
          </Button>
        </form>
      </header>

      <div className="mt-8">
        <Button
          render={
            <Link href={todayLog ? `/day/${todayLog.id}` : '/day/new'} />
          }
        >
          {todayLog ? 'Ver día de hoy' : 'Registrar día de hoy'}
        </Button>
      </div>

      <p className="mt-8 text-muted-foreground">
        El resto de tu panel diario estará disponible próximamente.
      </p>
    </main>
  )
}
