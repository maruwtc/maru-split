"use client"

import { useMemo, useState } from "react"
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
  members,
  expense,
  defaultPayer,
  defaultCurrency,
  onDone,
  onCurrencyUsed,
}: {
  trip: Trip
  members: Member[]
  expense?: Expense | null
  defaultPayer?: string
  defaultCurrency?: string
  onDone: (saved: boolean) => void
  onCurrencyUsed?: (currency: string) => void
}) {
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
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? defaultPayer ?? members[0]?.id)
  const [spentAt, setSpentAt] = useState(expense?.spent_at ?? today())
  const [notes, setNotes] = useState(expense?.notes ?? "")
  const [mode, setMode] = useState<SplitMode>(expense?.split_mode ?? "equal")
  const [selected, setSelected] = useState<string[]>(
    expense ? expense.expense_splits.map((s) => s.member_id) : members.map((m) => m.id)
  )
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const s of expense?.expense_splits ?? []) {
      init[s.member_id] = String(expense?.split_mode === "shares" ? (s.weight ?? 1) : s.share)
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const amountNum = Number(amount) || 0
  const orderedSelected = members.map((m) => m.id).filter((id) => selected.includes(id))
  const numericInputs = Object.fromEntries(
    orderedSelected.map((id) => [id, inputs[id] === undefined || inputs[id] === "" ? (mode === "shares" ? 1 : 0) : Number(inputs[id])])
  )
  const shares = computeShares(amountNum, mode, orderedSelected, numericInputs)
  const shareSumCents = Object.values(shares).reduce((s, v) => s + toCents(v), 0)
  const diffCents = toCents(amountNum) - shareSumCents
  const isForeign = currency !== trip.base_currency

  function toggleMember(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function changeCurrency(c: string) {
    setCurrency(c)
    setFxRate(String(rateFor(c, trip.base_currency, trip.fx_rates)))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (amountNum <= 0) return toast.error("Enter an amount")
    if (!description.trim()) return toast.error("Add a description")
    if (!paidBy) return toast.error("Choose who paid")
    if (orderedSelected.length === 0) return toast.error("Pick at least one person to split with")
    if (diffCents !== 0) return toast.error("Split amounts must add up to the total")
    const rate = isForeign ? Number(fxRate) : 1
    if (!(rate > 0)) return toast.error("Enter a valid exchange rate")

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("save_expense", {
      p_trip_id: trip.id,
      p_expense_id: expense?.id ?? null,
      p_description: description.trim(),
      p_category: category,
      p_amount: amountNum,
      p_currency: currency,
      p_fx_rate: rate,
      p_paid_by: paidBy,
      p_split_mode: mode,
      p_spent_at: spentAt,
      p_notes: notes.trim() || null,
      p_splits: orderedSelected.map((id) => ({
        member_id: id,
        share: shares[id] ?? 0,
        weight: mode === "shares" ? numericInputs[id] : null,
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
    <form onSubmit={save} className="space-y-5 pb-2">
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
            autoFocus={!expense}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12 bg-background text-2xl font-semibold tabular-nums md:text-2xl"
            required
          />
        </div>
        {isForeign ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0">1 {currency} =</span>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value)}
              className="h-8 w-24 bg-background"
              aria-label="Exchange rate"
            />
            <span className="shrink-0">{trip.base_currency}</span>
            <span className="ml-auto shrink-0 font-medium text-foreground tabular-nums">
              ≈ {formatMoney(amountNum * (Number(fxRate) || 0), trip.base_currency)}
            </span>
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
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-1 [scrollbar-width:none]">
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
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                <Icon className="size-4" />
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Paid by */}
      <div className="space-y-2">
        <Label>Paid by</Label>
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
        </div>
      </div>

      {/* Split */}
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

      {/* Date + notes */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="spent-at">Date</Label>
          <Input id="spent-at" type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} className="h-11" required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {expense ? (
          <Button type="button" variant="outline" size="lg" className="h-12" onClick={remove} disabled={deleting || saving} aria-label="Delete expense">
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 className="text-destructive" />}
          </Button>
        ) : null}
        <Button type="submit" size="lg" className="h-12 flex-1 text-base" disabled={saving || deleting}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {expense ? "Save changes" : "Add expense"}
        </Button>
      </div>
    </form>
  )
}
