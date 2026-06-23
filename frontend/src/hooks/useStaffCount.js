import { useState, useEffect } from 'react'

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export function useStaffCount() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    fetch(`${base}/api/staff-count`)
      .then(r => r.json())
      .then(d => setCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  return count
}
