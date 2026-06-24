import { useState, useEffect } from 'react'
import { fetchVisits } from '../api/visits'

export function useVisits(dateFrom, dateTo, filters, refreshKey) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!dateFrom || !dateTo) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchVisits(dateFrom, dateTo, filters)
      .then(result => {
        if (!cancelled) setData({ ...result, fetchedAt: new Date() })
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, filters.noName, refreshKey])

  return { data, loading, error }
}
