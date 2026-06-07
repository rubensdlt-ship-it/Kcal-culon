import { Badge } from '@/components/ui/badge'
import { formatInt } from '@/lib/format'

/**
 * Shared calorie-balance badge.
 *   balance < 0 → green DÉFICIT (good for weight loss)
 *   balance ≥ 0 → red SUPERÁVIT
 */
export function BalanceBadge({ balance }: { balance: number }) {
  const isDeficit = balance < 0
  return (
    <Badge className={isDeficit ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}>
      {isDeficit
        ? `DÉFICIT −${formatInt(Math.abs(balance))} kcal`
        : `SUPERÁVIT +${formatInt(balance)} kcal`}
    </Badge>
  )
}
