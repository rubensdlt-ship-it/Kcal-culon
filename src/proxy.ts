import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/signup']

/**
 * Proxy (formerly "middleware" — renamed in Next.js 16).
 *
 * Two jobs on every matched request:
 *  1. Refresh the Supabase auth session so Server Components get a valid cookie.
 *  2. Route protection:
 *     - Unauthenticated users are sent to /login (except on /login and /signup).
 *     - Authenticated users with an incomplete profile are sent to
 *       /profile/setup; once complete they go to /dashboard.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: do not run code between createServerClient and getUser().
  // getUser() revalidates the token and triggers cookie refresh via setAll.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  // Redirect helper that preserves any refreshed auth cookies.
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  // Not authenticated.
  if (!user) {
    return isPublicRoute ? response : redirectTo('/login')
  }

  // Authenticated: check whether the profile setup is finished.
  const { data: profile } = await supabase
    .from('profiles')
    .select('profile_complete')
    .eq('id', user.id)
    .single()
  const profileComplete = profile?.profile_complete === true

  // On an auth route or the root → route by completeness.
  if (isPublicRoute || pathname === '/') {
    return redirectTo(profileComplete ? '/dashboard' : '/profile/setup')
  }

  // Incomplete profile must finish setup first.
  if (!profileComplete && pathname !== '/profile/setup') {
    return redirectTo('/profile/setup')
  }

  // Completed profiles shouldn't sit on the setup page.
  if (profileComplete && pathname === '/profile/setup') {
    return redirectTo('/dashboard')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - common image asset extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
