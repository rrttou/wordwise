import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  cream:'#faf8f4', surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  gold:'#e8a020', goldL:'#fff8e8',
  rose:'#e05070',
  sky:'#4080f0',  skyL:'#eef4ff',
  border:'rgba(0,0,0,0.08)',
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const LEVEL_STYLE = {
  A1: { bg: '#e8faf5', color: '#1a9e80', border: '#2ec4a0' },
  A2: { bg: '#e8faf5', color: '#1a9e80', border: '#2ec4a0' },
  B1: { bg: '#eef4ff', color: '#4080f0', border: '#4080f0' },
  B2: { bg: '#eef4ff', color: '#4080f0', border: '#4080f0' },
  C1: { bg: '#f3e8ff', color: '#7c3aed', border: '#c4b5fd' },
  C2: { bg: '#f3e8ff', color: '#7c3aed', border: '#c4b5fd' },
}

export default function GlobalWordBank() {
  const [activeLevel,  setActiveLevel]  = useState('B1')
  const [activeLetter, setActiveLetter] = useState(null)
  const [levelWords,   setLevelWords]   = useState([])
  const [loading,      setLoading]      = useState(false)
  const [levelCounts,  setLevelCounts]  = useState({})
  const letterNavRef = useRef(null)
  const activeLetterRef = useRef(null)

  useEffect(() => {
    fetchAllCounts()
  }, [])

  useEffect(() => { fetchLevel(activeLevel) }, [activeLevel])

  async function fetchAllCounts() {
    const results = await Promise.all(
      LEVELS.map(level =>
        supabase
          .from('global_words')
          .select('*', { count: 'exact', head: true })
          .eq('level', level)
          .not('translation', 'is', null)
      )
    )
    const counts = {}
    LEVELS.forEach((level, i) => { counts[level] = results[i].count ?? 0 })
    setLevelCounts(counts)
  }

  useEffect(() => {
    if (activeLetterRef.current && letterNavRef.current) {
      activeLetterRef.current.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }
  }, [activeLetter])

  async function fetchLevel(level) {
    setLoading(true)
    setActiveLetter(null)
    const { data } = await supabase
      .from('global_words')
      .select('word, translation')
      .eq('level', level)
      .not('translation', 'is', null)
      .order('word')
    const words = data || []
    setLevelWords(words)
    if (words.length) setActiveLetter(words[0].word[0].toUpperCase())
    setLoading(false)
  }

  const availableLetters = new Set(levelWords.map(w => w.word[0].toUpperCase()))
  const displayedWords   = activeLetter
    ? levelWords.filter(w => w.word[0].toUpperCase() === activeLetter)
    : levelWords

  const ls = LEVEL_STYLE[activeLevel]

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>מאגר המילים הגלובלי</h2>
        <p style={s.sub}>מילון Cambridge לרמות CEFR</p>
      </div>

      {/* Level navbar */}
      <div style={s.levelNav}>
        {LEVELS.map(level => {
          const lst = LEVEL_STYLE[level]
          const on  = level === activeLevel
          return (
            <button
              key={level}
              style={{
                ...s.levelBtn,
                ...(on ? {
                  background: lst.bg,
                  color: lst.color,
                  borderColor: lst.border,
                  fontWeight: 700,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 2px 8px ${lst.border}44`,
                } : {}),
              }}
              onClick={() => setActiveLevel(level)}
            >
              <span>{level}</span>
              {levelCounts[level] != null && (
                <span style={{
                  display: 'block',
                  fontSize: 10,
                  fontWeight: 400,
                  opacity: 0.7,
                  marginTop: 1,
                  lineHeight: 1,
                }}>
                  {levelCounts[level]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Letter navbar */}
      <div style={s.letterNav} ref={letterNavRef}>
        {ALL_LETTERS.map(letter => {
          const has = availableLetters.has(letter)
          const on  = letter === activeLetter
          return (
            <button
              key={letter}
              ref={on ? activeLetterRef : null}
              disabled={!has}
              style={{
                ...s.letterBtn,
                ...(on  ? { background: ls.bg, color: ls.color, borderColor: ls.border, fontWeight: 700 } : {}),
                ...(!has ? s.letterBtnOff : {}),
              }}
              onClick={() => has && setActiveLetter(letter)}
            >
              {letter}
            </button>
          )
        })}
      </div>

      {/* Stats bar */}
      <div style={s.statsBar}>
        <span style={{ ...s.levelPill, background: ls.bg, color: ls.color, borderColor: ls.border }}>
          {activeLevel}
        </span>
        <span style={s.wordCount}>
          {loading ? '...' : `${displayedWords.length} מילים`}
          {!loading && activeLetter && levelWords.length > 0 && (
            <span style={{ color: c.ink3, fontWeight: 400 }}> ({levelWords.length} ברמה)</span>
          )}
        </span>
      </div>

      {/* Word list */}
      {loading ? (
        <div style={s.center}>
          <div style={s.spinner} />
          <p style={{ color: c.ink3, fontSize: 13, marginTop: 12 }}>טוען מילים...</p>
        </div>
      ) : levelWords.length === 0 ? (
        <div style={s.center}>
          <span style={{ fontSize: 40 }}>📚</span>
          <p style={{ color: c.ink3, fontSize: 13, marginTop: 10 }}>אין מילים מתורגמות ברמה זו עדיין</p>
        </div>
      ) : displayedWords.length === 0 ? (
        <div style={s.center}>
          <p style={{ color: c.ink3, fontSize: 13 }}>אין מילים באות {activeLetter}</p>
        </div>
      ) : (
        <div style={s.tableWrap}>
          {displayedWords.map(({ word, translation }, i) => (
            <div key={word} style={{ ...s.row, ...(i % 2 === 0 ? {} : s.rowAlt) }}>
              <span style={s.word}>{word}</span>
              <span style={s.translation}>{translation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  page: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '20px 0 32px',
    direction: 'rtl',
    minHeight: '60vh',
  },
  header: {
    textAlign: 'center',
    padding: '0 16px 16px',
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 24,
    fontWeight: 600,
    color: c.ink,
    margin: '0 0 4px',
  },
  sub: {
    fontSize: 12,
    color: c.ink3,
    margin: 0,
    letterSpacing: '0.5px',
  },

  /* Level navbar */
  levelNav: {
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    padding: '0 16px 14px',
    flexWrap: 'wrap',
  },
  levelBtn: {
    background: c.white,
    border: `1.5px solid ${c.border}`,
    borderRadius: 10,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: c.ink3,
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    minWidth: 52,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 1.3,
  },

  /* Letter navbar */
  letterNav: {
    display: 'flex',
    overflowX: 'auto',
    gap: 4,
    padding: '8px 16px 10px',
    scrollbarWidth: 'none',
    borderTop: `1px solid ${c.border}`,
    borderBottom: `1px solid ${c.border}`,
    background: c.white,
    marginBottom: 0,
  },
  letterBtn: {
    background: 'transparent',
    border: `1px solid ${c.border}`,
    borderRadius: 7,
    padding: '5px 0',
    width: 30,
    minWidth: 30,
    fontSize: 12,
    fontWeight: 500,
    color: c.ink2,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.12s',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  letterBtnOff: {
    color: c.ink3,
    opacity: 0.3,
    cursor: 'default',
    borderColor: 'transparent',
  },

  /* Stats bar */
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px 8px',
    direction: 'ltr',
  },
  levelPill: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    border: '1.5px solid',
    fontSize: 12,
    fontWeight: 700,
  },
  wordCount: {
    fontSize: 13,
    fontWeight: 600,
    color: c.ink2,
    direction: 'rtl',
  },

  /* Word rows */
  tableWrap: {
    margin: '0 16px',
    borderRadius: 12,
    border: `1px solid ${c.border}`,
    overflow: 'hidden',
    background: c.white,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '11px 16px',
    gap: 12,
    borderBottom: `1px solid ${c.border}`,
  },
  rowAlt: {
    background: c.surface,
  },
  word: {
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    color: c.ink,
    direction: 'ltr',
    minWidth: 120,
  },
  translation: {
    fontSize: 13,
    color: c.ink2,
    direction: 'rtl',
    textAlign: 'right',
    flex: 1,
  },

  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 16px',
    gap: 8,
  },
  spinner: {
    width: 32,
    height: 32,
    border: `3px solid ${c.mintL}`,
    borderTop: `3px solid ${c.mint}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}
