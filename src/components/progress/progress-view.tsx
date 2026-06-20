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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { todayLocalDate } from '@/lib/date'
import {
  formatInt,
  formatDecimal,
  formatSignedKg,
  formatSignedKcal,
} from '@/lib/format'
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
const MA_COLOR = '#7c3aed' // violet-600
const TARGET_COLOR = '#16a34a' // green-600

const KCAL_PER_KG = 7700
const MA_WINDOW = 7

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

/** Whole days between two YYYY-MM-DD dates (b - a). */
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T12:00:00Z`).getTime() -
      new Date(`${a}T12:00:00Z`).getTime()) /
      86_400_000,
  )
}

/** "7 jun" — short axis label, no year. */
function axisLabel(isoDate: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(`${isoDate}T12:00:00Z`))
}

/** "7 jun 2026" — full date for tooltips and projections. */
function fullLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00Z`) : date
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(d)
}

type Projection =
  | { type: 'reached' }
  | { type: 'unreachable' }
  | { type: 'too_slow' }
  | { type: 'date'; date: Date; days: number }

export function ProgressView({
  logs,
  targetWeight,
}: {
  logs: ProgressLog[]
  targetWeight: number | null
}) {
  const [range, setRange] = useState<RangeKey>('30')

  // ---- Full-history metrics (independent of the selected range) ----
  const stats = useMemo(() => {
    const weighed = logs
      .filter((l) => l.weight_kg != null)
      .map((l) => Number(l.weight_kg))

    const firstWeight = weighed[0] ?? null
    const currentWeight = weighed[weighed.length - 1] ?? null
    const minWeight = weighed.length ? Math.min(...weighed) : null

    const totalLogged = logs.length
    const balances = logs.map((l) => l.calorie_balance ?? 0)
    const accumulatedBalance = balances.reduce((s, b) => s + b, 0)
    const accumulatedFatKg = accumulatedBalance / KCAL_PER_KG

    const deficitDays = balances.filter((b) => b < 0).length
    const deficitPct = totalLogged ? (deficitDays / totalLogged) * 100 : null

    // Current streak of consecutive deficit days (most recent first).
    let deficitStreak = 0
    for (let i = logs.length - 1; i >= 0; i--) {
      if ((logs[i].calorie_balance ?? 0) < 0) deficitStreak++
      else break
    }

    // Biggest single-day deficit = most negative balance.
    const biggestDeficit = balances.length ? Math.min(...balances) : null

    // Constancy: logged days vs elapsed days since the first record.
    let constancyPct: number | null = null
    if (logs.length) {
      const elapsed = daysBetween(logs[0].log_date, todayLocalDate()) + 1
      constancyPct = elapsed > 0 ? Math.min(100, (totalLogged / elapsed) * 100) : null
    }

    // Recent average balance (last 7 logs) for the projection.
    const recent = logs.slice(-MA_WINDOW)
    const avgRecentBalance = recent.length
      ? recent.reduce((s, l) => s + (l.calorie_balance ?? 0), 0) / recent.length
      : null

    return {
      firstWeight,
      currentWeight,
      minWeight,
      totalLogged,
      accumulatedBalance,
      accumulatedFatKg,
      deficitPct,
      deficitStreak,
      biggestDeficit,
      constancyPct,
      avgRecentBalance,
    }
  }, [logs])

  // ---- Goal progress + projection ----
  const goal = useMemo(() => {
    if (targetWeight == null) return null
    const { firstWeight, currentWeight, avgRecentBalance } = stats
    if (currentWeight == null) {
      return { remainingKg: null, progressPct: null, projection: null }
    }

    const remainingKg = currentWeight - targetWeight // >0 lose, <0 gain
    const reached = Math.abs(remainingKg) < 0.05

    let progressPct: number | null = null
    if (firstWeight != null && firstWeight !== targetWeight) {
      const total = firstWeight - targetWeight
      const done = firstWeight - currentWeight
      progressPct = Math.max(0, Math.min(100, (done / total) * 100))
    }

    let projection: Projection
    if (reached) {
      projection = { type: 'reached' }
    } else if (avgRecentBalance == null) {
      projection = { type: 'unreachable' }
    } else {
      const dailyChangeKg = avgRecentBalance / KCAL_PER_KG // <0 = losing
      const days =
        dailyChangeKg !== 0
          ? (targetWeight - currentWeight) / dailyChangeKg
          : Infinity
      if (!Number.isFinite(days) || days <= 0) {
        projection = { type: 'unreachable' }
      } else if (days > 3650) {
        projection = { type: 'too_slow' }
      } else {
        const d = new Date(`${todayLocalDate()}T12:00:00Z`)
        d.setUTCDate(d.getUTCDate() + Math.ceil(days))
        projection = { type: 'date', date: d, days: Math.ceil(days) }
      }
    }

    return { remainingKg, progressPct, projection }
  }, [targetWeight, stats])

  // ---- Range-filtered chart data + 7-day moving average ----
  const data = useMemo(() => {
    const def = RANGES.find((r) => r.key === range)!
    let filtered = logs
    if (def.days != null) {
      const cutoff = subtractDays(todayLocalDate(), def.days - 1)
      filtered = logs.filter((l) => l.log_date >= cutoff)
    }
    const base = filtered.map((l) => ({
      date: axisLabel(l.log_date),
      fullDate: fullLabel(l.log_date),
      weight: l.weight_kg != null ? Number(l.weight_kg) : null,
      balance: l.calorie_balance ?? 0,
      consumed: l.total_calories_consumed ?? 0,
      tdee: l.tdee_calories ?? 0,
    }))
    // Trailing 7-point moving average of weight.
    return base.map((d, i, arr) => {
      const start = Math.max(0, i - (MA_WINDOW - 1))
      const window = arr
        .slice(start, i + 1)
        .map((x) => x.weight)
        .filter((w): w is number => w != null)
      return {
        ...d,
        weightMA: window.length
          ? window.reduce((s, w) => s + w, 0) / window.length
          : null,
      }
    })
  }, [logs, range])

  // Y-axis domain for the weight chart, made to include the target line.
  const weightDomain = useMemo<[number, number] | ['auto', 'auto']>(() => {
    const vals = data
      .flatMap((d) => [d.weight, d.weightMA])
      .filter((v): v is number => v != null)
    if (targetWeight != null) vals.push(targetWeight)
    if (!vals.length) return ['auto', 'auto']
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = Math.max(1, (max - min) * 0.1)
    return [Math.floor(min - pad), Math.ceil(max + pad)]
  }, [data, targetWeight])

  const enoughData = data.length >= 2
  const tooltipLabel = (
    _: unknown,
    payload: readonly { payload?: { fullDate?: string } }[],
  ) => payload?.[0]?.payload?.fullDate ?? ''

  return (
    <div className="grid gap-6">
      {/* Goal progress */}
      <Card>
        <CardHeader>
          <CardTitle>Progreso hacia el objetivo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {targetWeight == null ? (
            <p className="text-muted-foreground">
              Aún no has fijado un peso objetivo. Puedes establecerlo en tu
              perfil para ver tu progreso y una estimación de fecha.
            </p>
          ) : stats.currentWeight == null ? (
            <p className="text-muted-foreground">
              Registra tu peso para ver tu progreso hacia el objetivo de{' '}
              {formatDecimal(targetWeight)} kg.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Objetivo" value={`${formatDecimal(targetWeight)} kg`} />
                <Stat
                  label="Te faltan"
                  value={
                    goal!.remainingKg != null && Math.abs(goal!.remainingKg) >= 0.05
                      ? `${formatDecimal(Math.abs(goal!.remainingKg))} kg`
                      : '¡Conseguido! 🎉'
                  }
                  hint={
                    goal!.remainingKg != null && Math.abs(goal!.remainingKg) >= 0.05
                      ? goal!.remainingKg > 0
                        ? 'por perder'
                        : 'por ganar'
                      : undefined
                  }
                />
                <Stat
                  label="Recorrido"
                  value={
                    goal!.progressPct != null
                      ? `${formatDecimal(goal!.progressPct, 0)} %`
                      : '—'
                  }
                  hint="desde el peso inicial"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {goal!.projection?.type === 'reached'
                  ? '¡Has alcanzado tu objetivo! 🎉'
                  : goal!.projection?.type === 'date'
                    ? `Proyección: alcanzarías tu objetivo hacia el ${fullLabel(
                        goal!.projection.date,
                      )} (en ~${formatInt(goal!.projection.days)} días), al ritmo actual.`
                    : goal!.projection?.type === 'too_slow'
                      ? 'A tu ritmo actual la fecha estimada queda demasiado lejos para ser fiable.'
                      : 'Tu balance calórico reciente no te acerca al objetivo, así que no podemos estimar una fecha.'}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Summary metrics (full history) */}
      {stats.totalLogged > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Balance acumulado"
            value={formatSignedKcal(stats.accumulatedBalance)}
            hint={`≈ ${formatSignedKg(stats.accumulatedFatKg)} de grasa · desde el primer registro`}
          />
          <Stat
            label="Días en déficit"
            value={
              stats.deficitPct != null
                ? `${formatDecimal(stats.deficitPct, 0)} %`
                : '—'
            }
            hint="adherencia"
          />
          <Stat
            label="Racha en déficit"
            value={`${stats.deficitStreak} ${
              stats.deficitStreak === 1 ? 'día' : 'días'
            }`}
            hint="días consecutivos"
          />
          <Stat
            label="Constancia"
            value={
              stats.constancyPct != null
                ? `${formatDecimal(stats.constancyPct, 0)} %`
                : '—'
            }
            hint="días registrados vs transcurridos"
          />
          <Stat
            label="Peso mínimo"
            value={
              stats.minWeight != null ? `${formatDecimal(stats.minWeight)} kg` : '—'
            }
          />
          <Stat
            label="Mayor déficit en un día"
            value={
              stats.biggestDeficit != null && stats.biggestDeficit < 0
                ? `−${formatInt(Math.abs(stats.biggestDeficit))} kcal`
                : '—'
            }
          />
          <Stat label="Días registrados" value={formatInt(stats.totalLogged)} />
        </div>
      ) : null}

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
          {/* Chart 1: Weight + 7-day moving average + target line */}
          <Card>
            <CardHeader>
              <CardTitle>Evolución del peso</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis domain={weightDomain} fontSize={12} width={48} unit=" kg" />
                  <Tooltip
                    labelFormatter={tooltipLabel}
                    formatter={(value, name) => [
                      value != null ? `${formatDecimal(Number(value))} kg` : '—',
                      name,
                    ]}
                  />
                  <Legend />
                  {targetWeight != null ? (
                    <ReferenceLine
                      y={targetWeight}
                      stroke={TARGET_COLOR}
                      strokeDasharray="6 4"
                      label={{
                        value: `Objetivo ${formatDecimal(targetWeight)} kg`,
                        position: 'insideTopRight',
                        fontSize: 11,
                        fill: TARGET_COLOR,
                      }}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="weight"
                    name="Peso"
                    stroke={CONSUMED_COLOR}
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weightMA"
                    name="Media móvil (7 días)"
                    stroke={MA_COLOR}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    connectNulls
                    dot={false}
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

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
