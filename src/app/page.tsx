import Link from "next/link"
import { ArrowRight, Globe2, Scale, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

const FEATURES = [
  { icon: Users, title: "Pick who shared it", body: "Tap the people in on each spend. Split equally, by exact amount or by shares." },
  { icon: Globe2, title: "Any currency", body: "Pay in CNY, settle in HKD. Set a rate once per trip." },
  { icon: Scale, title: "Settle in few transfers", body: "See who owes whom, with as few payments as possible." },
]

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-6 md:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-10 py-12 md:py-20">
        <div className="max-w-2xl space-y-5">
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
            Split the trip, <span className="text-muted-foreground">not the friendship.</span>
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            Log what you spend on the road, choose who it&apos;s for, and Maru Split works out who owes whom.
          </p>
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link href="/login">
              Get started <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <Icon className="mb-3 size-6" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
