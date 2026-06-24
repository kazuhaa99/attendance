import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
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
import { useGroups } from './hooks/useGroups'
import { useStaffCount } from './hooks/useStaffCount'
import { useDebounce } from './hooks/useDebounce'
import { computeWorkStats } from './utils/workStats'
import { computeHoursTable } from './utils/hoursUtils'
import { buildAbsenceMap, getAbsenceForVisit, normalize, nameSearchMatch } from './utils/absenceUtils'
import s from './App.module.css'

function defaultDates() {
  const today = new Date().toISOString().slice(0, 10)
  return { from: today, to: today }
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

  const [sectionMode, setSectionMode] = useState(() => localStorage.getItem('sectionMode') || 'navigate')
  const [sections, setSections] = useState({ charts: true, hours: true, absences: true, visits: true })

  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id)
    if (!el) return
    const header = document.querySelector('[class*="stickyTop"]')
    const offset = header ? header.offsetHeight + 12 : 0
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }, [])

  const handleSectionClick = useCallback((key) => {
    if (sectionMode === 'navigate') {
      scrollTo(`section-${key}`)
    } else {
      setSections(prev => ({ ...prev, [key]: !prev[key] }))
    }
  }, [sectionMode, scrollTo])

  const saveSectionMode = useCallback((mode) => {
    setSectionMode(mode)
    localStorage.setItem('sectionMode', mode)
    if (mode === 'navigate') setSections({ charts: true, hours: true, absences: true, visits: true })
  }, [])

  const debouncedName = useDebounce(globalName, 350)

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
  const groupMap = useGroups()
  const staffCount = useStaffCount()

  const { zones, terminals } = useMemo(() => {
    const rows = data?.rows ?? []
    return {
      zones:     [...new Set(rows.map(r => r.zone).filter(v => v && v !== '—'))].sort(),
      terminals: [...new Set(rows.map(r => r.terminal).filter(v => v && v !== '—'))].sort(),
    }
  }, [data?.rows])

  const branches = useMemo(() => {
    const names = new Set()
    for (const r of data?.rows ?? []) {
      const name = groupMap[r.group]
      if (name) names.add(name)
    }
    return [...names].sort()
  }, [data?.rows, groupMap])

  const nameFilteredRows = useMemo(() => {
    let rows = data?.rows ?? []
    if (debouncedName.trim()) {
      const norm = normalize(debouncedName.trim())
      rows = rows.filter(r => nameSearchMatch(normalize(r.name || ''), norm))
    }
    if (branchFilter) {
      rows = rows.filter(r => (groupMap[r.group] || '') === branchFilter)
    }
    return rows
  }, [data?.rows, debouncedName, branchFilter, groupMap])

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
    if (debouncedName.trim())
      absRows = absRows.filter(r => nameSearchMatch(normalize(r.full_name || r.lastname || ''), normalize(debouncedName.trim())))
    if (branchFilter) {
      // Filter absences by IIN/name of people seen in the selected group
      const groupIins  = new Set(visitRows.map(r => r.iin).filter(Boolean))
      const groupNames = new Set(visitRows.map(r => normalize(r.name || '').split(' ').slice(0, 2).join(' ')).filter(Boolean))
      absRows = absRows.filter(r =>
        (r.login && groupIins.has(r.login)) ||
        groupNames.has(normalize(r.full_name || r.lastname || '').split(' ').slice(0, 2).join(' '))
      )
    }

    // Use IIN as primary key, fall back to normalized FI name
    const toFI = s => s.split(' ').slice(0, 2).join(' ')
    const visitedKeys = new Set(visitRows.map(r => r.iin || (r.name ? toFI(normalize(r.name)) : '')).filter(Boolean))
    const absentKeys  = new Set(absRows.map(r => r.login || toFI(r._norm_full || normalize(r.full_name || ''))).filter(Boolean))
    const hasFilter = !!(filters.zone || filters.terminal || debouncedName.trim() || branchFilter)
    const total = (!hasFilter && staffCount) ? staffCount : new Set([...visitedKeys, ...absentKeys]).size
    const expectedCount = Math.max(total - absentKeys.size, 0)

    return {
      total,
      expectedCount,
      visitedCount: visitedKeys.size,
      absentCount:  absentKeys.size,
      visitedPct:   expectedCount > 0 ? Math.round(visitedKeys.size / expectedCount * 100) : null,
    }
  }, [nameFilteredRows, absData?.rows, dateFrom, dateTo, debouncedName, branchFilter, staffCount, filters.zone, filters.terminal])

  const personHours = useMemo(() => {
    if (!debouncedName.trim() || !nameFilteredRows.length) return null
    const { people } = computeHoursTable(nameFilteredRows, dateFrom, dateTo, absData)
    if (!people.length) return null
    const totalMin = people.reduce((s, p) => s + p.totalMin, 0)
    const firstIn  = people.flatMap(p => Object.values(p.days ?? {})).map(d => d?.firstIn).filter(Boolean).sort()[0] ?? null
    const lastOut  = people.flatMap(p => Object.values(p.days ?? {})).map(d => d?.lastOut).filter(Boolean).sort().at(-1) ?? null
    return { totalMin, firstIn, lastOut, people: people.length }
  }, [nameFilteredRows, dateFrom, dateTo, debouncedName, absData])

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

  const SECTION_META = [
    { key: 'charts',   label: 'Графики',          icon: <IconChart /> },
    { key: 'hours',    label: 'Часы работы',       icon: <IconHours /> },
    { key: 'absences', label: 'Отсутствия',        icon: <IconList /> },
    { key: 'visits',   label: 'Лента активности',  icon: <IconClock /> },
  ]

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
          settingsSlot={
            <SettingsMenu mode={sectionMode} onModeChange={saveSectionMode} />
          }
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

        <div className={s.sectionBar}>
          {SECTION_META.map(({ key, label, icon }) => {
            const isOn = sections[key]
            const cls = sectionMode === 'toggle'
              ? `${s.secBtn} ${isOn ? s.secBtnOn : s.secBtnOff}`
              : `${s.secBtn} ${s.secBtnOn}`
            return (
              <button key={key} className={cls} onClick={() => handleSectionClick(key)} title={label}>
                <span className={s.secIcon}>{icon}</span>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {data?.unavailable && (
        <div className={s.warningBanner}>
          ⚠ Сервер пропускной системы временно недоступен. Отсутствия и часы работы отображаются в обычном режиме.
        </div>
      )}
      {error && <div className={s.errorBanner}>Ошибка: {error}</div>}

      <div id="section-charts">
      <KPIRow
        data={data}
        rows={nameFilteredRows}
        loading={loading}
        staffKpi={staffKpi}
        absLoading={absLoading}
        personHours={personHours}
        globalName={globalName}
      />
      </div>

      <div className={sections.charts ? '' : s.sectionHidden}>
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
      </div>

      <WorktimeStats
        stats={workStats}
        active={timeFilter}
        onFilter={key => {
          setTimeFilter(key)
          if (key) setFilters(f => ({ ...f, direction: '' }))
        }}
      />

      <div id="section-hours" className={sections.hours ? '' : s.sectionHidden}>
        <HoursPanel
          rows={nameFilteredRows}
          dateFrom={dateFrom}
          dateTo={dateTo}
          absenceData={absData}
          globalName={globalName}
          onFilterByEmployee={name => {
            setGlobalName(name)
            setTimeFilter('')
            setTimeout(() => {
              document.getElementById('visits-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 100)
          }}
        />
      </div>

      <div id="section-absences" className={sections.absences ? '' : s.sectionHidden}>
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
      </div>

      <div id="section-visits" className={sections.visits ? '' : s.sectionHidden}>
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
          if (patch.branch != null) {
            setBranchFilter(patch.branch)
          }
        }}
        absenceData={absData}
        globalName={globalName}
        groupMap={groupMap}
        branchFilter={branchFilter}
      />
      </div>

      <ScrollToTop />
      <MusicPlayer />
    </>
  )
}

function SettingsMenu({ mode, onModeChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={s.settingsWrap} ref={ref}>
      <button
        className={`${s.settingsBtn} ${open ? s.settingsBtnOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Настройки панелей"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" />
        </svg>
      </button>
      {open && (
        <div className={s.settingsDropdown}>
          <div className={s.settingsTitle}>Кнопки разделов</div>
          <button className={s.settingsOption} onClick={() => { onModeChange('navigate'); setOpen(false) }}>
            <span className={`${s.settingsCheck} ${mode === 'navigate' ? s.settingsCheckOn : ''}`}>
              {mode === 'navigate' && <CheckMark />}
            </span>
            Перейти к разделу
          </button>
          <button className={s.settingsOption} onClick={() => { onModeChange('toggle'); setOpen(false) }}>
            <span className={`${s.settingsCheck} ${mode === 'toggle' ? s.settingsCheckOn : ''}`}>
              {mode === 'toggle' && <CheckMark />}
            </span>
            Скрыть / показать
          </button>
        </div>
      )}
    </div>
  )
}

const CheckMark = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 5l2.5 2.5L8 3" />
  </svg>
)

const IconChart = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M2 14V8M6 14V4M10 14V6M14 14V2" />
  </svg>
)
const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 4v4l2.5 2.5" />
  </svg>
)
const IconHours = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
    <path d="M5 1.5v3M11 1.5v3M1.5 7h13" />
  </svg>
)
const IconList = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M5 3h9M5 8h9M5 13h7M2 3h.01M2 8h.01M2 13h.01" />
  </svg>
)
