import s from './FilterBar.module.css'

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
)

const ClearIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M3 3l6 6M9 3l-6 6" />
  </svg>
)

export default function FilterBar({ filters, onChange, zones, terminals, branches = [], branchFilter = '', onBranchChange, globalName, onGlobalNameChange, onResetAll }) {
  const activeCount = [globalName, filters.zone, filters.terminal, filters.direction, filters.noName, branchFilter].filter(Boolean).length

  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  function toggleDir(val) {
    set('direction', filters.direction === val ? '' : val)
  }

  return (
    <div className={s.bar}>
      {/* Глобальный поиск по сотруднику */}
      <div className={`${s.field} ${s.globalField}`}>
        <span className={s.icon}><SearchIcon /></span>
        <input
          className={`${s.input} ${s.globalInput}`}
          type="text"
          placeholder="Поиск по сотруднику (визиты, отсутствия, часы)"
          value={globalName}
          onChange={e => onGlobalNameChange(e.target.value)}
          disabled={filters.noName}
        />
        {globalName && (
          <button className={s.clearBtn} onClick={() => onGlobalNameChange('')} tabIndex={-1}>
            <ClearIcon />
          </button>
        )}
      </div>

      {/* Без имени */}
      <label className={`${s.toggle} ${filters.noName ? s.toggleOn : ''}`}>
        <input
          type="checkbox"
          checked={!!filters.noName}
          onChange={e => set('noName', e.target.checked)}
        />
        <span className={s.thumb} />
        Без имени
      </label>

      {/* Зона */}
      <div className={s.field}>
        <select
          className={s.select}
          value={filters.zone}
          onChange={e => set('zone', e.target.value)}
        >
          <option value="">Все зоны</option>
          {zones.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
      </div>

      {/* Терминал */}
      <div className={s.field}>
        <select
          className={s.select}
          value={filters.terminal}
          onChange={e => set('terminal', e.target.value)}
        >
          <option value="">Все терминалы</option>
          {terminals.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Подразделение */}
      {branches.length > 0 && (
        <div className={s.field}>
          <select
            className={s.select}
            value={branchFilter}
            onChange={e => onBranchChange?.(e.target.value)}
          >
            <option value="">Все подразделения</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      {/* Направление */}
      <div className={s.segmented}>
        <button
          className={`${s.segBtn} ${filters.direction === '' ? s.segActive : ''}`}
          onClick={() => set('direction', '')}
        >
          Все
        </button>
        <button
          className={`${s.segBtn} ${filters.direction === 'in' ? s.segActiveIn : ''}`}
          onClick={() => toggleDir('in')}
        >
          ↑ Вход
        </button>
        <button
          className={`${s.segBtn} ${filters.direction === 'out' ? s.segActiveOut : ''}`}
          onClick={() => toggleDir('out')}
        >
          ↓ Выход
        </button>
      </div>

      {/* Сброс */}
      {activeCount > 0 && (
        <button className={s.resetAll} onClick={onResetAll}>
          <span className={s.activeCount}>{activeCount}</span>
          Сбросить
        </button>
      )}
    </div>
  )
}
