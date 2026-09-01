/**
 * Subida de imágenes a Cloudinary desde el navegador ("unsigned upload"):
 * no requiere API key/secret en el frontend, solo el cloud name y un
 * upload preset configurado como "Unsigned" en el dashboard de
 * Cloudinary (Settings → Upload → Upload presets).
 *
 * Variables de entorno esperadas (.env):
 *   VITE_CLOUDINARY_CLOUD_NAME=tu-cloud-name   (SOLO el nombre, no la URL completa)
 *   VITE_CLOUDINARY_UPLOAD_PRESET=el-preset-id
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const MAX_MB = 5

/**
 * Sube una imagen a Cloudinary y devuelve su URL pública (secure_url).
 * Tira un Error con mensaje legible si algo falla.
 */
export async function subirImagenCloudinary(file) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary no está configurado (faltan variables de entorno).')
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.')
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`La imagen no puede superar los ${MAX_MB} MB.`)
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    // Cloudinary devuelve el motivo en data.error.message (ej: preset
    // inexistente, cloud name mal escrito, etc.)
    throw new Error(data?.error?.message ?? 'No se pudo subir la imagen a Cloudinary.')
  }

  return data.secure_url
}
