import { toast } from 'react-toastify'
import { useAuth } from '../contexts/AuthContext'
import SignaturePad from './SignaturePad'

/**
 * Envuelve el lienzo de firma (SignaturePad) y, al confirmar, la guarda
 * en el perfil del empleado (profiles.signature_data) como PNG. Se usa
 * tanto en el primer ingreso (SignatureGate) como cuando el empleado
 * quiere actualizarla desde su panel.
 */
export default function FirmaCaptura({ onClose, onSaved }) {
  const { updateSignature } = useAuth()

  async function handleConfirm(dataUrl) {
    try {
      await updateSignature(dataUrl)
      toast.success('Firma guardada')
      onSaved?.(dataUrl)
      onClose?.()
    } catch (err) {
      toast.error(err.message ?? 'No se pudo guardar la firma')
    }
  }

  return <SignaturePad onConfirm={handleConfirm} onClose={onClose} />
}
