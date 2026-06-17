import { useState, useMemo } from 'react'
import Header from './components/Header/Header'
import FilterBar from './components/FilterBar/FilterBar'
import KPIRow from './components/KPIRow/KPIRow'
import TimelineChart from './components/Charts/TimelineChart'
import DirectionChart from './components/Charts/DirectionChart'
import WorktimeStats from './components/WorktimeStats/WorktimeStats'
import AbsencePanel from './components/AbsencePanel/AbsencePanel'
import HoursPanel from './components/HoursPanel/HoursPanel'
import VisitsTable from './components/VisitsTable/VisitsTable'
import ScrollToTop from './components/ScrollToTop/ScrollToTop'
import MusicPlayer from './components/MusicPlayer/MusicPlayer'
import { useVisits } from './hooks/useVisits'
import { useAbsences } from './hooks/useAbsences'
import { computeWorkStats } from './utils/workStats'
import { computeHoursTable } from './utils/hoursUtils'
import { buildAbsenceMap, getAbsenceForVisit, normalize, nameSearchMatch } from './utils/absenceUtils'
import s from './App.module.css'

function defaultDates() {
  const fmt = d => d.toISOString().slice(0, 10)
  return { from: '2026-06-10', to: fmt(new Date()) }
}

const EMPTY_FILTERS = { zone: '', terminal: '', direction: '', noName: false }

export default function App() {
  const init = defaultDates()
  const [dateFrom,   setDateFrom]   = useState(init.from)
  const [dateTo,     setDateTo]     = useState(init.to)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filters,    setFilters]    = useState(EMPTY_FILTERS)
  const [timeFilter,    setTimeFilter]    = useState('')
  const [globalName,    setGlobalName]    = useState('')
  const [branchFilter,  setBranchFilter]  = useState('')

  const activeFilters = useMemo(
    () => ({
      zone:      filters.zone,
      terminal:  filters.terminal,
      direction: filters.direction,
      noName:    filters.noName,
    }),
    [filters.zone, filters.terminal, filters.direction, filters.noName]
  )

  const { data, loading, error }                                   = useVisits(dateFrom, dateTo, activeFilters, refreshKey)
  const { data: absData, loading: absLoading, error: absError }    = useAbsences(dateFrom, dateTo, refreshKey)

  const { zones, terminals } = useMemo(() => {
    const rows = data?.rows ?? []
    return {
      zones:     [...new Set(rows.map(r => r.zone).filter(v => v && v !== '—'))].sort(),
      terminals: [...new Set(rows.map(r => r.terminal).filter(v => v && v !== '—'))].sort(),
    }
  }, [data?.rows])

  const branches = useMemo(
    () => [...new Set((absData?.rows ?? []).map(r => r.branch_name).filter(Boolean))].sort(),
    [absData?.rows]
  )

  // IIN + name sets for selected branch (IIN is primary key, name is fallback)
  const branchMatch = useMemo(() => {
    if (!branchFilter) return null
    const iins  = new Set()
    const names = new Set()
    for (const r of absData?.rows ?? []) {
      if (r.branch_name !== branchFilter) continue
      if (r.login) iins.add(r.login)
      const fi = normalize(r.full_name || '').split(' ').slice(0, 2).join(' ')
      if (fi) names.add(fi)
    }
    return { iins, names }
  }, [absData?.rows, branchFilter])

  // Rows filtered by name + branch — foundation for all stats/KPIs
  const nameFilteredRows = useMemo(() => {
    let rows = data?.rows ?? []
    if (globalName.trim()) {
      const norm = normalize(globalName.trim())
      rows = rows.filter(r => nameSearchMatch(normalize(r.name || ''), norm))
    }
    if (branchMatch) {
      const { iins, names } = branchMatch
      rows = rows.filter(r => {
        if (r.iin) return iins.has(r.iin)
        const fi = normalize(r.name || '').split(' ').slice(0, 2).join(' ')
        return names.has(fi)
      })
    }
    return rows
  }, [data?.rows, globalName, branchMatch])

  // WorktimeStats and displayRows derived from nameFilteredRows
  const workStats = useMemo(() => computeWorkStats(nameFilteredRows), [nameFilteredRows])

  const displayRows = useMemo(() => {
    if (timeFilter) return workStats[timeFilter]?.rows ?? []
    return nameFilteredRows
  }, [timeFilter, workStats, nameFilteredRows])

  const absenceMaps = useMemo(() => buildAbsenceMap(absData?.rows ?? []), [absData?.rows])

  // StaffKpi — when name filter active, scope to that person
  const staffKpi = useMemo(() => {
    const visitRows = nameFilteredRows
    const allAbsRows = (absData?.rows ?? []).filter(r => {
      const s = r.startdate?.slice(0, 10)
      const e = r.enddate?.slice(0, 10)
      if (!s || !e) return true
      return s <= dateTo && e >= dateFrom
    })
    let absRows = allAbsRows
    if (globalName.trim())
      absRows = absRows.filter(r => nameSearchMatch(normalize(r.full_name || r.lastname || ''), normalize(globalName.trim())))
    if (branchFilter)
      absRows = absRows.filter(r => r.branch_name === branchFilter)

    // Use IIN as primary key, fall back to normalized FI name
    const toFI = s => s.split(' ').slice(0, 2).join(' ')
    const visitedKeys = new Set(visitRows.map(r => r.iin || (r.name ? toFI(normalize(r.name)) : '')).filter(Boolean))
    const absentKeys  = new Set(absRows.map(r => r.login || toFI(r._norm_full || normalize(r.full_name || ''))).filter(Boolean))
    const total = new Set([...visitedKeys, ...absentKeys]).size
    const visitedNames = visitedKeys
    const absentNames  = absentKeys

    return {
      total,
      visitedCount: visitedNames.size,
      absentCount:  absentNames.size,
      visitedPct:   total ? Math.round(visitedNames.size / total * 100) : null,
      absentPct:    total ? Math.round(absentNames.size  / total * 100) : null,
    }
  }, [nameFilteredRows, absData?.rows, dateFrom, dateTo, globalName, branchFilter])

  // Person hours — only when name filter is active
  const personHours = useMemo(() => {
    if (!globalName.trim() || !nameFilteredRows.length) return null
    const { people } = computeHoursTable(nameFilteredRows, dateFrom, dateTo)
    if (!people.length) return null
    const totalMin = people.reduce((s, p) => s + p.totalMin, 0)
    const firstIn  = people.flatMap(p => Object.values(p.days ?? {})).map(d => d?.firstIn).filter(Boolean).sort()[0] ?? null
    const lastOut  = people.flatMap(p => Object.values(p.days ?? {})).map(d => d?.lastOut).filter(Boolean).sort().at(-1) ?? null
    return { totalMin, firstIn, lastOut, people: people.length }
  }, [nameFilteredRows, dateFrom, dateTo, globalName])

  const anomalyNames = useMemo(() => {
    if (!absenceMaps.fullMap.size && !absenceMaps.lastnameMap.size) return new Set()
    const names = new Set()
    for (const r of data?.rows ?? []) {
      if (getAbsenceForVisit(absenceMaps, r.name, r.loged_at, r.iin)) names.add(normalize(r.name || ''))
    }
    return names
  }, [absenceMaps, data?.rows])

  function handleResetAll() {
    setFilters(EMPTY_FILTERS)
    setGlobalName('')
    setTimeFilter('')
    setBranchFilter('')
  }

  return (
    <>
      <div className={s.stickyTop}>
        <Header
          dateFrom={dateFrom}
          dateTo={dateTo}
          lastUpdated={data?.fetchedAt}
          loading={loading}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onRefresh={() => setRefreshKey(k => k + 1)}
        />

        <FilterBar
          filters={filters}
          onChange={setFilters}
          zones={zones}
          terminals={terminals}
          branches={branches}
          branchFilter={branchFilter}
          onBranchChange={setBranchFilter}
          globalName={globalName}
          onGlobalNameChange={setGlobalName}
          onResetAll={handleResetAll}
        />
      </div>

      {data?.unavailable && (
        <div className={s.warningBanner}>
          ⚠ Сервер пропускной системы временно недоступен. Отсутствия и часы работы отображаются в обычном режиме.
        </div>
      )}
      {error && <div className={s.errorBanner}>Ошибка: {error}</div>}

      <KPIRow
        data={data}
        rows={nameFilteredRows}
        loading={loading}
        staffKpi={staffKpi}
        absLoading={absLoading}
        personHours={personHours}
        globalName={globalName}
      />

      <div className={`${s.chartsRow} ${loading ? s.loading : ''}`}>
        <TimelineChart
          rows={nameFilteredRows}
          dateFrom={dateFrom}
          dateTo={dateTo}
          globalName={globalName}
          onDateFilter={date => {
            if (date) { setDateFrom(date); setDateTo(date) }
            else { const d = defaultDates(); setDateFrom(d.from); setDateTo(d.to) }
          }}
        />
        <DirectionChart
          rows={nameFilteredRows}
          activeDirection={filters.direction}
          onFilter={patch => setFilters(f => ({ ...f, ...patch }))}
        />
      </div>

      <WorktimeStats
        stats={workStats}
        active={timeFilter}
        onFilter={key => {
          setTimeFilter(key)
          if (key) setFilters(f => ({ ...f, direction: '' }))
        }}
      />

      <HoursPanel
        rows={nameFilteredRows}
        dateFrom={dateFrom}
        dateTo={dateTo}
        globalName={globalName}
        onFilterByEmployee={name => {
          setGlobalName(name)
          setTimeFilter('')
          setTimeout(() => {
            document.getElementById('visits-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
        }}
      />

      <AbsencePanel
        data={absData}
        loading={absLoading}
        error={absError}
        anomalyNames={anomalyNames}
        dateFrom={dateFrom}
        dateTo={dateTo}
        globalName={globalName}
        branchFilter={branchFilter}
        onFilterByEmployee={row => {
          const full = row.full_name || row.lastname || ''
          const fi = full.trim().split(/\s+/).slice(0, 2).join(' ')
          setGlobalName(fi)
          setTimeFilter('')
          setTimeout(() => {
            document.getElementById('visits-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
        }}
      />

      <VisitsTable
        rows={displayRows}
        loading={loading}
        onFilter={patch => {
          setTimeFilter('')
          if (patch.direction || patch.zone || patch.terminal) {
            setFilters(f => ({ ...f, ...patch }))
          }
          if (patch.name != null) {
            setGlobalName(patch.name)
            if (patch.name) {
              setTimeout(() => {
                document.getElementById('absence-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 100)
            }
          }
        }}
        absenceData={absData}
        globalName={globalName}
      />

      <ScrollToTop />
      <MusicPlayer />
    </>
  )
}
