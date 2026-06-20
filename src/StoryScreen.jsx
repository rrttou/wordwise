import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const MIN_WORDS = 4
const MAX_WORDS = 8
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  cream:'#faf8f4', surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  gold:'#e8a020', goldL:'#fff8e8',
  rose:'#e05070', roseL:'#fef0f3',
  sky:'#4080f0',  skyL:'#eef4ff',
  border:'rgba(0,0,0,0.08)',
}

/* ─── Hoverable word ─────────────────────────────────────────────── */
function HoverWord({ word, translation, highlighted }) {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline' }}
      onMouseEnter={() => translation && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {highlighted
        ? <mark style={s.highlight}>{word}</mark>
        : <span style={translation ? { cursor: 'help' } : undefined}>{word}</span>
      }
      {show && translation && <span style={s.tooltip}>{translation}</span>}
    </span>
  )
}

/* ─── Story text with hover translations ─────────────────────────── */
function StoryText({ text, selectedWords, translationMap }) {
  const selectedSet = new Set(selectedWords.map(w => w.toLowerCase()))
  const tokens = text.split(/(\b[a-zA-Z']+\b)/)
  return (
    <p style={s.storyPara} dir="ltr">
      {tokens.map((token, i) => {
        const lower = token.toLowerCase()
        const highlighted = selectedSet.has(lower)
        if (highlighted) {
          return <HoverWord key={i} word={token} translation={translationMap[lower]} highlighted />
        }
        return token
      })}
    </p>
  )
}

/* ─── Main ───────────────────────────────────────────────────────── */
export default function StoryScreen({ user, onBack, initialWords }) {
  const [bank, setBank]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [mode, setMode]         = useState('pick')
  const [levelFilter, setLevel] = useState('all')
  const [selected, setSelected] = useState(() =>
    initialWords?.length ? initialWords.map(w => typeof w === 'string' ? w : w.word) : []
  )
  const [typeInput, setInput]   = useState('')
  const [story, setStory]       = useState('')
  const [generating, setGen]    = useState(false)
  const [error, setError]       = useState('')
  const [wordModal, setWordModal]   = useState(false)
  const [search, setSearch]         = useState('')
  const [bankSource, setBankSource] = useState('own')

  const translationMap = Object.fromEntries(
    bank.filter(w => w.translation).map(w => [w.word.toLowerCase(), w.translation])
  )

  const filteredBank = levelFilter === 'all'
    ? bank
    : bank.filter(w => w.level === levelFilter)

  const typeWords = [...new Set(
    typeInput.toLowerCase().split(/[\n,]+/).map(w => w.trim()).filter(Boolean)
  )]

  const wordsToUse  = mode === 'type' ? typeWords : selected
  const canGenerate = wordsToUse.length >= MIN_WORDS && !generating

  useEffect(() => { loadBank(bankSource) }, [bankSource])

  async function loadBank(src) {
    setLoading(true)
    if (!initialWords?.length) setSelected([])
    setStory('')
    setError('')
    if (src === 'global') {
      const { data: profile } = await supabase
        .from('profiles').select('current_level').eq('id', user.id).single()
      const userLevel = profile?.current_level ?? 'B1'
      setLevel(userLevel)
      const { data } = await supabase
        .from('global_words')
        .select('word, translation, level')
        .not('translation', 'is', null)
        .limit(1000)
      setBank(data || [])
    } else {
      const { data } = await supabase
        .from('user_words')
        .select('word, translation, level, story_count')
        .order('created_at', { ascending: false })
      setBank(data || [])
    }
    setLoading(false)
  }

  function toggle(word) {
    setSelected(prev =>
      prev.includes(word)
        ? prev.filter(w => w !== word)
        : prev.length < MAX_WORDS ? [...prev, word] : prev
    )
  }

  function pickRandom() {
    const pool = filteredBank.map(r => r.word)
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    setSelected(shuffled.slice(0, MAX_WORDS))
    setStory(''); setError('')
  }

  async function generate() {
    if (wordsToUse.length < MIN_WORDS) return

    // Weave in 2-5 previously used story words not in current selection
    const selSet = new Set(wordsToUse.map(w => w.toLowerCase()))
    const reviewWords = bank
      .filter(w => w.story_count > 0 && !selSet.has(w.word.toLowerCase()))
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)
      .map(w => w.word)

    setGen(true); setError(''); setStory('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-story', {
        body: { words: wordsToUse, reviewWords },
      })
      if (fnErr) {
        const detail = fnErr.context ? await fnErr.context.text().catch(() => '') : ''
        throw new Error(detail || fnErr.message)
      }
      if (data?.error) throw new Error(data.error)
      if (!data?.story) throw new Error('Empty response: ' + JSON.stringify(data))
      setStory(data.story)

      // Increment story_count for words that are in the bank
      const bankMap = Object.fromEntries(bank.map(b => [b.word.toLowerCase(), b]))
      await Promise.all(
        wordsToUse
          .map(w => bankMap[w.toLowerCase()])
          .filter(Boolean)
          .map(entry =>
            supabase.from('user_words')
              .update({ story_count: entry.story_count + 1 })
              .eq('user_id', user.id)
              .eq('word', entry.word)
          )
      )
      loadBank()
    } catch (e) {
      setError('שגיאה: ' + e.message)
    }
    setGen(false)
  }

  if (loading) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <div style={s.ring} />
      <p style={{ color: c.ink3, marginTop: 16, fontSize: 13 }}>טוען מאגר מילים...</p>
    </div>
  )

  if (bank.length < MIN_WORDS) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>📚</div>
      <h2 style={s.pageTitle}>המאגר ריק מדי</h2>
      <p style={{ color: c.ink3, fontSize: 13, marginTop: 8 }}>
        צריך לפחות {MIN_WORDS} מילים — עבור ללשונית ״מילים״ והוסף מילים תחילה
      </p>
      {onBack && <button style={{ ...s.backBtn, marginTop: 20 }} onClick={onBack}>← חזור</button>}
    </div>
  )

  return (
    <div style={s.wrap}>
      {onBack && <button style={s.backBtn} onClick={onBack}>✕ הפסק תרגול</button>}

      <div style={s.pageHeader}>
        <h2 style={s.pageTitle}>סיפור מותאם אישית</h2>
        <p style={s.pageSub}>בחר {MIN_WORDS}–{MAX_WORDS} מילים וקבל סיפור שנכתב בשבילך</p>
      </div>

      {/* Bank source toggle */}
      <div style={s.sourceToggle}>
        {[['own', '📚 המילים שלי'], ['global', '🌍 מאגר עולמי']].map(([key, label]) => (
          <button
            key={key}
            style={{ ...s.sourceToggleBtn, ...(bankSource === key ? s.sourceToggleBtnOn : {}) }}
            onClick={() => setBankSource(key)}
          >{label}</button>
        ))}
      </div>

      {/* Action row: choose words + create story */}
      <div style={s.actionRow}>
        <button style={s.chooseBtn} onClick={() => setWordModal(true)}>
          📋 {selected.length > 0 ? `${selected.length}/${MAX_WORDS} מילים נבחרו` : 'בחר מילים'}
        </button>
        <button
          style={{ ...s.generateBtn, opacity: canGenerate ? 1 : 0.5 }}
          onClick={generate}
          disabled={!canGenerate}
        >
          {generating
            ? <span style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}><span style={s.ringSmall} />כותב...</span>
            : '✦ צור סיפור'}
        </button>
      </div>

      {/* Type mode toggle */}
      <button
        style={{ ...s.typeToggle, ...(mode === 'type' ? s.typeToggleOn : {}) }}
        onClick={() => { setMode(m => m === 'type' ? 'pick' : 'type'); setStory(''); setError('') }}
      >⌨️ הזן מילים ידנית</button>

      {mode === 'type' && (
        <div style={s.typeCard}>
          <textarea
            style={s.typeArea}
            placeholder={`הקלד ${MIN_WORDS}–${MAX_WORDS} מילים באנגלית, מופרדות בפסיק...\napple, house, beautiful, run`}
            value={typeInput}
            onChange={e => { setInput(e.target.value); setStory(''); setError('') }}
            dir="ltr"
            rows={4}
          />
          {typeWords.length > 0 && (
            <p style={{ fontSize: 12, color: c.ink3, marginTop: 6 }}>
              {typeWords.length} מילים{typeWords.length < MIN_WORDS ? ` — צריך לפחות ${MIN_WORDS}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Word picker modal */}
      {wordModal && (
        <div style={s.overlay} onClick={() => setWordModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <span style={s.modalTitle}>בחר מילים ({selected.length}/{MAX_WORDS})</span>
              <button style={s.modalClose} onClick={() => setWordModal(false)}>✕</button>
            </div>
            <div style={s.levelPills}>
              <button style={{ ...s.levelPill, ...(levelFilter === 'all' ? s.levelPillOn : {}) }} onClick={() => setLevel('all')}>הכל</button>
              {LEVELS.map(lv => {
                const count = bank.filter(w => w.level === lv).length
                return (
                  <button key={lv}
                    style={{ ...s.levelPill, ...(levelFilter === lv ? s.levelPillOn : {}), ...(count === 0 ? { opacity: 0.35 } : {}) }}
                    onClick={() => count > 0 && setLevel(lv)} disabled={count === 0}
                  >{lv}</button>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <input style={s.modalSearch} placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} dir="ltr" />
              <button style={s.randomBtn} onClick={() => { pickRandom(); setWordModal(false) }}>✦ אקראי</button>
            </div>
            <div style={s.modalBody}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th} />
                    <th style={s.th}>מילה</th>
                    <th style={s.th}>תרגום</th>
                    <th style={{ ...s.th, textAlign:'center' }}>רמה</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBank
                    .filter(w => !search || w.word.toLowerCase().includes(search.toLowerCase()))
                    .map(({ word, translation, level }) => {
                      const on = selected.includes(word)
                      const maxed = selected.length >= MAX_WORDS && !on
                      return (
                        <tr key={word}
                          style={{ ...s.tr, opacity: maxed ? 0.4 : 1, cursor: maxed ? 'default' : 'pointer' }}
                          onClick={() => !maxed && toggle(word)}>
                          <td style={s.td}><span style={{ ...s.checkbox, ...(on ? s.checkboxOn : {}) }}>{on ? '✓' : ''}</span></td>
                          <td style={{ ...s.td, direction:'ltr', fontWeight: on ? 600 : 400, color: on ? c.mintD : c.ink }}>{word}</td>
                          <td style={{ ...s.td, color:c.ink2, fontSize:12 }}>{translation || '—'}</td>
                          <td style={{ ...s.td, textAlign:'center' }}>
                            {level && <span style={{ ...s.levelBadge, ...getLevelStyle(level) }}>{level}</span>}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            <button
              style={{ ...s.modalConfirm, opacity: selected.length >= MIN_WORDS ? 1 : 0.5 }}
              onClick={() => setWordModal(false)}
            >
              {selected.length >= MIN_WORDS ? `✓ אשר (${selected.length} מילים)` : `בחר עוד ${MIN_WORDS - selected.length} לפחות`}
            </button>
          </div>
        </div>
      )}

      {error && <p style={s.errMsg}>{error}</p>}

      {/* Story */}
      {story && (
        <div style={s.storyCard}>
          <div style={s.storyHeader}>
            <span style={s.storyLabel}>הסיפור שלך</span>
            <button style={s.regenBtn} onClick={generate} disabled={generating}>
              {generating ? '...' : '↺ צור שוב'}
            </button>
          </div>

          <StoryText
            text={story}
            selectedWords={wordsToUse}
            translationMap={translationMap}
          />

          <div style={s.usedWords}>
            {wordsToUse.map(w => (
              <span key={w} style={s.usedChip}>{w}</span>
            ))}
          </div>

          <p style={s.hoverHint}>עבור עם העכבר על מילה לתרגום</p>
        </div>
      )}
    </div>
  )
}

function getLevelStyle(level) {
  if (level === 'A1' || level === 'A2') return { background: '#e8faf5', color: '#1a9e80', borderColor: '#2ec4a0' }
  if (level === 'B1' || level === 'B2') return { background: '#eef4ff', color: '#4080f0', borderColor: '#4080f0' }
  return { background: '#f3e8ff', color: '#7c3aed', borderColor: '#c4b5fd' }
}
/* ─── Styles ─────────────────────────────────────────────────────── */
const s = {
  wrap: { maxWidth: 420, margin: '0 auto', padding: '20px 16px 32px', direction: 'rtl' },
  pageHeader: { textAlign: 'center', marginBottom: 20 },
  pageTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 26, fontWeight: 600, color: c.ink, marginBottom: 6,
  },
  pageSub: { fontSize: 13, color: c.ink3 },
  backBtn: {
    background: c.surface,
    border: '1.5px solid rgba(0,0,0,0.08)',
    borderRadius: 8,
    color: '#4a4a6a',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 12px',
    fontFamily: 'inherit',
    marginBottom: 16,
    display: 'inline-block',
  },

  /* source toggle */
  sourceToggle: {
    display:'flex', gap:6, marginBottom:12,
    background:c.surface, borderRadius:10, padding:4,
  },
  sourceToggleBtn: {
    flex:1, padding:'8px', borderRadius:8, border:'none',
    background:'transparent', color:c.ink3, cursor:'pointer',
    fontSize:13, fontFamily:'inherit', fontWeight:500,
  },
  sourceToggleBtnOn: {
    background:c.white, color:c.ink,
    boxShadow:'0 1px 4px rgba(0,0,0,0.08)',
  },
  /* action row */
  actionRow: { display:'flex', gap:8, marginBottom:10 },
  chooseBtn: {
    flex:1, background:c.white, border:`1.5px solid ${c.mint}`,
    borderRadius:10, padding:'11px 10px', fontSize:13,
    color:c.mintD, cursor:'pointer', fontFamily:'inherit', fontWeight:500,
  },
  typeToggle: {
    display:'block', width:'100%', background:'transparent',
    border:`1px solid ${c.border}`, borderRadius:8,
    padding:'7px', fontSize:12, color:c.ink3, cursor:'pointer',
    fontFamily:'inherit', marginBottom:10, textAlign:'center', boxSizing:'border-box',
  },
  typeToggleOn: { background:c.skyL, borderColor:c.sky, color:c.sky },

  /* modal */
  overlay: {
    position:'fixed', top:0, left:0, right:0, bottom:0,
    background:'rgba(0,0,0,0.45)', zIndex:100,
    display:'flex', alignItems:'center', justifyContent:'center', padding:'0 16px',
  },
  modal: {
    background:c.white, borderRadius:16,
    padding:'20px 16px 24px', width:'100%', maxWidth:440,
    maxHeight:'84vh', display:'flex', flexDirection:'column', boxSizing:'border-box',
  },
  modalHead: {
    display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14,
  },
  modalTitle: { fontSize:16, fontWeight:600, color:c.ink },
  modalClose: {
    background:'transparent', border:'none', fontSize:20,
    color:c.ink3, cursor:'pointer', padding:0, lineHeight:1, fontFamily:'inherit',
  },
  modalSearch: {
    flex:1, background:c.surface, border:`1.5px solid ${c.border}`,
    borderRadius:8, padding:'8px 12px', fontSize:13, color:c.ink,
    outline:'none', fontFamily:'inherit', direction:'ltr',
  },
  modalBody: { flex:1, overflowY:'auto', marginBottom:12 },
  modalConfirm: {
    background:c.mint, color:'#fff', border:'none', borderRadius:10,
    padding:'13px', fontSize:14, fontWeight:500,
    cursor:'pointer', width:'100%', fontFamily:'inherit', marginTop:4,
  },

  /* table */
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: {
    textAlign:'right', padding:'7px 10px', fontSize:11,
    color:c.ink3, borderBottom:`2px solid ${c.border}`, fontWeight:500,
  },
  tr: { borderBottom:`1px solid ${c.border}` },
  td: { padding:'9px 10px', verticalAlign:'middle' },
  checkbox: {
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    width:18, height:18, border:`1.5px solid ${c.border}`,
    borderRadius:4, fontSize:11, color:'transparent', flexShrink:0,
  },
  checkboxOn: { background:c.mint, borderColor:c.mint, color:'#fff' },
  levelBadge: {
    display:'inline-block', padding:'2px 7px',
    borderRadius:6, fontSize:11, fontWeight:600, border:'1px solid',
  },

  /* level pills (inside modal) */
  levelPills: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  levelPill: {
    padding: '4px 10px', borderRadius: 20, border: `1px solid ${c.border}`,
    background: c.white, color: c.ink3, cursor: 'pointer',
    fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
  },
  levelPillOn: { background: c.ink, color: '#fff', borderColor: c.ink },
  randomBtn: {
    background: c.skyL, border: `1px solid ${c.sky}`, borderRadius: 8, color: c.sky,
    cursor: 'pointer', fontSize: 12, fontWeight: 500,
    padding: '6px 12px', fontFamily: 'inherit', whiteSpace:'nowrap',
  },

  /* type mode */
  typeCard: {
    background: c.white, border: `1px solid ${c.border}`,
    borderRadius: 14, padding: 16, marginBottom: 14,
  },
  typeArea: {
    width: '100%', boxSizing: 'border-box',
    background: c.surface, border: `1.5px solid ${c.border}`,
    borderRadius: 10, padding: 12, color: c.ink,
    fontSize: 14, lineHeight: 1.7, resize: 'vertical',
    outline: 'none', fontFamily: 'inherit', direction: 'ltr',
  },

  /* generate */
  generateBtn: {
    background: c.mint, color: '#fff', border: 'none',
    borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', flex:1, fontFamily: 'inherit', transition: 'opacity 0.2s',
  },
  errMsg: { color: c.rose, fontSize: 13, textAlign: 'center', marginBottom: 12 },

  /* story card */
  storyCard: {
    background: c.white, border: `1px solid ${c.border}`,
    borderRadius: 14, padding: '20px 18px',
  },
  storyHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14, direction: 'rtl',
  },
  storyLabel: {
    fontSize: 11, fontWeight: 500, letterSpacing: '1.2px',
    textTransform: 'uppercase', color: c.ink3,
  },
  regenBtn: {
    background: 'transparent', border: `1px solid ${c.border}`,
    borderRadius: 8, color: c.ink3, cursor: 'pointer',
    fontSize: 12, padding: '5px 10px', fontFamily: 'inherit',
  },
  storyPara: {
    fontSize: 15, lineHeight: 1.9, color: c.ink,
    margin: '0 0 16px 0', textAlign: 'left',
  },

  /* word highlighting */
  highlight: {
    background: c.goldL, color: '#b87800',
    borderRadius: 3, padding: '1px 2px',
    fontWeight: 600, fontStyle: 'normal', cursor: 'help',
  },
  translatable: {
    background: 'transparent', color: 'inherit',
    borderBottom: `1px dashed ${c.sky}`,
    borderRadius: 0, padding: '0 1px',
    fontWeight: 'normal', fontStyle: 'normal', cursor: 'help',
  },

  /* tooltip */
  tooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 4px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: c.ink,
    color: '#fff',
    borderRadius: 6,
    padding: '4px 9px',
    fontSize: 12,
    whiteSpace: 'nowrap',
    zIndex: 10,
    pointerEvents: 'none',
    direction: 'rtl',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
  },

  usedWords: {
    display: 'flex', flexWrap: 'wrap', gap: 5,
    paddingTop: 12, borderTop: `1px solid ${c.border}`,
    direction: 'ltr',
  },
  usedChip: {
    background: c.goldL, border: '1px solid #f0d090',
    borderRadius: 6, padding: '2px 8px',
    fontSize: 11, color: '#b87800', fontWeight: 500,
  },
  hoverHint: {
    fontSize: 11, color: c.ink3, textAlign: 'center',
    marginTop: 10, marginBottom: 0, direction: 'rtl',
  },

  ring: {
    width: 36, height: 36,
    border: `3px solid ${c.mintL}`, borderTop: `3px solid ${c.mint}`,
    borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },
  ringSmall: {
    width: 14, height: 14,
    border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
}
