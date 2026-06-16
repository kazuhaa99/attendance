import { useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Tooltip, Legend,
} from 'chart.js'
import s from './Charts.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
function tooltip() {
  return {
    backgroundColor: cssVar('--surface') || '#18181b',
    borderColor:     cssVar('--border')  || '#27272a',
    borderWidth:     1,
    titleColor:      cssVar('--text')    || '#f4f4f5',
    bodyColor:       cssVar('--muted')   || '#71717a',
    padding:         10,
    cornerRadius:    6,
  }
}

function diffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}
function isoDate(d) { return d.toISOString().slice(0, 10) }
function pad2(n) { return String(n).padStart(2, '0') }

export default function TimelineChart({ rows, dateFrom, dateTo, onDateFilter, globalName }) {
  const days   = diffDays(dateFrom, dateTo)
  const byHour = days === 0 || !!globalName?.trim()

  const [selectedHour, setSelectedHour] = useState(null)
  const activeHour = byHour ? selectedHour : null
  const activeSingleDay = dateFrom === dateTo ? dateFrom : null

  const chart = useMemo(() => {
    // ── Minute drill-down ──────────────────────────────────────
    if (byHour && activeHour !== null) {
      const buckets = Array(60).fill(0)
      for (const r of rows) {
        if (!r.loged_at) continue
        const d = new Date(r.loged_at)
        if (d.getHours() === activeHour) buckets[d.getMinutes()]++
      }
      const personLabel = globalName?.trim() ? ` · ${globalName.trim().split(' ').slice(0, 2).join(' ')}` : ''
      return {
        mode:    'minute',
        labels:  Array.from({ length: 60 }, (_, i) => `${pad2(activeHour)}:${pad2(i)}`),
        counts:  buckets,
        isoKeys: null,
        title:   `Активность в ${pad2(activeHour)}:00`,
        sub:     `${buckets.reduce((a, b) => a + b, 0)} событий${personLabel}`,
      }
    }

    // ── Hourly view ────────────────────────────────────────────
    if (byHour) {
      const buckets = Array(24).fill(0)
      for (const r of rows) {
        if (r.loged_at) buckets[new Date(r.loged_at).getHours()]++
      }
      const personLabel = globalName?.trim() ? ` · ${globalName.trim().split(' ').slice(0, 2).join(' ')}` : ''
      return {
        mode:    'hour',
        labels:  Array.from({ length: 24 }, (_, i) => `${pad2(i)}:00`),
        counts:  buckets,
        isoKeys: null,
        title:   'Активность по часам',
        sub:     `${days <= 0 ? '1 день' : `${days + 1} дн.`}${personLabel}`,
      }
    }

    // ── Day view ───────────────────────────────────────────────
    const keys = []
    let cur = new Date(dateFrom + 'T12:00:00')
    const end = new Date(dateTo + 'T12:00:00')
    while (cur <= end) { keys.push(isoDate(new Date(cur))); cur.setDate(cur.getDate() + 1) }
    const dayMap = Object.fromEntries(keys.map(k => [k, 0]))
    for (const r of rows) {
      const day = r.loged_at?.slice(0, 10)
      if (day && day in dayMap) dayMap[day]++
    }
    return {
      mode:    'day',
      labels:  keys.map(d => new Date(d + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })),
      counts:  keys.map(k => dayMap[k]),
      isoKeys: keys,
      title:   'Посещения по дням',
      sub:     `${rows.length.toLocaleString('ru-RU')} записей · ${days + 1} дн.`,
    }
  }, [rows, dateFrom, dateTo, byHour, days, activeHour, globalName])

  const { mode, labels, counts, isoKeys, title, sub } = chart

  const bgColors = counts.map((_, i) => {
    if (mode === 'day')    return isoKeys[i] === activeSingleDay ? '#6366f1' : 'rgba(99,102,241,0.55)'
    if (mode === 'minute') return counts[i] > 0 ? 'rgba(99,102,241,0.65)' : 'rgba(99,102,241,0.2)'
    return 'rgba(99,102,241,0.55)'
  })
  const bdColors = counts.map((_, i) => {
    if (mode === 'day') return isoKeys[i] === activeSingleDay ? '#a5b4fc' : '#6366f1'
    return '#6366f1'
  })

  const chartData = {
    labels,
    datasets: [{
      data:            counts,
      backgroundColor: bgColors,
      borderColor:     bdColors,
      borderWidth:     1,
      borderRadius:    mode === 'minute' ? 2 : 3,
      borderSkipped:   false,
    }],
  }

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: tooltip() },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks: {
          color: '#71717a',
          font: { size: 11 },
          ...(mode === 'minute'
            ? { callback: (_, i) => i % 5 === 0 ? labels[i] : '', maxRotation: 0, autoSkip: false }
            : {}),
        },
        border: { color: 'transparent' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks: { color: '#71717a', font: { size: 11 }, precision: 0 },
        border: { color: 'transparent' },
        beginAtZero: true,
      },
    },
    onClick: (_evt, elements) => {
      if (elements.length === 0) return
      const idx = elements[0].index
      if (mode === 'day' && onDateFilter) {
        onDateFilter(activeSingleDay === isoKeys[idx] ? null : isoKeys[idx])
      } else if (mode === 'hour') {
        setSelectedHour(idx)
      }
    },
    onHover: (evt, elements) => {
      evt.native.target.style.cursor =
        (mode === 'day' || mode === 'hour') && elements.length ? 'pointer' : 'default'
    },
  }

  return (
    <div className={`${s.panel} ${activeSingleDay ? s.panelActive : ''}`}>
      <div className={s.panelHeader}>
        <div className={s.panelTitle}>{title}</div>
        <div className={s.panelSub}>
          {sub}
          {mode === 'day' && activeSingleDay && (
            <span className={s.activeTag}>
              {new Date(activeSingleDay + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              &nbsp;·&nbsp;
              <span className={s.clearTag} onClick={() => onDateFilter(null)}>сбросить ×</span>
            </span>
          )}
          {mode === 'minute' && (
            <span className={s.activeTag}>
              <span className={s.clearTag} onClick={() => setSelectedHour(null)}>← назад к часам</span>
            </span>
          )}
        </div>
      </div>
      <div className={s.panelBody}>
        <div className={s.chartWrap}>
          <Bar data={chartData} options={options} />
        </div>
      </div>
    </div>
  )
}
