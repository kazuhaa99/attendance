/** ISO-date (YYYY-MM-DD or datetime) → ДД.ММ.ГГГГ */
export function fmtDate(iso) {
  if (!iso) return '—'
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}.${m}.${y}`
}

/** ISO-datetime → ДД.ММ.ГГГГ ЧЧ:ММ:СС */
export function fmtDateTime(iso) {
  if (!iso) return '—'
  const date = fmtDate(iso)
  const time = String(iso).length >= 19 ? String(iso).slice(11, 19)
             : String(iso).length >= 16 ? String(iso).slice(11, 16)
             : ''
  return time ? `${date} ${time}` : date
}

/** ISO-datetime → ЧЧ:ММ */
export function fmtTime(iso) {
  if (!iso) return '—'
  return String(iso).slice(11, 16)
}
