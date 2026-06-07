/**
 * Shared calorie calculations for Kcal-culón.
 *
 * All functions are pure. Results are NOT rounded here — round at the point of
 * storage (integers in the DB) or display.
 */

export type Gender = 'male' | 'female' | 'other'
export type Intensity = 'low' | 'moderate' | 'high'
export type MealType =
  | 'breakfast'
  | 'mid_morning'
  | 'lunch'
  | 'afternoon_snack'
  | 'dinner'
  | 'coffee'
  | 'infusion'
  | 'other'

/** MET value per activity intensity. */
export const MET_VALUES: Record<Intensity, number> = {
  low: 3,
  moderate: 5,
  high: 8,
}

/** Spanish labels for activity intensity. */
export const INTENSITY_LABELS: Record<Intensity, string> = {
  low: 'Baja',
  moderate: 'Moderada',
  high: 'Alta',
}

/** Meal types in display order, with their Spanish labels. */
export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'mid_morning', label: 'Picoteo mañana' },
  { value: 'lunch', label: 'Almuerzo' },
  { value: 'afternoon_snack', label: 'Merienda' },
  { value: 'dinner', label: 'Cena' },
  { value: 'coffee', label: 'Cafés' },
  { value: 'infusion', label: 'Infusiones' },
  { value: 'other', label: 'Otros' },
]

/**
 * Basal Metabolic Rate (Mifflin-St Jeor), using the given day's weight.
 *   Male:   (10 * weight) + (6.25 * height) - (5 * age) + 5
 *   Female: (10 * weight) + (6.25 * height) - (5 * age) - 161
 * For 'other' we use the midpoint of the male/female constants (-78).
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  const genderConstant = gender === 'male' ? 5 : gender === 'female' ? -161 : -78
  return base + genderConstant
}

/** Calories burned by a single activity: (MET * weightKg * durationMinutes) / 60. */
export function activityCalories(
  intensity: Intensity,
  weightKg: number,
  durationMinutes: number,
): number {
  return (MET_VALUES[intensity] * weightKg * durationMinutes) / 60
}

/** Total Daily Energy Expenditure = BMR + total activity calories. */
export function calculateTDEE(bmr: number, totalActivityCalories: number): number {
  return bmr + totalActivityCalories
}

/**
 * Calorie balance = calories consumed − TDEE.
 *   negative → DÉFICIT (good for weight loss)
 *   positive → SUPERÁVIT
 */
export function calorieBalance(totalConsumed: number, tdee: number): number {
  return totalConsumed - tdee
}
