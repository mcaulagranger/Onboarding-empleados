import { useEffect, useRef, useState, useMemo } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument } from 'pdf-lib'
import { Send, PenLine, X } from 'lucide-react'
import SignaturePad from './SignaturePad'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Tamaño mínimo de zona táctil (px), aunque el campo real en el PDF
// sea más chico — así es más fácil tocarlo con el dedo sin apuntar
// con precisión de mouse.
//
// Los checkboxes SI/NO están muy cerca uno del otro (~26pt en el PDF
// original) — una zona táctil demasiado grande hace que las de "SI" y
// "NO" se solapen, y termina siendo imposible tocar una sin activar
// la otra. Por eso usan un tope más chico que el resto.
const TAP_MIN = 30
const TAP_MIN_CHECKBOX = 15
// Los 36 puntos del croquis de domicilio son lo más apretado del
// documento: dentro de una misma manzana están a solo ~18pt entre
// sí. Necesitan la zona táctil más chica de toda la app para no
// solaparse entre ellos.
const TAP_MIN_PUNTO = 11

function zonaTactil(top, left, width, height, minimo = TAP_MIN) {
  const w = Math.max(width, minimo)
  const h = Math.max(height, minimo)
  return {
    top: top - (h - height) / 2,
    left: left - (w - width) / 2,
    width: w,
    height: h,
  }
}


/**
 * Completa un PDF con campos reales directamente en la pantalla, sin
 * que el usuario tenga que descargarlo. Lee la estructura del
 * formulario con pdf-lib, renderiza cada página con pdfjs-dist, y
 * superpone controles de HTML en la posición exacta de cada campo.
 *
 * Los campos cuyo nombre contiene "firma" no son de texto: al
 * tocarlos se abre el lienzo de SignaturePad, y el trazo se estampa
 * como imagen sobre el PDF al guardar.
 *
 * Props:
 *   fileUrl   — URL firmada del PDF a completar
 *   onSubmit  — (Uint8Array) => Promise<void>, recibe el PDF ya completado y aplanado
 *   onCancel  — () => void
 *   titulo    — nombre del documento, solo para el encabezado
 */
export default function PdfFormFiller({ fileUrl, onSubmit, onCancel, titulo }) {
  const [pdfBytes, setPdfBytes] = useState(null)
  const [paginasInfo, setPaginasInfo] = useState([]) // [{ page, viewport, index }]
  const [campos, setCampos] = useState([])
  const [valores, setValores] = useState({})
  const [firmas, setFirmas] = useState({})
  const [firmando, setFirmando] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const canvasRefs = useRef({})
  const containerRef = useRef(null)

  // ── 1. Descargar el PDF, leer sus campos y preparar el render ──
  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const res = await fetch(fileUrl)
        if (!res.ok) throw new Error('No se pudo descargar el documento')
        const bytes = await res.arrayBuffer()
        if (cancelado) return
        setPdfBytes(bytes)

        // ── Estructura del formulario (pdf-lib) ──
        const pdfDoc = await PDFDocument.load(bytes)
        const pdfPages = pdfDoc.getPages()
        const pageRefToIndex = new Map()
        pdfPages.forEach((p, i) => pageRefToIndex.set(p.ref.toString(), i))

        const extraidos = []
        let form
        try { form = pdfDoc.getForm() } catch { form = null }

        if (form) {
          for (const field of form.getFields()) {
            const claseField = field.constructor.name
            const widgets = field.acroField.getWidgets()

            if (claseField === 'PDFRadioGroup') {
              const opciones = field.getOptions()
              widgets.forEach((w, i) => {
                const rect = w.getRectangle()
                const pageIndex = pageRefToIndex.get(w.P()?.toString())
                if (pageIndex === undefined) return
                extraidos.push({
                  name: field.getName(), tipo: 'radio', opcion: opciones[i],
                  page: pageIndex, rect,
                })
              })
            } else {
              const w = widgets[0]
              if (!w) continue
              const rect = w.getRectangle()
              const pageIndex = pageRefToIndex.get(w.P()?.toString())
              if (pageIndex === undefined) continue
              const esFirma = /firma/i.test(field.getName())
              extraidos.push({
                name: field.getName(),
                tipo: esFirma ? 'firma' : (claseField === 'PDFCheckBox' ? 'checkbox' : 'texto'),
                page: pageIndex,
                rect,
              })
            }
          }
        }
        if (cancelado) return
        setCampos(extraidos)

        // ── Render de páginas (pdfjs-dist) ──
        const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
        const anchoDisponible = Math.min(720, (containerRef.current?.clientWidth || 700) - 32)

        const infoPaginas = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const natural = page.getViewport({ scale: 1 })
          const scale = anchoDisponible / natural.width
          const viewport = page.getViewport({ scale })
          infoPaginas.push({ page, viewport, index: i - 1 })
        }
        if (!cancelado) {
          setPaginasInfo(infoPaginas)
          setCargando(false)
        }
      } catch (err) {
        if (!cancelado) {
          setError(err.message ?? 'Error al cargar el documento')
          setCargando(false)
        }
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [fileUrl])

  // ── 2. Dibujar cada página en su <canvas> ──
  useEffect(() => {
    paginasInfo.forEach(({ page, viewport, index }) => {
      const canvas = canvasRefs.current[index]
      if (!canvas || canvas.dataset.pintado) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      page.render({ canvasContext: ctx, viewport })
      canvas.dataset.pintado = '1'
    })
  }, [paginasInfo])

  function setValor(nombre, valor) {
    setValores((v) => ({ ...v, [nombre]: valor }))
  }

  function confirmarFirma(dataUrl) {
    setFirmas((f) => ({ ...f, [firmando]: dataUrl }))
    setFirmando(null)
  }

  const totalCampos = campos.filter((c) => c.tipo !== 'radio').length +
    new Set(campos.filter((c) => c.tipo === 'radio').map((c) => c.name)).size
  const completados =
    Object.values(valores).filter((v) => v).length + Object.keys(firmas).length

  // ── 3. Guardar: rellenar el PDF real ──
  async function handleGuardar() {
    setGuardando(true)
    try {
      console.log('[PdfFormFiller] Iniciando guardado. Firmas capturadas:', Object.keys(firmas))

      const pdfDoc = await PDFDocument.load(pdfBytes.slice(0))
      const form = pdfDoc.getForm()
      const pages = pdfDoc.getPages()

      for (const campo of campos) {
        if (campo.tipo === 'texto') {
          const valor = valores[campo.name]
          if (valor) form.getTextField(campo.name).setText(valor)
        } else if (campo.tipo === 'checkbox') {
          if (valores[campo.name]) form.getCheckBox(campo.name).check()
        } else if (campo.tipo === 'radio') {
          if (valores[campo.name] === campo.opcion) {
            form.getRadioGroup(campo.name).select(campo.opcion)
          }
        }
      }

      // Firmas: se estampan como imagen sobre el campo correspondiente.
      // (Por qué no se usa flatten(): ver el comentario más abajo.)
      for (const [nombre, dataUrl] of Object.entries(firmas)) {
        const campo = campos.find((c) => c.name === nombre)
        if (!campo) {
          console.warn('[PdfFormFiller] No se encontró el campo para la firma:', nombre)
          continue
        }

        console.log('[PdfFormFiller] Firma', nombre, '— dataURL longitud:', dataUrl?.length)

        const res = await fetch(dataUrl)
        const pngBytes = await res.arrayBuffer()
        console.log('[PdfFormFiller] Firma', nombre, '— bytes PNG:', pngBytes.byteLength)

        if (!pngBytes || pngBytes.byteLength < 100) {
          console.error('[PdfFormFiller] La imagen de firma está vacía o corrupta:', nombre)
          continue
        }

        const img = await pdfDoc.embedPng(pngBytes)
        console.log('[PdfFormFiller] Firma', nombre, '— tamaño embebido:', img.width, 'x', img.height)

        const page = pages[campo.page]
        const { rect } = campo
        // Sin tope de "no agrandar más que el tamaño real" (antes tenía
        // un ",1" que lo impedía): así la firma aprovecha todo el campo,
        // que ahora es más grande, en vez de quedar chica y perdida ahí.
        const maxW = rect.width - 6, maxH = rect.height - 6
        const scale = Math.min(maxW / img.width, maxH / img.height)
        const w = img.width * scale, h = img.height * scale
        const x = rect.x + (rect.width - w) / 2
        const y = rect.y + (rect.height - h) / 2

        console.log('[PdfFormFiller] Firma', nombre, `— dibujando en página ${campo.page}, x=${x.toFixed(1)} y=${y.toFixed(1)} w=${w.toFixed(1)} h=${h.toFixed(1)}`)

        page.drawImage(img, { x, y, width: w, height: h })

        // Sacar el campo del formulario: en documentos con muchos campos
        // (como Planilla de Alta), flatten() corrompe el archivo — lo
        // confirmamos con dos motores de PDF distintos. Por eso NO se usa
        // flatten() en ningún documento: se sacan los campos de firma
        // (para que no quede un recuadro vacío tapando la imagen) y el
        // resto de los campos se dejan con su valor puesto, sin aplanar
        // — se ven igual de bien, y el archivo queda sano.
        try {
          const fieldFirma = form.getFieldMaybe(campo.name)
          if (fieldFirma) form.removeField(fieldFirma)
        } catch (e) {
          console.warn('[PdfFormFiller] No se pudo quitar el campo de firma del formulario:', nombre, e.message)
        }
      }

      // Bloquear el resto de los campos (ya no editables) sin aplanar.
      for (const f of form.getFields()) {
        try { f.enableReadOnly() } catch { /* algunos campos no lo soportan, no pasa nada */ }
      }

      const bytesFinal = await pdfDoc.save()
      console.log('[PdfFormFiller] PDF final generado, bytes:', bytesFinal.byteLength)
      await onSubmit(bytesFinal)
    } catch (err) {
      console.error('[PdfFormFiller] Error al guardar:', err)
      setError(err.message ?? 'No se pudo generar el documento completado')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 flex flex-col">
      {/* Encabezado */}
      <div className="bg-natural border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{titulo ?? 'Completar documento'}</p>
          {!cargando && !error && (
            <p className="text-xs text-slate-500">
              {completados} de {totalCampos || '—'} campos completados
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onCancel} className="btn-secondary text-sm py-1.5">
            <X className="w-4 h-4" />
            Cerrar
          </button>
          <button
            onClick={handleGuardar}
            disabled={cargando || guardando || !!error}
            className="btn-primary text-sm py-1.5"
          >
            {guardando ? (
              <span className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {guardando ? 'Guardando...' : 'Guardar y enviar'}
          </button>
        </div>
      </div>

      {/* Cuerpo: páginas con scroll */}
      <div ref={containerRef} className="flex-1 overflow-y-auto bg-slate-100 px-2 sm:px-4 py-6">
        {cargando && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto card p-6 text-center">
            <p className="text-red-600 text-sm font-medium">{error}</p>
            <button onClick={onCancel} className="btn-secondary mt-4 mx-auto">Cerrar</button>
          </div>
        )}

        <div className="flex flex-col items-center gap-5">
          {paginasInfo.map(({ viewport, index }) => (
            <div
              key={index}
              className="relative bg-white shadow-md"
              style={{ width: viewport.width, height: viewport.height }}
            >
              <canvas
                ref={(el) => { canvasRefs.current[index] = el }}
                className="absolute inset-0"
              />

              {campos
                .filter((c) => c.page === index)
                .map((campo, i) => {
                  const s = viewport.scale
                  const cssTop = viewport.height - (campo.rect.y + campo.rect.height) * s
                  const cssLeft = campo.rect.x * s
                  const cssWidth = campo.rect.width * s
                  const cssHeight = campo.rect.height * s
                  const key = `${campo.name}-${campo.opcion ?? i}`

                  if (campo.tipo === 'firma') {
                    const firmada = firmas[campo.name]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFirmando(campo.name)}
                        style={{ top: cssTop, left: cssLeft, width: cssWidth, height: cssHeight }}
                        className={`absolute flex items-center justify-center rounded transition-colors ${
                          firmada
                            ? 'bg-white'
                            : 'bg-brand-50 hover:bg-brand-100 border-2 border-dashed border-brand-400'
                        }`}
                      >
                        {firmada ? (
                          <img src={firmada} alt="Firma" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="flex items-center gap-1.5 text-brand-700 text-xs font-semibold">
                            <PenLine className="w-3.5 h-3.5" />
                            Firmar
                          </span>
                        )}
                      </button>
                    )
                  }

                  if (campo.tipo === 'checkbox') {
                    // Zona táctil chica a propósito (ver TAP_MIN_CHECKBOX):
                    // los pares SI/NO están muy cerca entre sí, y una zona
                    // más grande haría que se solaparan.
                    //
                    // Usa un <input type="checkbox"> NATIVO de verdad (oculto
                    // visualmente, pero funcional) en vez de un <button>
                    // armado a mano — así el toque queda garantizado por el
                    // navegador en cualquier celular, no depende de mi propio
                    // manejo de clics.
                    const tap = zonaTactil(cssTop, cssLeft, cssWidth, cssHeight, TAP_MIN_CHECKBOX)
                    const marcado = !!valores[campo.name]
                    return (
                      <label
                        key={key}
                        style={tap}
                        className="absolute flex items-center justify-center cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={(e) => setValor(campo.name, e.target.checked)}
                          className="sr-only"
                        />
                        <span
                          className={`flex items-center justify-center border-2 rounded-sm transition-colors pointer-events-none ${
                            marcado ? 'border-brand-600 bg-brand-50' : 'border-slate-400'
                          }`}
                          style={{ width: cssWidth, height: cssHeight }}
                        >
                          {marcado && <X className="w-[85%] h-[85%] text-brand-700" strokeWidth={3} />}
                        </span>
                      </label>
                    )
                  }

                  if (campo.tipo === 'radio') {
                    // Zona táctil chica a propósito (ver TAP_MIN_PUNTO): los
                    // 4 puntos de una misma manzana están muy cerca entre sí.
                    //
                    // Mismo cambio que en el checkbox: <input type="radio">
                    // nativo (oculto) en vez de un <button> armado a mano,
                    // para que el toque en el celular quede garantizado por
                    // el navegador.
                    const tap = zonaTactil(cssTop, cssLeft, cssWidth, cssHeight, TAP_MIN_PUNTO)
                    const visual = Math.max(cssWidth, TAP_MIN_PUNTO - 4)
                    const seleccionado = valores[campo.name] === campo.opcion
                    return (
                      <label
                        key={key}
                        style={tap}
                        className="absolute flex items-center justify-center cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={campo.name}
                          checked={seleccionado}
                          onChange={() => setValor(campo.name, campo.opcion)}
                          className="sr-only"
                        />
                        <span
                          className={`rounded-full border-2 flex items-center justify-center transition-colors pointer-events-none ${
                            seleccionado ? 'border-brand-600' : 'border-slate-400'
                          }`}
                          style={{ width: visual, height: visual }}
                        >
                          {seleccionado && <span className="w-1/2 h-1/2 rounded-full bg-brand-500" />}
                        </span>
                      </label>
                    )
                  }

                  // texto
                  return (
                    <input
                      key={key}
                      type="text"
                      value={valores[campo.name] ?? ''}
                      onChange={(e) => setValor(campo.name, e.target.value)}
                      style={{
                        top: cssTop, left: cssLeft, width: cssWidth, height: cssHeight,
                        fontSize: Math.max(10, cssHeight * 0.55),
                      }}
                      className="absolute bg-brand-50/40 hover:bg-brand-50/70 focus:bg-white
                                 border border-brand-300 focus:border-brand-500 rounded-sm
                                 px-1 outline-none text-ink"
                    />
                  )
                })}
            </div>
          ))}
        </div>
      </div>

      {firmando && (
        <SignaturePad onConfirm={confirmarFirma} onClose={() => setFirmando(null)} />
      )}
    </div>
  )
}