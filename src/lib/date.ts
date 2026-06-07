/**
 * App-wide "today" as a YYYY-MM-DD string in the users' timezone (Spain).
 * Using a fixed timezone keeps the log_date stable regardless of where the
 * server runs (e.g. Vercel runs in UTC), avoiding off-by-one days near midnight.
 */
export function todayLocalDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
  }).format(new Date())
}

/**
 * Parse a YYYY-MM-DD string at noon UTC so timezone shifts never cross a day
 * boundary when formatting.
 */
function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`)
}

/** "domingo, 7 de junio de 2026" — long Spanish date for headings. */
export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(parseLocalDate(isoDate))
}

/** "7 jun 2026" — compact Spanish date for cards and tables. */
export function formatShortDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(parseLocalDate(isoDate))
}
