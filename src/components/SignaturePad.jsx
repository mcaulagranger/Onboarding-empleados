import { useRef, useState, useEffect } from 'react'
import { Eraser, Check } from 'lucide-react'
import Modal from './Modal'

/**
 * Modal de firma manuscrita. Dibujá con el mouse o el dedo sobre el
 * lienzo; al confirmar, devuelve un PNG con fondo transparente
 * (`onConfirm(dataUrl)`) listo para estamparlo sobre el PDF.
 */
export default function SignaturePad({ onConfirm, onClose }) {
  const canvasRef = useRef(null)
  const [dibujando, setDibujando] = useState(false)
  const [tieneTrazo, setTieneTrazo] = useState(false)
  const ultimoPunto = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current

    function preparar() {
      const ctx = canvas.getContext('2d')
      const ratio = window.devicePixelRatio || 1
      const { width, height } = canvas.getBoundingClientRect()

      // Si el layout todavía no asentó (medida en cero, puede pasar
      // justo al abrir el modal), se reintenta en el próximo frame en
      // vez de dejar el lienzo con un buffer de 0x0 — eso haría que
      // cualquier trazo dibujado no se guarde en ningún lado.
      if (width === 0 || height === 0) {
        requestAnimationFrame(preparar)
        return
      }

      canvas.width = width * ratio
      canvas.height = height * ratio
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#1a1a1a'
    }

    preparar()
  }, [])

  function posicionDesdeEvento(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const punto = e.touches?.[0] ?? e
    return {
      x: punto.clientX - rect.left,
      y: punto.clientY - rect.top,
    }
  }

  function empezar(e) {
    e.preventDefault()
    setDibujando(true)
    ultimoPunto.current = posicionDesdeEvento(e)
  }

  function mover(e) {
    if (!dibujando) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const actual = posicionDesdeEvento(e)
    ctx.beginPath()
    ctx.moveTo(ultimoPunto.current.x, ultimoPunto.current.y)
    ctx.lineTo(actual.x, actual.y)
    ctx.stroke()
    ultimoPunto.current = actual
    setTieneTrazo(true)
  }

  function terminar() {
    setDibujando(false)
  }

  function limpiar() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio)
    setTieneTrazo(false)
  }

  function confirmar() {
    if (!tieneTrazo) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
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
            className="w-full h-56 touch-none cursor-crosshair"
            onMouseDown={empezar}
            onMouseMove={mover}
            onMouseUp={terminar}
            onMouseLeave={terminar}
            onTouchStart={empezar}
            onTouchMove={mover}
            onTouchEnd={terminar}
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