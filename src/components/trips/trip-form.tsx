"use client"

import { useState } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CurrencySelect } from "./currency-select"
import { cn } from "@/lib/utils"

const EMOJIS = ["✈️", "🏔️", "🏖️", "🏯", "🚗", "🎒", "🍜", "🗺️", "🚆", "⛺"]

export interface TripFormValues {
  name: string
  emoji: string
  base_currency: string
  start_date: string | null
  end_date: string | null
  fx_rates: Record<string, number>
  /** Only when creating: names of people without an account. */
  people?: string[]
}

export function TripForm({
  initial,
  submitLabel,
  onSubmit,
  withPeople = false,
}: {
  withPeople?: boolean
  initial?: Partial<TripFormValues>
  submitLabel: string
  onSubmit: (v: TripFormValues) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [emoji, setEmoji] = useState(initial?.emoji ?? "✈️")
  const [base, setBase] = useState(initial?.base_currency ?? "HKD")
  const [start, setStart] = useState(initial?.start_date ?? "")
  const [end, setEnd] = useState(initial?.end_date ?? "")
  const [rates, setRates] = useState<{ currency: string; rate: string }[]>(
    Object.entries(initial?.fx_rates ?? {}).map(([currency, rate]) => ({ currency, rate: String(rate) }))
  )
  const [saving, setSaving] = useState(false)
  const [people, setPeople] = useState<string[]>([])
  const [person, setPerson] = useState("")

  function addPerson() {
    const n = person.trim()
    if (n && !people.includes(n)) setPeople((p) => [...p, n])
    setPerson("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const fx: Record<string, number> = {}
      for (const r of rates) {
        const n = Number(r.rate)
        if (r.currency && r.currency !== base && n > 0) fx[r.currency] = n
      }
      await onSubmit({
        name: name.trim(),
        emoji,
        base_currency: base,
        start_date: start || null,
        end_date: end || null,
        fx_rates: fx,
        ...(withPeople ? { people: person.trim() ? [...people, person.trim()] : people } : {}),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-2">
      <div className="space-y-2">
        <Label htmlFor="trip-name">Trip name</Label>
        <Input id="trip-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Yunnan 2026" required maxLength={100} className="h-11" />
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setEmoji(em)}
              className={cn(
                "grid size-10 place-items-center rounded-lg border text-xl transition",
                emoji === em ? "border-primary bg-accent ring-2 ring-primary/15" : "hover:bg-muted"
              )}
              aria-pressed={emoji === em}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="start">Start</Label>
          <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">End</Label>
          <Input id="end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className="h-11" />
        </div>
      </div>

      {withPeople ? (
        <div className="space-y-2">
          <Label htmlFor="person">Travelling with</Label>
          <div className="flex gap-2">
            <Input
              id="person"
              value={person}
              maxLength={50}
              placeholder="Add a name, e.g. Mom"
              onChange={(e) => setPerson(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addPerson()
                }
              }}
              className="h-11"
            />
            <Button type="button" variant="outline" className="h-11 shrink-0" onClick={addPerson} disabled={!person.trim()}>
              <Plus /> Add
            </Button>
          </div>
          {people.length ? (
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => (
                <span key={p} className="flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm">
                  {p}
                  <button type="button" onClick={() => setPeople((ps) => ps.filter((x) => x !== p))} className="grid size-5 place-items-center rounded-full hover:bg-background" aria-label={`Remove ${p}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">No account needed. They can sign in later and link to their name.</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="base">Settle-up currency</Label>
        <CurrencySelect id="base" value={base} onChange={setBase} className="h-11 w-full" />
        <p className="text-xs text-muted-foreground">Balances are shown in this currency.</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Exchange rates</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRates((r) => [...r, { currency: base === "CNY" ? "HKD" : "CNY", rate: "" }])}>
            <Plus /> Add
          </Button>
        </div>
        {rates.length === 0 ? (
          <p className="text-xs text-muted-foreground">Spending in another currency? Add its rate here.</p>
        ) : null}
        {rates.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted-foreground">1</span>
            <CurrencySelect
              value={r.currency}
              onChange={(v) => setRates((rs) => rs.map((x, j) => (j === i ? { ...x, currency: v } : x)))}
              className="h-10"
            />
            <span className="shrink-0 text-muted-foreground">=</span>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={r.rate}
              onChange={(e) => setRates((rs) => rs.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))}
              placeholder="1.08"
              className="h-10"
            />
            <span className="w-10 shrink-0 text-muted-foreground">{base}</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => setRates((rs) => rs.filter((_, j) => j !== i))} aria-label="Remove rate">
              <X />
            </Button>
          </div>
        ))}
      </div>

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={saving || !name.trim()}>
        {saving ? <Loader2 className="animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  )
}
