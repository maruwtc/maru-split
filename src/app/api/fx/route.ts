import { NextResponse, type NextRequest } from "next/server"

// Exchange rate for a given day: GET /api/fx?from=CNY&to=HKD&date=2026-12-22
// Free sources, no API key. Future dates (trip planned ahead) use the latest rate.

type Result = { rate: number; date: string; source: string }

const TIMEOUT = 4000

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

/** fawazahmed0/currency-api — covers ~all currencies incl. TWD, MOP. */
async function currencyApi(from: string, to: string, day: string, host: "jsdelivr" | "pages"): Promise<Result> {
  const f = from.toLowerCase()
  const t = to.toLowerCase()
  const url =
    host === "jsdelivr"
      ? `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${day}/v1/currencies/${f}.json`
      : `https://${day}.currency-api.pages.dev/v1/currencies/${f}.json`
  const data = await getJson(url)
  const rate = Number(data?.[f]?.[t])
  if (!(rate > 0)) throw new Error("rate missing")
  return { rate, date: String(data?.date ?? day), source: "currency-api" }
}

/** Frankfurter (ECB reference rates; weekends return the previous business day). */
async function frankfurter(from: string, to: string, day: string): Promise<Result> {
  const data = await getJson(`https://api.frankfurter.dev/v1/${day}?base=${from}&symbols=${to}`)
  const rate = Number(data?.rates?.[to])
  if (!(rate > 0)) throw new Error("rate missing")
  return { rate, date: String(data?.date ?? day), source: "ECB" }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const from = (sp.get("from") ?? "").toUpperCase()
  const to = (sp.get("to") ?? "").toUpperCase()
  const date = sp.get("date") ?? ""
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Use ?from=CNY&to=HKD&date=YYYY-MM-DD" }, { status: 400 })
  }
  if (from === to) return NextResponse.json({ rate: 1, date, requested: date, source: "same" })

  const today = new Date().toISOString().slice(0, 10)
  const latest = date >= today
  const day = latest ? "latest" : date

  const attempts: (() => Promise<Result>)[] = [
    () => currencyApi(from, to, day, "jsdelivr"),
    () => currencyApi(from, to, day, "pages"),
    () => frankfurter(from, to, day),
  ]
  for (const attempt of attempts) {
    try {
      const r = await attempt()
      return NextResponse.json(
        { ...r, requested: date, latest },
        {
          headers: {
            // Past days never change; "latest" refreshes hourly at the edge.
            "cache-control": latest
              ? "public, s-maxage=3600, stale-while-revalidate=86400"
              : "public, max-age=86400, s-maxage=31536000, immutable",
          },
        }
      )
    } catch {
      // try next source
    }
  }
  return NextResponse.json({ error: "No rate available" }, { status: 502 })
}
