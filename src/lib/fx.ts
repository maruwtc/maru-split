export interface DayRate {
  rate: number
  /** Day the rate is actually from (may be earlier for weekends/holidays). */
  date: string
  /** True when the expense date is today or in the future, so the latest rate was used. */
  latest: boolean
}

const cache = new Map<string, Promise<DayRate | null>>()

/** 1 `from` = rate × `to`, for the given day. Cached per session; null if unavailable. */
export function fetchDayRate(from: string, to: string, date: string): Promise<DayRate | null> {
  if (from === to) return Promise.resolve({ rate: 1, date, latest: false })
  const key = `${from}|${to}|${date}`
  let p = cache.get(key)
  if (!p) {
    p = fetch(`/api/fx?from=${from}&to=${to}&date=${date}`)
      .then(async (r) => {
        if (!r.ok) return null
        const d = await r.json()
        return d.rate > 0 ? { rate: Number(d.rate), date: String(d.date), latest: Boolean(d.latest) } : null
      })
      .catch(() => null)
    p.then((v) => v === null && cache.delete(key)) // allow retry after failure
    cache.set(key, p)
  }
  return p
}

/** Round to 6 significant decimals for display/storage. */
export const roundRate = (r: number) => Number(r.toPrecision(6))
