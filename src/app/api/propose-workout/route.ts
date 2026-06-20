import { createClient } from '@/lib/supabase/server'
import { todayLocalDate, formatShortDate } from '@/lib/date'
import { INTENSITY_LABELS, type Intensity } from '@/lib/calories'

type Place = 'gym' | 'park' | 'home'

const INTENSITIES: Record<Intensity, string> = {
  low: 'baja',
  moderate: 'moderada',
  high: 'alta',
}

const PLACES: Record<Place, { label: string; material: string }> = {
  gym: {
    label: 'gimnasio',
    material:
      'máquinas guiadas, pesas libres, mancuernas, barras, poleas y cardio (cinta, bicicleta estática)',
  },
  park: {
    label: 'parque de ejercicios (calistenia)',
    material:
      'barras fijas, barras paralelas, bancos y espacio para correr; principalmente peso corporal',
  },
  home: {
    label: 'casa',
    material:
      'poco o ningún material: peso corporal, quizá una esterilla, mancuernas ligeras o banda elástica',
  },
}

const GOAL_LABELS: Record<string, string> = {
  lose: 'perder peso',
  maintain: 'mantener peso',
  gain: 'ganar peso',
}

type RecentActivity = {
  activity_name: string | null
  duration_minutes: number | null
  intensity: Intensity | null
}
type RecentLog = {
  log_date: string
  hours_sedentary: number | null
  hours_light: number | null
  hours_sport: number | null
  activities: RecentActivity[] | null
}

/**
 * POST /api/propose-workout
 * Body: { intensity: 'low'|'moderate'|'high', place: 'gym'|'park'|'home' }
 * Returns: { workout: string, totalMinutes: number, totalCalories: number }
 *
 * Server-only. Reads OPENAI_API_KEY from the environment and calls the OpenAI
 * Chat Completions API (gpt-4o-mini), same pattern as /api/estimate-calories.
 *
 * One routine per user per day: enforced HERE on the server using
 * profiles.last_routine_date. The proposed routine is returned as a readable
 * text block (plus numeric totals) and is NOT persisted as an activity.
 */
export async function POST(request: Request) {
  // Only authenticated users may use the workout proposer.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    return Response.json(
      { error: 'La propuesta con IA no está configurada.' },
      { status: 500 },
    )
  }

  let body: { intensity?: unknown; place?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Petición no válida.' }, { status: 400 })
  }

  const intensity = String(body?.intensity ?? '') as Intensity
  const place = String(body?.place ?? '') as Place
  if (!(intensity in INTENSITIES)) {
    return Response.json({ error: 'Intensidad no válida.' }, { status: 400 })
  }
  if (!(place in PLACES)) {
    return Response.json({ error: 'Lugar no válido.' }, { status: 400 })
  }

  const today = todayLocalDate()

  // --- Gather user context (RLS restricts these reads to the current user) ---
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'age, current_weight_kg, height_cm, goal, health_conditions, last_routine_date',
    )
    .eq('id', user.id)
    .single()

  // One routine per day (server-side guard).
  if (profile?.last_routine_date === today) {
    return Response.json(
      { error: 'Ya has generado tu rutina de hoy. Podrás generar otra mañana.' },
      { status: 429 },
    )
  }

  const cutoff = subtractDays(today, 6) // last 7 days, inclusive
  const { data: recentLogs } = await supabase
    .from('daily_logs')
    .select(
      'log_date, hours_sedentary, hours_light, hours_sport, activities(activity_name, duration_minutes, intensity)',
    )
    .eq('user_id', user.id)
    .gte('log_date', cutoff)
    .order('log_date', { ascending: false })

  const contextText = buildContext(profile, (recentLogs ?? []) as RecentLog[])

  const userContent = [
    'Datos del usuario:',
    contextText,
    '',
    `Criterios elegidos para hoy:`,
    `- Intensidad deseada: ${INTENSITIES[intensity]}`,
    `- Lugar: ${PLACES[place].label}`,
    `- Material disponible: ${PLACES[place].material}`,
  ].join('\n')

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Eres un entrenador personal titulado. Diseña una rutina de entrenamiento para HOY, en español, adaptada al lugar y al material disponibles y a la intensidad solicitada. ' +
              'Ten muy en cuenta las condiciones de salud del usuario para NO proponer ejercicios contraindicados; si algo es arriesgado, ofrece una alternativa más segura. ' +
              'Incluye un breve calentamiento, los ejercicios principales con DESCANSOS entre ellos (indicando la duración de cada descanso), y una vuelta a la calma. ' +
              'Responde ÚNICAMENTE con un objeto JSON válido con esta forma exacta: ' +
              '{"text": string, "total_minutes": number, "total_calories": number}. ' +
              'En "text" escribe la rutina como texto legible en español (sin Markdown ni tablas); para CADA ejercicio indica en una línea: nombre, duración (min), intensidad y calorías estimadas (kcal); muestra también los descansos con su duración; ' +
              'y termina con dos líneas: "Tiempo total estimado: X min" y "Calorías totales estimadas: Y kcal". ' +
              '"total_minutes" es el tiempo total estimado de la sesión (suma de la duración de los ejercicios MÁS los descansos), como entero. ' +
              '"total_calories" son las calorías totales estimadas, como entero. No incluyas nada fuera del JSON.',
          },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!res.ok) {
      return Response.json(
        { error: 'El servicio de IA no respondió correctamente.' },
        { status: 502 },
      )
    }

    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''

    let parsed: { text?: unknown; total_minutes?: unknown; total_calories?: unknown }
    try {
      parsed = JSON.parse(content)
    } catch {
      return Response.json(
        { error: 'No se pudo interpretar la rutina.' },
        { status: 502 },
      )
    }

    const workout = String(parsed?.text ?? '').trim()
    const totalMinutes = Math.round(Number(parsed?.total_minutes))
    const totalCalories = Math.round(Number(parsed?.total_calories))
    if (
      !workout ||
      !Number.isFinite(totalMinutes) ||
      totalMinutes <= 0 ||
      !Number.isFinite(totalCalories) ||
      totalCalories <= 0
    ) {
      return Response.json(
        { error: 'No se pudo generar la rutina.' },
        { status: 502 },
      )
    }

    // Mark today's routine as used (RLS allows updating own row).
    await supabase
      .from('profiles')
      .update({ last_routine_date: today })
      .eq('id', user.id)

    return Response.json({ workout, totalMinutes, totalCalories })
  } catch {
    return Response.json(
      { error: 'No se pudo conectar con el servicio de IA.' },
      { status: 502 },
    )
  }
}

/** Subtract n days from a YYYY-MM-DD date, returning YYYY-MM-DD. */
function subtractDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function buildContext(
  profile: {
    age: number | null
    current_weight_kg: number | null
    height_cm: number | null
    goal: string | null
    health_conditions: string | null
  } | null,
  logs: RecentLog[],
): string {
  const lines: string[] = []

  lines.push(`- Edad: ${profile?.age ?? 'desconocida'}`)

  const weight = profile?.current_weight_kg
  const heightCm = profile?.height_cm
  if (weight != null) lines.push(`- Peso: ${weight} kg`)
  if (weight != null && heightCm != null && heightCm > 0) {
    const heightM = heightCm / 100
    const imc = Number(weight) / (heightM * heightM)
    lines.push(`- IMC: ${imc.toFixed(1)}`)
  }

  lines.push(
    `- Objetivo: ${profile?.goal ? (GOAL_LABELS[profile.goal] ?? profile.goal) : 'no indicado'}`,
  )
  lines.push(
    `- Condiciones de salud: ${
      profile?.health_conditions?.trim() || 'ninguna indicada'
    }`,
  )

  lines.push('- Actividad de los últimos 7 días:')
  if (logs.length === 0) {
    lines.push('  Sin actividad registrada en los últimos 7 días.')
  } else {
    for (const log of logs) {
      const acts = (log.activities ?? [])
        .map((a) => {
          const name = a.activity_name?.trim() || 'actividad'
          const dur = a.duration_minutes != null ? `${a.duration_minutes} min` : '—'
          const int = a.intensity ? INTENSITY_LABELS[a.intensity] : '—'
          return `${name} (${dur}, ${int})`
        })
        .join('; ')
      const hours = `sedentario ${log.hours_sedentary ?? 0} h, ligera ${
        log.hours_light ?? 0
      } h, deporte ${log.hours_sport ?? 0} h`
      lines.push(
        `  ${formatShortDate(log.log_date)}: ${hours}${acts ? `; ${acts}` : ''}`,
      )
    }
  }

  return lines.join('\n')
}
