import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Users, CheckCircle, Clock, FileText, ArrowRight, TrendingUp,
  Sparkles, UserPlus, FilePlus2,
} from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    blue: 'bg-brand-100 text-brand-800',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    slate: 'bg-slate-200 text-slate-700',
  }
  return (
    <div className="card p-5 flex items-start gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-ink">{value}</p>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ employees: 0, pending: 0, completed: 0, templates: 0 })
  const [recentDocs, setRecentDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [empRes, pendingRes, completedRes, templatesRes, recentRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'employee'),
        supabase.from('employee_documents').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('employee_documents').select('id', { count: 'exact' }).eq('status', 'completed'),
        supabase.from('document_templates').select('id', { count: 'exact' }).eq('is_active', true),
        supabase
          .from('employee_documents')
          .select('id, status, updated_at, profiles!employee_id(full_name), document_templates(name)')
          .order('updated_at', { ascending: false })
          .limit(8),
      ])

      setStats({
        employees: empRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        completed: completedRes.count ?? 0,
        templates: templatesRes.count ?? 0,
      })
      setRecentDocs(recentRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totalDocs = stats.pending + stats.completed
  const pct = totalDocs ? Math.round((stats.completed / totalDocs) * 100) : 0

  return (
    <div className="space-y-6 w-full max-w-6xl">
      {/* Hero de bienvenida */}
      <div className="hero-panel px-6 py-8 sm:px-10 sm:py-10">
        <div className="absolute inset-0 granger-texture opacity-[0.08]" aria-hidden="true" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-brand-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Panel de Recursos Humanos
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-2">
              Hola, {profile?.full_name?.split(' ')[0] ?? 'RRHH'}
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-md leading-relaxed">
              {totalDocs === 0
                ? 'Todavía no hay documentos asignados. Subí una plantilla para arrancar el onboarding.'
                : `${stats.completed} de ${totalDocs} documentos ya están completos en total (${pct}%).`}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <Link to="/admin/empleados" className="btn-primary w-full sm:w-fit group">
                <UserPlus className="w-4 h-4" />
                Nuevo empleado
              </Link>
              <Link
                to="/admin/plantillas"
                className="w-full sm:w-fit inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                           font-medium text-sm text-white bg-white/10 hover:bg-white/15
                           transition-all active:scale-[0.97]"
              >
                <FilePlus2 className="w-4 h-4" />
                Nueva plantilla
              </Link>
            </div>
          </div>

          {totalDocs > 0 && (
            <div className="flex sm:flex-col gap-4 sm:gap-3 sm:min-w-[168px]">
              <div className="flex-1 sm:flex-none bg-white/[0.06] rounded-xl px-4 py-3 backdrop-blur-sm">
                <p className="text-xl sm:text-2xl font-bold text-white leading-none">{stats.employees}</p>
                <p className="text-[11px] text-slate-400 mt-1">Empleados activos</p>
              </div>
              <div className="flex-1 sm:flex-none bg-white/[0.06] rounded-xl px-4 py-3 backdrop-blur-sm">
                <p className="text-xl sm:text-2xl font-bold text-brand-400 leading-none">{stats.pending}</p>
                <p className="text-[11px] text-slate-400 mt-1">Docs por completar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Empleados" value={stats.employees} color="blue" />
        <StatCard icon={Clock} label="Docs pendientes" value={stats.pending} sub="Por completar" color="amber" />
        <StatCard icon={CheckCircle} label="Docs completados" value={stats.completed} sub="Listos para descargar" color="green" />
        <StatCard icon={FileText} label="Plantillas" value={stats.templates} sub="Activas" color="slate" />
      </div>

      {/* Progress bar */}
      {totalDocs > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <TrendingUp className="w-4 h-4 text-brand-700" />
              Progreso general de onboarding
            </div>
            <span className="text-sm font-semibold text-ink">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {stats.completed} de {totalDocs} documentos completados
          </p>
        </div>
      )}

      {/* Recent activity */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-ink">Actividad reciente</h2>
          <Link to="/admin/empleados" className="text-xs text-brand-700 hover:underline font-medium flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {recentDocs.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-500 text-sm">
            No hay actividad aún. Asignale documentos a los empleados para comenzar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {doc.profiles?.full_name ?? 'Empleado'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{doc.document_templates?.name ?? '—'}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={doc.status} />
                  <span className="text-xs text-slate-400 hidden sm:block">
                    {new Date(doc.updated_at).toLocaleDateString('es-AR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}