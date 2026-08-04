import { useState } from 'react'
import { Trash2, Send } from 'lucide-react'
import Modal from './Modal'

const TIPOS = [
  { value: 'reunion',        label: 'Reunión' },
  { value: 'capacitacion',   label: 'Capacitación' },
  { value: 'auditoria',      label: 'Auditoría' },
  { value: 'vencimiento',    label: 'Vencimiento' },
  { value: 'evento_interno', label: 'Evento interno' },
]

// Paleta acotada para que los eventos no choquen con los colores
// de marca ya usados en el resto de la app (naranja = hoy/acento).
const COLORES = [
  { value: '#5f7abf', label: 'Azul' },
  { value: '#6b8f5a', label: 'Verde' },
  { value: '#b5546b', label: 'Rosa' },
  { value: '#8a6dd4', label: 'Violeta' },
  { value: '#c98a3a', label: 'Ámbar' },
  { value: '#4a9b9b', label: 'Verde azulado' },
]

export default function EventModal({ evento, fechaInicial, onSave, onDelete, onClose, saving }) {
  const esNuevo = !evento?.id
  const [form, setForm] = useState({
    title: evento?.title ?? '',
    description: evento?.description ?? '',
    event_date: evento?.event_date ?? fechaInicial ?? '',
    event_type: evento?.event_type ?? 'evento_interno',
    color: evento?.color ?? COLORES[0].value,
  })

  function handleSubmit(e) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <Modal title={esNuevo ? 'Nuevo evento' : 'Editar evento'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="label">Título *</label>
          <input
            className="input"
            required
            placeholder="Ej: Reunión de equipo comercial"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Descripción</label>
          <textarea
            className="input h-20 resize-none"
            placeholder="Detalles opcionales..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha *</label>
            <input
              className="input"
              type="date"
              required
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Tipo de evento</label>
            <select
              className="input"
              value={form.event_type}
              onChange={(e) => setForm({ ...form, event_type: e.target.value })}
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setForm({ ...form, color: c.value })}
                className={`w-8 h-8 rounded-full transition-transform ${
                  form.color === c.value ? 'ring-2 ring-offset-2 ring-ink scale-105' : ''
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
                aria-label={c.label}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center gap-3 pt-2 border-t border-slate-200 mt-2">
          {!esNuevo ? (
            <button
              type="button"
              onClick={() => onDelete(evento.id)}
              className="btn-danger text-sm py-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? (
                <span className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {esNuevo ? 'Crear evento' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
