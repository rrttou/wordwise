import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import UploadWords from './UploadWords'

function App() {
  const [screen, setScreen] = useState('landing')
  const [tab, setTab]       = useState('dashboard')
  const [user, setUser]     = useState(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setUser(session?.user ?? null)
        setScreen('reset-password')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  function goHome() {
    if (user) { setTab('dashboard'); setScreen('app') }
    else setScreen('landing')
  }

  const showAppTabs = screen === 'app'

  return (
    <div>
      <Navbar
        user={user}
        tab={tab}
        setTab={setTab}
        screen={screen}
        onHome={goHome}
        onLogin={() => setScreen('auth')}
        onLogout={() => { supabase.auth.signOut(); setUser(null); setScreen('landing') }}
      />

      <main style={{ paddingTop: 68 }}>
        {screen === 'landing'        && <LandingScreen onStart={() => setScreen('auth')} />}
        {screen === 'auth'           && <AuthScreen onSuccess={u => { setUser(u); setScreen('app') }} />}
        {screen === 'reset-password' && <ResetPasswordScreen onSuccess={() => setScreen('app')} />}
        {screen === 'app' && tab === 'dashboard' && <DashboardScreen user={user} onUpload={() => setTab('upload')} />}
        {screen === 'app' && tab === 'upload'    && <UploadWords user={user} />}
      </main>
    </div>
  )
}

/* ─── Navbar ─────────────────────────────────────────────────────── */
function Navbar({ user, tab, setTab, screen, onHome, onLogin, onLogout }) {
  const loggedIn = !!user

  return (
    <nav style={styles.navbar}>

      {/* Brand — always a home link */}
      <button style={styles.navBrand} onClick={onHome}>
        <span style={styles.navStar}>✦</span>
        <span style={styles.navName}>WordWise</span>
      </button>

      {/* Centre links — only when logged in */}
      {loggedIn && (
        <div style={styles.navLinks}>
          {[
            { id: 'dashboard', label: 'בית'          },
            { id: 'upload',    label: 'העלה מילים'   },
          ].map(item => (
            <button
              key={item.id}
              style={{ ...styles.navLink, ...(screen === 'app' && tab === item.id ? styles.navLinkOn : {}) }}
              onClick={() => { setTab(item.id) }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Right side */}
      <div style={styles.navRight}>
        {loggedIn ? (
          <>
            <span style={styles.navUser}>{user.email?.split('@')[0]}</span>
            <button style={styles.navLogout} onClick={onLogout}>יציאה</button>
          </>
        ) : (
          <button style={styles.navSignIn} onClick={onLogin}>
            התחבר / הירשם
          </button>
        )}
      </div>

    </nav>
  )
}

/* ─── Landing ────────────────────────────────────────────────────── */
function LandingScreen({ onStart }) {
  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.badge}>✦ לפסיכומטרי · בגרות · פטור</div>
        <h1 style={styles.title}>
          לומדים אנגלית<br />
          <span style={styles.titleAccent}>דרך סיפורים</span>
        </h1>
        <p style={styles.subtitle}>
          העלה מאגר מילים, קבל סיפור מותאם אישית,<br />
          ותרגל עד שהמילים נצרבות.
        </p>
        <div style={styles.statsRow}>
          <Stat number="8"  label="מילים בכל סיפור" />
          <Stat number="AI" label="סיפורים מותאמים" />
          <Stat number="∞"  label="חזרות חכמות"     />
        </div>
        <button style={styles.ctaBtn} onClick={onStart}>התחל ללמוד בחינם</button>
        <p style={styles.smallNote}>ללא כרטיס אשראי · עברית מלאה</p>
      </div>
    </div>
  )
}

function Stat({ number, label }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statNum}>{number}</span>
      <span style={styles.statLabel}>{label}</span>
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
    } else if (view === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError('שגיאה בשליחת המייל: ' + error.message)
      else setMessage('קישור לאיפוס סיסמה נשלח — בדוק את תיבת הדואר שלך')
    }
    setLoading(false)
  }

  if (view === 'forgot') {
    return (
      <div style={styles.page}>
        <div style={styles.authCard}>
          <button onClick={() => { setView('login'); reset() }} style={styles.backBtn}>← חזור להתחברות</button>
          <h2 style={styles.authTitle}>שכחת סיסמה?</h2>
          <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 4 }}>
            הכנס את האימייל שלך ונשלח לך קישור לאיפוס
          </p>
          <input style={styles.input} type="email" placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
          {error   && <p style={styles.errorMsg}>{error}</p>}
          {message && <p style={styles.successMsg}>{message}</p>}
          <button style={{ ...styles.ctaBtn, marginTop: 8 }} onClick={handleSubmit} disabled={loading || !email}>
            {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.authCard}>
        <h2 style={styles.authTitle}>{view === 'login' ? 'ברוך הבא חזרה' : 'צור חשבון חינמי'}</h2>
        <input style={styles.input} type="email"    placeholder="אימייל" value={email}    onChange={e => setEmail(e.target.value)}    dir="ltr" />
        <input style={styles.input} type="password" placeholder="סיסמה"  value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
        {error   && <p style={styles.errorMsg}>{error}</p>}
        {message && <p style={styles.successMsg}>{message}</p>}
        <button style={{ ...styles.ctaBtn, marginTop: 8 }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'רגע...' : view === 'login' ? 'התחבר' : 'הירשם'}
        </button>
        {view === 'login' && (
          <button style={styles.forgotBtn} onClick={() => { setView('forgot'); reset() }}>
            שכחת סיסמה?
          </button>
        )}
        <button style={styles.switchBtn} onClick={() => { setView(view === 'login' ? 'register' : 'login'); reset() }}>
          {view === 'login' ? 'אין לך חשבון? הירשם' : 'יש לך חשבון? התחבר'}
        </button>
      </div>
    </div>
  )
}

/* ─── Reset Password ─────────────────────────────────────────────── */
function ResetPasswordScreen({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleReset() {
    if (password.length < 6)  { setError('סיסמה חייבת להכיל לפחות 6 תווים'); return }
    if (password !== confirm)  { setError('הסיסמאות אינן תואמות'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError('שגיאה בעדכון הסיסמה: ' + error.message)
    else onSuccess()
    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.authCard}>
        <h2 style={styles.authTitle}>הגדר סיסמה חדשה</h2>
        <input style={styles.input} type="password" placeholder="סיסמה חדשה" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
        <input style={styles.input} type="password" placeholder="אשר סיסמה"   value={confirm}  onChange={e => setConfirm(e.target.value)}  dir="ltr" />
        {error && <p style={styles.errorMsg}>{error}</p>}
        <button style={{ ...styles.ctaBtn, marginTop: 8 }} onClick={handleReset} disabled={loading || !password || !confirm}>
          {loading ? 'שומר...' : 'שמור סיסמה חדשה'}
        </button>
      </div>
    </div>
  )
}

/* ─── Dashboard ──────────────────────────────────────────────────── */
function DashboardScreen({ user, onUpload }) {
  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <h2 style={{ fontSize: 28 }}>שלום, {user?.email?.split('@')[0]}! 👋</h2>
        <p style={{ color: '#94a3b8', marginTop: 8 }}>מה נלמד היום?</p>
        <div style={styles.dashGrid}>
          <DashCard icon="📤" title="העלה מילים" desc="Excel, PDF, Word, תמונה או כתיבה חופשית" onClick={onUpload} accent />
          <DashCard icon="📖" title="סיפורים"    desc="קרא סיפורים עם המילים שלך — בקרוב" />
          <DashCard icon="🧠" title="תרגול"      desc="כרטיסיות חכמות — בקרוב" />
          <DashCard icon="📊" title="התקדמות"    desc="מעקב ביצועים — בקרוב" />
        </div>
      </div>
    </div>
  )
}

function DashCard({ icon, title, desc, onClick, accent }) {
  return (
    <div
      style={{ ...styles.dashCard, ...(accent ? styles.dashCardAccent : {}), cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <span style={styles.dashIcon}>{icon}</span>
      <h3 style={styles.dashCardTitle}>{title}</h3>
      <p style={styles.dashCardDesc}>{desc}</p>
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const styles = {
  navbar: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: 64,
    background: 'rgba(15,15,26,0.92)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    zIndex: 100,
    direction: 'rtl',
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  navStar: { color: '#a78bfa', fontSize: 18 },
  navName: { fontSize: 18, fontWeight: 700, color: '#fff' },
  navLinks: { display: 'flex', gap: 4 },
  navLink: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 15,
    padding: '7px 14px',
    borderRadius: 8,
  },
  navLinkOn: {
    background: 'rgba(99,102,241,0.15)',
    color: '#a5b4fc',
  },
  navRight:  { display: 'flex', alignItems: 'center', gap: 12 },
  navUser:   { color: '#475569', fontSize: 13 },
  navLogout: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 13,
    padding: '5px 12px',
  },
  navSignIn: {
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    padding: '7px 16px',
  },

  page: {
    minHeight: 'calc(100vh - 68px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    direction: 'rtl',
  },
  hero: {
    maxWidth: 560,
    width: '100%',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },

  badge: {
    background: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.4)',
    color: '#a5b4fc',
    padding: '6px 16px',
    borderRadius: 20,
    fontSize: 13,
  },
  title: { fontSize: 48, fontWeight: 700, lineHeight: 1.2 },
  titleAccent: {
    background: 'linear-gradient(135deg,#6366f1,#a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle:  { fontSize: 17, color: '#94a3b8', lineHeight: 1.7 },
  statsRow:  { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  statCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: '14px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    minWidth: 100,
  },
  statNum:   { fontSize: 26, fontWeight: 700, color: '#a78bfa' },
  statLabel: { fontSize: 12, color: '#64748b' },
  ctaBtn: {
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    padding: '16px 40px',
    fontSize: 17,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    maxWidth: 320,
  },
  smallNote: { fontSize: 12, color: '#475569' },

  authCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: '40px 32px',
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    direction: 'rtl',
  },
  authTitle: { fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 8 },
  input: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: '14px 16px',
    fontSize: 15,
    color: '#fff',
    outline: 'none',
    width: '100%',
  },
  errorMsg:   { color: '#f87171', fontSize: 13, textAlign: 'center' },
  successMsg: { color: '#4ade80', fontSize: 13, textAlign: 'center' },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 15,
    textAlign: 'right',
    padding: 0,
  },
  forgotBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
  },
  switchBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6366f1',
    cursor: 'pointer',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },

  dashGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2,1fr)',
    gap: 14,
    width: '100%',
    marginTop: 8,
  },
  dashCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 16,
    padding: '22px 20px',
    textAlign: 'right',
  },
  dashCardAccent: {
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.35)',
  },
  dashIcon:      { fontSize: 28 },
  dashCardTitle: { fontSize: 16, fontWeight: 600, marginTop: 10, marginBottom: 6 },
  dashCardDesc:  { fontSize: 13, color: '#64748b', lineHeight: 1.5 },
}

export default App
