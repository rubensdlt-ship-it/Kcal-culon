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
 * Returns: { workout: string }
 *
 * Server-only. Reads OPENAI_API_KEY from the environment and calls the OpenAI
 * Chat Completions API (gpt-4o-mini), same pattern as /api/estimate-calories.
 * The key is never sent to the client. The proposed routine is returned as a
 * readable text block and is NOT persisted anywhere.
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

  // --- Gather user context (RLS restricts these reads to the current user) ---
  const { data: profile } = await supabase
    .from('profiles')
    .select('age, current_weight_kg, height_cm, goal, health_conditions')
    .eq('id', user.id)
    .single()

  const cutoff = subtractDays(todayLocalDate(), 6) // last 7 days, inclusive
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
        messages: [
          {
            role: 'system',
            content:
              'Eres un entrenador personal titulado. Diseña una rutina de entrenamiento para HOY, en español, adaptada al lugar y al material disponibles y a la intensidad solicitada. ' +
              'Ten muy en cuenta las condiciones de salud del usuario para NO proponer ejercicios contraindicados; si algo es arriesgado, ofrece una alternativa más segura. ' +
              'Responde SOLO con texto legible, sin Markdown ni tablas. Empieza con un breve calentamiento y termina con una vuelta a la calma. ' +
              'Para CADA ejercicio indica en una línea: nombre, duración (min), intensidad y calorías estimadas (kcal). ' +
              'Al final, añade una línea con las calorías totales estimadas de la sesión. Sé concreto y realista con las calorías.',
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
    const workout: string = (data?.choices?.[0]?.message?.content ?? '').trim()
    if (!workout) {
      return Response.json(
        { error: 'No se pudo generar la rutina.' },
        { status: 502 },
      )
    }

    return Response.json({ workout })
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
