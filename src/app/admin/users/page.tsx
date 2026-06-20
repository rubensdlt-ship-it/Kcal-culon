import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppHeader } from '@/components/app-header'
import { UsersTable, type AdminUserRow } from '@/components/admin/users-table'

export default async function AdminUsersPage() {
  // Only admins may see this page; anyone else is sent back to the dashboard.
  const admin = await getAdminUser()
  if (!admin) {
    redirect('/dashboard')
  }

  const supabase = createAdminClient()

  // Emails live in auth.users; the rest of the profile lives in public.profiles.
  const [{ data: authData }, { data: profiles }] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from('profiles').select('id, full_name, is_admin, approved'),
  ])

  const emailById = new Map(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? null]),
  )

  const rows: AdminUserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? null,
    full_name: p.full_name ?? null,
    is_admin: p.is_admin === true,
    approved: p.approved === true,
  }))

  // Pending users first; then alphabetically by email for a stable order.
  rows.sort((a, b) => {
    if (a.approved !== b.approved) return a.approved ? 1 : -1
    return (a.email ?? '').localeCompare(b.email ?? '')
  })

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Gestión de usuarios</h1>
          <p className="text-muted-foreground">
            Aprueba o revoca el acceso de los usuarios registrados.
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="text-muted-foreground">No hay usuarios todavía.</p>
        ) : (
          <UsersTable rows={rows} currentUserId={admin.id} />
        )}
      </main>
    </>
  )
}
