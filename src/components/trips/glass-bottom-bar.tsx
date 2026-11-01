"use client"

import { Plus, Receipt, Scale, Users, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type TripTab = "expenses" | "balances" | "people"

const ITEMS: { id: TripTab; label: string; icon: LucideIcon }[] = [
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "balances", label: "Balances", icon: Scale },
  { id: "people", label: "People", icon: Users },
]

/** Floating "liquid glass" navigation bar for phones and tablets. */
export function GlassBottomBar({
  tab,
  onTabChange,
  onAdd,
  badges,
}: {
  tab: TripTab
  onTabChange: (t: TripTab) => void
  onAdd: () => void
  badges?: Partial<Record<TripTab, number>>
}) {
  const tabButton = ({ id, label, icon: Icon }: (typeof ITEMS)[number]) => {
    const active = tab === id
    const badge = badges?.[id]
    return (
      <button
        key={id}
        type="button"
        onClick={() => onTabChange(id)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition-all duration-300",
          active
            ? "bg-foreground/[0.07] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] dark:bg-white/10 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
            : "text-muted-foreground active:scale-95"
        )}
      >
        <span className="relative">
          <Icon className={cn("size-[18px] transition-transform", active && "scale-105")} strokeWidth={active ? 2.3 : 1.9} />
          {badge ? (
            <span className="absolute -right-2 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-foreground px-1 text-[9px] font-semibold leading-none text-background ring-2 ring-background/80">
              {badge}
            </span>
          ) : null}
        </span>
        {label}
      </button>
    )
  }

  return (
    <nav
      aria-label="Trip sections"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div
        className={cn(
          "pointer-events-auto relative flex w-full max-w-sm items-center gap-1 rounded-full p-1",
          // liquid glass: translucent fill, heavy blur + saturation, bright rim, soft drop shadow
          "border border-white/50 bg-white/35 backdrop-blur-xl backdrop-saturate-[1.8]",
          "shadow-[0_10px_40px_-8px_rgb(0_0_0/0.25),inset_0_1px_0_rgb(255_255_255/0.9),inset_0_-1px_0_rgb(0_0_0/0.04)]",
          "dark:border-white/10 dark:bg-zinc-900/35 dark:shadow-[0_10px_40px_-8px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.12)]"
        )}
      >
        {/* sheen */}
        <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80 dark:opacity-30" />
        {tabButton(ITEMS[0])}
        {tabButton(ITEMS[1])}
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add expense"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_-4px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.25)] transition active:scale-90"
        >
          <Plus className="size-5" strokeWidth={2.4} />
        </button>
        {tabButton(ITEMS[2])}
      </div>
    </nav>
  )
}
