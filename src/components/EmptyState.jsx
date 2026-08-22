/**
 * Estado vacío reutilizable: ícono + título + descripción + acción opcional.
 * Uso: <EmptyState icon={FileText} title="..." description="..." action={<button.../>} />
 */
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`py-12 px-6 text-center animate-pop-in ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Icon className="w-6 h-6 text-slate-400" />
        </div>
      )}
      <p className="font-medium text-ink">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
