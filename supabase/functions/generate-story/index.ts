import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_MODEL = 'gemini-2.5-flash'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { words, level, wordCount } = await req.json()

    if (!Array.isArray(words) || words.length < 4) {
      return new Response(
        JSON.stringify({ error: 'words must be an array with at least 4 items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY secret is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const targetWords = wordCount ?? 150
    const levelNote = level ? ` The language level should be ${level}.` : ''
    const prompt = `Write a short, engaging story in English (around ${targetWords} words) that naturally uses ALL of the following vocabulary words: ${words.join(', ')}.

Rules:
- Every word in the list must appear at least once
- The story should flow naturally — do not force the words awkwardly
- Use clear language suitable for language learners${levelNote}
- Include a small narrative arc (a beginning, a turn, and an end)
- Do NOT add a title, commentary, or explanation — output only the story text`

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })

    if (!geminiRes.ok) {
      const detail = await geminiRes.text()
      return new Response(
        JSON.stringify({ error: `Gemini API error ${geminiRes.status}`, detail }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const json = await geminiRes.json()
    const story = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    return new Response(
      JSON.stringify({ story }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
