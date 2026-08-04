import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react'
import { matrizDelMes, diasCortos, nombreMes, esMismoDia, claveFecha } from '../lib/dateUtils'

/**
 * Calendario mensual. `eventos` es un array de:
 *   { id, date: Date, title, color, isBirthday?: bool }
 * agrupados internamente por día.
 */
export default function Calendar({ eventos, onDayClick, onEventClick }) {
  const hoy = new Date()
  const [cursor, setCursor] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

  const semanas = useMemo(
    () => matrizDelMes(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  )

  const eventosPorDia = useMemo(() => {
    const mapa = new Map()
    for (const ev of eventos) {
      const clave = claveFecha(ev.date)
      if (!mapa.has(clave)) mapa.set(clave, [])
      mapa.get(clave).push(ev)
    }
    return mapa
  }, [eventos])

  function cambiarMes(delta) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  function irAHoy() {
    setCursor(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  }

  return (
    <div className="card overflow-hidden">
      {/* Encabezado del calendario */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <h2 className="section-heading text-base">
          {nombreMes(cursor.getMonth())} {cursor.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={irAHoy}
            className="text-xs font-medium text-slate-600 hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => cambiarMes(-1)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-ink hover:bg-slate-100 transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => cambiarMes(1)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-ink hover:bg-slate-100 transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {diasCortos().map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Grilla del mes */}
      <div className="grid grid-cols-7">
        {semanas.flat().map((dia, i) => {
          const clave = claveFecha(dia)
          const delMes = dia.getMonth() === cursor.getMonth()
          const esHoy = esMismoDia(dia, hoy)
          const eventosDia = eventosPorDia.get(clave) ?? []

          return (
            <button
              key={i}
              onClick={() => onDayClick?.(dia)}
              className={`relative min-h-[84px] sm:min-h-[104px] p-1.5 sm:p-2 text-left border-b border-r border-slate-100
                          transition-colors hover:bg-brand-50/60 focus:outline-none focus-visible:ring-1
                          focus-visible:ring-inset focus-visible:ring-brand-400
                          ${delMes ? 'bg-natural' : 'bg-slate-50/50'}`}
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                            ${esHoy ? 'bg-brand-500 text-ink font-semibold' : delMes ? 'text-ink' : 'text-slate-400'}`}
              >
                {dia.getDate()}
              </span>

              <div className="mt-1 space-y-0.5">
                {eventosDia.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onEventClick?.(ev) }}
                    className="flex items-center gap-1 px-1 py-0.5 rounded truncate text-[10px] sm:text-[11px] font-medium
                               hover:brightness-95 transition"
                    style={{ backgroundColor: `${ev.color}22`, color: ev.color }}
                    title={ev.title}
                  >
                    <Circle className="w-1.5 h-1.5 flex-shrink-0" fill={ev.color} strokeWidth={0} />
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}
                {eventosDia.length > 3 && (
                  <p className="text-[10px] text-slate-400 pl-1">+{eventosDia.length - 3} más</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
