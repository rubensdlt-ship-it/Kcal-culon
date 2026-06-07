'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
import { Button } from '@/components/ui/button'

export type ProgressLog = {
  id: string
  log_date: string
  weight_kg: number | null
  calorie_balance: number | null
  total_calories_consumed: number | null
  tdee_calories: number | null
}

const DEFICIT_COLOR = '#16a34a' // green-600
const SURPLUS_COLOR = '#dc2626' // red-600
const CONSUMED_COLOR = '#2563eb' // blue-600
const TDEE_COLOR = '#ea580c' // orange-600

const RANGES = [
  { key: '7', label: 'Últimos 7 días', days: 7 },
  { key: '30', label: '30 días', days: 30 },
  { key: '90', label: '90 días', days: 90 },
  { key: 'all', label: 'Todo', days: null },
] as const

type RangeKey = (typeof RANGES)[number]['key']

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

export function ProgressView({ logs }: { logs: ProgressLog[] }) {
  const [range, setRange] = useState<RangeKey>('30')

  // logs arrive ascending by date.
  const data = useMemo(() => {
    const def = RANGES.find((r) => r.key === range)!
    let filtered = logs
    if (def.days != null) {
      const cutoff = subtractDays(todayLocalDate(), def.days - 1)
      filtered = logs.filter((l) => l.log_date >= cutoff)
    }
    return filtered.map((l) => ({
      date: axisLabel(l.log_date),
      fullDate: fullLabel(l.log_date),
      weight: l.weight_kg != null ? Number(l.weight_kg) : null,
      balance: l.calorie_balance ?? 0,
      consumed: l.total_calories_consumed ?? 0,
      tdee: l.tdee_calories ?? 0,
    }))
  }, [logs, range])

  const enoughData = data.length >= 2
  const tooltipLabel = (_: unknown, payload: readonly { payload?: { fullDate?: string } }[]) =>
    payload?.[0]?.payload?.fullDate ?? ''

  return (
    <div className="grid gap-6">
      {/* Range filter */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            type="button"
            size="sm"
            variant={range === r.key ? 'default' : 'outline'}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {!enoughData ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Necesitas al menos 2 días registrados en este periodo para ver tus
            gráficas. ¡Sigue registrando tus días!
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Chart 1: Weight */}
          <Card>
            <CardHeader>
              <CardTitle>Evolución del peso</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis domain={['auto', 'auto']} fontSize={12} width={48} unit=" kg" />
                  <Tooltip
                    labelFormatter={tooltipLabel}
                    formatter={(value) => [`${value} kg`, 'Peso']}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    name="Peso"
                    stroke={CONSUMED_COLOR}
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Chart 2: Daily calorie balance */}
          <Card>
            <CardHeader>
              <CardTitle>Balance calórico diario</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} width={56} />
                  <Tooltip
                    labelFormatter={tooltipLabel}
                    formatter={(value) => {
                      const v = Number(value)
                      return [
                        `${v < 0 ? '−' : '+'}${formatInt(Math.abs(v))} kcal`,
                        v < 0 ? 'Déficit' : 'Superávit',
                      ]
                    }}
                  />
                  <Bar dataKey="balance" name="Balance">
                    {data.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.balance < 0 ? DEFICIT_COLOR : SURPLUS_COLOR}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Chart 3: Consumed vs TDEE */}
          <Card>
            <CardHeader>
              <CardTitle>Consumido vs Gasto</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} width={56} />
                  <Tooltip
                    labelFormatter={tooltipLabel}
                    formatter={(value, name) => [`${formatInt(Number(value))} kcal`, name]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="consumed"
                    name="Consumido"
                    stroke={CONSUMED_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tdee"
                    name="Gasto (TDEE)"
                    stroke={TDEE_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
