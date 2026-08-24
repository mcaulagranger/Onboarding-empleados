/**
 * Arma un texto de diagnóstico técnico a partir de un error + contexto,
 * pensado para que la persona lo copie y lo mande tal cual (sin
 * parafrasear) cuando algo falla en un dispositivo que no podemos
 * inspeccionar directamente (el celular de un empleado, por ejemplo).
 */
export function armarDiagnostico(err, contexto = {}) {
  const lineas = [
    `Fecha: ${new Date().toISOString()}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : '—'}`,
    `User-Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : '—'}`,
    `Pantalla: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '—'}`,
    `Promise.withResolvers disponible: ${typeof Promise.withResolvers === 'function'}`,
    `structuredClone disponible: ${typeof structuredClone === 'function'}`,
    ...Object.entries(contexto).map(([k, v]) => `${k}: ${v}`),
    '',
    `Error: ${err?.name ?? '(sin nombre)'}`,
    `Mensaje: ${err?.message ?? String(err)}`,
    '',
    'Stack:',
    err?.stack ?? '(no disponible)',
  ]
  return lineas.join('\n')
}

/**
 * Copia texto al portapapeles. En páginas no-HTTPS o navegadores viejos
 * `navigator.clipboard` puede no existir; en ese caso usamos el método
 * de respaldo (textarea + execCommand) para que igual funcione.
 */
export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
    throw new Error('sin clipboard API')
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = texto
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}
