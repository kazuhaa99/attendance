import s from './WorktimeStats.module.css'

const KEYS = ['early_in', 'late_in', 'early_out', 'late_out']

export default function WorktimeStats({ stats, active, onFilter }) {
  return (
    <div className={s.row}>
      {KEYS.map(key => {
        const c = stats[key]
        const isActive = active === key
        return (
          <button
            key={key}
            className={`${s.card} ${s[c.color]} ${isActive ? s.active : ''}`}
            onClick={() => onFilter(isActive ? '' : key)}
            title={isActive ? 'Снять фильтр' : 'Показать только эти записи'}
          >
            <div className={s.top}>
              <span className={s.icon}>{c.icon}</span>
              {isActive && <span className={s.dot} />}
            </div>
            <div className={s.count}>{c.rows.length}</div>
            <div className={s.label}>{c.label}</div>
            <div className={s.sub}>{c.sub}</div>
          </button>
        )
      })}
    </div>
  )
}
