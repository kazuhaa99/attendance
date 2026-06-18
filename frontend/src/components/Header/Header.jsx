import s from './Header.module.css'
import ThemePicker from '../ThemePicker/ThemePicker'

export default function Header({ dateFrom, dateTo, lastUpdated, loading, onDateFromChange, onDateToChange, onRefresh, settingsSlot }) {
  const timeStr = lastUpdated
    ? 'обновлено в ' + lastUpdated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <header className={s.header}>
      <div className={s.left}>
        <div className={s.logoMark}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* door */}
            <rect x="1" y="1" width="11" height="18" rx="1.5" stroke="white" strokeWidth="2" />
            <circle cx="10" cy="10" r="1.2" fill="white" />
            {/* person: head */}
            <circle cx="16" cy="5" r="2.2" fill="white" />
            {/* person: body + legs */}
            <path d="M16 7.5 L16 13 M16 13 L13.5 18 M16 13 L18.5 18" stroke="white" strokeWidth="2" />
            {/* person: arms reaching toward door */}
            <path d="M16 9.5 L13 11" stroke="white" strokeWidth="2" />
            <path d="M16 9.5 L19 11" stroke="white" strokeWidth="2" />
          </svg>
        </div>
        <h1 className={s.title}>Attendance</h1>
        <div className={s.dot} />
        <span className={s.lastUpdated}>{timeStr}</span>
      </div>

      <div className={s.right}>
        <div className={s.dateRange}>
          <input
            type="date"
            className={s.dateInput}
            value={dateFrom}
            onChange={e => onDateFromChange(e.target.value)}
          />
          <span className={s.sep}>—</span>
          <input
            type="date"
            className={s.dateInput}
            value={dateTo}
            onChange={e => onDateToChange(e.target.value)}
          />
        </div>

        <ThemePicker />
        {settingsSlot}

        <button className={s.btn} onClick={onRefresh} disabled={loading}>
          <svg
            className={`${s.btnIcon} ${loading ? s.spinning : ''}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1.5 8A6.5 6.5 0 1 0 8 1.5" />
            <path d="M1.5 4v4h4" />
          </svg>
          Обновить
        </button>
      </div>
    </header>
  )
}
