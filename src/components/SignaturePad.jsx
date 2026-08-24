import { useEffect, useRef, useState } from 'react'
import { Eraser, Check } from 'lucide-react'
import Modal from './Modal'

/**
 * Modal de firma manuscrita. Dibujá con el mouse o el dedo sobre el
 * lienzo; al confirmar, devuelve un PNG con fondo transparente
 * (`onConfirm(dataUrl)`) listo para estamparlo sobre el PDF.
 *
 * FIX: se migró de onTouchStart/Move/End + onMouseDown/Move/Up a Pointer
 * Events (onPointerDown/Move/Up), que unifican mouse, touch y stylus en
 * un solo flujo y funcionan correctamente en mobile sin el bug de closure
 * stale que causaba "undefined is not a function" al intentar leer
 * ultimoPunto.current cuando dibujando era false por el estado React.
 */
export default function SignaturePad({ onConfirm, onClose }) {
  const canvasRef = useRef(null)
  // Usar ref en lugar de estado para evitar closures stale en los handlers
  const dibujandoRef = useRef(false)
  const [tieneTrazo, setTieneTrazo] = useState(false)
  const ultimoPunto = useRef(null)

  useEffect(() => {
    let cancelado = false
    let rafId

    function preparar() {
      if (cancelado) return
      const canvas = canvasRef.current
      if (!canvas) {
        rafId = requestAnimationFrame(preparar)
        return
      }

      const { width, height } = canvas.getBoundingClientRect()
      if (width === 0 || height === 0) {
        rafId = requestAnimationFrame(preparar)
        return
      }

      const ctx = canvas.getContext('2d')
      const ratio = window.devicePixelRatio || 1
      canvas.width = width * ratio
      canvas.height = height * ratio
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#1a1a1a'
    }

    preparar()
    return () => {
      cancelado = true
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  function posicionDesdeEvento(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function empezar(e) {
    e.preventDefault()
    // setPointerCapture garantiza que los eventos siguientes lleguen a este
    // elemento aunque el dedo se salga del canvas (clave en mobile)
    canvasRef.current?.setPointerCapture(e.pointerId)
    dibujandoRef.current = true
    ultimoPunto.current = posicionDesdeEvento(e)
  }

  function mover(e) {
    // Leer la ref en vez del estado: no hay closure stale
    if (!dibujandoRef.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas || !ultimoPunto.current) return
    const ctx = canvas.getContext('2d')
    const actual = posicionDesdeEvento(e)
    ctx.beginPath()
    ctx.moveTo(ultimoPunto.current.x, ultimoPunto.current.y)
    ctx.lineTo(actual.x, actual.y)
    ctx.stroke()
    ultimoPunto.current = actual
    setTieneTrazo(true)
  }

  function terminar() {
    dibujandoRef.current = false
  }

  function limpiar() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio)
    setTieneTrazo(false)
  }

  function recortarAlTrazo(canvas) {
    try {
      const ctx = canvas.getContext('2d')
      const { width, height } = canvas
      const data = ctx.getImageData(0, 0, width, height).data
      let minX = width, minY = height, maxX = 0, maxY = 0, hayTinta = false
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] > 10) {
            hayTinta = true
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      if (!hayTinta) return canvas.toDataURL('image/png')
      const pad = Math.round(Math.max(width, height) * 0.02)
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
      maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad)
      const w = maxX - minX + 1, h = maxY - minY + 1
      const out = document.createElement('canvas')
      out.width = w; out.height = h
      out.getContext('2d').drawImage(canvas, minX, minY, w, h, 0, 0, w, h)
      return out.toDataURL('image/png')
    } catch {
      return canvas.toDataURL('image/png')
    }
  }

  function confirmar() {
    if (!tieneTrazo) return
    const dataUrl = recortarAlTrazo(canvasRef.current)
    onConfirm(dataUrl)
  }

  return (
    <Modal title="Firmá acá" onClose={onClose} size="lg">
      <div className="p-6 space-y-4">
        <p className="text-sm text-slate-500">
          Dibujá tu firma con el mouse, el dedo o el lápiz óptico. Se va a
          pegar en el documento tal cual la trazaste.
        </p>

        <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-56 cursor-crosshair"
            style={{ touchAction: 'none' }}
            onPointerDown={empezar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerLeave={terminar}
            onPointerCancel={terminar}
          />
          {!tieneTrazo && (
            <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none">
              Firmá acá
            </p>
          )}
          <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200" />
        </div>

        <div className="flex justify-between items-center gap-3">
          <button type="button" onClick={limpiar} className="btn-secondary text-sm py-1.5">
            <Eraser className="w-4 h-4" />
            Borrar
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={!tieneTrazo}
              className="btn-primary"
            >
              <Check className="w-4 h-4" />
              Usar esta firma
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}