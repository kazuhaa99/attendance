import { deduplicateAbsences } from '../utils/absenceUtils'

export async function fetchAbsences(dateFrom, dateTo) {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const resp = await fetch(`${base}/api/absences?${params}`)
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${resp.status}`)
  }
  const data = await resp.json()
  if (data?.rows) data.rows = deduplicateAbsences(data.rows)
  return data
}
