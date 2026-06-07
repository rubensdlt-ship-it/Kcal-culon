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
