/** Format a number as a rounded integer with Spanish thousands separators. */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('es-ES')
}
