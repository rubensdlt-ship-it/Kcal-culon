import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client for use in Server Components, Route Handlers and Server Actions.
 * Reads/writes the session from the request cookies.
 *
 * `cookies()` is async in this version of Next.js, so this helper is async too.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // `setAll` was called from a Server Component. This can be ignored
            // when session refresh happens in proxy.ts (middleware), which
            // always runs before Server Components render.
          }
        },
      },
    },
  )
}
