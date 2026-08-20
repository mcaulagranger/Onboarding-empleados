import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-toastify'
import Modal from '../../components/Modal'
import {
  UserPlus, Search, ChevronRight, Calendar, Briefcase,
  CheckCircle, Clock, Users, Mail, KeyRound
} from 'lucide-react'

function ProgressBar({ completed, total }) {
  if (total === 0) return <span className="text-xs text-slate-400">Sin docs asignados</span>
  const pct = Math.round((completed / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-slate-100 rounded-full h-1.5">
        <div
          className="bg-emerald-600 h-1.5 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-600">{completed}/{total}</span>
    </div>
  )
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [docStats, setDocStats] = useState({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', department: '', position: '', start_date: '',
    invitar: true, // por defecto se manda la invitación por email
  })

  async function loadEmployees() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'employee')
      .order('created_at', { ascending: false })
    setEmployees(data ?? [])

    // Cargar estadísticas de documentos
    if (data?.length) {
      const { data: docs } = await supabase
        .from('employee_documents')
        .select('employee_id, status')
        .in('employee_id', data.map((e) => e.id))

      const stats = {}
      for (const emp of data) {
        const empDocs = docs?.filter((d) => d.employee_id === emp.id) ?? []
        stats[emp.id] = {
          total: empDocs.length,
          completed: empDocs.filter((d) => d.status === 'completed').length,
        }
      }
      setDocStats(stats)
    }
    setLoading(false)
  }

  useEffect(() => { loadEmployees() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      // Se crea vía Edge Function para no interrumpir la sesión de RRHH
      const { data, error } = await supabase.functions.invoke('crear-empleado', {
        body: {
          full_name: form.full_name,
          email: form.email,
          // Si es por invitación no mandamos contraseña; la define el empleado.
          invitar: form.invitar,
          password: form.invitar ? undefined : form.password,
          department: form.department,
          position: form.position,
          start_date: form.start_date || null,
        },
      })

      if (error) {
        // invoke() no devuelve el cuerpo cuando el status no es 2xx:
        // el detalle viene en error.context, que es un Response.
        let detalle = error.message
        try {
          const cuerpo = await error.context?.json()
          console.error('Respuesta de crear-empleado:', cuerpo)
          if (cuerpo?.error) detalle = cuerpo.error
        } catch {
          console.error('crear-empleado falló sin cuerpo JSON:', error)
        }
        throw new Error(detalle)
      }

      if (data?.error) throw new Error(data.error)
      if (data?.warning) toast.warning(data.warning)

      toast.success(
        (data?.invitado ?? form.invitar)
          ? `Invitación enviada a ${form.email}`
          : `${form.full_name} ya puede ingresar al portal`
      )
      setShowModal(false)
      setForm({ full_name: '', email: '', password: '', department: '', position: '', start_date: '', invitar: true })
      loadEmployees()
    } catch (err) {
      toast.error(err.message ?? 'No se pudo crear el empleado')
    } finally {
      setSaving(false)
    }
  }

  const filtered = employees.filter((e) =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Empleados</h1>
          <p className="text-slate-500 text-sm mt-1">{employees.length} empleados registrados</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <UserPlus className="w-4 h-4" />
          Nuevo empleado
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Buscar por nombre, email o área..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {search ? 'No se encontraron resultados.' : 'No hay empleados aún. Crea el primero.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-6 py-3 font-medium text-slate-600 hidden md:table-cell">Área / Puesto</th>
                <th className="text-left px-6 py-3 font-medium text-slate-600 hidden lg:table-cell">Ingreso</th>
                <th className="text-left px-6 py-3 font-medium text-slate-600">Documentos</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => {
                const s = docStats[emp.id] ?? { total: 0, completed: 0 }
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-xs uppercase flex-shrink-0">
                          {emp.full_name?.charAt(0) ?? '?'}
                        </div>
                        <div>
                          <p className="font-medium text-ink">{emp.full_name}</p>
                          <p className="text-xs text-slate-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {emp.department && (
                          <span className="flex items-center gap-1 text-xs">
                            <Briefcase className="w-3 h-3" /> {emp.department}
                          </span>
                        )}
                        {emp.position && <span className="text-xs text-slate-500">{emp.position}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      {emp.start_date ? (
                        <span className="flex items-center gap-1 text-xs text-slate-600">
                          <Calendar className="w-3 h-3" />
                          {new Date(emp.start_date).toLocaleDateString('es-AR')}
                        </span>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <ProgressBar completed={s.completed} total={s.total} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/admin/empleados/${emp.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-ink"
                      >
                        Ver <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear empleado */}
      {showModal && (
        <Modal title="Nuevo empleado" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Nombre completo *</label>
                <input className="input" required value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Email *</label>
                <input className="input" type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Cómo ingresa el empleado</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, invitar: true })}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                      form.invitar
                        ? 'border-brand-500 bg-brand-50 text-brand-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span>Invitación por email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, invitar: false })}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                      !form.invitar
                        ? 'border-brand-500 bg-brand-50 text-brand-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <KeyRound className="w-4 h-4 flex-shrink-0" />
                    <span>Contraseña temporal</span>
                  </button>
                </div>

                {form.invitar ? (
                  <p className="text-xs text-slate-500 mt-2">
                    Se le enviará un email para que defina su propia contraseña y
                    entre al portal.
                  </p>
                ) : (
                  <div className="mt-3">
                    <label className="label">Contraseña temporal *</label>
                    <input className="input" type="password" required minLength={6} value={form.password}
                      placeholder="Mínimo 6 caracteres"
                      onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <p className="text-xs text-slate-500 mt-1">
                      Compartila con el empleado para su primer ingreso.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Área / Departamento</label>
                <input className="input" value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div>
                <label className="label">Puesto</label>
                <input className="input" value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div>
                <label className="label">Fecha de ingreso</label>
                <input className="input" type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 mt-4">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
                {saving ? 'Creando...' : 'Crear empleado'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}