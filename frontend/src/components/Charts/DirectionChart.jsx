import { useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import s from './Charts.module.css'

ChartJS.register(ArcElement, Tooltip, Legend)

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

// index → direction value
const DIR = ['in', 'out', null]

export default function DirectionChart({ rows, activeDirection, onFilter }) {
  const { labels, values } = useMemo(() => {
    const inCount  = rows.filter(r => r.is_out === false).length
    const outCount = rows.filter(r => r.is_out === true).length
    const other    = rows.length - inCount - outCount
    const labels = ['Вход', 'Выход']
    const values = [inCount, outCount]
    if (other > 0) { labels.push('Неизвестно'); values.push(other) }
    return { labels, values }
  }, [rows])

  // active segment: brighter + offset
  const bg = labels.map((l, i) => {
    const active = (i === 0 && activeDirection === 'in') || (i === 1 && activeDirection === 'out')
    if (l === 'Вход')      return active ? 'rgba(34,197,94,.85)'  : 'rgba(34,197,94,.45)'
    if (l === 'Выход')     return active ? 'rgba(239,68,68,.85)'  : 'rgba(239,68,68,.45)'
    return 'rgba(99,102,241,.45)'
  })
  const bd = labels.map(l => {
    if (l === 'Вход')  return '#22c55e'
    if (l === 'Выход') return '#ef4444'
    return '#6366f1'
  })
  const offsets = labels.map((l, i) =>
    (i === 0 && activeDirection === 'in') || (i === 1 && activeDirection === 'out') ? 12 : 0
  )

  const chartData = {
    labels,
    datasets: [{ data: values, backgroundColor: bg, borderColor: bd, borderWidth: 2, offset: offsets, hoverOffset: 6 }],
  }

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    cutout:              '66%',
    plugins: {
      legend: {
        display:  true,
        position: 'bottom',
        labels: {
          color:           '#71717a',
          font:            { size: 12 },
          padding:         14,
          usePointStyle:   true,
          pointStyleWidth: 8,
        },
      },
      tooltip: tooltip(),
    },
    onClick: (_evt, elements) => {
      if (elements.length === 0 || !onFilter) return
      const idx = elements[0].index
      const dir = DIR[idx] ?? null
      if (!dir) return
      // toggle: click active → clear
      onFilter({ direction: activeDirection === dir ? '' : dir })
    },
    onHover: (evt, elements) => {
      if (onFilter) evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'
    },
  }

  return (
    <div className={`${s.panel} ${activeDirection ? s.panelActive : ''}`}>
      <div className={s.panelHeader}>
        <div className={s.panelTitle}>Направления</div>
        <div className={s.panelSub}>
          {activeDirection
            ? <><span className={s.activeTag}>{activeDirection === 'in' ? '↑ Вход' : '↓ Выход'}</span>&nbsp;<span className={s.clearTag} onClick={() => onFilter({ direction: '' })}>сбросить ×</span></>
            : 'нажмите сегмент для фильтра'
          }
        </div>
      </div>
      <div className={s.panelBody}>
        <div className={s.chartWrap}>
          <Doughnut data={chartData} options={options} />
        </div>
      </div>
    </div>
  )
}
