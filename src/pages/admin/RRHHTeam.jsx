import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-toastify'
import Modal from '../../components/Modal'
import {
  UserPlus, ShieldCheck, Ban, RotateCcw, Trash2, Mail, ShieldAlert,
} from 'lucide-react'

export default function RRHHTeam() {
  const { profile } = useAuth()
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', department: '' })

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'rrhh')
      .order('created_at', { ascending: false })
    if (error) toast.error('No se pudo cargar el listado')
    else setLista(data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  // Ruta compartida con /admin, pero el contenido es exclusivo del
  // Super Admin. Si entra alguien de RRHH por la URL directa, se
  // lo manda de vuelta al panel — no ve ni el listado. Este chequeo
  // va DESPUÉS de declarar los hooks: React exige que los hooks se
  // llamen siempre, en el mismo orden, en cada render.
  if (profile && profile.role !== 'admin') {
    return <Navigate to="/admin" replace />
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data, error } = await supabase.functions.invoke('crear-rrhh', {
        body: form,
      })
      if (error) {
        const cuerpo = await error.context?.json().catch(() => null)
        throw new Error(cuerpo?.error ?? error.message)
      }
      if (data?.error) throw new Error(data.error)
      if (data?.warning) toast.warning(data.warning)

      toast.success(`${form.full_name} ya puede entrar como RRHH`)
      setShowModal(false)
      setForm({ full_name: '', email: '', password: '', department: '' })
      cargar()
    } catch (err) {
      toast.error(err.message ?? 'No se pudo crear la cuenta')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivo(persona) {
    setBusyId(persona.id)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !persona.is_active })
        .eq('id', persona.id)
      if (error) throw error
      toast.success(persona.is_active ? 'Cuenta desactivada' : 'Cuenta reactivada')
      cargar()
    } catch (err) {
      toast.error(err.message ?? 'No se pudo actualizar el estado')
    } finally {
      setBusyId(null)
    }
  }

  async function eliminar(persona) {
    if (!confirm(
      `¿Eliminar definitivamente a ${persona.full_name}? Esta acción no se puede deshacer. ` +
      `Si preferís poder reactivarla más adelante, usá "Desactivar" en vez de esto.`
    )) return

    setBusyId(persona.id)
    try {
      const { data, error } = await supabase.functions.invoke('eliminar-usuario', {
        body: { target_id: persona.id },
      })
      if (error) {
        const cuerpo = await error.context?.json().catch(() => null)
        throw new Error(cuerpo?.error ?? error.message)
      }
      if (data?.error) throw new Error(data.error)
      toast.success('Cuenta eliminada')
      cargar()
    } catch (err) {
      toast.error(err.message ?? 'No se pudo eliminar')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Equipo de RRHH</h1>
          <p className="text-slate-500 text-sm mt-1">
            {lista.length} cuenta{lista.length !== 1 ? 's' : ''} con acceso operativo
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <UserPlus className="w-4 h-4" />
          Nueva cuenta de RRHH
        </button>
      </div>

      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
        <p>
          Estas cuentas pueden asignar documentos, subir plantillas, crear empleados y
          gestionar cumpleaños — todo lo mismo que vos, salvo esta pantalla: solo el Super
          Admin puede crear o dar de baja cuentas de RRHH. Nadie más la ve, aunque entre
          por la URL directa.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <div className="card py-16 text-center">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Todavía no creaste ninguna cuenta de RRHH.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-6 py-3 font-medium text-slate-600 hidden md:table-cell">Correo</th>
                <th className="text-left px-6 py-3 font-medium text-slate-600">Estado</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-800 font-semibold text-xs uppercase flex-shrink-0">
                        {p.full_name?.charAt(0) ?? '?'}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{p.full_name}</p>
                        <p className="text-xs text-slate-500 md:hidden">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 hidden md:table-cell">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {p.email}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wide ${
                      p.is_active
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-slate-200 text-slate-600 border-slate-300'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      {p.is_active ? 'Activa' : 'Desactivada'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleActivo(p)}
                        disabled={busyId === p.id}
                        className={`p-1.5 rounded transition-colors disabled:opacity-40 ${
                          p.is_active
                            ? 'text-slate-400 hover:text-amber-700 hover:bg-amber-50'
                            : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title={p.is_active ? 'Desactivar (reversible)' : 'Reactivar'}
                      >
                        {p.is_active ? <Ban className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => eliminar(p)}
                        disabled={busyId === p.id}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Eliminar definitivamente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Nueva cuenta de RRHH" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div>
              <label className="label">Nombre completo *</label>
              <input className="input" required value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Correo electrónico *</label>
              <input className="input" type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Contraseña temporal *</label>
              <input className="input" type="password" required minLength={6} value={form.password}
                placeholder="Mínimo 6 caracteres"
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-slate-500 mt-1">Compartísela para su primer ingreso.</p>
            </div>
            <div>
              <label className="label">Área (opcional)</label>
              <input className="input" value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 mt-4">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <span className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />}
                Crear cuenta
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
