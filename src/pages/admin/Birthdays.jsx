import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-toastify'
import Modal from '../../components/Modal'
import { edadQueCumple, proximoCumpleanos, formatoCorto, parseFechaLocal } from '../../lib/dateUtils'
import { subirImagenCloudinary } from '../../lib/cloudinary'
import {
  PlusCircle, Pencil, Trash2, Cake, Camera, Search, Mail, Briefcase,
} from 'lucide-react'

export default function Birthdays() {
  const { profile } = useAuth()
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null) // registro en edición, o null = nuevo
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(vacio())
  const [file, setFile] = useState(null)
  const fileRef = useRef()

  function vacio() {
    return { first_name: '', last_name: '', department: '', position: '', birth_date: '', email: '' }
  }

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('birthdays')
      .select('*')
      .order('last_name', { ascending: true })
    if (error) toast.error('No se pudo cargar el listado')
    else {
      // Si ya tiene photo_url (Cloudinary), esa URL es pública y se usa
      // directo. Si es una foto vieja (solo photo_path, de Supabase
      // Storage), se genera una URL firmada como antes.
      const conFotos = await Promise.all((data ?? []).map(async (b) => {
        if (b.photo_url) return { ...b, photoUrl: b.photo_url }
        if (!b.photo_path) return { ...b, photoUrl: null }
        const { data: signed } = await supabase.storage
          .from('birthday-photos')
          .createSignedUrl(b.photo_path, 3600)
        return { ...b, photoUrl: signed?.signedUrl ?? null }
      }))
      setLista(conFotos)
    }
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function abrirNuevo() {
    setEditando(null)
    setForm(vacio())
    setFile(null)
    setShowModal(true)
  }

  function abrirEditar(b) {
    setEditando(b)
    setForm({
      first_name: b.first_name, last_name: b.last_name,
      department: b.department ?? '', position: b.position ?? '',
      birth_date: b.birth_date, email: b.email ?? '',
    })
    setFile(null)
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      // Las fotos NUEVAS van a Cloudinary (ahí es donde ya tenés el resto
      // de las imágenes). Las viejas subidas a Supabase Storage
      // (photo_path) se dejan como están, no se tocan ni se borran.
      let photo_url = editando?.photo_url ?? null

      if (file) {
        photo_url = await subirImagenCloudinary(file)
      }

      const payload = { ...form, photo_url }

      if (editando) {
        const { error } = await supabase.from('birthdays').update(payload).eq('id', editando.id)
        if (error) throw error
        toast.success('Registro actualizado')
      } else {
        const { error } = await supabase.from('birthdays').insert({ ...payload, created_by: profile.id })
        if (error) throw error
        toast.success('Cumpleaños agregado')
      }
      setShowModal(false)
      cargar()
    } catch (err) {
      toast.error(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(b) {
    if (!confirm(`¿Eliminar el registro de ${b.first_name} ${b.last_name}?`)) return
    try {
      if (b.photo_path) await supabase.storage.from('birthday-photos').remove([b.photo_path])
      const { error } = await supabase.from('birthdays').delete().eq('id', b.id)
      if (error) throw error
      toast.success('Registro eliminado')
      cargar()
    } catch (err) {
      toast.error(err.message ?? 'Error al eliminar')
    }
  }

  const filtrada = lista.filter((b) =>
    `${b.first_name} ${b.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    b.department?.toLowerCase().includes(search.toLowerCase())
  )

  // Ordenados por próxima ocurrencia del cumpleaños (no por nombre)
  const ordenada = [...filtrada].sort(
    (a, b) => proximoCumpleanos(a.birth_date) - proximoCumpleanos(b.birth_date)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Cumpleaños</h1>
          <p className="text-slate-500 text-sm mt-1">
            {lista.length} personas registradas · se muestran en el calendario principal
          </p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary">
          <PlusCircle className="w-4 h-4" />
          Agregar persona
        </button>
      </div>

      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <Cake className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
        <p>
          Este listado no depende de que la persona tenga cuenta en el portal — podés
          cargar a cualquier integrante del equipo. Queda preparado para, más adelante,
          mandar el mail de saludo automáticamente el día del cumpleaños.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Buscar por nombre o área..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ordenada.length === 0 ? (
        <div className="card py-16 text-center">
          <Cake className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {search ? 'No se encontraron resultados.' : 'Todavía no cargaste ningún cumpleaños.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordenada.map((b) => (
            <div key={b.id} className="card p-4 flex flex-col gap-3 transition-all hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center text-brand-800 font-bold uppercase flex-shrink-0 overflow-hidden">
                  {b.photoUrl ? (
                    <img src={b.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    `${b.first_name?.[0] ?? ''}${b.last_name?.[0] ?? ''}`
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink truncate">{b.first_name} {b.last_name}</p>
                  {(b.department || b.position) && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                      <Briefcase className="w-3 h-3 flex-shrink-0" />
                      {b.department}{b.position && ` · ${b.position}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-brand-700 font-medium">
                  <Cake className="w-4 h-4" />
                  {formatoCorto(parseFechaLocal(b.birth_date))} · cumple {edadQueCumple(b.birth_date)}
                </span>
              </div>

              {b.email && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                  <Mail className="w-3 h-3 flex-shrink-0" /> {b.email}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => abrirEditar(b)} className="btn-secondary text-xs py-1.5 flex-1 justify-center">
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(b)}
                  className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editando ? 'Editar persona' : 'Agregar persona'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="flex justify-center">
              <div
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-brand-400 transition-colors"
              >
                {file ? (
                  <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                ) : editando?.photoUrl ? (
                  <img src={editando.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0] ?? null)}
              />
            </div>
            <p className="text-center text-xs text-slate-400">Foto (opcional)</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" required value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Apellido *</label>
                <input className="input" required value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Área</label>
                <input className="input" value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div>
                <label className="label">Cargo</label>
                <input className="input" value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div>
                <label className="label">Fecha de nacimiento *</label>
                <input className="input" type="date" required value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Correo electrónico</label>
                <input className="input" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 mt-4">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <span className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />}
                {editando ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}