import { useState, useEffect } from 'react'

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export function useStaff() {
  const [data, setData] = useState({ count: 0, cards: [] })

  useEffect(() => {
    fetch(`${base}/api/staff`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
  }, [])

  return data
}
