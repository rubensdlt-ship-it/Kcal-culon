import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/signup']

// Authenticated users awaiting manual approval are confined to this page.
const PENDING_APPROVAL_ROUTE = '/pending-approval'

/**
 * Proxy (formerly "middleware" — renamed in Next.js 16).
 *
 * Two jobs on every matched request:
 *  1. Refresh the Supabase auth session so Server Components get a valid cookie.
 *  2. Route protection:
 *     - Unauthenticated users are sent to /login (except on /login and /signup).
 *     - Authenticated users whose account is not yet approved (and who are not
 *       admins) are confined to /pending-approval.
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

  // Authenticated: load the flags that gate access.
  const { data: profile } = await supabase
    .from('profiles')
    .select('profile_complete, is_admin, approved')
    .eq('id', user.id)
    .single()
  const profileComplete = profile?.profile_complete === true
  const isAdmin = profile?.is_admin === true
  const approved = profile?.approved === true

  // Approval gate: non-admin accounts that aren't approved yet can only reach
  // the pending-approval page (where they can sign out). Admins bypass this.
  if (!isAdmin && !approved) {
    return pathname === PENDING_APPROVAL_ROUTE
      ? response
      : redirectTo(PENDING_APPROVAL_ROUTE)
  }

  // Approved users (and admins) shouldn't sit on the pending-approval page.
  if (pathname === PENDING_APPROVAL_ROUTE) {
    return redirectTo(profileComplete ? '/dashboard' : '/profile/setup')
  }

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
