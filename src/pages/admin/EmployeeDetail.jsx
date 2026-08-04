import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-toastify'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import {
  ArrowLeft, Plus, Download, Trash2, UserCircle, Mail, Phone,
  Calendar, Briefcase, FileText, CheckCircle2, Send, BellRing
} from 'lucide-react'

export default function EmployeeDetail() {
  const { id } = useParams()
  const { profile: adminProfile } = useAuth()
  const [employee, setEmployee] = useState(null)
  const [docs, setDocs] = useState([])
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState([])
  const [showAssign, setShowAssign] = useState(false)
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [notify, setNotify] = useState(true)
  const [remindingId, setRemindingId] = useState(null)

  async function loadData() {
    const [empRes, docsRes, tplRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('employee_documents')
        .select('*, document_templates(id, name, description, file_path)')
        .eq('employee_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('document_templates').select('*').eq('is_active', true),
    ])
    setEmployee(empRes.data)
    setDocs(docsRes.data ?? [])
    setTemplates(tplRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  // Templates no asignadas aún
  const assignedIds = docs.map((d) => d.template_id)
  const available = templates.filter((t) => !assignedIds.includes(t.id))

  // invoke() no devuelve el cuerpo cuando el status no es 2xx:
  // el detalle real viene en error.context, que es un Response.
  async function extraerError(error, fallback) {
    if (!error) return null
    try {
      const cuerpo = await error.context?.json()
      return cuerpo?.error ?? fallback
    } catch {
      return fallback
    }
  }

  async function handleAssign() {
    if (!selected.length) return
    setAssigning(true)
    try {
      const rows = selected.map((templateId) => ({
        employee_id: id,
        template_id: templateId,
        assigned_by: adminProfile.id,
        status: 'pending',
      }))
      const { data: creados, error } = await supabase
        .from('employee_documents')
        .insert(rows)
        .select('id')
      if (error) throw error
      toast.success(`${selected.length} documento(s) asignado(s)`)
      setShowAssign(false)
      setSelected([])
      loadData()

      if (notify && creados?.length) {
        const { error: mailError } = await supabase.functions.invoke('notificar-documentos', {
          body: {
            employee_id: id,
            employee_document_ids: creados.map((c) => c.id),
            motivo: 'asignacion',
          },
        })
        if (mailError) {
          const detalle = await extraerError(mailError, 'el mail no se pudo enviar')
          toast.warning(`El documento se asignó, pero ${detalle}`)
        } else {
          toast.info('Le avisamos por mail al empleado')
        }
      }
    } catch (err) {
      toast.error(err.message ?? 'Error al asignar documentos')
    } finally {
      setAssigning(false)
    }
  }

  async function handleRemind(doc) {
    setRemindingId(doc.id)
    try {
      const { error } = await supabase.functions.invoke('notificar-documentos', {
        body: {
          employee_id: id,
          employee_document_ids: [doc.id],
          motivo: 'recordatorio',
        },
      })
      if (error) {
        const detalle = await extraerError(error, 'No se pudo enviar el recordatorio')
        throw new Error(detalle)
      }
      toast.success(`Recordatorio enviado a ${employee.full_name}`)
    } catch (err) {
      toast.error(err.message ?? 'Error al enviar el recordatorio')
    } finally {
      setRemindingId(null)
    }
  }

  async function handleRemoveDoc(docId) {
    if (!confirm('¿Quitar este documento del empleado?')) return
    const { error } = await supabase.from('employee_documents').delete().eq('id', docId)
    if (error) toast.error('Error al quitar el documento')
    else {
      toast.success('Documento quitado')
      loadData()
    }
  }

  async function handleDownload(filePath, fileName) {
    try {
      const { data, error } = await supabase.storage
        .from('completed-documents')
        .download(filePath)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'documento.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar el archivo')
    }
  }

  async function handleDownloadTemplate(filePath, fileName) {
    try {
      const { data, error } = await supabase.storage
        .from('document-templates')
        .download(filePath)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'plantilla.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar la plantilla')
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!employee) return (
    <div className="text-center py-16 text-slate-500">Empleado no encontrado.</div>
  )

  const completed = docs.filter((d) => d.status === 'completed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/empleados" className="p-2 rounded-lg hover:bg-white/10 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-fg">{employee.full_name}</h1>
          <p className="text-slate-500 text-sm">Detalle del empleado</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Info del empleado */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg uppercase">
                {employee.full_name?.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-fg">{employee.full_name}</p>
                <StatusBadge status={completed === docs.length && docs.length > 0 ? 'completed' : 'pending'} />
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                {employee.email}
              </div>
              {employee.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {employee.phone}
                </div>
              )}
              {employee.department && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  {employee.department} {employee.position && `· ${employee.position}`}
                </div>
              )}
              {employee.start_date && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Ingreso: {new Date(employee.start_date).toLocaleDateString('es-AR')}
                </div>
              )}
              {employee.dni && (
                <div className="flex items-center gap-2 text-slate-600">
                  <UserCircle className="w-4 h-4 text-slate-400" />
                  DNI: {employee.dni}
                </div>
              )}
            </div>
          </div>

          {/* Progreso */}
          <div className="card p-5">
            <h3 className="font-medium text-fg mb-3">Progreso de documentación</h3>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold text-fg">{completed}</span>
              <span className="text-slate-500 text-sm mb-1">/ {docs.length} docs</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 mb-2">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all"
                style={{ width: docs.length ? `${(completed / docs.length) * 100}%` : '0%' }}
              />
            </div>
            {completed === docs.length && docs.length > 0 && (
              <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium mt-2">
                <CheckCircle2 className="w-4 h-4" />
                Documentación completa
              </div>
            )}
          </div>
        </div>

        {/* Documentos asignados */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-heading">Documentos asignados</h2>
            {available.length > 0 && (
              <button onClick={() => setShowAssign(true)} className="btn-primary text-sm py-1.5">
                <Plus className="w-4 h-4" />
                Asignar documentos
              </button>
            )}
          </div>

          {docs.length === 0 ? (
            <div className="card py-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Sin documentos asignados aún.</p>
              <button
                onClick={() => setShowAssign(true)}
                className="mt-3 text-sm text-brand-700 hover:underline font-medium"
              >
                Asignar documentos →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className={`card p-4 flex items-center justify-between gap-3 border-l-4 transition-all duration-200 hover:shadow-md ${
                    doc.status === 'completed'
                      ? 'border-l-emerald-600'
                      : 'border-l-brand-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className={`w-5 h-5 flex-shrink-0 ${
                      doc.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'
                    }`} />
                    <div className="min-w-0">
                      <p className="font-medium text-fg truncate">
                        {doc.document_templates?.name}
                      </p>
                      {doc.document_templates?.description && (
                        <p className="text-xs text-slate-500 truncate">
                          {doc.document_templates.description}
                        </p>
                      )}
                      {doc.completed_at && (
                        <p className="text-xs text-slate-400">
                          Completado: {new Date(doc.completed_at).toLocaleDateString('es-AR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={doc.status} />
                    {/* Descargar plantilla */}
                    <button
                      onClick={() => handleDownloadTemplate(
                        doc.document_templates?.file_path,
                        doc.document_templates?.name + '.pdf'
                      )}
                      className="p-1.5 rounded text-slate-400 hover:text-brand-700 hover:bg-brand-100 transition-colors"
                      title="Descargar plantilla"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {/* Descargar completado */}
                    {doc.status === 'completed' && doc.completed_file_path && (
                      <button
                        onClick={() => handleDownload(
                          doc.completed_file_path,
                          `${employee.full_name}_${doc.document_templates?.name}.pdf`
                        )}
                        className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Descargar documento completado"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {/* Recordatorio por mail (solo pendientes) */}
                    {doc.status === 'pending' && (
                      <button
                        onClick={() => handleRemind(doc)}
                        disabled={remindingId === doc.id}
                        className="p-1.5 rounded text-slate-400 hover:text-brand-700 hover:bg-brand-100 transition-colors disabled:opacity-50"
                        title="Enviar recordatorio por mail"
                      >
                        {remindingId === doc.id ? (
                          <span className="block w-4 h-4 border-2 border-brand-500/40 border-t-brand-600 rounded-full animate-spin" />
                        ) : (
                          <BellRing className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveDoc(doc.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Quitar documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal asignar documentos */}
      {showAssign && (
        <Modal title="Asignar documentos" onClose={() => { setShowAssign(false); setSelected([]) }}>
          <div className="p-6 space-y-4">
            {available.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">
                Todos los documentos activos ya están asignados.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Seleccioná los documentos a asignar a <strong>{employee.full_name}</strong>:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {available.map((tpl) => (
                    <label
                      key={tpl.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selected.includes(tpl.id)
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-brand-600"
                        checked={selected.includes(tpl.id)}
                        onChange={(e) => {
                          setSelected(
                            e.target.checked
                              ? [...selected, tpl.id]
                              : selected.filter((s) => s !== tpl.id)
                          )
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium text-fg">{tpl.name}</p>
                        {tpl.description && (
                          <p className="text-xs text-slate-500">{tpl.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
            {available.length > 0 && (
              <label className="flex items-center gap-2 pt-2 border-t border-slate-200 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="accent-brand-500"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                />
                <Mail className="w-4 h-4 text-slate-400" />
                Avisarle por mail apenas se asigne
              </label>
            )}
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button className="btn-secondary" onClick={() => { setShowAssign(false); setSelected([]) }}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={!selected.length || assigning}
                onClick={handleAssign}
              >
                {assigning && <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
                Asignar {selected.length > 0 ? `(${selected.length})` : ''}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}