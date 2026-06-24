export async function fetchVisits(dateFrom, dateTo, filters = {}) {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  if (filters.noName)            params.set('no_name',    'true')

  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const resp = await fetch(`${base}/api/visits?${params}`)
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${resp.status}`)
  }
  return resp.json()
}
