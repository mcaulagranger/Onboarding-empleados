/**
 * Tooltip liviano (sin dependencias): aparece al pasar el mouse o al
 * enfocar con teclado. Envolvé el elemento disparador:
 *   <Tooltip label="Descargar"><button>…</button></Tooltip>
 */
const posiciones = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
}

export default function Tooltip({ label, children, side = 'top', className = '' }) {
  if (!label) return children
  return (
    <span className={`relative inline-flex group ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink text-white text-xs px-2 py-1 shadow-md
          opacity-0 scale-95 transition-all duration-150
          group-hover:opacity-100 group-hover:scale-100
          group-focus-within:opacity-100 group-focus-within:scale-100
          ${posiciones[side]}`}
      >
        {label}
      </span>
    </span>
  )
}
