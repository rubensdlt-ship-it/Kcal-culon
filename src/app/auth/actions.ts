'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AuthState = {
  error?: string
  message?: string
}

/**
 * Sign in with email + password.
 * On success, redirect to /dashboard — proxy.ts will forward the user to
 * /profile/setup if their profile is not yet complete.
 */
export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Introduce tu correo y contraseña.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Correo o contraseña incorrectos.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Create an account. The handle_new_user trigger creates the matching
 * profiles row automatically, so we only call auth.signUp here.
 *
 * If the Supabase project requires email confirmation, no session is returned
 * and we ask the user to confirm by email before logging in.
 */
export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!fullName || !email || !password) {
    return { error: 'Completa todos los campos.' }
  }
  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    return { error: 'No se pudo crear la cuenta. Inténtalo de nuevo.' }
  }

  // Email confirmation enabled → no active session yet.
  if (!data.session) {
    return {
      message:
        'Cuenta creada. Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/profile/setup')
}

/** Sign out and return to the login page. */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
