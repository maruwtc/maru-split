export const CURRENCIES = [
  "HKD", "CNY", "USD", "EUR", "GBP", "JPY", "KRW", "TWD", "SGD", "MYR",
  "THB", "VND", "PHP", "IDR", "AUD", "NZD", "CAD", "CHF", "MOP", "INR",
] as const

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "IDR"])

export const toCents = (n: number) => Math.round(n * 100)
export const fromCents = (c: number) => c / 100

export function formatMoney(amount: number, currency: string, opts?: { signed?: boolean }) {
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2
  const s = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(amount))
  if (opts?.signed && Math.abs(amount) >= 0.005) return (amount > 0 ? "+" : "−") + s
  return amount < 0 && !opts?.signed ? "−" + s : s
}

/** Rate to convert 1 unit of `currency` into the trip's base currency. */
export function rateFor(currency: string, base: string, rates: Record<string, number>) {
  if (currency === base) return 1
  return Number(rates[currency]) || 1
}
