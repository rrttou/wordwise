import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { useSession } from './SessionContext'

const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  cream:'#faf8f4', surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  rose:'#e05070', roseL:'#fef0f3',
  sky:'#4080f0',  skyL:'#eef4ff',
  border:'rgba(0,0,0,0.08)',
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function MemoryGame({ user, source, customWords, onBack }) {
  const { wordCount } = useSession()

  const [cards,    setCards]    = useState([])
  const [flipped,  setFlipped]  = useState([])
  const [matched,  setMatched]  = useState(new Set())
  const [wrong,    setWrong]    = useState(new Set())
  const [attempts, setAttempts] = useState(0)
  const [locked,   setLocked]   = useState(false)
  const [gameWon,  setGameWon]  = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [elapsed,  setElapsed]  = useState(0)
  const [startKey, setStartKey] = useState(0)
  const startedAt               = useState(() => Date.now())[0]

  // Init on mount + restart
  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      setError('')

      let pool = []
      if (source === 'custom' && customWords?.length) {
        pool = customWords.filter(w => w.translation)
      } else if (source === 'wrong') {
        const { data } = await supabase
          .from('user_words').select('word, translation')
          .eq('user_id', user.id).gt('wrong_count', 0)
          .not('translation', 'is', null)
        pool = data ?? []
      } else {
        const { data } = await supabase
          .from('user_words').select('word, translation')
          .eq('user_id', user.id).not('translation', 'is', null)
        pool = data ?? []
      }

      if (cancelled) return
      if (pool.length < 2) {
        setError('אין מספיק מילים — הוסף ותרגם לפחות 2 מילים')
        setLoading(false)
        return
      }

      const count  = Math.min(wordCount, pool.length, 15)
      const picked = shuffle(pool).slice(0, count)

      const raw = [
        ...picked.map((w, i) => ({ pairId: i, text: w.word,        lang: 'en' })),
        ...picked.map((w, i) => ({ pairId: i, text: w.translation, lang: 'he' })),
      ]
      setCards(shuffle(raw))
      setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [startKey])

  // Win detection
  useEffect(() => {
    if (cards.length > 0 && matched.size === cards.length) setGameWon(true)
  }, [matched, cards.length])

  // Timer
  useEffect(() => {
    if (gameWon || loading) return
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [gameWon, loading])

  function handleFlip(i) {
    if (locked || flipped.includes(i) || matched.has(i)) return

    const next = [...flipped, i]
    setFlipped(next)
    if (next.length < 2) return

    const [a, b] = next
    setAttempts(n => n + 1)
    setLocked(true)

    if (cards[a].pairId === cards[b].pairId && cards[a].lang !== cards[b].lang) {
      // Match!
      setTimeout(() => {
        setMatched(prev => new Set([...prev, a, b]))
        setFlipped([])
        setLocked(false)
      }, 400)
    } else {
      // No match — flash red then flip back
      setWrong(new Set([a, b]))
      setTimeout(() => {
        setFlipped([])
        setWrong(new Set())
        setLocked(false)
      }, 900)
    }
  }

  function restart() {
    setFlipped([])
    setMatched(new Set())
    setWrong(new Set())
    setAttempts(0)
    setLocked(false)
    setGameWon(false)
    setElapsed(0)
    setStartKey(k => k + 1)
  }

  /* ── Loading ── */
  if (loading) return (
    <div style={{ textAlign: 'center', paddingTop: 80 }}>
      <div style={s.spinner} />
      <p style={{ color: c.ink3, marginTop: 16, fontSize: 13 }}>מכין קלפים...</p>
    </div>
  )

  /* ── Error ── */
  if (error) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <p style={{ color: c.rose, marginBottom: 20 }}>{error}</p>
      <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
    </div>
  )

  const pairs        = cards.length / 2
  const matchedPairs = matched.size / 2
  const pct          = pairs > 0 ? (matchedPairs / pairs) * 100 : 0

  /* ── Win screen ── */
  if (gameWon) {
    const accuracy = Math.round((pairs / attempts) * 100)
    return (
      <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 32 }}>
        <div style={s.winCard}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
          <div style={s.winTitle}>כל הזוגות הותאמו!</div>
          <div style={s.winGrid}>
            <div style={s.winStat}>
              <span style={s.winVal}>{pairs}</span>
              <span style={s.winLbl}>זוגות</span>
            </div>
            <div style={s.winStat}>
              <span style={s.winVal}>{attempts}</span>
              <span style={s.winLbl}>ניסיונות</span>
            </div>
            <div style={s.winStat}>
              <span style={s.winVal}>{accuracy}%</span>
              <span style={s.winLbl}>דיוק</span>
            </div>
            <div style={s.winStat}>
              <span style={s.winVal}>{fmtTime(elapsed)}</span>
              <span style={s.winLbl}>זמן</span>
            </div>
          </div>
        </div>
        <button style={s.primaryBtn} onClick={restart}>שחק שוב 🔄</button>
        <button style={s.secondaryBtn} onClick={onBack}>חזור לתפריט</button>
      </div>
    )
  }

  /* ── Game board ── */
  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.stopBtn} onClick={onBack}>✕ הפסק תרגול</button>
        <div style={s.headerStats}>
          <span style={s.hStat}>{matchedPairs}/{pairs} ✓</span>
          <span style={s.hDot} />
          <span style={s.hStat}>{attempts} ניסיונות</span>
          <span style={s.hDot} />
          <span style={s.hStat}>{fmtTime(elapsed)}</span>
        </div>
      </div>

      {/* Progress */}
      <div style={s.track}>
        <div style={{ ...s.bar, width: pct + '%' }} />
      </div>

      {/* Grid */}
      <div style={s.grid}>
        {cards.map((card, i) => (
          <Card
            key={`${card.pairId}-${card.lang}`}
            card={card}
            isFlipped={flipped.includes(i) || matched.has(i)}
            isMatched={matched.has(i)}
            isWrong={wrong.has(i)}
            onClick={() => handleFlip(i)}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Single card ────────────────────────────────────────────────── */
function Card({ card, isFlipped, isMatched, isWrong, onClick }) {
  const isEn = card.lang === 'en'
  const text = card.text ?? ''

  // Shorten long translations (keep first segment before / or ,)
  const display = text.length > 14
    ? (text.split(/[/,]/)[0].trim().slice(0, 13) + '…')
    : text

  const fs = display.length > 10 ? 10 : display.length > 7 ? 11 : display.length > 5 ? 12 : 13

  const faceUpBg = isWrong
    ? c.roseL
    : isMatched
    ? '#dcfce7'
    : isEn ? c.skyL : c.mintL

  const faceUpColor = isWrong
    ? c.rose
    : isMatched
    ? '#15803d'
    : isEn ? c.sky : c.mintD

  const faceUpBorder = isWrong
    ? `1.5px solid ${c.rose}`
    : isMatched
    ? '1.5px solid #86efac'
    : '1.5px solid rgba(0,0,0,0.07)'

  return (
    <div
      style={{ perspective: '700px', cursor: isFlipped ? 'default' : 'pointer' }}
      onClick={!isFlipped ? onClick : undefined}
    >
      <div style={{
        ...s.flipper,
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* Face down */}
        <div style={{ ...s.face, ...s.faceDown }}>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 22 }}>✦</span>
        </div>
        {/* Face up */}
        <div style={{ ...s.face, ...s.faceUp, background: faceUpBg, border: faceUpBorder }}>
          {isMatched && <span style={s.check}>✓</span>}
          <span style={{
            fontSize: fs,
            fontWeight: 600,
            color: faceUpColor,
            textAlign: 'center',
            direction: isEn ? 'ltr' : 'rtl',
            lineHeight: 1.25,
            padding: '0 3px',
            wordBreak: 'break-word',
          }}>
            {display}
          </span>
          <span style={{ fontSize: 8, color: faceUpColor, opacity: 0.55, marginTop: 2, letterSpacing: '0.5px' }}>
            {isEn ? 'EN' : 'עב׳'}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = {
  wrap: { maxWidth: 420, margin: '0 auto', padding: '16px 16px 32px', direction: 'rtl' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ghostBtn: { background: 'transparent', border: 'none', color: c.ink3, cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' },
  stopBtn: { background: c.surface, border: `1.5px solid rgba(0,0,0,0.08)`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500, color: c.ink2, cursor: 'pointer', fontFamily: 'inherit' },
  headerStats: { display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr' },
  hStat: { fontSize: 12, color: c.ink3, fontWeight: 500 },
  hDot:  { width: 3, height: 3, borderRadius: '50%', background: c.ink3, flexShrink: 0 },

  track: { height: 4, background: c.surface, borderRadius: 4, marginBottom: 14, overflow: 'hidden' },
  bar:   { height: '100%', background: c.mint, borderRadius: 4, transition: 'width 0.4s' },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },

  // Card
  flipper: {
    width: '100%',
    paddingTop: '85%',
    position: 'relative',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.35s ease',
  },
  face: {
    position: 'absolute',
    inset: 0,
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  faceDown: { background: c.ink },
  faceUp:   { transform: 'rotateY(180deg)', background: c.white },
  check: { position: 'absolute', top: 3, right: 5, fontSize: 9, color: '#16a34a' },

  spinner: {
    width: 36, height: 36,
    border: `3px solid ${c.mintL}`, borderTop: `3px solid ${c.mint}`,
    borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },

  // Win
  winCard: { background: c.white, border: `1px solid ${c.border}`, borderRadius: 16, padding: '32px 24px', marginBottom: 24 },
  winTitle: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: c.ink, marginBottom: 20 },
  winGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  winStat:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  winVal:   { fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: c.ink },
  winLbl:   { fontSize: 11, color: c.ink3 },

  primaryBtn: {
    background: c.mint, color: '#fff', border: 'none',
    borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 500,
    cursor: 'pointer', width: '100%', fontFamily: 'inherit', marginBottom: 10,
  },
  secondaryBtn: {
    background: c.surface, color: c.ink2, border: `1px solid ${c.border}`,
    borderRadius: 12, padding: '14px', fontSize: 15,
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
  },
}
