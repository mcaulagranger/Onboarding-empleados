// Utilidades de fecha para el calendario corporativo y cumpleaños.
// Todo en hora local: los eventos son "de todo el día", no timestamps.

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_CORTOS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

export function nombreMes(mes) {
  return MESES[mes]
}

export function diasCortos() {
  return DIAS_CORTOS
}

// Clave "YYYY-MM-DD" en hora LOCAL (evita el corrimiento de un día que
// da toISOString() por usar UTC).
export function claveFecha(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function esMismoDia(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// Matriz de 6 semanas x 7 días para pintar el mes, empezando en lunes.
// Incluye días del mes anterior/siguiente para completar la grilla.
export function matrizDelMes(year, month) {
  const primerDia = new Date(year, month, 1)
  // getDay(): 0=domingo..6=sábado → convertimos a 0=lunes..6=domingo
  const offset = (primerDia.getDay() + 6) % 7
  const inicio = new Date(year, month, 1 - offset)

  const semanas = []
  let cursor = new Date(inicio)
  for (let semana = 0; semana < 6; semana++) {
    const fila = []
    for (let dia = 0; dia < 7; dia++) {
      fila.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    semanas.push(fila)
  }
  return semanas
}

// Convierte un string "YYYY-MM-DD" (lo que devuelve Postgres para
// columnas DATE) a un Date en medianoche LOCAL, no UTC.
//
// El bug que resuelve: `new Date("2026-06-13")` JavaScript lo
// interpreta como medianoche UTC. En una zona horaria detrás de UTC
// (Argentina, UTC-3), esa medianoche UTC cae la tarde/noche anterior
// en hora local — por eso un cumpleaños el 13 aparecía como el 12.
// Agregar la hora explícita fuerza a que se interprete en LOCAL.
export function parseFechaLocal(fechaString) {
  if (!fechaString) return null
  // Ya viene con hora (timestamps) → se deja tal cual.
  if (fechaString.includes('T')) return new Date(fechaString)
  return new Date(`${fechaString}T00:00:00`)
}

// Cuántos años cumple una persona en su próximo cumpleaños (o hoy).
export function edadQueCumple(birthDate, enFecha = new Date()) {
  const nacimiento = parseFechaLocal(birthDate)
  let años = enFecha.getFullYear() - nacimiento.getFullYear()
  const yaPaso = (enFecha.getMonth() > nacimiento.getMonth()) ||
    (enFecha.getMonth() === nacimiento.getMonth() && enFecha.getDate() >= nacimiento.getDate())
  if (!yaPaso) años -= 1
  return años + 1  // el año que está por cumplir / cumplió hoy
}

// Próxima ocurrencia del cumpleaños (día/mes) desde "desde".
export function proximoCumpleanos(birthDate, desde = new Date()) {
  const nacimiento = parseFechaLocal(birthDate)
  const hoy = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())
  let candidato = new Date(desde.getFullYear(), nacimiento.getMonth(), nacimiento.getDate())
  if (candidato < hoy) {
    candidato = new Date(desde.getFullYear() + 1, nacimiento.getMonth(), nacimiento.getDate())
  }
  return candidato
}

export function formatoCorto(date) {
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export function formatoLargo(date) {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}