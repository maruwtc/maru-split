import Link from "next/link"
import { CalendarDays, Plane, Users } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { NewTripButton } from "@/components/trips/new-trip-button"
import { requireUser } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/money"

export const metadata = { title: "Your trips" }

function formatRange(start: string | null, end: string | null) {
  if (!start) return null
  const f = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" })
  const year = new Date(start + "T00:00:00").getFullYear()
  return end && end !== start ? `${f(start)} – ${f(end)}, ${year}` : `${f(start)}, ${year}`
}

export default async function TripsPage() {
  const { supabase, user } = await requireUser("/trips")

  const { data: trips } = await supabase
    .from("trips")
    .select("id, name, emoji, base_currency, start_date, end_date, created_at, trip_members(count), expenses(amount, fx_rate)")
    .order("start_date", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Your trips</h1>
            <p className="text-sm text-muted-foreground">Pick a trip or start a new one.</p>
          </div>
          <NewTripButton />
        </div>

        {!trips?.length ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
              <Plane className="size-7" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">No trips yet</h2>
              <p className="text-sm text-muted-foreground">Create a trip and invite your travel buddies.</p>
            </div>
            <NewTripButton />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => {
              const total = (t.expenses as { amount: number; fx_rate: number }[]).reduce(
                (s, e) => s + Number(e.amount) * Number(e.fx_rate),
                0
              )
              const members = (t.trip_members as { count: number }[])[0]?.count ?? 0
              const range = formatRange(t.start_date, t.end_date)
              return (
                <li key={t.id}>
                  <Link
                    href={`/trips/${t.id}`}
                    className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-2xl">{t.emoji}</span>
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">{t.name}</h2>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {range ? (
                            <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{range}</span>
                          ) : null}
                          <span className="flex items-center gap-1"><Users className="size-3.5" />{members}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-auto">
                      <div className="text-xs text-muted-foreground">Total spent</div>
                      <div className="text-xl font-semibold tabular-nums">{formatMoney(total, t.base_currency)}</div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
