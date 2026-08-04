import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch {
      setError('El correo o la contraseña no coinciden. Probá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ── Panel de marca ── */}
      <div className="relative bg-ivori overflow-hidden px-8 py-14 lg:px-14 lg:py-0 lg:flex lg:flex-col lg:justify-center">
        <div className="absolute inset-0 granger-texture opacity-[0.08]" aria-hidden="true" />
        <div className="relative">
          <p className="font-sans font-black italic uppercase text-4xl lg:text-6xl text-slate-600 leading-none tracking-tighter">
            Granger<span className="text-brand-500">.</span>
          </p>
          <p className="mt-6 text-xs uppercase tracking-[0.25em] text-slate-500">
            Recursos Humanos
          </p>
          <h1 className="mt-2 text-3xl lg:text-5xl font-bold text-fg leading-[1.05]">
            Bienvenido<br />al equipo
          </h1>
          <p className="mt-5 max-w-sm text-sm text-slate-600 leading-relaxed">
            Acá vas a encontrar los documentos que necesitás completar para tu
            incorporación. Uno por uno, a tu ritmo.
          </p>
        </div>
      </div>

      {/* ── Formulario ── */}
      <div className="flex items-center justify-center px-6 py-14 bg-natural lg:py-0">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-fg">Iniciar sesión</h2>
          <p className="text-sm text-slate-500 mt-1 mb-8">
            Usá el correo que te dio Recursos Humanos.
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border-l-4 border-durazno rounded-r-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="nombre@granger.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Contraseña</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="input pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-fg"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 rounded-full animate-spin" />
                  Ingresando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-8">
            ¿No podés entrar? Escribile a Recursos Humanos.
          </p>
        </div>
      </div>
    </div>
  )
}