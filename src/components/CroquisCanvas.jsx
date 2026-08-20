import { useEffect, useRef } from 'react'

/**
 * Lienzo transparente para dibujar a mano alzada sobre una zona del PDF
 * (el croquis de domicilio: "marcá dónde queda tu casa en la manzana").
 * Se superpone exactamente sobre la región y, al guardar, el componente
 * padre lee este mismo <canvas> con toDataURL para estamparlo en el PDF.
 *
 * Props:
 *   name          — id de la región (clave del croquis)
 *   width, height — tamaño en píxeles CSS (ya escalado a pantalla)
 *   color         — color del trazo
 *   registerCanvas(name, el) — registra/limpia el elemento en el padre
 *   onDraw(name)  — avisa al padre que la región fue tocada
 */
export default function CroquisCanvas({ name, width, height, color = '#1d4ed8', registerCanvas, onDraw }) {
  const ref = useRef(null)
  const dibujando = useRef(false)
  const ultimo = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color

    registerCanvas?.(name, canvas)
    return () => registerCanvas?.(name, null)
  }, [name, width, height, color, registerCanvas])

  function posicion(e) {
    const rect = ref.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function empezar(e) {
    e.preventDefault()
    e.stopPropagation()
    ref.current.setPointerCapture?.(e.pointerId)
    dibujando.current = true
    ultimo.current = posicion(e)
    onDraw?.(name)
  }

  function mover(e) {
    if (!dibujando.current) return
    e.preventDefault()
    const ctx = ref.current.getContext('2d')
    const actual = posicion(e)
    ctx.beginPath()
    ctx.moveTo(ultimo.current.x, ultimo.current.y)
    ctx.lineTo(actual.x, actual.y)
    ctx.stroke()
    ultimo.current = actual
  }

  function terminar() {
    dibujando.current = false
  }

  return (
    <canvas
      ref={ref}
      style={{ width, height, touchAction: 'none' }}
      className="absolute inset-0 cursor-crosshair"
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={terminar}
      onPointerLeave={terminar}
      onPointerCancel={terminar}
    />
  )
}
