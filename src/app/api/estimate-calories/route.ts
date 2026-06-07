import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/estimate-calories
 * Body: { food_name: string, portion?: string }
 * Returns: { calories: number }
 *
 * Server-only. Reads OPENAI_API_KEY from the environment and calls the OpenAI
 * Chat Completions API (gpt-4o-mini). The key is never sent to the client.
 */
export async function POST(request: Request) {
  // Only authenticated users may use the estimator.
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
      { error: 'La estimación con IA no está configurada.' },
      { status: 500 },
    )
  }

  let body: { food_name?: unknown; portion?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Petición no válida.' }, { status: 400 })
  }

  const foodName = String(body?.food_name ?? '').trim()
  const portion = String(body?.portion ?? '').trim()
  if (!foodName) {
    return Response.json(
      { error: 'Falta el nombre del alimento.' },
      { status: 400 },
    )
  }

  const userContent = portion ? `${foodName} — porción: ${portion}` : foodName

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'Eres un experto en nutrición. Devuelve ÚNICAMENTE un número entero con las calorías (kcal) estimadas para el alimento y la porción indicados. Sin texto adicional, sin unidades, solo el número.',
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
    const text: string = data?.choices?.[0]?.message?.content ?? ''
    const match = text.match(/\d[\d.,]*/)
    if (!match) {
      return Response.json(
        { error: 'No se pudo interpretar la estimación.' },
        { status: 502 },
      )
    }

    const calories = Math.round(Number(match[0].replace(/[.,]/g, '')))
    if (!Number.isFinite(calories) || calories < 0) {
      return Response.json(
        { error: 'No se pudo interpretar la estimación.' },
        { status: 502 },
      )
    }

    return Response.json({ calories })
  } catch {
    return Response.json(
      { error: 'No se pudo conectar con el servicio de IA.' },
      { status: 502 },
    )
  }
}
