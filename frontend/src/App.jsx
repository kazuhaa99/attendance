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
import { useStaff } from './hooks/useStaffCount'
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
    const isVisible = sections[key]
    if (isVisible) {
      scrollTo(`section-${key}`)
    } else {
      setSections(prev => ({ ...prev, [key]: true }))
      setTimeout(() => scrollTo(`section-${key}`), 50)
    }
  }, [sections, scrollTo])

  const handleSectionToggle = useCallback((key) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }))
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
  const staff = useStaff()

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

  // Client-side zone/terminal/direction filtering (API returns all data)
  const baseFilteredRows = useMemo(() => {
    let rows = data?.rows ?? []
    if (filters.zone)      rows = rows.filter(r => r.zone === filters.zone)
    if (filters.terminal)  rows = rows.filter(r => r.terminal === filters.terminal)
    if (filters.direction === 'in')  rows = rows.filter(r => r.is_out === false)
    if (filters.direction === 'out') rows = rows.filter(r => r.is_out === true)
    return rows
  }, [data?.rows, filters.zone, filters.terminal, filters.direction])

  const nameFilteredRows = useMemo(() => {
    let rows = baseFilteredRows
    if (debouncedName.trim()) {
      const norm = normalize(debouncedName.trim())
      rows = rows.filter(r => nameSearchMatch(normalize(r.name || ''), norm))
    }
    if (branchFilter) {
      rows = rows.filter(r => (groupMap[r.group] || '') === branchFilter)
    }
    return rows
  }, [baseFilteredRows, debouncedName, branchFilter, groupMap])

  // WorktimeStats and displayRows derived from nameFilteredRows
  const workStats = useMemo(() => computeWorkStats(nameFilteredRows), [nameFilteredRows])

  const displayRows = useMemo(() => {
    if (timeFilter) return workStats[timeFilter]?.rows ?? []
    return nameFilteredRows
  }, [timeFilter, workStats, nameFilteredRows])

  const absenceMaps = useMemo(() => buildAbsenceMap(absData?.rows ?? []), [absData?.rows])



  const staffKpi = useMemo(() => {
    const visitRows = nameFilteredRows
    const toFI = s => s.split(' ').slice(0, 2).join(' ')

    const visitedKeys = new Set(visitRows.map(r => r.iin || (r.name ? toFI(normalize(r.name)) : '')).filter(Boolean))

    // All absences active today — no ElPass filtering
    const todayAbs = (absData?.rows ?? []).filter(r => {
      const s = r.startdate?.slice(0, 10)
      const e = r.enddate?.slice(0, 10)
      if (!s || !e) return true
      return s <= dateTo && e >= dateFrom
    })
    const absentKeys = new Set(todayAbs.map(r => r.login || toFI(normalize(r.full_name || ''))).filter(Boolean))

    const total = staff.count || 0
    const expectedCount = Math.max(total - absentKeys.size, 0)

    return {
      total,
      expectedCount,
      visitedCount: visitedKeys.size,
      absentCount:  absentKeys.size,
      visitedPct:   expectedCount > 0 ? Math.round(visitedKeys.size / expectedCount * 100) : null,
    }
  }, [nameFilteredRows, absData?.rows, dateFrom, dateTo, staff.count])

  const personHours = useMemo(() => {
    if (!debouncedName.trim() || !nameFilteredRows.length) return null
    const { people } = computeHoursTable(nameFilteredRows, dateFrom, dateTo, absData)
    if (!people.length) return null
    const totalMin = people.reduce((s, p) => s + p.totalMin, 0)
    const firstIn  = people.flatMap(p => Object.values(p.days ?? {})).map(d => d?.firstIn).filter(Boolean).sort()[0] ?? null
    const lastOut  = people.flatMap(p => Object.values(p.days ?? {})).map(d => d?.lastOut).filter(Boolean).sort().at(-1) ?? null
    return { totalMin, firstIn, lastOut, people: people.length }
  }, [nameFilteredRows, dateFrom, dateTo, debouncedName, absData])

  const anomalyKeys = useMemo(() => {
    if (!absenceMaps.fullMap.size && !absenceMaps.lastnameMap.size && !absenceMaps.iinMap.size) return new Set()
    const keys = new Set()
    for (const r of data?.rows ?? []) {
      if (getAbsenceForVisit(absenceMaps, r.name, r.loged_at, r.iin)) {
        const norm = normalize(r.name || '')
        const fi = norm.split(' ').slice(0, 2).join(' ')
        keys.add(norm)
        if (fi) keys.add(fi)
        if (r.iin) keys.add(r.iin)
      }
    }
    return keys
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
    { key: 'absences', label: 'Отсутствия',        icon: <IconAbsence /> },
    { key: 'visits',   label: 'Лента активности',  icon: <IconActivity /> },
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
          settingsSlot={null}
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
            return (
              <div key={key} className={`${s.secGroup} ${isOn ? s.secGroupOn : s.secGroupOff}`}>
                <button
                  className={`${s.secBtn} ${isOn ? s.secBtnOn : s.secBtnOff}`}
                  onClick={() => handleSectionClick(key)}
                  title={isOn ? `Перейти к "${label}"` : `Показать "${label}"`}
                >
                  <span className={s.secIcon}>{icon}</span>
                  {label}
                </button>
                <button
                  className={`${s.secToggle} ${isOn ? s.secToggleOn : s.secToggleOff}`}
                  onClick={() => handleSectionToggle(key)}
                  title={isOn ? `Скрыть "${label}"` : `Показать "${label}"`}
                >
                  {isOn ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
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
          anomalyNames={anomalyKeys}
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

const EyeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 8s3-5.5 7-5.5S15 8 15 8s-3 5.5-7 5.5S1 8 1 8z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
)
const EyeOffIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.6 6.6a2 2 0 0 0 2.8 2.8M1 1l14 14M4.3 4.3C2.6 5.5 1 8 1 8s3 5.5 7 5.5c1.4 0 2.7-.5 3.7-1.3M13 10.7C14.3 9.5 15 8 15 8s-3-5.5-7-5.5c-.7 0-1.4.1-2 .3" />
  </svg>
)

const IconChart = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17V10M7.5 17V5M12 17V8M16.5 17V3" />
  </svg>
)
const IconHours = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="8" />
    <path d="M10 5v5l3 3" />
  </svg>
)
const IconAbsence = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="14" height="14" rx="2" />
    <path d="M3 8h14M7 2v4M13 2v4" />
  </svg>
)
const IconActivity = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 10 6 6 10 12 14 4 18 10" />
  </svg>
)
