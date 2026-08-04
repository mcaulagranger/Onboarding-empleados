import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-toastify'
import Calendar from '../../components/Calendar'
import EventModal from '../../components/EventModal'
import BirthdayDetailModal from '../../components/BirthdayDetailModal'
import StatusBadge from '../../components/StatusBadge'
import {
  Users, CheckCircle, Clock, FileText, ArrowRight, Cake, CalendarDays,
  Video, UserPlus, FilePlus2, PartyPopper,
} from 'lucide-react'
import {
  claveFecha, proximoCumpleanos, formatoCorto, formatoLargo, parseFechaLocal,
} from '../../lib/dateUtils'

const COLOR_CUMPLE = '#c2426b'

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    blue: 'bg-brand-100 text-brand-800',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    slate: 'bg-slate-200 text-slate-700',
    pink: 'bg-pink-100 text-pink-700',
    violet: 'bg-violet-100 text-violet-700',
  }
  return (
    <div className="card p-4 flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-ink leading-none">{value}</p>
        <p className="text-xs font-medium text-slate-600 mt-1 truncate">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// Expande cada cumpleaños a una fecha concreta por año, para un
// rango razonable (año pasado, actual y siguiente), así aparecen
// sin importar a qué mes navegue el calendario.
function expandirCumpleanos(birthdays) {
  const hoy = new Date()
  const eventos = []
  for (const b of birthdays) {
    const nacimiento = parseFechaLocal(b.birth_date)
    for (const year of [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1]) {
      eventos.push({
        id: `cumple-${b.id}-${year}`,
        date: new Date(year, nacimiento.getMonth(), nacimiento.getDate()),
        title: `🎂 ${b.first_name} ${b.last_name}`,
        color: COLOR_CUMPLE,
        isBirthday: true,
        raw: b,
      })
    }
  }
  return eventos
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [ahora, setAhora] = useState(new Date())
  const [stats, setStats] = useState({ employees: 0, pending: 0, completed: 0, templates: 0 })
  const [recentDocs, setRecentDocs] = useState([])
  const [eventosDB, setEventosDB] = useState([])
  const [cumpleanos, setCumpleanos] = useState([])
  const [loading, setLoading] = useState(true)

  const [eventModal, setEventModal] = useState(null)   // { evento, fechaInicial } | null
  const [savingEvento, setSavingEvento] = useState(false)
  const [birthdayModal, setBirthdayModal] = useState(null)

  // Reloj en vivo para el encabezado
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  async function cargarTodo() {
    const [empRes, pendingRes, completedRes, templatesRes, recentRes, eventsRes, birthdaysRes] =
      await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'employee'),
        supabase.from('employee_documents').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('employee_documents').select('id', { count: 'exact' }).eq('status', 'completed'),
        supabase.from('document_templates').select('id', { count: 'exact' }).eq('is_active', true),
        supabase
          .from('employee_documents')
          .select('id, status, updated_at, profiles!employee_id(full_name), document_templates(name)')
          .order('updated_at', { ascending: false })
          .limit(6),
        supabase.from('calendar_events').select('*').order('event_date', { ascending: true }),
        supabase.from('birthdays').select('*'),
      ])

    setStats({
      employees: empRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      completed: completedRes.count ?? 0,
      templates: templatesRes.count ?? 0,
    })
    setRecentDocs(recentRes.data ?? [])
    setEventosDB(eventsRes.data ?? [])
    setCumpleanos(birthdaysRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargarTodo() }, [])

  // ── Eventos combinados para pintar en el calendario ──
  const eventosCalendario = useMemo(() => {
    const propios = eventosDB.map((e) => ({
      id: e.id,
      date: new Date(`${e.event_date}T00:00:00`),
      title: e.title,
      color: e.color,
      isBirthday: false,
      raw: e,
    }))
    return [...propios, ...expandirCumpleanos(cumpleanos)]
  }, [eventosDB, cumpleanos])

  // ── Próximos eventos (paneles laterales) ──
  const hoy = new Date()
  const en7dias = new Date(hoy); en7dias.setDate(hoy.getDate() + 7)

  const proximosCumples = useMemo(() => (
    [...cumpleanos]
      .sort((a, b) => proximoCumpleanos(a.birth_date) - proximoCumpleanos(b.birth_date))
      .slice(0, 4)
  ), [cumpleanos])

  const proximasReuniones = useMemo(() => (
    eventosDB
      .filter((e) => e.event_type === 'reunion' && new Date(`${e.event_date}T00:00:00`) >= hoy)
      .slice(0, 4)
  ), [eventosDB])

  const eventosEstaSemana = useMemo(() => (
    eventosCalendario
      .filter((e) => e.date >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) && e.date <= en7dias)
      .sort((a, b) => a.date - b.date)
      .slice(0, 5)
  ), [eventosCalendario])

  const eventosDelMes = useMemo(() => (
    eventosCalendario.filter((e) => e.date.getMonth() === hoy.getMonth() && e.date.getFullYear() === hoy.getFullYear())
  ), [eventosCalendario])

  const cumplesEsteMes = cumpleanos.filter((b) => parseFechaLocal(b.birth_date).getMonth() === hoy.getMonth()).length
  const eventosProgramados = eventosDB.filter((e) => new Date(`${e.event_date}T00:00:00`) >= hoy).length
  const reunionesPendientes = proximasReuniones.length

  // ── Handlers de eventos ──
  function handleDayClick(date) {
    setEventModal({ evento: null, fechaInicial: claveFecha(date) })
  }
  function handleEventClick(ev) {
    if (ev.isBirthday) { setBirthdayModal(ev.raw); return }
    setEventModal({ evento: ev.raw, fechaInicial: null })
  }
  async function handleSaveEvento(form) {
    setSavingEvento(true)
    try {
      if (eventModal.evento?.id) {
        const { error } = await supabase.from('calendar_events')
          .update(form).eq('id', eventModal.evento.id)
        if (error) throw error
        toast.success('Evento actualizado')
      } else {
        const { error } = await supabase.from('calendar_events')
          .insert({ ...form, created_by: profile.id })
        if (error) throw error
        toast.success('Evento creado')
      }
      setEventModal(null)
      cargarTodo()
    } catch (err) {
      toast.error(err.message ?? 'Error al guardar el evento')
    } finally {
      setSavingEvento(false)
    }
  }
  async function handleDeleteEvento(id) {
    if (!confirm('¿Eliminar este evento?')) return
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id)
      if (error) throw error
      toast.success('Evento eliminado')
      setEventModal(null)
      cargarTodo()
    } catch (err) {
      toast.error(err.message ?? 'Error al eliminar')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="w-full space-y-6">
      {/* ── Encabezado: neutro, profesional, ancho completo ── */}
      <div className="w-full bg-natural border border-slate-200 rounded-2xl px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {formatoLargo(ahora)}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-ink mt-1">
              Hola, {profile?.full_name?.split(' ')[0] ?? 'RRHH'}
            </h1>
          </div>

          <div className="flex items-center gap-5 sm:gap-8">
            <div className="text-right">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Hora local</p>
              <p className="text-lg font-semibold text-ink tabular-nums">
                {ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Conectado como</p>
              <p className="text-sm font-medium text-ink">{profile?.full_name}</p>
            </div>
          </div>
        </div>

        {/* Resumen rápido en una línea */}
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-4 pt-4 border-t border-slate-200 text-sm text-slate-600">
          <span><strong className="text-ink">{stats.pending}</strong> documentos pendientes</span>
          <span><strong className="text-ink">{eventosProgramados}</strong> eventos programados</span>
          <span><strong className="text-ink">{cumplesEsteMes}</strong> cumpleaños este mes</span>
          {eventosEstaSemana[0] && (
            <span className="text-slate-500">
              Próximo: {eventosEstaSemana[0].title} · {formatoCorto(eventosEstaSemana[0].date)}
            </span>
          )}
        </div>
      </div>

      {/* ── Accesos rápidos ── */}
      <div className="flex flex-wrap gap-3">
        <Link to="/admin/empleados" className="btn-primary">
          <UserPlus className="w-4 h-4" />
          Nuevo empleado
        </Link>
        <Link to="/admin/plantillas" className="btn-secondary">
          <FilePlus2 className="w-4 h-4" />
          Nueva plantilla
        </Link>
        <Link to="/admin/cumpleanos" className="btn-secondary">
          <Cake className="w-4 h-4" />
          Gestionar cumpleaños
        </Link>
      </div>

      {/* ── Estadísticas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Empleados" value={stats.employees} color="blue" />
        <StatCard icon={Clock} label="Docs pendientes" value={stats.pending} color="amber" />
        <StatCard icon={CheckCircle} label="Docs completados" value={stats.completed} color="green" />
        <StatCard icon={FileText} label="Plantillas activas" value={stats.templates} color="slate" />
        <StatCard icon={Cake} label="Cumpleaños este mes" value={cumplesEsteMes} color="pink" />
        <StatCard icon={CalendarDays} label="Eventos programados" value={eventosProgramados} color="violet" />
        <StatCard icon={Video} label="Reuniones pendientes" value={reunionesPendientes} color="blue" />
        <StatCard icon={PartyPopper} label="Eventos este mes" value={eventosDelMes.length} color="amber" />
      </div>

      {/* ── Calendario + panel lateral ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Calendar
            eventos={eventosCalendario}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        </div>

        <div className="space-y-4">
          {/* Próximos cumpleaños */}
          <div className="card p-4">
            <h3 className="section-heading text-sm mb-3">Próximos cumpleaños</h3>
            {proximosCumples.length === 0 ? (
              <p className="text-xs text-slate-400">Sin registros todavía.</p>
            ) : (
              <div className="space-y-2.5">
                {proximosCumples.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBirthdayModal(b)}
                    className="flex items-center gap-2.5 w-full text-left hover:bg-slate-50 -mx-1 px-1 py-1 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 text-xs font-bold uppercase flex-shrink-0">
                      {b.first_name?.[0]}{b.last_name?.[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink truncate">{b.first_name} {b.last_name}</p>
                      <p className="text-xs text-slate-400">{formatoCorto(proximoCumpleanos(b.birth_date))}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Próximas reuniones */}
          <div className="card p-4">
            <h3 className="section-heading text-sm mb-3">Próximas reuniones</h3>
            {proximasReuniones.length === 0 ? (
              <p className="text-xs text-slate-400">No hay reuniones agendadas.</p>
            ) : (
              <div className="space-y-2.5">
                {proximasReuniones.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEventModal({ evento: e, fechaInicial: null })}
                    className="flex items-start gap-2.5 w-full text-left hover:bg-slate-50 -mx-1 px-1 py-1 rounded-lg transition-colors"
                  >
                    <Video className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink truncate">{e.title}</p>
                      <p className="text-xs text-slate-400">{formatoCorto(new Date(`${e.event_date}T00:00:00`))}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Esta semana */}
          <div className="card p-4">
            <h3 className="section-heading text-sm mb-3">Esta semana</h3>
            {eventosEstaSemana.length === 0 ? (
              <p className="text-xs text-slate-400">Sin eventos en los próximos 7 días.</p>
            ) : (
              <div className="space-y-2.5">
                {eventosEstaSemana.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                    <p className="text-sm text-ink truncate flex-1">{e.title}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0">{formatoCorto(e.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen del mes */}
          <div className="card p-4">
            <h3 className="section-heading text-sm mb-1">Este mes</h3>
            <p className="text-2xl font-bold text-ink mt-2">{eventosDelMes.length}</p>
            <p className="text-xs text-slate-500">eventos y cumpleaños en total</p>
          </div>
        </div>
      </div>

      {/* ── Actividad reciente de documentos ── */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="section-heading">Actividad reciente</h2>
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
                  <p className="text-sm font-medium text-ink truncate">{doc.profiles?.full_name ?? 'Empleado'}</p>
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

      {/* ── Modales ── */}
      {eventModal && (
        <EventModal
          evento={eventModal.evento}
          fechaInicial={eventModal.fechaInicial}
          saving={savingEvento}
          onSave={handleSaveEvento}
          onDelete={handleDeleteEvento}
          onClose={() => setEventModal(null)}
        />
      )}
      {birthdayModal && (
        <BirthdayDetailModal cumple={birthdayModal} onClose={() => setBirthdayModal(null)} />
      )}
    </div>
  )
}