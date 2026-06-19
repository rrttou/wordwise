import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import StoryScreen from './StoryScreen'
import { useSession } from './SessionContext'
import MemoryGame from './MemoryGame'

const QUIZ_LENGTH = 10
const MIN_PICK    = 4

const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  cream:'#faf8f4', surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  gold:'#e8a020', goldL:'#fff8e8',
  rose:'#e05070', roseL:'#fef0f3',
  sky:'#4080f0',  skyL:'#eef4ff',
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

/* ─── Root ───────────────────────────────────────────────────────── */
export default function PracticeScreen({ user }) {
  const { currentWords, setCurrentWords, wordCount, setWordCount, pastSessions, loadSessions, saveSession } = useSession()

  const [view, setView]          = useState('hub')
  const [dir, setDir]            = useState('en-he')
  const [exType, setExType]      = useState('quiz')
  const [source, setSource]      = useState('own')
  const [customWords, setCustom] = useState([])
  const [result, setResult]      = useState(null)

  useEffect(() => { loadSessions() }, [loadSessions])

  const goHub = () => setView('hub')
  const dest  = exType

  // Saves words as new session + starts exercise
  function startWithWords(words) {
    saveSession(words)
    setCustom(words)
    setSource('custom')
    setView(dest)
  }

  // Uses currentWords from context directly (no new session saved)
  function startWithCurrent(exerciseType, direction) {
    setCustom(currentWords)
    setSource('custom')
    if (exerciseType === 'quiz') { setDir(direction); setView('quiz') }
    else { setExType(exerciseType); setView(exerciseType) }
  }

  if (view === 'story') return <StoryScreen user={user} onBack={goHub} />

  if (view === 'source') return (
    <SourceView
      user={user}
      onBack={goHub}
      onOwn={() => { setSource('own'); setView(dest) }}
      onLevel={() => setView('level-pick')}
      onPick={() => setView('pick')}
      onType={() => setView('type-words')}
      onWrong={() => { setSource('wrong'); setView(dest) }}
      onQuickRandom={words => startWithWords(words)}
    />
  )

  if (view === 'level-pick') return (
    <LevelView
      user={user}
      onBack={() => setView('source')}
      onStart={words => startWithWords(words)}
    />
  )

  if (view === 'pick') return (
    <PickView
      user={user}
      onBack={() => setView('source')}
      onStart={words => startWithWords(words)}
    />
  )

  if (view === 'type-words') return (
    <TypeView
      user={user}
      onBack={() => setView('source')}
      onStart={words => startWithWords(words)}
    />
  )

  if (view === 'quiz') return (
    <QuizView
      user={user} direction={dir} source={source} customWords={customWords}
      onBack={() => setView('source')}
      onFinish={(score, total) => { setResult({ score, total }); setView('results') }}
    />
  )

  if (view === 'write') return (
    <SentenceWriteView
      user={user} source={source} customWords={customWords}
      onBack={() => setView('source')}
      onFinish={(score, total) => { setResult({ score, total }); setView('results') }}
    />
  )

  if (view === 'match') return (
    <SentenceMatchView
      user={user} source={source} customWords={customWords}
      onBack={() => setView('source')}
      onFinish={(score, total) => { setResult({ score, total }); setView('results') }}
    />
  )

  if (view === 'grammar') return (
    <GrammarQuizView
      user={user} source={source} customWords={customWords}
      onBack={() => setView('source')}
      onFinish={(score, total) => { setResult({ score, total }); setView('results') }}
    />
  )

  if (view === 'memory') return (
    <MemoryGame
      user={user} source={source} customWords={customWords}
      onBack={goHub}
    />
  )

  if (view === 'results') return (
    <ResultsView
      score={result.score} total={result.total}
      onRepeat={() => setView(dest)}
      onHub={goHub}
    />
  )

  return (
    <HubView
      currentWords={currentWords}
      wordCount={wordCount}
      setWordCount={setWordCount}
      pastSessions={pastSessions}
      onLoadSession={s => setCurrentWords(s.words)}
      onStartWithCurrent={startWithCurrent}
      onChooseWords={exerciseType => {
        setExType(exerciseType === 'quiz' ? 'quiz' : exerciseType)
        setView('source')
      }}
      onStart={d => { setDir(d); setExType('quiz'); setView('source') }}
      onStory={() => setView('story')}
      onSentenceWrite={() => { setExType('write'); setView('source') }}
      onSentenceMatch={() => { setExType('match'); setView('source') }}
      onGrammar={() => { setExType('grammar'); setView('source') }}
      onMemory={() => { setExType('memory'); setView('source') }}
    />
  )
}

/* ─── Month label helper ─────────────────────────────────────────── */
function monthLabel(iso) {
  const d = new Date(iso)
  const months = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳']
  return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

/* ─── Hub ────────────────────────────────────────────────────────── */
function HubView({
  onStart, onStory, onSentenceWrite, onSentenceMatch, onGrammar, onMemory,
  onChooseWords, onStartWithCurrent,
  currentWords, wordCount, setWordCount,
  pastSessions, onLoadSession,
}) {
  const hasCurrent = currentWords.length > 0

  const grouped = pastSessions.reduce((acc, s) => {
    const key = monthLabel(s.created_at)
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})
  const monthKeys = Object.keys(grouped)

  function modeClick(type, param) {
    if (hasCurrent) onStartWithCurrent(type, param)
    else {
      if (type === 'quiz')    onStart(param)
      else if (type === 'story')   onStory()
      else if (type === 'write')   onSentenceWrite()
      else if (type === 'match')   onSentenceMatch()
      else if (type === 'grammar') onGrammar()
      else if (type === 'memory')  onMemory()
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.pageHeader}>
        <h2 style={s.pageTitle}>תרגול</h2>
        <p style={s.pageSub}>{hasCurrent ? 'יש קבוצת מילים פעילה' : 'בחר מצב תרגול'}</p>
      </div>

      {/* Current session */}
      {hasCurrent && (
        <div style={s.currentCard}>
          <div style={s.currentLabel}>קבוצה פעילה</div>
          <div style={s.currentWords}>
            {currentWords.slice(0, 5).map(w => (
              <span key={w.word} style={s.currentChip}>{w.word}</span>
            ))}
            {currentWords.length > 5 && (
              <span style={s.currentMore}>+{currentWords.length - 5}</span>
            )}
          </div>
          <div style={s.currentFooter}>
            <span style={s.currentCount}>{currentWords.length} מילים</span>
            <button style={s.changeBtn} onClick={() => onChooseWords('quiz')}>שנה מילים</button>
          </div>
        </div>
      )}

      {/* Word count stepper */}
      <div style={s.countRow}>
        <span style={s.countLabel}>כמות מילים לתרגול:</span>
        <div style={s.stepper}>
          <button style={s.stepBtn} onClick={() => setWordCount(Math.max(4, wordCount - 2))}>−</button>
          <span style={s.stepVal}>{wordCount}</span>
          <button style={s.stepBtn} onClick={() => setWordCount(Math.min(30, wordCount + 2))}>+</button>
        </div>
      </div>

      {/* Mode cards */}
      <button style={{ ...s.modeCard, background: c.ink }} onClick={() => modeClick('quiz', 'en-he')}>
        <div style={s.modeLangs}>
          <span style={{ color: c.mint, fontWeight: 700 }}>EN</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 8px' }}>→</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>עב</span>
        </div>
        <div style={s.modeTitle}>אנגלית → עברית</div>
        <div style={s.modeSub}>{hasCurrent ? 'תרגל את הקבוצה הפעילה' : 'ראה מילה באנגלית, בחר תרגום'}</div>
        <span style={s.modeChevron}>←</span>
      </button>

      <button style={{ ...s.modeCard, background: c.sky }} onClick={() => modeClick('quiz', 'he-en')}>
        <div style={s.modeLangs}>
          <span style={{ color: '#fff', fontWeight: 700 }}>עב</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 8px' }}>→</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>EN</span>
        </div>
        <div style={s.modeTitle}>עברית → אנגלית</div>
        <div style={s.modeSub}>{hasCurrent ? 'תרגל את הקבוצה הפעילה' : 'ראה תרגום, בחר מילה באנגלית'}</div>
        <span style={s.modeChevron}>←</span>
      </button>

      <button style={{ ...s.modeCard, background: `linear-gradient(135deg,${c.gold},#c87800)` }} onClick={() => modeClick('story')}>
        <div style={s.modeLangs}><span style={{ color: '#fff', fontSize: 18 }}>✦</span></div>
        <div style={s.modeTitle}>סיפורים</div>
        <div style={s.modeSub}>צור סיפור AI עם המילים שלך</div>
        <span style={s.modeChevron}>←</span>
      </button>

      <button style={{ ...s.modeCard, background: `linear-gradient(135deg,${c.mint},#1a9e80)` }} onClick={() => modeClick('write')}>
        <div style={s.modeLangs}><span style={{ color: '#fff', fontSize: 18 }}>✍</span></div>
        <div style={s.modeTitle}>כתיבת משפטים</div>
        <div style={s.modeSub}>כתוב משפטים עם המילים, AI יתקן</div>
        <span style={s.modeChevron}>←</span>
      </button>

      <button style={{ ...s.modeCard, background: `linear-gradient(135deg,${c.rose},#a03050)` }} onClick={() => modeClick('match')}>
        <div style={s.modeLangs}><span style={{ color: '#fff', fontSize: 18 }}>🔗</span></div>
        <div style={s.modeTitle}>התאמת משפטים</div>
        <div style={s.modeSub}>התאם בין משפטים למילים</div>
        <span style={s.modeChevron}>←</span>
      </button>

      <button style={{ ...s.modeCard, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }} onClick={() => modeClick('grammar')}>
        <div style={s.modeLangs}><span style={{ color: '#fff', fontSize: 18 }}>📝</span></div>
        <div style={s.modeTitle}>מבחן דקדוק</div>
        <div style={s.modeSub}>שאלות על זמנים דקדוקיים באנגלית</div>
        <span style={s.modeChevron}>←</span>
      </button>

      <button style={{ ...s.modeCard, background: 'linear-gradient(135deg,#f59e0b,#d97706)' }} onClick={() => modeClick('memory')}>
        <div style={s.modeLangs}><span style={{ color: '#fff', fontSize: 18 }}>🎴</span></div>
        <div style={s.modeTitle}>משחק זיכרון</div>
        <div style={s.modeSub}>{hasCurrent ? `${currentWords.length} זוגות — הפוך וגלה` : 'מצא זוגות: אנגלית + עברית'}</div>
        <span style={s.modeChevron}>←</span>
      </button>

      {/* Past sessions */}
      {monthKeys.length > 0 && (
        <div style={s.historySection}>
          <div style={s.historyTitle}>מילים שתרגלת</div>
          {monthKeys.map(month => (
            <div key={month} style={{ marginBottom: 16 }}>
              <div style={s.monthLabel}>{month}</div>
              <div style={s.sessionRow}>
                {grouped[month].map(session => (
                  <button
                    key={session.id}
                    style={s.sessionCard}
                    onClick={() => onLoadSession(session)}
                  >
                    <div style={s.sessionWord}>{session.words[0]?.word ?? '—'}</div>
                    <div style={s.sessionCount}>{session.words.length} מילים</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Source selection ───────────────────────────────────────────── */
function SourceView({ user, onBack, onOwn, onLevel, onPick, onType, onWrong, onQuickRandom }) {
  const { wordCount, setWordCount } = useSession()
  const [wrongCount,   setWrongCount]   = useState(null)
  const [randLoading,  setRandLoading]  = useState(false)

  useEffect(() => {
    supabase.from('user_words')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('wrong_count', 0)
      .not('translation', 'is', null)
      .then(({ count }) => setWrongCount(count ?? 0))
  }, [])

  async function handleQuickRandom() {
    setRandLoading(true)
    const { data } = await supabase
      .from('user_words')
      .select('id, word, translation, level, correct_streak, wrong_count')
      .eq('user_id', user.id)
      .not('translation', 'is', null)
    const picked = shuffle(data ?? []).slice(0, wordCount)
    setRandLoading(false)
    if (picked.length < MIN_PICK) return
    onQuickRandom(picked)
  }

  return (
    <div style={s.wrap}>
      <div style={s.topRow}>
        <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
      </div>
      <div style={s.pageHeader}>
        <h2 style={s.pageTitle}>בחר מילים</h2>
        <p style={s.pageSub}>מאיפה תרגל?</p>
      </div>

      {/* Quick random */}
      <div style={s.quickRow}>
        <div style={s.stepper}>
          <button style={s.stepBtn} onClick={() => setWordCount(Math.max(4, wordCount - 2))}>−</button>
          <span style={s.stepVal}>{wordCount}</span>
          <button style={s.stepBtn} onClick={() => setWordCount(Math.min(30, wordCount + 2))}>+</button>
        </div>
        <button style={s.quickRandBtn} onClick={handleQuickRandom} disabled={randLoading}>
          {randLoading ? '...' : `✦ ${wordCount} מילים אקראיות`}
        </button>
      </div>

      <button style={s.sourceCard} onClick={onOwn}>
        <div style={s.sourceIcon}>📚</div>
        <div>
          <div style={s.sourceTitle}>כל המילים שלי</div>
          <div style={s.sourceSub}>תרגל מכל המילים שהוספת, באקראי</div>
        </div>
        <span style={{ color: c.ink3, marginRight: 'auto' }}>←</span>
      </button>

      <button style={s.sourceCard} onClick={onLevel}>
        <div style={s.sourceIcon}>🎯</div>
        <div>
          <div style={s.sourceTitle}>לפי רמה</div>
          <div style={s.sourceSub}>סנן מילים לפי רמת CEFR (A1–C2)</div>
        </div>
        <span style={{ color: c.ink3, marginRight: 'auto' }}>←</span>
      </button>

      <button style={s.sourceCard} onClick={onPick}>
        <div style={s.sourceIcon}>✏️</div>
        <div>
          <div style={s.sourceTitle}>בחר מילים ידנית</div>
          <div style={s.sourceSub}>סמן בדיוק אילו מילים לתרגל</div>
        </div>
        <span style={{ color: c.ink3, marginRight: 'auto' }}>←</span>
      </button>

      <button style={s.sourceCard} onClick={onType}>
        <div style={s.sourceIcon}>⌨️</div>
        <div>
          <div style={s.sourceTitle}>הזן מילים</div>
          <div style={s.sourceSub}>הקלד את המילים שתרצה לתרגל</div>
        </div>
        <span style={{ color: c.ink3, marginRight: 'auto' }}>←</span>
      </button>

      <button
        style={{ ...s.sourceCard, ...(wrongCount === 0 ? s.sourceCardDisabled : {}) }}
        onClick={wrongCount > 0 ? onWrong : undefined}
        disabled={wrongCount === 0}
      >
        <div style={s.sourceIcon}>❌</div>
        <div>
          <div style={s.sourceTitle}>מילים שטעיתי בהן</div>
          <div style={s.sourceSub}>
            {wrongCount === null ? 'טוען...' :
             wrongCount === 0 ? 'אין מילים שגויות — כל הכבוד!' :
             `${wrongCount} מילים לתרגול חוזר`}
          </div>
        </div>
        <span style={{ color: c.ink3, marginRight: 'auto' }}>←</span>
      </button>
    </div>
  )
}

/* ─── Word picker ────────────────────────────────────────────────── */
function PickView({ user, onBack, onStart }) {
  const { wordCount } = useSession()
  const [words, setWords]       = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.from('user_words')
      .select('id, word, translation, level, correct_streak, wrong_count')
      .eq('user_id', user.id)
      .not('translation', 'is', null)
      .order('word')
      .then(({ data }) => { setWords(data ?? []); setLoading(false) })
  }, [])

  function toggle(w) {
    setSelected(prev =>
      prev.find(p => p.id === w.id) ? prev.filter(p => p.id !== w.id) : [...prev, w]
    )
  }

  function pickRandom() {
    setSelected(shuffle(words).slice(0, Math.min(wordCount, words.length)))
  }

  if (loading) return <Spinner label="טוען מילים..." />

  if (!words.length) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <p style={{ color: c.ink3, marginBottom: 20 }}>אין מילים עם תרגום — הוסף ותרגם מילים תחילה</p>
      <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
    </div>
  )

  const canStart = selected.length >= MIN_PICK

  return (
    <div style={s.wrap}>
      <div style={s.topRow}>
        <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
        <span style={s.counter}>{selected.length} נבחרו</span>
      </div>

      <div style={s.pickerHead}>
        <h2 style={s.pageTitle}>בחר מילים</h2>
        <button style={s.randomBtn} onClick={pickRandom}>✦ בחר אקראי</button>
      </div>

      <div style={s.chips}>
        {words.map(w => {
          const on = !!selected.find(p => p.id === w.id)
          return (
            <button
              key={w.id}
              style={{ ...s.pickChip, ...(on ? s.pickChipOn : {}) }}
              onClick={() => toggle(w)}
            >
              <span>{w.word}</span>
              {w.translation && <span style={s.pickTranslation}>{w.translation}</span>}
            </button>
          )
        })}
      </div>

      {selected.length > 0 && selected.length < MIN_PICK && (
        <p style={{ color: c.ink3, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
          בחר עוד {MIN_PICK - selected.length} לפחות
        </p>
      )}

      <button
        style={{ ...s.primaryBtn, marginTop: 16, opacity: canStart ? 1 : 0.45 }}
        onClick={() => canStart && onStart(selected)}
        disabled={!canStart}
      >
        התחל תרגול ({selected.length})
      </button>
    </div>
  )
}

/* ─── Level picker ───────────────────────────────────────────────── */
const LEVEL_META = {
  A1: { label: 'מתחיל',       bg: '#4080f0' },
  A2: { label: 'בסיסי',       bg: '#2ec4a0' },
  B1: { label: 'בינוני',      bg: '#e8a020' },
  B2: { label: 'עצמאי',       bg: '#e07040' },
  C1: { label: 'מתקדם',       bg: '#e05070' },
  C2: { label: 'שליטה מלאה',  bg: '#7c3aed' },
}

function LevelView({ user, onBack, onStart }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function pickLevel(level) {
    setLoading(true); setError('')
    const { data } = await supabase
      .from('user_words')
      .select('id, word, translation, level, correct_streak, wrong_count')
      .eq('user_id', user.id)
      .eq('level', level)
      .not('translation', 'is', null)
    setLoading(false)
    const words = data ?? []
    if (words.length < MIN_PICK) {
      setError(`רק ${words.length} מילים ברמה ${level} — צריך לפחות ${MIN_PICK}`)
      return
    }
    onStart(words)
  }

  if (loading) return <Spinner label="טוען מילים..." />

  return (
    <div style={s.wrap}>
      <div style={s.topRow}>
        <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
      </div>
      <div style={s.pageHeader}>
        <h2 style={s.pageTitle}>בחר רמה</h2>
        <p style={s.pageSub}>תרגל מילים לפי רמת CEFR</p>
      </div>
      <div style={s.levelGrid}>
        {Object.entries(LEVEL_META).map(([level, { label, bg }]) => (
          <button
            key={level}
            style={{ ...s.levelBtn, background: bg }}
            onClick={() => pickLevel(level)}
          >
            <span style={s.levelCode}>{level}</span>
            <span style={s.levelLabel}>{label}</span>
          </button>
        ))}
      </div>
      {error && <p style={{ color: c.rose, fontSize: 13, textAlign: 'center', marginTop: 16 }}>{error}</p>}
    </div>
  )
}

/* ─── Type words ─────────────────────────────────────────────────── */
const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

function TypeView({ user, onBack, onStart }) {
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState('')
  const [failed, setFailed]   = useState([])
  const [error, setError]     = useState('')

  async function handleStart() {
    const typed = [...new Set(
      input.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(Boolean)
    )]
    if (!typed.length) return
    setLoading(true); setFailed([]); setError(''); setStatus('מחפש מילים...')

    // 1. Find words already in bank (with translation)
    const { data: existing } = await supabase
      .from('user_words')
      .select('id, word, translation, level, wrong_count')
      .eq('user_id', user.id)
      .in('word', typed)
      .not('translation', 'is', null)

    const existingSet = new Set((existing ?? []).map(w => w.word))
    const newWords    = typed.filter(w => !existingSet.has(w))
    let allWords      = [...(existing ?? [])]

    // 2. Enrich + save any words not yet in bank
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
            correct_streak: 0,
            wrong_count: 0,
            story_count: 0,
          }))

        if (rows.length) {
          const { data: upserted } = await supabase
            .from('user_words')
            .upsert(rows, { onConflict: 'user_id,word' })
            .select('id, word, translation, level, wrong_count')
          if (upserted?.length) allWords = [...allWords, ...upserted]
        }

        const enrichedSet = new Set(enriched.map(e => e.word?.toLowerCase()).filter(Boolean))
        setFailed(newWords.filter(w => !enrichedSet.has(w)))
      } else {
        setFailed(newWords)
      }
    }

    setLoading(false); setStatus('')

    if (allWords.length < MIN_PICK) {
      setError(`נמצאו רק ${allWords.length} מילים — צריך לפחות ${MIN_PICK}`)
      return
    }
    onStart(allWords)
  }

  return (
    <div style={s.wrap}>
      <div style={s.topRow}>
        <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
      </div>
      <div style={s.pageHeader}>
        <h2 style={s.pageTitle}>הזן מילים</h2>
        <p style={s.pageSub}>הקלד כל מילה באנגלית — גם מילים חדשות יתווספו למאגר שלך</p>
      </div>
      <textarea
        style={s.typeArea}
        placeholder="apple, universe, eloquent, run..."
        value={input}
        onChange={e => { setInput(e.target.value); setFailed([]); setError('') }}
        dir="ltr"
        rows={6}
      />
      {failed.length > 0 && (
        <p style={{ color: c.ink3, fontSize: 12, marginTop: 8, direction: 'ltr', textAlign: 'left' }}>
          לא זוהו: {failed.join(', ')}
        </p>
      )}
      {error && <p style={{ color: c.rose, fontSize: 13, marginTop: 8 }}>{error}</p>}
      <button
        style={{ ...s.primaryBtn, marginTop: 16, opacity: input.trim() && !loading ? 1 : 0.45 }}
        onClick={handleStart}
        disabled={!input.trim() || loading}
      >
        {loading ? (status || 'טוען...') : 'התחל תרגול'}
      </button>
    </div>
  )
}

/* ─── Quiz ───────────────────────────────────────────────────────── */
function QuizView({ user, direction, source, customWords, onBack, onFinish }) {
  const [questions, setQuestions] = useState([])
  const [current, setCurrent]     = useState(0)
  const [score, setScore]         = useState(0)
  const [chosen, setChosen]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => { buildQuestions() }, [])

  async function buildQuestions() {
    let pool = []

    if (source === 'global') {
      const { data: profile } = await supabase
        .from('profiles').select('current_level').eq('id', user.id).single()
      const level = profile?.current_level ?? 'A1'
      const { data } = await supabase
        .from('global_words').select('id, word, translation, level')
        .eq('level', level).not('translation', 'is', null).limit(80)
      pool = data ?? []
    } else if (source === 'custom') {
      pool = customWords.filter(w => w.translation)
    } else if (source === 'wrong') {
      const { data } = await supabase
        .from('user_words')
        .select('id, word, translation, level, correct_streak, wrong_count')
        .eq('user_id', user.id)
        .gt('wrong_count', 0)
        .not('translation', 'is', null)
        .order('wrong_count', { ascending: false })
        .limit(80)
      pool = data ?? []
    } else {
      const { data } = await supabase
        .from('user_words')
        .select('id, word, translation, level, correct_streak, wrong_count')
        .eq('user_id', user.id)
        .not('translation', 'is', null)
        .limit(80)
      pool = data ?? []
    }

    if (pool.length < MIN_PICK) {
      setError(
        pool.length === 0
          ? 'אין מילים עם תרגום — לחץ "תרגם חסרים" בדף המילים'
          : `יש רק ${pool.length} מילים עם תרגום — צריך לפחות ${MIN_PICK}`
      )
      setLoading(false)
      return
    }

    const batch = shuffle(pool).slice(0, QUIZ_LENGTH)
    const built = []

    for (const w of batch) {
      const correctText = direction === 'en-he' ? w.translation : w.word
      const distractors = await getDistractors(w, direction, correctText, pool)
      if (distractors.length < 3) continue
      built.push({
        id:         w.id,
        streak:     w.correct_streak ?? 0,
        wrongCount: w.wrong_count ?? 0,
        isUserWord: source !== 'global',
        question: direction === 'en-he' ? w.word : w.translation,
        options: shuffle([
          { text: correctText, correct: true },
          ...distractors.map(d => ({
            text: direction === 'en-he' ? d.translation : d.word,
            correct: false,
          })),
        ]),
      })
    }

    if (!built.length) {
      setError('לא היה מספיק מגוון מילים לבניית שאלות')
      setLoading(false)
      return
    }

    setQuestions(built)
    setLoading(false)
  }

  async function getDistractors(w, direction, correctText, fallbackPool) {
    // Try global_words first (better distractors — same level, different words)
    if (w.level) {
      const { data } = await supabase
        .from('global_words').select('word, translation')
        .eq('level', w.level).neq('word', w.word).limit(30)
      if (data?.length >= 3) {
        const filtered = shuffle(data)
          .filter(d => (direction === 'en-he' ? d.translation : d.word) !== correctText)
          .slice(0, 3)
        if (filtered.length >= 3) return filtered
      }
    }
    // Fallback: use other words from the same pool
    return shuffle(fallbackPool)
      .filter(p => p.word !== w.word &&
        (direction === 'en-he' ? p.translation : p.word) !== correctText &&
        (direction === 'en-he' ? p.translation : p.word))
      .slice(0, 3)
  }

  function handleAnswer(idx) {
    if (chosen !== null) return
    const q = questions[current]
    const isCorrect = q.options[idx].correct
    const newScore = isCorrect ? score + 1 : score
    setChosen(idx)
    if (isCorrect) setScore(newScore)

    if (q.isUserWord) {
      if (isCorrect) {
        const updates = { correct_streak: q.streak + 1 }
        if (q.wrongCount > 0) updates.wrong_count = q.wrongCount - 1
        supabase.from('user_words').update(updates).eq('id', q.id).eq('user_id', user.id).then()
      } else {
        supabase.from('user_words')
          .update({ wrong_count: q.wrongCount + 1 })
          .eq('id', q.id).eq('user_id', user.id).then()
      }
    }

    setTimeout(() => {
      setChosen(null)
      if (current + 1 < questions.length) {
        setCurrent(n => n + 1)
      } else {
        onFinish(newScore, questions.length)
      }
    }, 700)
  }

  if (loading) return <Spinner label="בונה שאלות..." />

  if (error) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <p style={{ color: c.rose, marginBottom: 24 }}>{error}</p>
      <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
    </div>
  )

  const q       = questions[current]
  const isEnHe  = direction === 'en-he'
  const accent  = isEnHe ? c.ink : c.sky
  const progress = (current / questions.length) * 100

  return (
    <div style={s.wrap}>
      <div style={s.topRow}>
        <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
        <span style={s.counter}>{current + 1} / {questions.length}</span>
      </div>
      <div style={s.track}><div style={{ ...s.bar, background: accent, width: progress + '%' }} /></div>

      <div style={{ ...s.card, background: accent }}>
        <div style={s.dirLabel}>{isEnHe ? 'EN → עב' : 'עב → EN'}</div>
        <div style={s.qWord}>{q.question}</div>
        <p style={s.qPrompt}>{isEnHe ? 'מה התרגום הנכון?' : 'What is the correct word?'}</p>
      </div>

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

/* ─── Fetch pool helper ──────────────────────────────────────────── */
async function fetchPool(user, source, customWords) {
  if (source === 'custom') return customWords.filter(w => w.translation)
  let q = supabase
    .from('user_words')
    .select('id, word, translation, level, wrong_count')
    .eq('user_id', user.id)
    .not('translation', 'is', null)
  if (source === 'wrong') q = q.gt('wrong_count', 0).order('wrong_count', { ascending: false })
  const { data } = await q.limit(40)
  return data ?? []
}

/* ─── Sentence Write ─────────────────────────────────────────────── */
function SentenceWriteView({ user, source, customWords, onBack, onFinish }) {
  const [pool, setPool]         = useState([])
  const [idx, setIdx]           = useState(0)
  const [sentence, setSentence] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [grading, setGrading]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const scoreRef                = useRef(0)
  const wordScoredRef           = useRef(new Set())

  useEffect(() => {
    fetchPool(user, source, customWords).then(p => {
      setPool(shuffle(p).slice(0, 8))
      setLoading(false)
    })
  }, [])

  async function grade() {
    if (!sentence.trim() || grading || feedback) return
    setGrading(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('grade-sentence', {
        body: { word: pool[idx].word, sentence: sentence.trim() }
      })
      if (fnErr) throw fnErr
      if (data.correct && !wordScoredRef.current.has(idx)) {
        scoreRef.current++
        wordScoredRef.current.add(idx)
      }
      setFeedback(data)
    } catch {
      setFeedback({ correct: false, corrected: sentence, example: '', feedback: 'שגיאה בבדיקה — נסה שוב' })
    } finally {
      setGrading(false)
    }
  }

  function retry() {
    setSentence('')
    setFeedback(null)
  }

  function next() {
    if (idx + 1 < pool.length) {
      setIdx(i => i + 1)
      setSentence('')
      setFeedback(null)
    } else {
      onFinish(scoreRef.current, pool.length)
    }
  }

  if (loading) return <Spinner label="טוען מילים..." />
  if (!pool.length) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <p style={{ color: c.ink3, marginBottom: 20 }}>אין מילים מתאימות</p>
      <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
    </div>
  )

  const word     = pool[idx]
  const progress = (idx / pool.length) * 100

  return (
    <div style={s.wrap}>
      <div style={s.topRow}>
        <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
        <span style={s.counter}>{idx + 1} / {pool.length}</span>
      </div>
      <div style={s.track}><div style={{ ...s.bar, background: c.mint, width: progress + '%' }} /></div>

      <div style={{ ...s.card, background: c.mint, marginBottom: 20 }}>
        <div style={s.dirLabel}>כתיבת משפט</div>
        <div style={s.qWord}>{word.word}</div>
        {word.translation && <p style={s.qPrompt}>{word.translation}</p>}
      </div>

      <p style={{ fontSize: 13, color: c.ink3, marginBottom: 8 }}>כתוב משפט באנגלית עם המילה הזו:</p>
      <textarea
        style={{ ...s.typeArea, marginBottom: 12 }}
        placeholder={`Use "${word.word}" in a sentence...`}
        value={sentence}
        onChange={e => setSentence(e.target.value)}
        dir="ltr"
        rows={3}
        disabled={!!feedback}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); grade() } }}
      />

      {feedback && (
        <div style={{ ...s.feedbackCard, borderColor: feedback.correct ? c.mint : c.rose }}>
          <div style={{ fontWeight: 600, color: feedback.correct ? c.mintD : c.rose, marginBottom: 8, fontSize: 14 }}>
            {feedback.correct ? '✓ נכון!' : '✗ לא מדויק'}
          </div>
          {!feedback.correct && feedback.corrected && (
            <div style={{ fontSize: 13, color: c.ink2, marginBottom: 6, direction: 'ltr', textAlign: 'left' }}>
              <span style={{ color: c.ink3, fontSize: 11, display: 'block', marginBottom: 2 }}>תיקון:</span>
              {feedback.corrected}
            </div>
          )}
          {!feedback.correct && feedback.example && (
            <div style={{ fontSize: 13, color: c.ink, marginBottom: 6, direction: 'ltr', textAlign: 'left', fontStyle: 'italic' }}>
              <span style={{ color: c.ink3, fontSize: 11, fontStyle: 'normal', display: 'block', marginBottom: 2 }}>דוגמה:</span>
              {feedback.example}
            </div>
          )}
          <div style={{ fontSize: 13, color: c.ink2, borderTop: `1px solid ${c.border}`, paddingTop: 8, marginTop: 4 }}>
            {feedback.feedback}
          </div>
        </div>
      )}

      {!feedback ? (
        <button
          style={{ ...s.primaryBtn, opacity: sentence.trim() ? 1 : 0.45, marginTop: 4 }}
          onClick={grade}
          disabled={!sentence.trim() || grading}
        >
          {grading ? 'בודק...' : 'שלח לבדיקה'}
        </button>
      ) : feedback.correct ? (
        <button style={s.primaryBtn} onClick={next}>
          {idx + 1 < pool.length ? 'מילה הבאה ←' : 'סיום'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...s.primaryBtn, flex: 1, margin: 0 }} onClick={retry}>נסה שוב</button>
          <button style={{ ...s.secondaryBtn, flex: 1 }} onClick={next}>
            {idx + 1 < pool.length ? 'דלג ←' : 'סיום'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Sentence Match ─────────────────────────────────────────────── */
function SentenceMatchView({ user, source, customWords, onBack, onFinish }) {
  const [sentences, setSentences] = useState([])
  const [words, setWords]         = useState([])
  const [matched, setMatched]     = useState({})
  const [selSent, setSelSent]     = useState(null)
  const [selWord, setSelWord]     = useState(null)
  const [wrongPair, setWrongPair] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const wrongRef                  = useRef(0)

  useEffect(() => {
    async function load() {
      const pool = await fetchPool(user, source, customWords)
      if (pool.length < 2) { setError('צריך לפחות 2 מילים'); setLoading(false); return }
      const batch = shuffle(pool).slice(0, 8)
      const { data, error: fnErr } = await supabase.functions.invoke('generate-exercise', {
        body: { words: batch.map(w => w.word), type: 'sentences' }
      })
      if (fnErr || !Array.isArray(data) || !data.length) {
        setError('שגיאה ביצירת התרגיל — נסה שוב')
        setLoading(false)
        return
      }
      setSentences(shuffle(data))
      setWords(shuffle(data.map(d => d.word)))
      setLoading(false)
    }
    load()
  }, [])

  function blankWord(sentence, word) {
    return sentence.replace(new RegExp(`\\b${word}\\b`, 'gi'), '____')
  }
  function wordMatched(wIdx) { return Object.values(matched).includes(wIdx) }

  function tryMatch(sIdx, wIdx) {
    if (sentences[sIdx].word.toLowerCase() === words[wIdx].toLowerCase()) {
      const newMatched = { ...matched, [sIdx]: wIdx }
      setMatched(newMatched)
      setSelSent(null); setSelWord(null)
      if (Object.keys(newMatched).length === sentences.length) {
        onFinish(Math.max(0, sentences.length - wrongRef.current), sentences.length)
      }
    } else {
      wrongRef.current++
      setWrongPair({ sIdx, wIdx })
      setTimeout(() => { setWrongPair(null); setSelSent(null); setSelWord(null) }, 700)
    }
  }

  function handleSentClick(i) {
    if (matched[i] !== undefined || wrongPair) return
    const next = selSent === i ? null : i
    setSelSent(next)
    if (next !== null && selWord !== null) tryMatch(next, selWord)
  }

  function handleWordClick(i) {
    if (wordMatched(i) || wrongPair) return
    const next = selWord === i ? null : i
    setSelWord(next)
    if (selSent !== null && next !== null) tryMatch(selSent, next)
  }

  if (loading) return <Spinner label="מייצר תרגיל..." />
  if (error) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <p style={{ color: c.rose, marginBottom: 20 }}>{error}</p>
      <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
    </div>
  )

  const matchCount = Object.keys(matched).length

  return (
    <div style={s.wrap}>
      <div style={s.topRow}>
        <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
        <span style={s.counter}>{matchCount} / {sentences.length} הותאמו</span>
      </div>

      <div style={s.pageHeader}>
        <h2 style={s.pageTitle}>התאמת משפטים</h2>
        <p style={s.pageSub}>לחץ על משפט ואז על המילה המתאימה לו</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        {sentences.map((sent, i) => {
          const isMatched  = matched[i] !== undefined
          const isSelected = selSent === i
          const isWrong    = wrongPair?.sIdx === i
          const bg     = isMatched ? c.mintL : isSelected ? c.skyL : isWrong ? c.roseL : c.white
          const border = isMatched ? `1.5px solid ${c.mint}` : isSelected ? `1.5px solid ${c.sky}` : isWrong ? `1.5px solid ${c.rose}` : `1.5px solid ${c.border}`
          return (
            <button key={i} style={{ ...s.sentenceCard, background: bg, border }} onClick={() => handleSentClick(i)}>
              <span style={{ fontSize: 13, color: c.ink, direction: 'ltr', textAlign: 'left', display: 'block' }}>
                {isMatched ? sent.sentence : blankWord(sent.sentence, sent.word)}
              </span>
              {isMatched && (
                <span style={{ fontSize: 11, color: c.mintD, marginTop: 4, display: 'block' }}>✓ {words[matched[i]]}</span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 16 }}>
        <p style={{ fontSize: 12, color: c.ink3, marginBottom: 10 }}>מילים:</p>
        <div style={s.chips}>
          {words.map((w, i) => {
            const isMatched  = wordMatched(i)
            const isSelected = selWord === i
            const isWrong    = wrongPair?.wIdx === i
            return (
              <button
                key={i}
                style={{
                  ...s.pickChip,
                  ...(isMatched  ? { opacity: 0.35, cursor: 'default' } : {}),
                  ...(isSelected ? s.pickChipOn : {}),
                  ...(isWrong    ? { background: c.roseL, borderColor: c.rose } : {}),
                }}
                onClick={() => handleWordClick(i)}
              >
                {w}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Grammar Quiz ───────────────────────────────────────────────── */
function GrammarQuizView({ user, source, customWords, onBack, onFinish }) {
  const [questions, setQuestions] = useState([])
  const [idx, setIdx]             = useState(0)
  const [chosen, setChosen]       = useState(null)
  const [score, setScore]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    async function load() {
      const pool = await fetchPool(user, source, customWords)
      if (!pool.length) { setError('אין מילים'); setLoading(false); return }
      const wordList = shuffle(pool).slice(0, 8).map(w => w.word)
      const { data, error: fnErr } = await supabase.functions.invoke('generate-exercise', {
        body: { words: wordList, type: 'grammar' }
      })
      if (fnErr || !Array.isArray(data) || !data.length) {
        setError('שגיאה ביצירת שאלות — נסה שוב')
        setLoading(false)
        return
      }
      setQuestions(data)
      setLoading(false)
    }
    load()
  }, [])

  function handleAnswer(i) {
    if (chosen !== null) return
    const q        = questions[idx]
    const correct  = i === q.correct
    const newScore = correct ? score + 1 : score
    setChosen(i)
    if (correct) setScore(newScore)

    setTimeout(() => {
      setChosen(null)
      if (idx + 1 < questions.length) {
        setIdx(n => n + 1)
      } else {
        onFinish(newScore, questions.length)
      }
    }, 2200)
  }

  if (loading) return <Spinner label="מייצר שאלות דקדוק..." />
  if (error) return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <p style={{ color: c.rose, marginBottom: 20 }}>{error}</p>
      <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
    </div>
  )

  const q        = questions[idx]
  const progress = (idx / questions.length) * 100

  return (
    <div style={s.wrap}>
      <div style={s.topRow}>
        <button style={s.ghostBtn} onClick={onBack}>← חזור</button>
        <span style={s.counter}>{idx + 1} / {questions.length}</span>
      </div>
      <div style={s.track}><div style={{ ...s.bar, background: '#7c3aed', width: progress + '%' }} /></div>

      <div style={{ ...s.card, background: '#7c3aed', marginBottom: 20 }}>
        <div style={s.dirLabel}>מבחן דקדוק</div>
        <div style={{ ...s.qWord, fontSize: 19, lineHeight: 1.4, direction: 'ltr', textAlign: 'left' }}>
          {q.question}
        </div>
        {q.tense && chosen !== null && (
          <div style={s.tenseBadge}>{q.tense}</div>
        )}
      </div>

      <div style={s.options}>
        {q.options.map((opt, i) => {
          let os = s.opt
          if (chosen !== null) {
            if (i === q.correct)   os = { ...s.opt, ...s.optGreen }
            else if (i === chosen) os = { ...s.opt, ...s.optRed }
          }
          return (
            <button key={i} style={os} onClick={() => handleAnswer(i)} disabled={chosen !== null}>
              <span style={s.letter}>{String.fromCharCode(65 + i)}</span>
              <span style={{ ...s.optText, direction: 'ltr' }}>{opt}</span>
            </button>
          )
        })}
      </div>

      {chosen !== null && q.explanation && (
        <div style={s.explanationBox}><span style={{ fontWeight: 600, color: c.ink2 }}>הסבר: </span>{q.explanation}</div>
      )}
    </div>
  )
}

/* ─── Results ────────────────────────────────────────────────────── */
function ResultsView({ score, total, onRepeat, onHub }) {
  const pct   = Math.round((score / total) * 100)
  const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'
  const msg   = pct >= 80 ? 'מצוין!' : pct >= 50 ? 'כמעט שם!' : 'המשך להתאמן'

  return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 32 }}>
      <div style={s.resultCard}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>{emoji}</div>
        <div style={s.resultMsg}>{msg}</div>
        <div style={s.resultScore}>{score}<span style={s.resultDenom}>/{total}</span></div>
        <div style={s.resultPct}>{pct}% נכון</div>
      </div>
      <button style={s.primaryBtn} onClick={onRepeat}>תרגל שוב</button>
      <button style={s.secondaryBtn} onClick={onHub}>חזור לתפריט</button>
    </div>
  )
}

/* ─── Shared ─────────────────────────────────────────────────────── */
function Spinner({ label }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
      <div style={s.ring} />
      <p style={{ color: c.ink3, marginTop: 16, fontSize: 13 }}>{label}</p>
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = {
  wrap: { maxWidth: 420, margin: '0 auto', padding: '20px 16px 32px', direction: 'rtl' },

  pageHeader: { textAlign: 'center', marginBottom: 24 },
  pageTitle:  { fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 600, color: c.ink, marginBottom: 6 },
  pageSub:    { fontSize: 13, color: c.ink3 },

  topRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  counter: { fontSize: 13, color: c.ink3 },
  ghostBtn: {
    background: 'transparent', border: 'none',
    color: c.ink3, cursor: 'pointer', fontSize: 13,
    padding: '4px 0', fontFamily: 'inherit',
  },

  /* current session card */
  currentCard: {
    background: c.ink, borderRadius: 14, padding: '16px',
    marginBottom: 14, direction: 'rtl',
  },
  currentLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
    color: c.mint, textTransform: 'uppercase', marginBottom: 8,
  },
  currentWords: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  currentChip: {
    background: 'rgba(255,255,255,0.1)', color: '#fff',
    borderRadius: 6, padding: '3px 9px', fontSize: 13, fontWeight: 500,
  },
  currentMore: { color: 'rgba(255,255,255,0.4)', fontSize: 12, alignSelf: 'center' },
  currentFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  currentCount: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  changeBtn: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 7, color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer', fontSize: 12, padding: '5px 12px', fontFamily: 'inherit',
  },

  /* word count stepper */
  countRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, direction: 'rtl',
  },
  countLabel: { fontSize: 13, color: c.ink3 },
  stepper: { display: 'flex', alignItems: 'center', gap: 10 },
  stepBtn: {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: 7, width: 30, height: 30,
    cursor: 'pointer', fontSize: 18, color: c.ink2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', lineHeight: 1,
  },
  stepVal: { fontSize: 16, fontWeight: 600, color: c.ink, minWidth: 28, textAlign: 'center' },

  /* quick random row (SourceView) */
  quickRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, marginBottom: 14, background: c.mintL,
    border: `1px solid ${c.mint}`, borderRadius: 12, padding: '10px 14px',
  },
  quickRandBtn: {
    background: c.mint, border: 'none', borderRadius: 8,
    color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    padding: '8px 14px', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },

  /* session history */
  historySection: {
    marginTop: 28, paddingTop: 20,
    borderTop: `1px solid ${c.border}`,
  },
  historyTitle: {
    fontSize: 11, fontWeight: 600, letterSpacing: '1.2px',
    textTransform: 'uppercase', color: c.ink3, marginBottom: 14,
  },
  monthLabel: {
    fontSize: 12, fontWeight: 600, color: c.ink2,
    marginBottom: 8, direction: 'rtl',
  },
  sessionRow: {
    display: 'flex', gap: 8, overflowX: 'auto',
    paddingBottom: 4, scrollbarWidth: 'none',
  },
  sessionCard: {
    background: c.white, border: `1px solid ${c.border}`,
    borderRadius: 12, padding: '12px 14px',
    cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'right', flexShrink: 0, minWidth: 100,
  },
  sessionWord: { fontSize: 14, fontWeight: 600, color: c.ink, marginBottom: 4, direction: 'ltr' },
  sessionCount: { fontSize: 11, color: c.ink3 },

  /* hub mode cards */
  modeCard: {
    width: '100%', borderRadius: 16, padding: '18px 20px',
    border: 'none', cursor: 'pointer', marginBottom: 12,
    textAlign: 'right', position: 'relative',
    fontFamily: 'inherit', display: 'block',
  },
  modeLangs: { fontSize: 14, marginBottom: 6 },
  modeTitle: { color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 3 },
  modeSub:   { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  modeChevron: {
    position: 'absolute', top: '50%', left: 18,
    transform: 'translateY(-50%)',
    color: 'rgba(255,255,255,0.3)', fontSize: 18,
  },

  /* source cards */
  sourceCard: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
    background: c.white, border: `1.5px solid ${c.border}`,
    borderRadius: 14, padding: '16px', marginBottom: 10,
    cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit',
  },
  sourceCardDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  sourceIcon:  { fontSize: 22, flexShrink: 0 },
  sourceTitle: { fontSize: 14, fontWeight: 600, color: c.ink, marginBottom: 2 },
  sourceSub:   { fontSize: 12, color: c.ink3 },

  /* level picker */
  levelGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 },
  levelBtn: {
    borderRadius: 14, padding: '22px 16px', border: 'none',
    cursor: 'pointer', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 6, fontFamily: 'inherit',
  },
  levelCode:  { fontSize: 30, fontWeight: 700, color: '#fff' },
  levelLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  /* type words */
  typeArea: {
    width: '100%', boxSizing: 'border-box',
    background: '#f0ede6', border: '1.5px solid rgba(0,0,0,0.08)',
    borderRadius: 10, padding: 14, color: '#1a1a2e',
    fontSize: 14, lineHeight: 1.7, resize: 'vertical',
    outline: 'none', fontFamily: 'inherit',
  },

  /* word picker */
  pickerHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  randomBtn: {
    background: c.skyL, border: `1px solid ${c.sky}`,
    borderRadius: 8, color: c.sky,
    cursor: 'pointer', fontSize: 12, fontWeight: 500,
    padding: '6px 12px', fontFamily: 'inherit',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  pickChip: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    background: c.surface, border: `1.5px solid ${c.border}`,
    borderRadius: 10, padding: '7px 12px',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: c.ink2,
    transition: 'all 0.15s',
  },
  pickChipOn: { background: c.mintL, borderColor: c.mint, color: c.mintD },
  pickTranslation: { fontSize: 10, color: c.ink3, marginTop: 2 },

  /* quiz */
  track: { height: 5, background: c.surface, borderRadius: 3, marginBottom: 24, overflow: 'hidden' },
  bar:   { height: '100%', borderRadius: 3, transition: 'width 0.3s' },
  card:  { borderRadius: 16, padding: '28px 24px', marginBottom: 20, textAlign: 'center' },
  dirLabel: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)',
    borderRadius: 6, padding: '3px 10px',
    fontSize: 11, fontWeight: 600, letterSpacing: '1px', marginBottom: 14,
  },
  qWord:   { fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 600, color: '#fff', marginBottom: 8 },
  qPrompt: { fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 },
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

  /* results */
  resultCard: {
    background: c.white, border: `1px solid ${c.border}`,
    borderRadius: 16, padding: '32px 24px', marginBottom: 24,
  },
  resultMsg:   { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: c.ink, marginBottom: 16 },
  resultScore: { fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 700, color: c.ink, lineHeight: 1 },
  resultDenom: { fontSize: 24, color: c.ink3 },
  resultPct:   { fontSize: 14, color: c.ink3, marginTop: 8 },

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

  ring: {
    width: 36, height: 36,
    border: `3px solid ${c.mintL}`, borderTop: `3px solid ${c.mint}`,
    borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },

  /* sentence write */
  feedbackCard: {
    background: c.white,
    border: `1.5px solid ${c.border}`,
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 12,
    transition: 'border-color 0.2s',
  },

  /* sentence match */
  sentenceCard: {
    width: '100%',
    background: c.white,
    border: `1.5px solid ${c.border}`,
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'right',
    transition: 'all 0.15s',
  },

  /* grammar quiz */
  tenseBadge: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.5px',
    marginTop: 12,
  },
  explanationBox: {
    background: c.surface,
    borderRadius: 10,
    padding: '12px 14px',
    marginTop: 12,
    fontSize: 13,
    color: c.ink2,
    lineHeight: 1.6,
  },
}
