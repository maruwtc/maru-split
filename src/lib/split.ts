import type { SplitMode } from "./types"
import { fromCents, toCents } from "./money"

/**
 * Distribute `amount` across members, returning per-member shares in currency
 * units with exact cent rounding (remainder cents go to the first members).
 */
export function computeShares(
  amount: number,
  mode: SplitMode,
  memberIds: string[],
  inputs: Record<string, number>
): Record<string, number> {
  const total = toCents(amount)
  const out: Record<string, number> = {}
  if (memberIds.length === 0 || total <= 0) return out

  if (mode === "exact") {
    for (const id of memberIds) out[id] = fromCents(toCents(inputs[id] || 0))
    return out
  }

  const weights = memberIds.map((id) => (mode === "shares" ? Math.max(0, inputs[id] ?? 1) : 1))
  const weightSum = weights.reduce((a, b) => a + b, 0)
  if (weightSum <= 0) return out

  const raw = weights.map((w) => (total * w) / weightSum)
  const floored = raw.map(Math.floor)
  let remainder = total - floored.reduce((a, b) => a + b, 0)
  // Give leftover cents to the largest fractional parts.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (remainder <= 0) break
    floored[i] += 1
    remainder -= 1
  }
  memberIds.forEach((id, i) => (out[id] = fromCents(floored[i])))
  return out
}
