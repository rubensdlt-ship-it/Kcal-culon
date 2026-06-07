'use client'

import { useRouter } from 'next/navigation'
import { formatShortDate } from '@/lib/date'
import { formatInt } from '@/lib/format'
import { BalanceBadge } from '@/components/day/balance-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type HistoryRow = {
  id: string
  log_date: string
  weight_kg: number | null
  total_calories_consumed: number | null
  tdee_calories: number | null
  calorie_balance: number | null
}

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const router = useRouter()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Peso (kg)</TableHead>
          <TableHead className="text-right">Consumidas</TableHead>
          <TableHead className="text-right">Gasto (TDEE)</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            className="cursor-pointer"
            tabIndex={0}
            role="link"
            onClick={() => router.push(`/day/${row.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                router.push(`/day/${row.id}`)
              }
            }}
          >
            <TableCell className="font-medium">
              {formatShortDate(row.log_date)}
            </TableCell>
            <TableCell className="text-right">
              {row.weight_kg != null ? formatInt(Number(row.weight_kg)) : '—'}
            </TableCell>
            <TableCell className="text-right">
              {formatInt(row.total_calories_consumed ?? 0)} kcal
            </TableCell>
            <TableCell className="text-right">
              {formatInt(row.tdee_calories ?? 0)} kcal
            </TableCell>
            <TableCell className="text-right">
              <BalanceBadge balance={row.calorie_balance ?? 0} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
