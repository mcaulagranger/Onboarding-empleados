/**
 * Skeletons: bloques con pulso para mostrar mientras carga el contenido.
 * Dan sensación de velocidad/premium en vez del spinner genérico.
 */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200/70 rounded ${className}`} />
}

/** Fila de lista (documento, empleado, etc.) */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  )
}

/** Tarjeta de estadística */
export function SkeletonStat() {
  return (
    <div className="card p-4 flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

/** Bloque grande (hero / card de contenido) */
export function SkeletonCard({ className = 'h-40' }) {
  return <Skeleton className={`w-full rounded-xl ${className}`} />
}
