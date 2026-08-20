import { Cake, Briefcase, Mail, PartyPopper, IdCard, GraduationCap } from 'lucide-react'
import Modal from './Modal'
import { edadQueCumple, parseFechaLocal } from '../lib/dateUtils'

export default function BirthdayDetailModal({ cumple, onClose }) {
  const edad = edadQueCumple(cumple.birth_date)

  // URL directa de Cloudinary
  const photoUrl = cumple?.photoUrl || cumple?.photo_url || null

  const iniciales = `${cumple?.first_name?.[0] ?? ''}${cumple?.last_name?.[0] ?? ''}`

  return (
    <Modal title="Cumpleaños" onClose={onClose} size="sm">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-4">

          {/* FOTO */}
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-800 font-bold text-lg uppercase flex-shrink-0 overflow-hidden">

            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${cumple.first_name ?? ''} ${cumple.last_name ?? ''}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Si Cloudinary devuelve error o la imagen no existe,
                  // mostramos las iniciales.
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.parentElement.innerText = iniciales
                }}
              />
            ) : (
              iniciales
            )}

          </div>

          {/* DATOS DEL EMPLEADO */}
          <div>
            <p className="font-semibold text-ink text-lg">
              {cumple.first_name} {cumple.last_name}
            </p>

            <p className="flex items-center gap-1.5 text-sm text-brand-700 font-medium">
              <PartyPopper className="w-4 h-4" />
              Cumple {edad} años
            </p>
          </div>
        </div>

        {/* INFORMACIÓN */}
        <div className="space-y-2.5 text-sm border-t border-slate-200 pt-4">

          {cumple.department && (
            <div className="flex items-center gap-2 text-slate-700">
              <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {cumple.department}
              {cumple.position && ` · ${cumple.position}`}
            </div>
          )}

          {cumple.email && (
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {cumple.email}
            </div>
          )}

          {cumple.dni && (
            <div className="flex items-center gap-2 text-slate-700">
              <IdCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
              DNI {cumple.dni}
            </div>
          )}

          {cumple.estudia != null && (
            <div className="flex items-center gap-2 text-slate-700">
              <GraduationCap className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {cumple.estudia ? 'Estudia actualmente' : 'No estudia actualmente'}
            </div>
          )}

          <div className="flex items-center gap-2 text-slate-700">
            <Cake className="w-4 h-4 text-slate-400 flex-shrink-0" />

            {parseFechaLocal(cumple.birth_date).toLocaleDateString(
              'es-AR',
              {
                day: 'numeric',
                month: 'long'
              }
            )}
          </div>

        </div>
      </div>
    </Modal>
  )
}