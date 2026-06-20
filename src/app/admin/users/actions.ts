'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export type AdminActionState = {
  error?: string
}

/**
 * Set a user's `approved` flag.
 *
 * Security: every call re-verifies that the caller is an authenticated admin
 * before touching any profile. The write goes through the service_role client,
 * so this must stay a server action — it is never reachable from the browser
 * without passing the admin check first.
 */
export async function setUserApproval(
  userId: string,
  approved: boolean,
): Promise<AdminActionState> {
  const admin = await getAdminUser()
  if (!admin) {
    return { error: 'No autorizado.' }
  }

  if (!userId) {
    return { error: 'Usuario no válido.' }
  }

  // An admin must not be able to revoke their own access.
  if (userId === admin.id && approved === false) {
    return { error: 'No puedes revocarte el acceso a ti mismo.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ approved })
    .eq('id', userId)

  if (error) {
    return { error: 'No se pudo actualizar el estado del usuario.' }
  }

  revalidatePath('/admin/users')
  return {}
}
