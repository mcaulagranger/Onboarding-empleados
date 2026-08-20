import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SignatureGate from './SignatureGate'
import DatosPersonalesGate from './DatosPersonalesGate'
import { Menu } from 'lucide-react'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-ivori">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-200
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header móvil */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-ink">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <p className="wordmark text-base">
            Granger<span>.</span>
          </p>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      {/* Primer ingreso del empleado: 1) datos personales, 2) firma. */}
      <DatosPersonalesGate />
      <SignatureGate />
    </div>
  )
}