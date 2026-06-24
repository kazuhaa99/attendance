import { fmtDate, fmtTime } from '../../utils/dateUtils'
import s from './KPIRow.module.css'

function fmt(n) {
  return n == null ? '—' : Number(n).toLocaleString('ru-RU')
}

function pct(n) {
  return n == null ? '—' : `${n}%`
}

function fmtMin(mins) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export default function KPIRow({ data, rows, loading, staffKpi, absLoading, personHours, globalName }) {
  const filtered = rows ?? []

  const uniqueCards = new Set(filtered.map(r => r.no).filter(Boolean)).size
  const inCount     = filtered.filter(r => r.is_out === false).length
  const outCount    = filtered.filter(r => r.is_out === true).length
  const zoneSet     = new Set(filtered.map(r => r.zone).filter(v => v && v !== '—'))
  const zoneCount   = zoneSet.size
  const terminalCount = new Set(filtered.map(r => `${r.zone}::${r.terminal}`).filter(v => !v.includes('—'))).size

  const total    = globalName ? filtered.length : (data?.total ?? null)
  const totalSub = globalName
    ? 'по фильтру'
    : (data && data.loaded < data.total)
      ? `показано ${fmt(data.loaded)} из ${fmt(data.total)}`
      : 'за период'

  const staffLoading = loading || absLoading
  const isFiltered   = !!globalName?.trim()

  return (
    <div className={`${s.row} ${loading ? s.loading : ''} ${isFiltered ? s.filtered : ''}`}>
      <KPI label="Всего визитов"   value={fmt(total)}        sub={totalSub} />
      <KPI label="Уникальных карт" value={fmt(uniqueCards)}  sub={isFiltered ? 'карт у сотрудника' : 'посетителей'} />
      <KPI label="Входов"          value={fmt(inCount)}      sub="isOut = false" color="var(--green)" />
      <KPI label="Выходов"         value={fmt(outCount)}     sub="isOut = true"  color="var(--red)" />
      <KPI label="Устройств"       value={fmt(terminalCount)} sub={`${zoneCount} ${zoneCount === 1 ? 'зона' : zoneCount < 5 ? 'зоны' : 'зон'}`} />

      {isFiltered && personHours ? (
        <>
          <KPI
            label="Часов отработано"
            value={fmtMin(personHours.totalMin)}
            sub={`за ${dateRangeLabel(personHours)}`}
            color="#3b82f6"
          />
          <KPI
            label="Первый вход"
            value={fmtTime(personHours.firstIn)}
            sub={fmtDate(personHours.firstIn)}
            color="var(--green)"
          />
          <KPI
            label="Последний выход"
            value={fmtTime(personHours.lastOut)}
            sub={fmtDate(personHours.lastOut)}
            color="var(--red)"
          />
        </>
      ) : (
        <>
          <KPI
            label="Должны прийти"
            value={staffLoading ? '…' : fmt(staffKpi?.expectedCount)}
            sub={staffLoading ? '' : `всего пропусков: ${fmt(staffKpi?.total)}`}
            loading={staffLoading}
          />
          <KPI
            label="Пришло"
            value={staffLoading ? '…' : fmt(staffKpi?.visitedCount)}
            sub={staffLoading ? '' : `${pct(staffKpi?.visitedPct)} от ожидаемых`}
            color="var(--green)"
            loading={staffLoading}
          />
          <KPI
            label="Отсутствуют"
            value={staffLoading ? '…' : fmt(staffKpi?.absentCount)}
            sub="отпуск / больничный"
            color="var(--red)"
            loading={staffLoading}
          />
        </>
      )}
    </div>
  )
}

function dateRangeLabel(h) {
  if (!h?.firstIn) return 'период'
  const d1 = h.firstIn.slice(0, 10)
  const d2 = h.lastOut?.slice(0, 10) ?? d1
  if (d1 === d2) return d1.slice(5).replace('-', '.')
  return `${d1.slice(5).replace('-', '.')}–${d2.slice(5).replace('-', '.')}`
}

function KPI({ label, value, sub, color, loading }) {
  return (
    <div className={s.card}>
      <div className={s.label}>{label}</div>
      <div className={s.value} style={color ? { color } : undefined}>{value}</div>
      <div className={s.sub}>{loading ? '' : sub}</div>
    </div>
  )
}
