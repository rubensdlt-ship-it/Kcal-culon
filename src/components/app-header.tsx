import Link from 'next/link'
import { signOut } from '@/app/auth/actions'
import { getAdminUser } from '@/lib/auth/admin'
import { Button } from '@/components/ui/button'

/** Top navigation bar for the authenticated app pages. */
export async function AppHeader() {
  const isAdmin = (await getAdminUser()) !== null

  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold">
            Kcal-culón
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Inicio
            </Link>
            <Link href="/history" className="text-muted-foreground hover:text-foreground">
              Historial
            </Link>
            <Link href="/progreso" className="text-muted-foreground hover:text-foreground">
              Progreso
            </Link>
            <Link href="/profile" className="text-muted-foreground hover:text-foreground">
              Mi perfil
            </Link>
            {isAdmin ? (
              <Link
                href="/admin/users"
                className="text-muted-foreground hover:text-foreground"
              >
                Gestión de usuarios
              </Link>
            ) : null}
          </div>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Cerrar sesión
          </Button>
        </form>
      </nav>
    </header>
  )
}
