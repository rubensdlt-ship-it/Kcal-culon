import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client built with the service_role key.
 *
 * It BYPASSES Row Level Security and can use the auth admin API
 * (e.g. `auth.admin.listUsers()`), so it must only ever be created and used
 * on the server. Never import this from a Client Component.
 *
 * Every caller is responsible for verifying that the request comes from an
 * authenticated admin BEFORE using this client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
