import type { Expense, Member, Settlement } from "./types"
import { fromCents, toCents } from "./money"

export interface MemberBalance {
  memberId: string
  paid: number // base currency
  owed: number // base currency (their share of expenses)
  net: number // >0 => others owe them
}

export interface Transfer {
  from: string
  to: string
  amount: number
}

export function computeBalances(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[]
): MemberBalance[] {
  const paid = new Map<string, number>()
  const owed = new Map<string, number>()
  const adj = new Map<string, number>()
  for (const m of members) {
    paid.set(m.id, 0)
    owed.set(m.id, 0)
    adj.set(m.id, 0)
  }

  for (const e of expenses) {
    const rate = Number(e.fx_rate)
    paid.set(e.paid_by, (paid.get(e.paid_by) ?? 0) + toCents(Number(e.amount) * rate))
    for (const s of e.expense_splits) {
      const c = toCents(Number(s.share) * rate)
      owed.set(s.member_id, (owed.get(s.member_id) ?? 0) + c)
      // Share already paid back to the payer for this expense: cancel it out.
      if (s.settled_at && s.member_id !== e.paid_by) {
        adj.set(s.member_id, (adj.get(s.member_id) ?? 0) + c)
        adj.set(e.paid_by, (adj.get(e.paid_by) ?? 0) - c)
      }
    }
  }
  for (const s of settlements) {
    const c = toCents(Number(s.amount))
    adj.set(s.from_member, (adj.get(s.from_member) ?? 0) + c)
    adj.set(s.to_member, (adj.get(s.to_member) ?? 0) - c)
  }

  return members.map((m) => {
    const p = paid.get(m.id) ?? 0
    const o = owed.get(m.id) ?? 0
    const a = adj.get(m.id) ?? 0
    return { memberId: m.id, paid: fromCents(p), owed: fromCents(o), net: fromCents(p - o + a) }
  })
}

/** Greedy minimal-ish set of transfers to settle all balances. */
export function suggestTransfers(balances: MemberBalance[]): Transfer[] {
  const creditors = balances
    .filter((b) => toCents(b.net) > 0)
    .map((b) => ({ id: b.memberId, c: toCents(b.net) }))
    .sort((a, b) => b.c - a.c)
  const debtors = balances
    .filter((b) => toCents(b.net) < 0)
    .map((b) => ({ id: b.memberId, c: -toCents(b.net) }))
    .sort((a, b) => b.c - a.c)

  const out: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const x = Math.min(debtors[i].c, creditors[j].c)
    if (x > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: fromCents(x) })
    debtors[i].c -= x
    creditors[j].c -= x
    if (debtors[i].c === 0) i++
    if (creditors[j].c === 0) j++
  }
  return out
}
