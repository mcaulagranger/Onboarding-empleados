import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-toastify'
import Modal from '../../components/Modal'
import {
  Upload, Trash2, FileText, Eye, PlusCircle, AlertCircle, Download,
  Send, Users, Search, Mail,
} from 'lucide-react'

export default function Templates() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [file, setFile] = useState(null)
  const fileRef = useRef()

  // ── Asignación masiva ──────────────────────────────
  const [assignTarget, setAssignTarget] = useState(null) // plantilla seleccionada
  const [employees, setEmployees] = useState([])
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [notify, setNotify] = useState(true)
  const [assigning, setAssigning] = useState(false)

  async function loadTemplates() {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .order('created_at', { ascending: false })
    setTemplates(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadTemplates() }, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return toast.error('Seleccioná un archivo PDF')
    setUploading(true)
    try {
      const filePath = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`

      const { error: storageError } = await supabase.storage
        .from('document-templates')
        .upload(filePath, file, { contentType: 'application/pdf', upsert: false })
      if (storageError) throw storageError

      const { error: dbError } = await supabase.from('document_templates').insert({
        name: form.name,
        description: form.description || null,
        file_path: filePath,
        file_name: file.name,
        created_by: profile.id,
      })
      if (dbError) throw dbError

      toast.success('Plantilla subida correctamente')
      setShowModal(false)
      setForm({ name: '', description: '' })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      loadTemplates()
    } catch (err) {
      toast.error(err.message ?? 'Error al subir la plantilla')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(tpl) {
    if (!confirm(`¿Eliminar la plantilla "${tpl.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await supabase.storage.from('document-templates').remove([tpl.file_path])
      const { error } = await supabase.from('document_templates').delete().eq('id', tpl.id)
      if (error) throw error
      toast.success('Plantilla eliminada')
      loadTemplates()
    } catch (err) {
      toast.error(err.message ?? 'Error al eliminar')
    }
  }

  async function handlePreview(filePath) {
    try {
      const { data, error } = await supabase.storage
        .from('document-templates')
        .createSignedUrl(filePath, 60)
      if (error) throw error
      window.open(data.signedUrl, '_blank')
    } catch {
      toast.error('No se pudo abrir el archivo')
    }
  }

  async function handleDownload(filePath, fileName) {
    try {
      const { data, error } = await supabase.storage
        .from('document-templates')
        .download(filePath)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar')
    }
  }

  // ── Abrir modal de asignación masiva ──────────────
  async function openAssign(tpl) {
    setAssignTarget(tpl)
    setSelectedEmployees([])
    setEmployeeSearch('')
    setNotify(true)

    const [empRes, alreadyRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, department').eq('role', 'employee').order('full_name'),
      supabase.from('employee_documents').select('employee_id').eq('template_id', tpl.id),
    ])

    const yaAsignados = new Set((alreadyRes.data ?? []).map((r) => r.employee_id))
    setEmployees(
      (empRes.data ?? []).map((e) => ({ ...e, yaAsignado: yaAsignados.has(e.id) }))
    )
  }

  function toggleEmployee(id) {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  function toggleAll(disponibles) {
    const ids = disponibles.map((e) => e.id)
    const todosSeleccionados = ids.every((id) => selectedEmployees.includes(id))
    setSelectedEmployees(todosSeleccionados ? [] : ids)
  }

  async function handleBulkAssign() {
    if (!selectedEmployees.length || !assignTarget) return
    setAssigning(true)
    try {
      const rows = selectedEmployees.map((employee_id) => ({
        employee_id,
        template_id: assignTarget.id,
        assigned_by: profile.id,
        status: 'pending',
      }))

      const { data: creados, error } = await supabase
        .from('employee_documents')
        .insert(rows)
        .select('id, employee_id')
      if (error) throw error

      toast.success(
        `"${assignTarget.name}" asignado a ${selectedEmployees.length} empleado(s)`
      )

      // Un mail por empleado, agrupando los docs recién asignados
      if (notify && creados?.length) {
        const porEmpleado = {}
        for (const c of creados) {
          porEmpleado[c.employee_id] ??= []
          porEmpleado[c.employee_id].push(c.id)
        }
        const envios = Object.entries(porEmpleado).map(([employee_id, ids]) =>
          supabase.functions.invoke('notificar-documentos', {
            body: { employee_id, employee_document_ids: ids, motivo: 'asignacion' },
          })
        )
        const resultados = await Promise.allSettled(envios)

        // invoke() no rechaza la promesa cuando la función devuelve
        // un error HTTP: resuelve con { data: null, error }. Hay que
        // revisar ese campo además de mirar los rejected.
        let primerError = null
        let fallidos = 0
        for (const r of resultados) {
          if (r.status === 'rejected') {
            fallidos++
            primerError ??= r.reason?.message
          } else if (r.value?.error) {
            fallidos++
            const cuerpo = await r.value.error.context?.json().catch(() => null)
            primerError ??= cuerpo?.error ?? r.value.error.message
          }
        }

        if (fallidos) {
          toast.warning(
            `Se asignó el documento, pero ${fallidos} mail(s) no se enviaron` +
            (primerError ? `: ${primerError}` : '')
          )
        } else {
          toast.info('Aviso enviado por mail a los empleados')
        }
      }

      setAssignTarget(null)
    } catch (err) {
      toast.error(err.message ?? 'Error al asignar')
    } finally {
      setAssigning(false)
    }
  }

  const filteredEmployees = employees.filter((e) =>
    e.full_name?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    e.department?.toLowerCase().includes(employeeSearch.toLowerCase())
  )
  const disponibles = filteredEmployees.filter((e) => !e.yaAsignado)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Plantillas de documentos</h1>
          <p className="text-slate-500 text-sm mt-1">
            PDF base que se asignan a los empleados para completar
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary group">
          <PlusCircle className="w-4 h-4 transition-transform group-hover:rotate-90" />
          Nueva plantilla
        </button>
      </div>

      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
        <p>
          Subí los PDF base (declaraciones juradas, formularios, recibos, etc.). Podés
          asignar cada plantilla a uno o a muchos empleados a la vez desde el botón
          <strong> Asignar</strong>, y avisarles por mail automáticamente.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="card py-16 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">No hay plantillas aún</p>
          <p className="text-slate-400 text-xs mt-1">
            Subí el primer documento para empezar el onboarding
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4 mx-auto">
            <Upload className="w-4 h-4" />
            Subir plantilla
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="card p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-300"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-durazno" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-fg truncate">{tpl.name}</p>
                  {tpl.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{tpl.description}</p>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-400 truncate">{tpl.file_name}</div>

              <button
                onClick={() => openAssign(tpl)}
                className="btn-primary text-xs py-2 justify-center w-full"
              >
                <Users className="w-3.5 h-3.5" />
                Asignar a empleados
              </button>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => handlePreview(tpl.file_path)}
                  className="flex-1 btn-secondary text-xs py-1.5 justify-center"
                  title="Ver en nueva pestaña"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver
                </button>
                <button
                  onClick={() => handleDownload(tpl.file_path, tpl.file_name)}
                  className="p-1.5 rounded text-slate-400 hover:text-brand-700 hover:bg-brand-100 transition-colors"
                  title="Descargar"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(tpl)}
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

      {/* Modal subir plantilla */}
      {showModal && (
        <Modal title="Subir nueva plantilla" onClose={() => setShowModal(false)}>
          <form onSubmit={handleUpload} className="p-6 space-y-4">
            <div>
              <label className="label">Nombre del documento *</label>
              <input
                className="input"
                required
                placeholder="Ej: Recibo de sueldo — Julio 2026"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Descripción (opcional)</label>
              <textarea
                className="input h-20 resize-none"
                placeholder="Instrucciones o aclaraciones para el empleado..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Archivo PDF *</label>
              <div
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
                    <FileText className="w-5 h-5 text-durazno" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">Hacé clic para seleccionar un PDF</p>
                    <p className="text-xs text-slate-400 mt-1">Solo archivos PDF</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0] ?? null)}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={uploading || !file} className="btn-primary">
                {uploading && <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
                {uploading ? 'Subiendo...' : 'Subir plantilla'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal asignación masiva */}
      {assignTarget && (
        <Modal
          title={`Asignar "${assignTarget.name}"`}
          onClose={() => setAssignTarget(null)}
          size="lg"
        >
          <div className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Buscar por nombre o área..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
              />
            </div>

            {disponibles.length > 0 && (
              <button
                onClick={() => toggleAll(disponibles)}
                className="text-xs text-brand-700 hover:underline font-medium"
              >
                {disponibles.every((e) => selectedEmployees.includes(e.id))
                  ? 'Deseleccionar todos'
                  : `Seleccionar todos (${disponibles.length})`}
              </button>
            )}

            <div className="max-h-72 overflow-y-auto space-y-1.5 -mx-1 px-1">
              {filteredEmployees.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No hay empleados que coincidan con la búsqueda.
                </p>
              ) : (
                filteredEmployees.map((emp) => (
                  <label
                    key={emp.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      emp.yaAsignado
                        ? 'border-slate-200 bg-white/[0.03] opacity-60 cursor-not-allowed'
                        : selectedEmployees.includes(emp.id)
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-brand-500"
                      disabled={emp.yaAsignado}
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                    />
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-800 font-semibold text-xs uppercase flex-shrink-0">
                      {emp.full_name?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg truncate">{emp.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{emp.department || emp.email}</p>
                    </div>
                    {emp.yaAsignado && (
                      <span className="text-[11px] text-slate-400 flex-shrink-0">Ya asignado</span>
                    )}
                  </label>
                ))
              )}
            </div>

            <label className="flex items-center gap-2 pt-2 border-t border-slate-200 text-sm text-slate-700">
              <input
                type="checkbox"
                className="accent-brand-500"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              <Mail className="w-4 h-4 text-slate-400" />
              Avisarles por mail apenas se asigne
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setAssignTarget(null)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={!selectedEmployees.length || assigning}
                onClick={handleBulkAssign}
              >
                {assigning ? (
                  <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {assigning
                  ? 'Asignando...'
                  : `Asignar${selectedEmployees.length ? ` (${selectedEmployees.length})` : ''}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}