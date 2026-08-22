import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-toastify'
import { UserCircle, Send, ArrowLeft, ArrowRight, Check } from 'lucide-react'

/**
 * Wizard de datos personales (primer ingreso del empleado, antes de la
 * firma). 3 pasos con stepper y validación inline. Al guardar:
 *  - guarda en datos_personales,
 *  - completa el perfil (nombre, DNI, teléfono) y marca datos_completos,
 *  - crea el cumpleaños en el calendario de admin/RRHH (DNI + "si estudia").
 * Se auto-gatea: sólo aparece si el empleado todavía no cargó sus datos.
 */

const vacio = {
  nombre_apellido: '', dni: '', fecha_nacimiento: '', lugar_nacimiento: '',
  telefono_privado: '', domicilio: '', email_privado: '', genero: '',
  placa_vehiculo: '', contacto_emergencia: '', telefono_emergencia: '',
  estado_civil: '', hijos_dependientes: '', estudia: false,
  nivel_educacion: '', estado_educacion: '', institucion: '',
}

const PASOS = ['Datos personales', 'Contacto', 'Educación']

function separarNombre(completo) {
  const partes = (completo || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return { first_name: partes[0] || '', last_name: '' }
  return { first_name: partes.slice(0, -1).join(' '), last_name: partes.slice(-1)[0] }
}

// Campo con label + error inline
function Campo({ label, required, error, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">
        {label}{required && ' *'}
      </label>
      {children}
      {error && <p className="text-xs text-durazno mt-1">{error}</p>}
    </div>
  )
}

export default function DatosPersonalesGate() {
  const { user, profile, fetchProfile } = useAuth()
  const [form, setForm] = useState(vacio)
  const [paso, setPaso] = useState(0)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const debeCompletar = profile?.role === 'employee' && !profile?.datos_completos
  if (!debeCompletar) return null

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  // Devuelve los errores de un paso (objeto vacío = paso válido)
  function validarPaso(p) {
    const e = {}
    if (p === 0) {
      if (!form.nombre_apellido.trim()) e.nombre_apellido = 'Ingresá tu nombre y apellido'
      const dniDigits = form.dni.replace(/\D/g, '')
      if (!form.dni.trim()) e.dni = 'Ingresá tu DNI'
      else if (dniDigits.length < 7) e.dni = 'El DNI parece incompleto'
      if (!form.fecha_nacimiento) e.fecha_nacimiento = 'Ingresá tu fecha de nacimiento'
    }
    if (p === 1) {
      if (form.email_privado && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email_privado))
        e.email_privado = 'Correo inválido'
    }
    return e
  }

  function siguiente() {
    const e = validarPaso(paso)
    if (Object.keys(e).length) { setErrores(e); return }
    setErrores({})
    setPaso((p) => Math.min(PASOS.length - 1, p + 1))
  }
  function anterior() {
    setErrores({})
    setPaso((p) => Math.max(0, p - 1))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // Validar todo (los obligatorios están en el paso 0)
    const errPaso0 = validarPaso(0)
    if (Object.keys(errPaso0).length) { setErrores(errPaso0); setPaso(0); return }

    setGuardando(true)
    try {
      const hijos = form.hijos_dependientes === '' ? null : Number(form.hijos_dependientes)

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

      const { first_name, last_name } = separarNombre(form.nombre_apellido)
      const { error: eCumple } = await supabase
        .from('birthdays')
        .insert({
          first_name, last_name,
          birth_date: form.fecha_nacimiento,
          email: form.email_privado.trim() || profile?.email || null,
          department: profile?.department || null,
          position: profile?.position || null,
          dni: form.dni.trim(),
          estudia: form.estudia,
          created_by: user.id,
        })
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

  const esUltimo = paso === PASOS.length - 1

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 flex flex-col">
      {/* Encabezado + stepper */}
      <div className="bg-natural border-b border-slate-200 px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <UserCircle className="w-6 h-6 text-brand-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-ink truncate">Completá tus datos</p>
            <p className="text-xs text-slate-500">Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mt-3 max-w-lg">
          {PASOS.map((nombre, i) => {
            const hecho = i < paso
            const activo = i === paso
            return (
              <div key={nombre} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors ${
                    hecho ? 'bg-emerald-500 text-white'
                    : activo ? 'bg-brand-500 text-ink'
                    : 'bg-slate-200 text-slate-500'
                  }`}>
                    {hecho ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`text-xs font-medium truncate hidden sm:block ${activo ? 'text-ink' : 'text-slate-500'}`}>
                    {nombre}
                  </span>
                </div>
                {i < PASOS.length - 1 && (
                  <div className="flex-1 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: hecho ? '100%' : '0%' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cuerpo del paso */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-slate-100 px-4 py-6">
        <div key={paso} className="max-w-2xl mx-auto animate-pop-in">

          {paso === 0 && (
            <section className="card p-5 space-y-4">
              <h3 className="section-heading text-sm">Datos personales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Nombre y apellido" required error={errores.nombre_apellido} className="sm:col-span-2">
                  <input className={`input ${errores.nombre_apellido ? 'border-durazno' : ''}`}
                    value={form.nombre_apellido} onChange={(e) => set('nombre_apellido', e.target.value)} />
                </Campo>
                <Campo label="DNI" required error={errores.dni}>
                  <input className={`input ${errores.dni ? 'border-durazno' : ''}`} inputMode="numeric"
                    value={form.dni} onChange={(e) => set('dni', e.target.value)} />
                </Campo>
                <Campo label="Fecha de nacimiento" required error={errores.fecha_nacimiento}>
                  <input type="date" className={`input ${errores.fecha_nacimiento ? 'border-durazno' : ''}`}
                    value={form.fecha_nacimiento} onChange={(e) => set('fecha_nacimiento', e.target.value)} />
                </Campo>
                <Campo label="Lugar de nacimiento">
                  <input className="input" value={form.lugar_nacimiento} onChange={(e) => set('lugar_nacimiento', e.target.value)} />
                </Campo>
                <Campo label="Género con el que se identifica">
                  <select className="input" value={form.genero} onChange={(e) => set('genero', e.target.value)}>
                    <option value="">Seleccioná…</option>
                    <option>Femenino</option><option>Masculino</option><option>No binario</option>
                    <option>Prefiero no decirlo</option><option>Otro</option>
                  </select>
                </Campo>
                <Campo label="Estado civil">
                  <select className="input" value={form.estado_civil} onChange={(e) => set('estado_civil', e.target.value)}>
                    <option value="">Seleccioná…</option>
                    <option>Soltero/a</option><option>Casado/a</option><option>En pareja</option>
                    <option>Unión convivencial</option><option>Divorciado/a</option><option>Viudo/a</option>
                  </select>
                </Campo>
                <Campo label="Cantidad de hijos dependientes">
                  <input type="number" min="0" className="input" value={form.hijos_dependientes}
                    onChange={(e) => set('hijos_dependientes', e.target.value)} />
                </Campo>
              </div>
            </section>
          )}

          {paso === 1 && (
            <div className="space-y-6">
              <section className="card p-5 space-y-4">
                <h3 className="section-heading text-sm">Contacto</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo label="Teléfono privado">
                    <input className="input" inputMode="tel" value={form.telefono_privado} onChange={(e) => set('telefono_privado', e.target.value)} />
                  </Campo>
                  <Campo label="Correo electrónico privado" error={errores.email_privado}>
                    <input type="email" className={`input ${errores.email_privado ? 'border-durazno' : ''}`}
                      value={form.email_privado} onChange={(e) => set('email_privado', e.target.value)} />
                  </Campo>
                  <Campo label="Domicilio particular" className="sm:col-span-2">
                    <input className="input" value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)} />
                  </Campo>
                  <Campo label="Placa de vehículo">
                    <input className="input" value={form.placa_vehiculo} onChange={(e) => set('placa_vehiculo', e.target.value)} />
                  </Campo>
                </div>
              </section>
              <section className="card p-5 space-y-4">
                <h3 className="section-heading text-sm">Contacto de emergencia</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo label="Nombre / vínculo">
                    <input className="input" placeholder="Ej: Ana Pérez (madre)" value={form.contacto_emergencia} onChange={(e) => set('contacto_emergencia', e.target.value)} />
                  </Campo>
                  <Campo label="Teléfono de emergencia">
                    <input className="input" inputMode="tel" value={form.telefono_emergencia} onChange={(e) => set('telefono_emergencia', e.target.value)} />
                  </Campo>
                </div>
              </section>
            </div>
          )}

          {paso === 2 && (
            <section className="card p-5 space-y-4">
              <h3 className="section-heading text-sm">Educación</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.estudia} onChange={(e) => set('estudia', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600" />
                <span className="text-sm text-slate-700">Actualmente estudio</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Nivel de educación">
                  <select className="input" value={form.nivel_educacion} onChange={(e) => set('nivel_educacion', e.target.value)}>
                    <option value="">Seleccioná…</option>
                    <option>Primario</option><option>Secundario</option><option>Terciario</option>
                    <option>Universitario</option><option>Posgrado</option>
                  </select>
                </Campo>
                <Campo label="Estado">
                  <select className="input" value={form.estado_educacion} onChange={(e) => set('estado_educacion', e.target.value)}>
                    <option value="">Seleccioná…</option>
                    <option>Completo</option><option>En curso</option><option>Incompleto</option>
                  </select>
                </Campo>
                <Campo label="Institución" className="sm:col-span-2">
                  <input className="input" value={form.institucion} onChange={(e) => set('institucion', e.target.value)} />
                </Campo>
              </div>
            </section>
          )}

          {/* Navegación */}
          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={anterior} disabled={paso === 0}
              className="btn-secondary disabled:opacity-0 disabled:cursor-default">
              <ArrowLeft className="w-4 h-4" />
              Atrás
            </button>

            {!esUltimo ? (
              <button type="button" onClick={siguiente} className="btn-primary">
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando
                  ? <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
                {guardando ? 'Guardando…' : 'Guardar y continuar'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}