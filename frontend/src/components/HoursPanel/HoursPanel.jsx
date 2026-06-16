import { useState, useMemo } from 'react'
import { computeHoursTable, fmtMin, hoursTier } from '../../utils/hoursUtils'
import s from './HoursPanel.module.css'

const PAGE_SIZE = 25

const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function fmtColHeader(date) {
  const d = new Date(date + 'T00:00:00')
  return { day: DAY_SHORT[d.getDay()], num: date.slice(8) }
}

export default function HoursPanel({ rows, dateFrom, dateTo, onFilterByEmployee, globalName = '' }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)

  const { people, dates } = useMemo(
    () => computeHoursTable(rows, dateFrom, dateTo),
    [rows, dateFrom, dateTo]
  )

  const filtered = useMemo(() => {
    setPage(1)
    if (!globalName.trim()) return people
    const q = globalName.trim().toLowerCase()
    return people.filter(p => p.name.toLowerCase().includes(q))
  }, [people, globalName])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Weekly total across all people
  const grandTotal = useMemo(
    () => people.reduce((s, p) => s + p.totalMin, 0),
    [people]
  )

  if (!rows.length) return null

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
        </div>
        <ChevronIcon open={open} />
      </div>

      <div className={`${s.bodyWrap} ${open ? s.bodyWrapOpen : ''}`}>
        <div className={s.bodyInner}>
        <div className={s.body}>
          <div className={s.toolbar}>
            {globalName.trim() && filtered.length !== people.length && (
              <span className={s.pill}>{filtered.length} совпадений</span>
            )}
            <span className={s.legend}>
              <span className={`${s.dot} ${s.dotGood}`} /> ≥8ч
              <span className={`${s.dot} ${s.dotWarn}`} /> 6–8ч
              <span className={`${s.dot} ${s.dotLow}`}  /> &lt;6ч
            </span>
          </div>

          <div className={s.scroll}>
            <table>
              <thead>
                <tr>
                  <th className={s.nameCol}>Сотрудник</th>
                  {dates.map(d => {
                    const h = fmtColHeader(d)
                    return (
                      <th key={d} className={s.dayCol}>
                        <span className={s.dayNum}>{h.num}</span>
                        <span className={s.dayName}>{h.day}</span>
                      </th>
                    )
                  })}
                  <th className={s.totalCol}>Итого</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={dates.length + 2} className={s.empty}>Нет данных</td></tr>
                ) : pageRows.map((p, i) => (
                  <tr key={p.no ?? i}>
                    <td
                      className={`${s.nameCell} ${onFilterByEmployee ? s.clickable : ''}`}
                      title={onFilterByEmployee ? `Показать визиты: ${p.name}` : p.name}
                      onClick={() => onFilterByEmployee?.(p.name)}
                    >{p.name}</td>
                    {dates.map(d => {
                      const mins  = p.dayMin[d]
                      const tier  = hoursTier(mins)
                      return (
                        <td key={d} className={`${s.cell} ${tier ? s[tier] : s.empty_cell}`}>
                          {mins != null ? fmtMin(mins) : <span className={s.dash}>—</span>}
                        </td>
                      )
                    })}
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
