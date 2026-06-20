import { useState, useEffect } from 'react'
import { supabase, supabaseMissingConfig } from './supabase'
import UploadWords from './UploadWords'
import StoryScreen from './StoryScreen'
import PlacementTestScreen from './PlacementTest'
import PracticeScreen from './PracticeScreen'
import GlobalWordBank from './GlobalWordBank'
import { SessionProvider } from './SessionContext'

/* ─── Tokens ─────────────────────────────────────────────────────── */
const c = {
  ink:'#1a1a2e', ink2:'#4a4a6a', ink3:'#8888aa',
  cream:'#faf8f4', surface:'#f0ede6', white:'#ffffff',
  mint:'#2ec4a0', mintL:'#e8faf5', mintD:'#1a9e80',
  gold:'#e8a020', goldL:'#fff8e8',
  rose:'#e05070', roseL:'#fef0f3',
  sky:'#4080f0',  skyL:'#eef4ff',
  border:'rgba(0,0,0,0.08)',
}

const MOD_COLORS = [
  { bg: c.skyL,  bar: c.sky  },
  { bg: c.mintL, bar: c.mint },
  { bg: c.roseL, bar: c.rose },
  { bg: c.goldL, bar: c.gold },
]

/* ─── Streak helper ──────────────────────────────────────────────── */
async function updateStreak(userId) {
  // Use Israel time (UTC+3) for day boundaries
  const israelNow  = new Date(Date.now() + 3 * 3600 * 1000)
  const today      = israelNow.toISOString().split('T')[0]
  const yesterday  = new Date(Date.now() + 3 * 3600 * 1000 - 86400000).toISOString().split('T')[0]

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_seen_date, streak')
    .eq('id', userId)
    .single()

  const lastSeen = profile?.last_seen_date
  const cur      = profile?.streak ?? 0

  if (lastSeen === today) return cur  // already counted today

  const newStreak = lastSeen === yesterday ? cur + 1 : 1
  await supabase.from('profiles')
    .update({ last_seen_date: today, streak: newStreak })
    .eq('id', userId)
  return newStreak
}

/* ─── Root ───────────────────────────────────────────────────────── */
export default function App() {
  if (supabaseMissingConfig) throw new Error('חסרות משתני סביבה: VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY')

  const [screen,      setScreen]      = useState('landing')
  const [tab,         setTab]         = useState('dashboard')
  const [user,        setUser]        = useState(null)
  const [streak,      setStreak]      = useState(0)
  const [authLoading, setAuthLoading] = useState(true)
  const [quickAdd,    setQuickAdd]    = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setAuthLoading(false), 5000)
    let isRecovery = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        isRecovery = true
        setUser(session?.user ?? null)
        setScreen('reset-password')
        setAuthLoading(false)
        clearTimeout(timeout)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setScreen('landing')
      }
    })

    async function restoreSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && !isRecovery) await enterApp(session.user)
      } catch (err) {
        console.error('שגיאת Auth:', err)
      } finally {
        if (!isRecovery) {
          clearTimeout(timeout)
          setAuthLoading(false)
        }
      }
    }
    restoreSession()
    return () => subscription.unsubscribe()
  }, [])

  async function enterApp(u) {
    setUser(u)
    const [{ data: profile }, newStreak] = await Promise.all([
      supabase.from('profiles').select('is_tested').eq('id', u.id).single(),
      updateStreak(u.id),
    ])
    setStreak(newStreak)
    if (profile?.is_tested === false) setScreen('placement-test')
    else { setTab('dashboard'); setScreen('app') }
  }

  function goHome() {
    if (user) { setTab('dashboard'); setScreen('app') }
    else setScreen('landing')
  }

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: c.cream, flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 28, color: c.mint }}>✦</div>
        <p style={{ color: c.ink3, fontSize: 14, fontFamily: 'sans-serif' }}>טוען...</p>
      </div>
    )
  }

  const isApp = screen === 'app'

  return (
    <SessionProvider user={user}>
      <div style={{ background: c.cream, minHeight: '100vh' }}>
        <TopBar
          user={user} screen={screen} streak={streak}
          onHome={goHome}
          onLogin={() => setScreen('auth')}
          onBack={() => setScreen(user ? 'app' : 'landing')}
          onLogout={() => { supabase.auth.signOut(); setUser(null); setScreen('landing') }}
        />

        <main style={{ paddingTop: 60, paddingBottom: isApp ? 86 : 0 }}>
          {screen === 'landing'          && <LandingScreen onStart={() => setScreen('auth')} />}
          {screen === 'auth'             && <AuthScreen    onSuccess={enterApp} />}
          {screen === 'reset-password'   && <ResetPasswordScreen onSuccess={() => { setTab('dashboard'); setScreen('app') }} />}
          {screen === 'placement-test'   && <PlacementTestScreen user={user} onComplete={() => { setTab('dashboard'); setScreen('app') }} />}
          {isApp && tab === 'dashboard' && <DashboardScreen user={user} streak={streak} onUpload={() => setTab('upload')} onQuickAdd={() => setQuickAdd(true)} />}
          {isApp && tab === 'upload'    && <UploadWords user={user} />}
          {isApp && tab === 'practice'  && <PracticeScreen user={user} />}
          {isApp && tab === 'wordbank'  && <GlobalWordBank />}
          {isApp && tab === 'profile'   && (
            <ProfileScreen
              user={user}
              onLogout={() => { supabase.auth.signOut(); setUser(null); setScreen('landing') }}
            />
          )}
        </main>

        {isApp && <BottomNav tab={tab} setTab={setTab} />}
        {isApp && quickAdd && (
          <QuickAddModal user={user} onClose={() => setQuickAdd(false)} />
        )}
      </div>
    </SessionProvider>
  )
}

/* ─── Top bar ────────────────────────────────────────────────────── */
function TopBar({ user, screen, streak, onHome, onLogin, onBack, onLogout }) {
  const isApp = screen === 'app'

  return (
    <header style={s.topBar}>
      <div style={s.wrap}>
        {isApp ? (
          <>
            <div style={s.greeting}>
              שלום, <b style={{ fontWeight: 500 }}>{user?.email?.split('@')[0]}</b> 👋
            </div>
            <div style={s.streakPill}>
              <span style={s.streakDot} />
              {streak} {streak === 1 ? 'יום רצוף' : 'ימים רצוף'}
            </div>
          </>
        ) : screen === 'landing' ? (
          <>
            <button style={s.brandBtn} onClick={onHome}>
              <span style={{ color: c.mint }}>✦</span> WordWise
            </button>
            <button style={s.topSignIn} onClick={onLogin}>התחבר</button>
          </>
        ) : (
          <>
            <button style={s.topBack} onClick={onBack}>← חזור</button>
            <button style={s.brandBtn} onClick={onHome}>
              <span style={{ color: c.mint }}>✦</span> WordWise
            </button>
          </>
        )}
      </div>
    </header>
  )
}

/* ─── Bottom nav ─────────────────────────────────────────────────── */
function BottomNav({ tab, setTab }) {
  const items = [
    { id: 'dashboard', label: 'בית',     iconBg: c.ink },
    { id: 'upload',    label: 'מילים',   iconBg: c.sky },
    { id: 'practice',  label: 'תרגול',   iconBg: c.rose },
    { id: 'wordbank',  label: 'מילון',    iconBg: c.gold },
    { id: 'profile',   label: 'פרופיל',  iconBg: c.surface, border: true },
  ]
  return (
    <nav style={s.bottomNav}>
      <div style={{ ...s.wrap, display: 'flex', padding: '8px 8px' }}>
        {items.map(item => {
          const on = tab === item.id
          return (
            <button
              key={item.id}
              style={{ ...s.navItem, ...(on ? s.navItemOn : {}) }}
              onClick={() => setTab(item.id)}
            >
              <div style={{
                ...s.navIcon,
                background: item.iconBg,
                ...(item.border ? { border: '1.5px solid rgba(0,0,0,0.12)' } : {}),
              }} />
              <span style={{ ...s.navLabel, color: on ? c.mintD : c.ink3 }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ─── Landing ────────────────────────────────────────────────────── */
function LandingScreen({ onStart }) {
  return (
    <div style={s.wrap}>

      {/* Hero card */}
      <div style={s.heroCard}>
        <div style={s.heroLabel}>✦ לפסיכומטרי · בגרות · פטור</div>
        <div style={{ ...s.heroWord, fontSize: 42 }}>WordWise</div>
        <div style={s.heroDef}>
          העלה מילים ממקורות שלך — Excel, PDF, תמונה ועוד.
          קבל סיפורים מותאמים אישית ותרגל עד שהמילים נצרבות.
        </div>
        <div style={s.heroActions}>
          <button style={s.btnPrimary} onClick={onStart}>התחל ללמוד בחינם</button>
        </div>
      </div>

      {/* Stats */}
      <div style={s.sectionTitle}>הסטטיסטיקות שלנו</div>
      <div style={s.statsRow}>
        <StatCard val="8"  lbl="מילים בסיפור" />
        <StatCard val="AI" lbl="מותאם אישית"  />
        <StatCard val="∞"  lbl="חזרות חכמות"  />
      </div>

      {/* Modules preview */}
      <div style={s.sectionTitle}>מה תלמד</div>
      <div style={s.modulesGrid}>
        <ModuleCard i={0} icon="📤" name="העלה מילים"  sub="5 מקורות"      prog={0} />
        <ModuleCard i={1} icon="📖" name="סיפורים"     sub="AI מותאם"      prog={0} />
        <ModuleCard i={2} icon="🧠" name="תרגול"       sub="כרטיסיות"      prog={0} />
        <ModuleCard i={3} icon="📊" name="התקדמות"     sub="מעקב ביצועים"  prog={0} />
      </div>

      <p style={{ textAlign: 'center', color: c.ink3, fontSize: 12, marginTop: 4, paddingBottom: 16 }}>
        ללא כרטיס אשראי · עברית מלאה
      </p>
    </div>
  )
}

/* ─── Auth ───────────────────────────────────────────────────────── */
function AuthScreen({ onSuccess }) {
  const [view, setView]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [message, setMessage]   = useState('')

  function reset() { setError(''); setMessage(''); setPassword('') }

  async function handleSubmit() {
    setLoading(true); setError(''); setMessage('')
    if (view === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('אימייל או סיסמה שגויים')
      else onSuccess(data.user)
    } else if (view === 'register') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError('שגיאה בהרשמה, נסה שוב')
      else setMessage('נשלח אימייל אימות — בדוק את תיבת הדואר שלך')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError('שגיאה בשליחת המייל')
      else setMessage('קישור לאיפוס נשלח — בדוק את המייל שלך')
    }
    setLoading(false)
  }

  if (view === 'forgot') {
    return (
      <div style={s.authPage}>
        <div style={s.authCard}>
          <h2 style={s.authTitle}>שכחת סיסמה?</h2>
          <p style={s.authSub}>נשלח לך קישור לאיפוס לאימייל</p>
          <input style={s.input} type="email" placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
          {error   && <p style={s.errMsg}>{error}</p>}
          {message && <p style={s.okMsg}>{message}</p>}
          <button style={s.submitBtn} onClick={handleSubmit} disabled={loading || !email}>
            {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
          </button>
          <button style={s.linkBtn} onClick={() => { setView('login'); reset() }}>
            חזור להתחברות
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.authPage}>
      <div style={s.authCard}>
        <h2 style={s.authTitle}>
          {view === 'login' ? 'ברוך הבא חזרה' : 'צור חשבון חינמי'}
        </h2>
        <p style={s.authSub}>
          {view === 'login' ? 'התחבר כדי להמשיך ללמוד' : 'הצטרף אלינו ולמד אנגלית חכם'}
        </p>
        <input style={s.input} type="email"    placeholder="אימייל" value={email}    onChange={e => setEmail(e.target.value)}    dir="ltr" />
        <input style={s.input} type="password" placeholder="סיסמה"  value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
        {error   && <p style={s.errMsg}>{error}</p>}
        {message && <p style={s.okMsg}>{message}</p>}
        <button style={s.submitBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'רגע...' : view === 'login' ? 'התחבר' : 'הירשם'}
        </button>
        {view === 'login' && (
          <button style={s.linkBtn} onClick={() => { setView('forgot'); reset() }}>
            שכחת סיסמה?
          </button>
        )}
        <div style={s.divider} />
        <button style={s.switchBtn} onClick={() => { setView(view === 'login' ? 'register' : 'login'); reset() }}>
          {view === 'login' ? 'אין לך חשבון? הירשם' : 'יש לך חשבון? התחבר'}
        </button>
      </div>
    </div>
  )
}

/* ─── Reset Password ─────────────────────────────────────────────── */
function ResetPasswordScreen({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleReset() {
    if (password.length < 6) { setError('סיסמה חייבת להכיל לפחות 6 תווים'); return }
    if (password !== confirm) { setError('הסיסמאות אינן תואמות'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError('שגיאה: ' + error.message)
    else onSuccess()
    setLoading(false)
  }

  return (
    <div style={s.authPage}>
      <div style={s.authCard}>
        <h2 style={s.authTitle}>סיסמה חדשה</h2>
        <p style={s.authSub}>בחר סיסמה חדשה לחשבון שלך</p>
        <input style={s.input} type="password" placeholder="סיסמה חדשה" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
        <input style={s.input} type="password" placeholder="אשר סיסמה"   value={confirm}  onChange={e => setConfirm(e.target.value)}  dir="ltr" />
        {error && <p style={s.errMsg}>{error}</p>}
        <button style={s.submitBtn} onClick={handleReset} disabled={loading || !password || !confirm}>
          {loading ? 'שומר...' : 'שמור סיסמה'}
        </button>
      </div>
    </div>
  )
}

/* ─── Dashboard ──────────────────────────────────────────────────── */
function DashboardScreen({ user, streak, onUpload, onQuickAdd }) {
  const [dailyWord, setDailyWord] = useState(null)
  const [stats,     setStats]     = useState({ total: 0, learned: 0, accuracy: null })

  useEffect(() => {
    fetchDailyWord()
    fetchStats()
  }, [])

  async function fetchDailyWord() {
    const { count } = await supabase
      .from('global_words')
      .select('*', { count: 'exact', head: true })
      .not('translation', 'is', null)
    if (!count) return
    // Changes at 06:00 AM Israel time (UTC+3)
    const dayIndex = Math.floor((Date.now() + 3 * 3600 * 1000) / (24 * 3600 * 1000))
    const offset   = dayIndex % count
    const { data } = await supabase
      .from('global_words')
      .select('word, translation, level')
      .not('translation', 'is', null)
      .order('id')
      .range(offset, offset)
    if (data?.[0]) setDailyWord(data[0])
  }

  async function fetchStats() {
    const { data } = await supabase
      .from('user_words')
      .select('correct_streak, wrong_count')
      .eq('user_id', user.id)
      .not('translation', 'is', null)
    if (!data) return
    const total        = data.length
    const learned      = data.filter(w => (w.correct_streak ?? 0) > 0).length
    const totalCorrect = data.reduce((s, w) => s + (w.correct_streak ?? 0), 0)
    const totalWrong   = data.reduce((s, w) => s + (w.wrong_count   ?? 0), 0)
    const accuracy     = totalCorrect + totalWrong > 0
      ? Math.round(totalCorrect / (totalCorrect + totalWrong) * 100)
      : null
    setStats({ total, learned, accuracy })
  }

  const vocabProg = stats.total > 0 ? Math.round(stats.learned / stats.total * 100) : 0

  return (
    <div style={s.wrap}>

      {/* Word of the day */}
      <div style={s.heroCard}>
        <div style={s.heroLabel}>מילת היום</div>
        <div style={s.heroWord}>{dailyWord?.word ?? '...'}</div>
        {dailyWord?.level && (
          <div style={s.heroPhonetic}>{dailyWord.level}</div>
        )}
        <div style={s.heroDef}>{dailyWord?.translation ?? ''}</div>
        <div style={s.heroActions}>
          <button style={s.btnPrimary}>תרגל עכשיו</button>
          <button style={s.btnGhost}>הוסף לרשימה</button>
        </div>
      </div>

      {/* Modules */}
      <div style={s.sectionTitle}>מודולי לימוד</div>
      <div style={s.modulesGrid}>
        <ModuleCard
          i={0} icon="📖" name="אוצר מילים"
          sub={stats.total > 0 ? `${stats.learned} / ${stats.total} מילים` : '0 מילים'}
          prog={vocabProg}
          onClick={onUpload}
        />
        <ModuleCard i={1} icon="✍️" name="דקדוק"  sub="בקרוב" prog={0} />
        <ModuleCard i={2} icon="🎧" name="האזנה"  sub="בקרוב" prog={0} />
        <ModuleCard i={3} icon="💬" name="שיחה"   sub="בקרוב" prog={0} />
      </div>

      {/* Stats */}
      <div style={s.sectionTitle}>הסטטיסטיקות שלך</div>
      <div style={s.statsRow}>
        <StatCard val={stats.total}                                    lbl="מילים"     />
        <StatCard val={stats.accuracy !== null ? `${stats.accuracy}%` : '—'} lbl="דיוק" />
        <StatCard val={streak}                                         lbl="ימים רצוף" />
      </div>

      {/* Quick lookup */}
      <button style={s.quickAddBtn} onClick={onQuickAdd}>
        + חפש וצרף מילה
      </button>

    </div>
  )
}

/* ─── Profile ────────────────────────────────────────────────────── */
function ProfileScreen({ user, onLogout }) {
  return (
    <div style={s.wrap}>
      <div style={{ ...s.heroCard, padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
        <div style={{ ...s.heroWord, fontSize: 24 }}>{user?.email?.split('@')[0]}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>{user?.email}</div>
      </div>
      <button
        style={{ ...s.submitBtn, background: c.surface, color: c.ink2, border: `1px solid ${c.border}`, marginTop: 20 }}
        onClick={onLogout}
      >
        יציאה מהחשבון
      </button>
    </div>
  )
}

/* ─── Coming Soon ────────────────────────────────────────────────── */
function ComingSoon({ icon, label }) {
  return (
    <div style={{ ...s.wrap, textAlign: 'center', paddingTop: 60 }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>{icon}</div>
      <h2 style={{ ...s.authTitle, fontFamily: "'Playfair Display', serif" }}>{label}</h2>
      <p style={{ color: c.ink3, marginTop: 8 }}>בקרוב...</p>
    </div>
  )
}

/* ─── Shared small components ────────────────────────────────────── */
function ModuleCard({ i, icon, name, sub, prog, onClick }) {
  const col = MOD_COLORS[i % 4]
  return (
    <div
      style={{ ...s.moduleCard, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ ...s.moduleIcon, background: col.bg }}>{icon}</div>
      <div style={s.moduleName}>{name}</div>
      <div style={s.moduleSub}>{sub}</div>
      <div style={s.modTrack}>
        <div style={{ ...s.modBar, background: col.bar, width: (prog || 0) + '%' }} />
      </div>
    </div>
  )
}

function StatCard({ val, lbl }) {
  return (
    <div style={s.statCard}>
      <div style={s.statVal}>{val}</div>
      <div style={s.statLbl}>{lbl}</div>
    </div>
  )
}

/* ─── Quick Add Modal ────────────────────────────────────────────── */
function QuickAddModal({ user, onClose }) {
  const [word,        setWord]        = useState('')
  const [result,      setResult]      = useState(null)  // { translation, level, fromGlobal }
  const [searching,   setSearching]   = useState(false)
  const [adding,      setAdding]      = useState(false)
  const [added,       setAdded]       = useState(false)
  const [error,       setError]       = useState('')

  async function lookup() {
    const w = word.trim().toLowerCase()
    if (!w) return
    setSearching(true); setResult(null); setAdded(false); setError('')

    const { data } = await supabase
      .from('global_words')
      .select('translation, level')
      .ilike('word', w)
      .limit(1)
      .single()

    if (data?.translation) {
      setResult({ translation: data.translation, level: data.level, fromGlobal: true })
      setSearching(false)
      return
    }

    // Not in global_words — fetch from AI
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-words`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ words: [w] }),
        }
      )
      const json = await res.json()
      const item = Array.isArray(json) ? json[0] : null
      if (item?.translation) {
        setResult({ translation: item.translation, level: item.level, fromGlobal: false })
      } else {
        setResult({ translation: null })
      }
    } catch {
      setError('שגיאה בחיפוש התרגום')
    }
    setSearching(false)
  }

  async function addToVocab() {
    const w = word.trim().toLowerCase()
    if (!w) return
    setAdding(true)
    const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    const { error: upsertErr } = await supabase
      .from('user_words')
      .upsert(
        {
          user_id: user.id,
          word: w,
          source: 'manual',
          translation: result?.translation ?? null,
          level: result?.level && VALID_LEVELS.has(result.level) ? result.level : null,
        },
        { onConflict: 'user_id,word' }
      )
    if (upsertErr) {
      setError('שגיאה בהוספה: ' + upsertErr.message)
    } else {
      setAdded(true)
    }
    setAdding(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter') lookup()
  }

  return (
    <div
      style={sq.overlay}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={sq.card}>
        <div style={sq.header}>
          <span style={sq.title}>חיפוש מילה</span>
          <button style={sq.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={sq.row}>
          <input
            style={sq.input}
            placeholder="הקלד מילה באנגלית..."
            value={word}
            onChange={e => { setWord(e.target.value); setResult(null); setAdded(false) }}
            onKeyDown={handleKey}
            dir="ltr"
            autoFocus
          />
          <button
            style={sq.searchBtn}
            onClick={lookup}
            disabled={!word.trim() || searching}
          >
            {searching ? '...' : 'חפש'}
          </button>
        </div>

        {error && <p style={sq.errMsg}>{error}</p>}

        {result && (
          <div style={sq.resultBox}>
            {result.translation ? (
              <>
                <div style={sq.wordLabel}>{word.trim().toLowerCase()}</div>
                {result.level && <div style={sq.levelBadge}>{result.level}</div>}
                <div style={sq.translation}>{result.translation}</div>
                {added ? (
                  <div style={sq.addedMsg}>✓ נוספה לרשימה שלך!</div>
                ) : (
                  <button style={sq.addBtn} onClick={addToVocab} disabled={adding}>
                    {adding ? 'מוסיף...' : 'הוסף לרשימה שלי'}
                  </button>
                )}
              </>
            ) : (
              <div style={sq.noResult}>לא נמצא תרגום למילה זו</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const sq = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '0 0 24px',
  },
  card: {
    background: '#fff',
    borderRadius: 18,
    padding: '20px 20px 24px',
    width: '100%',
    maxWidth: 420,
    margin: '0 12px',
    direction: 'rtl',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a2e',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    color: '#8888aa',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  row: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    background: '#f0ede6',
    border: '1.5px solid rgba(0,0,0,0.08)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 15,
    color: '#1a1a2e',
    outline: 'none',
    fontFamily: 'inherit',
  },
  searchBtn: {
    background: '#2ec4a0',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 18px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  resultBox: {
    background: '#f0ede6',
    borderRadius: 12,
    padding: '16px',
    textAlign: 'center',
    direction: 'rtl',
  },
  wordLabel: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 4,
  },
  levelBadge: {
    display: 'inline-block',
    background: '#e8faf5',
    color: '#1a9e80',
    border: '1px solid #b0ead8',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 10px',
    marginBottom: 10,
    letterSpacing: '0.5px',
  },
  translation: {
    fontSize: 18,
    color: '#4a4a6a',
    marginBottom: 16,
    lineHeight: 1.4,
  },
  addBtn: {
    background: '#2ec4a0',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 24px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
  },
  addedMsg: {
    color: '#1a9e80',
    fontSize: 15,
    fontWeight: 500,
    padding: '8px 0',
  },
  noResult: {
    color: '#8888aa',
    fontSize: 14,
    padding: '8px 0',
  },
  errMsg: {
    color: '#e05070',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
}

/* ─── FAB ────────────────────────────────────────────────────────── */

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = {
  /* layout */
  wrap: {
    maxWidth: 420,
    margin: '0 auto',
    padding: '20px 16px',
    direction: 'rtl',
  },

  /* top bar */
  topBar: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: 60,
    background: 'rgba(250,248,244,0.94)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(0,0,0,0.07)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 13,
    color: c.ink3,
    direction: 'rtl',
  },
  streakPill: {
    background: c.goldL,
    border: '1.5px solid #f0d090',
    borderRadius: 20,
    padding: '5px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    color: '#b87800',
  },
  streakDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: c.gold,
    flexShrink: 0,
  },
  brandBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    color: c.ink,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  topSignIn: {
    background: c.mint,
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    padding: '7px 14px',
  },
  topBack: {
    background: 'transparent',
    border: 'none',
    color: c.ink3,
    cursor: 'pointer',
    fontSize: 14,
    padding: 0,
  },

  /* bottom nav */
  bottomNav: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    background: c.white,
    borderTop: '1px solid rgba(0,0,0,0.07)',
    zIndex: 100,
  },
  navItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '8px 4px',
    borderRadius: 8,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
  },
  navItemOn: {
    background: c.mintL,
  },
  navIcon: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: 500,
    letterSpacing: '0.5px',
  },

  /* hero card */
  heroCard: {
    background: c.ink,
    borderRadius: 14,
    padding: '22px 20px 20px',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    direction: 'rtl',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '1.5px',
    color: c.mint,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroWord: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 38,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 4,
    lineHeight: 1.1,
  },
  heroPhonetic: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  heroDef: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.55,
    marginBottom: 18,
  },
  heroActions: { display: 'flex', gap: 8 },
  btnPrimary: {
    background: c.mint,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnGhost: {
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* section title */
  sectionTitle: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    color: c.ink3,
    marginBottom: 12,
    direction: 'rtl',
  },

  /* modules grid */
  modulesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 24,
  },
  moduleCard: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    padding: 16,
    direction: 'rtl',
  },
  moduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    fontSize: 16,
  },
  moduleName: { fontSize: 13, fontWeight: 500, marginBottom: 3 },
  moduleSub:  { fontSize: 11, color: c.ink3 },
  modTrack: {
    height: 3,
    background: '#eee',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  modBar: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s',
  },

  /* stats row */
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,1fr)',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    padding: '14px 12px',
    textAlign: 'center',
  },
  statVal: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    fontWeight: 600,
    color: c.ink,
  },
  statLbl: {
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: c.ink3,
    marginTop: 3,
  },

  /* auth */
  authPage: {
    maxWidth: 420,
    margin: '0 auto',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    minHeight: 'calc(100vh - 60px)',
    justifyContent: 'center',
    direction: 'rtl',
  },
  authCard: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 16,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  authTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 24,
    fontWeight: 600,
    color: c.ink,
    textAlign: 'center',
  },
  authSub: {
    fontSize: 13,
    color: c.ink3,
    textAlign: 'center',
    marginBottom: 4,
  },
  input: {
    background: c.surface,
    border: `1.5px solid ${c.border}`,
    borderRadius: 10,
    padding: '13px 14px',
    fontSize: 14,
    color: c.ink,
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
  },
  submitBtn: {
    background: c.mint,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'inherit',
    marginTop: 4,
  },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: c.ink3,
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'center',
    padding: '4px 0',
    fontFamily: 'inherit',
  },
  divider: {
    height: 1,
    background: c.border,
    margin: '4px 0',
  },
  switchBtn: {
    background: 'transparent',
    border: 'none',
    color: c.mint,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'center',
    padding: '4px 0',
    fontFamily: 'inherit',
  },
  errMsg: { color: c.rose, fontSize: 12, textAlign: 'center' },
  okMsg:  { color: c.mintD, fontSize: 12, textAlign: 'center' },

  quickAddBtn: {
    width: '100%',
    background: c.mintL,
    border: `1.5px solid ${c.mint}`,
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 500,
    color: c.mintD,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: 16,
    direction: 'rtl',
  },

  fab: {
    position: 'fixed',
    bottom: 100,
    left: '50%',
    transform: 'translateX(-50%)',
    background: c.mint,
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 52,
    height: 52,
    fontSize: 28,
    lineHeight: '52px',
    textAlign: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(46,196,160,0.4)',
    zIndex: 150,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
}
