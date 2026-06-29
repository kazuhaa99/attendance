import { useState, useMemo, useEffect } from 'react'
import { computeHoursTable, groupDatesByWeek, fmtMin, hoursTier, weekHoursTier } from '../../utils/hoursUtils'
import { fetchVisits } from '../../api/visits'
import s from './HoursPanel.module.css'

const PAGE_SIZE = 25

const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function fmtColHeader(date) {
  const d = new Date(date + 'T00:00:00')
  return { day: DAY_SHORT[d.getDay()], num: date.slice(8) }
}

function fmtWeekLabel(week) {
  const first = new Date(week.dates[0] + 'T00:00:00')
  const last = new Date(week.dates[week.dates.length - 1] + 'T00:00:00')
  const d1 = first.getDate()
  const d2 = last.getDate()
  const m1 = MONTH_SHORT[first.getMonth()]
  const m2 = MONTH_SHORT[last.getMonth()]
  if (m1 === m2) return `${d1}–${d2} ${m1}`
  return `${d1} ${m1} – ${d2} ${m2}`
}

function weekMinutes(person, weekDates) {
  let total = 0
  for (const d of weekDates) {
    if (person.dayMin[d] != null) total += person.dayMin[d]
  }
  return total
}

function lastMonday() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const today = () => new Date().toISOString().slice(0, 10)

const DEFAULT_FROM = '2026-05-01'

const PRESETS = [
  { label: 'Всё', from: () => DEFAULT_FROM, to: today },
  { label: '1 нед', from: () => lastMonday(), to: today },
  { label: '2 нед', from: () => daysAgo(13), to: today },
  { label: 'Месяц', from: () => daysAgo(29), to: today },
]

export default function HoursPanel({ absenceData, onFilterByEmployee, globalName = '' }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [preset, setPreset] = useState(0)
  const [hoursFrom, setHoursFrom] = useState(() => DEFAULT_FROM)
  const [hoursTo, setHoursTo] = useState(today)
  const [hoursRows, setHoursRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hoursFrom || !hoursTo) return
    let cancelled = false
    setLoading(true)
    fetchVisits(hoursFrom, hoursTo, {})
      .then(d => { if (!cancelled) setHoursRows(d.rows ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hoursFrom, hoursTo])

  const { people, dates } = useMemo(
    () => computeHoursTable(hoursRows, hoursFrom, hoursTo, absenceData),
    [hoursRows, hoursFrom, hoursTo, absenceData]
  )

  const weeks = useMemo(() => groupDatesByWeek(dates), [dates])
  const hasMultipleWeeks = weeks.length > 1

  const filtered = useMemo(() => {
    setPage(1)
    if (!globalName.trim()) return people
    const q = globalName.trim().toLowerCase()
    return people.filter(p => p.name.toLowerCase().includes(q))
  }, [people, globalName])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const grandTotal = useMemo(
    () => people.reduce((s, p) => s + p.totalMin, 0),
    [people]
  )

  const totalCols = dates.length + (hasMultipleWeeks ? weeks.length : 0) + 2

  function selectPreset(i) {
    setPreset(i)
    setHoursFrom(PRESETS[i].from())
    setHoursTo(PRESETS[i].to())
  }

  function setCustomFrom(v) {
    setPreset(-1)
    setHoursFrom(v)
  }

  function setCustomTo(v) {
    setPreset(-1)
    setHoursTo(v)
  }

  return (
    <div className={s.wrap}>
      <div className={`${s.header} ${open ? s.headerOpen : ''}`} onClick={() => setOpen(o => !o)}>
        <div className={s.headerLeft}>
          <div className={s.iconBadge}><ClockIcon /></div>
          <span className={s.title}>Часы работы</span>
          {people.length > 0 && <span className={s.pill}>{people.length} чел.</span>}
          {grandTotal > 0 && (
            <span className={s.totalPill} title="Суммарные часы всех сотрудников">
              {fmtMin(grandTotal)} ч
            </span>
          )}
          {loading && <span className={s.pill}>загрузка…</span>}
        </div>
        <ChevronIcon open={open} />
      </div>

      <div className={`${s.bodyWrap} ${open ? s.bodyWrapOpen : ''}`}>
        <div className={s.bodyInner}>
        <div className={s.body}>
          <div className={s.toolbar} onClick={e => e.stopPropagation()}>
            <div className={s.presets}>
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  className={`${s.presetBtn} ${preset === i ? s.presetActive : ''}`}
                  onClick={() => selectPreset(i)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className={s.dateInputs}>
              <input
                type="date"
                className={s.dateInput}
                value={hoursFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
              <span className={s.dateSep}>—</span>
              <input
                type="date"
                className={s.dateInput}
                value={hoursTo}
                onChange={e => setCustomTo(e.target.value)}
              />
            </div>
            <span className={s.legend}>
              <span className={`${s.dot} ${s.dotGood}`} /> ≥8ч
              <span className={`${s.dot} ${s.dotWarn}`} /> 6–8ч
              <span className={`${s.dot} ${s.dotLow}`}  /> &lt;6ч
            </span>
          </div>

          <div className={s.scroll}>
            <table>
              <thead>
                {hasMultipleWeeks && (
                  <tr className={s.weekHeaderRow}>
                    <th className={s.nameCol} />
                    {weeks.map((w, wi) => (
                      <th
                        key={w.weekKey}
                        colSpan={w.dates.length + 1}
                        className={`${s.weekHeader} ${wi > 0 ? s.weekBorderLeft : ''}`}
                      >
                        {fmtWeekLabel(w)}
                      </th>
                    ))}
                    <th className={s.totalCol} />
                  </tr>
                )}
                <tr>
                  <th className={s.nameCol}>Сотрудник</th>
                  {weeks.map((w, wi) => (
                    w.dates.map((d, di) => {
                      const h = fmtColHeader(d)
                      const isFirstInWeek = hasMultipleWeeks && di === 0 && wi > 0
                      return (
                        <th key={d} className={`${s.dayCol} ${isFirstInWeek ? s.weekBorderLeft : ''}`}>
                          <span className={s.dayNum}>{h.num}</span>
                          <span className={s.dayName}>{h.day}</span>
                        </th>
                      )
                    }).concat(
                      hasMultipleWeeks
                        ? [<th key={`wt-${w.weekKey}`} className={s.weekTotalCol}>Нед.</th>]
                        : []
                    )
                  )).flat()}
                  <th className={s.totalCol}>Итого</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={totalCols} className={s.empty}>{loading ? 'Загрузка…' : 'Нет данных'}</td></tr>
                ) : pageRows.map((p, i) => (
                  <tr key={p.no ?? i}>
                    <td
                      className={`${s.nameCell} ${onFilterByEmployee ? s.clickable : ''}`}
                      title={onFilterByEmployee ? `Показать визиты: ${p.name}` : p.name}
                      onClick={() => onFilterByEmployee?.(p.name)}
                    >{p.name}</td>
                    {weeks.map((w, wi) => (
                      w.dates.map((d, di) => {
                        const mins = p.dayMin[d]
                        const tier = hoursTier(mins)
                        const isFirstInWeek = hasMultipleWeeks && di === 0 && wi > 0
                        return (
                          <td key={d} className={`${s.cell} ${tier ? s[tier] : s.empty_cell} ${isFirstInWeek ? s.weekBorderLeft : ''}`}>
                            {mins != null ? fmtMin(mins) : <span className={s.dash}>—</span>}
                          </td>
                        )
                      }).concat(
                        hasMultipleWeeks
                          ? [(() => {
                              const wm = weekMinutes(p, w.dates)
                              const wTier = weekHoursTier(wm)
                              return (
                                <td key={`wt-${w.weekKey}`} className={`${s.cell} ${s.weekTotalCell} ${wTier ? s[wTier] : ''}`}>
                                  {wm > 0 ? fmtMin(wm) : <span className={s.dash}>—</span>}
                                </td>
                              )
                            })()]
                          : []
                      )
                    )).flat()}
                    <td className={`${s.cell} ${s.totalCell}`}>{fmtMin(p.totalMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={s.pagination} onClick={e => e.stopPropagation()}>
              <button className={s.pgBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
              {pageNumbers(safePage, totalPages).map((n, i) =>
                n === '…'
                  ? <span key={`d${i}`} className={s.pgDots}>…</span>
                  : <button key={n} className={`${s.pgBtn} ${n === safePage ? s.pgActive : ''}`} onClick={() => setPage(n)}>{n}</button>
              )}
              <button className={s.pgBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <span className={s.pgInfo}>{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} из {filtered.length}</span>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (current > 3) pages.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="8"/>
    <path d="M10 5v5l3 3"/>
  </svg>
)
const ChevronIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
    <path d="M3 5l4 4 4-4"/>
  </svg>
)
