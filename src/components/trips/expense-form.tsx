"use client"

import { DateInput } from "@/components/date-input"
import { useEffect, useMemo, useState } from "react"
import { AddPersonChip } from "./add-person-chip"
import { useIsDesktop } from "@/hooks/use-media-query"
import { fetchDayRate, roundRate, type DayRate } from "@/lib/fx"
import { formatDate } from "@/lib/date"
import { Check, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MemberAvatar } from "@/components/member-avatar"
import { CurrencySelect } from "./currency-select"
import { CATEGORIES } from "@/lib/categories"
import { formatMoney, rateFor, toCents } from "@/lib/money"
import { computeShares } from "@/lib/split"
import { createClient } from "@/lib/supabase/client"
import type { Expense, Member, SplitMode, Trip } from "@/lib/types"
import { cn } from "@/lib/utils"

const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function ExpenseForm({
  trip,
  members: baseMembers,
  expense,
  defaultPayer,
  defaultCurrency,
  onDone,
  onCurrencyUsed,
  onMemberAdded,
  onSettledChange,
}: {
  trip: Trip
  members: Member[]
  expense?: Expense | null
  defaultPayer?: string
  defaultCurrency?: string
  onDone: (saved: boolean) => void
  onCurrencyUsed?: (currency: string) => void
  onMemberAdded?: () => void
  onSettledChange?: () => void
}) {
  // On phones, don't pop the keyboard while the sheet is opening — it shoves the sheet up.
  const isDesktop = useIsDesktop()
  // People added from inside the form show up immediately.
  const [added, setAdded] = useState<Member[]>([])
  const members = useMemo(
    () => [...baseMembers, ...added.filter((a) => !baseMembers.some((m) => m.id === a.id))],
    [baseMembers, added]
  )
  const currencyOptions = useMemo(
    () => [trip.base_currency, ...Object.keys(trip.fx_rates ?? {})],
    [trip.base_currency, trip.fx_rates]
  )

  const [amount, setAmount] = useState(expense ? String(expense.amount) : "")
  const [currency, setCurrency] = useState(expense?.currency ?? defaultCurrency ?? currencyOptions[0])
  const [fxRate, setFxRate] = useState(
    String(expense?.fx_rate ?? rateFor(currency, trip.base_currency, trip.fx_rates))
  )
  const [description, setDescription] = useState(expense?.description ?? "")
  const [category, setCategory] = useState(expense?.category ?? "food")
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? defaultPayer ?? baseMembers[0]?.id)
  const [spentAt, setSpentAt] = useState(expense?.spent_at ?? today())
  // "auto": use that day's market rate; "manual": keep what's typed / stored.
  const [rateMode, setRateMode] = useState<"auto" | "manual">(expense ? "manual" : "auto")
  const [dayRate, setDayRate] = useState<{ key: string; info: DayRate | null } | null>(null)
  const [notes, setNotes] = useState(expense?.notes ?? "")
  const [mode, setMode] = useState<SplitMode>(expense?.split_mode ?? "equal")
  const [selected, setSelected] = useState<string[]>(
    expense ? expense.expense_splits.map((s) => s.member_id) : baseMembers.map((m) => m.id)
  )
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const s of expense?.expense_splits ?? []) {
      init[s.member_id] = String(expense?.split_mode === "shares" ? (s.weight ?? 1) : s.share)
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [settled, setSettled] = useState<Set<string>>(
    () => new Set((expense?.expense_splits ?? []).filter((s) => s.settled_at).map((s) => s.member_id))
  )
  const [settling, setSettling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const amountNum = Number(amount) || 0
  // No amount → a note / remark: no split, no effect on balances.
  const isNote = amountNum <= 0
  const orderedSelected = members.map((m) => m.id).filter((id) => selected.includes(id))
  const numericInputs = Object.fromEntries(
    orderedSelected.map((id) => [id, inputs[id] === undefined || inputs[id] === "" ? (mode === "shares" ? 1 : 0) : Number(inputs[id])])
  )
  const shares = computeShares(amountNum, mode, orderedSelected, numericInputs)
  const shareSumCents = Object.values(shares).reduce((s, v) => s + toCents(v), 0)
  const diffCents = toCents(amountNum) - shareSumCents
  const isForeign = currency !== trip.base_currency
  const rateKey = `${currency}|${spentAt}`
  const rateLoading = isForeign && rateMode === "auto" && dayRate?.key !== rateKey

  useEffect(() => {
    if (!isForeign || rateMode !== "auto" || !spentAt) return
    let cancelled = false
    const key = `${currency}|${spentAt}`
    fetchDayRate(currency, trip.base_currency, spentAt).then((info) => {
      if (cancelled) return
      setDayRate({ key, info })
      setFxRate(String(info ? roundRate(info.rate) : rateFor(currency, trip.base_currency, trip.fx_rates)))
    })
    return () => {
      cancelled = true
    }
  }, [currency, spentAt, rateMode, isForeign, trip.base_currency, trip.fx_rates])

  function changeDate(d: string) {
    setSpentAt(d)
    if (isForeign) setRateMode("auto")
  }

  function toggleMember(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function changeCurrency(c: string) {
    setCurrency(c)
    setFxRate(String(rateFor(c, trip.base_currency, trip.fx_rates)))
    setRateMode("auto")
  }

  // People who owe the payer on this expense.
  const debtors = orderedSelected.filter((id) => id !== paidBy)
  const savedSplitIds = new Set((expense?.expense_splits ?? []).map((s) => s.member_id))

  /** Toggle "paid back". On a saved expense this is stored right away — anyone in the trip can do it. */
  async function setPaidBack(ids: string[], value: boolean) {
    const next = new Set(settled)
    ids.forEach((id) => (value ? next.add(id) : next.delete(id)))
    setSettled(next)
    const live = expense ? ids.filter((id) => savedSplitIds.has(id) && expense.paid_by === paidBy) : []
    if (!expense || live.length === 0) return
    setSettling(ids.length > 1 ? "all" : ids[0])
    const { error } = await createClient()
      .from("expense_splits")
      .update({ settled_at: value ? new Date().toISOString() : null })
      .eq("expense_id", expense.id)
      .in("member_id", live)
    setSettling(null)
    if (error) {
      setSettled(settled)
      return toast.error(error.message)
    }
    const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? "Someone"
    toast.success(
      ids.length > 1
        ? value ? "Marked as settled" : "Marked as not settled"
        : value ? `${name(ids[0])} paid back` : `${name(ids[0])} not paid back yet`
    )
    onSettledChange?.()
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return toast.error(isNote ? "Write the note" : "Add a description")
    if (!paidBy) return toast.error(isNote ? "Choose who added it" : "Choose who paid")
    if (!isNote && orderedSelected.length === 0) return toast.error("Pick at least one person to split with")
    if (!isNote && diffCents !== 0) return toast.error("Split amounts must add up to the total")
    const rate = isForeign && !isNote ? Number(fxRate) : 1
    if (!(rate > 0)) return toast.error("Enter a valid exchange rate")

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("save_expense", {
      p_trip_id: trip.id,
      p_expense_id: expense?.id ?? null,
      p_description: description.trim(),
      p_category: category,
      p_amount: isNote ? 0 : amountNum,
      p_currency: currency,
      p_fx_rate: rate,
      p_paid_by: paidBy,
      p_split_mode: mode,
      p_spent_at: spentAt,
      p_notes: notes.trim() || null,
      p_splits: isNote ? [] : orderedSelected.map((id) => ({
        member_id: id,
        share: shares[id] ?? 0,
        weight: mode === "shares" ? numericInputs[id] : null,
        settled: id !== paidBy && settled.has(id),
      })),
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    onCurrencyUsed?.(currency)
    toast.success(expense ? "Expense updated" : "Expense added")
    onDone(true)
  }

  async function remove() {
    if (!expense) return
    if (!confirm(`Delete “${expense.description}”?`)) return
    setDeleting(true)
    const { error } = await createClient().from("expenses").delete().eq("id", expense.id)
    setDeleting(false)
    if (error) return toast.error(error.message)
    toast.success("Expense deleted")
    onDone(true)
  }

  return (
    <form onSubmit={save} className="min-w-0 space-y-5">
      {/* Amount */}
      <div className="rounded-xl bg-muted/60 p-4">
        <Label htmlFor="amount" className="text-xs text-muted-foreground">Amount</Label>
        <div className="mt-1 flex items-center gap-2">
          <CurrencySelect value={currency} onChange={changeCurrency} options={currencyOptions} className="h-12 bg-background" />
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            autoFocus={!expense && isDesktop}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12 bg-background text-2xl font-semibold tabular-nums md:text-2xl"
          />
        </div>
        {isNote ? (
          <p className="mt-2 text-xs text-muted-foreground">No amount? It&apos;ll be saved as a note — handy for reminders and remarks.</p>
        ) : null}
        {isForeign && !isNote ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0">1 {currency} =</span>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={fxRate}
              onChange={(e) => {
                setFxRate(e.target.value)
                setRateMode("manual")
              }}
              className="h-8 w-24 bg-background"
              aria-label="Exchange rate"
            />
            <span className="shrink-0">{trip.base_currency}</span>
            <span className="ml-auto shrink-0 font-medium text-foreground tabular-nums">
              ≈ {formatMoney(amountNum * (Number(fxRate) || 0), trip.base_currency)}
            </span>
          </div>
        ) : null}
        {isForeign && !isNote ? (
          <div className="mt-1.5 flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground">
            {rateMode === "manual" ? (
              <>
                <span>Custom rate ·</span>
                <button type="button" className="font-medium text-foreground hover:underline" onClick={() => setRateMode("auto")}>
                  Use rate for {formatDate(spentAt)}
                </button>
              </>
            ) : rateLoading ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Getting rate for {formatDate(spentAt)}…
              </>
            ) : dayRate?.info ? (
              <>
                <Check className="size-3" />
                {dayRate.info.latest
                  ? "Latest rate (date is today or later)"
                  : dayRate.info.date === spentAt
                    ? `Rate for ${formatDate(spentAt)}`
                    : `Rate for ${formatDate(spentAt)} (from ${formatDate(dayRate.info.date)})`}
              </>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Couldn&apos;t get that day&apos;s rate — using the trip rate. You can type one.</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Description + category */}
      <div className="space-y-2">
        <Label htmlFor="description">What for?</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dinner at the old town"
          maxLength={200}
          className="h-11"
          required
        />
        <div className="grid grid-cols-4 gap-2 pt-1">
          {CATEGORIES.map((c) => {
            const Icon = c.icon
            const active = category === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={active}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2 text-xs transition",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                <Icon className="size-4" />
                <span className="w-full truncate text-center">{c.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Paid by */}
      <div className="space-y-2">
        <Label>{isNote ? "Added by" : "Paid by"}</Label>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const active = paidBy === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaidBy(m.id)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition",
                  active ? "border-primary bg-accent ring-2 ring-primary/15" : "hover:bg-muted"
                )}
              >
                <MemberAvatar member={m} className="size-7" />
                {m.display_name}
              </button>
            )
          })}
          <AddPersonChip
            tripId={trip.id}
            onAdded={(m) => {
              setAdded((a) => [...a, m])
              setSelected((sel) => [...sel, m.id])
              onMemberAdded?.()
            }}
          />
        </div>
      </div>

      {/* Split */}
      {!isNote ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Split between</Label>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={mode}
            onValueChange={(v) => v && setMode(v as SplitMode)}
          >
            <ToggleGroupItem value="equal" className="px-3">Equal</ToggleGroupItem>
            <ToggleGroupItem value="exact" className="px-3">Exact</ToggleGroupItem>
            <ToggleGroupItem value="shares" className="px-3">Shares</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex gap-2 text-xs">
          <button type="button" className="text-primary hover:underline" onClick={() => setSelected(members.map((m) => m.id))}>
            Select all
          </button>
          <span className="text-muted-foreground">·</span>
          <button type="button" className="text-primary hover:underline" onClick={() => setSelected([])}>
            Clear
          </button>
          <span className="ml-auto text-muted-foreground">
            {orderedSelected.length} of {members.length} people
          </span>
        </div>

        <ul className="divide-y overflow-hidden rounded-xl border">
          {members.map((m) => {
            const active = selected.includes(m.id)
            return (
              <li key={m.id} className={cn("flex items-center gap-3 px-3 py-2.5 transition", !active && "opacity-60")}>
                <button
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-pressed={active}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md border transition",
                      active ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                    )}
                  >
                    {active ? <Check className="size-3.5" /> : null}
                  </span>
                  <MemberAvatar member={m} className="size-7" />
                  <span className="truncate text-sm font-medium">{m.display_name}</span>
                </button>

                {active && mode !== "equal" ? (
                  <Input
                    type="number"
                    inputMode="decimal"
                    step={mode === "shares" ? "0.5" : "0.01"}
                    min="0"
                    value={inputs[m.id] ?? ""}
                    placeholder={mode === "shares" ? "1" : "0.00"}
                    onChange={(e) => setInputs((s) => ({ ...s, [m.id]: e.target.value }))}
                    className="h-9 w-20 text-right tabular-nums"
                    aria-label={`${m.display_name} ${mode === "shares" ? "shares" : "amount"}`}
                  />
                ) : null}

                <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {active ? formatMoney(shares[m.id] ?? 0, currency) : "—"}
                </span>
              </li>
            )
          })}
        </ul>

        {mode === "exact" && amountNum > 0 && diffCents !== 0 ? (
          <p className="text-sm text-destructive">
            {diffCents > 0
              ? `${formatMoney(diffCents / 100, currency)} left to assign`
              : `${formatMoney(-diffCents / 100, currency)} over the total`}
          </p>
        ) : null}
      </div>
      ) : null}

      {/* Paid back */}
      {!isNote && debtors.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Paid back</Label>
            {debtors.every((id) => settled.has(id)) ? (
              <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setPaidBack(debtors, false)} disabled={!!settling}>
                Mark not settled
              </button>
            ) : (
              <button type="button" className="text-xs font-medium hover:underline" onClick={() => setPaidBack(debtors, true)} disabled={!!settling}>
                {settling === "all" ? "Saving…" : "Mark all settled"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {debtors.map((id) => {
              const m = members.find((x) => x.id === id)
              if (!m) return null
              const on = settled.has(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaidBack([id], !on)}
                  disabled={!!settling}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition",
                    on ? "border-positive/40 bg-positive/10 text-positive" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <MemberAvatar member={m} className="size-6" />
                  {m.display_name}
                  {settling === id ? <Loader2 className="size-3.5 animate-spin" /> : on ? <Check className="size-3.5" /> : null}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Tap a person once they&apos;ve paid {members.find((m) => m.id === paidBy)?.display_name ?? "the payer"} back for this.
            {expense ? " Saved instantly — anyone on the trip can mark it." : ""}
          </p>
        </div>
      ) : null}

      {/* Date + notes */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="spent-at">Date</Label>
          <DateInput id="spent-at" value={spentAt} onChange={changeDate} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      {/* Action bar: stays pinned to the bottom of the sheet / dialog while scrolling */}
      <div className="sticky bottom-0 z-10 -mx-4 flex gap-2 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 md:pb-6">
        {expense ? (
          <Button type="button" variant="outline" size="lg" className="h-12" onClick={remove} disabled={deleting || saving} aria-label="Delete expense">
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 className="text-destructive" />}
          </Button>
        ) : null}
        <Button type="submit" size="lg" className="h-12 flex-1 text-base" disabled={saving || deleting}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {isNote ? (expense ? "Save note" : "Add note") : expense ? "Save changes" : "Add expense"}
        </Button>
      </div>
    </form>
  )
}
