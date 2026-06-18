import { useMemo, useState } from 'react'
import {
  buildAbsenceMap, getAbsenceForVisit, COLOR_LABELS, normalize,
} from '../../utils/absenceUtils'
import { fmtDateTime, fmtDate } from '../../utils/dateUtils'
import s from './VisitsTable.module.css'

function getBranch(r, groupMap) {
  if (!groupMap) return '—'
  return groupMap[r.group] || '—'
}

function fmt(n) {
  return Number(n).toLocaleString('ru-RU')
}

function DirBadge({ isOut, onClick }) {
  if (isOut === false) return (
    <span className={`${s.badge} ${s.badgeIn} ${s.clickable}`} onClick={onClick} title="Фильтровать: Вход">
      ↑ Вход
    </span>
  )
  if (isOut === true) return (
    <span className={`${s.badge} ${s.badgeOut} ${s.clickable}`} onClick={onClick} title="Фильтровать: Выход">
      ↓ Выход
    </span>
  )
  return <span className={`${s.badge} ${s.badgeNeu}`}>—</span>
}

function AbsenceBadge({ info }) {
  if (!info) return null
  const clr = COLOR_LABELS[info.colorKey]?.color ?? 'var(--muted)'
  const entry = COLOR_LABELS[info.colorKey]
  const status = entry?.status || entry?.label || '?'
  const title  = `${info.type_absence_name || status}: ${fmtDate(info.startdate)} — ${fmtDate(info.enddate)}`
  return (
    <span className={s.absenceBadge} style={{ '--ac': clr }} title={title}>
      ⚠ {status}
    </span>
  )
}

function exportCSV(rows, lookup) {
  const header = ['Дата и время', 'Имя', 'Подразделение', 'Карта №', 'Направление', 'Терминал', 'Зона', 'Хост']
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map(r => [
    r.loged_at?.slice(0, 19).replace('T', ' ') ?? '',
    r.name,
    getBranch(r, lookup),
    r.no,
    r.is_out === false ? 'Вход' : r.is_out === true ? 'Выход' : '',
    r.terminal,
    r.zone,
    r.host,
  ].map(escape).join(','))

  const csv = '﻿' + [header.join(','), ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
  </svg>
)

const PAGE_SIZE = 50

export default function VisitsTable({ rows, loading, onFilter, absenceData, globalName, groupMap, branchFilter }) {
  const [open, setOpen] = useState(true)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(() => rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [rows, safePage])

  useMemo(() => { setPage(1) }, [rows])

  const absenceMaps = useMemo(
    () => buildAbsenceMap(absenceData?.rows ?? []),
    [absenceData?.rows],
  )

  function click(key, value) {
    if (!onFilter || !value || value === '—') return
    onFilter({ [key]: value })
  }

  function clickBranch(branch) {
    if (!onFilter || !branch || branch === '—') return
    onFilter({ branch: branchFilter === branch ? '' : branch })
  }

  function clickDir(isOut) {
    if (!onFilter || isOut === null || isOut === undefined) return
    onFilter({ direction: isOut ? 'out' : 'in' })
  }

  return (
    <div id="visits-table" className={`${s.panel} ${loading ? s.loading : ''}`}>
      <div className={`${s.panelHeader} ${open ? s.panelHeaderOpen : ''}`} onClick={() => setOpen(o => !o)}>
        <div className={s.panelLeft}>
          <div className={s.iconBadge}><ActivityIcon /></div>
          <span className={s.panelTitle}>Лента активности</span>
          {globalName && (
            <span className={s.absenceFilterPill}>{globalName}</span>
          )}
          <span className={s.pill}>{fmt(rows.length)} записей</span>
        </div>
        <div className={s.panelActions} onClick={e => e.stopPropagation()}>
          <button className={s.exportBtn} onClick={() => exportCSV(rows, groupMap)} title="Выгрузить CSV">
            <DownloadIcon />
            CSV
          </button>
          <ChevronIcon open={open} />
        </div>
      </div>

      <div className={`${s.bodyWrap} ${open ? s.bodyWrapOpen : ''}`}>
        <div className={s.bodyInner}>
      <div className={s.scroll}>
        <table>
          <thead>
            <tr>
              <th>Дата и время</th>
              <th>Имя</th>
              <th className={branchFilter ? s.thActive : ''}>Подразделение</th>
              <th>Карта №</th>
              <th>Направление</th>
              <th>Терминал</th>
              <th>Зона</th>
              <th>Хост</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className={s.empty}>
                  {loading ? 'Загрузка данных...' : 'Нет данных за указанный период'}
                </td>
              </tr>
            ) : (
              pageRows.map((r, i) => {
                const absInfo = getAbsenceForVisit(absenceMaps, r.name, r.loged_at, r.iin)
                const branch  = getBranch(r, groupMap)
                return (
                  <tr key={i} className={absInfo ? s.anomalyRow : ''}>
                    <td className={s.mono}>{fmtDateTime(r.loged_at)}</td>
                    <td>
                      <div className={s.nameWrap}>
                        <span
                          className={r.name && r.name !== '—' ? s.clickable : ''}
                          onClick={() => click('name', r.name)}
                          title={r.name && r.name !== '—' ? `Фильтровать: ${r.name}` : undefined}
                        >
                          {r.name}
                        </span>
                        <AbsenceBadge info={absInfo} />
                      </div>
                    </td>
                    <td
                      className={branch !== '—' ? s.clickable : s.dim}
                      onClick={() => clickBranch(branch)}
                      title={branch !== '—' ? `Фильтровать: ${branch}` : undefined}
                    >
                      {branch}
                    </td>
                    <td className={s.mono}>{r.no}</td>
                    <td>
                      <DirBadge isOut={r.is_out} onClick={() => clickDir(r.is_out)} />
                    </td>
                    <td
                      className={`${s.mono} ${r.terminal && r.terminal !== '—' ? s.clickable : ''}`}
                      onClick={() => click('terminal', r.terminal)}
                      title={r.terminal && r.terminal !== '—' ? `Фильтровать: ${r.terminal}` : undefined}
                    >
                      {r.terminal}
                    </td>
                    <td
                      className={`${s.mono} ${r.zone && r.zone !== '—' ? s.clickable : ''}`}
                      onClick={() => click('zone', r.zone)}
                      title={r.zone && r.zone !== '—' ? `Фильтровать: ${r.zone}` : undefined}
                    >
                      {r.zone}
                    </td>
                    <td className={`${s.mono} ${s.dim}`}>{r.host}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

          {totalPages > 1 && (
            <div className={s.pagination}>
              <button className={s.pgBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
              {pageNumbers(safePage, totalPages).map((n, i) =>
                n === '…'
                  ? <span key={`d${i}`} className={s.pgDots}>…</span>
                  : <button key={n} className={`${s.pgBtn} ${n === safePage ? s.pgActive : ''}`} onClick={() => setPage(n)}>{n}</button>
              )}
              <button className={s.pgBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <span className={s.pgInfo}>{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} из {fmt(rows.length)}</span>
            </div>
          )}

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

const ActivityIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 10 6 6 10 12 14 4 18 10"/>
  </svg>
)

const ChevronIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
    <path d="M3 5l4 4 4-4"/>
  </svg>
)
