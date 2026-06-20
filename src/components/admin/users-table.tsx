'use client'

import { useState, useTransition } from 'react'
import { setUserApproval } from '@/app/admin/users/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type AdminUserRow = {
  id: string
  email: string | null
  full_name: string | null
  is_admin: boolean
  approved: boolean
}

export function UsersTable({
  rows,
  currentUserId,
}: {
  rows: AdminUserRow[]
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateApproval = (userId: string, approved: boolean) => {
    setError(null)
    setBusyId(userId)
    startTransition(async () => {
      const result = await setUserApproval(userId, approved)
      if (result?.error) {
        setError(result.error)
      }
      setBusyId(null)
    })
  }

  return (
    <div className="grid gap-4">
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Correo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isSelf = row.id === currentUserId
            const rowBusy = isPending && busyId === row.id

            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.email ?? '—'}
                  {isSelf ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (tú)
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{row.full_name?.trim() || '—'}</TableCell>
                <TableCell>
                  {row.approved ? (
                    <Badge variant="default">Aprobado</Badge>
                  ) : (
                    <Badge variant="destructive">Pendiente</Badge>
                  )}
                </TableCell>
                <TableCell>{row.is_admin ? 'Sí' : 'No'}</TableCell>
                <TableCell className="text-right">
                  {row.approved ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSelf || rowBusy}
                      title={
                        isSelf
                          ? 'No puedes revocarte el acceso a ti mismo.'
                          : undefined
                      }
                      onClick={() => updateApproval(row.id, false)}
                    >
                      {rowBusy ? 'Guardando…' : 'Revocar'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={rowBusy}
                      onClick={() => updateApproval(row.id, true)}
                    >
                      {rowBusy ? 'Guardando…' : 'Aprobar'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
