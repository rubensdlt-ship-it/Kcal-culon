import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for use in Client Components (browser).
 * Only the public anon key is exposed here — never the service_role key.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
