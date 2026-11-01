"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, Loader2, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MemberAvatar } from "@/components/member-avatar"
import type { MemberBalance, Transfer } from "@/lib/balances"
import { formatMoney } from "@/lib/money"
import { createClient } from "@/lib/supabase/client"
import type { Member, Settlement, Trip } from "@/lib/types"
import { cn } from "@/lib/utils"

export function BalancesPanel({
  trip,
  balances,
  transfers,
  settlements,
  membersById,
  myMemberId,
}: {
  trip: Trip
  balances: MemberBalance[]
  transfers: Transfer[]
  settlements: Settlement[]
  membersById: Map<string, Member>
  myMemberId: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const maxAbs = Math.max(1, ...balances.map((b) => Math.abs(b.net)))
  const name = (id: string) => (id === myMemberId ? "You" : membersById.get(id)?.display_name ?? "?")

  async function markPaid(t: Transfer) {
    const key = `${t.from}-${t.to}`
    setBusy(key)
    const { error } = await createClient().from("settlements").insert({
      trip_id: trip.id,
      from_member: t.from,
      to_member: t.to,
      amount: t.amount,
    })
    setBusy(null)
    if (error) return toast.error(error.message)
    toast.success(`Recorded ${name(t.from)} → ${name(t.to)}`)
    router.refresh()
  }

  async function undo(s: Settlement) {
    setBusy(s.id)
    const { error } = await createClient().from("settlements").delete().eq("id", s.id)
    setBusy(null)
    if (error) return toast.error(error.message)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          {balances.map((b) => {
            const m = membersById.get(b.memberId)
            if (!m) return null
            const pct = (Math.abs(b.net) / maxAbs) * 100
            const positive = b.net > 0.004
            const negative = b.net < -0.004
            return (
              <div key={b.memberId} className="flex items-center gap-3">
                <MemberAvatar member={m} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {m.display_name}
                      {b.memberId === myMemberId ? <span className="text-muted-foreground"> (you)</span> : null}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        positive && "text-positive",
                        negative && "text-negative",
                        !positive && !negative && "text-muted-foreground"
                      )}
                    >
                      {positive || negative ? formatMoney(b.net, trip.base_currency, { signed: true }) : "settled"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", positive ? "bg-positive" : "bg-negative")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    paid {formatMoney(b.paid, trip.base_currency)} · share {formatMoney(b.owed, trip.base_currency)}
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Settle up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4">
          {transfers.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-3 text-sm text-accent-foreground">
              <CheckCircle2 className="size-4 text-positive" /> Everyone is settled up.
            </div>
          ) : (
            transfers.map((t) => {
              const from = membersById.get(t.from)!
              const to = membersById.get(t.to)!
              const key = `${t.from}-${t.to}`
              return (
                <div key={key} className="flex items-center gap-2 rounded-xl border p-2.5">
                  <MemberAvatar member={from} className="size-7" />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="truncate font-medium">{name(t.from)}</span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{name(t.to)}</span>
                    </div>
                    <div className="font-semibold tabular-nums">{formatMoney(t.amount, trip.base_currency)}</div>
                  </div>
                  <MemberAvatar member={to} className="size-7" />
                  <Button size="sm" variant="secondary" onClick={() => markPaid(t)} disabled={busy === key}>
                    {busy === key ? <Loader2 className="animate-spin" /> : null}
                    Paid
                  </Button>
                </div>
              )
            })
          )}

          {settlements.length > 0 ? (
            <div className="pt-2">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recorded payments</div>
              <ul className="divide-y text-sm">
                {settlements.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate">
                      {name(s.from_member)} paid {name(s.to_member)}{" "}
                      <span className="font-medium tabular-nums">{formatMoney(Number(s.amount), trip.base_currency)}</span>
                    </span>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => undo(s)} disabled={busy === s.id} aria-label="Undo payment">
                      {busy === s.id ? <Loader2 className="animate-spin" /> : <Undo2 />}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
