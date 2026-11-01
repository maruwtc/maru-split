"use client"

import { formatDay } from "@/lib/date"
import { Check, Receipt, StickyNote } from "lucide-react"
import { MemberAvatar } from "@/components/member-avatar"
import { categoryById } from "@/lib/categories"
import { baseTotal, formatMoney } from "@/lib/money"
import type { Expense, Member, Trip } from "@/lib/types"
import { cn } from "@/lib/utils"

const dayLabel = formatDay

export function ExpenseList({
  trip,
  expenses,
  membersById,
  myMemberId,
  onSelect,
}: {
  trip: Trip
  expenses: Expense[]
  membersById: Map<string, Member>
  myMemberId: string | null
  onSelect: (e: Expense) => void
}) {
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <Receipt className="size-6" />
        </div>
        <div>
          <p className="font-medium">No expenses here</p>
          <p className="text-sm text-muted-foreground">Tap “Add expense” to log the first spend.</p>
        </div>
      </div>
    )
  }

  const groups = new Map<string, Expense[]>()
  for (const e of expenses) {
    const g = groups.get(e.spent_at) ?? []
    g.push(e)
    groups.set(e.spent_at, g)
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([day, items]) => {
        const dayTotal = items.reduce((s, e) => s + baseTotal(e), 0)
        return (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between px-1 text-xs font-medium tracking-wide text-muted-foreground">
              <span>{dayLabel(day)}</span>
              <span className="tabular-nums">{formatMoney(dayTotal, trip.base_currency)}</span>
            </div>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {items.map((e) => {
                const cat = categoryById(e.category)
                const Icon = cat.icon
                const payer = membersById.get(e.paid_by)
                const mySplit = myMemberId ? e.expense_splits.find((s) => s.member_id === myMemberId) : undefined
                const myShare = Number(mySplit?.share ?? 0)
                const iPaid = myMemberId === e.paid_by
                const others = e.expense_splits.filter((s) => s.member_id !== e.paid_by)
                const settledCount = others.filter((s) => s.settled_at).length
                const allSettled = others.length > 0 && settledCount === others.length
                // What's still outstanding for me on this expense.
                const myNet = iPaid
                  ? others.filter((s) => !s.settled_at).reduce((t, s) => t + Number(s.share), 0)
                  : mySplit && !mySplit.settled_at
                    ? -myShare
                    : 0
                const isForeign = e.currency !== trip.base_currency
                const isNote = Number(e.amount) === 0
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(e)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-muted/50 active:bg-muted md:px-4",
                        allSettled && "opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl",
                          isNote ? "bg-yellow-400/20 text-yellow-700 dark:text-yellow-400" : cat.className
                        )}
                      >
                        {isNote ? <StickyNote className="size-5" /> : <Icon className="size-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.description}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {payer ? <MemberAvatar member={payer} className="size-4 [&_[data-slot=avatar-fallback]]:text-[8px]" /> : null}
                          {isNote ? (
                            <span className="truncate">
                              {iPaid ? "You" : payer?.display_name ?? "Someone"}
                              {e.notes ? ` · ${e.notes}` : ""}
                            </span>
                          ) : (
                          <span className="truncate">
                            {iPaid ? "You" : payer?.display_name ?? "Someone"} paid ·{" "}
                            {settledCount > 0 && !allSettled
                              ? `${settledCount}/${others.length} settled`
                              : e.expense_splits.length === membersById.size
                                ? "everyone"
                                : `${e.expense_splits.length} ${e.expense_splits.length === 1 ? "person" : "people"}`}
                          </span>
                          )}
                        </span>
                      </span>
                      {isNote ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Note</span>
                      ) : (
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold tabular-nums">{formatMoney(Number(e.amount), e.currency)}</span>
                        {allSettled ? (
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-medium text-positive">
                            <Check className="size-3" /> Settled
                          </span>
                        ) : myMemberId && Math.abs(myNet) >= 0.005 ? (
                          <span className={cn("block text-xs tabular-nums", myNet > 0 ? "text-positive" : "text-negative")}>
                            {myNet > 0 ? "you lent " : "you owe "}
                            {formatMoney(Math.abs(myNet), e.currency)}
                          </span>
                        ) : isForeign ? (
                          <span className="block text-xs tabular-nums text-muted-foreground">
                            {Number(e.base_amount) > 0 ? "" : "≈ "}
                            {formatMoney(baseTotal(e), trip.base_currency)}
                          </span>
                        ) : myMemberId && !iPaid && myShare === 0 ? (
                          <span className="block text-xs text-muted-foreground">not involved</span>
                        ) : null}
                      </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
