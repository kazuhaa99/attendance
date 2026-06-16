const CUT_IN  = '08:30:00'
const CUT_OUT = '17:30:00'

const t = r => r.loged_at.slice(11, 19)

export function computeWorkStats(rows) {
  const firstEntry = {}
  const lastExit   = {}

  for (const r of rows) {
    if (!r.loged_at) continue
    // group by card+day — card number is more stable than name
    const key = `${r.no}_${r.loged_at.slice(0, 10)}`
    if (r.is_out === false) {
      if (!firstEntry[key] || r.loged_at < firstEntry[key].loged_at)
        firstEntry[key] = r
    } else if (r.is_out === true) {
      if (!lastExit[key] || r.loged_at > lastExit[key].loged_at)
        lastExit[key] = r
    }
  }

  const earlyIn  = Object.values(firstEntry).filter(r => t(r) <  CUT_IN)
  const lateIn   = Object.values(firstEntry).filter(r => t(r) >= CUT_IN)
  const earlyOut = Object.values(lastExit).filter(r =>  t(r) <  CUT_OUT)
  const lateOut  = Object.values(lastExit).filter(r =>  t(r) >= CUT_OUT)

  return {
    early_in:  { label: 'Пришли до 08:30',   sub: 'первый вход',      color: 'green',  icon: '↑', rows: earlyIn  },
    late_in:   { label: 'Пришли после 08:30', sub: 'первый вход',      color: 'orange', icon: '↑', rows: lateIn   },
    early_out: { label: 'Ушли до 17:30',      sub: 'последний выход',  color: 'orange', icon: '↓', rows: earlyOut },
    late_out:  { label: 'Ушли после 17:30',   sub: 'последний выход',  color: 'green',  icon: '↓', rows: lateOut  },
  }
}
