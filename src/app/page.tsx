import { redirect } from 'next/navigation'

// The proxy routes "/" based on auth + profile state before this renders.
// This redirect is a safe fallback if the page is ever reached directly.
export default function Home() {
  redirect('/dashboard')
}
