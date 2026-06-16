import { useState, useEffect } from 'react'
import { fetchAbsences } from '../api/absences'

export function useAbsences(dateFrom, dateTo, refreshKey = 0) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!dateFrom || !dateTo) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchAbsences(dateFrom, dateTo)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [dateFrom, dateTo, refreshKey])

  return { data, loading, error }
}
