'use client'

import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { todayLocalDate } from '@/lib/date'
import { formatInt } from '@/lib/format'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { type ProgressLog } from '@/components/progress/progress-view'

const DEFICIT_COLOR = '#16a34a' // green-600
const SURPLUS_COLOR = '#dc2626' // red-600
const CONSUMED_COLOR = '#2563eb' // blue-600
const TDEE_COLOR = '#ea580c' // orange-600
const WEIGHT_COLOR = '#7c3aed' // violet-600

const DAYS = 30

/** Subtract n days from a YYYY-MM-DD date, returning YYYY-MM-DD. */
function subtractDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** "7 jun" — short axis label, no year. */
function axisLabel(isoDate: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(`${isoDate}T12:00:00Z`))
}

/** "7 jun 2026" — full date for tooltips. */
function fullLabel(isoDate: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(new Date(`${isoDate}T12:00:00Z`))
}

/**
 * Combined overview chart for the dashboard. Shares the same data source as the
 * Progreso charts (daily_logs). Last 30 days, with two Y axes because weight
 * (kg) and calories (kcal) live on different scales:
 *   - left  (kcal): consumed + TDEE as lines, daily balance as bars
 *   - right (kg):   weight as a line
 */
export function OverviewChart({ logs }: { logs: ProgressLog[] }) {
  // logs arrive ascending by date.
  const data = useMemo(() => {
    const cutoff = subtractDays(todayLocalDate(), DAYS - 1)
    return logs
      .filter((l) => l.log_date >= cutoff)
      .map((l) => ({
        date: axisLabel(l.log_date),
        fullDate: fullLabel(l.log_date),
        weight: l.weight_kg != null ? Number(l.weight_kg) : null,
        balance: l.calorie_balance ?? 0,
        consumed: l.total_calories_consumed ?? 0,
        tdee: l.tdee_calories ?? 0,
      }))
  }, [logs])

  const enoughData = data.length >= 2
  const tooltipLabel = (
    _: unknown,
    payload: readonly { payload?: { fullDate?: string } }[],
  ) => payload?.[0]?.payload?.fullDate ?? ''

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Resumen de los últimos 30 días</CardTitle>
      </CardHeader>
      <CardContent>
        {!enoughData ? (
          <p className="py-8 text-center text-muted-foreground">
            Necesitas al menos 2 días registrados para ver tu resumen. ¡Sigue
            registrando tus días!
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis
                yAxisId="kcal"
                fontSize={12}
                width={56}
                label={{ value: 'kcal', angle: -90, position: 'insideLeft', fontSize: 12 }}
              />
              <YAxis
                yAxisId="kg"
                orientation="right"
                domain={['auto', 'auto']}
                fontSize={12}
                width={48}
                unit=" kg"
              />
              <Tooltip
                labelFormatter={tooltipLabel}
                formatter={(value, name) =>
                  name === 'Peso'
                    ? [`${value} kg`, name]
                    : [`${formatInt(Number(value))} kcal`, name]
                }
              />
              <Legend />
              <Bar yAxisId="kcal" dataKey="balance" name="Balance">
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.balance < 0 ? DEFICIT_COLOR : SURPLUS_COLOR}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="kcal"
                type="monotone"
                dataKey="consumed"
                name="Consumido"
                stroke={CONSUMED_COLOR}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                yAxisId="kcal"
                type="monotone"
                dataKey="tdee"
                name="Gasto (TDEE)"
                stroke={TDEE_COLOR}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                yAxisId="kg"
                type="monotone"
                dataKey="weight"
                name="Peso"
                stroke={WEIGHT_COLOR}
                strokeWidth={2}
                connectNulls
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
