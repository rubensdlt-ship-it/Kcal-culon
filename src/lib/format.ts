/** Format a number as a rounded integer with Spanish thousands separators. */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('es-ES')
}

/** Format a number with a fixed number of decimals, Spanish locale. */
export function formatDecimal(n: number, digits = 1): string {
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Signed weight, e.g. "−0,8 kg" / "+1,2 kg". */
export function formatSignedKg(n: number, digits = 1): string {
  const sign = n < 0 ? '−' : '+'
  return `${sign}${formatDecimal(Math.abs(n), digits)} kg`
}

/** Signed calories, e.g. "−9.100 kcal" / "+450 kcal". */
export function formatSignedKcal(n: number): string {
  const sign = n < 0 ? '−' : '+'
  return `${sign}${formatInt(Math.abs(n))} kcal`
}
