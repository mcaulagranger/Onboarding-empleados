import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument, PDFCheckBox, PDFRadioGroup } from 'pdf-lib'
import { Send, PenLine, X, Trash2, Check, ZoomIn, ZoomOut } from 'lucide-react'
import CroquisCanvas from './CroquisCanvas'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Tamaño mínimo de zona táctil (px) para las casillas: aunque el campo
// real sea chico, se toca cómodo con el dedo. Se mantiene chico porque
// los pares SI/NO están muy cerca entre sí.
const TAP_MIN_CHECKBOX = 18

// Margen extra alrededor del croquis de domicilio, para poder rayar con
// comodidad sin que el trazo quede pegado al borde de los puntos.
const CROQUIS_PAD_PT = 6

function zonaTactil(top, left, width, height, minimo) {
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
 * - Las casillas (checkbox reales, o campos de texto con forma de
 *   casilla) se muestran como BOTÓN que se marca/desmarca.
 * - Los campos "firma" NO se dibujan a mano acá: se coloca la firma que
 *   el empleado ya guardó (savedSignature) con un toque.
 * - El croquis de domicilio (los puntitos de "ubicá tu casa en la
 *   manzana") se reemplaza por un lienzo para rayar/pintar a mano.
 *
 * Props:
 *   fileUrl        — URL firmada del PDF a completar
 *   onSubmit       — (Uint8Array) => Promise<void>, PDF ya completado
 *   onCancel       — () => void
 *   titulo         — nombre del documento (encabezado)
 *   savedSignature — data URL PNG de la firma guardada del empleado (o null)
 *   onNeedSignature — () => void, se llama si falta la firma guardada
 */
export default function PdfFormFiller({ fileUrl, onSubmit, onCancel, titulo, savedSignature, onNeedSignature }) {
  const [pdfBytes, setPdfBytes] = useState(null)
  const [paginasInfo, setPaginasInfo] = useState([]) // [{ page, viewport, index }]
  const [campos, setCampos] = useState([])           // texto / toggle / firma
  const [regiones, setRegiones] = useState([])       // croquis: [{ name, page, bbox }]
  const [valores, setValores] = useState({})
  const [firmas, setFirmas] = useState({})
  const [croquisTocados, setCroquisTocados] = useState({}) // { name: true }
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [zoom, setZoom] = useState(1)       // multiplicador sobre el "ajustar al ancho"
  const [pdfListo, setPdfListo] = useState(false)

  const canvasRefs = useRef({})
  const croquisRefs = useRef({})
  const containerRef = useRef(null)
  const basePagesRef = useRef([])            // páginas pdfjs + viewport natural

  const registrarCroquis = useCallback((name, el) => {
    if (el) croquisRefs.current[name] = el
    else delete croquisRefs.current[name]
  }, [])

  const marcarCroquis = useCallback((name) => {
    setCroquisTocados((c) => (c[name] ? c : { ...c, [name]: true }))
  }, [])

  function limpiarCroquis(name) {
    const canvas = croquisRefs.current[name]
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setCroquisTocados((c) => {
      const { [name]: _, ...resto } = c
      return resto
    })
  }

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
        const pageSizes = []
        pdfPages.forEach((p, i) => {
          pageRefToIndex.set(p.ref.toString(), i)
          const { width, height } = p.getSize()
          pageSizes[i] = { width, height }
        })

        const extraidos = []
        const radiosPorGrupo = new Map() // name -> { page, rects: [] }
        let form
        try { form = pdfDoc.getForm() } catch { form = null }

        if (form) {
          for (const field of form.getFields()) {
            const nombre = field.getName()
            const widgets = field.acroField.getWidgets()

            // IMPORTANTE: se usa `instanceof` y NO field.constructor.name.
            // El bundler (esbuild/Vite) renombra las clases al empaquetar
            // pdf-lib, así que constructor.name deja de valer "PDFCheckBox"
            // y los checkbox terminaban tratándose como texto. instanceof
            // no se rompe con la minificación.
            const esRadio = field instanceof PDFRadioGroup
            const esCheck = field instanceof PDFCheckBox

            // Los grupos de radio son el croquis de domicilio: se
            // agrupan por nombre y después se reemplazan por un lienzo.
            if (esRadio) {
              widgets.forEach((w) => {
                const rect = w.getRectangle()
                const pageIndex = pageRefToIndex.get(w.P()?.toString())
                if (pageIndex === undefined) return
                const clave = `${nombre}@@${pageIndex}`
                if (!radiosPorGrupo.has(clave)) {
                  radiosPorGrupo.set(clave, { name: nombre, page: pageIndex, rects: [] })
                }
                radiosPorGrupo.get(clave).rects.push(rect)
              })
              continue
            }

            const esFirma = /firma/i.test(nombre)

            // Un mismo campo puede tener VARIAS apariciones (widgets): por
            // ej. el nombre del empleado que se repite en varias cláusulas
            // es un solo campo con 6 widgets. Antes se tomaba solo
            // widgets[0] y las demás apariciones quedaban sin input (no se
            // podía escribir). Ahora se renderiza uno por cada widget; como
            // comparten el nombre del campo, al escribir en uno se llenan
            // todos automáticamente.
            widgets.forEach((wg) => {
              const rect = wg.getRectangle()
              const pageIndex = pageRefToIndex.get(wg.P()?.toString())
              if (pageIndex === undefined) return

              let tipo = 'texto'
              let realCheck = false
              let grupo = null
              if (esFirma) {
                tipo = 'firma'
              } else if (esCheck) {
                tipo = 'toggle'; realCheck = true
                // Excluyentes por fila: las casillas SI/NO comparten la misma
                // altura (y) en la página. Al marcar una, se desmarca la otra.
                grupo = `${pageIndex}:${Math.round(rect.y)}`
              }
              // Los campos de TEXTO siempre se muestran como texto. Las
              // casillas reales ya se detectan con instanceof (esCheck): no
              // hace falta adivinar por tamaño, y adivinar convertía campos
              // chicos legítimos (Nº, Piso, Dpto, CP) en casillas por error.

              extraidos.push({ name: nombre, tipo, realCheck, grupo, page: pageIndex, rect })
            })
          }
        }

        // Bounding box (en puntos PDF) de cada grupo de croquis + padding.
        const regionesCroquis = []
        for (const { name, page, rects } of radiosPorGrupo.values()) {
          if (!rects.length) continue
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (const r of rects) {
            minX = Math.min(minX, r.x); minY = Math.min(minY, r.y)
            maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height)
          }
          const size = pageSizes[page] ?? { width: Infinity, height: Infinity }
          const x = Math.max(0, minX - CROQUIS_PAD_PT)
          const y = Math.max(0, minY - CROQUIS_PAD_PT)
          const x2 = Math.min(size.width, maxX + CROQUIS_PAD_PT)
          const y2 = Math.min(size.height, maxY + CROQUIS_PAD_PT)
          regionesCroquis.push({ name, page, bbox: { x, y, width: x2 - x, height: y2 - y } })
        }

        if (cancelado) return
        setCampos(extraidos)
        setRegiones(regionesCroquis)

        // ── Render de páginas (pdfjs-dist) ──
        // Guardamos las páginas y su viewport natural; el tamaño real en
        // pantalla se calcula aparte (depende del ancho y del zoom), así
        // podemos re-escalar sin volver a descargar el PDF.
        const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
        if (cancelado) return
        const base = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          base.push({ page, natural: page.getViewport({ scale: 1 }), index: i - 1 })
        }
        if (!cancelado) {
          basePagesRef.current = base
          setPdfListo(true)
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

  // ── 1b. Calcular el tamaño en pantalla de cada página (ancho + zoom) ──
  useEffect(() => {
    if (!pdfListo) return
    const anchoVisible = (containerRef.current?.clientWidth || 700) - 16
    const anchoBase = Math.min(760, anchoVisible)
    const info = basePagesRef.current.map(({ page, natural, index }) => {
      const ajuste = anchoBase / natural.width      // "ajustar al ancho"
      const scale = ajuste * zoom
      return { page, viewport: page.getViewport({ scale }), index }
    })
    // Forzar re-pintado de los canvas al cambiar el zoom
    Object.values(canvasRefs.current).forEach((c) => { if (c) delete c.dataset.pintado })
    setPaginasInfo(info)
  }, [pdfListo, zoom])

  // ── 2. Dibujar cada página en su <canvas> (nítido según densidad) ──
  useEffect(() => {
    // Renderizamos el canvas a mayor resolución que su tamaño en pantalla
    // (devicePixelRatio) y lo mostramos escalado: así la letra se ve nítida
    // en celulares de pantalla densa, en vez de borrosa.
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    paginasInfo.forEach(({ page, viewport, index }) => {
      const canvas = canvasRefs.current[index]
      if (!canvas || canvas.dataset.pintado) return
      canvas.width = Math.round(viewport.width * dpr)
      canvas.height = Math.round(viewport.height * dpr)
      // Tamaño de DISPLAY = tamaño de la página (el buffer va a mayor
      // resolución para nitidez, pero se muestra al tamaño real para que
      // los campos queden alineados).
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      const ctx = canvas.getContext('2d')
      const rv = page.getViewport({ scale: viewport.scale * dpr })
      page.render({ canvasContext: ctx, viewport: rv })
      canvas.dataset.pintado = '1'
    })
  }, [paginasInfo])

  function setValor(nombre, valor) {
    setValores((v) => ({ ...v, [nombre]: valor }))
  }

  // Marca/desmarca una casilla. Si pertenece a un grupo (SI/NO de la
  // misma fila), al marcarla se desmarcan las demás del grupo, así solo
  // queda una opción elegida. Se puede volver a tocar para desmarcar.
  function toggleCasilla(campo) {
    setValores((v) => {
      const estaba = !!v[campo.name]
      const nuevo = { ...v }
      if (campo.grupo) {
        for (const c of campos) {
          if (c.tipo === 'toggle' && c.grupo === campo.grupo) nuevo[c.name] = false
        }
      }
      nuevo[campo.name] = !estaba
      return nuevo
    })
  }

  // Coloca (o saca) la firma guardada en un campo de firma.
  function alternarFirma(nombre) {
    if (!savedSignature) {
      onNeedSignature?.()
      return
    }
    setFirmas((f) => {
      if (f[nombre]) {
        const { [nombre]: _, ...resto } = f
        return resto
      }
      return { ...f, [nombre]: savedSignature }
    })
  }

  // Cuenta por NOMBRE de campo (no por widget): un campo repetido en
  // varias apariciones cuenta una sola vez.
  const nombresLlenables = new Set(campos.filter((c) => c.tipo !== 'firma').map((c) => c.name))
  const nombresCompletos = new Set(
    campos.filter((c) => c.tipo !== 'firma' && valores[c.name]).map((c) => c.name)
  )
  const nombresFirma = new Set(campos.filter((c) => c.tipo === 'firma').map((c) => c.name))
  const firmasPuestas = new Set(Object.keys(firmas)).size
  const totalCampos = nombresLlenables.size + nombresFirma.size + regiones.length
  const completados = nombresCompletos.size + firmasPuestas + Object.keys(croquisTocados).length

  // ── 3. Guardar: rellenar el PDF real ──
  async function handleGuardar() {
    setGuardando(true)
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes.slice(0))
      const form = pdfDoc.getForm()
      const pages = pdfDoc.getPages()

      // Campos de texto y casillas (deduplicado por nombre: un campo con
      // varias apariciones se setea una sola vez, y el valor se refleja en
      // todas sus apariciones automáticamente).
      const procesados = new Set()
      for (const campo of campos) {
        if (procesados.has(campo.name)) continue
        if (campo.tipo === 'texto') {
          const valor = valores[campo.name]
          if (valor) {
            try { form.getTextField(campo.name).setText(valor); procesados.add(campo.name) } catch { /* noop */ }
          }
        } else if (campo.tipo === 'toggle') {
          if (valores[campo.name]) {
            try {
              if (campo.realCheck) form.getCheckBox(campo.name).check()
              else form.getTextField(campo.name).setText('X')
              procesados.add(campo.name)
            } catch { /* noop */ }
          }
        }
      }

      // Firmas: se estampan como imagen sobre TODAS las apariciones del
      // campo (un campo de firma podría tener varios widgets).
      for (const [nombre, dataUrl] of Object.entries(firmas)) {
        const apariciones = campos.filter((c) => c.name === nombre)
        if (!apariciones.length) continue

        const resp = await fetch(dataUrl)
        const pngBytes = await resp.arrayBuffer()
        if (!pngBytes || pngBytes.byteLength < 100) continue

        const img = await pdfDoc.embedPng(pngBytes)
        for (const campo of apariciones) {
          const page = pages[campo.page]
          const { rect } = campo
          const maxW = rect.width - 6, maxH = rect.height - 6
          const scale = Math.min(maxW / img.width, maxH / img.height)
          const w = img.width * scale, h = img.height * scale
          const x = rect.x + (rect.width - w) / 2
          const y = rect.y + (rect.height - h) / 2
          page.drawImage(img, { x, y, width: w, height: h })
        }

        try {
          const fieldFirma = form.getFieldMaybe(nombre)
          if (fieldFirma) form.removeField(fieldFirma)
        } catch { /* noop */ }
      }

      // Croquis de domicilio: se estampa el dibujo a mano alzada sobre
      // la región de la manzana, y se sacan los puntos del formulario.
      for (const region of regiones) {
        if (!croquisTocados[region.name]) continue
        const canvas = croquisRefs.current[region.name]
        if (!canvas) continue

        const dataUrl = canvas.toDataURL('image/png')
        const resp = await fetch(dataUrl)
        const pngBytes = await resp.arrayBuffer()
        if (!pngBytes || pngBytes.byteLength < 100) continue

        const img = await pdfDoc.embedPng(pngBytes)
        const page = pages[region.page]
        const { bbox } = region
        page.drawImage(img, { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height })

        try {
          const grupo = form.getFieldMaybe(region.name)
          if (grupo) form.removeField(grupo)
        } catch { /* noop */ }
      }

      // Bloquear el resto de los campos (ya no editables) sin aplanar.
      for (const f of form.getFields()) {
        try { f.enableReadOnly() } catch { /* algunos campos no lo soportan */ }
      }

      const bytesFinal = await pdfDoc.save()
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
      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 px-2 sm:px-4 py-6">
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

        <div className="flex flex-col items-center gap-5 w-max min-w-full mx-auto">
          {paginasInfo.map(({ viewport, index }) => (
            <div
              key={index}
              className="relative bg-white shadow-md"
              style={{ width: viewport.width, height: viewport.height }}
            >
              <canvas
                ref={(el) => { canvasRefs.current[index] = el }}
                className="absolute inset-0 w-full h-full"
              />

              {/* Croquis de domicilio: lienzo para rayar sobre la manzana */}
              {regiones
                .filter((r) => r.page === index)
                .map((region) => {
                  const s = viewport.scale
                  const cssTop = viewport.height - (region.bbox.y + region.bbox.height) * s
                  const cssLeft = region.bbox.x * s
                  const cssWidth = region.bbox.width * s
                  const cssHeight = region.bbox.height * s
                  const tocado = !!croquisTocados[region.name]
                  return (
                    <div
                      key={`croquis-${region.name}`}
                      className="absolute rounded ring-2 ring-brand-300/70 bg-brand-50/20"
                      style={{ top: cssTop, left: cssLeft, width: cssWidth, height: cssHeight }}
                    >
                      <CroquisCanvas
                        name={region.name}
                        width={cssWidth}
                        height={cssHeight}
                        registerCanvas={registrarCroquis}
                        onDraw={marcarCroquis}
                      />
                      {!tocado && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-brand-600/70 pointer-events-none text-center px-1">
                          Marcá acá dónde queda tu casa
                        </span>
                      )}
                      {tocado && (
                        <button
                          type="button"
                          onClick={() => limpiarCroquis(region.name)}
                          className="absolute -top-2 -right-2 bg-white border border-slate-300 rounded-full p-1 shadow-sm hover:bg-slate-50"
                          title="Borrar dibujo"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      )}
                    </div>
                  )
                })}

              {campos
                .filter((c) => c.page === index)
                .map((campo, i) => {
                  const s = viewport.scale
                  const cssTop = viewport.height - (campo.rect.y + campo.rect.height) * s
                  const cssLeft = campo.rect.x * s
                  const cssWidth = campo.rect.width * s
                  const cssHeight = campo.rect.height * s
                  const key = `${campo.name}-${i}`

                  if (campo.tipo === 'firma') {
                    const firmada = firmas[campo.name]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => alternarFirma(campo.name)}
                        style={{ top: cssTop, left: cssLeft, width: cssWidth, height: cssHeight }}
                        className={`absolute flex items-center justify-center rounded transition-colors ${
                          firmada
                            ? 'bg-white'
                            : 'bg-brand-50 hover:bg-brand-100 border-2 border-dashed border-brand-400'
                        }`}
                        title={savedSignature ? 'Colocar / quitar tu firma' : 'Primero registrá tu firma'}
                      >
                        {firmada ? (
                          <img src={firmada} alt="Firma" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="flex items-center gap-1.5 text-brand-700 text-xs font-semibold">
                            <PenLine className="w-3.5 h-3.5" />
                            Colocar firma
                          </span>
                        )}
                      </button>
                    )
                  }

                  if (campo.tipo === 'toggle') {
                    // Botón para marcar/desmarcar. Sirve para checkboxes
                    // reales y para campos de texto con forma de casilla.
                    const tap = zonaTactil(cssTop, cssLeft, cssWidth, cssHeight, TAP_MIN_CHECKBOX)
                    const marcado = !!valores[campo.name]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCasilla(campo)}
                        style={tap}
                        className="absolute flex items-center justify-center cursor-pointer"
                        aria-pressed={marcado}
                      >
                        <span
                          className={`flex items-center justify-center border-2 rounded-sm transition-colors ${
                            marcado ? 'border-brand-600 bg-brand-50' : 'border-slate-400 bg-white/60 hover:border-brand-400'
                          }`}
                          style={{ width: cssWidth, height: cssHeight }}
                        >
                          {marcado && <Check className="w-[85%] h-[85%] text-brand-700" strokeWidth={3} />}
                        </span>
                      </button>
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

      {/* Control de zoom flotante (clave en el celular) */}
      {!cargando && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white rounded-full shadow-lg border border-slate-200 px-1.5 py-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            disabled={zoom <= 0.75}
            aria-label="Alejar"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="text-xs font-semibold text-slate-600 tabular-nums w-11 text-center hover:text-ink"
            aria-label="Restablecer zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            disabled={zoom >= 3}
            aria-label="Acercar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}