'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayLocalDate } from '@/lib/date'
import {
  type Intensity,
  type MealType,
  activityCalories,
  calculateBMR,
  calculateTDEE,
  calorieBalance,
} from '@/lib/calories'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type ActivityInput = {
  activityName: string
  durationMinutes: number
  intensity: Intensity
}

export type MealInput = {
  mealType: MealType
  foodName: string
  portionDescription: string
  calories: number
}

export type SaveDayLogInput = {
  logId?: string
  logDate: string // YYYY-MM-DD (user's local date)
  weightKg: number
  hoursSedentary: number
  hoursLight: number
  hoursSport: number
  notes: string
  activities: ActivityInput[]
  meals: MealInput[]
}

export type DayLogState = { error?: string }

export type AddRoutineState = { error?: string; message?: string }

/**
 * Register an AI-proposed routine as a SINGLE activity on today's log, using its
 * total duration and total calories. Unlike saveDayLog, this does not replace
 * the day's other activities/meals — it appends one row and recomputes the
 * affected aggregates (activity calories, TDEE, balance). Today's log is created
 * if it doesn't exist yet.
 */
export async function addRoutineToToday(input: {
  intensity: Intensity
  durationMinutes: number
  calories: number
}): Promise<AddRoutineState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const durationMinutes = Math.max(0, Math.round(Number(input.durationMinutes) || 0))
  const calories = Math.max(0, Math.round(Number(input.calories) || 0))
  const { intensity } = input
  if (durationMinutes <= 0 || calories <= 0) {
    return { error: 'La rutina no tiene datos válidos para registrar.' }
  }

  const today = todayLocalDate()

  const { data: profile } = await supabase
    .from('profiles')
    .select('age, height_cm, gender, current_weight_kg')
    .eq('id', user.id)
    .single()

  const profileWeight =
    profile?.current_weight_kg != null ? Number(profile.current_weight_kg) : null
  const computeBmr = (weight: number | null): number | null =>
    weight != null && profile?.height_cm != null && profile?.age != null
      ? Math.round(
          calculateBMR(weight, profile.height_cm, profile.age, profile.gender ?? 'other'),
        )
      : null

  // Find or create today's log.
  const { data: existingLog } = await supabase
    .from('daily_logs')
    .select('id, weight_kg, bmr_calories, total_calories_consumed')
    .eq('user_id', user.id)
    .eq('log_date', today)
    .maybeSingle()

  let logId: string
  let bmr: number | null
  let totalConsumed: number

  if (existingLog) {
    logId = existingLog.id
    const weight =
      existingLog.weight_kg != null ? Number(existingLog.weight_kg) : profileWeight
    bmr = existingLog.bmr_calories ?? computeBmr(weight)
    totalConsumed = existingLog.total_calories_consumed ?? 0
  } else {
    bmr = computeBmr(profileWeight)
    totalConsumed = 0
    const { data: created, error: createError } = await supabase
      .from('daily_logs')
      .upsert(
        {
          user_id: user.id,
          log_date: today,
          weight_kg: profileWeight,
          bmr_calories: bmr,
          total_calories_consumed: 0,
        },
        { onConflict: 'user_id,log_date' },
      )
      .select('id')
      .single()
    if (createError || !created) {
      return { error: 'No se pudo registrar la actividad.' }
    }
    logId = created.id
  }

  // Append the routine as one activity.
  const { error: insertError } = await supabase.from('activities').insert({
    daily_log_id: logId,
    activity_name: 'Rutina de entrenamiento (IA)',
    duration_minutes: durationMinutes,
    intensity,
    calories_burned: calories,
  })
  if (insertError) {
    return { error: 'No se pudo registrar la actividad.' }
  }

  // Recompute aggregates from all activities of the day.
  const { data: allActivities } = await supabase
    .from('activities')
    .select('calories_burned')
    .eq('daily_log_id', logId)
  const activityCaloriesTotal = (allActivities ?? []).reduce(
    (sum, a) => sum + (a.calories_burned ?? 0),
    0,
  )

  const tdee = bmr != null ? Math.round(calculateTDEE(bmr, activityCaloriesTotal)) : null
  const balance = tdee != null ? Math.round(calorieBalance(totalConsumed, tdee)) : null

  await supabase
    .from('daily_logs')
    .update({
      activity_calories: activityCaloriesTotal,
      tdee_calories: tdee,
      calorie_balance: balance,
    })
    .eq('id', logId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard')
  revalidatePath(`/day/${logId}`)
  return { message: 'Rutina añadida a tu día de hoy.' }
}

/**
 * Create or update today's (or a given date's) daily log.
 *
 * All calorie figures are recomputed on the server from the raw inputs and the
 * user's profile — client-side numbers are never trusted. Child activities and
 * meals are fully replaced on each save.
 *
 * Honors UNIQUE(user_id, log_date): when no logId is given it upserts on that
 * pair, so a second "new" save for the same day edits the existing row instead
 * of failing.
 */
export async function saveDayLog(input: SaveDayLogInput): Promise<DayLogState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // The date must be valid and never in the future.
  if (!DATE_RE.test(input.logDate) || input.logDate > todayLocalDate()) {
    return { error: 'La fecha no es válida. No puedes registrar días futuros.' }
  }

  const weightKg = Number(input.weightKg)
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return { error: 'Introduce un peso válido para ese día.' }
  }

  // Profile data needed for BMR.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('age, height_cm, gender')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.age == null || profile.height_cm == null) {
    return { error: 'Completa tu perfil antes de registrar un día.' }
  }

  // Clean child rows.
  const activities = input.activities
    .map((a) => ({
      activityName: a.activityName.trim(),
      durationMinutes: Math.max(0, Math.round(Number(a.durationMinutes) || 0)),
      intensity: a.intensity,
    }))
    .filter((a) => a.activityName !== '' && a.durationMinutes > 0)

  const meals = input.meals
    .map((m) => ({
      mealType: m.mealType,
      foodName: m.foodName.trim(),
      portionDescription: m.portionDescription.trim(),
      calories: Math.max(0, Math.round(Number(m.calories) || 0)),
    }))
    .filter((m) => m.foodName !== '')

  // --- Server-side calorie calculations ---
  const bmr = calculateBMR(
    weightKg,
    profile.height_cm,
    profile.age,
    profile.gender ?? 'other',
  )

  const activityRows = activities.map((a) => ({
    ...a,
    caloriesBurned: Math.round(
      activityCalories(a.intensity, weightKg, a.durationMinutes),
    ),
  }))
  const totalActivityCalories = activityRows.reduce(
    (sum, a) => sum + a.caloriesBurned,
    0,
  )

  const tdee = calculateTDEE(bmr, totalActivityCalories)
  const totalConsumed = meals.reduce((sum, m) => sum + m.calories, 0)
  const balance = calorieBalance(totalConsumed, tdee)

  const logRow = {
    user_id: user.id,
    log_date: input.logDate,
    weight_kg: weightKg,
    bmr_calories: Math.round(bmr),
    activity_calories: totalActivityCalories,
    tdee_calories: Math.round(tdee),
    total_calories_consumed: totalConsumed,
    calorie_balance: Math.round(balance),
    hours_sedentary: input.hoursSedentary,
    hours_light: input.hoursLight,
    hours_sport: input.hoursSport,
    notes: input.notes.trim() || null,
  }

  // --- Upsert the daily_logs row ---
  let logId = input.logId

  if (logId) {
    const { error } = await supabase
      .from('daily_logs')
      .update(logRow)
      .eq('id', logId)
      .eq('user_id', user.id)
    if (error) return { error: 'No se pudo guardar el día. Inténtalo de nuevo.' }
  } else {
    const { data, error } = await supabase
      .from('daily_logs')
      .upsert(logRow, { onConflict: 'user_id,log_date' })
      .select('id')
      .single()
    if (error || !data) {
      return { error: 'No se pudo guardar el día. Inténtalo de nuevo.' }
    }
    logId = data.id
  }

  // --- Replace child rows (activities + meals) ---
  await supabase.from('activities').delete().eq('daily_log_id', logId)
  await supabase.from('meals').delete().eq('daily_log_id', logId)

  if (activityRows.length > 0) {
    const { error } = await supabase.from('activities').insert(
      activityRows.map((a) => ({
        daily_log_id: logId,
        activity_name: a.activityName,
        duration_minutes: a.durationMinutes,
        intensity: a.intensity,
        calories_burned: a.caloriesBurned,
      })),
    )
    if (error) return { error: 'No se pudieron guardar las actividades.' }
  }

  if (meals.length > 0) {
    const { error } = await supabase.from('meals').insert(
      meals.map((m) => ({
        daily_log_id: logId,
        meal_type: m.mealType,
        food_name: m.foodName,
        portion_description: m.portionDescription || null,
        calories: m.calories,
      })),
    )
    if (error) return { error: 'No se pudieron guardar las comidas.' }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/day/${logId}`)
  redirect(`/day/${logId}`)
}
