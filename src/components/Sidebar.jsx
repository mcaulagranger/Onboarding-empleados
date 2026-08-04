import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, LogOut, ClipboardList, X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const adminNav = [
  { to: '/admin', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/admin/empleados', label: 'Empleados', icon: Users },
  { to: '/admin/plantillas', label: 'Plantillas', icon: FileText },
]

const employeeNav = [
  { to: '/empleado', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/empleado/documentos', label: 'Mis documentos', icon: ClipboardList },
]

export default function Sidebar({ onClose }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'
  const nav = isAdmin ? adminNav : employeeNav

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full bg-ink rounded-tr-2xl rounded-br-2xl overflow-hidden shadow-xl shadow-ink/20">
      {/* Wordmark */}
      <div className="flex items-center justify-between px-5 h-16">
        <div>
          <p className="wordmark text-xl">
            Granger<span>.</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mt-0.5">
            Onboarding
          </p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded text-slate-400 hover:text-white"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Persona */}
      <div className="mx-3 mb-2 px-3 py-3 rounded-xl bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-fg font-bold text-sm uppercase flex-shrink-0">
            {profile?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">
              {profile?.full_name ?? '—'}
            </p>
            <p className="text-slate-400 text-xs truncate">
              {isAdmin ? 'Recursos Humanos' : profile?.position ?? 'Ingresante'}
            </p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-500 text-fg font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Salir */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}