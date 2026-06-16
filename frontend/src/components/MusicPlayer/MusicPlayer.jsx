import { useEffect, useRef, useState } from 'react'
import s from './MusicPlayer.module.css'

const VIDEO_ID      = 'wcLJ2bjp2gw'
const DEFAULT_VOL   = 15

// Synced radio: all clients hear the same position based on Unix clock
function syncPos(duration) {
  return (Date.now() / 1000) % duration
}

export default function MusicPlayer() {
  const ytRef    = useRef(null)
  const divRef   = useRef(null)
  const [ready,   setReady]   = useState(false)
  const [playing, setPlaying] = useState(false)
  const [volume,  setVolume]  = useState(DEFAULT_VOL)
  const [showVol, setShowVol] = useState(false)
  const [ytError, setYtError] = useState(null)

  useEffect(() => {
    function initPlayer() {
      if (ytRef.current) return
      ytRef.current = new window.YT.Player(divRef.current, {
        width: '1', height: '1',
        videoId: VIDEO_ID,
        playerVars: { loop: 1, playlist: VIDEO_ID, controls: 0, disablekb: 1, rel: 0, iv_load_policy: 3 },
        events: {
          onReady(e) {
            e.target.setVolume(DEFAULT_VOL)
            setReady(true)
          },
          onStateChange(e) {
            setPlaying(e.data === window.YT.PlayerState.PLAYING)
          },
          onError(e) {
            // 101/150 = embedding disabled; 100 = video not found
            const msg = (e.data === 101 || e.data === 150)
              ? 'Видео запрещает встраивание'
              : `Ошибка плеера (${e.data})`
            setYtError(msg)
          },
        },
      })
    }

    if (window.YT?.Player) {
      initPlayer()
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); initPlayer() }
      if (!document.getElementById('yt-script')) {
        const tag = document.createElement('script')
        tag.id  = 'yt-script'
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
    }
  }, [])

  function toggle() {
    if (!ytRef.current || !ready) return
    if (playing) {
      ytRef.current.pauseVideo()
    } else {
      const dur = ytRef.current.getDuration()
      if (dur > 0) ytRef.current.seekTo(syncPos(dur), true)
      ytRef.current.setVolume(volume)
      ytRef.current.playVideo()
    }
  }

  function changeVolume(v) {
    setVolume(v)
    ytRef.current?.setVolume(v)
  }

  return (
    <div className={s.root}>
      {/* hidden YT iframe */}
      <div ref={divRef} className={s.iframe} />

      {/* volume popup */}
      {showVol && (
        <div className={s.volPanel}>
          <span className={s.volLabel}>{volume}%</span>
          <input
            type="range" min="0" max="100" value={volume}
            onChange={e => changeVolume(+e.target.value)}
            className={s.slider}
          />
        </div>
      )}

      <div className={s.controls}>
        <button
          className={`${s.btn} ${playing ? s.btnOn : ''} ${ytError ? s.btnErr : ''}`}
          onClick={ytError ? undefined : toggle}
          title={ytError ?? (playing ? 'Пауза' : 'Включить фоновую музыку')}
          style={ytError ? { cursor: 'default' } : undefined}
        >
          {ytError ? <ErrIcon /> : !ready ? <DotsIcon /> : playing ? <PauseIcon /> : <MusicIcon />}
        </button>

        {ready && (
          <button
            className={`${s.volBtn} ${showVol ? s.volBtnOn : ''}`}
            onClick={() => setShowVol(v => !v)}
            title="Громкость"
          >
            {volume === 0 ? <MuteIcon /> : <VolumeIcon />}
          </button>
        )}
      </div>
    </div>
  )
}

const MusicIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
)
const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
    <rect x="4" y="3" width="4" height="14" rx="1"/>
    <rect x="12" y="3" width="4" height="14" rx="1"/>
  </svg>
)
const VolumeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 7v6h4l5 5V2L7 7H3z"/>
    <path d="M15.5 4.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M13 7a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </svg>
)
const MuteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 7v6h4l5 5V2L7 7H3z"/>
    <path d="M16 8l-4 4m4 0L12 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </svg>
)
const ErrIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2zm0 4v5m0 2v1.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
  </svg>
)
const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
    <circle cx="4" cy="10" r="2"><animate attributeName="cy" values="10;6;10" dur="0.8s" repeatCount="indefinite" begin="0s"/></circle>
    <circle cx="10" cy="10" r="2"><animate attributeName="cy" values="10;6;10" dur="0.8s" repeatCount="indefinite" begin="0.15s"/></circle>
    <circle cx="16" cy="10" r="2"><animate attributeName="cy" values="10;6;10" dur="0.8s" repeatCount="indefinite" begin="0.3s"/></circle>
  </svg>
)
