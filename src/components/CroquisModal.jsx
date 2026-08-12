import { useEffect, useRef } from 'react'
import { X, MapPin } from 'lucide-react'
import Modal from './Modal'

/**
 * Muestra una "manzana" del croquis de domicilio bien ampliada, con
 * sus 4 puntos (esquinas) grandes y fáciles de tocar. `sourceCanvas`
 * es el <canvas> donde ya está pintada la página completa; se recorta
 * y agranda solo la parte de esa manzana.
 */
export default function CroquisModal({ manzana, sourceCanvas, scale, seleccionado, onSelect, onClose }) {
  const canvasRef = useRef(null)
  const TAMANO = 320

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !sourceCanvas) return
    canvas.width = TAMANO
    canvas.height = TAMANO
    const ctx = canvas.getContext('2d')

    // Recortar de la página ya renderizada solo el área de esta
    // manzana (con un pequeño margen) y ampliarla al tamaño del modal.
    const margen = 6 * scale
    const srcX = manzana.rect.x * scale - margen
    const srcY = sourceCanvas.height - (manzana.rect.y + manzana.rect.height) * scale - margen
    const srcW = manzana.rect.width * scale + margen * 2
    const srcH = manzana.rect.height * scale + margen * 2

    ctx.imageSmoothingEnabled = true
    ctx.drawImage(sourceCanvas, srcX, srcY, srcW, srcH, 0, 0, TAMANO, TAMANO)
  }, [manzana, sourceCanvas, scale])

  return (
    <Modal title="Marcá dónde queda tu casa" onClose={onClose} size="md">
      <div className="p-6 space-y-4">
        <p className="text-sm text-slate-500">
          Tocá el punto más cercano a dónde está tu casa dentro de esta manzana.
        </p>

        <div className="relative mx-auto" style={{ width: TAMANO, height: TAMANO }}>
          <canvas ref={canvasRef} className="absolute inset-0 rounded-lg border border-slate-200" />

          {manzana.puntos.map((punto) => {
            // Posición del punto DENTRO del recorte, en proporción 0-1,
            // convertida a píxeles del canvas ampliado del modal.
            const margen = 6
            const relX = (punto.rect.x + punto.rect.width / 2 - (manzana.rect.x - margen)) /
              (manzana.rect.width + margen * 2)
            const relY = 1 - (punto.rect.y + punto.rect.height / 2 - (manzana.rect.y - margen)) /
              (manzana.rect.height + margen * 2)

            const activo = seleccionado === punto.opcion
            const size = 56

            return (
              <button
                key={punto.opcion}
                type="button"
                onClick={() => onSelect(punto.opcion)}
                style={{
                  left: relX * TAMANO - size / 2,
                  top: relY * TAMANO - size / 2,
                  width: size,
                  height: size,
                }}
                className="absolute flex items-center justify-center"
              >
                <span
                  className={`w-9 h-9 rounded-full border-[3px] flex items-center justify-center transition-all ${
                    activo
                      ? 'border-brand-600 bg-brand-500 scale-110'
                      : 'border-white bg-ink/10 hover:bg-brand-500/30 hover:border-brand-400'
                  }`}
                  style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.15)' }}
                >
                  {activo && <MapPin className="w-4 h-4 text-fg" strokeWidth={2.5} />}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            <X className="w-4 h-4" />
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
