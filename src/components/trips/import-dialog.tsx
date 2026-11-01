"use client"

import { formatDate } from "@/lib/date"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Check, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { CurrencySelect } from "./currency-select"
import { categoryById } from "@/lib/categories"
import {
  cellText,
  collectNames,
  columnLetter,
  guessMapping,
  nameKey,
  parseRows,
  resolveSplit,
  type Grid,
  type Mapping,
  type ParsedRow,
} from "@/lib/import"
import { addPeople } from "@/lib/members"
import { fetchDayRate, roundRate } from "@/lib/fx"
import { formatMoney } from "@/lib/money"
import { createClient } from "@/lib/supabase/client"
import type { Expense, Member, Trip } from "@/lib/types"
import { cn } from "@/lib/utils"

type Step = "file" | "columns" | "people" | "review"
const NEW = "__new__"
const NONE = "__none__"

interface SheetGrid {
  name: string
  grid: Grid
}

async function readFile(file: File): Promise<SheetGrid[]> {
  if (/\.csv$|\.tsv$|\.txt$/i.test(file.name) || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default
    const text = await file.text()
    const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false })
    return [{ name: file.name, grid: res.data as Grid }]
  }
  const { default: readXlsxFile } = await import("read-excel-file/browser")
  const sheets = await readXlsxFile(file)
  return sheets.map((s) => ({ name: s.sheet, grid: s.data as unknown as Grid }))
}

export function ImportDialog({
  open,
  onOpenChange,
  trip,
  members,
  expenses,
  myMemberId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  trip: Trip
  members: Member[]
  expenses: Expense[]
  myMemberId: string | null
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("file")
  const [fileName, setFileName] = useState("")
  const [sheets, setSheets] = useState<SheetGrid[]>([])
  const [sheetIdx, setSheetIdx] = useState(0)
  const [map, setMap] = useState<Mapping | null>(null)
  const [defaultCurrency, setDefaultCurrency] = useState(Object.keys(trip.fx_rates ?? {})[0] ?? trip.base_currency)
  const [people, setPeople] = useState<Record<string, string>>({}) // nameKey -> member id | NEW
  const [defaultPayer, setDefaultPayer] = useState(myMemberId ?? members[0]?.id ?? "")
  const [rates, setRates] = useState<Record<string, string>>({})
  const [dailyAuto, setDailyAuto] = useState(true)
  const [dayRates, setDayRates] = useState<Record<string, number | null>>({})
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [notesIn, setNotesIn] = useState<Set<number>>(new Set()) // price-less rows to import as notes
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const grid = useMemo<Grid>(() => sheets[sheetIdx]?.grid ?? [], [sheets, sheetIdx])
  const headers = map ? (grid[map.headerRow] ?? []).map(cellText) : []
  const colCount = Math.max(0, ...grid.slice(0, 60).map((r) => r?.length ?? 0))

  const opts = useMemo(
    () => ({
      defaultCurrency,
      defaultYear: Number((trip.start_date ?? new Date().toISOString()).slice(0, 4)),
      defaultDate: trip.start_date ?? new Date().toISOString().slice(0, 10),
    }),
    [defaultCurrency, trip.start_date]
  )
  const rows: ParsedRow[] = useMemo(() => (map ? parseRows(grid, map, opts) : []), [grid, map, opts])
  const importable = rows.filter((r) => r.amount > 0)
  const names = useMemo(() => collectNames(rows), [rows])

  const memberByKey = useMemo(() => new Map(members.map((m) => [nameKey(m.display_name), m])), [members])
  const existingKeys = useMemo(
    () => new Set(expenses.map((e) => `${e.spent_at}|${Number(e.amount).toFixed(2)}|${e.description.trim().toLowerCase()}`)),
    [expenses]
  )
  const isDuplicate = (r: ParsedRow) => existingKeys.has(`${r.date}|${r.amount.toFixed(2)}|${r.description.trim().toLowerCase()}`)

  const includedNotes = rows.filter((r) => r.isNote && notesIn.has(r.rowNumber))
  const included = [
    ...importable.filter((r) => !excluded.has(r.rowNumber) && !(skipDuplicates && isDuplicate(r))),
    ...includedNotes,
  ]
  const duplicates = importable.filter(isDuplicate).length

  // Rows in another currency without a rate in the sheet → that day's market rate.
  const dayKey = (r: ParsedRow) => `${r.currency}|${r.date}`
  const foreignRows = included.filter((r) => r.amount > 0 && r.currency !== trip.base_currency && !r.fxRate)
  const autoKeys = dailyAuto ? [...new Set(foreignRows.map(dayKey))] : []
  const pendingKeys = autoKeys.filter((k) => !(k in dayRates))
  const ratesLoading = step === "review" && pendingKeys.length > 0
  const dayRateFor = (r: ParsedRow) => (dailyAuto ? dayRates[dayKey(r)] ?? null : null)
  const pendingSig = pendingKeys.join(",")

  useEffect(() => {
    if (step !== "review" || !pendingSig) return
    let cancelled = false
    for (const k of pendingSig.split(",")) {
      const [c, d] = k.split("|")
      fetchDayRate(c, trip.base_currency, d).then((info) => {
        if (!cancelled) setDayRates((m) => ({ ...m, [k]: info ? roundRate(info.rate) : null }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [step, pendingSig, trip.base_currency])

  // Currencies still needing a typed fallback rate.
  const needRates = [...new Set(foreignRows.filter((r) => !dayRateFor(r)).map((r) => r.currency))]
  const rateFor = (r: ParsedRow) =>
    r.currency === trip.base_currency
      ? 1
      : r.fxRate ?? dayRateFor(r) ?? (Number(rates[r.currency]) || Number(trip.fx_rates?.[r.currency]) || 0)
  const missingRate = ratesLoading ? [] : needRates.filter((c) => !(Number(rates[c]) > 0) && !(Number(trip.fx_rates?.[c]) > 0))
  const autoCurrencies = [...new Set(foreignRows.filter((r) => dayRateFor(r)).map((r) => r.currency))]
  const autoDays = new Set(foreignRows.filter((r) => dayRateFor(r)).map((r) => r.date)).size
  const totalBase = included.reduce((s, r) => s + r.amount * rateFor(r), 0)

  function reset() {
    setStep("file")
    setSheets([])
    setMap(null)
    setExcluded(new Set())
    setProgress(0)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const s = (await readFile(file)).filter((x) => x.grid.length)
      if (!s.length) throw new Error("The file looks empty")
      // Pick the sheet with the most rows by default.
      const best = s.reduce((bi, x, i) => (x.grid.length > s[bi].grid.length ? i : bi), 0)
      setSheets(s)
      setFileName(file.name)
      selectSheet(s, best)
      setStep("columns")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file")
    } finally {
      setBusy(false)
    }
  }

  function selectSheet(s: SheetGrid[], i: number) {
    setSheetIdx(i)
    setMap(guessMapping(s[i].grid, members.map((m) => m.display_name)))
    setExcluded(new Set())
  }

  /** Exact name, else a unique first-name / prefix match ("Chris" → "Chris Wong"). */
  function matchMember(n: string): string | null {
    const k = nameKey(n)
    const exact = memberByKey.get(k)
    if (exact) return exact.id
    const candidates = members.filter((m) => {
      const mk = nameKey(m.display_name)
      return mk.split(/\s+/)[0] === k || mk.startsWith(k + " ") || k.startsWith(mk + " ")
    })
    return candidates.length === 1 ? candidates[0].id : null
  }

  function goPeople() {
    const next: Record<string, string> = {}
    for (const n of names) next[nameKey(n)] = people[nameKey(n)] ?? matchMember(n) ?? NEW
    setPeople(next)
    setStep(names.length ? "people" : "review")
  }

  async function runImport() {
    setBusy(true)
    setProgress(0)
    const supabase = createClient()
    try {
      // 1. Create people without accounts.
      const toCreate = names.filter((n) => people[nameKey(n)] === NEW)
      const idByKey = new Map<string, string>()
      for (const n of names) if (people[nameKey(n)] !== NEW) idByKey.set(nameKey(n), people[nameKey(n)])
      if (toCreate.length) {
        const { data, error } = await addPeople(trip.id, toCreate)
        if (error) throw error
        data.forEach((m) => idByKey.set(nameKey(m.display_name), m.id))
      }
      const allIds = [...new Set([...members.map((m) => m.id), ...idByKey.values()])]
      const idFor = (n: string) => idByKey.get(nameKey(n)) ?? matchMember(n)

      // 2. Remember new exchange rates on the trip.
      const newRates: Record<string, number> = {}
      for (const c of needRates) if (Number(rates[c]) > 0) newRates[c] = Number(rates[c])
      if (Object.keys(newRates).length) {
        await supabase.from("trips").update({ fx_rates: { ...trip.fx_rates, ...newRates } }).eq("id", trip.id)
      }

      // 3. Expenses, a few at a time.
      let ok = 0
      const failures: string[] = []
      const queue = [...included]
      const worker = async () => {
        for (let r = queue.shift(); r; r = queue.shift()) {
          if (r.isNote) {
            const { error } = await supabase.rpc("save_expense", {
              p_trip_id: trip.id,
              p_expense_id: null,
              p_description: r.description.slice(0, 200),
              p_category: r.category,
              p_amount: 0,
              p_currency: trip.base_currency,
              p_fx_rate: 1,
              p_paid_by: (r.payerName && idFor(r.payerName)) || defaultPayer,
              p_split_mode: "equal",
              p_spent_at: r.date,
              p_notes: r.notes,
              p_splits: [],
            })
            if (error) failures.push(`Row ${r.rowNumber}: ${error.message}`)
            else ok++
            setProgress((p) => p + 1)
            continue
          }
          const split = resolveSplit(r, idFor, allIds)
          const payer = (r.payerName && idFor(r.payerName)) || defaultPayer
          if ("error" in split || !payer) {
            failures.push(`Row ${r.rowNumber}: ${"error" in split ? split.error : "no payer"}`)
          } else {
            const { error } = await supabase.rpc("save_expense", {
              p_trip_id: trip.id,
              p_expense_id: null,
              p_description: r.description.slice(0, 200),
              p_category: r.category,
              p_amount: r.amount,
              p_currency: r.currency,
              p_fx_rate: rateFor(r) || 1,
              p_paid_by: payer,
              p_split_mode: split.mode,
              p_spent_at: r.date,
              p_notes: r.notes,
              p_splits: split.splits,
            })
            if (error) failures.push(`Row ${r.rowNumber}: ${error.message}`)
            else ok++
          }
          setProgress((p) => p + 1)
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])

      if (failures.length) {
        toast.warning(`Imported ${ok} of ${included.length} expenses`, { description: failures.slice(0, 4).join("\n") })
      } else {
        toast.success(`Imported ${ok} expenses${toCreate.length ? ` and ${toCreate.length} people` : ""}`)
      }
      onOpenChange(false)
      reset()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed")
    } finally {
      setBusy(false)
    }
  }

  const colOptions = Array.from({ length: colCount }, (_, i) => ({
    value: String(i),
    label: `${columnLetter(i)}${headers[i] ? ` · ${headers[i]}` : ""}`,
  }))

  const columnSelect = (field: keyof Mapping, label: string, optional = true) => (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
      <Label className="text-sm font-normal text-muted-foreground">{label}</Label>
      <Select
        value={map?.[field] === null || map?.[field] === undefined ? NONE : String(map[field])}
        onValueChange={(v) => setMap((m) => (m ? { ...m, [field]: v === NONE ? null : Number(v) } : m))}
      >
        <SelectTrigger className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {optional ? <SelectItem value={NONE}>— none —</SelectItem> : null}
          {colOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  const splitSummary = (r: ParsedRow) =>
    r.split.kind === "everyone"
      ? "everyone"
      : r.split.kind === "equal"
        ? r.split.names.join(", ")
        : r.split.kind === "exact"
          ? Object.entries(r.split.shares).map(([n, v]) => `${n} ${v}`).join(", ")
          : Object.entries(r.split.weights).map(([n, v]) => `${n}×${v}`).join(", ")

  const title =
    step === "file" ? "Import from Excel" : step === "columns" ? "Match columns" : step === "people" ? "Match people" : "Review & import"

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return
        onOpenChange(o)
        if (!o) reset()
      }}
      title={title}
      description={step === "file" ? "Bring in expenses from an .xlsx or .csv file." : fileName}
    >
      <div className="space-y-5 pb-2">
        {step === "file" ? (
          <>
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition hover:bg-muted/50",
                busy && "pointer-events-none opacity-60"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                onFile(e.dataTransfer.files[0])
              }}
            >
              <span className="grid size-12 place-items-center rounded-full bg-muted">
                {busy ? <Loader2 className="size-6 animate-spin" /> : <FileSpreadsheet className="size-6" />}
              </span>
              <span className="font-medium">Choose a spreadsheet</span>
              <span className="text-sm text-muted-foreground">.xlsx or .csv · or drop it here</span>
              <input
                type="file"
                accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            <div className="space-y-1 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Works best with one row per expense, e.g.</p>
              <p>Date · Description · Amount · Currency · Paid by · and either a “Split between” column (Amy, Ben) or one column per person with their share or a ✓.</p>
              <p>Chinese headers (日期, 項目, 金額, 付款人, 分攤…) are recognised too. The file stays on your device.</p>
            </div>
          </>
        ) : null}

        {step === "columns" && map ? (
          <>
            {sheets.length > 1 ? (
              <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
                <Label className="text-sm font-normal text-muted-foreground">Sheet</Label>
                <Select value={String(sheetIdx)} onValueChange={(v) => selectSheet(sheets, Number(v))}>
                  <SelectTrigger className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sheets.map((s, i) => <SelectItem key={i} value={String(i)}>{s.name} ({s.grid.length} rows)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <Label className="text-sm font-normal text-muted-foreground">Header row</Label>
              <Select value={String(map.headerRow)} onValueChange={(v) => setMap(guessMapping(grid, members.map((m) => m.display_name), Number(v)))}>
                <SelectTrigger className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {grid.slice(0, 15).map((r, i) => (
                    <SelectItem key={i} value={String(i)}>
                      Row {i + 1}: {(r ?? []).map(cellText).filter(Boolean).slice(0, 4).join(" · ") || "(empty)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {columnSelect("amount", "Amount *", false)}
              {columnSelect("description", "Description")}
              {columnSelect("date", "Date")}
              {columnSelect("paidBy", "Paid by")}
              {columnSelect("currency", "Currency")}
              {columnSelect("category", "Category")}
              {columnSelect("fxRate", "FX rate")}
              {columnSelect("notes", "Notes")}
              <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
                <Label className="text-sm font-normal text-muted-foreground">Default currency</Label>
                <CurrencySelect value={defaultCurrency} onChange={setDefaultCurrency} options={[trip.base_currency, ...Object.keys(trip.fx_rates ?? {})]} className="h-10 w-full" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>How is each expense split?</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["columns", "Column per person"],
                  ["names", "Names column"],
                  ["everyone", "Everyone equally"],
                ] as const).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMap({ ...map, split: v })}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-xs transition",
                      map.split === v ? "border-primary bg-accent ring-2 ring-primary/15" : "hover:bg-muted"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {map.split === "names" ? columnSelect("splitNames", "Split between") : null}
              {map.split === "columns" ? (
                <div className="flex flex-wrap gap-1.5">
                  {colOptions
                    .filter((o) => ![map.amount, map.date, map.description, map.paidBy, map.currency, map.category, map.notes, map.fxRate].includes(Number(o.value)))
                    .map((o) => {
                      const i = Number(o.value)
                      const on = map.personColumns.includes(i)
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() =>
                            setMap({ ...map, personColumns: on ? map.personColumns.filter((x) => x !== i) : [...map.personColumns, i].sort((a, b) => a - b) })
                          }
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                            on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                          )}
                        >
                          {on ? <Check className="size-3" /> : null}
                          {o.label}
                        </button>
                      )
                    })}
                </div>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground">
              Found <span className="font-medium text-foreground">{importable.length}</span> expenses
              {rows.some((r) => r.isNote) ? ` (+ ${rows.filter((r) => r.isNote).length} without an amount, which you can import as notes)` : ""}.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="h-12" onClick={reset}><ArrowLeft /></Button>
              <Button size="lg" className="h-12 flex-1 text-base" disabled={map.amount === null || !importable.length} onClick={goPeople}>
                Next
              </Button>
            </div>
          </>
        ) : null}

        {step === "people" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Match each name in the file to someone on the trip, or add them as a new person (no account needed — they can link later).
            </p>
            <ul className="divide-y rounded-xl border">
              {names.map((n) => {
                const k = nameKey(n)
                return (
                  <li key={k} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{n}</span>
                    <Select value={people[k] ?? NEW} onValueChange={(v) => setPeople((p) => ({ ...p, [k]: v }))}>
                      <SelectTrigger className="h-9 w-44 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NEW}>+ New person</SelectItem>
                        {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </li>
                )
              })}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="h-12" onClick={() => setStep("columns")}><ArrowLeft /></Button>
              <Button size="lg" className="h-12 flex-1 text-base" onClick={() => setStep("review")}>Next</Button>
            </div>
          </>
        ) : null}

        {step === "review" ? (
          <>
            {foreignRows.length ? (
              <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Exchange rates</Label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={dailyAuto} onChange={(e) => setDailyAuto(e.target.checked)} className="size-3.5 accent-current" />
                    Each day&apos;s rate
                  </label>
                </div>
                {dailyAuto ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {ratesLoading ? (
                      <><Loader2 className="size-3 animate-spin" /> Getting daily rates…</>
                    ) : autoCurrencies.length ? (
                      <><Check className="size-3" /> Using each day&apos;s market rate for {autoCurrencies.join(", ")} ({autoDays} {autoDays === 1 ? "day" : "days"})</>
                    ) : null}
                  </p>
                ) : null}
                {!ratesLoading && needRates.length && dailyAuto ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Some days&apos; rates aren&apos;t available — enter a fallback:</p>
                ) : null}
              </div>
            ) : null}
            {!ratesLoading && needRates.length ? (
              <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                <Label>{dailyAuto ? "Fallback rates" : "Exchange rates"}</Label>
                {needRates.map((c) => (
                  <div key={c} className="flex items-center gap-2 text-sm">
                    <span className="w-14 shrink-0 text-muted-foreground">1 {c} =</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={rates[c] ?? String(trip.fx_rates?.[c] ?? "")}
                      onChange={(e) => setRates((r) => ({ ...r, [c]: e.target.value }))}
                      className="h-9 w-28 bg-background"
                    />
                    <span className="text-muted-foreground">{trip.base_currency}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {importable.some((r) => !r.payerName) || (map?.paidBy ?? null) === null ? (
              <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
                <Label className="text-sm font-normal text-muted-foreground">Payer if blank</Label>
                <Select value={defaultPayer} onValueChange={setDefaultPayer}>
                  <SelectTrigger className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {duplicates ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} className="size-4 accent-current" />
                Skip {duplicates} that look already imported (same date, amount and description)
              </label>
            ) : null}

            <ul className="max-h-[45dvh] divide-y overflow-y-auto rounded-xl border">
              {rows.map((r) => {
                const note = !!r.isNote
                const skip = r.amount <= 0 && !note
                const dup = !note && skipDuplicates && isDuplicate(r)
                const off = note ? !notesIn.has(r.rowNumber) : skip || dup || excluded.has(r.rowNumber)
                const Icon = categoryById(r.category).icon
                const payer = r.payerName ?? members.find((m) => m.id === defaultPayer)?.display_name
                return (
                  <li key={r.rowNumber} className={cn("flex gap-3 px-3 py-2.5", off && "opacity-50")}>
                    <input
                      type="checkbox"
                      aria-label={`Include row ${r.rowNumber}`}
                      className="mt-1 size-4 shrink-0 accent-current"
                      disabled={skip || dup}
                      checked={!off}
                      onChange={() =>
                        (note ? setNotesIn : setExcluded)((s) => {
                          const n = new Set(s)
                          if (n.has(r.rowNumber)) n.delete(r.rowNumber)
                          else n.add(r.rowNumber)
                          return n
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <Icon className="size-3.5 shrink-0 self-center text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.description}</span>
                        {note ? (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Note</span>
                        ) : !skip ? (
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(r.amount, r.currency)}</span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        Row {r.rowNumber} · {formatDate(r.date)}
                        {note ? " · no amount — tick to import as a note" : !skip ? ` · ${payer ?? "?"} paid · ${splitSummary(r)}` : ""}
                        {dup ? " · already imported" : ""}
                      </div>
                      {r.errors.map((e) => (
                        <div key={e} className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3" /> {e}
                        </div>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">
                {included.length - includedNotes.length} expenses{includedNotes.length ? ` + ${includedNotes.length} ${includedNotes.length === 1 ? "note" : "notes"}` : ""}
              </span>
              <span className="font-semibold tabular-nums">≈ {formatMoney(totalBase, trip.base_currency)}</span>
            </div>

            {missingRate.length ? (
              <p className="text-sm text-destructive">Enter an exchange rate for {missingRate.join(", ")}.</p>
            ) : null}

            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="h-12" disabled={busy} onClick={() => setStep(names.length ? "people" : "columns")}>
                <ArrowLeft />
              </Button>
              <Button size="lg" className="h-12 flex-1 text-base" disabled={busy || ratesLoading || !included.length || missingRate.length > 0} onClick={runImport}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />}
                {busy ? `Importing ${progress}/${included.length}…` : ratesLoading ? "Getting rates…" : `Import ${included.length} ${!includedNotes.length ? "expenses" : includedNotes.length === included.length ? "notes" : "items"}`}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}

