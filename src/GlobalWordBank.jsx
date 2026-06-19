import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  cream:'#faf8f4', surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  rose:'#e05070',
  sky:'#4080f0',
  border:'rgba(0,0,0,0.08)',
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const LEVEL_COLOR = {
  A1:'#2ec4a0', A2:'#2ec4a0',
  B1:'#4080f0', B2:'#4080f0',
  C1:'#7c3aed', C2:'#7c3aed',
}

export default function GlobalWordBank() {
  const [allWords,     setAllWords]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeLevel,  setActiveLevel]  = useState('all')
  const [activeLetter, setActiveLetter] = useState(null)
  const [search,       setSearch]       = useState('')

  const letterNavRef    = useRef(null)
  const activeLetterRef = useRef(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('global_words')
        .select('word, translation, level')
        .not('translation', 'is', null)
        .order('word')
        .limit(3000)
      setAllWords(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Reset letter when level changes
  useEffect(() => {
    const pool = activeLevel === 'all' ? allWords : allWords.filter(w => w.level === activeLevel)
    setActiveLetter(pool[0]?.word[0]?.toUpperCase() ?? null)
    setSearch('')
  }, [activeLevel, allWords])

  // Auto-scroll active letter
  useEffect(() => {
    if (activeLetterRef.current && letterNavRef.current)
      activeLetterRef.current.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeLetter])

  // Level counts (client-side)
  const levelCounts = {}
  LEVELS.forEach(l => { levelCounts[l] = allWords.filter(w => w.level === l).length })

  // Filtering
  const levelFiltered = activeLevel === 'all' ? allWords : allWords.filter(w => w.level === activeLevel)
  const searchTrim    = search.trim().toLowerCase()
  const availableLetters = new Set(levelFiltered.map(w => w.word[0]?.toUpperCase()).filter(Boolean))
  const displayed = searchTrim
    ? levelFiltered.filter(w =>
        w.word.toLowerCase().includes(searchTrim) ||
        (w.translation ?? '').toLowerCase().includes(searchTrim)
      )
    : activeLetter
      ? levelFiltered.filter(w => w.word[0]?.toUpperCase() === activeLetter)
      : levelFiltered

  const showAlphaNav = !searchTrim

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>מאגר המילים הגלובלי</h2>
        <p style={s.sub}>מילון Cambridge לרמות CEFR</p>
      </div>

      {/* Level navbar */}
      <div style={s.levelNav}>
        <button
          style={{ ...s.levelBtn, ...(activeLevel === 'all' ? s.levelBtnAll : {}) }}
          onClick={() => setActiveLevel('all')}
        >
          <span>הכל</span>
          <span style={s.levelCount}>{loading ? '·' : allWords.length}</span>
        </button>
        {LEVELS.map(level => {
          const col = LEVEL_COLOR[level]
          const on  = activeLevel === level
          const cnt = levelCounts[level] ?? 0
          return (
            <button
              key={level}
              style={{
                ...s.levelBtn,
                ...(on ? { background: col + '18', color: col, borderColor: col, fontWeight: 700 } : {}),
                ...(cnt === 0 ? { opacity: 0.28 } : {}),
              }}
              onClick={() => cnt > 0 && setActiveLevel(level)}
              disabled={cnt === 0}
            >
              <span>{level}</span>
              <span style={s.levelCount}>{loading ? '·' : cnt}</span>
            </button>
          )
        })}
      </div>

      {/* Letter navbar */}
      {showAlphaNav && (
        <div style={s.letterNav} ref={letterNavRef}>
          {ALL_LETTERS.map(letter => {
            const has = availableLetters.has(letter)
            const on  = letter === activeLetter
            const col = activeLevel !== 'all' ? (LEVEL_COLOR[activeLevel] ?? c.mint) : c.mint
            return (
              <button
                key={letter}
                ref={on ? activeLetterRef : null}
                disabled={!has}
                style={{
                  ...s.letterBtn,
                  ...(on  ? { background: col + '18', color: col, borderColor: col, fontWeight: 700 } : {}),
                  ...(!has ? s.letterBtnOff : {}),
                }}
                onClick={() => has && setActiveLetter(letter)}
              >
                {letter}
              </button>
            )
          })}
        </div>
      )}

      {/* Search + stats bar */}
      <div style={s.filterBar}>
        <div style={s.searchWrap}>
          <span style={s.searchIcon}>🔍</span>
          <input
            style={s.searchInput}
            placeholder="חיפוש מילה..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            dir="auto"
          />
          {search && <button style={s.clearSearch} onClick={() => setSearch('')}>✕</button>}
        </div>
        <span style={s.countBadge}>
          {loading ? '...' : `${displayed.length} מילים`}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={s.center}>
          <div style={s.spinner} />
          <p style={{ color: c.ink3, fontSize: 13, marginTop: 12 }}>טוען מילים...</p>
        </div>
      ) : displayed.length === 0 ? (
        <div style={s.center}>
          <p style={{ color: c.ink3, fontSize: 13 }}>
            {searchTrim ? `לא נמצאו תוצאות עבור "${search}"` : 'אין מילים'}
          </p>
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <tbody>
              {displayed.map(({ word, translation, level }, i) => (
                <tr key={word} style={{ ...s.tableRow, ...(i % 2 !== 0 ? s.tableRowAlt : {}) }}>
                  <td style={s.tdWord}>{word}</td>
                  <td style={s.tdTrans}>{translation}</td>
                  <td style={s.tdLevel}>
                    {level && (
                      <span style={{
                        ...s.levelBadge,
                        color: LEVEL_COLOR[level] ?? c.ink3,
                        borderColor: (LEVEL_COLOR[level] ?? c.ink3) + '55',
                      }}>
                        {level}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { maxWidth: 480, margin: '0 auto', padding: '20px 0 32px', direction: 'rtl' },

  header: { textAlign: 'center', padding: '0 16px 16px' },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: c.ink, margin: '0 0 4px' },
  sub:   { fontSize: 12, color: c.ink3, margin: 0, letterSpacing: '0.5px' },

  /* Level navbar */
  levelNav: {
    display: 'flex', gap: 5, padding: '0 16px 12px',
    overflowX: 'auto', scrollbarWidth: 'none',
  },
  levelBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: c.white, border: `1.5px solid ${c.border}`, borderRadius: 9,
    padding: '6px 13px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 500, color: c.ink3, flexShrink: 0, lineHeight: 1.2,
  },
  levelBtnAll: { background: c.mintL, borderColor: c.mint, color: c.mintD, fontWeight: 700 },
  levelCount:  { fontSize: 10, fontWeight: 400, opacity: 0.65, marginTop: 2 },

  /* Letter navbar */
  letterNav: {
    display: 'flex', gap: 3, padding: '6px 16px 8px',
    overflowX: 'auto', scrollbarWidth: 'none',
    borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}`,
    background: c.white,
  },
  letterBtn: {
    background: 'transparent', border: `1px solid ${c.border}`, borderRadius: 6,
    padding: '4px 0', width: 26, minWidth: 26, fontSize: 11, fontWeight: 500,
    color: c.ink2, cursor: 'pointer', textAlign: 'center',
    fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.12s',
  },
  letterBtnOff: { color: c.ink3, opacity: 0.2, cursor: 'default', borderColor: 'transparent' },

  /* Filter / search bar */
  filterBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 16px', borderBottom: `1px solid ${c.border}`,
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', flex: 1,
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8,
    padding: '0 8px', gap: 4,
  },
  searchIcon:  { fontSize: 12, flexShrink: 0, opacity: 0.5 },
  searchInput: {
    background: 'transparent', border: 'none', outline: 'none',
    fontSize: 13, color: c.ink, fontFamily: 'inherit',
    flex: 1, padding: '7px 0',
  },
  clearSearch: {
    background: 'transparent', border: 'none', color: c.ink3,
    cursor: 'pointer', fontSize: 12, padding: '2px 0', flexShrink: 0,
  },
  countBadge: { fontSize: 12, color: c.ink3, whiteSpace: 'nowrap', flexShrink: 0 },

  /* Table */
  tableWrap: { margin: '0 16px', borderRadius: 12, border: `1px solid ${c.border}`, overflow: 'hidden', background: c.white },
  table:     { width: '100%', borderCollapse: 'collapse' },
  tableRow:  { borderBottom: `1px solid ${c.border}` },
  tableRowAlt: { background: c.surface },
  tdWord:  { padding: '10px 14px', fontSize: 14, fontWeight: 600, color: c.ink, direction: 'ltr', width: '38%' },
  tdTrans: { padding: '10px 8px', fontSize: 13, color: c.ink2, direction: 'rtl' },
  tdLevel: { padding: '10px 12px 10px 0', width: 36, textAlign: 'right' },
  levelBadge: {
    fontSize: 9, fontWeight: 700, padding: '2px 5px',
    borderRadius: 4, border: '1px solid', display: 'inline-block',
  },

  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 16px', gap: 8 },
  spinner: {
    width: 32, height: 32,
    border: `3px solid ${c.mintL}`, borderTop: `3px solid ${c.mint}`,
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
}
