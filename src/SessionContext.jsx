import { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from './supabase'

const Ctx = createContext({
  currentWords: [], setCurrentWords: () => {},
  wordCount: 10,    setWordCount:    () => {},
  pastSessions: [], loadSessions: async () => {}, saveSession: async () => {},
})

export const useSession = () => useContext(Ctx)

export function SessionProvider({ user, children }) {
  const [currentWords,  setCurrent]   = useState([])
  const [wordCount,     setWordCount] = useState(10)
  const [pastSessions,  setSessions]  = useState([])

  const loadSessions = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('practice_sessions')
      .select('id, words, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60)
    setSessions(data ?? [])
  }, [user?.id])

  // Saves new session to DB + sets as current
  const saveSession = useCallback(async (words) => {
    setCurrent(words)
    if (!user?.id || !words?.length) return
    const { data } = await supabase
      .from('practice_sessions')
      .insert({ user_id: user.id, words })
      .select('id, words, created_at')
      .single()
    if (data) setSessions(prev => [data, ...prev.slice(0, 59)])
  }, [user?.id])

  return (
    <Ctx.Provider value={{ currentWords, setCurrentWords: setCurrent, wordCount, setWordCount, pastSessions, loadSessions, saveSession }}>
      {children}
    </Ctx.Provider>
  )
}
