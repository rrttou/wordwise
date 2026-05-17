import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const QUESTIONS_PER_LEVEL = 3

const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  cream:'#faf8f4', surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  rose:'#e05070', roseL:'#fef0f3',
  border:'rgba(0,0,0,0.08)',
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function calcLevel(answers) {
  const byLevel = {}
  for (const level of LEVELS) {
    const la = answers.filter(a => a.level === level)
    byLevel[level] = la.length ? la.filter(a => a.correct).length / la.length : 0
  }
  let assigned = 'A1'
  for (const level of LEVELS) {
    if (byLevel[level] >= 0.5) assigned = level
    else break
  }
  return assigned
}

export default function PlacementTestScreen({ user, onComplete }) {
  const [questions, setQuestions]   = useState([])
  const [current, setCurrent]       = useState(0)
  const [answers, setAnswers]       = useState([])
  const [chosen, setChosen]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => { buildQuestions() }, [])

  async function buildQuestions() {
    try {
      const built = []
      for (const level of LEVELS) {
        const { data } = await supabase
          .from('global_words')
          .select('id, word, translation')
          .eq('level', level)
          .not('translation', 'is', null)
          .limit(QUESTIONS_PER_LEVEL + 12)

        if (!data || data.length < 4) continue

        const pool = shuffle(data)
        const qWords = pool.slice(0, QUESTIONS_PER_LEVEL)
        const dPool  = pool.slice(QUESTIONS_PER_LEVEL)

        for (const w of qWords) {
          const distractors = dPool.filter(d => d.id !== w.id).slice(0, 3)
          if (distractors.length < 3) continue
          built.push({
            word: w.word,
            level,
            options: shuffle([
              { text: w.translation, correct: true },
              ...distractors.map(d => ({ text: d.translation, correct: false })),
            ]),
          })
        }
      }
      setQuestions(shuffle(built))
    } catch {
      setError('שגיאה בטעינת המבחן')
    }
    setLoading(false)
  }

  function handleAnswer(idx) {
    if (chosen !== null) return
    const q = questions[current]
    const isCorrect = q.options[idx].correct
    setChosen(idx)

    setTimeout(() => {
      const updated = [...answers, { level: q.level, correct: isCorrect }]
      setAnswers(updated)
      setChosen(null)
      if (current + 1 < questions.length) {
        setCurrent(n => n + 1)
      } else {
        submitResults(updated)
      }
    }, 700)
  }

  async function submitResults(allAnswers) {
    setSubmitting(true)
    const level = calcLevel(allAnswers)
    const score = Math.round(allAnswers.filter(a => a.correct).length / allAnswers.length * 100)
    await Promise.all([
      supabase.from('user_tests').insert({
        user_id: user.id,
        test_type: 'placement',
        score_percentage: score,
        assigned_level: level,
      }),
      supabase.from('profiles')
        .update({ current_level: level, is_tested: true })
        .eq('id', user.id),
    ])
    onComplete(level)
  }

  /* ── loading states ── */
  if (loading) return <Spinner label="מכין את המבחן..." />
  if (submitting) return <Spinner label="מחשב את הרמה שלך..." />
  if (error) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <p style={{ color: c.rose }}>{error}</p>
    </div>
  )
  if (!questions.length) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <p style={{ color: c.ink3, fontSize: 14 }}>אין מספיק מילים בבסיס הנתונים</p>
    </div>
  )

  const q        = questions[current]
  const progress = (current / questions.length) * 100

  return (
    <div style={s.wrap}>

      {/* Header + progress */}
      <div style={s.topRow}>
        <span style={s.title}>מבחן מיון</span>
        <span style={s.counter}>{current + 1} / {questions.length}</span>
      </div>
      <div style={s.track}><div style={{ ...s.bar, width: progress + '%' }} /></div>

      {/* Question card */}
      <div style={s.card}>
        <div style={s.badge}>{q.level}</div>
        <div style={s.word}>{q.word}</div>
        <p style={s.prompt}>מה התרגום הנכון?</p>
      </div>

      {/* Answer options */}
      <div style={s.options}>
        {q.options.map((opt, i) => {
          let os = s.opt
          if (chosen !== null) {
            if (opt.correct)       os = { ...s.opt, ...s.optGreen }
            else if (i === chosen) os = { ...s.opt, ...s.optRed }
          }
          return (
            <button key={i} style={os} onClick={() => handleAnswer(i)} disabled={chosen !== null}>
              <span style={s.letter}>{String.fromCharCode(65 + i)}</span>
              <span style={s.optText}>{opt.text}</span>
            </button>
          )
        })}
      </div>

    </div>
  )
}

function Spinner({ label }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
      <div style={s.ring} />
      <p style={{ color: c.ink3, marginTop: 16, fontSize: 13 }}>{label}</p>
    </div>
  )
}

const s = {
  wrap: { maxWidth: 420, margin: '0 auto', padding: '20px 16px 32px', direction: 'rtl' },

  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title:  { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, color: c.ink },
  counter:{ fontSize: 13, color: c.ink3 },

  track: { height: 5, background: c.surface, borderRadius: 3, marginBottom: 24, overflow: 'hidden' },
  bar:   { height: '100%', background: c.mint, borderRadius: 3, transition: 'width 0.3s' },

  card: { background: c.ink, borderRadius: 16, padding: '28px 24px', marginBottom: 20, textAlign: 'center' },
  badge: {
    display: 'inline-block',
    background: 'rgba(46,196,160,0.2)', color: c.mint,
    borderRadius: 6, padding: '3px 10px',
    fontSize: 11, fontWeight: 600, letterSpacing: '1px', marginBottom: 14,
  },
  word:   { fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 600, color: '#fff', marginBottom: 8 },
  prompt: { fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 },

  options: { display: 'flex', flexDirection: 'column', gap: 10 },
  opt: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: c.white, border: `1.5px solid ${c.border}`,
    borderRadius: 12, padding: '14px 16px',
    cursor: 'pointer', fontFamily: 'inherit', width: '100%',
    transition: 'background 0.15s, border-color 0.15s',
  },
  optGreen: { background: c.mintL, borderColor: c.mint },
  optRed:   { background: c.roseL, borderColor: c.rose },
  letter: {
    width: 28, height: 28, borderRadius: '50%', background: c.surface,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 600, color: c.ink2, flexShrink: 0,
  },
  optText: { fontSize: 15, color: c.ink },

  ring: {
    width: 36, height: 36,
    border: `3px solid ${c.mintL}`, borderTop: `3px solid ${c.mint}`,
    borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },
}
