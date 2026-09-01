import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-toastify'
import EmptyState from '../../components/EmptyState'
import { SkeletonRow } from '../../components/Skeleton'
import { UploadCloud, FileText, Download, Trash2, X } from 'lucide-react'

const BUCKET = 'employee-uploads'
const MAX_MB = 10

const PRESETS = [
  'Certificado de Buena Conducta',
  'Certificado de Antecedentes Penales',
  'Título / Analítico',
  'Otro',
]

function formatearTamaño(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Documentos que el propio empleado sube a la app: certificados externos
 * (buena conducta, antecedentes, título, etc.) que ya tiene y solo debe
 * adjuntar — a diferencia de "Mis documentos", que son plantillas para
 * completar. Solo acepta PDF.
 */
export default function MyUploads() {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [nombre, setNombre] = useState(PRESETS[0])
  const [nombreLibre, setNombreLibre] = useState('')
  const [archivo, setArchivo] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { cargar() }, [user.id])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('employee_uploads')
      .select('*')
      .eq('employee_id', user.id)
      .order('uploaded_at', { ascending: false })
    if (!error) setDocs(data ?? [])
    setLoading(false)
  }

  function elegirArchivo(e) {
    const f = e.target.files?.[0]
    if (!f) return

    // Solo PDF, sí o sí: por tipo MIME y por extensión (el MIME a veces
    // llega vacío según el navegador/OS, así que chequeamos las dos).
    const esPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    if (!esPdf) {
      toast.error('Solo se aceptan archivos PDF')
      e.target.value = ''
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_MB} MB`)
      e.target.value = ''
      return
    }
    setArchivo(f)
  }

  async function handleSubir(e) {
    e.preventDefault()
    const nombreFinal = nombre === 'Otro' ? nombreLibre.trim() : nombre
    if (!nombreFinal) {
      toast.error('Indicá qué documento es')
      return
    }
    if (!archivo) {
      toast.error('Elegí el archivo PDF')
      return
    }

    setSubiendo(true)
    try {
      // Carpeta por usuario (employee-uploads/<uid>/...) — así las
      // políticas de Storage pueden restringir cada uno a la suya.
      const rutaSegura = `${user.id}/${Date.now()}_${archivo.name.replace(/[^\w.\-]/g, '_')}`

      const { error: eSubida } = await supabase.storage
        .from(BUCKET)
        .upload(rutaSegura, archivo, { contentType: 'application/pdf' })
      if (eSubida) throw eSubida

      const { error: eInsert } = await supabase
        .from('employee_uploads')
        .insert({
          employee_id: user.id,
          nombre: nombreFinal,
          file_path: rutaSegura,
          file_size: archivo.size,
        })
      if (eInsert) throw eInsert

      toast.success('Documento subido')
      setArchivo(null)
      setNombreLibre('')
      if (inputRef.current) inputRef.current.value = ''
      cargar()
    } catch (err) {
      console.error(err)
      toast.error(err.message ?? 'No se pudo subir el documento')
    } finally {
      setSubiendo(false)
    }
  }

  async function handleDescargar(doc) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(doc.file_path)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.nombre}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar el archivo')
    }
  }

  async function handleBorrar(doc) {
    if (!confirm(`¿Borrar "${doc.nombre}"?`)) return
    try {
      await supabase.storage.from(BUCKET).remove([doc.file_path])
      const { error } = await supabase.from('employee_uploads').delete().eq('id', doc.id)
      if (error) throw error
      toast.success('Documento borrado')
      cargar()
    } catch {
      toast.error('No se pudo borrar el documento')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-ink">Cargar documentos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Subí certificados u otros documentos que ya tengas (por ejemplo, el Certificado de
          Buena Conducta). Solo se aceptan archivos PDF.
        </p>
      </div>

      {/* Formulario de carga */}
      <form onSubmit={handleSubir} className="card p-5 space-y-4">
        <div>
          <label className="label">¿Qué documento es?</label>
          <select className="input" value={nombre} onChange={(e) => setNombre(e.target.value)}>
            {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {nombre === 'Otro' && (
          <div>
            <label className="label">Nombre del documento</label>
            <input
              className="input"
              placeholder="Ej: Certificado de estudios"
              value={nombreLibre}
              onChange={(e) => setNombreLibre(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="label">Archivo (PDF)</label>
          <div className="flex items-center gap-3">
            <label className="btn-secondary cursor-pointer text-sm">
              <UploadCloud className="w-4 h-4" />
              Elegir archivo
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={elegirArchivo}
                className="hidden"
              />
            </label>
            {archivo && (
              <span className="text-sm text-slate-600 flex items-center gap-1.5 min-w-0">
                <FileText className="w-4 h-4 text-brand-600 flex-shrink-0" />
                <span className="truncate">{archivo.name}</span>
                <button
                  type="button"
                  onClick={() => { setArchivo(null); if (inputRef.current) inputRef.current.value = '' }}
                  className="text-slate-400 hover:text-red-600 flex-shrink-0"
                  aria-label="Quitar archivo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Máximo {MAX_MB} MB.</p>
        </div>

        <button type="submit" disabled={subiendo} className="btn-primary">
          {subiendo ? (
            <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          {subiendo ? 'Subiendo…' : 'Subir documento'}
        </button>
      </form>

      {/* Lista de subidos */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-ink text-sm">Documentos subidos</h2>
        </div>
        {loading ? (
          <div><SkeletonRow /><SkeletonRow /></div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Todavía no subiste nada"
            description="Cuando subas un documento, va a aparecer acá."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{doc.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(doc.uploaded_at).toLocaleDateString('es-AR')}
                    {doc.file_size ? ` · ${formatearTamaño(doc.file_size)}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDescargar(doc)}
                  className="p-1.5 rounded text-slate-400 hover:text-brand-700 hover:bg-brand-100 transition-colors"
                  aria-label="Descargar"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleBorrar(doc)}
                  className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  aria-label="Borrar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
