'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProfileState = {
  error?: string
  message?: string
}

const GENDERS = ['male', 'female', 'other']
const JOB_TYPES = ['sedentary', 'light', 'moderate', 'active', 'very_active']
const ACTIVITY_LEVELS = ['low', 'moderate', 'high', 'athlete']
const GOALS = ['lose', 'maintain', 'gain']

function parsePositiveNumber(value: FormDataEntryValue | null): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Columns a user is allowed to edit. Control columns (is_admin, approved,
 *  profile_complete, id…) are never derived from form input. */
type EditableProfile = {
  full_name: string
  gender: string
  age: number
  height_cm: number
  current_weight_kg: number
  target_weight: number | null
  job_type: string
  activity_level: string
  goal: string
  health_conditions: string | null
  pathologies: string | null
}

/**
 * Shared parsing + validation for both the initial setup and the edit form.
 * Returns the editable columns on success, or a user-facing error message.
 */
function parseProfileForm(
  formData: FormData,
): { values: EditableProfile } | { error: string } {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const gender = String(formData.get('gender') ?? '')
  const jobType = String(formData.get('job_type') ?? '')
  const activityLevel = String(formData.get('activity_level') ?? '')
  const goal = String(formData.get('goal') ?? '')
  const age = parsePositiveNumber(formData.get('age'))
  const heightCm = parsePositiveNumber(formData.get('height_cm'))
  const currentWeightKg = parsePositiveNumber(formData.get('current_weight_kg'))
  // Optional: null when left empty.
  const targetWeightKg = parsePositiveNumber(formData.get('target_weight'))
  const healthConditions =
    String(formData.get('health_conditions') ?? '').trim() || null
  const pathologies = String(formData.get('pathologies') ?? '').trim() || null

  // Validation of the required fields.
  if (!fullName) return { error: 'Introduce tu nombre completo.' }
  if (!GENDERS.includes(gender)) return { error: 'Selecciona tu sexo.' }
  if (age === null) return { error: 'Introduce una edad válida.' }
  if (heightCm === null) return { error: 'Introduce una altura válida (cm).' }
  if (currentWeightKg === null)
    return { error: 'Introduce un peso válido (kg).' }
  if (!JOB_TYPES.includes(jobType))
    return { error: 'Selecciona tu tipo de trabajo.' }
  if (!ACTIVITY_LEVELS.includes(activityLevel))
    return { error: 'Selecciona tu nivel de actividad.' }
  if (!GOALS.includes(goal)) return { error: 'Selecciona tu objetivo.' }

  return {
    values: {
      full_name: fullName,
      gender,
      age: Math.round(age),
      height_cm: Math.round(heightCm),
      current_weight_kg: currentWeightKg,
      target_weight: targetWeightKg,
      job_type: jobType,
      activity_level: activityLevel,
      goal,
      health_conditions: healthConditions,
      pathologies,
    },
  }
}

/**
 * Save the profile setup form and mark the profile as complete.
 * Writes to the current user's profiles row (RLS allows updating own row).
 */
export async function saveProfile(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const parsed = parseProfileForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { error } = await supabase
    .from('profiles')
    .update({ ...parsed.values, profile_complete: true })
    .eq('id', user.id)

  if (error) {
    return { error: 'No se pudo guardar tu perfil. Inténtalo de nuevo.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Update an existing profile from the "Mi perfil" page. Reuses the same
 * validation as setup. Control columns (is_admin, approved, profile_complete)
 * are never touched. Stays on the page and returns a success message.
 */
export async function updateProfile(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const parsed = parseProfileForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { error } = await supabase
    .from('profiles')
    .update(parsed.values)
    .eq('id', user.id)

  if (error) {
    return { error: 'No se pudo actualizar tu perfil. Inténtalo de nuevo.' }
  }

  revalidatePath('/', 'layout')
  return { message: 'Perfil actualizado correctamente.' }
}
