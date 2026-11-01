import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { SUPABASE_KEY, SUPABASE_URL } from "./env"

const PUBLIC_PATHS = ["/", "/login", "/auth"]

export async function updateSession(request: NextRequest) {
  // If Supabase falls back to the Site URL (redirect URL not allow-listed), the
  // OAuth code lands on "/" or another page. Hand it to the callback route.
  const code = request.nextUrl.searchParams.get("code")
  if (code && !request.nextUrl.pathname.startsWith("/auth/callback")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/callback"
    url.search = `?code=${encodeURIComponent(code)}`
    return NextResponse.redirect(url)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => (p === "/" ? path === "/" : path.startsWith(p)))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`
    return NextResponse.redirect(url)
  }

  // Signed-in users skip the landing and login pages.
  if (user && (path === "/" || path === "/login")) {
    const next = request.nextUrl.searchParams.get("next")
    const url = request.nextUrl.clone()
    url.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : "/trips"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}
