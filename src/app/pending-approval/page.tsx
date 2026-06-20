import { signOut } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Shown to authenticated users whose account has not been approved yet.
 * The proxy redirects every other protected route here until `approved`
 * becomes true (or the user is an admin).
 */
export default function PendingApprovalPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Cuenta pendiente</CardTitle>
          <CardDescription>
            Tu cuenta está pendiente de aprobación. Te avisaremos cuando puedas
            acceder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Si crees que es un error, vuelve a intentarlo más tarde o ponte en
            contacto con el administrador.
          </p>
        </CardContent>
        <CardFooter>
          <form action={signOut} className="w-full">
            <Button type="submit" variant="outline" className="w-full">
              Cerrar sesión
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  )
}
