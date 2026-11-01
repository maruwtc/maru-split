// Display format for the whole app: DD/MM/YYYY. Storage stays ISO (YYYY-MM-DD).

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-")
  return { y, m, d }
}

/** "2026-12-22" → "22/12/2026" */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return ""
  const { y, m, d } = parts(iso)
  return `${d}/${m}/${y}`
}

/** "2026-12-22" → "Tue 22/12/2026" */
export function formatDay(iso: string) {
  const { y, m, d } = parts(iso)
  const wd = WEEKDAYS[new Date(Date.UTC(+y, +m - 1, +d)).getUTCDay()]
  return `${wd} ${d}/${m}/${y}`
}

/** Trip range: "20/12/2026 – 27/12/2026" */
export function formatRange(start: string | null, end: string | null) {
  if (!start) return null
  return end && end !== start ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start)
}
