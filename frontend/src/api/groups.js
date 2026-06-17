const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export async function fetchGroups() {
  const resp = await fetch(`${base}/api/groups`)
  if (!resp.ok) return {}
  return resp.json()
}
