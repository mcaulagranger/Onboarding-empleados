import { toast } from 'react-toastify'
import { armarDiagnostico, copiarTexto } from './diagnostics'

// Evita mostrar el mismo toast en loop si un error se repite muchas
// veces por segundo (por ejemplo, dentro de un bucle de render).
let ultimoAviso = 0
const COOLDOWN_MS = 4000

function mostrarToast(err, origen) {
  const ahora = Date.now()
  if (ahora - ultimoAviso < COOLDOWN_MS) return
  ultimoAviso = ahora

  const texto = armarDiagnostico(err, { Origen: origen })
  console.error(`[${origen}]`, err)

  toast.error(
    ({ closeToast }) => (
      <div className="text-sm">
        <p className="font-medium mb-1">Ocurrió un error inesperado</p>
        <p className="text-xs text-slate-500 mb-2 break-words">
          {String(err?.message ?? err).slice(0, 120)}
        </p>
        <button
          onClick={async () => {
            const ok = await copiarTexto(texto)
            toast.info(ok ? 'Diagnóstico copiado' : 'No se pudo copiar')
          }}
          className="text-xs font-semibold text-brand-700 underline"
        >
          Copiar diagnóstico técnico
        </button>
      </div>
    ),
    { autoClose: 12000 }
  )
}

/**
 * Instala listeners globales para dos cosas que, si no, solo se ven en
 * la consola del navegador (invisibles para alguien usando el celular
 * sin devtools):
 *  - `unhandledrejection`: una Promise que rechazó y nadie hizo .catch.
 *  - `error`: un error sin capturar fuera del ciclo de render de React
 *    (el de React lo cubre el ErrorBoundary aparte).
 */
export function instalarCapturadorGlobal() {
  window.addEventListener('unhandledrejection', (event) => {
    mostrarToast(event.reason, 'Promise rechazada sin manejar')
  })
  window.addEventListener('error', (event) => {
    // Ignoramos errores de recursos (imágenes rotas, etc.) que no traen
    // un Error real en event.error.
    if (!event.error) return
    mostrarToast(event.error, 'Error global')
  })
}
