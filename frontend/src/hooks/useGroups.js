import { useState, useEffect } from 'react'
import { fetchGroups } from '../api/groups'

export function useGroups() {
  const [groupMap, setGroupMap] = useState({})

  useEffect(() => {
    fetchGroups().then(setGroupMap).catch(() => {})
  }, [])

  return groupMap
}
