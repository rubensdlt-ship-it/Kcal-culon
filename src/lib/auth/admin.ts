import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Returns the currently authenticated user IF they are an admin, otherwise
 * null. Uses the request-scoped (anon-key) server client to read the caller's
 * own profile — RLS allows a user to read their own row.
 *
 * Server-only: importing `@/lib/supabase/server` pulls in `next/headers`, so
 * this cannot be used from a Client Component.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin === true ? user : null
}
