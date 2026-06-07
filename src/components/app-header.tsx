import Link from 'next/link'
import { signOut } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'

/** Top navigation bar for the authenticated app pages. */
export function AppHeader() {
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
