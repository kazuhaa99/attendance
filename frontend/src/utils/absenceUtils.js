// Kazakh → Russian normalization so "Дәурен"/"Даурен", "Есерқепов"/"Есеркепов" match
const KZ_FROM = 'әқңүұіөғһӘҚҢҮҰІӨҒҺ'
const KZ_TO   = 'акнууиогхАКНУУИОГХ'

export function normalize(s) {
  if (!s) return ''
  let r = ''
  for (const ch of s) {
    const i = KZ_FROM.indexOf(ch)
    r += i >= 0 ? KZ_TO[i] : ch
  }
  return r.toLowerCase().trim()
}

/**
 * Compares two normalized name strings handling FIO vs FI mismatch:
 *   "ркен мирас бекзатулы" vs "ркен мирас" → match
 * Returns true if one name is a word-boundary prefix of the other.
 */
export function nameMatch(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a]
  // shorter must be a full-word prefix of longer
  return longer.startsWith(shorter + ' ')
}

/**
 * Returns true if `query` matches `target` (partial search + Kazakh normalization + FIO/FI).
 * Both strings should already be normalize()d.
 */
export function nameSearchMatch(normTarget, normQuery) {
  if (!normQuery) return true
  if (!normTarget) return false
  // target contains query (user typed partial name)
  if (normTarget.includes(normQuery)) return true
  // query is FIO, target is FI — FIO starts with target
  if (normQuery.startsWith(normTarget + ' ')) return true
  return false
}

// Color key by absence type
export function absenceColorKey(typeName) {
  if (!typeName) return 'default'
  const t = typeName.toLowerCase()
  if (t.includes('отпуск') || t.includes('vacation') || t.includes('демалыс'))  return 'vacation'
  if (t.includes('болезн') || t.includes('больнич') || t.includes('sick'))       return 'sick'
  if (t.includes('команд') || t.includes('business') || t.includes('іссапар'))   return 'trip'
  if (t.includes('декрет') || t.includes('maternity'))                            return 'maternity'
  if (t.includes('учеб') || t.includes('study'))                                 return 'study'
  return 'other'
}

export const COLOR_LABELS = {
  vacation: { label: 'Отпуск',       status: 'В отпуске',       color: 'var(--accent)' },
  sick:     { label: 'Больничный',   status: 'На больничном',   color: '#f97316' },
  trip:     { label: 'Командировка', status: 'В командировке',  color: '#a78bfa' },
  maternity:{ label: 'Декрет',       status: 'В декрете',       color: '#f472b6' },
  study:    { label: 'Учебный',      status: 'На учёбе',        color: '#22d3ee' },
  other:    { label: 'Иное',         status: 'Отсутствует',     color: 'var(--muted)' },
  default:  { label: '',             status: '',                 color: 'var(--muted)' },
}

const NAME_CANDIDATES = ['full_name', 'fio', 'employee_name', 'name']

export function detectNameColumn(columns = []) {
  const lower = columns.map(c => c.toLowerCase())
  for (const c of NAME_CANDIDATES) {
    if (lower.includes(c)) return columns[lower.indexOf(c)]
  }
  return null
}

/**
 * Build lookup maps for absence matching:
 *   fullMap:     normalized full name (FIO)   → absenceInfo
 *   fiMap:       normalized first 2 words (FI) → absenceInfo  (handles FI vs FIO mismatch)
 *   lastnameMap: normalized lastname only      → absenceInfo  (last-resort fallback)
 */
export function buildAbsenceMap(absenceRows) {
  const fullMap     = new Map()
  const fiMap       = new Map()
  const lastnameMap = new Map()
  const iinMap      = new Map()

  for (const row of absenceRows) {
    const info = {
      colorKey:          absenceColorKey(row.type_absence_name),
      type_absence_name: row.type_absence_name ?? '',
      startdate:         row.startdate ?? '',
      enddate:           row.enddate ?? '',
    }

    const normFull = row._norm_full     ?? normalize(row.full_name ?? '')
    const normLast = row._norm_lastname ?? normalize(row.lastname ?? '')
    const normFI   = normFull.split(' ').slice(0, 2).join(' ')

    if (normFull && !fullMap.has(normFull))     fullMap.set(normFull, info)
    if (normFI   && !fiMap.has(normFI))         fiMap.set(normFI, info)
    if (normLast && !lastnameMap.has(normLast)) lastnameMap.set(normLast, info)
    if (row.login && !iinMap.has(row.login))    iinMap.set(row.login, info)
  }

  return { fullMap, fiMap, lastnameMap, iinMap }
}

/**
 * Returns absence info if the employee is absent on visitDate, else null.
 * Matching order:
 *   0. IIN exact match (most reliable)
 *   1. Exact normalized full name
 *   2. First 2 words of absence name vs visit name (FI matching)
 *   3. Last name only (fallback)
 */
function _checkDates(info, date) {
  if (!info) return null
  if (info.startdate && info.enddate) {
    const s = info.startdate.slice(0, 10)
    const e = info.enddate.slice(0, 10)
    return date >= s && date <= e ? info : null
  }
  return info
}

export function getAbsenceForVisit(maps, employeeName, visitDate, iin) {
  if (!visitDate || !maps) return null
  const { fullMap, fiMap, lastnameMap, iinMap } = maps
  const date = visitDate.slice(0, 10)

  if (iin && iinMap?.has(iin)) return _checkDates(iinMap.get(iin), date)

  if (!employeeName) return null
  if (!fullMap.size && !fiMap.size && !lastnameMap.size) return null

  const normFull = normalize(employeeName)
  const normLast = normalize(employeeName.split(' ')[0])

  return _checkDates(
    fullMap.get(normFull) ?? fiMap.get(normFull) ?? lastnameMap.get(normLast) ?? null,
    date
  )
}

export function daysBetween(start, end) {
  if (!start || !end) return null
  const s = new Date(start.slice(0, 10))
  const e = new Date(end.slice(0, 10))
  return Math.max(0, Math.round((e - s) / 86400000) + 1)
}

// Priority of event_type_name — lower = shown first when deduplicating
const EVENT_PRIORITY = {
  'в отпуске':      0,
  'на больничном':  1,
  'в командировке': 2,
  'в декрете':      3,
  'на учёбе':       4,
  'подтверждено':   5,
  'утверждено':     5,
  'approved':       5,
}
function eventPrio(name) {
  return EVENT_PRIORITY[String(name ?? '').toLowerCase().trim()] ?? 99
}

export function deduplicateAbsences(rows) {
  const best = new Map()
  for (const r of rows) {
    const key = `${r.full_name ?? r.lastname ?? ''}|${r.startdate ?? ''}|${r.enddate ?? ''}`
    const prev = best.get(key)
    if (!prev || eventPrio(r.event_type_name) < eventPrio(prev.event_type_name)) {
      best.set(key, r)
    }
  }
  return [...best.values()]
}
