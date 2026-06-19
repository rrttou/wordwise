import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { useSession } from './SessionContext'

export const MIN_PICK = 4
const VALID_LEVELS = new Set(['A1','A2','B1','B2','C1','C2'])
const LEVELS       = ['A1','A2','B1','B2','C1','C2']
const ALL_LETTERS  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const LEVEL_COLOR = {
  A1:'#2ec4a0', A2:'#2ec4a0',
  B1:'#4080f0', B2:'#4080f0',
  C1:'#7c3aed', C2:'#7c3aed',
}

const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  rose:'#e05070', roseL:'#fef0f3',
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

function wordKey(w) { return w.id ?? w.word }

/* ═══════════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════════ */
export default function WordPicker({ user, onDone, onCancel }) {
  const { wordCount, setWordCount } = useSession()

  // Navigation state
  const [source,       setSource]   = useState('mine')
  const [activeLevel,  setLevel]    = useState('all')
  const [activeLetter, setLetter]   = useState(null)

  // Data
  const [allWords,  setAllWords]  = useState([])
  const [selected,  setSelected]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [wrongOnly, setWrongOnly] = useState(false)
  const [search,    setSearch]    = useState('')

  // Manual mode
  const [manualInput,   setManualInput]   = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualStatus,  setManualStatus]  = useState('')
  const [manualError,   setManualError]   = useState('')
  const [manualFailed,  setManualFailed]  = useState([])

  const letterNavRef    = useRef(null)
  const activeLetterRef = useRef(null)

  // 'user' covers both mine+random; 'global' covers global; 'manual' is separate
  const dataSource = source === 'global' ? 'global' : source === 'manual' ? 'manual' : 'user'

  // Load words when underlying data source changes
  useEffect(() => {
    if (dataSource === 'manual') { setAllWords([]); return }
    async function load() {
      setLoading(true)
      const q = dataSource === 'global'
        ? supabase.from('global_words')
            .select('word, translation, level')
            .not('translation', 'is', null)
            .order('word')
            .limit(10000)
        : supabase.from('user_words')
            .select('id, word, translation, level, wrong_count')
            .eq('user_id', user.id)
            .not('translation', 'is', null)
            .order('word')
      const { data } = await q
      setAllWords(data ?? [])
      setLoading(false)
    }
    load()
  }, [dataSource])

  // Reset UI when source changes
  useEffect(() => {
    setSelected([])
    setLevel('all')
    setLetter(null)
    setWrongOnly(false)
    setSearch('')
  }, [source])

  // Derived: words filtered by level + wrongOnly
  const levelFiltered = activeLevel === 'all'
    ? allWords
    : allWords.filter(w => w.level === activeLevel)
  const basePool = (source === 'mine' && wrongOnly)
    ? levelFiltered.filter(w => (w.wrong_count ?? 0) > 0)
    : levelFiltered
  const availableLetters = new Set(basePool.map(w => w.word[0]?.toUpperCase()).filter(Boolean))
  const searchTrim = search.trim().toLowerCase()
  const shownWords = searchTrim
    ? basePool.filter(w =>
        w.word.toLowerCase().includes(searchTrim) ||
        (w.translation ?? '').toLowerCase().includes(searchTrim)
      )
    : activeLetter
      ? basePool.filter(w => w.word[0]?.toUpperCase() === activeLetter)
      : basePool

  // Level counts (computed client-side from allWords)
  const levelCounts = {}
  LEVELS.forEach(l => {
    const pool = source === 'mine' && wrongOnly
      ? allWords.filter(w => w.level === l && (w.wrong_count ?? 0) > 0)
      : allWords.filter(w => w.level === l)
    levelCounts[l] = pool.length
  })
  const allCount = source === 'mine' && wrongOnly
    ? allWords.filter(w => (w.wrong_count ?? 0) > 0).length
    : allWords.length

  // Reset active letter when pool changes
  useEffect(() => {
    const lf = activeLevel === 'all' ? allWords : allWords.filter(w => w.level === activeLevel)
    const pool = source === 'mine' && wrongOnly ? lf.filter(w => (w.wrong_count ?? 0) > 0) : lf
    setLetter(pool[0]?.word[0]?.toUpperCase() ?? null)
  }, [activeLevel, wrongOnly, allWords, source])

  // Auto-scroll active letter into view
  useEffect(() => {
    if (activeLetterRef.current && letterNavRef.current) {
      activeLetterRef.current.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }
  }, [activeLetter])

  // Selection helpers
  const selectedKeys = new Set(selected.map(wordKey))
  const canStart     = selected.length >= MIN_PICK

  function toggleWord(w) {
    const key = wordKey(w)
    setSelected(prev =>
      selectedKeys.has(key) ? prev.filter(p => wordKey(p) !== key) : [...prev, w]
    )
  }

  // Random: pick immediately and call onDone
  function handleRandom() {
    const picked = shuffle(basePool).slice(0, Math.min(wordCount, basePool.length))
    if (picked.length >= MIN_PICK) onDone(picked)
  }

  // Manual: enrich + save, then call onDone
  async function handleManual() {
    const typed = [...new Set(
      manualInput.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(Boolean)
    )]
    if (!typed.length) return
    setManualLoading(true); setManualFailed([]); setManualError(''); setManualStatus('מחפש מילים...')

    const { data: existing } = await supabase
      .from('user_words').select('id, word, translation, level, wrong_count')
      .eq('user_id', user.id).in('word', typed).not('translation', 'is', null)

    const existingSet = new Set((existing ?? []).map(w => w.word))
    const newWords = typed.filter(w => !existingSet.has(w))
    let resultWords = [...(existing ?? [])]

    if (newWords.length > 0) {
      setManualStatus(`מתרגם ${newWords.length} מילים...`)
      const { data: enriched, error: fnErr } = await supabase.functions.invoke('enrich-words', {
        body: { words: newWords }
      })
      if (!fnErr && Array.isArray(enriched) && enriched.length) {
        const rows = enriched.filter(e => e.word && e.translation).map(e => ({
          user_id: user.id,
          word: e.word.toLowerCase(),
          translation: e.translation,
          level: VALID_LEVELS.has(e.level) ? e.level : null,
          source: 'manual',
        }))
        if (rows.length) {
          const { data: upserted } = await supabase
            .from('user_words').upsert(rows, { onConflict: 'user_id,word' })
            .select('id, word, translation, level')
          if (upserted?.length) resultWords = [...resultWords, ...upserted]
        }
        const enrichedSet = new Set(enriched.map(e => e.word?.toLowerCase()).filter(Boolean))
        setManualFailed(newWords.filter(w => !enrichedSet.has(w)))
      } else {
        setManualFailed(newWords)
      }
    }

    setManualLoading(false); setManualStatus('')
    if (resultWords.length < MIN_PICK) {
      setManualError(`נמצאו רק ${resultWords.length} מילים — צריך לפחות ${MIN_PICK}`)
      return
    }
    onDone(resultWords)
  }

  const showLevelNav = source !== 'manual'
  const showAlphaNav = (source === 'mine' || source === 'global') && !searchTrim
  const activeColor  = activeLevel !== 'all' ? (LEVEL_COLOR[activeLevel] ?? c.mint) : c.mint

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <button style={s.cancelBtn} onClick={onCancel}>← חזור</button>
        <span style={s.headerTitle}>בחר מילים לתרגול</span>
        <span style={s.selCount}>{selected.length > 0 ? `${selected.length} ✓` : ''}</span>
      </div>

      {/* ── 1st navbar: Source ── */}
      <div style={s.sourceNav}>
        {[
          { id: 'mine',   label: 'שלי'    },
          { id: 'random', label: 'אקראי'  },
          { id: 'global', label: 'גלובלי' },
          { id: 'manual', label: 'ידני'   },
        ].map(src => (
          <button
            key={src.id}
            style={{ ...s.srcBtn, ...(source === src.id ? s.srcBtnOn : {}) }}
            onClick={() => setSource(src.id)}
          >
            {src.label}
          </button>
        ))}
      </div>

      {/* ── 2nd navbar: Level ── */}
      {showLevelNav && (
        <div style={s.levelNav}>
          <button
            style={{ ...s.levelBtn, ...(activeLevel === 'all' ? s.levelBtnAll : {}) }}
            onClick={() => setLevel('all')}
          >
            <span>הכל</span>
            <span style={s.levelCount}>{loading ? '·' : allCount}</span>
          </button>
          {LEVELS.map(level => {
            const col = LEVEL_COLOR[level] ?? c.mint
            const on  = activeLevel === level
            const cnt = levelCounts[level]
            return (
              <button
                key={level}
                style={{
                  ...s.levelBtn,
                  ...(on  ? { background: col + '18', color: col, borderColor: col, fontWeight: 700 } : {}),
                  ...(cnt === 0 ? { opacity: 0.28 } : {}),
                }}
                onClick={() => cnt > 0 && setLevel(level)}
                disabled={cnt === 0}
              >
                <span>{level}</span>
                <span style={s.levelCount}>{loading ? '·' : cnt}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── 3rd navbar: Alpha ── */}
      {showAlphaNav && (
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
                  ...(on  ? { background: activeColor + '18', color: activeColor, borderColor: activeColor, fontWeight: 700 } : {}),
                  ...(!has ? s.letterBtnOff : {}),
                }}
                onClick={() => has && setLetter(letter)}
              >
                {letter}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Content ── */}
      <div style={s.content}>

        {/* שלי — browse & toggle */}
        {source === 'mine' && (
          <>
            <div style={s.actionRow}>
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
              <button
                style={{ ...s.filterBtn, ...(wrongOnly ? s.filterBtnOn : {}) }}
                onClick={() => setWrongOnly(v => !v)}
              >
                שגויות
              </button>
              <button style={s.actionBtn} onClick={() => setSelected(shownWords)}>✓ הכל</button>
              <button style={s.actionBtn} onClick={() => setSelected([])}>נקה</button>
            </div>
            <WordTable words={shownWords} selectedKeys={selectedKeys} onToggle={toggleWord}
              loading={loading} letter={activeLetter} search={search} />
          </>
        )}

        {/* אקראי — count picker */}
        {source === 'random' && (
          <div style={s.centeredCol}>
            <p style={s.hintText}>
              {loading ? '...' :
                `${basePool.length} מילים זמינות${activeLevel !== 'all' ? ` ברמה ${activeLevel}` : ''}`}
            </p>
            <div style={s.stepper}>
              <button style={s.stepBtn} onClick={() => setWordCount(Math.max(MIN_PICK, wordCount - 2))}>−</button>
              <span style={s.stepVal}>{wordCount}</span>
              <button style={s.stepBtn} onClick={() => setWordCount(Math.min(30, wordCount + 2))}>+</button>
            </div>
            <button
              style={{ ...s.bigBtn, opacity: basePool.length >= MIN_PICK && !loading ? 1 : 0.45 }}
              onClick={handleRandom}
              disabled={basePool.length < MIN_PICK || loading}
            >
              {loading ? '...' : `✦ בחר ${Math.min(wordCount, basePool.length)} מילים אקראיות`}
            </button>
            {!loading && basePool.length < MIN_PICK && (
              <p style={{ color: c.rose, fontSize: 12, textAlign: 'center' }}>
                אין מספיק מילים — נסה רמה אחרת
              </p>
            )}
          </div>
        )}

        {/* גלובלי — browse & toggle */}
        {source === 'global' && (
          <>
            <div style={s.actionRow}>
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
              <button style={s.actionBtn} onClick={() => setSelected(shownWords.slice(0, 20))}>+20</button>
              <button style={s.actionBtn} onClick={() => setSelected([])}>נקה</button>
            </div>
            <WordTable words={shownWords} selectedKeys={selectedKeys} onToggle={toggleWord}
              loading={loading} letter={activeLetter} search={search} />
          </>
        )}

        {/* ידני — type & enrich */}
        {source === 'manual' && (
          <div style={s.manualCol}>
            <p style={s.hintText}>הקלד מילים באנגלית — מופרדות בפסיק או שורה חדשה. מילים חדשות יתורגמו ויישמרו.</p>
            <textarea
              style={s.textarea}
              placeholder="apple, universe, run, beautiful..."
              value={manualInput}
              onChange={e => { setManualInput(e.target.value); setManualFailed([]); setManualError('') }}
              dir="ltr"
              rows={6}
            />
            {manualFailed.length > 0 && (
              <p style={{ color: c.ink3, fontSize: 12, direction: 'ltr', textAlign: 'left' }}>
                לא זוהו: {manualFailed.join(', ')}
              </p>
            )}
            {manualError && <p style={{ color: c.rose, fontSize: 13 }}>{manualError}</p>}
            <button
              style={{ ...s.bigBtn, opacity: manualInput.trim() && !manualLoading ? 1 : 0.45 }}
              onClick={handleManual}
              disabled={!manualInput.trim() || manualLoading}
            >
              {manualLoading ? (manualStatus || 'טוען...') : 'תרגם והוסף'}
            </button>
          </div>
        )}

      </div>

      {/* ── Start bar ── */}
      <div style={{ ...s.startBar, opacity: canStart ? 1 : 0, pointerEvents: canStart ? 'auto' : 'none' }}>
        <div style={s.startPreview}>
          {selected.slice(0, 4).map(w => (
            <span key={wordKey(w)} style={s.startChip}>{w.word}</span>
          ))}
          {selected.length > 4 && <span style={s.startMore}>+{selected.length - 4}</span>}
        </div>
        <button style={s.startBtn} onClick={() => onDone(selected)} disabled={!canStart}>
          התחל ({selected.length}) ←
        </button>
      </div>

    </div>
  )
}

/* ─── Word table ─────────────────────────────────────────────────── */
function WordTable({ words, selectedKeys, onToggle, loading, letter, search }) {
  if (loading) return <CenteredMsg>טוען...</CenteredMsg>
  if (!words.length) {
    const msg = search
      ? `לא נמצאו תוצאות עבור "${search}"`
      : letter ? `אין מילים באות ${letter}` : 'אין מילים'
    return <CenteredMsg>{msg}</CenteredMsg>
  }
  return (
    <table style={s.table}>
      <tbody>
        {words.map((w, i) => {
          const on = selectedKeys.has(wordKey(w))
          return (
            <tr
              key={wordKey(w)}
              style={{ ...s.tableRow, ...(on ? s.tableRowOn : {}), ...(i % 2 === 0 ? s.tableRowEven : {}) }}
              onClick={() => onToggle(w)}
            >
              <td style={s.tdCheck}>{on ? '✓' : ''}</td>
              <td style={s.tdWord}>{w.word}</td>
              <td style={s.tdTrans}>{w.translation}</td>
              <td style={s.tdLevel}>
                {w.level && (
                  <span style={{ ...s.levelBadge, color: LEVEL_COLOR[w.level] ?? '#8888aa', borderColor: (LEVEL_COLOR[w.level] ?? '#8888aa') + '44' }}>
                    {w.level}
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function CenteredMsg({ children }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: c.ink3, fontSize: 13 }}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Styles
═══════════════════════════════════════════════════════════════════ */
const s = {
  page: {
    maxWidth: 420, margin: '0 auto',
    display: 'flex', flexDirection: 'column',
    height: 'calc(100vh - 146px)', direction: 'rtl',
  },

  /* Header */
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', borderBottom: `1px solid ${c.border}`, flexShrink: 0,
  },
  cancelBtn: {
    background: 'transparent', border: 'none', color: c.ink3,
    cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0,
  },
  headerTitle: { fontSize: 14, fontWeight: 600, color: c.ink },
  selCount: { fontSize: 13, fontWeight: 600, color: c.mintD, minWidth: 40, textAlign: 'left' },

  /* 1st navbar — source */
  sourceNav: {
    display: 'flex', gap: 4, padding: '7px 16px',
    borderBottom: `1px solid ${c.border}`, background: c.white, flexShrink: 0,
    overflowX: 'auto', scrollbarWidth: 'none',
  },
  srcBtn: {
    background: 'transparent', border: `1.5px solid ${c.border}`, borderRadius: 8,
    padding: '6px 16px', fontSize: 13, fontWeight: 500, color: c.ink3,
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  },
  srcBtnOn: { background: c.mintL, borderColor: c.mint, color: c.mintD, fontWeight: 600 },

  /* 2nd navbar — level */
  levelNav: {
    display: 'flex', gap: 4, padding: '6px 16px',
    overflowX: 'auto', scrollbarWidth: 'none',
    borderBottom: `1px solid ${c.border}`, background: c.white, flexShrink: 0,
  },
  levelBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: c.white, border: `1.5px solid ${c.border}`, borderRadius: 9,
    padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 12, fontWeight: 500, color: c.ink3, flexShrink: 0, lineHeight: 1.2,
  },
  levelBtnAll: { background: c.mintL, borderColor: c.mint, color: c.mintD, fontWeight: 700 },
  levelCount: { fontSize: 10, fontWeight: 400, opacity: 0.65, marginTop: 2 },

  /* 3rd navbar — alpha */
  letterNav: {
    display: 'flex', gap: 3, padding: '6px 16px',
    overflowX: 'auto', scrollbarWidth: 'none',
    borderBottom: `1px solid ${c.border}`, background: c.white, flexShrink: 0,
  },
  letterBtn: {
    background: 'transparent', border: `1px solid ${c.border}`, borderRadius: 6,
    padding: '4px 0', width: 26, minWidth: 26, fontSize: 11, fontWeight: 500,
    color: c.ink2, cursor: 'pointer', textAlign: 'center',
    fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.12s',
  },
  letterBtnOff: { color: c.ink3, opacity: 0.2, cursor: 'default', borderColor: 'transparent' },

  /* Content */
  content: { flex: 1, overflowY: 'auto', padding: '10px 16px' },

  /* Action row (above word grid) */
  actionRow: {
    display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center',
  },
  filterBtn: {
    background: c.white, border: `1px solid ${c.border}`, borderRadius: 7,
    padding: '5px 10px', fontSize: 11, color: c.ink3, cursor: 'pointer', fontFamily: 'inherit',
  },
  filterBtnOn: { background: c.roseL, borderColor: '#e05070', color: '#e05070' },
  actionBtn: {
    background: c.white, border: `1px solid ${c.border}`, borderRadius: 7,
    padding: '5px 10px', fontSize: 11, color: c.ink3, cursor: 'pointer',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  },

  /* Search */
  searchWrap: {
    display: 'flex', alignItems: 'center', flex: 1,
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8,
    padding: '0 8px', gap: 4, minWidth: 0,
  },
  searchIcon: { fontSize: 12, flexShrink: 0, opacity: 0.5 },
  searchInput: {
    background: 'transparent', border: 'none', outline: 'none',
    fontSize: 13, color: c.ink, fontFamily: 'inherit',
    flex: 1, padding: '6px 0', minWidth: 0,
  },
  clearSearch: {
    background: 'transparent', border: 'none', color: c.ink3,
    cursor: 'pointer', fontSize: 12, padding: '2px 0', flexShrink: 0,
  },

  /* Word table */
  table: { width: '100%', borderCollapse: 'collapse' },
  tableRow: {
    cursor: 'pointer', transition: 'background 0.1s',
    borderBottom: `1px solid ${c.border}`,
  },
  tableRowEven: { background: 'rgba(0,0,0,0.015)' },
  tableRowOn:   { background: '#e8faf5' },
  tdCheck: { width: 24, padding: '9px 6px 9px 0', fontSize: 11, fontWeight: 700, color: c.mintD, textAlign: 'center' },
  tdWord:  { padding: '9px 6px', fontSize: 13, fontWeight: 600, color: c.ink, direction: 'ltr', width: '38%' },
  tdTrans: { padding: '9px 6px', fontSize: 12, color: c.ink2, direction: 'rtl' },
  tdLevel: { padding: '9px 6px 9px 0', width: 36, textAlign: 'right' },
  levelBadge: {
    fontSize: 9, fontWeight: 700, padding: '2px 5px',
    borderRadius: 4, border: '1px solid', display: 'inline-block',
  },

  /* Random */
  centeredCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, gap: 20 },
  hintText: { fontSize: 13, color: c.ink3 },
  stepper: { display: 'flex', alignItems: 'center', gap: 14 },
  stepBtn: {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 7,
    width: 36, height: 36, cursor: 'pointer', fontSize: 22, color: c.ink2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
  },
  stepVal: { fontSize: 24, fontWeight: 700, color: c.ink, minWidth: 38, textAlign: 'center' },
  bigBtn: {
    background: c.mint, color: '#fff', border: 'none',
    borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  /* Manual */
  manualCol: { display: 'flex', flexDirection: 'column', gap: 12 },
  textarea: {
    background: c.surface, border: `1.5px solid ${c.border}`, borderRadius: 10,
    padding: 12, color: c.ink, fontSize: 13, lineHeight: 1.7,
    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
  },

  /* Start bar */
  startBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', borderTop: `1px solid ${c.border}`,
    background: c.white, gap: 10, flexShrink: 0, transition: 'opacity 0.2s',
  },
  startPreview: { display: 'flex', gap: 5, flex: 1, overflow: 'hidden', alignItems: 'center' },
  startChip: {
    background: c.mintL, color: c.mintD, borderRadius: 6,
    padding: '3px 8px', fontSize: 11, fontWeight: 500,
    whiteSpace: 'nowrap', direction: 'ltr',
  },
  startMore: { fontSize: 11, color: c.ink3, whiteSpace: 'nowrap' },
  startBtn: {
    background: c.mint, color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 16px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
  },
}
