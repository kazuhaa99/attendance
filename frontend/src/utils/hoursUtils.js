/**
 * Computes per-person work hours from visit logs.
 * For each person+day: first entry → last exit = work duration.
 */
export function computeHoursTable(rows, dateFrom, dateTo) {
  const dates = buildDateRange(dateFrom, dateTo)

  const byCard = {}
  for (const r of rows) {
    if (!r.loged_at || r.no == null) continue
    const key  = String(r.no)
    const date = r.loged_at.slice(0, 10)
    if (!byCard[key]) byCard[key] = { name: r.name || '—', no: r.no, days: {} }
    const day = byCard[key].days
    if (!day[date]) day[date] = { firstIn: null, lastOut: null }
    const d = day[date]
    if (r.is_out === false && (!d.firstIn  || r.loged_at < d.firstIn))  d.firstIn  = r.loged_at
    if (r.is_out === true  && (!d.lastOut  || r.loged_at > d.lastOut))  d.lastOut  = r.loged_at
  }

  const people = Object.values(byCard).map(p => {
    let totalMin = 0
    const dayMin = {}
    for (const date of dates) {
      const d = p.days[date]
      if (!d?.firstIn || !d?.lastOut) { dayMin[date] = null; continue }
      const raw  = Math.round((new Date(d.lastOut) - new Date(d.firstIn)) / 60000)
      dayMin[date] = Math.max(0, raw - 60)  // -1ч обед
      totalMin += dayMin[date]
    }
    return { name: p.name, no: p.no, dayMin, totalMin, days: p.days }
  }).filter(p => p.totalMin > 0)

  people.sort((a, b) => b.totalMin - a.totalMin)
  return { people, dates }
}

export function buildDateRange(from, to) {
  const dates = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to   + 'T00:00:00')
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export function groupDatesByWeek(dates) {
  if (!dates.length) return []
  const weeks = []
  let current = null
  for (const date of dates) {
    const d = new Date(date + 'T00:00:00')
    const day = d.getDay()
    const mon = new Date(d)
    mon.setDate(d.getDate() - ((day + 6) % 7))
    const weekKey = mon.toISOString().slice(0, 10)
    if (!current || current.weekKey !== weekKey) {
      current = { weekKey, dates: [] }
      weeks.push(current)
    }
    current.dates.push(date)
  }
  return weeks
}

export function fmtMin(mins) {
  if (mins == null) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

// Color tier: green ≥ 8h, yellow 6-8h, red < 6h
export function hoursTier(mins) {
  if (mins == null) return null
  if (mins >= 480) return 'good'
  if (mins >= 360) return 'warn'
  return 'low'
}
