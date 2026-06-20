'use client'

import { useState } from 'react'
import { Dumbbell, Loader2 } from 'lucide-react'
import { addRoutineToToday } from '@/app/day/actions'
import { INTENSITY_LABELS, type Intensity } from '@/lib/calories'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Place = 'gym' | 'park' | 'home'

const PLACE_LABELS: Record<Place, string> = {
  gym: 'Gimnasio',
  park: 'Parque de ejercicios',
  home: 'Casa',
}

// Keep in sync with the activity_name used in addRoutineToToday.
const ROUTINE_ACTIVITY_NAME = 'Rutina de entrenamiento (IA)'

type AddedActivity = {
  activityName: string
  durationMinutes: number
  intensity: Intensity
}

/** Escape text for safe injection into the print window. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Lets the user request an AI-proposed workout for today based on intensity and
 * place. The result is shown as a readable text block with Copy / Share / Print
 * actions. Nothing is persisted — this never touches the activities table.
 */
export function WorkoutProposer({
  onActivityAdded,
}: {
  onActivityAdded?: (activity: AddedActivity) => void
} = {}) {
  const [open, setOpen] = useState(false)
  const [intensity, setIntensity] = useState<Intensity>('moderate')
  const [place, setPlace] = useState<Place>('gym')

  const [loading, setLoading] = useState(false)
  const [workout, setWorkout] = useState<string | null>(null)
  const [totalMinutes, setTotalMinutes] = useState<number | null>(null)
  const [totalCalories, setTotalCalories] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Add-to-day state.
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    setCopied(false)
    setAdded(false)
    setAddError(null)
    try {
      const res = await fetch('/api/propose-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intensity, place }),
      })
      const data: {
        workout?: unknown
        totalMinutes?: unknown
        totalCalories?: unknown
        error?: unknown
      } = await res.json()
      if (!res.ok || typeof data.workout !== 'string') {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'request failed',
        )
      }
      setWorkout(data.workout)
      setTotalMinutes(
        typeof data.totalMinutes === 'number' ? data.totalMinutes : null,
      )
      setTotalCalories(
        typeof data.totalCalories === 'number' ? data.totalCalories : null,
      )
    } catch (e) {
      setError(
        e instanceof Error && e.message !== 'request failed'
          ? e.message
          : 'No se pudo generar la rutina. Inténtalo de nuevo.',
      )
    } finally {
      setLoading(false)
    }
  }

  const addToDay = async () => {
    if (totalMinutes == null || totalCalories == null) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await addRoutineToToday({
        intensity,
        durationMinutes: totalMinutes,
        calories: totalCalories,
      })
      if (res?.error) {
        setAddError(res.error)
      } else {
        setAdded(true)
        onActivityAdded?.({
          activityName: ROUTINE_ACTIVITY_NAME,
          durationMinutes: totalMinutes,
          intensity,
        })
      }
    } catch {
      setAddError('No se pudo añadir la actividad. Inténtalo de nuevo.')
    } finally {
      setAdding(false)
    }
  }

  const copy = async () => {
    if (!workout) return
    try {
      await navigator.clipboard.writeText(workout)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar al portapapeles.')
    }
  }

  const share = async () => {
    if (!workout) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Entrenamiento de hoy',
          text: workout,
        })
      } catch {
        // User cancelled or sharing failed — ignore silently.
      }
    } else {
      // Fallback for desktop browsers without the Web Share API.
      await copy()
      setError('Compartir no está disponible aquí; se ha copiado al portapapeles.')
    }
  }

  const print = () => {
    if (!workout) return
    const win = window.open('', '_blank', 'width=640,height=720')
    if (!win) return
    win.document.write(
      `<title>Entrenamiento de hoy</title>` +
        `<pre style="font-family: ui-sans-serif, system-ui, sans-serif; white-space: pre-wrap; line-height: 1.5; padding: 24px; font-size: 14px;">${escapeHtml(
          workout,
        )}</pre>`,
    )
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="grid gap-3 rounded-md border border-dashed p-3">
      {!open ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="justify-self-start"
        >
          <Dumbbell />
          Proponer entrenamiento de hoy (IA)
        </Button>
      ) : (
        <>
          <p className="text-sm font-medium">Proponer entrenamiento de hoy (IA)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="workout-intensity">Intensidad</Label>
              <Select
                value={intensity}
                onValueChange={(v) => setIntensity(v as Intensity)}
              >
                <SelectTrigger id="workout-intensity" className="w-full">
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
            <div className="grid gap-1">
              <Label htmlFor="workout-place">Lugar</Label>
              <Select value={place} onValueChange={(v) => setPlace(v as Place)}>
                <SelectTrigger id="workout-place" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLACE_LABELS) as Place[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PLACE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            onClick={generate}
            disabled={loading}
            className="justify-self-start"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Dumbbell />}
            {loading ? 'Generando…' : 'Generar rutina'}
          </Button>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {workout ? (
            <div className="grid gap-3">
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-sans text-sm">
                {workout}
              </pre>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copy}>
                  {copied ? 'Copiado ✓' : 'Copiar'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={share}>
                  Compartir
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={print}>
                  Imprimir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addToDay}
                  disabled={adding || added}
                >
                  {adding ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {added ? 'Añadida ✓' : '+ Añadir actividad a mi día'}
                </Button>
              </div>

              {addError ? (
                <p className="text-sm text-red-600" role="alert">
                  {addError}
                </p>
              ) : null}
              {added ? (
                <p className="text-sm text-green-600" role="status">
                  Rutina añadida a tu día de hoy.
                </p>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Esta rutina es orientativa y está generada por IA. No sustituye el
                consejo de un profesional. Consulta a tu médico o entrenador antes
                de empezar, especialmente si tienes alguna condición de salud.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
