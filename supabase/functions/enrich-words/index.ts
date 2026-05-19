import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_MODEL = 'gemini-2.5-flash'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { words } = await req.json()
    if (!Array.isArray(words) || !words.length) {
      return new Response(
        JSON.stringify({ error: 'words must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')

    const batch = words.slice(0, 80).join(', ')
    const prompt =
      `You are a bilingual Hebrew-English dictionary. For each English word below, provide the Hebrew translation and CEFR level (A1, A2, B1, B2, C1, or C2).
Respond with ONLY a valid JSON array — no explanations, no markdown:
[{"word":"example","translation":"דוגמה","level":"A2"}]

Words: ${batch}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
        }),
      },
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gemini error ${res.status}: ${body.slice(0, 300)}`)
    }

    const json = await res.json()
    const raw  = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    const enriched = match ? JSON.parse(match[0]) : []

    return new Response(
      JSON.stringify(enriched),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
