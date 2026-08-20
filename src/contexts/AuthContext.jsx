import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error) setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await fetchProfile(data.user.id)
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  // Guarda (o reemplaza) la firma del empleado. Se almacena como PNG en
  // base64 (data URL) en profiles.signature_data — chiquito y sin tener
  // que crear un bucket aparte. Actualiza también el estado local para
  // que la app la tenga disponible al instante.
  async function updateSignature(dataUrl) {
    if (!user) throw new Error('No hay sesión activa')
    const { error } = await supabase
      .from('profiles')
      .update({ signature_data: dataUrl })
      .eq('id', user.id)
    if (error) throw error
    setProfile((p) => (p ? { ...p, signature_data: dataUrl } : p))
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, fetchProfile, updateSignature }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}