import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // pdfjs-dist y pdf-lib se usan solo dentro de PdfFormFiller, que se
  // carga de forma diferida (lazy). Al listarlas acá, Vite las
  // pre-empaqueta al arrancar y no falla al resolverlas la primera vez
  // que un empleado abre "Completar ahora".
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib'],
  },
})