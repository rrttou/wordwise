import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

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

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','as','is','was','are','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','can','could',
  'not','this','that','these','those','it','its','they','them','their','there',
  'we','our','you','your','he','she','his','her','me','my','i','if','so','then',
  'than','more','also','all','any','each','up','out','into','about','after',
  'before','while','what','which','who','how','when','where',
])

function extractWords(text) {
  const words = text.match(/[a-zA-Z]{3,}/g) || []
  return [...new Set(words.map(w => w.toLowerCase()).filter(w => !STOP_WORDS.has(w)))]
}

const SOURCES = [
  { id: 'excel', label: 'Excel',         icon: '📊', accept: '.xlsx,.xls,.csv' },
  { id: 'word',  label: 'Word',           icon: '📝', accept: '.docx,.doc'      },
  { id: 'pdf',   label: 'PDF',            icon: '📄', accept: '.pdf'            },
  { id: 'image', label: 'תמונה',          icon: '🖼️', accept: '.png,.jpg,.jpeg,.webp,.bmp' },
  { id: 'free',  label: 'כתיבה חופשית',  icon: '✏️', accept: null              },
]

const SRC_ICON = Object.fromEntries(SOURCES.map(s => [s.id, s.icon]))

export default function UploadWords({ user }) {
  const [src, setSrc]             = useState('excel')
  const [dragging, setDragging]   = useState(false)
  const [processing, setProc]     = useState(false)
  const [progress, setProgress]   = useState(0)
  const [statusText, setStatus]   = useState('')
  const [extracted, setExtracted] = useState([])
  const [freeText, setFreeText]   = useState('')
  const [manualWord, setManual]   = useState('')
  const [saved, setSaved]         = useState([])
  const [loadingBank, setLoadingBank] = useState(true)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState(null)
  const [setupNeeded, setSetup]   = useState(false)
  const [filter, setFilter]       = useState('')
  const [sortBy, setSortBy]       = useState('alpha')
  const [bankModal, setBankModal] = useState(false)
  const fileRef = useRef()

  useEffect(() => { loadBank() }, [])

  function showToast(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadBank() {
    setLoadingBank(true)
    const { data, error } = await supabase
      .from('user_words')
      .select('word, source, translation, level, created_at')
      .order('created_at', { ascending: false })
    setLoadingBank(false)
    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) setSetup(true)
    } else setSaved(data || [])
  }

  async function processFile(file) {
    setProc(true); setProgress(0); setStatus('קורא קובץ...'); setExtracted([])
    try {
      let text = ''
      if (src === 'excel') {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf)
        for (const name of wb.SheetNames) text += XLSX.utils.sheet_to_txt(wb.Sheets[name]) + '\n'
      } else if (src === 'word') {
        const mod = await import('mammoth')
        const mammoth = mod.default ?? mod
        const buf = await file.arrayBuffer()
        const res = await mammoth.extractRawText({ arrayBuffer: buf })
        text = res.value
      } else if (src === 'pdf') {
        const buf = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          text += content.items.map(item => item.str).join(' ') + '\n'
          setProgress(Math.round((i / pdf.numPages) * 100))
          setStatus(`מעבד עמוד ${i} מתוך ${pdf.numPages}...`)
        }
      } else if (src === 'image') {
        setStatus('מריץ זיהוי טקסט (OCR)...')
        const { recognize } = await import('tesseract.js')
        const result = await recognize(file, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100))
              setStatus(`מזהה טקסט... ${Math.round(m.progress * 100)}%`)
            }
          },
        })
        text = result.data.text
      }
      setExtracted(extractWords(text))
      setStatus('')
    } catch (err) {
      showToast('error', 'שגיאה בקריאת הקובץ: ' + err.message)
      setStatus('')
    }
    setProc(false)
  }

  function handleDrop(e) { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }
  function handleFileInput(e) { const f = e.target.files[0]; if (f) processFile(f); e.target.value = '' }

  function removeExtracted(word) { setExtracted(p => p.filter(w => w !== word)) }
  function addManual() {
    const w = manualWord.trim().toLowerCase()
    if (w && !extracted.includes(w)) setExtracted(p => [...p, w])
    setManual('')
  }

  async function saveWords() {
    if (!extracted.length) return
    setSaving(true)
    const wordsToSave = [...extracted]
    const rows = wordsToSave.map(word => ({ user_id: user.id, word, source: src }))
    const { error } = await supabase.from('user_words').upsert(rows, { onConflict: 'user_id,word' })
    if (error) {
      if (error.code === '42P01') setSetup(true)
      else showToast('error', 'שגיאה בשמירה: ' + error.message)
      setSaving(false)
      return
    }
    setExtracted([])
    const alreadyTranslated = new Set(saved.filter(w => w.translation).map(w => w.word))
    const needsTranslation = wordsToSave.filter(w => !alreadyTranslated.has(w))
    if (needsTranslation.length) {
      showToast('success', `✓ ${wordsToSave.length} מילים נשמרו — מתרגם ${needsTranslation.length}...`)
      await enrichWords(needsTranslation)
    } else {
      showToast('success', `✓ ${wordsToSave.length} מילים נשמרו`)
    }
    loadBank()
    setSaving(false)
  }

  const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

  const BATCH_SIZE = 80

  async function enrichWords(words) {
    const unique = [...new Set(words)]
    if (!unique.length) return
    setStatus('מתרגם מילים עם AI...')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }

      const allEnriched = []
      for (let i = 0; i < unique.length; i += BATCH_SIZE) {
        const chunk = unique.slice(i, i + BATCH_SIZE)
        if (unique.length > BATCH_SIZE)
          setStatus(`מתרגם... ${Math.min(i + BATCH_SIZE, unique.length)}/${unique.length}`)
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-words`,
          { method: 'POST', headers, body: JSON.stringify({ words: chunk }) }
        )
        const text = await res.text()
        if (!res.ok) {
          showToast('error', `שגיאת תרגום (${res.status}): ${text.slice(0, 120)}`)
          return
        }
        const enriched = JSON.parse(text)
        if (Array.isArray(enriched)) allEnriched.push(...enriched)
      }

      if (!allEnriched.length) {
        showToast('error', 'הפונקציה לא החזירה תרגומים')
        return
      }
      const results = await Promise.all(
        allEnriched.map(item =>
          supabase.from('user_words')
            .update({
              translation: item.translation ?? null,
              level: VALID_LEVELS.has(item.level) ? item.level : null,
            })
            .eq('user_id', user.id)
            .eq('word', item.word)
        )
      )
      const failed = results.filter(r => r.error)
      if (failed.length) {
        showToast('error', 'שגיאה בעדכון: ' + failed[0].error.message)
      } else {
        showToast('success', `✓ תורגמו ${allEnriched.length} מילים!`)
      }
    } catch (err) {
      showToast('error', 'שגיאת תרגום: ' + err.message)
    } finally {
      setStatus('')
    }
  }

  async function translateMissing() {
    const missing = saved.filter(w => !w.translation).map(w => w.word)
    if (!missing.length) return
    setSaving(true)
    await enrichWords(missing)
    loadBank()
    setSaving(false)
  }

  async function deleteWord(word) {
    await supabase.from('user_words').delete().match({ user_id: user.id, word })
    setSaved(p => p.filter(w => w.word !== word))
  }

  const activeSrc = SOURCES.find(s => s.id === src)
  const LEVEL_ORDER = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }
  const filteredBank = filter
    ? saved.filter(w => w.word.toLowerCase().includes(filter.toLowerCase()))
    : saved
  const displayedBank = [...filteredBank].sort((a, b) => {
    if (sortBy === 'alpha') return a.word.localeCompare(b.word)
    if (sortBy === 'level') {
      const la = LEVEL_ORDER[a.level] ?? 99
      const lb = LEVEL_ORDER[b.level] ?? 99
      return la !== lb ? la - lb : a.word.localeCompare(b.word)
    }
    return 0
  })

  return (
    <div style={s.wrap}>

      {setupNeeded && <SetupBanner />}

      {/* Page header */}
      <div style={s.pageHeader}>
        <h2 style={s.pageTitle}>העלה מילים חדשות</h2>
        <p style={s.pageSub}>בחר מקור, העלה קובץ — המילים יישמרו במאגר שלך</p>
      </div>

      {/* Source tabs */}
      <div style={s.tabs}>
        {SOURCES.map(item => (
          <button
            key={item.id}
            style={{ ...s.tab, ...(src === item.id ? s.tabOn : {}) }}
            onClick={() => { setSrc(item.id); setExtracted([]) }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Upload area */}
      <div style={s.uploadCard}>
        {src === 'free' ? (
          <div style={s.freeCol}>
            <textarea
              style={s.textarea}
              placeholder="הדבק או הקלד טקסט באנגלית..."
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              dir="ltr"
            />
            <button style={s.extractBtn} onClick={() => setExtracted(extractWords(freeText))} disabled={!freeText.trim()}>
              חלץ מילים
            </button>
          </div>
        ) : (
          <div
            style={{ ...s.dropzone, ...(dragging ? s.dropzoneOn : {}) }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !processing && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept={activeSrc.accept} style={{ display: 'none' }} onChange={handleFileInput} />
            {processing ? (
              <div style={s.progressBox}>
                <div style={s.ring} />
                <p style={s.progressLabel}>{statusText}</p>
                {progress > 0 && (
                  <div style={s.progressTrack}>
                    <div style={{ ...s.progressFill, width: progress + '%' }} />
                  </div>
                )}
              </div>
            ) : (
              <div style={s.dropContent}>
                <span style={s.dropEmoji}>{activeSrc.icon}</span>
                <p style={s.dropPrimary}>גרור קובץ {activeSrc.label} לכאן</p>
                <p style={s.dropSub}>או לחץ לבחירת קובץ</p>
                <span style={s.dropHint}>{activeSrc.accept}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Word review */}
      {extracted.length > 0 && (
        <div style={s.reviewCard}>
          <div style={s.reviewTop}>
            <div>
              <p style={s.reviewTitle}>
                נמצאו <span style={{ color: c.mint, fontWeight: 600 }}>{extracted.length}</span> מילים
              </p>
              <p style={s.reviewHint}>לחץ × להסרה לפני השמירה</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.saveBtn} onClick={saveWords} disabled={saving}>
                {saving ? 'שומר...' : `שמור ${extracted.length} ↑`}
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
          <div style={s.addRow}>
            <input
              style={s.addInput}
              placeholder="הוסף מילה..."
              value={manualWord}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addManual()}
              dir="ltr"
            />
            <button style={s.addBtn} onClick={addManual} disabled={!manualWord.trim()}>+ הוסף</button>
          </div>
        </div>
      )}

      {/* Word bank button */}
      <button style={s.bankOpenBtn} onClick={() => setBankModal(true)}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={s.bankTitle}>מאגר המילים שלי</span>
          {!loadingBank && <span style={s.bankBadge}>{saved.length}</span>}
        </div>
        <span style={{ color:c.ink3, fontSize:13 }}>← פתח</span>
      </button>

      {/* Word bank modal */}
      {bankModal && (
        <div style={s.overlay} onClick={() => setBankModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={s.modalTitle}>מאגר המילים שלי</span>
                <span style={s.bankBadge}>{saved.length}</span>
              </div>
              <button style={s.modalClose} onClick={() => setBankModal(false)}>✕</button>
            </div>

            {saved.some(w => !w.translation) && (
              <button style={{ ...s.translateBtn, marginBottom:12, width:'100%' }} onClick={translateMissing} disabled={saving}>
                {saving ? '...' : '✦ תרגם חסרים'}
              </button>
            )}

            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              <input
                style={{ ...s.filterInput, flex:1, minWidth:120 }}
                placeholder="🔍 חיפוש מילה..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                dir="ltr"
              />
              <div style={s.sortBtns}>
                {[['alpha','א-ב'],['level','רמה'],['date','תאריך']].map(([key,label]) => (
                  <button key={key} style={{ ...s.sortBtn, ...(sortBy===key ? s.sortBtnOn : {}) }} onClick={() => setSortBy(key)}>{label}</button>
                ))}
              </div>
            </div>

            <div style={s.modalBody}>
              {loadingBank ? (
                <p style={{ color:c.ink3, textAlign:'center', padding:24, fontSize:13 }}>טוען...</p>
              ) : saved.length === 0 ? (
                <div style={s.emptyBank}>
                  <span style={{ fontSize:40 }}>📚</span>
                  <p>עדיין אין מילים — העלה קובץ כדי להתחיל</p>
                </div>
              ) : displayedBank.length === 0 ? (
                <p style={{ color:c.ink3, fontSize:13, padding:'8px 0', textAlign:'center' }}>אין תוצאות</p>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>מילה</th>
                      <th style={s.th}>תרגום</th>
                      <th style={{ ...s.th, textAlign:'center' }}>רמה</th>
                      <th style={s.th} />
                    </tr>
                  </thead>
                  <tbody>
                    {displayedBank.map(({ word, translation, level }) => (
                      <tr key={word} style={s.tr}>
                        <td style={{ ...s.td, direction:'ltr', fontWeight:500, color:c.ink }}>{word}</td>
                        <td style={{ ...s.td, color:c.ink2, fontSize:12 }}>{translation || '—'}</td>
                        <td style={{ ...s.td, textAlign:'center' }}>
                          {level && <span style={{ ...s.levelBadge, ...getLevelStyle(level) }}>{level}</span>}
                        </td>
                        <td style={{ ...s.td, textAlign:'center' }}>
                          <button style={s.chipX} onClick={() => deleteWord(word)}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ ...s.toast, ...(toast.type === 'success' ? s.toastOk : s.toastErr) }}>
          {toast.text}
          <button style={s.toastX} onClick={() => setToast(null)}>✕</button>
        </div>
      )}
    </div>
  )
}

/* ─── Setup banner ───────────────────────────────────────────────── */
function SetupBanner() {
  const [open, setOpen] = useState(false)
  const sql = `CREATE TABLE IF NOT EXISTS user_words (
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
      <p style={{ margin: 0 }}>⚠️ טבלת <code>user_words</code> לא נמצאה ב-Supabase.</p>
      <button style={s.setupToggle} onClick={() => setOpen(o => !o)}>
        {open ? 'הסתר SQL' : 'הצג SQL להגדרה'}
      </button>
      {open && <pre style={s.sql}>{sql}</pre>}
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

  /* source tabs */
  tabs: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  tab: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    padding: '7px 13px',
    color: c.ink3,
    cursor: 'pointer',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontFamily: 'inherit',
  },
  tabOn: {
    background: c.mintL,
    border: `1px solid ${c.mint}`,
    color: c.mintD,
    fontWeight: 500,
  },

  /* upload card */
  uploadCard: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },

  /* dropzone */
  dropzone: {
    border: `2px dashed ${c.border}`,
    borderRadius: 12,
    margin: 10,
    padding: '44px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  dropzoneOn: { borderColor: c.mint, background: c.mintL },
  dropContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  dropEmoji:   { fontSize: 44, marginBottom: 4 },
  dropPrimary: { fontSize: 15, fontWeight: 500, color: c.ink },
  dropSub:     { fontSize: 13, color: c.ink3 },
  dropHint:    { fontSize: 11, color: c.ink3, marginTop: 4 },

  /* progress */
  progressBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' },
  ring: {
    width: 36,
    height: 36,
    border: `3px solid ${c.mintL}`,
    borderTop: `3px solid ${c.mint}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  progressLabel: { fontSize: 13, color: c.mint },
  progressTrack: { width: 200, height: 4, background: c.surface, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', background: c.mint, borderRadius: 4, transition: 'width 0.3s' },

  /* free text */
  freeCol: { display: 'flex', flexDirection: 'column', gap: 10, padding: 16 },
  textarea: {
    background: c.surface,
    border: `1.5px solid ${c.border}`,
    borderRadius: 10,
    padding: 14,
    color: c.ink,
    fontSize: 14,
    lineHeight: 1.7,
    resize: 'vertical',
    minHeight: 180,
    outline: 'none',
    fontFamily: 'inherit',
  },
  extractBtn: {
    alignSelf: 'flex-start',
    background: c.mint,
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* review */
  reviewCard: {
    background: c.mintL,
    border: `1px solid ${c.mint}`,
    borderRadius: 14,
    padding: '18px 16px',
    marginBottom: 16,
  },
  reviewTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  reviewTitle: { fontSize: 15, color: c.ink, margin: 0 },
  reviewHint:  { fontSize: 11, color: c.ink3, marginTop: 3 },
  saveBtn: {
    background: c.mint,
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  clearBtn: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 8,
    padding: '8px 12px',
    color: c.ink3,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  addRow:  { display: 'flex', gap: 8, marginTop: 12, direction: 'ltr' },
  addInput: {
    flex: 1,
    background: c.white,
    border: `1.5px solid ${c.border}`,
    borderRadius: 8,
    padding: '8px 12px',
    color: c.ink,
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  },
  addBtn: {
    background: c.white,
    border: `1px solid ${c.mint}`,
    borderRadius: 8,
    padding: '8px 12px',
    color: c.mintD,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* chips */
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, direction: 'ltr' },
  chip: {
    background: c.white,
    border: `1.5px solid ${c.mint}`,
    borderRadius: 8,
    padding: '4px 9px',
    fontSize: 13,
    color: c.mintD,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  savedChip: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 8,
    padding: '4px 9px',
    fontSize: 13,
    color: c.ink2,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  chipTranslation: { color: c.ink3, fontSize: 11 },
  translateBtn: {
    background: c.mintL,
    border: `1px solid ${c.mint}`,
    borderRadius: 8,
    color: c.mintD,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
    padding: '5px 10px',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  chipX: {
    background: 'transparent',
    border: 'none',
    color: c.ink3,
    cursor: 'pointer',
    fontSize: 14,
    padding: 0,
    lineHeight: 1,
    fontFamily: 'inherit',
  },

  /* bank */
  bankOpenBtn: {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    width:'100%', background:c.white, border:`1px solid ${c.border}`,
    borderRadius:14, padding:'14px 16px', cursor:'pointer',
    fontFamily:'inherit', marginTop:8, boxSizing:'border-box',
  },
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
  modalBody: { flex:1, overflowY:'auto' },
  bankHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  bankTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18,
    fontWeight: 600,
    color: c.ink,
    margin: 0,
  },
  bankBadge: {
    background: c.mintL,
    color: c.mintD,
    borderRadius: 20,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 500,
    border: `1px solid ${c.mint}`,
  },
  filterInput: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 8,
    padding: '7px 12px',
    color: c.ink,
    fontSize: 13,
    outline: 'none',
    width: 140,
    fontFamily: 'inherit',
  },
  emptyBank: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '40px 0',
    color: c.ink3,
    fontSize: 13,
  },

  /* table */
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'right',
    padding: '7px 10px',
    fontSize: 11,
    color: c.ink3,
    borderBottom: `2px solid ${c.border}`,
    fontWeight: 500,
  },
  tr: { borderBottom: `1px solid ${c.border}` },
  td: { padding: '9px 10px', verticalAlign: 'middle' },
  levelBadge: {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid',
  },
  sortBtns: { display: 'flex', gap: 4 },
  sortBtn: {
    background: c.white,
    border: `1px solid ${c.border}`,
    borderRadius: 7,
    padding: '5px 10px',
    fontSize: 12,
    color: c.ink3,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sortBtnOn: {
    background: c.mintL,
    border: `1px solid ${c.mint}`,
    color: c.mintD,
    fontWeight: 500,
  },
  /* toast */
  toast: {
    position: 'fixed',
    bottom: 100,
    left: '50%',
    transform: 'translateX(-50%)',
    borderRadius: 12,
    padding: '12px 18px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    fontWeight: 500,
    zIndex: 200,
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
  },
  toastOk:  { background: c.white, borderColor: c.mint,  color: c.mintD },
  toastErr: { background: c.white, borderColor: c.rose,  color: c.rose  },
  toastX: { background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, padding: 0 },

  /* setup */
  setupBanner: {
    background: c.goldL,
    border: '1px solid #f0d090',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 16,
    color: '#b87800',
    fontSize: 13,
  },
  setupToggle: {
    background: 'transparent',
    border: '1px solid #f0d090',
    borderRadius: 6,
    color: '#b87800',
    cursor: 'pointer',
    fontSize: 12,
    padding: '5px 10px',
    marginTop: 8,
    display: 'block',
    fontFamily: 'inherit',
  },
  sql: {
    background: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    padding: 12,
    marginTop: 10,
    fontSize: 11,
    color: c.ink,
    overflowX: 'auto',
    direction: 'ltr',
    textAlign: 'left',
    whiteSpace: 'pre',
    lineHeight: 1.6,
  },
}
