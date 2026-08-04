# Portal de Onboarding — Granger.

App web para que Recursos Humanos gestione la documentación de los ingresantes.
El empleado entra con su usuario, ve solo sus documentos, los descarga, los completa
y los sube. RRHH ve a todos, asigna documentos y descarga los completados.

**Stack:** React 18 + Vite · Tailwind CSS · Supabase (Auth + Postgres + Storage)

---

## Por qué Supabase Storage y no otra cosa

Para una PyME con volumen de PDF bajo, Supabase Storage es la opción correcta:

| Opción | Veredicto |
|---|---|
| **Supabase Storage** | ✅ Elegida. Ya viene con el mismo proyecto que la base y el login. Los permisos se escriben una sola vez (RLS) y valen para tablas y archivos. 1 GB gratis, después ~USD 0,021/GB. Un PDF escaneado pesa ~500 KB: con 1 GB entran unos 2.000 documentos. |
| AWS S3 | Más barato a escala grande, pero hay que administrar IAM, CORS y URLs firmadas aparte. No se justifica en este tamaño. |
| Google Drive API | Tentador porque RRHH ya usa Drive, pero los permisos por empleado son frágiles y el OAuth se rompe seguido. |
| Guardar el PDF en la base (bytea) | No. Infla la base, encarece los backups y complica las descargas. |

Los archivos **no** van en buckets públicos: se sirven con URLs firmadas de 60 segundos.

---

## Instalación

### 1. Dependencias

```bash
npm install
```

### 2. Proyecto en Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com) (plan Free alcanza).
2. Ir a **SQL Editor** y ejecutar completo el archivo `supabase/schema.sql`.
   Eso crea las tablas, el trigger de perfiles, las políticas RLS y los dos buckets.
3. Ir a **Project Settings → API** y copiar `Project URL` y `anon public key`.

### 3. Variables de entorno

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

### 4. Primer usuario de RRHH

Editá el email y la contraseña arriba de `supabase/seed-admin.sql` y ejecutalo en
el SQL Editor. Crea la cuenta con el mail ya confirmado y el rol `admin`.

Se puede correr varias veces sin problema: si el email ya existe, solo lo asciende
a admin.

**Alternativa por interfaz:** en **Authentication → Users → Add user**, con
"Auto Confirm User" activado, y después:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'rrhh@granger.com';
```

Este es el único usuario que se crea a mano. Los demás salen del panel de RRHH.

### 5. Edge Function (necesaria para crear empleados)

Sin esto, el alta de un empleado desloguea a la persona de RRHH, porque
`signUp` cambia la sesión activa del navegador.

```bash
npm i -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy crear-empleado
```

Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
ya vienen inyectadas en el entorno de las Edge Functions.

### 6. Levantar

```bash
npm run dev
```

---

## Cómo funciona el circuito

```
RRHH sube el PDF base          →  document_templates + bucket document-templates
RRHH lo asigna a un ingresante →  employee_documents (status: pending)
El ingresante lo descarga
El ingresante sube el completado →  bucket completed-documents
                                    status pasa a 'completed' + completed_at
RRHH lo descarga desde el perfil del empleado
```

### Quién ve qué

| | Ingresante | RRHH |
|---|---|---|
| Su perfil | ✅ | ✅ |
| Perfiles de otros | ❌ | ✅ |
| Sus documentos | ✅ | ✅ |
| Documentos de otros | ❌ | ✅ |
| Subir plantillas | ❌ | ✅ |
| Asignar documentos | ❌ | ✅ |

Esto está garantizado en la base con Row Level Security, no solo en el frontend.
Aunque alguien manipule el navegador, Postgres no le devuelve filas ajenas.

---

## Sistema visual

Tomado de la propuesta de paleta de Granger. Está todo en `tailwind.config.js`.

| Token | Hex | Uso |
|---|---|---|
| `ivori` | `#f7f2e7` | Fondo de la app |
| `natural` | `#fff8ec` | Superficies, tarjetas |
| `ink` | `#22201c` | Texto, sidebar, superficies oscuras |
| `ink-soft` | `#3b3836` | Superficie oscura secundaria |
| `brand-500` | `#f18a00` | Acento principal, botones, estado activo |
| `brand-400` | `#f49b31` | Acento medio |
| `brand-300` | `#f9be78` | Acento suave |
| `durazno` | `#e6523e` | Errores, ícono de PDF |
| `health` | `#b0c8e9` | Avisos informativos |
| `vainilla` / `limon` | `#ffc81e` / `#f3c300` | Estado pendiente |

**Tipografía:** Fraunces para títulos (display), Archivo para interfaz.
El wordmark `Granger.` usa Archivo 900 itálica con el punto en naranja.

**Detalle de marca:** la textura de líneas orgánicas del key visual está
recreada en SVG (`.granger-texture` en `index.css`) y aparece al 7-9% de opacidad
en el login y en la bienvenida del ingresante.

Los botones naranjas llevan texto en negro gris, no en blanco: da 7:1 de contraste
contra los 2,6:1 del blanco sobre naranja.

---

## Estructura

```
src/
├── lib/supabase.js              cliente
├── contexts/AuthContext.jsx     sesión + perfil + rol
├── components/                  Layout, Sidebar, Modal, StatusBadge
├── pages/
│   ├── Login.jsx
│   ├── admin/                   Dashboard, Employees, EmployeeDetail, Templates
│   └── employee/                Dashboard, MyDocuments
supabase/
├── schema.sql                   tablas + RLS + buckets
├── storage-policies.sql         políticas de archivos (re-ejecutable)
├── seed-admin.sql               crea el usuario de RRHH
└── functions/crear-empleado/    alta de usuarios sin romper la sesión
```

---

## Para más adelante

- **Formularios nativos en vez de PDF.** Hoy el ingresante descarga, imprime o
  completa el PDF y lo vuelve a subir. Cargar los datos personales directamente
  en un formulario web y generar el PDF del lado del servidor elimina el paso
  del escáner. Es el próximo salto de usabilidad.
- **Firma digital** con un canvas simple embebido en el PDF.
- **Recordatorios** por mail a los 3 días de un documento pendiente
  (cron de Supabase + Resend).
- **Estado "en revisión"** ya existe en la base: falta el botón en el panel de RRHH
  para devolver un documento mal completado con una nota.
