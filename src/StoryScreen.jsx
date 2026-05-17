import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const MIN_WORDS = 4
const MAX_WORDS = 8

/* ─── Tokens (match App.jsx) ─────────────────────────────────────── */
const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  cream:'#faf8f4', surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  gold:'#e8a020', goldL:'#fff8e8',
  rose:'#e05070', roseL:'#fef0f3',
  sky:'#4080f0',  skyL:'#eef4ff',
  border:'rgba(0,0,0,0.08)',
}

async function callGemini(words) {
  const { data, error } = await supabase.functions.invoke('generate-story', {
    body: { words },
  })
  if (error) throw new Error(error.message)
  if (!data?.story) throw new Error('Empty response from server')
  return data.story
}

function StoryText({ text, words }) {
  const wordSet = new Set(words.map(w => w.toLowerCase()))
  const tokens = text.split(/(\b[a-zA-Z']+\b)/)
  return (
    <p style={s.storyPara} dir="ltr">
      {tokens.map((token, i) =>
        wordSet.has(token.toLowerCase())
          ? <mark key={i} style={s.highlight}>{token}</mark>
          : token
      )}
    </p>
  )
}

export default function StoryScreen({ user }) {
  const [bank, setBank]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState([])
  const [story, setStory]       = useState('')
  const [generating, setGen]    = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { loadBank() }, [])

  async function loadBank() {
    setLoading(true)
    const { data } = await supabase
      .from('user_words')
      .select('word')
      .order('created_at', { ascending: false })
    setBank((data || []).map(r => r.word))
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
    const shuffled = [...bank].sort(() => Math.random() - 0.5)
    setSelected(shuffled.slice(0, MAX_WORDS))
    setStory('')
    setError('')
  }

  async function generate() {
    if (selected.length < MIN_WORDS) return
    setGen(true); setError(''); setStory('')
    try {
      const text = await callGemini(selected)
      setStory(text)
    } catch (e) {
      setError('שגיאה ביצירת הסיפור. בדוק שה-API key תקין.')
    }
    setGen(false)
  }

  const canGenerate = selected.length >= MIN_WORDS && !generating

  if (loading) {
    return (
      <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
        <div style={s.ring} />
        <p style={{ color: c.ink3, marginTop: 16, fontSize: 13 }}>טוען מאגר מילים...</p>
      </div>
    )
  }

  if (bank.length < MIN_WORDS) {
    return (
      <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📚</div>
        <h2 style={s.pageTitle}>המאגר ריק מדי</h2>
        <p style={{ color: c.ink3, fontSize: 13, marginTop: 8 }}>
          צריך לפחות {MIN_WORDS} מילים — עבור ללשונית "מילים" והוסף מילים תחילה
        </p>
      </div>
    )
  }

  return (
    <div style={s.wrap}>

      {/* Header */}
      <div style={s.pageHeader}>
        <h2 style={s.pageTitle}>סיפור מותאם אישית</h2>
        <p style={s.pageSub}>בחר {MIN_WORDS}–{MAX_WORDS} מילים וקבל סיפור שנכתב בשבילך</p>
      </div>

      {/* Word picker */}
      <div style={s.pickerCard}>
        <div style={s.pickerHead}>
          <span style={s.pickerLabel}>
            {selected.length > 0
              ? `${selected.length}/${MAX_WORDS} נבחרו`
              : 'בחר מילים'}
          </span>
          <button style={s.randomBtn} onClick={pickRandom}>
            ✦ בחר אקראי
          </button>
        </div>

        <div style={s.chips}>
          {bank.map(word => {
            const on = selected.includes(word)
            const maxed = selected.length >= MAX_WORDS && !on
            return (
              <button
                key={word}
                style={{ ...s.chip, ...(on ? s.chipOn : {}), ...(maxed ? s.chipDim : {}) }}
                onClick={() => !maxed && toggle(word)}
                disabled={maxed}
              >
                {word}
              </button>
            )
          })}
        </div>

        {selected.length > 0 && selected.length < MIN_WORDS && (
          <p style={s.hint}>בחר עוד {MIN_WORDS - selected.length} מילים לפחות</p>
        )}
      </div>

      {/* Generate button */}
      <button
        style={{ ...s.generateBtn, opacity: canGenerate ? 1 : 0.5 }}
        onClick={generate}
        disabled={!canGenerate}
      >
        {generating ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <span style={s.ringSmall} /> כותב סיפור...
          </span>
        ) : (
          '✦ צור סיפור'
        )}
      </button>

      {/* Error */}
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

          <StoryText text={story} words={selected} />

          <div style={s.usedWords}>
            {selected.map(w => (
              <span key={w} style={s.usedChip}>{w}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = {
  wrap: {
    maxWidth: 420,
    margin: '0 auto',
    padding: '20px 16px 32px',
    direction: 'rtl',
  },
  pageHeader: { textAlign: 'center', marginBottom: 20 },
  pageTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 26,
    fontWeight: 600,
    color: c.ink,
    marginBottom: 6,
  },
  pageSub: { fontSize: 13, color: c.ink3 },

  pickerCard: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    padding: '16px',
    marginBottom: 14,
  },
  pickerHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pickerLabel: { fontSize: 13, fontWeight: 500, color: c.ink2 },
  randomBtn: {
    background: c.skyL,
    border: `1px solid ${c.sky}`,
    borderRadius: 8,
    color: c.sky,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 12px',
    fontFamily: 'inherit',
  },

  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, direction: 'ltr' },
  chip: {
    background: c.surface,
    border: `1.5px solid ${c.border}`,
    borderRadius: 8,
    padding: '5px 11px',
    fontSize: 13,
    color: c.ink2,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  chipOn: {
    background: c.mintL,
    border: `1.5px solid ${c.mint}`,
    color: c.mintD,
    fontWeight: 500,
  },
  chipDim: { opacity: 0.35, cursor: 'default' },

  hint: { fontSize: 12, color: c.ink3, textAlign: 'center', marginTop: 12 },

  generateBtn: {
    background: c.mint,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '15px',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'inherit',
    marginBottom: 16,
    transition: 'opacity 0.2s',
  },

  errMsg: { color: c.rose, fontSize: 13, textAlign: 'center', marginBottom: 12 },

  storyCard: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    padding: '20px 18px',
  },
  storyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    direction: 'rtl',
  },
  storyLabel: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    color: c.ink3,
  },
  regenBtn: {
    background: 'transparent',
    border: `1px solid ${c.border}`,
    borderRadius: 8,
    color: c.ink3,
    cursor: 'pointer',
    fontSize: 12,
    padding: '5px 10px',
    fontFamily: 'inherit',
  },

  storyPara: {
    fontSize: 15,
    lineHeight: 1.8,
    color: c.ink,
    margin: '0 0 16px 0',
    textAlign: 'left',
  },
  highlight: {
    background: c.goldL,
    color: '#b87800',
    borderRadius: 3,
    padding: '1px 2px',
    fontWeight: 600,
    fontStyle: 'normal',
  },

  usedWords: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    paddingTop: 12,
    borderTop: `1px solid ${c.border}`,
    direction: 'ltr',
  },
  usedChip: {
    background: c.goldL,
    border: '1px solid #f0d090',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    color: '#b87800',
    fontWeight: 500,
  },

  ring: {
    width: 36,
    height: 36,
    border: `3px solid ${c.mintL}`,
    borderTop: `3px solid ${c.mint}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  ringSmall: {
    width: 14,
    height: 14,
    border: `2px solid rgba(255,255,255,0.4)`,
    borderTop: `2px solid #fff`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
}
