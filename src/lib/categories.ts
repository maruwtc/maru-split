import {
  BedDouble,
  Bus,
  Coffee,
  Gift,
  Receipt,
  ShoppingBag,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react"

export interface Category {
  id: string
  label: string
  icon: LucideIcon
  className: string
}

export const CATEGORIES: Category[] = [
  { id: "food", label: "Food", icon: UtensilsCrossed, className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  { id: "drinks", label: "Drinks", icon: Coffee, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  { id: "transport", label: "Transport", icon: Bus, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { id: "lodging", label: "Lodging", icon: BedDouble, className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { id: "tickets", label: "Tickets", icon: Ticket, className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, className: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
  { id: "gifts", label: "Gifts", icon: Gift, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { id: "other", label: "Other", icon: Receipt, className: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
]

export const categoryById = (id: string) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
