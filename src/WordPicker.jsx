import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { useSession } from './SessionContext'

export const MIN_PICK = 4
const VALID_LEVELS = new Set(['A1','A2','B1','B2','C1','C2'])

const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  cream:'#faf8f4', surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  gold:'#e8a020', goldL:'#fff8e8',
  rose:'#e05070', roseL:'#fef0f3',
  sky:'#4080f0',  skyL:'#eef4ff',
  border:'rgba(0,0,0,0.08)',
}

const LEVEL_META = {
  A1: { label: 'מתחיל',      color: '#2ec4a0' },
  A2: { label: 'בסיסי',      color: '#2ec4a0' },
  B1: { label: 'בינוני',     color: '#4080f0' },
  B2: { label: 'עצמאי',      color: '#4080f0' },
  C1: { label: 'מתקדם',      color: '#7c3aed' },
  C2: { label: 'שליטה מלאה', color: '#7c3aed' },
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
  const [tab,      setTab]      = useState('mine')
  const [selected, setSelected] = useState([])

  const selectedKeys = new Set(selected.map(wordKey))
  const canStart     = selected.length >= MIN_PICK

  function replaceWith(words) { setSelected(words) }

  function toggleWord(w) {
    const key = wordKey(w)
    setSelected(prev =>
      selectedKeys.has(key) ? prev.filter(p => wordKey(p) !== key) : [...prev, w]
    )
  }

  const TABS = [
    { id: 'mine',   icon: '📚', label: 'שלי'    },
    { id: 'random', icon: '🎲', label: 'אקראי'  },
    { id: 'levels', icon: '🎯', label: 'רמות'   },
    { id: 'manual', icon: '✏️', label: 'ידני'   },
    { id: 'global', icon: '🌐', label: 'גלובלי' },
  ]

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <button style={s.cancelBtn} onClick={onCancel}>← חזור</button>
        <span style={s.headerTitle}>בחר מילים לתרגול</span>
        <span style={s.selCount}>{selected.length > 0 ? `${selected.length} ✓` : ''}</span>
      </div>

      {/* ── Tab bar ── */}
      <div style={s.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...s.tab, ...(tab === t.id ? s.tabOn : {}) }}
            onClick={() => setTab(t.id)}
          >
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={s.content}>
        {tab === 'mine'   && <MineTab   user={user} selectedKeys={selectedKeys} onToggle={toggleWord} onReplace={replaceWith} />}
        {tab === 'random' && <RandomTab user={user} wordCount={wordCount} setWordCount={setWordCount} onPick={replaceWith} />}
        {tab === 'levels' && <LevelsTab user={user} wordCount={wordCount} onPick={replaceWith} />}
        {tab === 'manual' && <ManualTab user={user} onPick={replaceWith} />}
        {tab === 'global' && <GlobalTab selectedKeys={selectedKeys} onToggle={toggleWord} onReplace={replaceWith} />}
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

/* ═══════════════════════════════════════════════════════════════════
   Tab: שלי — user's saved words
═══════════════════════════════════════════════════════════════════ */
function MineTab({ user, selectedKeys, onToggle, onReplace }) {
  const [words,   setWords]   = useState([])
  const [filter,  setFilter]  = useState('')
  const [subTab,  setSubTab]  = useState('all') // 'all' | 'wrong'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('user_words')
      .select('id, word, translation, level, wrong_count')
      .eq('user_id', user.id)
      .not('translation', 'is', null)
      .order('word')
      .then(({ data }) => { setWords(data ?? []); setLoading(false) })
  }, [])

  const base     = subTab === 'wrong' ? words.filter(w => (w.wrong_count ?? 0) > 0) : words
  const filtered = filter
    ? base.filter(w => w.word.toLowerCase().includes(filter.toLowerCase()))
    : base

  if (loading) return <CenteredMsg>טוען מילים...</CenteredMsg>
  if (!words.length) return <CenteredMsg>אין מילים — הוסף מילים בלשונית ״מילים״</CenteredMsg>

  return (
    <div>
      {/* Sub-filter */}
      <div style={s.subTabs}>
        <button style={{ ...s.subTab, ...(subTab === 'all'   ? s.subTabOn : {}) }} onClick={() => setSubTab('all')}>
          הכל ({words.length})
        </button>
        <button style={{ ...s.subTab, ...(subTab === 'wrong' ? s.subTabOn : {}) }} onClick={() => setSubTab('wrong')}>
          שגויות ({words.filter(w => (w.wrong_count ?? 0) > 0).length})
        </button>
      </div>

      {/* Search + actions */}
      <div style={s.searchRow}>
        <input
          style={s.searchInput}
          placeholder="🔍 חיפוש..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          dir="ltr"
        />
        <button style={s.actionBtn} onClick={() => onReplace(filtered)}>בחר הכל</button>
        <button style={s.actionBtn} onClick={() => onReplace([])}>נקה</button>
      </div>

      {/* Word chips */}
      {!filtered.length
        ? <CenteredMsg>אין תוצאות</CenteredMsg>
        : (
          <div style={s.wordGrid}>
            {filtered.map(w => {
              const on = selectedKeys.has(wordKey(w))
              return (
                <button
                  key={w.id}
                  style={{ ...s.wordChip, ...(on ? s.wordChipOn : {}) }}
                  onClick={() => onToggle(w)}
                >
                  <span style={s.chipWord}>{w.word}</span>
                  <span style={s.chipTrans}>{w.translation}</span>
                  {w.level && <span style={{ ...s.chipLevel, color: LEVEL_META[w.level]?.color ?? c.ink3 }}>{w.level}</span>}
                </button>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: אקראי — random pick
═══════════════════════════════════════════════════════════════════ */
function RandomTab({ user, wordCount, setWordCount, onPick }) {
  const [src,     setSrc]     = useState('own')
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')

  async function handlePick() {
    setLoading(true); setMsg('')
    let pool = []
    if (src === 'own') {
      const { data } = await supabase
        .from('user_words').select('id, word, translation, level')
        .eq('user_id', user.id).not('translation', 'is', null)
      pool = data ?? []
    } else {
      const { data } = await supabase
        .from('global_words').select('word, translation, level')
        .not('translation', 'is', null).limit(500)
      pool = data ?? []
    }
    const picked = shuffle(pool).slice(0, Math.min(wordCount, pool.length))
    setLoading(false)
    if (picked.length < MIN_PICK) { setMsg(`רק ${picked.length} מילים זמינות — צריך לפחות ${MIN_PICK}`); return }
    onPick(picked)
  }

  return (
    <div style={s.centeredCol}>
      {/* Source toggle */}
      <div style={s.srcToggle}>
        {[['own','📚 מהמאגר שלי'],['global','🌐 מאגר גלובלי']].map(([key, label]) => (
          <button
            key={key}
            style={{ ...s.srcBtn, ...(src === key ? s.srcBtnOn : {}) }}
            onClick={() => setSrc(key)}
          >{label}</button>
        ))}
      </div>

      {/* Count stepper */}
      <div style={s.stepperRow}>
        <span style={s.stepperLabel}>מספר מילים:</span>
        <div style={s.stepper}>
          <button style={s.stepBtn} onClick={() => setWordCount(Math.max(MIN_PICK, wordCount - 2))}>−</button>
          <span style={s.stepVal}>{wordCount}</span>
          <button style={s.stepBtn} onClick={() => setWordCount(Math.min(30, wordCount + 2))}>+</button>
        </div>
      </div>

      <button style={s.bigBtn} onClick={handlePick} disabled={loading}>
        {loading ? '...' : `✦ בחר ${wordCount} מילים אקראיות`}
      </button>
      {msg && <p style={{ color: c.rose, fontSize: 13, marginTop: 8 }}>{msg}</p>}
      {!loading && <p style={{ color: c.ink3, fontSize: 12, marginTop: 12 }}>המילים יופיעו בבר הירוק למטה — לחץ ״התחל״</p>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: רמות — by CEFR level
═══════════════════════════════════════════════════════════════════ */
function LevelsTab({ user, wordCount, onPick }) {
  const [counts,  setCounts]  = useState({})
  const [loading, setLoading] = useState(null) // level being loaded

  useEffect(() => {
    const levels = Object.keys(LEVEL_META)
    Promise.all(levels.map(l =>
      supabase.from('user_words')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('level', l)
        .not('translation', 'is', null)
    )).then(results => {
      const c = {}
      levels.forEach((l, i) => { c[l] = results[i].count ?? 0 })
      setCounts(c)
    })
  }, [])

  async function pickLevel(level) {
    setLoading(level)
    const { data } = await supabase
      .from('user_words')
      .select('id, word, translation, level')
      .eq('user_id', user.id).eq('level', level)
      .not('translation', 'is', null)
    const words = shuffle(data ?? []).slice(0, wordCount)
    setLoading(null)
    if (words.length < MIN_PICK) return
    onPick(words)
  }

  return (
    <div style={s.levelGrid}>
      {Object.entries(LEVEL_META).map(([level, { label, color }]) => {
        const count = counts[level] ?? '...'
        const hasEnough = (counts[level] ?? 0) >= MIN_PICK
        return (
          <button
            key={level}
            style={{ ...s.levelCard, opacity: hasEnough ? 1 : 0.4, cursor: hasEnough ? 'pointer' : 'default' }}
            onClick={() => hasEnough && pickLevel(level)}
            disabled={!hasEnough || loading === level}
          >
            <span style={{ ...s.levelCode, color }}>{level}</span>
            <span style={s.levelLabel}>{label}</span>
            <span style={s.levelCount}>
              {loading === level ? '...' : `${count} מילים`}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: ידני — type words manually
═══════════════════════════════════════════════════════════════════ */
function ManualTab({ user, onPick }) {
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState('')
  const [failed,  setFailed]  = useState([])
  const [error,   setError]   = useState('')

  async function handleStart() {
    const typed = [...new Set(
      input.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(Boolean)
    )]
    if (!typed.length) return
    setLoading(true); setFailed([]); setError(''); setStatus('מחפש מילים...')

    const { data: existing } = await supabase
      .from('user_words').select('id, word, translation, level, wrong_count')
      .eq('user_id', user.id).in('word', typed).not('translation', 'is', null)

    const existingSet = new Set((existing ?? []).map(w => w.word))
    const newWords    = typed.filter(w => !existingSet.has(w))
    let allWords      = [...(existing ?? [])]

    if (newWords.length > 0) {
      setStatus(`מתרגם ${newWords.length} מילים חדשות...`)
      const { data: enriched, error: fnErr } = await supabase.functions.invoke('enrich-words', {
        body: { words: newWords }
      })
      if (!fnErr && Array.isArray(enriched) && enriched.length) {
        const rows = enriched
          .filter(e => e.word && e.translation)
          .map(e => ({
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
          if (upserted?.length) allWords = [...allWords, ...upserted]
        }
        const enrichedSet = new Set(enriched.map(e => e.word?.toLowerCase()).filter(Boolean))
        setFailed(newWords.filter(w => !enrichedSet.has(w)))
      } else {
        setFailed(newWords)
      }
    }

    setLoading(false); setStatus('')
    if (allWords.length < MIN_PICK) { setError(`נמצאו רק ${allWords.length} מילים — צריך לפחות ${MIN_PICK}`); return }
    onPick(allWords)
  }

  return (
    <div style={s.manualCol}>
      <p style={s.manualHint}>הקלד מילים באנגלית — מופרדות בפסיק או שורה חדשה. מילים חדשות יתורגמו ויישמרו במאגר שלך.</p>
      <textarea
        style={s.textarea}
        placeholder="apple, universe, run, beautiful..."
        value={input}
        onChange={e => { setInput(e.target.value); setFailed([]); setError('') }}
        dir="ltr"
        rows={5}
      />
      {failed.length > 0 && (
        <p style={{ color: c.ink3, fontSize: 12, direction: 'ltr', textAlign: 'left' }}>
          לא זוהו: {failed.join(', ')}
        </p>
      )}
      {error && <p style={{ color: c.rose, fontSize: 13 }}>{error}</p>}
      <button
        style={{ ...s.bigBtn, opacity: input.trim() && !loading ? 1 : 0.45 }}
        onClick={handleStart}
        disabled={!input.trim() || loading}
      >
        {loading ? (status || 'טוען...') : 'תרגם והוסף'}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: גלובלי — global word bank
═══════════════════════════════════════════════════════════════════ */
const CEFR = ['A1','A2','B1','B2','C1','C2']

function GlobalTab({ selectedKeys, onToggle, onReplace }) {
  const [level,   setLevel]   = useState('B1')
  const [words,   setWords]   = useState([])
  const [filter,  setFilter]  = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true); setFilter('')
    supabase.from('global_words')
      .select('word, translation, level')
      .eq('level', level).not('translation', 'is', null)
      .order('word')
      .then(({ data }) => { setWords(data ?? []); setLoading(false) })
  }, [level])

  const filtered = filter
    ? words.filter(w => w.word.toLowerCase().startsWith(filter.toLowerCase()))
    : words

  const color = LEVEL_META[level]?.color ?? c.mint

  return (
    <div>
      {/* Level nav */}
      <div style={s.globalLevelNav}>
        {CEFR.map(lv => (
          <button
            key={lv}
            style={{
              ...s.globalLevelBtn,
              ...(lv === level ? { background: LEVEL_META[lv].color, color: '#fff', borderColor: LEVEL_META[lv].color } : {})
            }}
            onClick={() => setLevel(lv)}
          >{lv}</button>
        ))}
      </div>

      <div style={s.searchRow}>
        <input
          style={s.searchInput}
          placeholder="🔍 חיפוש..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          dir="ltr"
        />
        <button style={s.actionBtn} onClick={() => onReplace(filtered.slice(0, 20))}>בחר 20</button>
        <button style={s.actionBtn} onClick={() => onReplace([])}>נקה</button>
      </div>

      {loading
        ? <CenteredMsg>טוען...</CenteredMsg>
        : (
          <div style={s.wordGrid}>
            {filtered.map(w => {
              const key = w.word
              const on  = selectedKeys.has(key)
              return (
                <button
                  key={key}
                  style={{ ...s.wordChip, ...(on ? { ...s.wordChipOn, borderColor: color } : {}) }}
                  onClick={() => onToggle({ word: w.word, translation: w.translation, level: w.level })}
                >
                  <span style={s.chipWord}>{w.word}</span>
                  <span style={s.chipTrans}>{w.translation}</span>
                </button>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════════════════ */
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
    height: 'calc(100vh - 146px)', // full height minus topbar + bottomnav
    direction: 'rtl',
  },

  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: `1px solid ${c.border}`,
    flexShrink: 0,
  },
  cancelBtn: { background: 'transparent', border: 'none', color: c.ink3, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 },
  headerTitle: { fontSize: 14, fontWeight: 600, color: c.ink },
  selCount: { fontSize: 13, fontWeight: 600, color: c.mintD, minWidth: 40, textAlign: 'left' },

  tabBar: {
    display: 'flex', overflowX: 'auto', scrollbarWidth: 'none',
    gap: 4, padding: '8px 12px',
    borderBottom: `1px solid ${c.border}`, background: c.white,
    flexShrink: 0,
  },
  tab: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'transparent', border: `1px solid ${c.border}`,
    borderRadius: 9, padding: '6px 12px', cursor: 'pointer',
    fontSize: 11, fontWeight: 500, color: c.ink3, whiteSpace: 'nowrap',
    fontFamily: 'inherit', flexShrink: 0,
  },
  tabOn: { background: c.mintL, borderColor: c.mint, color: c.mintD },

  content: {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
  },

  // Start bar
  startBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', borderTop: `1px solid ${c.border}`,
    background: c.white, gap: 10, flexShrink: 0,
    transition: 'opacity 0.2s',
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

  // Shared: sub-tabs
  subTabs: { display: 'flex', gap: 6, marginBottom: 10 },
  subTab: {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 7,
    padding: '5px 12px', fontSize: 12, color: c.ink3, cursor: 'pointer', fontFamily: 'inherit',
  },
  subTabOn: { background: c.mintL, borderColor: c.mint, color: c.mintD, fontWeight: 500 },

  // Search + actions
  searchRow: { display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' },
  searchInput: {
    flex: 1, background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: 8, padding: '7px 10px', fontSize: 13, color: c.ink,
    outline: 'none', fontFamily: 'inherit',
  },
  actionBtn: {
    background: c.white, border: `1px solid ${c.border}`, borderRadius: 7,
    padding: '5px 10px', fontSize: 11, color: c.ink3, cursor: 'pointer',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  },

  // Word chips grid
  wordGrid: { display: 'flex', flexWrap: 'wrap', gap: 7 },
  wordChip: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    background: c.white, border: `1.5px solid ${c.border}`,
    borderRadius: 10, padding: '7px 11px',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
  },
  wordChipOn: { background: c.mintL, borderColor: c.mint },
  chipWord:  { fontSize: 13, fontWeight: 600, color: c.ink, direction: 'ltr' },
  chipTrans: { fontSize: 10, color: c.ink3, marginTop: 2 },
  chipLevel: { fontSize: 9, fontWeight: 600, marginTop: 1 },

  // Random tab
  centeredCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 24, gap: 16 },
  srcToggle: { display: 'flex', gap: 8 },
  srcBtn: {
    background: c.white, border: `1.5px solid ${c.border}`, borderRadius: 10,
    padding: '10px 16px', fontSize: 13, color: c.ink2, cursor: 'pointer', fontFamily: 'inherit',
  },
  srcBtnOn: { background: c.mintL, borderColor: c.mint, color: c.mintD, fontWeight: 500 },
  stepperRow: { display: 'flex', alignItems: 'center', gap: 12 },
  stepperLabel: { fontSize: 13, color: c.ink3 },
  stepper: { display: 'flex', alignItems: 'center', gap: 10 },
  stepBtn: {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 7,
    width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: c.ink2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
  },
  stepVal: { fontSize: 18, fontWeight: 700, color: c.ink, minWidth: 32, textAlign: 'center' },
  bigBtn: {
    background: c.mint, color: '#fff', border: 'none',
    borderRadius: 12, padding: '13px 24px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  // Levels tab
  levelGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  levelCard: {
    background: c.white, border: `1px solid ${c.border}`, borderRadius: 14,
    padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    fontFamily: 'inherit',
  },
  levelCode:  { fontSize: 26, fontWeight: 700 },
  levelLabel: { fontSize: 12, color: c.ink3 },
  levelCount: { fontSize: 11, color: c.ink3, marginTop: 2 },

  // Manual tab
  manualCol: { display: 'flex', flexDirection: 'column', gap: 12 },
  manualHint: { fontSize: 12, color: c.ink3, lineHeight: 1.5 },
  textarea: {
    background: c.surface, border: `1.5px solid ${c.border}`, borderRadius: 10,
    padding: 12, color: c.ink, fontSize: 13, lineHeight: 1.7,
    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
  },

  // Global tab
  globalLevelNav: { display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' },
  globalLevelBtn: {
    background: c.white, border: `1.5px solid ${c.border}`, borderRadius: 8,
    padding: '5px 12px', fontSize: 13, fontWeight: 500, color: c.ink3,
    cursor: 'pointer', fontFamily: 'inherit',
  },
}
