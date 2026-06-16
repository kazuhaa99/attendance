import { useState, useEffect, useRef } from 'react'
import s from './ThemePicker.module.css'

export const THEMES = [
  { id: 'midnight', label: 'Midnight',      bg: '#0e0e10', surface: '#18181b', accent: '#6366f1' },
  { id: 'dark',     label: 'Dark',          bg: '#0a0a0a', surface: '#141414', accent: '#818cf8' },
  { id: 'dim',      label: 'Dim',           bg: '#22272e', surface: '#2d333b', accent: '#539bf5' },
  { id: 'ocean',    label: 'Ocean',         bg: '#0d1117', surface: '#161b22', accent: '#58a6ff' },
  { id: 'aurora',   label: 'Aurora',        bg: '#12111a', surface: '#1c1929', accent: '#a78bfa' },
  { id: 'flaws',    label: '0.1 flaws',     bg: '#f2f3f5', surface: '#fafafa', accent: '#7a8898' },
  { id: 'wave',     label: 'Wave to Earth', bg: '#14100b', surface: '#1e1710', accent: '#c8966a' },
  { id: 'light',    label: 'Light',         bg: '#f4f4f5', surface: '#ffffff', accent: '#6366f1' },
]

export function getStoredTheme() {
  return localStorage.getItem('theme') || 'midnight'
}

export default function ThemePicker() {
  const [current, setCurrent] = useState(getStoredTheme)
  const [open, setOpen]       = useState(false)
  const ref = useRef(null)

  // apply on mount (in case script in index.html didn't fire yet)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', current)
  }, [current])

  // close on outside click
  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function pick(id) {
    setCurrent(id)
    localStorage.setItem('theme', id)
    setOpen(false)
  }

  const active = THEMES.find(t => t.id === current) ?? THEMES[0]

  return (
    <div className={s.wrap} ref={ref}>
      <button
        className={`${s.trigger} ${open ? s.triggerOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Сменить тему"
      >
        <Swatch t={active} />
        <span className={s.triggerLabel}>{active.label}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className={s.dropdown}>
          <div className={s.dropTitle}>Тема</div>
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`${s.item} ${t.id === current ? s.itemActive : ''}`}
              onClick={() => pick(t.id)}
            >
              <Swatch t={t} />
              <span>{t.label}</span>
              {t.id === current && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Swatch({ t }) {
  return (
    <span className={s.swatch}>
      <span style={{ background: t.bg }} />
      <span style={{ background: t.surface }} />
      <span style={{ background: t.accent }} />
    </span>
  )
}

const ChevronIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M2 3.5L5 6.5L8 3.5" />
  </svg>
)

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6l3 3 5-5" />
  </svg>
)
