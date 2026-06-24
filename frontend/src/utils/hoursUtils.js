/**
 * Returns the "work date" for a timestamp.
 * Visits before 03:00 count as the previous calendar day.
 */
function workDate(isoStr) {
  const d = new Date(isoStr)
  if (d.getHours() < 3) {
    d.setDate(d.getDate() - 1)
  }
  return d.toISOString().slice(0, 10)
}

function isWeekend(dateStr) {
  const dow = new Date(dateStr + 'T12:00:00').getDay()
  return dow === 0 || dow === 6
}

/**
 * Computes per-person work hours from visit logs.
 * For each person+day: first entry → last exit = work duration.
 * Visits after midnight but before 03:00 count toward the previous day.
 * Lunch (-1h) is only subtracted on weekdays.
 */
export function computeHoursTable(rows, dateFrom, dateTo, absenceData) {
  const dates = buildDateRange(dateFrom, dateTo)

  const byCard = {}
  for (const r of rows) {
    if (!r.loged_at || r.no == null) continue
    const key  = String(r.no)
    const date = workDate(r.loged_at)
    if (!byCard[key]) byCard[key] = { name: r.name || '—', no: r.no, iin: r.iin || '', days: {} }
    const day = byCard[key].days
    if (!day[date]) day[date] = { firstIn: null, lastOut: null }
    const d = day[date]
    if (r.is_out === false && (!d.firstIn  || r.loged_at < d.firstIn))  d.firstIn  = r.loged_at
    if (r.is_out === true  && (!d.lastOut  || r.loged_at > d.lastOut))  d.lastOut  = r.loged_at
  }

  // Build absence lookup: IIN or normalized name → [{startdate, enddate}]
  const absMap = new Map()
  for (const r of absenceData?.rows ?? []) {
    const key = r.login || (r.full_name || '').toLowerCase().trim()
    if (!key) continue
    if (!absMap.has(key)) absMap.set(key, [])
    absMap.get(key).push({ s: r.startdate?.slice(0, 10), e: r.enddate?.slice(0, 10) })
  }

  function isAbsent(person, date) {
    const keys = [person.iin, person.name.toLowerCase().trim()].filter(Boolean)
    for (const k of keys) {
      const ranges = absMap.get(k)
      if (!ranges) continue
      for (const { s, e } of ranges) {
        if (s && e && date >= s && date <= e) return true
      }
    }
    return false
  }

  const people = Object.values(byCard).map(p => {
    let totalMin = 0
    const dayMin = {}
    for (const date of dates) {
      const d = p.days[date]
      if (!d?.firstIn || !d?.lastOut) {
        // No visits — if absent, count as 8h
        if (isAbsent(p, date) && !isWeekend(date)) {
          dayMin[date] = 480
          totalMin += 480
        } else {
          dayMin[date] = null
        }
        continue
      }
      const raw = Math.round((new Date(d.lastOut) - new Date(d.firstIn)) / 60000)
      const lunch = isWeekend(date) ? 0 : 60
      dayMin[date] = Math.max(0, raw - lunch)
      totalMin += dayMin[date]
    }
    return { name: p.name, no: p.no, iin: p.iin, dayMin, totalMin, days: p.days }
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
