import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_MODEL = 'gemini-2.5-flash'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { word, sentence } = await req.json()
    if (!word || !sentence?.trim()) {
      return new Response(JSON.stringify({ error: 'word and sentence required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')

    const prompt = `You are an English teacher. A student wrote this sentence using the word "${word}":
"${sentence}"

Grade it. Respond ONLY with valid JSON (no markdown, no backticks):
If correct: {"correct":true,"corrected":"${sentence}","example":"","feedback":"כל הכבוד! המשפט נכון ותקין."}
If wrong:   {"correct":false,"corrected":"The corrected version of the student's sentence.","example":"A fresh natural example sentence using '${word}' correctly.","feedback":"הסבר קצר בעברית מה שגוי ואיך לתקן (1-2 משפטים)."}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    )
    if (!res.ok) {
      const d = await res.text()
      throw new Error(`Gemini ${res.status}: ${d.slice(0, 200)}`)
    }
    const json = await res.json()
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const m = raw.match(/\{[\s\S]*\}/)
    const result = m ? JSON.parse(m[0]) : { correct: false, corrected: sentence, feedback: 'שגיאה בעיבוד.' }
    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
