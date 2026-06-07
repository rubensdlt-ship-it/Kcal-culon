'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { saveDayLog, type SaveDayLogInput } from '@/app/day/actions'
import {
  type Gender,
  type Intensity,
  type MealType,
  INTENSITY_LABELS,
  MEAL_TYPES,
  activityCalories,
  calculateBMR,
  calculateTDEE,
  calorieBalance,
} from '@/lib/calories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ActivityRow = {
  key: number
  activityName: string
  durationMinutes: string
  intensity: Intensity
}

type MealRow = {
  key: number
  mealType: MealType
  foodName: string
  portionDescription: string
  calories: string
}

export type DayLogFormProps = {
  mode: 'new' | 'edit'
  logId?: string
  logDate: string
  profile: { age: number; heightCm: number; gender: Gender }
  initial: {
    weightKg: number
    hoursSedentary: number
    hoursLight: number
    hoursSport: number
    notes: string
    activities: { activityName: string; durationMinutes: number; intensity: Intensity }[]
    meals: {
      mealType: MealType
      foodName: string
      portionDescription: string
      calories: number
    }[]
  }
}

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES')

export function DayLogForm({
  mode,
  logId,
  logDate,
  profile,
  initial,
}: DayLogFormProps) {
  const keyCounter = useRef(0)
  const nextKey = () => ++keyCounter.current

  const [weight, setWeight] = useState(
    initial.weightKg ? String(initial.weightKg) : '',
  )
  const [hoursSedentary, setHoursSedentary] = useState(initial.hoursSedentary)
  const [hoursLight, setHoursLight] = useState(initial.hoursLight)
  const [hoursSport, setHoursSport] = useState(initial.hoursSport)
  const [notes, setNotes] = useState(initial.notes)

  const [activities, setActivities] = useState<ActivityRow[]>(() =>
    initial.activities.map((a) => ({
      key: nextKey(),
      activityName: a.activityName,
      durationMinutes: String(a.durationMinutes),
      intensity: a.intensity,
    })),
  )
  const [meals, setMeals] = useState<MealRow[]>(() =>
    initial.meals.map((m) => ({
      key: nextKey(),
      mealType: m.mealType,
      foodName: m.foodName,
      portionDescription: m.portionDescription,
      calories: String(m.calories),
    })),
  )

  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const weightNum = Number(weight) || 0

  // --- Live calculations ---
  const bmr = useMemo(
    () =>
      weightNum > 0
        ? calculateBMR(weightNum, profile.heightCm, profile.age, profile.gender)
        : 0,
    [weightNum, profile.heightCm, profile.age, profile.gender],
  )

  const activityCals = useMemo(
    () =>
      activities.map((a) =>
        weightNum > 0 && Number(a.durationMinutes) > 0
          ? activityCalories(a.intensity, weightNum, Number(a.durationMinutes))
          : 0,
      ),
    [activities, weightNum],
  )
  const totalActivityCalories = activityCals.reduce((s, c) => s + c, 0)
  const tdee = calculateTDEE(bmr, totalActivityCalories)

  const totalConsumed = useMemo(
    () => meals.reduce((s, m) => s + (Number(m.calories) || 0), 0),
    [meals],
  )
  const balance = calorieBalance(totalConsumed, tdee)
  const isDeficit = balance < 0

  // --- Activity row handlers ---
  const addActivity = () =>
    setActivities((prev) => [
      ...prev,
      { key: nextKey(), activityName: '', durationMinutes: '', intensity: 'moderate' },
    ])
  const updateActivity = (key: number, patch: Partial<ActivityRow>) =>
    setActivities((prev) =>
      prev.map((a) => (a.key === key ? { ...a, ...patch } : a)),
    )
  const removeActivity = (key: number) =>
    setActivities((prev) => prev.filter((a) => a.key !== key))

  // --- Meal row handlers ---
  const addMeal = (mealType: MealType) =>
    setMeals((prev) => [
      ...prev,
      {
        key: nextKey(),
        mealType,
        foodName: '',
        portionDescription: '',
        calories: '',
      },
    ])
  const updateMeal = (key: number, patch: Partial<MealRow>) =>
    setMeals((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)))
  const removeMeal = (key: number) =>
    setMeals((prev) => prev.filter((m) => m.key !== key))

  const mealSubtotal = (mealType: MealType) =>
    meals
      .filter((m) => m.mealType === mealType)
      .reduce((s, m) => s + (Number(m.calories) || 0), 0)

  // --- Save ---
  const handleSave = () => {
    setError(null)
    if (weightNum <= 0) {
      setError('Introduce un peso válido para hoy.')
      return
    }
    const payload: SaveDayLogInput = {
      logId,
      logDate,
      weightKg: weightNum,
      hoursSedentary,
      hoursLight,
      hoursSport,
      notes,
      activities: activities.map((a) => ({
        activityName: a.activityName,
        durationMinutes: Number(a.durationMinutes) || 0,
        intensity: a.intensity,
      })),
      meals: meals.map((m) => ({
        mealType: m.mealType,
        foodName: m.foodName,
        portionDescription: m.portionDescription,
        calories: Number(m.calories) || 0,
      })),
    }
    startTransition(async () => {
      const res = await saveDayLog(payload)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <div className="grid gap-6">
      {/* 1. Peso de hoy */}
      <Card>
        <CardHeader>
          <CardTitle>Peso de hoy</CardTitle>
          <CardDescription>Tu peso de hoy ajusta tu BMR.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="weight">Peso (kg)</Label>
          <Input
            id="weight"
            type="number"
            step="0.1"
            min={20}
            max={400}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Tu BMR hoy: <span className="font-medium text-foreground">{fmt(bmr)} kcal</span>
          </p>
        </CardContent>
      </Card>

      {/* 2. Actividad */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad</CardTitle>
          <CardDescription>Distribución de tus horas y actividades.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <HourSlider
            label="Horas sedentario"
            value={hoursSedentary}
            onChange={setHoursSedentary}
          />
          <HourSlider
            label="Horas actividad ligera"
            value={hoursLight}
            onChange={setHoursLight}
          />
          <HourSlider
            label="Horas deporte"
            value={hoursSport}
            onChange={setHoursSport}
          />

          <div className="grid gap-3">
            {activities.map((a, i) => (
              <div
                key={a.key}
                className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_7rem_8rem_auto] sm:items-end"
              >
                <div className="grid gap-1">
                  <Label htmlFor={`act-name-${a.key}`}>Nombre</Label>
                  <Input
                    id={`act-name-${a.key}`}
                    value={a.activityName}
                    placeholder="Ej: correr"
                    onChange={(e) =>
                      updateActivity(a.key, { activityName: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`act-dur-${a.key}`}>Duración (min)</Label>
                  <Input
                    id={`act-dur-${a.key}`}
                    type="number"
                    min={0}
                    value={a.durationMinutes}
                    onChange={(e) =>
                      updateActivity(a.key, { durationMinutes: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`act-int-${a.key}`}>Intensidad</Label>
                  <Select
                    value={a.intensity}
                    onValueChange={(v) =>
                      updateActivity(a.key, { intensity: v as Intensity })
                    }
                  >
                    <SelectTrigger id={`act-int-${a.key}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(INTENSITY_LABELS) as Intensity[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {INTENSITY_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    ≈ {fmt(activityCals[i])} kcal
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeActivity(a.key)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addActivity}>
              Añadir actividad
            </Button>
          </div>

          <p className="text-sm font-medium">
            Calorías por actividad: {fmt(totalActivityCalories)} kcal
          </p>
        </CardContent>
      </Card>

      {/* 3. Comidas */}
      <Card>
        <CardHeader>
          <CardTitle>Comidas</CardTitle>
          <CardDescription>Registra lo que comes en cada momento del día.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Accordion className="w-full">
            {MEAL_TYPES.map(({ value, label }) => {
              const rows = meals.filter((m) => m.mealType === value)
              return (
                <AccordionItem key={value} value={value}>
                  <AccordionTrigger>
                    <span className="flex w-full items-center justify-between pr-2">
                      <span>{label}</span>
                      <span className="text-sm text-muted-foreground">
                        {fmt(mealSubtotal(value))} kcal
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="grid gap-3">
                    {rows.map((m) => (
                      <div
                        key={m.key}
                        className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end"
                      >
                        <div className="grid gap-1">
                          <Label htmlFor={`meal-name-${m.key}`}>Alimento</Label>
                          <Input
                            id={`meal-name-${m.key}`}
                            value={m.foodName}
                            placeholder="Ej: tostada"
                            onChange={(e) =>
                              updateMeal(m.key, { foodName: e.target.value })
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor={`meal-portion-${m.key}`}>Porción</Label>
                          <Input
                            id={`meal-portion-${m.key}`}
                            value={m.portionDescription}
                            placeholder="Ej: 2 rebanadas"
                            onChange={(e) =>
                              updateMeal(m.key, {
                                portionDescription: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor={`meal-kcal-${m.key}`}>Calorías</Label>
                          <Input
                            id={`meal-kcal-${m.key}`}
                            type="number"
                            min={0}
                            value={m.calories}
                            onChange={(e) =>
                              updateMeal(m.key, { calories: e.target.value })
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMeal(m.key)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addMeal(value)}
                    >
                      Añadir alimento
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>

          <p className="text-sm font-medium">
            Total consumido: {fmt(totalConsumed)} kcal
          </p>
        </CardContent>
      </Card>

      {/* 4. Resumen del día */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen del día</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <table className="w-full text-sm">
            <tbody>
              <SummaryRow label="BMR" value={`${fmt(bmr)} kcal`} />
              <SummaryRow
                label="Calorías de actividad"
                value={`${fmt(totalActivityCalories)} kcal`}
              />
              <SummaryRow
                label="Gasto total (TDEE)"
                value={`${fmt(tdee)} kcal`}
                strong
              />
              <SummaryRow
                label="Calorías consumidas"
                value={`${fmt(totalConsumed)} kcal`}
              />
              <tr className="border-t">
                <td className="py-2">Balance</td>
                <td className="py-2 text-right">
                  <Badge
                    className={
                      isDeficit
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                    }
                  >
                    {isDeficit
                      ? `DÉFICIT −${fmt(Math.abs(balance))} kcal`
                      : `SUPERÁVIT +${fmt(balance)} kcal`}
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              placeholder="¿Cómo te has sentido hoy?"
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full sm:w-auto sm:justify-self-end"
            onClick={handleSave}
            disabled={pending}
          >
            {pending
              ? 'Guardando…'
              : mode === 'new'
                ? 'Guardar día'
                : 'Guardar cambios'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function HourSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm text-muted-foreground">{value} h</span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={24}
        step={0.5}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  )
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <tr className="border-t">
      <td className={`py-2 ${strong ? 'font-medium' : ''}`}>{label}</td>
      <td className={`py-2 text-right ${strong ? 'font-medium' : ''}`}>{value}</td>
    </tr>
  )
}
