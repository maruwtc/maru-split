// Spreadsheet → expenses. Pure functions (no React / Supabase) so they can be tested.

import { computeShares } from "./split"
import { fromCents, toCents } from "./money"
import type { SplitMode } from "./types"

export type Cell = string | number | boolean | Date | null | undefined
export type Grid = Cell[][]

export type SplitSource = "columns" | "names" | "everyone"

export interface Mapping {
  headerRow: number // index into grid
  date: number | null
  description: number | null
  amount: number | null
  currency: number | null
  paidBy: number | null
  category: number | null
  notes: number | null
  fxRate: number | null
  split: SplitSource
  splitNames: number | null // "names" source: column with "Amy, Ben"
  personColumns: number[] // "columns" source: one column per person
}

export interface ImportOptions {
  defaultCurrency: string
  defaultYear: number
  defaultDate: string // yyyy-mm-dd
}

export interface ParsedRow {
  rowNumber: number // 1-based, as shown in Excel
  date: string
  description: string
  amount: number
  currency: string
  /** Rate to base currency from the sheet, if it has one. */
  fxRate: number | null
  category: string
  notes: string | null
  payerName: string | null
  /** Names involved and (optionally) exact amounts per name. */
  split:
    | { kind: "everyone" }
    | { kind: "equal"; names: string[] }
    | { kind: "exact"; shares: Record<string, number> }
    | { kind: "weights"; weights: Record<string, number> }
  errors: string[]
}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

export const cellText = (c: Cell) =>
  c === null || c === undefined ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim()

const isBlank = (c: Cell) => cellText(c) === ""

export function columnLetter(i: number) {
  let s = ""
  i += 1
  while (i > 0) {
    const m = (i - 1) % 26
    s = String.fromCharCode(65 + m) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

const CURRENCY_HINTS: [RegExp, string][] = [
  [/HK\$|HKD|港[幣币元]/i, "HKD"],
  [/RMB|CNY|CN¥|人民[幣币]|[¥￥]|元/i, "CNY"],
  [/JPY|円/i, "JPY"],
  [/US\$|USD/i, "USD"],
  [/NT\$|TWD|台[幣币]/i, "TWD"],
  [/MOP|澳門[幣币]|葡[幣币]/i, "MOP"],
  [/€|EUR/i, "EUR"],
  [/£|GBP/i, "GBP"],
  [/₩|KRW|韓[圜元]/i, "KRW"],
  [/S\$|SGD/i, "SGD"],
  [/฿|THB/i, "THB"],
]

export function detectCurrency(text: string): string | null {
  const t = text.trim()
  if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase()
  for (const [re, code] of CURRENCY_HINTS) if (re.test(t)) return code
  return null
}

/** Parse "HK$1,234.50", "¥120", "120元", "(30)" etc. */
export function parseAmount(c: Cell): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null
  const t = cellText(c)
  if (!t) return null
  const neg = /^\(.*\)$/.test(t) || /^-/.test(t.replace(/^[^\d-]+/, ""))
  const digits = t.replace(/[^\d.]/g, "")
  if (!digits || !/\d/.test(digits)) return null
  const n = Number(digits)
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}

const pad = (n: number) => String(n).padStart(2, "0")
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

/** Dates from Excel (Date objects or serial numbers) and common text formats. Day-first for d/m. */
export function parseDate(c: Cell, defaultYear: number): string | null {
  if (c instanceof Date && !Number.isNaN(c.getTime())) {
    return iso(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate())
  }
  if (typeof c === "number" && c > 20000 && c < 80000) {
    // Excel serial date (1900 system)
    const ms = Math.round((c - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  const t = cellText(c)
  if (!t) return null
  let m: RegExpMatchArray | null
  if ((m = t.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/))) return iso(+m[1], +m[2], +m[3])
  if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]
    const a = +m[1]
    const b = +m[2]
    return a > 12 ? iso(y, b, a) : b > 12 ? iso(y, a, b) : iso(y, b, a) // day-first when ambiguous
  }
  if ((m = t.match(/^(\d{1,2})月(\d{1,2})[日号號]?/))) return iso(defaultYear, +m[1], +m[2])
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})$/))) {
    const a = +m[1]
    const b = +m[2]
    return a > 12 ? iso(defaultYear, b, a) : iso(defaultYear, b, a)
  }
  if ((m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s*(\d{4})?/))) {
    const mi = MONTHS.indexOf(m[2].toLowerCase())
    if (mi >= 0) return iso(m[3] ? +m[3] : defaultYear, mi + 1, +m[1])
  }
  if ((m = t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4})?/))) {
    const mi = MONTHS.indexOf(m[1].toLowerCase())
    if (mi >= 0) return iso(m[3] ? +m[3] : defaultYear, mi + 1, +m[2])
  }
  return null
}

// ---------------------------------------------------------------------------
// Category guessing
// ---------------------------------------------------------------------------

const CATEGORY_HINTS: [string, RegExp][] = [
  ["lodging", /hotel|hostel|airbnb|inn|lodg|room|resort|住宿|酒店|旅館|旅馆|民宿|客棧|客栈|房/i],
  ["transport", /taxi|uber|didi|bus|train|metro|subway|flight|air|car|petrol|gas|toll|parking|ferry|交通|的士|計程|出租|滴滴|巴士|公交|高鐵|高铁|火車|火车|地鐵|地铁|機票|机票|航班|包車|包车|車|车|油/i],
  ["tickets", /ticket|admission|entry|tour|park|museum|show|門票|门票|票|景區|景区|索道|纜車|缆车|導遊|导游/i],
  ["drinks", /coffee|tea|bar|beer|drink|wine|starbucks|cafe|奶茶|咖啡|茶|酒|飲|饮|啤/i],
  ["food", /food|meal|lunch|dinner|breakfast|brunch|snack|restaurant|bbq|hotpot|noodle|rice|食|餐|飯|饭|早|午|晚|宵夜|火鍋|火锅|米線|米线|小吃|菜/i],
  ["gifts", /gift|souvenir|手信|禮|礼|紀念|纪念|特產|特产/i],
  ["shopping", /shop|mall|market|buy|store|supermarket|購|购|買|买|超市|商場|商场|藥|药/i],
]

export function guessCategory(...texts: string[]): string {
  const t = texts.filter(Boolean).join(" ")
  for (const [id, re] of CATEGORY_HINTS) if (re.test(t)) return id
  return "other"
}

// ---------------------------------------------------------------------------
// Header / column detection
// ---------------------------------------------------------------------------

const HEADER_HINTS: Record<Exclude<keyof Mapping, "headerRow" | "split" | "personColumns">, RegExp> = {
  date: /^(date|day|日期|日子|時間|时间|date\s*\/?\s*time)$|date|日期/i,
  description: /desc|item|detail|what|purpose|name of|expense|memo|項目|项目|內容|内容|描述|用途|明細|明细|名稱|名称|事項|事项/i,
  amount: /amount|total|cost|price|sum|spent|金額|金额|價錢|价钱|價格|价格|費用|费用|總額|总额|合計|合计|^\$$/i,
  currency: /^(currency|ccy|cur)$|currency|貨幣|货币|幣別|币别|幣種|币种/i,
  paidBy: /paid\s*by|payer|who\s*paid|paid|付款|支付|誰付|谁付|付錢|付钱|墊支|垫支|代付|^by$/i,
  category: /categ|type|kind|類別|类别|分類|分类|類型|类型/i,
  notes: /note|remark|comment|備註|备注|說明|说明/i,
  fxRate: /fx|exchange|rate|匯率|汇率/i,
  splitNames: /split|share[ds]?\s*(with|by|among)?|for\s*whom|participants|people|between|分攤|分摊|參與|参与|平分|分給|分给|人員|人员/i,
}

/** First row with at least two text cells, looking at the first 15 rows. */
export function detectHeaderRow(grid: Grid): number {
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const texts = (grid[r] ?? []).filter((c) => typeof c === "string" && c.trim() && parseAmount(c) === null)
    if (texts.length >= 2) return r
  }
  return 0
}

function columnStats(grid: Grid, headerRow: number, col: number) {
  let numbers = 0
  let dates = 0
  let filled = 0
  const year = new Date().getFullYear()
  for (let r = headerRow + 1; r < Math.min(grid.length, headerRow + 60); r++) {
    const c = grid[r]?.[col]
    if (isBlank(c)) continue
    filled++
    if (c instanceof Date || (typeof c !== "number" && parseDate(c, year))) dates++
    else if (parseAmount(c) !== null) numbers++
  }
  return { numbers, dates, filled }
}

export function guessMapping(grid: Grid, memberNames: string[] = [], forcedHeaderRow?: number): Mapping {
  const headerRow = forcedHeaderRow ?? detectHeaderRow(grid)
  const headers = (grid[headerRow] ?? []).map(cellText)
  const used = new Set<number>()
  const find = (key: keyof typeof HEADER_HINTS) => {
    const i = headers.findIndex((h, idx) => h && !used.has(idx) && HEADER_HINTS[key].test(h))
    if (i >= 0) used.add(i)
    return i >= 0 ? i : null
  }

  // "<name> share" columns are per-person splits (e.g. our own CSV export).
  const suffixPeople = headers.flatMap((h, i) => (h && PERSON_SUFFIX.test(h) && personFromHeader(h) !== h ? [i] : []))
  suffixPeople.forEach((i) => used.add(i))

  // Order matters: specific before generic.
  const currency = find("currency")
  const paidBy = find("paidBy")
  const date = find("date")
  const category = find("category")
  const notes = find("notes")
  const fxRate = find("fxRate")
  // "Amount (HKD)"-style converted totals are not the spend amount.
  headers.forEach((h, i) => {
    if (h && /\((?:[A-Z]{3})\)|converted|折合|換算|换算/i.test(h) && HEADER_HINTS.amount.test(h)) used.add(i)
  })
  const splitNames = find("splitNames")
  let amount = find("amount")
  let description = find("description")

  // Person columns: headers matching a member name, or remaining mostly-numeric/marked columns.
  const lowerMembers = memberNames.map((n) => n.toLowerCase())
  const personColumns: number[] = [...suffixPeople]
  headers.forEach((h, i) => {
    if (!h || used.has(i)) return
    if (lowerMembers.includes(personFromHeader(h).toLowerCase())) personColumns.push(i)
  })

  if (amount === null) {
    // Best numeric column not already used.
    let best: number | null = null
    let bestScore = 0
    headers.forEach((_, i) => {
      if (used.has(i) || personColumns.includes(i)) return
      const s = columnStats(grid, headerRow, i)
      if (s.numbers > bestScore) {
        best = i
        bestScore = s.numbers
      }
    })
    amount = best
    if (amount !== null) used.add(amount)
  }

  if (description === null) {
    let best: number | null = null
    let bestScore = 0
    headers.forEach((_, i) => {
      if (used.has(i) || personColumns.includes(i)) return
      const s = columnStats(grid, headerRow, i)
      const textish = s.filled - s.numbers - s.dates
      if (textish > bestScore) {
        best = i
        bestScore = textish
      }
    })
    description = best
    if (description !== null) used.add(description)
  }

  // Unmatched columns after the amount that look like per-person splits (numbers or ✓ marks).
  if (personColumns.length === 0 && splitNames === null) {
    headers.forEach((h, i) => {
      if (!h || used.has(i) || amount === null || i <= amount) return
      if (HEADER_HINTS.amount.test(h) || /rate|fx|匯率|汇率/i.test(h)) return
      const s = columnStats(grid, headerRow, i)
      const marks = countMarks(grid, headerRow, i)
      if (s.filled > 0 && s.dates === 0 && (s.numbers + marks) / s.filled > 0.8) personColumns.push(i)
    })
  }

  return {
    headerRow,
    date,
    description,
    amount,
    currency,
    paidBy,
    category,
    notes,
    fxRate,
    split: personColumns.length >= 2 ? "columns" : splitNames !== null ? "names" : "everyone",
    splitNames,
    personColumns: personColumns.length >= 2 ? personColumns : [],
  }
}

const MARK = /^(✓|✔|☑|√|v|x|✗|y|yes|o|○|●|true|是|有)$/i
const PERSON_SUFFIX = /\s*(['’]s)?\s*(share|owes?|portion|part|應付|应付|分攤|分摊|份)$/i

/** "Amy share" → "Amy"; plain names unchanged. */
export const personFromHeader = (h: string) => h.replace(PERSON_SUFFIX, "").trim() || h

function countMarks(grid: Grid, headerRow: number, col: number) {
  let n = 0
  for (let r = headerRow + 1; r < Math.min(grid.length, headerRow + 60); r++) {
    const c = grid[r]?.[col]
    if (typeof c === "boolean" ? c : MARK.test(cellText(c))) n++
  }
  return n
}

export function splitNameList(text: string): string[] {
  return text
    .split(/\s*(?:[,，、;；/&+＋|]|\band\b|和|及|與|与)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export function parseRows(grid: Grid, map: Mapping, opts: ImportOptions): ParsedRow[] {
  const headers = (grid[map.headerRow] ?? []).map(cellText)
  const out: ParsedRow[] = []
  let lastDate = opts.defaultDate

  for (let r = map.headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? []
    if (row.every(isBlank)) continue
    const get = (i: number | null) => (i === null ? null : row[i])
    const errors: string[] = []

    const rawAmount = get(map.amount)
    const amountRaw = parseAmount(rawAmount)
    const description = cellText(get(map.description))
    // Skip summary rows like "Total" with no description, or rows with no amount at all.
    if (amountRaw === null) {
      if (description) out.push(emptyRow(r, description, lastDate, opts, ["No amount — row skipped"]))
      continue
    }
    if (/^(total|sum|subtotal|合計|合计|總計|总计|小計|小计|總數|总数)$/i.test(description)) continue

    const amount = Math.abs(amountRaw)
    if (amount === 0) continue

    const d = map.date !== null ? parseDate(get(map.date), opts.defaultYear) : null
    if (map.date !== null && !isBlank(get(map.date)) && !d) errors.push(`Unrecognised date “${cellText(get(map.date))}”`)
    const date = d ?? lastDate
    lastDate = date

    const currencyCell = cellText(get(map.currency))
    const currency =
      (currencyCell && detectCurrency(currencyCell)) ||
      (typeof rawAmount === "string" ? detectCurrency(rawAmount) : null) ||
      opts.defaultCurrency

    const categoryText = cellText(get(map.category))
    const category = guessCategory(categoryText) !== "other" || !description ? guessCategory(categoryText) : guessCategory(description)

    const payerName = cellText(get(map.paidBy)) || null

    let split: ParsedRow["split"] = { kind: "everyone" }
    if (map.split === "names" && map.splitNames !== null) {
      const text = cellText(get(map.splitNames))
      const names = splitNameList(text)
      if (names.length === 0 || /^(all|everyone|全部|所有人|大家|全體|全体)$/i.test(text)) split = { kind: "everyone" }
      else split = { kind: "equal", names }
    } else if (map.split === "columns" && map.personColumns.length) {
      const nums: Record<string, number> = {}
      const marked: string[] = []
      for (const c of map.personColumns) {
        const name = personFromHeader(headers[c] || columnLetter(c))
        const v = row[c]
        if (isBlank(v) || v === false) continue
        if (v === true || MARK.test(cellText(v))) {
          marked.push(name)
          continue
        }
        const n = parseAmount(v)
        if (n !== null && n > 0) nums[name] = (nums[name] ?? 0) + n
      }
      const numNames = Object.keys(nums)
      const numValues = Object.values(nums)
      const sum = numValues.reduce((a, b) => a + b, 0)
      const everyoneMarked = [...new Set([...marked, ...numNames])]
      if (everyoneMarked.length === 0) split = { kind: "everyone" }
      else if (marked.length === 0 && Math.abs(sum - amount) < 0.011) split = { kind: "exact", shares: nums }
      else if (marked.length === 0 && numValues.every((n) => n === 1)) split = { kind: "equal", names: numNames }
      else if (marked.length === 0) {
        split = { kind: "weights", weights: nums }
        if (sum > amount) errors.push(`Per-person amounts add up to ${sum}, not ${amount}; used as ratios`)
      } else {
        split = { kind: "equal", names: everyoneMarked }
        if (numNames.length && marked.length) errors.push("Mixed ✓ marks and amounts; split equally")
      }
    }

    out.push({
      rowNumber: r + 1,
      date,
      description: description || "(no description)",
      amount,
      currency,
      fxRate: (() => {
        const v = parseAmount(get(map.fxRate))
        return v && v > 0 ? v : null
      })(),
      category,
      notes: cellText(get(map.notes)) || null,
      payerName,
      split,
      errors,
    })
  }
  return out
}

function emptyRow(r: number, description: string, date: string, opts: ImportOptions, errors: string[]): ParsedRow {
  return {
    rowNumber: r + 1,
    date,
    description,
    amount: 0,
    currency: opts.defaultCurrency,
    fxRate: null,
    category: "other",
    notes: null,
    payerName: null,
    split: { kind: "everyone" },
    errors,
  }
}

/** All person names mentioned in the parsed rows (payers + split participants). */
export function collectNames(rows: ParsedRow[]): string[] {
  const set = new Map<string, string>()
  const add = (n: string | null) => {
    if (!n) return
    const k = n.trim().toLowerCase()
    if (k && !set.has(k)) set.set(k, n.trim())
  }
  for (const r of rows) {
    if (r.errors.some((e) => e.includes("skipped"))) continue
    add(r.payerName)
    if (r.split.kind === "equal") r.split.names.forEach(add)
    if (r.split.kind === "exact") Object.keys(r.split.shares).forEach(add)
    if (r.split.kind === "weights") Object.keys(r.split.weights).forEach(add)
  }
  return [...set.values()]
}

export const nameKey = (n: string) => n.trim().toLowerCase()

/**
 * Build save_expense payload splits once names are resolved to member ids.
 * Returns null split list (with an error) when it can't be resolved.
 */
export function resolveSplit(
  row: ParsedRow,
  memberIdFor: (name: string) => string | null,
  everyone: string[]
): { mode: SplitMode; splits: { member_id: string; share: number; weight: number | null }[] } | { error: string } {
  if (row.split.kind === "exact") {
    const entries = Object.entries(row.split.shares)
    const ids = entries.map(([n]) => memberIdFor(n))
    if (ids.some((i) => !i)) return { error: "Unknown person in split" }
    // Merge duplicates and fix rounding so shares add up exactly.
    const byId = new Map<string, number>()
    entries.forEach(([, v], i) => byId.set(ids[i]!, (byId.get(ids[i]!) ?? 0) + toCents(v)))
    const diff = toCents(row.amount) - [...byId.values()].reduce((a, b) => a + b, 0)
    const first = [...byId.keys()][0]
    byId.set(first, byId.get(first)! + diff)
    return { mode: "exact", splits: [...byId].map(([member_id, c]) => ({ member_id, share: fromCents(c), weight: null })) }
  }
  if (row.split.kind === "weights") {
    const w: Record<string, number> = {}
    for (const [n, v] of Object.entries(row.split.weights)) {
      const id = memberIdFor(n)
      if (!id) return { error: `Unknown person “${n}”` }
      w[id] = (w[id] ?? 0) + v
    }
    const ids = Object.keys(w)
    const shares = computeShares(row.amount, "shares", ids, w)
    return { mode: "shares", splits: ids.map((id) => ({ member_id: id, share: shares[id], weight: w[id] })) }
  }
  let ids: string[]
  if (row.split.kind === "equal") {
    const resolved = row.split.names.map(memberIdFor)
    const missing = row.split.names.filter((_, i) => !resolved[i])
    if (missing.length) return { error: `Unknown person “${missing[0]}”` }
    ids = [...new Set(resolved as string[])]
  } else {
    ids = everyone
  }
  if (!ids.length) return { error: "Nobody to split with" }
  const shares = computeShares(row.amount, "equal", ids, {})
  return { mode: "equal", splits: ids.map((id) => ({ member_id: id, share: shares[id], weight: null })) }
}
