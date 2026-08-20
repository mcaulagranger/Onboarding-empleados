import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-toastify'
import { UserCircle, Send } from 'lucide-react'

/**
 * Al primer ingreso del empleado (antes de pedirle la firma) se le pide
 * completar sus datos personales. Al guardar:
 *  - se guardan en la tabla datos_personales,
 *  - se completan algunos campos del perfil (nombre, DNI, teléfono),
 *  - se marca profiles.datos_completos = true,
 *  - y se crea el cumpleaños en el calendario de admin/RRHH (con DNI y
 *    "si estudia") a partir de la fecha de nacimiento.
 *
 * Se auto-gatea: sólo aparece para empleados que todavía no cargaron sus
 * datos.
 */

const vacio = {
  nombre_apellido: '', dni: '', fecha_nacimiento: '', lugar_nacimiento: '',
  telefono_privado: '', domicilio: '', email_privado: '', genero: '',
  placa_vehiculo: '', contacto_emergencia: '', telefono_emergencia: '',
  estado_civil: '', hijos_dependientes: '', estudia: false,
  nivel_educacion: '', estado_educacion: '', institucion: '',
}

function separarNombre(completo) {
  const partes = (completo || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return { first_name: partes[0] || '', last_name: '' }
  return { first_name: partes.slice(0, -1).join(' '), last_name: partes.slice(-1)[0] }
}

export default function DatosPersonalesGate() {
  const { user, profile, fetchProfile } = useAuth()
  const [form, setForm] = useState(vacio)
  const [guardando, setGuardando] = useState(false)

  const debeCompletar = profile?.role === 'employee' && !profile?.datos_completos
  if (!debeCompletar) return null

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre_apellido.trim() || !form.dni.trim() || !form.fecha_nacimiento) {
      toast.error('Completá al menos nombre, DNI y fecha de nacimiento')
      return
    }
    setGuardando(true)
    try {
      const hijos = form.hijos_dependientes === '' ? null : Number(form.hijos_dependientes)

      // 1) Guardar datos personales (uno por empleado)
      const { error: eDatos } = await supabase
        .from('datos_personales')
        .upsert({
          employee_id: user.id,
          nombre_apellido: form.nombre_apellido.trim(),
          dni: form.dni.trim(),
          fecha_nacimiento: form.fecha_nacimiento,
          lugar_nacimiento: form.lugar_nacimiento.trim() || null,
          telefono_privado: form.telefono_privado.trim() || null,
          domicilio: form.domicilio.trim() || null,
          email_privado: form.email_privado.trim() || null,
          genero: form.genero || null,
          placa_vehiculo: form.placa_vehiculo.trim() || null,
          contacto_emergencia: form.contacto_emergencia.trim() || null,
          telefono_emergencia: form.telefono_emergencia.trim() || null,
          estado_civil: form.estado_civil || null,
          hijos_dependientes: hijos,
          estudia: form.estudia,
          nivel_educacion: form.nivel_educacion || null,
          estado_educacion: form.estado_educacion || null,
          institucion: form.institucion.trim() || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'employee_id' })
      if (eDatos) throw eDatos

      // 2) Completar el perfil y marcar datos_completos
      const { error: ePerfil } = await supabase
        .from('profiles')
        .update({
          full_name: form.nombre_apellido.trim(),
          dni: form.dni.trim(),
          phone: form.telefono_privado.trim() || null,
          datos_completos: true,
        })
        .eq('id', user.id)
      if (ePerfil) throw ePerfil

      // 3) Crear el cumpleaños en el calendario de admin/RRHH
      const { first_name, last_name } = separarNombre(form.nombre_apellido)
      const { error: eCumple } = await supabase
        .from('birthdays')
        .insert({
          first_name,
          last_name,
          birth_date: form.fecha_nacimiento,
          email: form.email_privado.trim() || profile?.email || null,
          department: profile?.department || null,
          position: profile?.position || null,
          dni: form.dni.trim(),
          estudia: form.estudia,
          created_by: user.id,
        })
      // Si falla el cumpleaños no bloqueamos el ingreso: avisamos nomás.
      if (eCumple) {
        console.error('No se pudo crear el cumpleaños:', eCumple)
        toast.warning('Datos guardados, pero no se pudo crear el cumpleaños automáticamente.')
      }

      toast.success('¡Datos guardados!')
      await fetchProfile(user.id) // refresca el perfil → cierra este gate
    } catch (err) {
      console.error(err)
      toast.error(err.message ?? 'No se pudieron guardar los datos')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 flex flex-col">
      <div className="bg-natural border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <UserCircle className="w-6 h-6 text-brand-600 flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">Completá tus datos</p>
          <p className="text-xs text-slate-500">Los necesitamos para tu legajo. Es rápido.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-slate-100 px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">

          <section className="card p-5 space-y-4">
            <h3 className="section-heading text-sm">Datos personales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Nombre y apellido *</label>
                <input className="input" required value={form.nombre_apellido}
                  onChange={(e) => set('nombre_apellido', e.target.value)} />
              </div>
              <div>
                <label className="label">DNI *</label>
                <input className="input" required value={form.dni}
                  onChange={(e) => set('dni', e.target.value)} />
              </div>
              <div>
                <label className="label">Fecha de nacimiento *</label>
                <input className="input" type="date" required value={form.fecha_nacimiento}
                  onChange={(e) => set('fecha_nacimiento', e.target.value)} />
              </div>
              <div>
                <label className="label">Lugar de nacimiento</label>
                <input className="input" value={form.lugar_nacimiento}
                  onChange={(e) => set('lugar_nacimiento', e.target.value)} />
              </div>
              <div>
                <label className="label">Género con el que se identifica</label>
                <select className="input" value={form.genero} onChange={(e) => set('genero', e.target.value)}>
                  <option value="">Seleccioná…</option>
                  <option>Femenino</option>
                  <option>Masculino</option>
                  <option>No binario</option>
                  <option>Prefiero no decirlo</option>
                  <option>Otro</option>
                </select>
              </div>
              <div>
                <label className="label">Estado civil</label>
                <select className="input" value={form.estado_civil} onChange={(e) => set('estado_civil', e.target.value)}>
                  <option value="">Seleccioná…</option>
                  <option>Soltero/a</option>
                  <option>Casado/a</option>
                  <option>En pareja</option>
                  <option>Unión convivencial</option>
                  <option>Divorciado/a</option>
                  <option>Viudo/a</option>
                </select>
              </div>
              <div>
                <label className="label">Cantidad de hijos dependientes</label>
                <input className="input" type="number" min="0" value={form.hijos_dependientes}
                  onChange={(e) => set('hijos_dependientes', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="card p-5 space-y-4">
            <h3 className="section-heading text-sm">Contacto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Teléfono privado</label>
                <input className="input" value={form.telefono_privado}
                  onChange={(e) => set('telefono_privado', e.target.value)} />
              </div>
              <div>
                <label className="label">Correo electrónico privado</label>
                <input className="input" type="email" value={form.email_privado}
                  onChange={(e) => set('email_privado', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Domicilio particular</label>
                <input className="input" value={form.domicilio}
                  onChange={(e) => set('domicilio', e.target.value)} />
              </div>
              <div>
                <label className="label">Placa de vehículo</label>
                <input className="input" value={form.placa_vehiculo}
                  onChange={(e) => set('placa_vehiculo', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="card p-5 space-y-4">
            <h3 className="section-heading text-sm">Contacto de emergencia</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Nombre / vínculo</label>
                <input className="input" placeholder="Ej: Ana Pérez (madre)" value={form.contacto_emergencia}
                  onChange={(e) => set('contacto_emergencia', e.target.value)} />
              </div>
              <div>
                <label className="label">Teléfono de emergencia</label>
                <input className="input" value={form.telefono_emergencia}
                  onChange={(e) => set('telefono_emergencia', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="card p-5 space-y-4">
            <h3 className="section-heading text-sm">Educación</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.estudia}
                onChange={(e) => set('estudia', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand-600" />
              <span className="text-sm text-slate-700">Actualmente estudio</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Nivel de educación</label>
                <select className="input" value={form.nivel_educacion} onChange={(e) => set('nivel_educacion', e.target.value)}>
                  <option value="">Seleccioná…</option>
                  <option>Primario</option>
                  <option>Secundario</option>
                  <option>Terciario</option>
                  <option>Universitario</option>
                  <option>Posgrado</option>
                </select>
              </div>
              <div>
                <label className="label">Estado</label>
                <select className="input" value={form.estado_educacion} onChange={(e) => set('estado_educacion', e.target.value)}>
                  <option value="">Seleccioná…</option>
                  <option>Completo</option>
                  <option>En curso</option>
                  <option>Incompleto</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Institución</label>
                <input className="input" value={form.institucion}
                  onChange={(e) => set('institucion', e.target.value)} />
              </div>
            </div>
          </section>

          <div className="flex justify-end pb-2">
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando
                ? <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              {guardando ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
