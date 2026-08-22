import { Check } from 'lucide-react'

/**
 * Checklist de onboarding: recibe una lista de pasos y los muestra con su
 * estado (hecho / pendiente) y una acción opcional para los pendientes.
 *
 * steps: [{ label, hint?, done: boolean, action?: ReactNode }]
 */
export default function OnboardingChecklist({ steps }) {
  return (
    <ul className="divide-y divide-slate-100">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              s.done ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 text-transparent'
            }`}
            aria-hidden="true"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${s.done ? 'text-slate-400 line-through' : 'text-ink'}`}>
              {s.label}
            </p>
            {s.hint && <p className="text-xs text-slate-500 mt-0.5">{s.hint}</p>}
          </div>
          {!s.done && s.action ? <div className="flex-shrink-0">{s.action}</div> : null}
          {s.done && <span className="text-[11px] font-medium text-emerald-600 flex-shrink-0">Listo</span>}
        </li>
      ))}
    </ul>
  )
}
