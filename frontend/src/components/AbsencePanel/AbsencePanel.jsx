import { useState, useMemo } from 'react'
import {
  absenceColorKey, COLOR_LABELS, daysBetween, normalize, nameSearchMatch,
} from '../../utils/absenceUtils'
import { fmtDate } from '../../utils/dateUtils'
import s from './AbsencePanel.module.css'

const PAGE_SIZE = 20

export default function AbsencePanel({ data, loading, error, anomalyNames, onFilterByEmployee, dateFrom, dateTo, globalName = '', branchFilter = '' }) {
  const anomalyCount = anomalyNames?.size ?? 0

  const [open,          setOpen]          = useState(true)
  const [typeFilter,    setTypeFilter]    = useState('all')
  const [anomalyFilter, setAnomalyFilter] = useState(false)
  const [page,          setPage]          = useState(1)

  const rows = useMemo(() => {
    const all = data?.rows ?? []
    if (!dateFrom || !dateTo) return all
    return all.filter(r => {
      const s = r.startdate?.slice(0, 10)
      const e = r.enddate?.slice(0, 10)
      if (!s || !e) return true
      return s <= dateTo && e >= dateFrom
    })
  }, [data?.rows, dateFrom, dateTo])
  const cols = data?.columns ?? (rows.length ? Object.keys(rows[0]) : [])

  // Apply name + branch filters first — summary counts reflect current selection
  const baseFiltered = useMemo(() => {
    let list = rows
    if (globalName.trim()) {
      const q = normalize(globalName.trim())
      list = list.filter(r => {
        const name = normalize(String(r.full_name ?? r.lastname ?? ''))
        return nameSearchMatch(name, q)
      })
    }
    if (branchFilter) list = list.filter(r => r.branch_name === branchFilter)
    return list
  }, [rows, globalName, branchFilter])

  const summary = useMemo(() => {
    const counts = {}
    for (const r of baseFiltered) {
      const ck = absenceColorKey(r.type_absence_name)
      counts[ck] = (counts[ck] ?? 0) + 1
    }
    return counts
  }, [baseFiltered])

  const filtered = useMemo(() => {
    setPage(1)
    let list = baseFiltered
    if (typeFilter !== 'all') list = list.filter(r => absenceColorKey(r.type_absence_name) === typeFilter)
    if (anomalyFilter && anomalyNames?.size) {
      list = list.filter(r => {
        const fullNorm = normalize(r.full_name || r.lastname || '')
        const fi = fullNorm.split(' ').slice(0, 2).join(' ')
        return anomalyNames.has(fi) || anomalyNames.has(fullNorm)
      })
    }
    return list
  }, [baseFiltered, typeFilter, anomalyFilter, anomalyNames])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (data?.disabled) return null
  if (!loading && !error && rows.length === 0 && !data) return null

  const types = Object.keys(summary)

  return (
    <div id="absence-panel" className={s.wrap}>
      <div className={`${s.header} ${open ? s.headerOpen : ''}`} onClick={() => setOpen(o => !o)}>
        <div className={s.headerLeft}>
          <div className={s.iconBadge}><CalendarIcon /></div>
          <span className={s.title}>Отсутствия</span>
          {rows.length > 0 && <span className={s.pill}>{rows.length}</span>}
          {(globalName.trim() || branchFilter) && baseFiltered.length !== rows.length && (
            <span className={s.filterPill}>{baseFiltered.length} совпадений</span>
          )}
          {anomalyCount > 0 && (
            <span
              className={`${s.anomalyPill} ${anomalyFilter ? s.anomalyPillActive : ''}`}
              title={anomalyFilter ? 'Сбросить фильтр аномалий' : 'Показать только аномалии (пришли, но числятся в отпуске)'}
              onClick={e => { e.stopPropagation(); setAnomalyFilter(f => !f); if (!open) setOpen(true) }}
            >
              ⚠ {anomalyCount} аномалий
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </div>

      <div className={`${s.bodyWrap} ${open ? s.bodyWrapOpen : ''}`}>
        <div className={s.bodyInner}>
        <div className={s.body}>
          {loading && <div className={s.hint}>Загрузка из Impala...</div>}
          {error   && <div className={s.errorHint}>Ошибка: {error}</div>}

          {rows.length > 0 && (
            <>
              <div className={s.cards}>
                {types.map(ck => (
                  <button
                    key={ck}
                    className={`${s.card} ${typeFilter === ck ? s.cardActive : ''}`}
                    style={{ '--c': COLOR_LABELS[ck]?.color ?? 'var(--muted)' }}
                    onClick={e => { e.stopPropagation(); setTypeFilter(t => t === ck ? 'all' : ck) }}
                  >
                    <span className={s.cardCount}>{summary[ck]}</span>
                    <span className={s.cardLabel}>{COLOR_LABELS[ck]?.label ?? ck}</span>
                  </button>
                ))}
                {typeFilter !== 'all' && (
                  <button className={s.clearBtn} onClick={e => { e.stopPropagation(); setTypeFilter('all') }}>
                    сбросить ×
                  </button>
                )}
              </div>

              <div className={s.scroll}>
                <table>
                  <thead>
                    <tr>
                      <th>Сотрудник</th>
                      <th>Тип</th>
                      <th>Начало</th>
                      <th>Конец</th>
                      <th>Дней</th>
                      {cols.includes('branch_name') && <th>Подразделение</th>}
                      {cols.includes('event_type_name') && <th>SimBase</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} className={s.empty}>Нет записей</td></tr>
                    ) : pageRows.map((r, i) => {
                      const ck = absenceColorKey(r.type_absence_name)
                      const clr = COLOR_LABELS[ck]?.color ?? 'var(--muted)'
                      return (
                        <tr
                          key={i}
                          className={onFilterByEmployee ? s.clickableRow : ''}
                          onClick={() => onFilterByEmployee?.(r)}
                          title={onFilterByEmployee ? 'Показать визиты сотрудника' : undefined}
                        >
                          <td className={s.nameCell}>{r.full_name || `${r.lastname ?? ''} ${r.firstname ?? ''}`.trim() || '—'}</td>
                          <td>
                            <span className={s.typeBadge} style={{ '--c': clr }}>
                              {r.type_absence_name ?? '—'}
                            </span>
                          </td>
                          <td className={s.mono}>{fmtDate(r.startdate)}</td>
                          <td className={s.mono}>{fmtDate(r.enddate)}</td>
                          <td className={s.mono}>{daysBetween(r.startdate, r.enddate) ?? '—'}</td>
                          {cols.includes('branch_name') && (
                            <td className={s.dim} title={r.branch_name ?? ''}>
                              {(r.branch_name ?? '').length > 40 ? (r.branch_name ?? '').slice(0, 40) + '…' : (r.branch_name ?? '—')}
                            </td>
                          )}
                          {cols.includes('event_type_name') && (
                            <td className={s.dim}>{r.event_type_name ?? '—'}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className={s.pagination} onClick={e => e.stopPropagation()}>
                  <button className={s.pgBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
                  {pageNumbers(safePage, totalPages).map((n, i) =>
                    n === '…'
                      ? <span key={`dot-${i}`} className={s.pgDots}>…</span>
                      : <button key={n} className={`${s.pgBtn} ${n === safePage ? s.pgActive : ''}`} onClick={() => setPage(n)}>{n}</button>
                  )}
                  <button className={s.pgBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
                  <span className={s.pgInfo}>
                    {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} из {filtered.length}
                  </span>
                </div>
              )}
            </>
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

const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="14" height="14" rx="2"/>
    <path d="M3 8h14M7 2v4M13 2v4"/>
  </svg>
)
const ChevronIcon = ({ open }) => (
  <svg
    width="14" height="14" viewBox="0 0 14 14" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
  >
    <path d="M3 5l4 4 4-4"/>
  </svg>
)
