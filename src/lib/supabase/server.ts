import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { SUPABASE_KEY, SUPABASE_URL } from "./env"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component; the proxy refreshes sessions.
        }
      },
    },
  })
}

/** Returns the signed-in user or redirects to /login. Cached per request. */
export const requireUser = cache(async (next?: string) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login")
  }
  return { supabase, user }
})
