'use client'

import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Date picker for /day/new. Changing the date navigates to
 * /day/new?date=YYYY-MM-DD, where the server decides whether it's a new entry
 * or an existing log to edit. Future dates are blocked via `max` + a guard.
 */
export function DayDatePicker({ value, max }: { value: string; max: string }) {
  const router = useRouter()

  return (
    <div className="grid gap-2 sm:max-w-xs">
      <Label htmlFor="log-date">Fecha del día</Label>
      <Input
        id="log-date"
        type="date"
        value={value}
        max={max}
        onChange={(e) => {
          const next = e.target.value
          // Ignore empty or future dates.
          if (next && next <= max) {
            router.push(`/day/new?date=${next}`)
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        Puedes registrar hoy o cualquier día anterior.
      </p>
    </div>
  )
}
