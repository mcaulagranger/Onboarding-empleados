import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-toastify'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import FirmaCaptura from '../../components/FirmaCaptura'
import {
  FileText, Download, Upload, CheckCircle2, Eye,
  Clock, AlertCircle, PenLine,
} from 'lucide-react'

// pdfjs-dist y pdf-lib son pesadas: se cargan solo cuando alguien
// abre "Completar ahora", no en el resto de la app (admin, RRHH,
// e incluso el resto de esta misma pantalla).
const PdfFormFiller = lazy(() => import('../../components/PdfFormFiller'))

// Saca tildes, ñ y cualquier símbolo que no sea seguro en una ruta de
// Storage. Sin esto, un nombre como "Declaración Jurada..." rompe la
// subida con un 400 — Supabase Storage no acepta esos caracteres en
// la ruta del objeto.
function sanearNombreArchivo(nombre) {
  return nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function MyDocuments() {
  const { user, profile } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [necesitaFirma, setNecesitaFirma] = useState(false) // pedir firma si falta
  const [activeDoc, setActiveDoc] = useState(null) // modal de subida manual (opción alternativa)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  // Completar directamente en la app (sin descargar)
  const [fillerDoc, setFillerDoc] = useState(null)   // employee_document en edición
  const [fillerUrl, setFillerUrl] = useState(null)   // URL firmada de la plantilla

  async function loadDocs() {
    const { data } = await supabase
      .from('employee_documents')
      .select('*, document_templates(id, name, description, file_path, file_name)')
      .eq('employee_id', user.id)
      .order('status', { ascending: true })
    setDocs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadDocs() }, [user.id])

  async function handleDownloadTemplate(filePath, fileName) {
    try {
      const { data, error } = await supabase.storage
        .from('document-templates')
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

  // ── Completar en la app: abrir el editor con una URL firmada ──
  async function abrirCompletarAhora(doc) {
    try {
      const { data, error } = await supabase.storage
        .from('document-templates')
        .createSignedUrl(doc.document_templates?.file_path, 300)
      if (error) throw error
      setFillerUrl(data.signedUrl)
      setFillerDoc(doc)
    } catch {
      toast.error('No se pudo abrir el documento para completar')
    }
  }

  // ── Al guardar desde el editor: subir el PDF ya completado ──
  async function handleGuardarDesdeFiller(bytesFinal) {
    try {
      const blob = new Blob([bytesFinal], { type: 'application/pdf' })
      const nombreLimpio = sanearNombreArchivo(fillerDoc.document_templates?.name ?? 'documento')
      const filePath = `${user.id}/${fillerDoc.id}_${Date.now()}_${nombreLimpio}.pdf`

      if (fillerDoc.completed_file_path) {
        await supabase.storage.from('completed-documents').remove([fillerDoc.completed_file_path])
      }

      const { error: storageError } = await supabase.storage
        .from('completed-documents')
        .upload(filePath, blob, { contentType: 'application/pdf', upsert: false })
      if (storageError) throw storageError

      const { error: dbError } = await supabase
        .from('employee_documents')
        .update({
          status: 'completed',
          completed_file_path: filePath,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', fillerDoc.id)
      if (dbError) throw dbError

      toast.success(`"${fillerDoc.document_templates?.name}" completado y enviado`)
      setFillerDoc(null)
      setFillerUrl(null)
      loadDocs()
    } catch (err) {
      toast.error(err.message ?? 'No se pudo guardar el documento completado')
    }
  }

  // ── Alternativa: descargar, completar afuera y subir manualmente ──
  async function handleUploadCompleted(e) {
    e.preventDefault()
    if (!file || !activeDoc) return
    setUploading(true)
    try {
      const cleanName = sanearNombreArchivo(file.name.replace(/\.pdf$/i, '')) + '.pdf'
      const filePath = `${user.id}/${activeDoc.id}_${Date.now()}_${cleanName}`

      if (activeDoc.completed_file_path) {
        await supabase.storage
          .from('completed-documents')
          .remove([activeDoc.completed_file_path])
      }

      const { error: storageError } = await supabase.storage
        .from('completed-documents')
        .upload(filePath, file, { contentType: 'application/pdf', upsert: false })
      if (storageError) throw storageError

      const { error: dbError } = await supabase
        .from('employee_documents')
        .update({
          status: 'completed',
          completed_file_path: filePath,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeDoc.id)
      if (dbError) throw dbError

      toast.success(`"${activeDoc.document_templates?.name}" marcado como completado`)
      setActiveDoc(null)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      loadDocs()
    } catch (err) {
      toast.error(err.message ?? 'Error al subir el documento')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const pending = docs.filter((d) => d.status === 'pending')
  const completed = docs.filter((d) => d.status === 'completed')

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-fg">Mis documentos</h1>
        <p className="text-slate-500 text-sm mt-1">
          Completalos directamente acá, tocando cada campo — no hace falta descargar nada.
        </p>
      </div>

      {/* Instrucciones */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
        <p>
          Tocá <strong>"Completar ahora"</strong> para abrir el documento y llenarlo ahí mismo.
          Donde diga firmar, tocá <strong>"Colocar firma"</strong> y se pega la firma que
          registraste al ingresar. Si preferís descargarlo y completarlo aparte, esa opción
          sigue disponible más abajo de cada documento.
        </p>
      </div>

      {docs.length === 0 ? (
        <div className="card py-16 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            RRHH aún no te asignó documentos. Revisá más tarde.
          </p>
        </div>
      ) : (
        <>
          {/* Pendientes */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                <Clock className="w-4 h-4 text-amber-600" />
                Pendientes ({pending.length})
              </h2>
              {pending.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onDownload={handleDownloadTemplate}
                  onPreview={handlePreview}
                  onCompletarAhora={() => abrirCompletarAhora(doc)}
                  onUpload={() => { setActiveDoc(doc); setFile(null) }}
                />
              ))}
            </div>
          )}

          {/* Completados */}
          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Completados ({completed.length})
              </h2>
              {completed.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onDownload={handleDownloadTemplate}
                  onPreview={handlePreview}
                  onCompletarAhora={() => abrirCompletarAhora(doc)}
                  onUpload={() => { setActiveDoc(doc); setFile(null) }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Editor en la app: completar + firmar sin descargar */}
      {fillerDoc && fillerUrl && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <PdfFormFiller
            fileUrl={fillerUrl}
            titulo={fillerDoc.document_templates?.name}
            savedSignature={profile?.signature_data}
            onNeedSignature={() => setNecesitaFirma(true)}
            onSubmit={handleGuardarDesdeFiller}
            onCancel={() => { setFillerDoc(null); setFillerUrl(null) }}
          />
        </Suspense>
      )}

      {/* Si el empleado toca "Colocar firma" y todavía no tiene una guardada */}
      {necesitaFirma && (
        <FirmaCaptura
          onClose={() => setNecesitaFirma(false)}
          onSaved={() => setNecesitaFirma(false)}
        />
      )}

      {/* Alternativa: subir un archivo completado aparte */}
      {activeDoc && (
        <Modal
          title={`Subir: ${activeDoc.document_templates?.name}`}
          onClose={() => { setActiveDoc(null); setFile(null) }}
        >
          <form onSubmit={handleUploadCompleted} className="p-6 space-y-5">
            {activeDoc.status === 'completed' && (
              <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Ya subiste este documento antes. Podés reemplazarlo subiendo uno nuevo.
              </div>
            )}

            <div>
              <label className="label">Documento completado (PDF) *</label>
              <div
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 transition-colors"
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
                    <p className="text-sm text-slate-600">
                      Hacé clic para seleccionar el PDF completado
                    </p>
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
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setActiveDoc(null); setFile(null) }}
              >
                Cancelar
              </button>
              <button type="submit" disabled={!file || uploading} className="btn-primary">
                {uploading && (
                  <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                )}
                {uploading ? 'Subiendo...' : 'Confirmar entrega'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function DocCard({ doc, onDownload, onPreview, onCompletarAhora, onUpload }) {
  const isDone = doc.status === 'completed'
  const [mostrarAlterativa, setMostrarAlterativa] = useState(false)

  return (
    <div
      className={`card p-4 border-l-4 transition-all duration-200 hover:shadow-md ${
        isDone ? 'border-l-emerald-600' : 'border-l-brand-400'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
            isDone ? 'text-emerald-600' : 'text-amber-600'
          }`} />
          <div className="min-w-0">
            <p className="font-medium text-fg">{doc.document_templates?.name}</p>
            {doc.document_templates?.description && (
              <p className="text-xs text-slate-500 mt-0.5">{doc.document_templates.description}</p>
            )}
            {doc.completed_at && (
              <p className="text-xs text-slate-400 mt-1">
                Entregado el {new Date(doc.completed_at).toLocaleDateString('es-AR')}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={() => onPreview(doc.document_templates?.file_path)}
          className="btn-secondary text-xs py-1.5 justify-center"
        >
          <Eye className="w-3.5 h-3.5" />
          Ver
        </button>
        <button
          onClick={onCompletarAhora}
          className="flex-1 text-xs py-1.5 justify-center flex items-center gap-1.5 rounded-lg font-semibold
                     bg-brand-500 text-fg hover:bg-brand-600 transition-colors"
        >
          <PenLine className="w-3.5 h-3.5" />
          {isDone ? 'Editar y volver a enviar' : 'Completar ahora'}
        </button>
      </div>

      {/* Alternativa manual, discreta */}
      <div className="mt-2 text-center">
        <button
          onClick={() => setMostrarAlterativa((v) => !v)}
          className="text-[11px] text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
        >
          Prefiero descargarlo y completarlo aparte
        </button>
      </div>
      {mostrarAlterativa && (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => onDownload(doc.document_templates?.file_path, doc.document_templates?.file_name)}
            className="btn-secondary text-xs py-1.5 flex-1 justify-center"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar
          </button>
          <button
            onClick={onUpload}
            className="text-xs py-1.5 flex-1 justify-center flex items-center gap-1.5 rounded-lg font-medium
                       bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            {isDone ? 'Reemplazar' : 'Subir completado'}
          </button>
        </div>
      )}
    </div>
  )
}