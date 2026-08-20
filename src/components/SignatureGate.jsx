import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Modal from './Modal'
import FirmaCaptura from './FirmaCaptura'
import { PenLine, Clock } from 'lucide-react'

/**
 * Al primer ingreso del empleado, le pide registrar su firma una sola
 * vez. Se guarda como PNG en el perfil y después, al completar cualquier
 * documento, solo tiene que tocar "Colocar firma" — no vuelve a dibujar.
 *
 * Se auto-gatea: no muestra nada si el usuario no es empleado o si ya
 * tiene una firma guardada. Podés posponerlo ("Más tarde"), y en ese
 * caso se vuelve a pedir en el próximo ingreso.
 */
export default function SignatureGate() {
  const { profile } = useAuth()
  const [pospuesto, setPospuesto] = useState(false)
  const [dibujando, setDibujando] = useState(false)

  const debeFirmar = profile?.role === 'employee' && profile?.datos_completos && !profile?.signature_data
  if (!debeFirmar || pospuesto) return null

  if (dibujando) {
    return (
      <FirmaCaptura
        onClose={() => setDibujando(false)}
        onSaved={() => setDibujando(false)}
      />
    )
  }

  return (
    <Modal title="Registrá tu firma" onClose={() => setPospuesto(true)} size="sm">
      <div className="p-6 space-y-5 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto">
          <PenLine className="w-7 h-7 text-brand-600" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm text-slate-600 leading-relaxed">
            Dibujá tu firma una sola vez. La vamos a guardar de forma segura
            para que, al completar tus documentos, solo tengas que{' '}
            <strong>tocar “Colocar firma”</strong> y aparezca sola donde
            corresponde.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <button onClick={() => setDibujando(true)} className="btn-primary w-full justify-center">
            <PenLine className="w-4 h-4" />
            Crear mi firma
          </button>
          <button
            onClick={() => setPospuesto(true)}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5 justify-center py-1"
          >
            <Clock className="w-3.5 h-3.5" />
            Más tarde
          </button>
        </div>
      </div>
    </Modal>
  )
}