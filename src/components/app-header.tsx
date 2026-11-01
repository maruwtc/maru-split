import Link from "next/link"
import type { User } from "@supabase/supabase-js"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"

export function AppHeader({ user, children }: { user: User; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
        <Link href="/trips" className="shrink-0">
          <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
        </Link>
        <div className="min-w-0 flex-1">{children}</div>
        <ThemeToggle />
        <UserMenu
          name={user.user_metadata?.full_name ?? user.email ?? "You"}
          email={user.email ?? ""}
          avatarUrl={user.user_metadata?.avatar_url ?? null}
        />
      </div>
    </header>
  )
}
