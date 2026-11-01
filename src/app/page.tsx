import Link from "next/link"
import {
  ArrowRight,
  Check,
  CircleCheck,
  FileSpreadsheet,
  Globe2,
  Landmark,
  Link2,
  Lock,
  Percent,
  Plus,
  Receipt,
  Scale,
  Smartphone,
  StickyNote,
  UtensilsCrossed,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

const HIGHLIGHTS = [
  {
    icon: Globe2,
    title: "That day's exchange rate, filled in for you",
    body: "Pay in CNY, settle in HKD. Every spend uses the market rate for the day you paid — weekends fall back to Friday's. Override it any time.",
    big: true,
    demo: "fx",
  },
  {
    icon: Users,
    title: "Friends don't need an account",
    body: "Add Mom and Dad by name and start splitting. Send them a personal link later — when they sign in with Google, every past expense is already theirs.",
    big: true,
    demo: "link",
  },
  {
    icon: FileSpreadsheet,
    title: "Bring your spreadsheet",
    body: "Drop in an .xlsx or .csv — even with Chinese headers like 日期 · 金額 · 付款人 · 分攤. Columns, names, dates and ¥/HK$ amounts are matched for you.",
  },
  {
    icon: CircleCheck,
    title: "Tick off who paid you back",
    body: "Mark each person's share of a dinner as paid back. Anyone on the trip can do it — not just the person who paid.",
  },
  {
    icon: Scale,
    title: "Settle in the fewest transfers",
    body: "Balances net out across the whole trip, so four friends settle with two or three payments instead of a dozen.",
  },
  {
    icon: StickyNote,
    title: "Notes with no price",
    body: "“Train booked for 23/12, seats 12A–C.” Keep reminders in the same timeline as your spending — they never touch the totals.",
  },
  {
    icon: Landmark,
    title: "Match your bank statement",
    body: "Card charged HK$532.10, not the estimated HK$530.32? Enter the exact amount and everyone's share is rescaled to the cent — no more “close enough” settle-ups.",
    wide: true,
    demo: "statement",
  },
  {
    icon: Percent,
    title: "Split it your way",
    body: "Equally, by exact amounts or by shares (2 : 1 for the family room). Always adds up to the cent.",
  },
  {
    icon: Smartphone,
    title: "Made for one thumb",
    body: "A floating bar with a big + to log a spend in seconds on your phone, and a roomy two-column view on desktop. Light and dark.",
  },
] as const

const STEPS = [
  { title: "Create a trip", body: "Name it, pick the currency you'll settle in, and add who's coming — with or without accounts." },
  { title: "Log every spend", body: "Type the amount, tap who paid and who shared. The day's rate and the split are worked out for you." },
  { title: "Settle up", body: "See each balance and the few transfers that clear them. Tap Paid when the money moves." },
]

function FxDemo() {
  return (
    <div className="mt-5 rounded-xl border bg-background p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">Hotpot dinner</span>
        <span className="font-semibold tabular-nums">CN¥486.00</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>1 CNY =</span>
        <span className="rounded-md border px-2 py-0.5 font-medium text-foreground tabular-nums">1.0912</span>
        <span>HKD</span>
        <span className="ml-auto font-medium text-foreground tabular-nums">≈ HK$530.32</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3" /> Rate for 22/12/2026
      </div>
    </div>
  )
}

function StatementDemo() {
  return (
    <div className="mt-5 grid gap-2 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="rounded-xl border bg-background p-3 shadow-sm">
        <div className="text-xs text-muted-foreground">Day&apos;s rate estimate</div>
        <div className="font-semibold tabular-nums">≈ HK$530.32</div>
        <div className="text-[11px] text-muted-foreground">CN¥486 × 1.0912</div>
      </div>
      <ArrowRight className="mx-auto size-4 rotate-90 text-muted-foreground sm:rotate-0" />
      <div className="rounded-xl border bg-background p-3 shadow-sm">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Landmark className="size-3" /> Bank statement
        </div>
        <div className="font-semibold tabular-nums">HK$532.10</div>
        <div className="text-[11px] text-negative tabular-nums">+HK$1.78 · shares rescaled</div>
      </div>
    </div>
  )
}

function LinkDemo() {
  return (
    <div className="mt-5 space-y-2 text-sm">
      <div className="flex items-center gap-3 rounded-xl border bg-background p-2.5 shadow-sm">
        <span className="grid size-8 place-items-center rounded-full bg-fuchsia-500 text-xs font-semibold text-white">M</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">Mom</div>
          <div className="text-xs text-muted-foreground">no account yet · 6 expenses</div>
        </div>
        <span className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium">
          <Link2 className="size-3" /> Invite
        </span>
      </div>
      <div className="flex items-center gap-2 pl-3 text-xs text-muted-foreground">
        <ArrowRight className="size-3" /> Mom signs in with Google → linked, history kept
      </div>
    </div>
  )
}

function PhonePreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[320px]">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-orange-200/50 via-sky-200/40 to-fuchsia-200/50 blur-2xl dark:from-orange-500/10 dark:via-sky-500/10 dark:to-fuchsia-500/10" />
      <div className="relative overflow-hidden rounded-[2.25rem] border-4 border-foreground/10 bg-background p-4 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xl">🏔️</span>
          <span className="font-bold tracking-tight">2026-12 Yunnan</span>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border p-2.5">
            <div className="text-[10px] text-muted-foreground">Trip total</div>
            <div className="text-sm font-semibold tabular-nums">HK$4,218.40</div>
          </div>
          <div className="rounded-xl border p-2.5">
            <div className="text-[10px] text-muted-foreground">You are owed</div>
            <div className="text-sm font-semibold text-positive tabular-nums">HK$612.00</div>
          </div>
        </div>
        <div className="mb-1 text-[10px] font-medium text-muted-foreground">Tue 22/12/2026</div>
        <div className="divide-y rounded-xl border text-xs">
          {[
            { icon: UtensilsCrossed, cls: "bg-orange-500/15 text-orange-600", t: "Hotpot dinner", s: "You paid · everyone", a: "CN¥486.00", n: "you lent CN¥364.50", pos: true },
            { icon: Receipt, cls: "bg-rose-500/15 text-rose-600", t: "Snow mountain tickets", s: "Amy paid · 3/4 settled", a: "CN¥1,200.00", n: "you owe CN¥300.00", pos: false },
            { icon: StickyNote, cls: "bg-yellow-400/20 text-yellow-700", t: "Train booked for 23/12", s: "Mom · seats 12A–C", a: null, n: null, pos: false },
          ].map(({ icon: Icon, cls, t, s, a, n, pos }) => (
            <div key={t} className="flex items-center gap-2.5 p-2.5">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", cls)}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t}</div>
                <div className="truncate text-[10px] text-muted-foreground">{s}</div>
              </div>
              {a ? (
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums">{a}</div>
                  <div className={cn("text-[10px] tabular-nums", pos ? "text-positive" : "text-negative")}>{n}</div>
                </div>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Note</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <div className="flex items-center gap-1 rounded-full border-2 border-white/70 bg-white/50 p-1 shadow-lg backdrop-blur dark:border-white/15 dark:bg-zinc-900/50">
            <span className="flex h-9 w-14 flex-col items-center justify-center rounded-full bg-zinc-900/10 text-[9px] font-semibold dark:bg-white/15">
              <Receipt className="size-3.5" /> Expenses
            </span>
            <span className="flex h-9 w-14 flex-col items-center justify-center text-[9px] text-muted-foreground">
              <Scale className="size-3.5" /> Balances
            </span>
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Plus className="size-4" />
            </span>
            <span className="flex h-9 w-14 flex-col items-center justify-center text-[9px] text-muted-foreground">
              <Users className="size-3.5" /> People
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6 md:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="grid items-center gap-12 py-12 md:grid-cols-[1.1fr_1fr] md:py-20">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            <Globe2 className="size-3.5" /> Built for trips across currencies
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
            Split the trip, <span className="text-muted-foreground">not the friendship.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
            Log what you spend on the road, tap who it was for, and Maru Split works out who owes whom — in the
            currency you settle in, at the rate of the day you paid — or the exact amount on your bank statement.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full px-6 text-base">
              <Link href="/login">
                Start a trip — free <ArrowRight />
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">Sign in with Google · friends can join without one</span>
          </div>
        </div>
        <PhonePreview />
      </section>

      {/* Highlights */}
      <section className="py-10 md:py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight md:text-4xl">What makes it different</h2>
          <p className="mt-2 text-muted-foreground">The small things that make splitting a real trip painless.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((h) => {
            const Icon = h.icon
            const big = "big" in h && h.big
            const wide = big || ("wide" in h && h.wide)
            return (
              <div
                key={h.title}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-5",
                  wide && "lg:col-span-2",
                  big && "bg-muted/40"
                )}
              >
                <span className="mb-4 grid size-10 place-items-center rounded-xl bg-foreground text-background">
                  <Icon className="size-5" />
                </span>
                <h3 className={cn("font-semibold", big && "text-lg")}>{h.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{h.body}</p>
                {"demo" in h && h.demo === "fx" ? <FxDemo /> : null}
                {"demo" in h && h.demo === "link" ? <LinkDemo /> : null}
                {"demo" in h && h.demo === "statement" ? <StatementDemo /> : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="py-10 md:py-16">
        <h2 className="mb-8 text-2xl font-bold tracking-tight md:text-4xl">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border p-5">
              <span className="mb-3 grid size-8 place-items-center rounded-full bg-foreground text-sm font-semibold text-background">
                {i + 1}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="my-10 rounded-3xl bg-foreground px-6 py-12 text-center text-background md:my-16 md:py-16">
        <h2 className="text-2xl font-bold tracking-tight md:text-4xl">Going somewhere soon?</h2>
        <p className="mx-auto mt-2 max-w-lg text-background/70">
          Set up the trip before you leave — add everyone, then just log spends as you go.
        </p>
        <Button asChild size="lg" variant="secondary" className="mt-6 h-12 rounded-full px-6 text-base">
          <Link href="/login">
            Create your first trip <ArrowRight />
          </Link>
        </Button>
      </section>

      <footer className="flex flex-col items-center gap-2 border-t py-6 text-center text-xs text-muted-foreground md:flex-row md:justify-between md:text-left">
        <span className="flex items-center gap-1.5">
          <Lock className="size-3.5" /> Trips are private to their members. Imported spreadsheets never leave your device.
        </span>
        <span>Maru Split</span>
      </footer>
    </main>
  )
}
