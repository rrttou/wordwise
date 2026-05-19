import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_MODEL = 'gemini-2.5-flash'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { words, type } = await req.json()
    if (!Array.isArray(words) || words.length < 2) {
      return new Response(JSON.stringify({ error: 'words must have at least 2 items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')

    let prompt = ''

    if (type === 'sentences') {
      prompt = `Generate exactly ${words.length} English sentences, one per word: ${words.join(', ')}.
B1-B2 level. Each sentence must naturally use its word.
Respond ONLY with a valid JSON array (no markdown):
[{"word":"...","sentence":"..."}]
Return exactly ${words.length} objects in the same order as the input words.`
    } else if (type === 'grammar') {
      const count = Math.min(words.length * 2, 10)
      prompt = `Create ${count} English grammar fill-in-the-blank questions using these vocabulary words: ${words.join(', ')}.
Test a mix of tenses: Present Simple, Present Continuous, Present Perfect, Present Perfect Continuous, Past Simple, Past Continuous, Past Perfect, Future Simple (will), Future (going to).

IMPORTANT — question style:
- Write natural, conversational sentences (not textbook-style).
- The blank (___) replaces the AUXILIARY verb or the key tense word, NOT the whole verb phrase.
- The rest of the verb (main verb or participle) stays visible in the sentence as context.
- Good examples:
  "I have ___ feeling great all week." → blank = "been" (Present Perfect Continuous)
  "She ___ already left by the time I arrived." → blank = "had" (Past Perfect)
  "By next Friday they ___ finished the project." → blank = "will have" (Future Perfect)
  "He ___ working here since 2018." → blank = "has been" (Present Perfect Continuous)
  "They ___ going to fix it tomorrow." → blank = "are" (Future going to)
- Bad example (avoid): "She _____ (work) here since 2020." — do NOT use this format with base verb in parentheses.
- Each sentence must naturally include one of the vocabulary words.

Respond ONLY with a valid JSON array (no markdown):
[{"question":"I have ___ feeling great all week.","options":["been","be","being","had been"],"correct":0,"tense":"Present Perfect Continuous","explanation":"משתמשים ב-Present Perfect Continuous לתהליך שהתחיל בעבר ונמשך עד עכשיו."}]
"correct" is 0-based index. Include ${count} questions covering varied tenses.`
    }

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
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
    const m = raw.match(/\[[\s\S]*\]/)
    const data = m ? JSON.parse(m[0]) : []
    return new Response(JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
