"use client"

import { formatDate } from "@/lib/date"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Download, FileSpreadsheet, MoreVertical, Plus, Settings, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MemberAvatar } from "@/components/member-avatar"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { BalancesPanel } from "./balances-panel"
import { ExpenseForm } from "./expense-form"
import { AddPersonChip } from "./add-person-chip"
import { ExpenseList } from "./expense-list"
import { GlassBottomBar, type TripTab } from "./glass-bottom-bar"
import { ImportDialog } from "./import-dialog"
import { MembersPanel } from "./members-panel"
import { TripForm } from "./trip-form"
import { computeBalances, suggestTransfers } from "@/lib/balances"
import { categoryById } from "@/lib/categories"
import { formatMoney } from "@/lib/money"
import { createClient } from "@/lib/supabase/client"
import type { Expense, Member, Settlement, Trip } from "@/lib/types"
import { cn } from "@/lib/utils"

export function TripView({
  trip,
  members,
  expenses,
  settlements,
  currentUserId,
}: {
  trip: Trip
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
  currentUserId: string
}) {
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const [tab, setTab] = useState<TripTab>("expenses")
  const [lastCurrency, setLastCurrency] = useState<string | undefined>(
    expenses[0]?.currency ?? Object.keys(trip.fx_rates ?? {})[0]
  )

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const me = members.find((m) => m.user_id === currentUserId) ?? null
  const myMemberId = me?.id ?? null

  const balances = useMemo(() => computeBalances(members, expenses, settlements), [members, expenses, settlements])
  const transfers = useMemo(() => suggestTransfers(balances), [balances])
  const myBalance = balances.find((b) => b.memberId === myMemberId)

  const total = expenses.reduce((s, e) => s + Number(e.amount) * Number(e.fx_rate), 0)
  const filtered = filter
    ? expenses.filter((e) => e.paid_by === filter || e.expense_splits.some((s) => s.member_id === filter))
    : expenses

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setFormOpen(true)
  }

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
    const header = ["Date", "Description", "Category", "Amount", "Currency", "FX rate", `Amount (${trip.base_currency})`, "Paid by", ...members.map((m) => `${m.display_name} share`)]
    const rows = [...expenses].reverse().map((e) => [
      formatDate(e.spent_at),
      e.description,
      categoryById(e.category).label,
      Number(e.amount).toFixed(2),
      e.currency,
      e.fx_rate,
      (Number(e.amount) * Number(e.fx_rate)).toFixed(2),
      membersById.get(e.paid_by)?.display_name ?? "",
      ...members.map((m) => {
        const s = e.expense_splits.find((x) => x.member_id === m.id)
        return s ? Number(s.share).toFixed(2) : ""
      }),
    ])
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${trip.name.replace(/[^\w-]+/g, "_")}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function deleteTrip() {
    if (!confirm(`Delete “${trip.name}” and all its expenses? This can't be undone.`)) return
    const { error } = await createClient().from("trips").delete().eq("id", trip.id)
    if (error) return toast.error(error.message)
    toast.success("Trip deleted")
    router.push("/trips")
    router.refresh()
  }

  const filterChips = members.length > 1 && (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
      <button
        type="button"
        onClick={() => setFilter(null)}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1 text-sm transition",
          filter === null ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
        )}
      >
        All
      </button>
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setFilter(filter === m.id ? null : m.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-3 text-sm transition",
            filter === m.id ? "border-primary bg-accent ring-2 ring-primary/15" : "hover:bg-muted"
          )}
        >
          <MemberAvatar member={m} className="size-6 [&_[data-slot=avatar-fallback]]:text-[10px]" />
          {m.display_name}
        </button>
      ))}
    </div>
  )

  const soloPrompt = members.length === 1 && (
    <div className="rounded-2xl border border-dashed bg-muted/40 p-4">
      <p className="font-medium">Who&apos;s travelling with you?</p>
      <p className="mb-3 text-sm text-muted-foreground">
        Add people now — they don&apos;t need an account. Later they can sign in with Google and link to their name.
      </p>
      <AddPersonChip tripId={trip.id} onAdded={() => router.refresh()} className="w-fit bg-background" />
    </div>
  )

  const expensesSection = (
    <div className="space-y-4">
      {soloPrompt}
      {filterChips}
      {expenses.length === 0 ? (
        <Button variant="outline" className="w-full" onClick={() => setImportOpen(true)}>
          <FileSpreadsheet /> Import expenses from Excel
        </Button>
      ) : null}
      <ExpenseList trip={trip} expenses={filtered} membersById={membersById} myMemberId={myMemberId} onSelect={openEdit} />
    </div>
  )

  const balancesSection = (
    <BalancesPanel
      trip={trip}
      balances={balances}
      transfers={transfers}
      settlements={settlements}
      membersById={membersById}
      myMemberId={myMemberId}
    />
  )

  const membersSection = <MembersPanel trip={trip} members={members} myMemberId={myMemberId} />

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-6 lg:pb-12 md:pt-6">
      {/* Title row */}
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0" aria-label="Back to trips">
          <Link href="/trips"><ChevronLeft /></Link>
        </Button>
        <span className="text-2xl">{trip.emoji}</span>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight md:text-2xl">{trip.name}</h1>
        <Button onClick={openNew} className="hidden lg:inline-flex">
          <Plus /> Add expense
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Trip options"><MoreVertical /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setSettingsOpen(true)}><Settings /> Trip settings</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setImportOpen(true)}><FileSpreadsheet /> Import from Excel</DropdownMenuItem>
            <DropdownMenuItem onSelect={exportCsv} disabled={!expenses.length}><Download /> Export CSV</DropdownMenuItem>
            {trip.created_by === currentUserId ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={deleteTrip}><Trash2 /> Delete trip</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Trip total</div>
          <div className="mt-1 text-lg font-semibold tabular-nums md:text-2xl">{formatMoney(total, trip.base_currency)}</div>
          <div className="text-xs text-muted-foreground">
            {(() => {
              const n = expenses.filter((e) => Number(e.amount) > 0).length
              const notes = expenses.length - n
              return `${n} ${n === 1 ? "expense" : "expenses"}${notes ? ` · ${notes} ${notes === 1 ? "note" : "notes"}` : ""}`
            })()}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">
            {!myBalance || Math.abs(myBalance.net) < 0.005 ? "Your balance" : myBalance.net > 0 ? "You are owed" : "You owe"}
          </div>
          <div
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums md:text-2xl",
              myBalance && myBalance.net > 0.004 && "text-positive",
              myBalance && myBalance.net < -0.004 && "text-negative"
            )}
          >
            {formatMoney(Math.abs(myBalance?.net ?? 0), trip.base_currency)}
          </div>
          <div className="text-xs text-muted-foreground">
            your share {formatMoney(myBalance?.owed ?? 0, trip.base_currency)}
          </div>
        </div>
        <div className="hidden rounded-2xl border bg-card p-4 md:block">
          <div className="text-xs text-muted-foreground">People</div>
          <div className="mt-2 flex -space-x-2">
            {members.slice(0, 8).map((m) => (
              <MemberAvatar key={m.id} member={m} className="size-9 ring-2 ring-card" />
            ))}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{members.length} travellers</div>
        </div>
      </div>

      {/* Mobile: tabs */}
      <div className="lg:hidden">
        {tab === "expenses" ? expensesSection : tab === "balances" ? balancesSection : membersSection}
      </div>

      {/* Desktop: two columns */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>{expensesSection}</section>
        <aside className="space-y-4">
          {balancesSection}
          {membersSection}
        </aside>
      </div>

      {/* Phone / tablet: floating glass bottom bar */}
      <GlassBottomBar
        tab={tab}
        onTabChange={(t) => {
          setTab(t)
          window.scrollTo({ top: 0, behavior: "smooth" })
        }}
        onAdd={openNew}
        badges={{ balances: transfers.length }}
      />

      <ResponsiveDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? "Edit expense" : "Add expense"} flush>
        {formOpen ? (
          <ExpenseForm
            key={editing?.id ?? "new"}
            trip={trip}
            members={members}
            expense={editing}
            defaultPayer={myMemberId ?? undefined}
            defaultCurrency={lastCurrency}
            onDone={(saved) => {
              setFormOpen(false)
              if (saved) router.refresh()
            }}
            onCurrencyUsed={setLastCurrency}
            onMemberAdded={() => router.refresh()}
            onSettledChange={() => router.refresh()}
          />
        ) : null}
      </ResponsiveDialog>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        trip={trip}
        members={members}
        expenses={expenses}
        myMemberId={myMemberId}
      />

      <ResponsiveDialog open={settingsOpen} onOpenChange={setSettingsOpen} title="Trip settings">
        <TripForm
          initial={trip}
          submitLabel="Save"
          onSubmit={async (values) => {
            const { error } = await createClient().from("trips").update(values).eq("id", trip.id)
            if (error) {
              toast.error(error.message)
              return
            }
            toast.success("Trip updated")
            setSettingsOpen(false)
            router.refresh()
          }}
        />
      </ResponsiveDialog>
    </main>
  )
}
