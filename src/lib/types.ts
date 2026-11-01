export type SplitMode = "equal" | "exact" | "shares"

export interface Trip {
  id: string
  name: string
  emoji: string
  base_currency: string
  fx_rates: Record<string, number>
  start_date: string | null
  end_date: string | null
  invite_code: string
  created_by: string
  created_at: string
}

export interface Member {
  id: string
  trip_id: string
  user_id: string | null
  display_name: string
  created_at: string
  profile?: { avatar_url: string | null; full_name: string | null } | null
}

export interface ExpenseSplit {
  member_id: string
  share: number
  weight: number | null
  /** Set when this person has paid back their share of the expense. */
  settled_at?: string | null
}

export interface Expense {
  id: string
  trip_id: string
  description: string
  category: string
  amount: number
  currency: string
  fx_rate: number
  /** Final amount actually charged in the trip currency (e.g. bank statement). Overrides amount × fx_rate. */
  base_amount?: number | null
  paid_by: string
  split_mode: SplitMode
  spent_at: string
  notes: string | null
  created_at: string
  expense_splits: ExpenseSplit[]
}

export interface Settlement {
  id: string
  trip_id: string
  from_member: string
  to_member: string
  amount: number
  settled_at: string
}
