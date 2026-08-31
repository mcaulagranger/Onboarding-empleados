import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react'

/**
 * Pantalla a la que aterriza el empleado cuando toca el link del mail
 * de invitación (o de recuperación) de Supabase.
 *
 * El cliente de supabase-js, con detectSessionInUrl activado (viene por
 * defecto), lee el token del hash de la URL y deja la sesión abierta.
 * Acá el empleado solo elige su contraseña; después entra directo al
 * portal.
 */
export default function SetPassword() {
  const navigate = useNavigate()
  const { fetchProfile } = useAuth()
  const [listo, setListo] = useState(false)      // ¿hay sesión válida del link?
  const [sinSesion, setSinSesion] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true

    // El token puede tardar un instante en procesarse; escuchamos el
    // evento y también consultamos la sesión actual por las dudas.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!vivo) return
      if (session) { setListo(true); setSinSesion(false) }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!vivo) return
      if (session) setListo(true)
      else {
        // Damos un margen por si el hash todavía no se procesó.
        setTimeout(() => { if (vivo && !listo) setSinSesion(true) }, 1500)
      }
    })

    return () => { vivo = false; sub.subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setGuardando(true)
    try {
      const { data: sesion, error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      // Marcamos que esta persona YA definió su propia clave. Es lo que
      // usa el resto de la app para exigir este paso antes que nada, sin
      // depender únicamente de que el link de invitación la haya
      // traído hasta acá (por si la redirección falla en algún caso).
      const uid = sesion?.user?.id
      if (uid) {
        const { error: ePerfil } = await supabase
          .from('profiles')
          .update({ password_set: true })
          .eq('id', uid)
        if (ePerfil) console.error('No se pudo marcar password_set:', ePerfil.message)
        // Refrescamos el perfil en memoria ANTES de navegar: si no, la app
        // todavía vería password_set en false (el valor con el que se
        // cargó esta pantalla) y nos mandaría de nuevo para acá en loop.
        await fetchProfile(uid)
      }

      navigate('/')
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar la contraseña.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-natural px-6 py-14">
      <div className="w-full max-w-sm">
        <p className="wordmark text-2xl mb-8">Granger<span className="text-brand-500">.</span></p>

        <div className="flex items-center gap-2 text-brand-600 mb-2">
          <ShieldCheck className="w-5 h-5" />
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Primer ingreso</span>
        </div>
        <h1 className="text-2xl font-bold text-fg">Definí tu contraseña</h1>
        <p className="text-sm text-slate-500 mt-1 mb-8">
          Elegí una clave para entrar al portal de aquí en adelante.
        </p>

        {sinSesion && !listo ? (
          <div className="px-4 py-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg text-sm text-amber-800">
            El enlace no es válido o ya expiró. Pedile a Recursos Humanos que
            te reenvíe la invitación.
          </div>
        ) : !listo ? (
          <div className="flex items-center gap-3 text-slate-500 text-sm">
            <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Validando el enlace…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-50 border-l-4 border-durazno rounded-r-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="label" htmlFor="pass">Nueva contraseña</label>
              <div className="relative">
                <input
                  id="pass"
                  type={ver ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="input pr-11"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setVer(!ver)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-fg"
                  tabIndex={-1}
                  aria-label={ver ? 'Ocultar' : 'Mostrar'}
                >
                  {ver ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="pass2">Repetir contraseña</label>
              <input
                id="pass2"
                type={ver ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                className="input"
                placeholder="Escribila de nuevo"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </div>

            <button type="submit" disabled={guardando} className="btn-primary w-full justify-center">
              {guardando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  Entrar al portal
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}