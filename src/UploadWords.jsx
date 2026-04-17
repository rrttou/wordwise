import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','as','is','was','are','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','can','could',
  'not','this','that','these','those','it','its','they','them','their','there',
  'we','our','you','your','he','she','his','her','me','my','i','if','so','then',
  'than','more','also','all','any','each','up','out','into','about','after',
  'before','while','what','which','who','how','when','where','their','its',
])

function extractWords(text) {
  const words = text.match(/[a-zA-Z]{3,}/g) || []
  return [...new Set(words.map(w => w.toLowerCase()).filter(w => !STOP_WORDS.has(w)))]
}

const SOURCES = [
  { id: 'excel', label: 'Excel',           icon: '📊', accept: '.xlsx,.xls,.csv' },
  { id: 'word',  label: 'Word',            icon: '📝', accept: '.docx,.doc'      },
  { id: 'pdf',   label: 'PDF',             icon: '📄', accept: '.pdf'            },
  { id: 'image', label: 'תמונה',           icon: '🖼️', accept: '.png,.jpg,.jpeg,.webp,.bmp' },
  { id: 'free',  label: 'כתיבה חופשית',   icon: '✏️', accept: null              },
]

const SOURCE_ICON = Object.fromEntries(SOURCES.map(s => [s.id, s.icon]))

export default function UploadWords({ user }) {
  const [activeSource, setActiveSource]     = useState('excel')
  const [dragging, setDragging]             = useState(false)
  const [processing, setProcessing]         = useState(false)
  const [progress, setProgress]             = useState(0)
  const [statusText, setStatusText]         = useState('')
  const [extracted, setExtracted]           = useState([])
  const [freeText, setFreeText]             = useState('')
  const [manualWord, setManualWord]         = useState('')
  const [savedWords, setSavedWords]         = useState([])
  const [loadingBank, setLoadingBank]       = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [toast, setToast]                   = useState(null)
  const [setupNeeded, setSetupNeeded]       = useState(false)
  const [bankFilter, setBankFilter]         = useState('')
  const fileInputRef = useRef()

  useEffect(() => { loadBank() }, [])

  function showToast(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadBank() {
    setLoadingBank(true)
    const { data, error } = await supabase
      .from('user_words')
      .select('word, source, created_at')
      .order('created_at', { ascending: false })
    setLoadingBank(false)
    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) setSetupNeeded(true)
    } else {
      setSavedWords(data || [])
    }
  }

  async function processFile(file) {
    setProcessing(true)
    setProgress(0)
    setStatusText('קורא קובץ...')
    setExtracted([])
    try {
      let text = ''

      if (activeSource === 'excel') {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf)
        for (const name of wb.SheetNames) {
          text += XLSX.utils.sheet_to_txt(wb.Sheets[name]) + '\n'
        }

      } else if (activeSource === 'word') {
        const mod = await import('mammoth')
        const mammoth = mod.default ?? mod
        const buf = await file.arrayBuffer()
        const res = await mammoth.extractRawText({ arrayBuffer: buf })
        text = res.value

      } else if (activeSource === 'pdf') {
        const buf = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          text += content.items.map(item => item.str).join(' ') + '\n'
          setProgress(Math.round((i / pdf.numPages) * 100))
          setStatusText(`מעבד עמוד ${i} מתוך ${pdf.numPages}...`)
        }

      } else if (activeSource === 'image') {
        setStatusText('מריץ זיהוי טקסט (OCR)...')
        const { recognize } = await import('tesseract.js')
        const result = await recognize(file, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100))
              setStatusText(`מזהה טקסט... ${Math.round(m.progress * 100)}%`)
            }
          },
        })
        text = result.data.text
      }

      const words = extractWords(text)
      setExtracted(words)
      setStatusText('')
    } catch (err) {
      showToast('error', 'שגיאה בקריאת הקובץ: ' + err.message)
      setStatusText('')
    }
    setProcessing(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileInput(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleFreeTextExtract() {
    setExtracted(extractWords(freeText))
  }

  function removeExtracted(word) {
    setExtracted(p => p.filter(w => w !== word))
  }

  function addManualWord() {
    const w = manualWord.trim().toLowerCase()
    if (w && !extracted.includes(w)) setExtracted(p => [...p, w])
    setManualWord('')
  }

  async function saveWords() {
    if (!extracted.length) return
    setSaving(true)
    const rows = extracted.map(word => ({ user_id: user.id, word, source: activeSource }))
    const { error } = await supabase
      .from('user_words')
      .upsert(rows, { onConflict: 'user_id,word' })
    if (error) {
      if (error.code === '42P01') setSetupNeeded(true)
      else showToast('error', 'שגיאה בשמירה: ' + error.message)
    } else {
      showToast('success', `✓ ${extracted.length} מילים נשמרו!`)
      setExtracted([])
      loadBank()
    }
    setSaving(false)
  }

  async function deleteWord(word) {
    await supabase.from('user_words').delete().match({ user_id: user.id, word })
    setSavedWords(p => p.filter(w => w.word !== word))
  }

  const src = SOURCES.find(s => s.id === activeSource)
  const filteredBank = bankFilter
    ? savedWords.filter(w => w.word.includes(bankFilter.toLowerCase()))
    : savedWords

  return (
    <div style={s.page}>

      {/* ── Setup banner ── */}
      {setupNeeded && <SetupBanner />}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ ...s.toast, ...(toast.type === 'success' ? s.toastSuccess : s.toastError) }}>
          {toast.text}
          <button style={s.toastX} onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      {/* ── Page header ── */}
      <div style={s.header}>
        <h1 style={s.title}>העלה מילים חדשות</h1>
        <p style={s.subtitle}>בחר מקור, העלה קובץ או כתוב — המילים יישמרו במאגר שלך</p>
      </div>

      {/* ── Source tabs ── */}
      <div style={s.tabs}>
        {SOURCES.map(src => (
          <button
            key={src.id}
            style={{ ...s.tab, ...(activeSource === src.id ? s.tabOn : {}) }}
            onClick={() => { setActiveSource(src.id); setExtracted([]) }}
          >
            <span>{src.icon}</span>
            <span>{src.label}</span>
          </button>
        ))}
      </div>

      {/* ── Upload / input area ── */}
      <div style={s.uploadCard}>
        {activeSource === 'free' ? (
          <div style={s.freeCol}>
            <textarea
              style={s.textarea}
              placeholder="הדבק או הקלד טקסט באנגלית..."
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              dir="ltr"
            />
            <button style={s.extractBtn} onClick={handleFreeTextExtract} disabled={!freeText.trim()}>
              חלץ מילים
            </button>
          </div>
        ) : (
          <div
            style={{ ...s.dropzone, ...(dragging ? s.dropzoneOn : {}) }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !processing && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={src.accept}
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />

            {processing ? (
              <div style={s.progressBox}>
                <div style={s.ring} />
                <p style={s.progressLabel}>{statusText}</p>
                {progress > 0 && (
                  <div style={s.progressBarWrap}>
                    <div style={{ ...s.progressBar, width: progress + '%' }} />
                  </div>
                )}
              </div>
            ) : (
              <div style={s.dropContent}>
                <span style={s.dropEmoji}>{src.icon}</span>
                <p style={s.dropPrimary}>גרור קובץ {src.label} לכאן</p>
                <p style={s.dropSecondary}>או לחץ לבחירת קובץ</p>
                <span style={s.dropHint}>{src.accept}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Word review ── */}
      {extracted.length > 0 && (
        <div style={s.reviewCard}>
          <div style={s.reviewTop}>
            <div>
              <h3 style={s.reviewTitle}>
                נמצאו&nbsp;<span style={{ color: '#a78bfa' }}>{extracted.length}</span>&nbsp;מילים
              </h3>
              <p style={s.reviewHint}>לחץ × להסרה • ניתן לערוך לפני השמירה</p>
            </div>
            <div style={s.reviewActions}>
              <button style={s.saveBtn} onClick={saveWords} disabled={saving}>
                {saving ? 'שומר...' : `שמור ${extracted.length} מילים ↑`}
              </button>
              <button style={s.clearBtn} onClick={() => setExtracted([])}>בטל</button>
            </div>
          </div>

          <div style={s.chips}>
            {extracted.map(word => (
              <span key={word} style={s.chip}>
                {word}
                <button style={s.chipX} onClick={() => removeExtracted(word)}>×</button>
              </span>
            ))}
          </div>

          <div style={s.addWordRow}>
            <input
              style={s.addWordInput}
              placeholder="הוסף מילה נוספת..."
              value={manualWord}
              onChange={e => setManualWord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addManualWord()}
              dir="ltr"
            />
            <button style={s.addWordBtn} onClick={addManualWord} disabled={!manualWord.trim()}>
              + הוסף
            </button>
          </div>
        </div>
      )}

      {/* ── Word bank ── */}
      <div style={s.bankSection}>
        <div style={s.bankHead}>
          <div style={s.bankTitleRow}>
            <h2 style={s.bankTitle}>מאגר המילים שלי</h2>
            <span style={s.bankBadge}>{savedWords.length}</span>
          </div>
          {savedWords.length > 0 && (
            <input
              style={s.filterInput}
              placeholder="🔍 חפש מילה..."
              value={bankFilter}
              onChange={e => setBankFilter(e.target.value)}
              dir="ltr"
            />
          )}
        </div>

        {loadingBank ? (
          <div style={s.bankLoading}>טוען...</div>
        ) : savedWords.length === 0 ? (
          <div style={s.bankEmpty}>
            <span style={{ fontSize: 48 }}>📚</span>
            <p>עדיין אין מילים — העלה קובץ כדי להתחיל</p>
          </div>
        ) : (
          <div style={s.chips}>
            {filteredBank.map(({ word, source }) => (
              <span key={word} style={{ ...s.chip, ...s.savedChip }}>
                <span style={{ fontSize: 12 }}>{SOURCE_ICON[source] || '📌'}</span>
                {word}
                <button style={s.chipX} onClick={() => deleteWord(word)}>×</button>
              </span>
            ))}
            {filteredBank.length === 0 && (
              <p style={{ color: '#475569', padding: '16px 0' }}>אין תוצאות לחיפוש</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SetupBanner() {
  const [open, setOpen] = useState(false)
  const sql = `-- הרץ בעורך ה-SQL של Supabase:
CREATE TABLE IF NOT EXISTS user_words (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  word       text NOT NULL,
  source     text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, word)
);
ALTER TABLE user_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_words"
  ON user_words FOR ALL USING (auth.uid() = user_id);`

  return (
    <div style={s.setupBanner}>
      <p style={{ margin: 0 }}>
        ⚠️&nbsp; טבלת <code>user_words</code> לא נמצאה ב-Supabase.
      </p>
      <button style={s.setupToggle} onClick={() => setOpen(o => !o)}>
        {open ? 'הסתר SQL' : 'הצג SQL להגדרה'}
      </button>
      {open && (
        <pre style={s.sql}>{sql}</pre>
      )}
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = {
  page: {
    maxWidth: 820,
    margin: '0 auto',
    padding: '32px 20px 60px',
    direction: 'rtl',
  },

  /* header */
  header: { textAlign: 'center', marginBottom: 32 },
  title:  { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  subtitle: { color: '#64748b', fontSize: 15 },

  /* tabs */
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 24,
  },
  tab: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: '9px 16px',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  tabOn: {
    background: 'rgba(99,102,241,0.18)',
    border: '1px solid rgba(99,102,241,0.45)',
    color: '#c4b5fd',
  },

  /* upload card */
  uploadCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },

  /* dropzone */
  dropzone: {
    border: '2px dashed rgba(255,255,255,0.12)',
    borderRadius: 18,
    margin: 12,
    padding: '56px 32px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  dropzoneOn: {
    borderColor: '#6366f1',
    background: 'rgba(99,102,241,0.07)',
  },
  dropContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  dropEmoji:    { fontSize: 52, marginBottom: 4 },
  dropPrimary:  { fontSize: 17, fontWeight: 600, color: '#e2e8f0' },
  dropSecondary:{ fontSize: 14, color: '#64748b' },
  dropHint:     { fontSize: 12, color: '#475569', marginTop: 4 },

  /* progress */
  progressBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    padding: '16px 0',
  },
  ring: {
    width: 44,
    height: 44,
    border: '3px solid rgba(99,102,241,0.25)',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  progressLabel: { color: '#a78bfa', fontSize: 14 },
  progressBarWrap: {
    width: 240,
    height: 4,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg,#6366f1,#a78bfa)',
    borderRadius: 4,
    transition: 'width 0.3s',
  },

  /* free text */
  freeCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
  },
  textarea: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: '16px',
    color: '#fff',
    fontSize: 15,
    lineHeight: 1.7,
    resize: 'vertical',
    minHeight: 200,
    outline: 'none',
  },
  extractBtn: {
    alignSelf: 'flex-start',
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    border: 'none',
    borderRadius: 10,
    padding: '12px 24px',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },

  /* review */
  reviewCard: {
    background: 'rgba(99,102,241,0.07)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 20,
    padding: '24px',
    marginBottom: 24,
  },
  reviewTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  reviewTitle: { fontSize: 18, fontWeight: 700, margin: 0 },
  reviewHint:  { color: '#64748b', fontSize: 12, marginTop: 4 },
  reviewActions: { display: 'flex', gap: 8 },
  saveBtn: {
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    border: 'none',
    borderRadius: 10,
    padding: '10px 22px',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  clearBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '10px 16px',
    color: '#94a3b8',
    fontSize: 14,
    cursor: 'pointer',
  },
  addWordRow: {
    display: 'flex',
    gap: 8,
    marginTop: 14,
    direction: 'ltr',
  },
  addWordInput: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '9px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  },
  addWordBtn: {
    background: 'rgba(99,102,241,0.2)',
    border: '1px solid rgba(99,102,241,0.4)',
    borderRadius: 8,
    padding: '9px 16px',
    color: '#a5b4fc',
    fontSize: 14,
    cursor: 'pointer',
  },

  /* chips */
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    direction: 'ltr',
  },
  chip: {
    background: 'rgba(99,102,241,0.18)',
    border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 14,
    color: '#c4b5fd',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  savedChip: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#94a3b8',
  },
  chipX: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 15,
    padding: 0,
    lineHeight: 1,
    marginRight: -2,
  },

  /* bank */
  bankSection: {
    marginTop: 16,
  },
  bankHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  bankTitleRow: { display: 'flex', alignItems: 'center', gap: 10 },
  bankTitle: { fontSize: 22, fontWeight: 700, margin: 0 },
  bankBadge: {
    background: 'rgba(99,102,241,0.2)',
    color: '#a5b4fc',
    borderRadius: 20,
    padding: '2px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  filterInput: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '8px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    width: 200,
  },
  bankLoading: { color: '#475569', padding: '32px 0', textAlign: 'center' },
  bankEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '48px 0',
    color: '#475569',
  },

  /* toast */
  toast: {
    position: 'fixed',
    bottom: 28,
    left: '50%',
    transform: 'translateX(-50%)',
    borderRadius: 12,
    padding: '14px 20px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 14,
    zIndex: 200,
    whiteSpace: 'nowrap',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  toastSuccess: {
    background: 'rgba(15,15,26,0.97)',
    borderColor: '#4ade80',
    color: '#4ade80',
  },
  toastError: {
    background: 'rgba(15,15,26,0.97)',
    borderColor: '#f87171',
    color: '#f87171',
  },
  toastX: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'inherit',
    fontSize: 16,
    padding: 0,
  },

  /* setup */
  setupBanner: {
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: 14,
    padding: '16px 20px',
    marginBottom: 24,
    color: '#fbbf24',
    fontSize: 14,
  },
  setupToggle: {
    background: 'transparent',
    border: '1px solid rgba(251,191,36,0.4)',
    borderRadius: 8,
    color: '#fbbf24',
    cursor: 'pointer',
    fontSize: 13,
    padding: '6px 12px',
    marginTop: 10,
    display: 'block',
  },
  sql: {
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '16px',
    marginTop: 12,
    fontSize: 12,
    color: '#e2e8f0',
    overflowX: 'auto',
    direction: 'ltr',
    textAlign: 'left',
    whiteSpace: 'pre',
    lineHeight: 1.6,
  },
}
