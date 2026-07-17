import { c, shadow, font } from '../theme'

/* ─── Brand mark ─────────────────────────────────────────────────── */
function Brand({ onClick }) {
  return (
    <button style={s.brand} onClick={onClick} aria-label="WordWise home">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z"
          fill={c.mint} />
      </svg>
      <span style={s.brandName}>WordWise</span>
    </button>
  )
}

/* ─── Top bar ────────────────────────────────────────────────────── */
export function TopBar({ user, screen, streak, onHome, onLogin, onBack, onLogout }) {
  const isApp = screen === 'app'

  return (
    <header style={s.topBar}>
      <div style={s.topBarInner}>

        {isApp ? (
          <>
            <div style={s.greeting}>
              <span style={s.greetingHi}>שלום,</span>{' '}
              <span style={s.greetingName}>{user?.email?.split('@')[0]}</span>
            </div>
            <div style={s.streakPill}>
              <FireIcon />
              <span>{streak}</span>
              <span style={s.streakUnit}>{streak === 1 ? 'יום' : 'ימים'}</span>
            </div>
          </>
        ) : screen === 'landing' ? (
          <>
            <Brand onClick={onHome} />
            <button style={s.signInBtn} onClick={onLogin}>התחבר</button>
          </>
        ) : (
          <>
            <button style={s.backBtn} onClick={onBack}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4L6 9L11 14" stroke={c.ink3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>חזור</span>
            </button>
            <Brand onClick={onHome} />
          </>
        )}

      </div>
    </header>
  )
}

/* ─── Bottom nav ─────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'dashboard', label: 'בית',    Icon: HomeIcon    },
  { id: 'upload',    label: 'מילים',  Icon: WordsIcon   },
  { id: 'practice',  label: 'תרגול',  Icon: PracticeIcon},
  { id: 'wordbank',  label: 'מילון',  Icon: DictIcon    },
  { id: 'profile',   label: 'פרופיל', Icon: ProfileIcon },
]

export function BottomNav({ tab, setTab }) {
  return (
    <nav style={s.bottomNav} role="navigation" aria-label="ניווט ראשי">
      <div style={s.bottomNavInner}>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
            >
              <span style={{ ...s.navIconWrap, ...(active ? s.navIconActive : {}) }}>
                <Icon active={active} />
              </span>
              <span style={{ ...s.navLabel, color: active ? c.mintD : c.ink3 }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ─── SVG Icons ──────────────────────────────────────────────────── */
function HomeIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 9.5L10 3L17 9.5V17H13V13H7V17H3V9.5Z"
        stroke={active ? c.mintD : c.ink3}
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill={active ? c.mintL : 'none'}
      />
    </svg>
  )
}

function WordsIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="3"
        stroke={active ? c.mintD : c.ink3}
        strokeWidth="1.6"
        fill={active ? c.mintL : 'none'}
      />
      <path d="M6 7H14M6 10H12M6 13H10"
        stroke={active ? c.mintD : c.ink3}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PracticeIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7"
        stroke={active ? c.mintD : c.ink3}
        strokeWidth="1.6"
        fill={active ? c.mintL : 'none'}
      />
      <path d="M8 7.5L13 10L8 12.5V7.5Z"
        fill={active ? c.mintD : c.ink3}
      />
    </svg>
  )
}

function DictIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 5C4 3.9 4.9 3 6 3H16V17H6C4.9 17 4 16.1 4 15V5Z"
        stroke={active ? c.mintD : c.ink3}
        strokeWidth="1.6"
        fill={active ? c.mintL : 'none'}
      />
      <path d="M4 15C4 13.9 4.9 13 6 13H16"
        stroke={active ? c.mintD : c.ink3}
        strokeWidth="1.6"
      />
    </svg>
  )
}

function ProfileIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5"
        stroke={active ? c.mintD : c.ink3}
        strokeWidth="1.6"
        fill={active ? c.mintL : 'none'}
      />
      <path d="M3.5 17C3.5 13.96 6.46 11.5 10 11.5C13.54 11.5 16.5 13.96 16.5 17"
        stroke={active ? c.mintD : c.ink3}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function FireIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1C7 1 9.5 4 9.5 6.5C9.5 7.88 8.38 9 7 9C5.62 9 4.5 7.88 4.5 6.5C4.5 5.5 5 4.5 5 4.5C5 4.5 4 6 4 7C4 9.21 5.79 11 8 11C10.21 11 12 9.21 12 7C12 4.5 9.5 1 7 1Z"
        fill={c.gold}
      />
    </svg>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = {
  topBar: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: 60,
    background: 'rgba(250,248,244,0.92)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: `1px solid ${c.border}`,
    zIndex: 100,
  },
  topBarInner: {
    maxWidth: 480,
    margin: '0 auto',
    height: '100%',
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    direction: 'rtl',
  },
  brand: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: 0,
  },
  brandName: {
    fontSize: 16,
    fontWeight: 700,
    color: c.ink,
    fontFamily: font.sans,
    letterSpacing: '-0.3px',
  },
  greeting: {
    fontSize: 14,
    color: c.ink,
    direction: 'rtl',
  },
  greetingHi: {
    color: c.ink3,
    fontWeight: 400,
  },
  greetingName: {
    fontWeight: 600,
    color: c.ink,
  },
  streakPill: {
    background: c.goldL,
    border: `1.5px solid #f0d090`,
    borderRadius: 20,
    padding: '5px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    fontWeight: 600,
    color: '#b87800',
  },
  streakUnit: {
    fontWeight: 400,
    fontSize: 11,
    color: '#c89200',
  },
  signInBtn: {
    background: c.mint,
    border: 'none',
    borderRadius: 9,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 16px',
    letterSpacing: '0.1px',
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: c.ink3,
    cursor: 'pointer',
    fontSize: 13,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },

  bottomNav: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: `1px solid ${c.border}`,
    zIndex: 100,
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  bottomNavInner: {
    maxWidth: 480,
    margin: '0 auto',
    display: 'flex',
    padding: '6px 8px 8px',
  },
  navItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '6px 4px',
    borderRadius: 10,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    transition: 'background 0.15s',
  },
  navItemActive: {
    background: c.mintL,
  },
  navIconWrap: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    transition: 'transform 0.15s',
  },
  navIconActive: {
    transform: 'scale(1.08)',
  },
  navLabel: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.4px',
    transition: 'color 0.15s',
  },
}
