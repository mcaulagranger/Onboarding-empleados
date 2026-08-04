import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ClipboardList, CheckCircle, Clock, ArrowRight, PartyPopper, Sparkles, ListChecks } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'

// El viewBox usa unidades relativas (0–100), así que el círculo
// escala solo con el tamaño del contenedor: no hace falta
// recalcular nada en JS para mobile vs. desktop.
function ProgressRing({ pct }) {
  const r = 40
  const circumference = 2 * Math.PI * r
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="relative flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="#f18a00" strokeWidth="9"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-none">{pct}%</span>
        <span className="text-[9px] sm:text-[10px] text-brand-300 uppercase tracking-wide mt-1">listo</span>
      </div>
    </div>
  )
}

export default function EmployeeDashboard() {
  const { user, profile } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('employee_documents')
        .select('id, status, created_at, document_templates(name, description)')
        .eq('employee_id', user.id)
        .order('status', { ascending: true })
      setDocs(data ?? [])
      setLoading(false)
    }
    load()
  }, [user.id])

  const pending = docs.filter((d) => d.status === 'pending')
  const completed = docs.filter((d) => d.status === 'completed')
  const allDone = docs.length > 0 && pending.length === 0
  const pct = docs.length ? Math.round((completed.length / docs.length) * 100) : 0
  const proximo = pending[0]

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 w-full max-w-5xl">
      {/* Hero de bienvenida + progreso */}
      <div className="hero-panel px-6 py-8 sm:px-10 sm:py-10">
        <div className="absolute inset-0 granger-texture opacity-[0.08]" aria-hidden="true" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-7 sm:gap-10">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-brand-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Tu onboarding
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-2">
              Hola, {profile?.full_name?.split(' ')[0] ?? 'bienvenido'}
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-md leading-relaxed">
              {allDone
                ? 'Terminaste todo lo que te pedimos. ¡Gracias por la rapidez!'
                : docs.length === 0
                ? 'Todavía no tenés documentos asignados. Volvé pronto.'
                : `Te ${pending.length === 1 ? 'falta' : 'faltan'} ${pending.length} documento${pending.length === 1 ? '' : 's'} por completar.`}
            </p>
            {proximo && (
              <Link
                to="/empleado/documentos"
                className="btn-primary mt-5 inline-flex w-full sm:w-fit group"
              >
                Completar "{proximo.document_templates?.name}"
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
          {docs.length > 0 && (
            <div className="flex justify-center sm:justify-end">
              <ProgressRing pct={pct} />
            </div>
          )}
        </div>
      </div>

      {/* Completado total */}
      {allDone && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 animate-pop-in">
          <PartyPopper className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-semibold">¡Documentación completa!</p>
            <p className="text-sm">RRHH revisará todo y te va a avisar si hace falta algo más.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-xl font-bold text-ink">{pending.length}</p>
            <p className="text-sm text-slate-600">Pendientes</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-xl font-bold text-ink">{completed.length}</p>
            <p className="text-sm text-slate-600">Completados</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5">
          <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <p className="text-xl font-bold text-ink">{docs.length}</p>
            <p className="text-sm text-slate-600">Total asignados</p>
          </div>
        </div>
      </div>

      {/* Lista de docs */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-ink flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-600" />
            Mis documentos
          </h2>
          <Link
            to="/empleado/documentos"
            className="text-xs text-brand-700 hover:underline font-medium flex items-center gap-1"
          >
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {docs.length === 0 ? (
          <div className="py-12 text-center">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              RRHH aún no te asignó documentos. Volvé pronto.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {doc.document_templates?.name}
                  </p>
                  {doc.document_templates?.description && (
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {doc.document_templates.description}
                    </p>
                  )}
                </div>
                <StatusBadge status={doc.status} />
              </div>
            ))}
            {docs.length > 5 && (
              <div className="px-5 py-3 text-center">
                <Link to="/empleado/documentos" className="text-xs text-brand-700 hover:underline font-medium">
                  Ver {docs.length - 5} más →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}